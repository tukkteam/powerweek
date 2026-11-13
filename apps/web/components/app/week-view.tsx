"use client";

import {
  DAY_KEYS,
  dayLoad,
  formatPrescription,
  isoWeek,
  weekLoads,
  type DayKey,
} from "@powerweek/core";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/app/app-provider";
import { useLocale } from "@/components/i18n/locale-provider";
import { dateRange, dayOfMonth } from "@/lib/format";

/** The whole week at a glance: one card per day, tap a card to open that day. */
export function WeekView() {
  const { plan, today, dates, selectDay, isDone } = useApp();
  const { lang, dict } = useLocale();
  const router = useRouter();
  const loads = weekLoads(plan);
  const total = DAY_KEYS.reduce((sum, day) => sum + dayLoad(plan.days[day]), 0);

  const open = (day: DayKey) => {
    selectDay(day);
    router.push(`/${lang}/app`);
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="type-label text-ink-muted">
            {dict.app.weekEyebrow(isoWeek(today.isoDate), dateRange(dates.mon, dates.sun, lang))}
          </p>
          <h1 className="type-display">{dict.app.weekTitle}</h1>
        </div>
        <p className="type-body text-ink-muted">{dict.app.weekSummary(total)}</p>
      </section>

      <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,190px),1fr))] xl:grid-cols-7">
        {DAY_KEYS.map((day) => {
          const d = plan.days[day];
          const isToday = day === today.dayKey;
          const empty = dayLoad(d) === 0;
          return (
            <li key={day}>
              <button
                type="button"
                onClick={() => open(day)}
                aria-current={isToday ? "date" : undefined}
                className={`flex h-full w-full flex-col gap-3.5 rounded-[14px] border p-4 text-left transition-colors hover:border-line-strong ${
                  isToday
                    ? "border-volt-ink bg-surface-raised"
                    : empty
                      ? "border-dashed border-line bg-surface"
                      : "border-line bg-surface"
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={`font-display stretch-wide text-lg font-black uppercase xl:text-base ${isToday ? "text-volt-ink" : ""}`}
                  >
                    {dict.days.long[day]}
                  </span>
                  <span className={`type-numeric ${isToday ? "text-volt-ink" : "text-ink-muted"}`}>
                    {dayOfMonth(dates[day])}
                  </span>
                </span>
                <span aria-hidden="true" className="block h-1.5 rounded-full bg-line">
                  <span
                    className={`pw-bar block h-1.5 rounded-full ${isToday ? "bg-volt-ink" : "bg-line-strong"}`}
                    style={{ width: `${Math.round(loads[day].ratio * 100)}%` }}
                  />
                </span>

                {empty ? (
                  <span className="type-body text-ink-muted">{dict.app.weekEmptyDay}</span>
                ) : null}

                {d.agenda.length ? (
                  <span className="flex flex-col gap-1.5">
                    <span className="type-label text-agenda">{dict.categories.agenda}</span>
                    {d.agenda.map((item) => (
                      <span
                        key={item.id}
                        className={`text-sm leading-snug ${isDone(item.id, day) ? "text-ink-muted line-through" : ""}`}
                      >
                        {item.time ? (
                          <span className="type-numeric mr-2 text-ink-muted">{item.time}</span>
                        ) : null}
                        {item.title}
                      </span>
                    ))}
                  </span>
                ) : null}

                {d.workout ? (
                  <span className="flex flex-col gap-1.5">
                    <span className="type-label text-train">{dict.categories.train}</span>
                    <span className="text-sm leading-snug font-bold">{d.workout.title}</span>
                    {d.workout.exercises.length ? (
                      <span className="type-caption text-ink-muted">
                        {d.workout.exercises
                          .map((ex) => [ex.name, formatPrescription(ex)].filter(Boolean).join(" "))
                          .join(" · ")}
                      </span>
                    ) : null}
                  </span>
                ) : null}

                {d.meals.length ? (
                  <span className="flex flex-col gap-1.5">
                    <span className="type-label text-fuel">{dict.categories.fuel}</span>
                    {d.meals.map((meal) => (
                      <span key={meal.id} className="text-sm leading-snug">
                        {meal.title}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
