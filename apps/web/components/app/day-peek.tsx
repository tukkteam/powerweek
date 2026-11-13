"use client";

import {
  DEFAULT_WINDOW,
  MEAL_SLOTS,
  muscleLoad,
  position,
  resolveMove,
  toMinutes,
  topMuscles,
  type AgendaItem,
  type Category,
  type Day,
} from "@powerweek/core";
import { MoveArt } from "@/components/app/move-art";
import { MuscleMap } from "@/components/app/muscle-map";
import { muscleList, SetsLine, workoutMeta } from "@/components/app/train-box";
import { useLocale } from "@/components/i18n/locale-provider";
import { TONE } from "@/lib/tone";

/** Where an agenda item sits on a fixed 06:00–24:00 day, for mini timelines. */
export function agendaBar(item: AgendaItem): { left: number; width: number } | null {
  if (!item.time) return null;
  const start = toMinutes(item.time);
  const endRaw = item.endTime ? toMinutes(item.endTime) : start + 30;
  const end = endRaw > start ? endRaw : DEFAULT_WINDOW.end;
  const left = position(start, DEFAULT_WINDOW);
  return { left, width: Math.max(0.015, position(end, DEFAULT_WINDOW) - left) };
}

/** Everything one category holds on one day; shown on hover (desktop) or long press (touch). */
export function DayPeek({ day, category, title }: { day: Day; category: Category; title: string }) {
  const { lang, dict } = useLocale();
  const t = TONE[category];

  return (
    <div className="flex flex-col gap-3">
      <p className={`type-label ${t.text}`}>
        {dict.categories[category]} · {title}
      </p>

      {category === "agenda" ? (
        <ol className="flex flex-col gap-3">
          {day.agenda.map((item) => {
            const bar = agendaBar(item);
            return (
              <li key={item.id} className="flex flex-col gap-1.5">
                <span className="flex items-baseline gap-3">
                  <span className="type-numeric w-[5.75rem] shrink-0 text-ink-muted">
                    {item.time
                      ? item.endTime
                        ? `${item.time}–${item.endTime}`
                        : item.time
                      : dict.agenda.untimed}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.9375rem] leading-snug font-semibold">
                      {item.title}
                    </span>
                    {item.note ? (
                      <span className="type-caption text-ink-muted">{item.note}</span>
                    ) : null}
                  </span>
                </span>
                {bar ? (
                  <span className="relative block h-1.5 rounded-full bg-agenda/15">
                    <span
                      className="absolute inset-y-0 rounded-full bg-agenda"
                      style={{ left: `${bar.left * 100}%`, width: `${bar.width * 100}%` }}
                    />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      {category === "train" && day.workout ? (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="type-title text-[1.25rem]">{day.workout.title}</p>
              <p className="type-caption text-ink-muted">
                {[day.workout.time, workoutMeta(day, dict)].filter(Boolean).join(" · ")}
              </p>
            </div>
            <MuscleMap
              load={muscleLoad(day.workout.exercises)}
              label={dict.train.musclesLabel(
                muscleList(
                  topMuscles(muscleLoad(day.workout.exercises)).map((g) => dict.muscles[g]),
                  lang,
                ),
              )}
              className="h-24 shrink-0"
            />
          </div>
          <ol className="flex flex-col gap-1.5">
            {day.workout.exercises.map((exercise) => (
              <li key={exercise.id} className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-train/10 text-train">
                  <MoveArt slug={resolveMove(exercise)?.slug} className="size-10" />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-[0.875rem] font-semibold">{exercise.name}</span>
                  <SetsLine exercise={exercise} />
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {category === "fuel" ? (
        <>
          <span className="grid grid-cols-4 gap-1" aria-hidden="true">
            {MEAL_SLOTS.map((slot) => (
              <span
                key={slot}
                className={`h-1.5 rounded-full ${day.meals.some((m) => m.slot === slot) ? "bg-fuel" : "bg-fuel/15"}`}
              />
            ))}
          </span>
          <ul className="flex flex-col gap-2.5">
            {day.meals.map((meal) => (
              <li
                key={meal.id}
                className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3"
              >
                <span className="type-label text-fuel">{dict.slots[meal.slot]}</span>
                <span className="min-w-0">
                  <span className="block text-[0.9375rem] leading-snug">{meal.title}</span>
                  {meal.note ? (
                    <span className="type-caption text-ink-muted">{meal.note}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
