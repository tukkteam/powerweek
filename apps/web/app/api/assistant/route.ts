import { applyOperations, dayKeyOf, type Operation } from "@powerweek/core";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { completeJson, ModelError } from "@/lib/assistant/model";
import { parseAssistantOutput } from "@/lib/assistant/parse";
import { buildMessages } from "@/lib/assistant/prompt";
import { getDictionary, locales } from "@/lib/i18n";
import { fetchPlan, PlanError, savePlan, type Db } from "@/lib/plan-api";
import { getServerSupabase } from "@/lib/supabase/server";

export const maxDuration = 60;

const BodySchema = z.object({
  input: z.string().trim().min(1).max(600),
  lang: z.enum(locales),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const LIMITS = { perMinute: 8, perDayAnonymous: 120, perDay: 400 };

type Status = "ok" | "no_changes" | "invalid_output" | "model_error" | "conflict";

export type AssistantErrorCode =
  | "bad_request"
  | "unauthorized"
  | "rate_limited"
  | "assistant_unavailable"
  | "assistant_invalid"
  | "conflict"
  | "server_error";

const fail = (error: AssistantErrorCode, status: number) =>
  NextResponse.json({ error }, { status });

async function logRequest(
  db: Db,
  userId: string,
  status: Status,
  model: string | null,
  startedAt: number,
) {
  await db
    .from("assistant_requests")
    .insert({ user_id: userId, status, model, latency_ms: Date.now() - startedAt });
}

async function overLimit(db: Db, isAnonymous: boolean): Promise<boolean> {
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [minute, day] = await Promise.all([
    db
      .from("assistant_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", minuteAgo),
    db
      .from("assistant_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo),
  ]);
  const dayLimit = isAnonymous ? LIMITS.perDayAnonymous : LIMITS.perDay;
  return (minute.count ?? 0) >= LIMITS.perMinute || (day.count ?? 0) >= dayLimit;
}

/**
 * The assistant turns a sentence into typed plan operations:
 * load the caller's plan → ask the model → validate → apply with @powerweek/core → save a
 * new version (with the input, operations and changes in the revision log) → return it.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) return fail("bad_request", 403);

  const body = BodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail("bad_request", 400);
  const { input, lang, today } = body.data;

  const db = await getServerSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return fail("unauthorized", 401);

  if (await overLimit(db, Boolean(user.is_anonymous))) return fail("rate_limited", 429);

  const startedAt = Date.now();
  let current: Awaited<ReturnType<typeof fetchPlan>>;
  try {
    current = await fetchPlan(db);
  } catch {
    return fail("server_error", 500);
  }

  let modelName: string | null = null;
  let parsed: ReturnType<typeof parseAssistantOutput>;
  try {
    const result = await completeJson(
      buildMessages(
        { lang, todayIso: today, todayKey: dayKeyOf(today), plan: current.plan },
        input,
      ),
    );
    modelName = result.model;
    parsed = parseAssistantOutput(result.content);
  } catch (error) {
    await logRequest(db, user.id, "model_error", modelName, startedAt);
    console.error("assistant: model error", error instanceof ModelError ? error.message : error);
    return fail("assistant_unavailable", 502);
  }

  if (!parsed) {
    await logRequest(db, user.id, "invalid_output", modelName, startedAt);
    return fail("assistant_invalid", 422);
  }

  const dict = getDictionary(lang);
  const apply = (operations: Operation[], plan = current.plan) =>
    applyOperations(plan, operations, { defaultWorkoutTitle: dict.app.defaultWorkoutTitle });

  let applied = apply(parsed.operations);
  if (applied.changes.length === 0) {
    await logRequest(db, user.id, "no_changes", modelName, startedAt);
    return NextResponse.json({
      status: "no_changes",
      plan: current.plan,
      version: current.version,
      changes: [],
      rejected: applied.rejected,
      reply: parsed.reply,
    });
  }

  const save = (expectedVersion: number) =>
    savePlan(db, {
      plan: applied.plan,
      expectedVersion,
      source: "assistant",
      input,
      operations: parsed.operations,
      changes: applied.changes,
    });

  let version: number;
  try {
    version = await save(current.version);
  } catch (error) {
    if (!(error instanceof PlanError && error.isConflict)) {
      await logRequest(db, user.id, "model_error", modelName, startedAt);
      return fail("server_error", 500);
    }
    // Another device saved in between: re-apply the same operations to the fresh plan once.
    try {
      current = await fetchPlan(db);
      applied = apply(parsed.operations, current.plan);
      version = await save(current.version);
    } catch {
      await logRequest(db, user.id, "conflict", modelName, startedAt);
      return fail("conflict", 409);
    }
  }

  await logRequest(db, user.id, "ok", modelName, startedAt);
  return NextResponse.json({
    status: "ok",
    plan: applied.plan,
    version,
    changes: applied.changes,
    rejected: applied.rejected,
    reply: parsed.reply,
  });
}
