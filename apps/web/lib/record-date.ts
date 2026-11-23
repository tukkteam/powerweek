import { addDays, DAY_KEYS, dayKeyOf, weekDates, type DayKey } from "@tukkteam/modules/week";

/**
 * The calendar date a dated fact means by a weekday.
 *
 * A fact about the week on screen ("I did Monday's run") belongs to that week. A fact that
 * looks ahead ("tomorrow I'll have the lentils") means the next time that day comes: on a
 * Sunday, "Monday" is tomorrow, not six days ago. Yesterday stays yesterday, so "last night I
 * had the pasta" said on a Monday is still about Sunday.
 */
export function recordDate(todayIso: string, day: DayKey, upcoming: boolean): string {
  const date = weekDates(todayIso)[day];
  if (!upcoming) return date;
  const ahead = DAY_KEYS.indexOf(day) - DAY_KEYS.indexOf(dayKeyOf(todayIso));
  if (ahead === 6) return addDays(date, -7);
  return ahead < -1 ? addDays(date, 7) : date;
}
