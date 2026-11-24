import { z } from "zod";

/** Everything about the clock is in minutes since midnight (0..1440). */
export const MINUTES_PER_DAY = 1440;

/** 24h clock, zero padded: "07:30". */
export const TimeSchema = z
  .string()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "Expected HH:MM (24h)");

/** Accepts "8:00", "08:00", "8.00" and "8h" and normalises to "08:00". */
export const looseTime = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const m = /^\s*(\d{1,2})(?:[:.h](\d{2}))?\s*h?\s*$/i.exec(value);
  if (!m) return value;
  const hh = m[1]!.padStart(2, "0");
  const mm = m[2] ?? "00";
  return `${hh}:${mm}`;
}, TimeSchema);

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function fromMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(minutes)));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}
