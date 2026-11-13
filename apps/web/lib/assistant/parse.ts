import {
  DAY_KEYS,
  MAX_OPERATIONS,
  OperationSchema,
  type DayKey,
  type Operation,
} from "@powerweek/core";

export interface ParsedOutput {
  operations: Operation[];
  reply: string;
  /** Operations the model wrote that did not validate and were dropped. */
  dropped: number;
}

const DAY_ALIASES: Record<string, DayKey> = {};
const names: Record<DayKey, string[]> = {
  mon: ["monday", "lunes", "lun", "l"],
  tue: ["tuesday", "martes", "mar"],
  wed: ["wednesday", "miercoles", "miércoles", "mie", "mié", "x"],
  thu: ["thursday", "jueves", "jue", "j"],
  fri: ["friday", "viernes", "vie", "v"],
  sat: ["saturday", "sabado", "sábado", "sab", "sáb", "s"],
  sun: ["sunday", "domingo", "dom", "d"],
};
for (const key of DAY_KEYS) {
  DAY_ALIASES[key] = key;
  for (const name of names[key]) DAY_ALIASES[name] = key;
}

function normaliseDay(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return DAY_ALIASES[value.trim().toLowerCase()] ?? value;
}

/** Fix the harmless mistakes models make before strict validation: day names, op spelling. */
function normalise(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const op = { ...(raw as Record<string, unknown>) };
  if (typeof op.op === "string") op.op = op.op.trim().toLowerCase().replace("_", ".");
  if ("day" in op) op.day = normaliseDay(op.day);
  if ("from" in op) op.from = normaliseDay(op.from);
  if (Array.isArray(op.to)) op.to = op.to.map(normaliseDay);
  else if (typeof op.to === "string") op.to = [normaliseDay(op.to)];
  return op;
}

/** Pull the JSON object out of a model response (tolerates code fences and stray prose). */
export function extractJson(content: string): unknown {
  const text = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Validate the model output one operation at a time, so one malformed operation never
 * throws away the valid ones next to it. Returns null when there is no usable object.
 */
export function parseAssistantOutput(content: string): ParsedOutput | null {
  const data = extractJson(content);
  if (!data || typeof data !== "object") return null;
  const record = data as { operations?: unknown; reply?: unknown };
  const rawOps = Array.isArray(record.operations) ? record.operations.slice(0, MAX_OPERATIONS) : [];

  const operations: Operation[] = [];
  let dropped = 0;
  for (const raw of rawOps) {
    const parsed = OperationSchema.safeParse(normalise(raw));
    if (parsed.success) operations.push(parsed.data);
    else dropped += 1;
  }

  const reply = typeof record.reply === "string" ? record.reply.trim().slice(0, 400) : "";
  return { operations, reply, dropped };
}
