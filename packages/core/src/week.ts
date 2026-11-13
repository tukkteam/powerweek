import { DAY_KEYS, type DayKey } from "./plan";

const WEEKDAY: Record<string, DayKey> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

const pad = (n: number) => String(n).padStart(2, "0");

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date and weekday of an instant, as seen in `timeZone`. */
export function zonedToday(
  timeZone: string,
  now: Date = new Date(),
): { dayKey: DayKey; isoDate: string } {
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    dayKey: WEEKDAY[parts.weekday ?? "Mon"] ?? "mon",
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

function parseIso(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

function toIso(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Monday-first index (0..6) of an ISO date. */
export function dayIndex(isoDate: string): number {
  return (parseIso(isoDate).getUTCDay() + 6) % 7;
}

export function dayKeyOf(isoDate: string): DayKey {
  return DAY_KEYS[dayIndex(isoDate)]!;
}

export function addDays(isoDate: string, days: number): string {
  const date = parseIso(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

/** The seven dates (Monday to Sunday) of the week that contains `isoDate`. */
export function weekDates(isoDate: string): Record<DayKey, string> {
  const monday = addDays(isoDate, -dayIndex(isoDate));
  const out = {} as Record<DayKey, string>;
  DAY_KEYS.forEach((key, i) => {
    out[key] = addDays(monday, i);
  });
  return out;
}

/** ISO-8601 week number (weeks start on Monday; week 1 contains the first Thursday). */
export function isoWeek(isoDate: string): number {
  const date = parseIso(isoDate);
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 3 - dayIndex(isoDate));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
