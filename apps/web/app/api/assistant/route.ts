import { parseOutput, type Change, type Operation, type Rejection } from "@tukkteam/modules";
import { dayKeyOf, isDayKey, weekDates } from "@tukkteam/modules/week";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { completeJson, ModelError } from "@/lib/assistant/model";
import { buildMessages } from "@/lib/assistant/prompt";
import { locales } from "@/lib/i18n";
import {
  entryKey,
  fetchEntries,
  fetchPlan,
  PlanError,
  savePlan,
  writeEntry,
  type Db,
} from "@/lib/plan-api";
import { getServerSupabase } from "@/lib/supabase/server";
import { kernel } from "@/modules";

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
  | "outdated"
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
 * Store the dated facts the assistant noted for this week ("today I'll have the sushi"). Each
 * module resolves its own record operations; this only reads what is stored and writes the
 * result. Facts are not plan versions, so there is nothing to undo.
 */
async function storeRecords(
  db: Db,
  userId: string,
  doc: Parameters<typeof kernel.resolveRecords>[0],
  records: readonly Operation[],
  today: string,
  lang: (typeof locales)[number],
): Promise<{ changes: Change[]; rejected: Rejection[] }> {
  if (records.length === 0) return { changes: [], rejected: [] };
  const dates = weekDates(today);
  const stored = (await fetchEntries(db, dates.mon, dates.sun)) ?? new Map();
  const resolved = kernel.resolveRecords(doc, records, {
    lang,
    get: (module, day, key) =>
      isDayKey(day) ? stored.get(entryKey(dates[day], module, key)) : undefined,
  });
  const changes: Change[] = [];
  for (const [index, write] of resolved.writes.entries()) {
    if (!isDayKey(write.day)) continue;
    const saved = await writeEntry(db, {
      userId,
      isoDate: dates[write.day],
      module: write.module,
      key: write.key,
      value: write.value,
    });
    const change = resolved.changes[index];
    if (saved && change) changes.push(change);
  }
  return { changes, rejected: resolved.rejected };
}

/**
 * The assistant turns a sentence into typed operations: load the caller's plan → ask the model
 * → validate → apply through the modules → save a new version (with the input, operations and
 * changes in the revision log) → return it.
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
  let parsed: ReturnType<typeof parseOutput>;
  try {
    const result = await completeJson(
      buildMessages({ lang, todayIso: today, todayKey: dayKeyOf(today), doc: current.doc }, input),
    );
    modelName = result.model;
    parsed = parseOutput(kernel, result.content);
  } catch (error) {
    await logRequest(db, user.id, "model_error", modelName, startedAt);
    console.error("assistant: model error", error instanceof ModelError ? error.message : error);
    return fail("assistant_unavailable", 502);
  }

  if (!parsed) {
    await logRequest(db, user.id, "invalid_output", modelName, startedAt);
    return fail("assistant_invalid", 422);
  }
  const { operations, records, reply, dropped } = parsed;

  let applied = kernel.apply(current.doc, operations, { lang });
  if (applied.changes.length === 0) {
    const noted = await storeRecords(db, user.id, current.doc, records, today, lang);
    const done = noted.changes.length > 0;
    await logRequest(db, user.id, done ? "ok" : "no_changes", modelName, startedAt);
    return NextResponse.json({
      status: done ? "ok" : "no_changes",
      doc: current.doc,
      version: current.version,
      changes: noted.changes,
      rejected: [...applied.rejected, ...noted.rejected],
      dropped,
      reply,
      recorded: noted.changes.length,
      // Facts are not plan versions: there is nothing to undo.
      undoable: false,
    });
  }

  const save = (expectedVersion: number) =>
    savePlan(db, {
      doc: applied.doc,
      expectedVersion,
      source: "assistant",
      input,
      operations,
      changes: applied.changes,
    });

  let version: number;
  try {
    version = await save(current.version);
  } catch (error) {
    if (error instanceof PlanError && error.isOutdated) {
      await logRequest(db, user.id, "conflict", modelName, startedAt);
      return fail("outdated", 409);
    }
    if (!(error instanceof PlanError && error.isConflict)) {
      await logRequest(db, user.id, "model_error", modelName, startedAt);
      return fail("server_error", 500);
    }
    // Another device saved in between: re-apply the same operations to the fresh plan once.
    try {
      current = await fetchPlan(db);
      applied = kernel.apply(current.doc, operations, { lang });
      if (applied.changes.length === 0) throw new PlanError("Nothing left to apply");
      version = await save(current.version);
    } catch {
      await logRequest(db, user.id, "conflict", modelName, startedAt);
      return fail("conflict", 409);
    }
  }

  const noted = await storeRecords(db, user.id, applied.doc, records, today, lang);
  await logRequest(db, user.id, "ok", modelName, startedAt);
  return NextResponse.json({
    status: "ok",
    doc: applied.doc,
    version,
    changes: [...applied.changes, ...noted.changes],
    rejected: [...applied.rejected, ...noted.rejected],
    dropped,
    reply,
    recorded: noted.changes.length,
  });
}
