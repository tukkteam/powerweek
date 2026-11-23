import { z } from "zod";
import { MODULE_ID_PATTERN, type ModuleId } from "./module";

/**
 * The document: one JSON value per person, made of modules.
 *
 *     {
 *       "schemaVersion": 2,
 *       "layout": ["agenda", "habits"],          // modules on screen, in order
 *       "modules": {
 *         "agenda": { "v": 1, "data": { … } },   // each module's data and its version
 *         "fuel":   { "v": 1, "data": { … } }    // kept after it leaves the screen
 *       }
 *     }
 *
 * The kernel owns this envelope; what is inside each `data` belongs to its module.
 */
export const DOC_VERSION = 2;

/** At most this many modules on one screen. */
export const MAX_LAYOUT = 24;

export const ModuleIdSchema = z.string().regex(MODULE_ID_PATTERN, "Expected a module id");

export const ModuleEntrySchema = z
  .object({
    /** Version of the module's data shape when it was written. */
    v: z.number().int().min(1).max(9999),
    data: z.record(z.string(), z.unknown()),
  })
  .strict();

export const DocSchema = z
  .object({
    schemaVersion: z.literal(DOC_VERSION),
    layout: z.array(ModuleIdSchema).max(MAX_LAYOUT),
    modules: z.record(ModuleIdSchema, ModuleEntrySchema),
  })
  .strict();

export interface ModuleEntry {
  v: number;
  data: Record<string, unknown>;
}

export interface Doc {
  schemaVersion: typeof DOC_VERSION;
  layout: ModuleId[];
  modules: Record<ModuleId, ModuleEntry>;
}

export function emptyDoc(layout: readonly ModuleId[] = []): Doc {
  return { schemaVersion: DOC_VERSION, layout: [...layout], modules: {} };
}

/**
 * JSON Schema (draft 2020-12) of the envelope. A database can enforce it without knowing any
 * module: it bounds the shape, and the kernel guards what each module stores.
 */
export function docJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(DocSchema, { target: "draft-2020-12" }) as Record<string, unknown>;
}
