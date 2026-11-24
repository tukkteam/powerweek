import { z } from "zod";

/** ISO weekday order: the week starts on Monday. */
export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export const DayKeySchema = z.enum(DAY_KEYS);

export function isDayKey(value: unknown): value is DayKey {
  return typeof value === "string" && (DAY_KEYS as readonly string[]).includes(value);
}

export function tomorrowOf(day: DayKey): DayKey {
  return DAY_KEYS[(DAY_KEYS.indexOf(day) + 1) % 7]!;
}

/** A value for every day of the week. */
export function eachDay<T>(make: (day: DayKey) => T): Record<DayKey, T> {
  const out = {} as Record<DayKey, T>;
  for (const day of DAY_KEYS) out[day] = make(day);
  return out;
}

/** A zod object with the same schema under every day key. */
export function dayRecord<T extends z.ZodType>(schema: T) {
  return z
    .object({
      mon: schema,
      tue: schema,
      wed: schema,
      thu: schema,
      fri: schema,
      sat: schema,
      sun: schema,
    })
    .strict();
}

/** Day names a model writes instead of a day key, in Spanish and English. */
const NAMES: Record<DayKey, string[]> = {
  mon: ["monday", "lunes", "lun", "l"],
  tue: ["tuesday", "martes", "mar"],
  wed: ["wednesday", "miercoles", "miércoles", "mie", "mié", "x"],
  thu: ["thursday", "jueves", "jue", "j"],
  fri: ["friday", "viernes", "vie", "v"],
  sat: ["saturday", "sabado", "sábado", "sab", "sáb", "s"],
  sun: ["sunday", "domingo", "dom", "d"],
};
const DAY_ALIASES: Record<string, DayKey> = {};
for (const key of DAY_KEYS) {
  DAY_ALIASES[key] = key;
  for (const name of NAMES[key]) DAY_ALIASES[name] = key;
}

/** "Lunes" → "mon". Anything that is not a day name comes back unchanged. */
export function normaliseDay(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return DAY_ALIASES[value.trim().toLowerCase()] ?? value;
}

/**
 * Field names that mean a day in every operation. A day name written in one of them ("Lunes",
 * "friday") becomes its day key; anything that is not a day name is left as it is. A module
 * should not use these names for something else.
 */
export const DAY_FIELDS = ["day", "from", "to", "days"] as const;

/**
 * Fix day names in the fields that mean a day (`DAY_FIELDS`). For `day.copy` only, a single
 * target in `to` becomes a list.
 */
export function normaliseDayFields(
  fields: Record<string, unknown>,
  op?: string,
): Record<string, unknown> {
  const out = { ...fields };
  for (const name of DAY_FIELDS) {
    if (!(name in out)) continue;
    const value = out[name];
    out[name] = Array.isArray(value) ? value.map(normaliseDay) : normaliseDay(value);
  }
  if (op === "day.copy" && typeof out.to === "string") out.to = [out.to];
  return out;
}
