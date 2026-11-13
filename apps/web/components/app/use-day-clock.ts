"use client";

import { DAY_KEYS, zonedMinutes, type DayKey } from "@powerweek/core";
import { useApp } from "@/components/app/app-provider";
import { useClock } from "@/lib/clock";

/** Where a day of the current week stands: already lived, today, or still ahead. */
export type DayRelation = "past" | "today" | "future";

export function relationOf(day: DayKey, today: DayKey): DayRelation {
  const delta = DAY_KEYS.indexOf(day) - DAY_KEYS.indexOf(today);
  return delta < 0 ? "past" : delta > 0 ? "future" : "today";
}

/** The current minute of the day in the user's time zone; null before the clock starts. */
export function useNowMinutes(): number | null {
  const { profile } = useApp();
  const ms = useClock();
  return ms === null ? null : zonedMinutes(profile.timeZone, new Date(ms));
}

/** A day's relation to today and, when it is today, the current minute. */
export function useDayClock(day: DayKey): { relation: DayRelation; now: number | null } {
  const { today } = useApp();
  const minutes = useNowMinutes();
  const relation = relationOf(day, today.dayKey);
  return { relation, now: relation === "today" ? minutes : null };
}
