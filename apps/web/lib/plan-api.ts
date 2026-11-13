import { coercePlan, type Change, type Operation, type PlanDoc } from "@powerweek/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

export type Db = SupabaseClient<Database>;

/** Postgres SQLSTATE the RPCs raise when the plan changed since it was read. */
export const VERSION_CONFLICT = "40001";

export class PlanError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "PlanError";
  }
  get isConflict() {
    return this.code === VERSION_CONFLICT;
  }
}

const toJson = (value: unknown) => value as Json;

/** The caller's plan and its version (creates an empty one on first use). */
export async function fetchPlan(db: Db): Promise<{ plan: PlanDoc; version: number }> {
  const { data, error } = await db.rpc("my_plan");
  if (error) throw new PlanError(error.message, error.code);
  const row = data?.[0];
  if (!row) throw new PlanError("Plan not found");
  return { plan: coercePlan(row.doc), version: row.version };
}

/** Optimistic-concurrency save. Throws PlanError with code 40001 on a stale version. */
export async function savePlan(
  db: Db,
  args: {
    plan: PlanDoc;
    expectedVersion: number;
    source: "assistant" | "manual";
    input?: string;
    operations: readonly Operation[];
    changes: readonly Change[];
  },
): Promise<number> {
  const { data, error } = await db.rpc("save_plan", {
    p_doc: toJson(args.plan),
    p_expected_version: args.expectedVersion,
    p_source: args.source,
    p_input: args.input,
    p_operations: toJson(args.operations),
    p_changes: toJson(args.changes),
  });
  if (error) throw new PlanError(error.message, error.code);
  return data;
}

/** Reverts the change that produced `version`, if nothing changed since. Returns the new version. */
export async function undoPlan(db: Db, version: number): Promise<number> {
  const { data, error } = await db.rpc("undo_plan", { p_version: version });
  if (error) throw new PlanError(error.message, error.code);
  return data;
}
