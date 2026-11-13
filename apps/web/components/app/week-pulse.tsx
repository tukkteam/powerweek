"use client";

import { DAY_KEYS, weekLoads, type DayKey, type PlanDoc } from "@powerweek/core";
import { useLocale } from "@/components/i18n/locale-provider";

interface WeekPulseProps {
  plan: PlanDoc;
  todayKey: DayKey;
  selected: DayKey;
  onSelect: (day: DayKey) => void;
  /** While the Voice Dock listens, the bars pulse instead of showing loads. */
  listening?: boolean;
}

/**
 * The signature element: seven pill bars, Monday first, as tall as each day is busy.
 * Today's bar is volt (volt-ink in the Day theme, where volt is too light to read); the selected
 * day's initial turns volt-ink.
 */
export function WeekPulse({
  plan,
  todayKey,
  selected,
  onSelect,
  listening = false,
}: WeekPulseProps) {
  const { dict } = useLocale();
  const loads = weekLoads(plan);

  return (
    <div
      role="group"
      aria-label={dict.app.pulseLabel}
      className="grid max-w-xl grid-cols-7 items-end gap-2"
    >
      {DAY_KEYS.map((day, index) => {
        const { count, ratio } = loads[day];
        const isToday = day === todayKey;
        const isSelected = day === selected;
        return (
          <button
            key={day}
            type="button"
            onClick={() => onSelect(day)}
            aria-pressed={isSelected}
            aria-current={isToday ? "date" : undefined}
            aria-label={dict.app.pulseDay(dict.days.long[day], count, isToday)}
            className="group flex flex-col items-center gap-2 rounded-xl pt-1 pb-0.5"
          >
            <span className="flex h-24 w-full items-end justify-center">
              <span
                className={`pw-bar block w-full max-w-7 rounded-full ${isToday ? "bg-volt-ink" : "bg-line-strong group-hover:bg-ink-muted"} ${
                  listening ? "pw-listen-bar" : ""
                }`}
                style={{
                  height: listening
                    ? "100%"
                    : `${count === 0 ? 8 : Math.max(28, Math.round(ratio * 96))}px`,
                  animationDelay: listening ? `${index * 110}ms` : undefined,
                }}
              />
            </span>
            <span
              className={`type-label ${isSelected ? "text-volt-ink" : isToday ? "text-ink" : "text-ink-muted"} ${
                isSelected ? "underline decoration-2 underline-offset-4" : ""
              }`}
            >
              {dict.days.initial[day]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
