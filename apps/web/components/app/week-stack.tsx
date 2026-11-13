"use client";

import { DAY_KEYS, weekLoads, type DayKey, type PlanDoc } from "@powerweek/core";
import { useLocale } from "@/components/i18n/locale-provider";

/**
 * The Week Pulse split by colour: each day's bar stacks its agenda (blue), training (volt) and
 * meals (orange), as tall as the day is busy. Tapping a bar jumps to that day.
 */
export function WeekStack({
  plan,
  todayKey,
  onSelect,
}: {
  plan: PlanDoc;
  todayKey: DayKey;
  onSelect: (day: DayKey) => void;
}) {
  const { dict } = useLocale();
  const loads = weekLoads(plan);

  return (
    <div
      role="group"
      aria-label={dict.week.stackLabel}
      className="grid w-full max-w-2xl grid-cols-7 items-end gap-2 sm:gap-4"
    >
      {DAY_KEYS.map((day) => {
        const d = plan.days[day];
        const parts = [
          { key: "agenda", count: d.agenda.length, className: "bg-agenda" },
          {
            key: "train",
            count: d.workout ? Math.max(1, d.workout.exercises.length) : 0,
            className: "bg-train",
          },
          { key: "fuel", count: d.meals.length, className: "bg-fuel" },
        ].filter((part) => part.count > 0);
        const { count, ratio } = loads[day];
        const isToday = day === todayKey;
        return (
          <button
            key={day}
            type="button"
            onClick={() => onSelect(day)}
            aria-current={isToday ? "date" : undefined}
            aria-label={dict.week.stackDay(
              dict.days.long[day],
              d.agenda.length,
              d.workout?.exercises.length ?? 0,
              d.meals.length,
            )}
            className="group flex flex-col items-center gap-2 rounded-xl pt-1 pb-0.5"
          >
            <span className="flex h-28 w-full items-end justify-center">
              <span
                className="pw-bar flex w-full max-w-8 flex-col-reverse gap-[3px] transition-[filter] group-hover:brightness-110"
                style={{ height: `${count === 0 ? 8 : Math.max(28, Math.round(ratio * 112))}px` }}
              >
                {parts.length ? (
                  parts.map((part) => (
                    <span
                      key={part.key}
                      className={`min-h-1.5 rounded-full ${part.className}`}
                      style={{ flexGrow: part.count, flexBasis: 0 }}
                    />
                  ))
                ) : (
                  <span className="h-full rounded-full bg-line-strong" />
                )}
              </span>
            </span>
            <span
              className={`type-label ${isToday ? "text-volt-ink underline decoration-2 underline-offset-4" : "text-ink-muted"}`}
            >
              {dict.days.initial[day]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
