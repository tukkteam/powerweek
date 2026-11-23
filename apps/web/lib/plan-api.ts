import type { Change, Doc, Json, Operation } from "@tukkteam/modules";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json as DbJson } from "@/lib/supabase/database.types";
import { kernel } from "@/modules";

export type Db = SupabaseClient<Database>;

/** Postgres SQLSTATE the RPCs raise when the plan changed since it was read. */
export const VERSION_CONFLICT = "40001";
/** SQLSTATE save_plan raises when this app is older than the stored document. */
export const CLIENT_OUTDATED = "PW001";

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
  get isOutdated() {
    return this.code === CLIENT_OUTDATED;
  }
}

const toJson = (value: unknown) => value as DbJson;

/**
 * The caller's plan and its version (creates an empty one on first use). Plans from before
 * modules are upgraded on the way in; they are saved in the new shape with the next change.
 */
export async function fetchPlan(db: Db): Promise<{ doc: Doc; version: number }> {
  const { data, error } = await db.rpc("my_plan");
  if (error) throw new PlanError(error.message, error.code);
  const row = data?.[0];
  if (!row) throw new PlanError("Plan not found");
  return { doc: kernel.read(row.doc), version: row.version };
}

/** Optimistic-concurrency save. Throws PlanError with code 40001 on a stale version. */
export async function savePlan(
  db: Db,
  args: {
    doc: Doc;
    expectedVersion: number;
    source: "assistant" | "manual";
    input?: string;
    operations: readonly Operation[];
    changes: readonly Change[];
  },
): Promise<number> {
  const { data, error } = await db.rpc("save_plan", {
    p_doc: toJson(args.doc),
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

/**
 * Dated facts: what happened on a calendar date, per module (an item ticked off, a meal option
 * chosen, a count). They live outside the plan, so they have no versions and no undo.
 */
export type Entries = Map<string, Json>;

export const entryKey = (isoDate: string, module: string, key: string) =>
  `${isoDate}|${module}|${key}`;

/** Every fact between two dates, both included. */
export async function fetchEntries(db: Db, from: string, to: string): Promise<Entries | null> {
  const { data, error } = await db
    .from("entries")
    .select("on_date, module, key, value")
    .gte("on_date", from)
    .lte("on_date", to);
  if (error || !data) return null;
  return new Map(
    data.map((row) => [entryKey(row.on_date, row.module, row.key), row.value as Json]),
  );
}

/** Store a fact, or remove it when `value` is null. Resolves false when it could not be saved. */
export async function writeEntry(
  db: Db,
  entry: { userId: string; isoDate: string; module: string; key: string; value: Json | null },
): Promise<boolean> {
  const { error } =
    entry.value === null
      ? await db
          .from("entries")
          .delete()
          .eq("on_date", entry.isoDate)
          .eq("module", entry.module)
          .eq("key", entry.key)
      : await db.from("entries").upsert({
          user_id: entry.userId,
          on_date: entry.isoDate,
          module: entry.module,
          key: entry.key,
          value: entry.value as NonNullable<DbJson>,
        });
  return !error;
}
