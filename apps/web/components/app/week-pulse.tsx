"use client";

import { DAY_KEYS, weekLoads, type DayKey, type PlanDoc } from "@powerweek/core";
import type { CSSProperties } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { dayOfMonth } from "@/lib/format";

interface WeekPulseProps {
  plan: PlanDoc;
  todayKey: DayKey;
  selected: DayKey;
  onSelect: (day: DayKey) => void;
  /** Dates of the current week, shown next to each day in the vertical layout. */
  dates: Record<DayKey, string>;
  /** While the Voice Dock listens, the bars pulse instead of showing loads. */
  listening?: boolean;
  className?: string;
}

/**
 * The signature element: seven pill bars, Monday first, as long as each day is busy.
 *
 * Phones and tablets show them standing in a row above the day. From `lg` up they lie down in
 * a column of rows (day, bar, count) next to the Day Bar and stretch with it, so the region
 * stays balanced however tall the day grows. One set of elements, oriented by CSS: each bar
 * carries both sizes as custom properties and the breakpoint picks one.
 *
 * Today's bar is volt (volt-ink in the Day theme, where volt is too light to read); the selected
 * day's label turns volt-ink.
 */
export function WeekPulse({
  plan,
  todayKey,
  selected,
  onSelect,
  dates,
  listening = false,
  className = "",
}: WeekPulseProps) {
  const { dict } = useLocale();
  const loads = weekLoads(plan);

  return (
    <div
      role="group"
      aria-label={dict.app.pulseLabel}
      className={`grid max-w-xl grid-cols-7 items-end gap-2 lg:flex lg:max-w-none lg:flex-col lg:items-stretch lg:gap-1 ${className}`}
    >
      {DAY_KEYS.map((day, index) => {
        const { count, ratio } = loads[day];
        const isToday = day === todayKey;
        const isSelected = day === selected;
        const size = {
          "--bar-h": listening
            ? "100%"
            : `${count === 0 ? 8 : Math.max(28, Math.round(ratio * 96))}px`,
          "--bar-w": listening
            ? "100%"
            : count === 0
              ? "8px"
              : `max(1.25rem, ${(ratio * 100).toFixed(2)}%)`,
          animationDelay: listening ? `${index * 110}ms` : undefined,
        } as CSSProperties;
        return (
          <button
            key={day}
            type="button"
            onClick={() => onSelect(day)}
            aria-pressed={isSelected}
            aria-current={isToday ? "date" : undefined}
            aria-label={dict.app.pulseDay(dict.days.long[day], count, isToday)}
            className={`group flex flex-col items-center gap-2 rounded-xl pt-1 pb-0.5 lg:min-h-10 lg:flex-1 lg:flex-row lg:gap-3 lg:rounded-[10px] lg:px-2.5 lg:py-0 lg:transition-colors lg:hover:bg-surface-raised ${
              isSelected ? "lg:bg-surface-raised" : ""
            }`}
          >
            <span className="flex h-24 w-full items-end justify-center lg:h-3.5 lg:flex-1 lg:items-center lg:justify-start">
              <span
                className={`pw-bar block h-(--bar-h) w-full max-w-7 rounded-full lg:h-full lg:w-(--bar-w) lg:max-w-none ${
                  isToday ? "bg-volt-ink" : "bg-line-strong group-hover:bg-ink-muted"
                } ${listening ? "pw-listen-bar" : ""}`}
                style={size}
              />
            </span>
            <span
              className={`type-label lg:order-first lg:w-[4.25rem] lg:shrink-0 lg:text-left ${
                isSelected ? "text-volt-ink" : isToday ? "text-ink" : "text-ink-muted"
              } ${isSelected ? "underline decoration-2 underline-offset-4 lg:no-underline" : ""}`}
            >
              <span className="lg:hidden">{dict.days.initial[day]}</span>
              <span className="hidden lg:inline">
                {dict.days.short[day]} {dayOfMonth(dates[day])}
              </span>
            </span>
            <span className="type-numeric hidden w-5 shrink-0 text-right text-ink-muted lg:inline">
              {count || ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
