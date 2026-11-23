import { z } from "zod";

/**
 * Building blocks for operation fields. A language model writes operations, so fields forgive
 * shape (nulls, blanks, "4" for a number) and stay strict about meaning (lengths, ranges).
 */

const blankToUndefined = (value: unknown) =>
  value === null || (typeof value === "string" && value.trim() === "") ? undefined : value;

/** The id of an existing item. */
export const itemId = z.string().min(1).max(64);

/** Required text, trimmed, 1..max characters. */
export const text = (max: number) => z.string().trim().min(1).max(max);

/** Text that may be absent or empty in stored data. */
export const optionalText = (max: number) => z.string().trim().max(max).optional();

/** Optional when creating: null and "" mean "not given". */
export const opt = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blankToUndefined, schema.optional());

/** When updating: leaving it out keeps the value, null clears it. */
export const clearable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

/** A whole number that may arrive as "4". */
export const looseInt = (min: number, max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value),
    z.number().int().min(min).max(max),
  );

/** A number that may arrive as "1.5" or "1,5". */
export const looseNumber = (min: number, max: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const parsed = Number(value.trim().replace(",", "."));
    return value.trim() !== "" && Number.isFinite(parsed) ? parsed : value;
  }, z.number().min(min).max(max));

/** Removes keys whose value is undefined or null, in place, so stored items stay small. */
export function compact<T extends object>(value: T): T {
  for (const key of Object.keys(value) as (keyof T)[]) {
    if (value[key] === undefined || value[key] === null) delete value[key];
  }
  return value;
}

/** True when two titles are the same ignoring case and accents. */
export const sameText = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;
