import { addDays, dayKeyOf, weekDates, type DayKey } from "@tukkteam/modules/week";

/**
 * The calendar date a dated fact means by a weekday.
 *
 * It is the date of that day in the week on screen, the same one a tap on that day writes, so
 * what is said and what is seen never disagree. A day name alone does not say which week is
 * meant, and there are two sentences where the week on screen is plainly the wrong one:
 *
 * - "Tomorrow I'll have the lentils", said on a Sunday: a fact that looks ahead and names the
 *   day after today is about the Monday that comes, not the one six days ago.
 * - "Yesterday I meditated", said on a Monday: a fact that looks back and names the day before
 *   today is about the Sunday just gone, not the one six days ahead.
 *
 * Anything further from today stays in the week on screen. Planning next week before it has
 * started needs the app to show that week first.
 */
export function recordDate(todayIso: string, day: DayKey, upcoming: boolean): string {
  const date = weekDates(todayIso)[day];
  const today = dayKeyOf(todayIso);
  if (upcoming && today === "sun" && day === "mon") return addDays(date, 7);
  if (!upcoming && today === "mon" && day === "sun") return addDays(date, -7);
  return date;
}
