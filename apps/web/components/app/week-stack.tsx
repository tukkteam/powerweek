"use client";

import { DAY_KEYS, type DayKey, type DayLoad } from "@tukkteam/modules/week";
import { useLocale } from "@/components/i18n/locale-provider";
import { summaries, type Shown } from "@/modules/board";
import { toneStyle } from "@/modules/look";

/**
 * The Week Pulse split by colour: each day's bar stacks what every module on screen plans for
 * it, each in its own tone, as tall as the day is busy. Tapping a bar jumps to that day.
 */
export function WeekStack({
  shown,
  loads,
  todayKey,
  onSelect,
}: {
  shown: readonly Shown[];
  loads: Record<DayKey, DayLoad>;
  todayKey: DayKey;
  onSelect: (day: DayKey) => void;
}) {
  const { dict } = useLocale();
  const toneOf = new Map(shown.map((entry) => [entry.module.id, entry.module.tone]));

  return (
    <div
      role="group"
      aria-label={dict.week.stackLabel}
      className="grid w-full max-w-2xl grid-cols-7 items-end gap-2 sm:gap-4"
    >
      {DAY_KEYS.map((day) => {
        const { count, ratio, parts } = loads[day];
        const isToday = day === todayKey;
        const spoken = summaries(shown, day)
          .map((summary) => summary.text)
          .join(", ");
        return (
          <button
            key={day}
            type="button"
            onClick={() => onSelect(day)}
            aria-current={isToday ? "date" : undefined}
            aria-label={dict.week.stackDay(dict.days.long[day], spoken)}
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
                      key={part.module}
                      className="min-h-1.5 rounded-full bg-tone"
                      style={{
                        ...toneStyle(toneOf.get(part.module) ?? "volt"),
                        flexGrow: part.count,
                        flexBasis: 0,
                      }}
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
