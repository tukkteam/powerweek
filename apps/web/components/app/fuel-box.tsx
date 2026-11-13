"use client";

import {
  currentMealSlot,
  fromMinutes,
  MEAL_SLOTS,
  MEAL_TIMES,
  type Day,
  type Meal,
  type MealSlot,
} from "@powerweek/core";
import { Utensils } from "lucide-react";
import { SectionCard } from "@/components/app/section-card";
import type { DayRelation } from "@/components/app/use-day-clock";
import { useLocale } from "@/components/i18n/locale-provider";

/** Meals as a fuel gauge: four slots that fill orange as you plan them, with the next one marked. */
export function FuelBox({
  day,
  relation,
  now,
  onEdit,
  onAdd,
  className,
}: {
  day: Day;
  relation: DayRelation;
  now: number | null;
  onEdit: (meal: Meal) => void;
  onAdd: (slot?: MealSlot) => void;
  className?: string;
}) {
  const { lang, dict } = useLocale();
  const times = MEAL_TIMES[lang];
  const current = relation === "today" && now !== null ? currentMealSlot(now, times) : null;
  const planned = MEAL_SLOTS.filter((slot) => day.meals.some((m) => m.slot === slot)).length;

  return (
    <SectionCard
      tone="fuel"
      icon={Utensils}
      title={dict.categories.fuel}
      meta={dict.fuel.planned(planned, MEAL_SLOTS.length)}
      addLabel={dict.app.addTo(dict.categories.fuel)}
      onAdd={() => onAdd()}
      className={className}
    >
      <ol className="grid grid-cols-4 gap-1.5">
        {MEAL_SLOTS.map((slot) => {
          const meals = day.meals.filter((m) => m.slot === slot);
          const isNow = slot === current;
          return (
            <li key={slot}>
              <button
                type="button"
                onClick={() => (meals[0] ? onEdit(meals[0]) : onAdd(slot))}
                aria-label={
                  meals.length
                    ? `${dict.slots[slot]}: ${meals.map((m) => m.title).join(", ")}`
                    : dict.fuel.addSlot(dict.slots[slot])
                }
                className="group flex w-full flex-col gap-2 rounded-[10px] px-0.5 py-1.5 text-left transition-colors hover:bg-surface-raised sm:px-1.5"
              >
                <span className="type-label h-3 text-fuel" aria-hidden="true">
                  {isNow ? dict.fuel.now : ""}
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-3 gap-[3px] rounded-full ${
                    meals.length ? "" : "border border-dashed border-fuel/60 bg-fuel/10"
                  } ${isNow ? "ring-2 ring-fuel/40 ring-offset-2 ring-offset-surface" : ""}`}
                >
                  {meals.map((meal) => (
                    <span key={meal.id} className="h-full flex-1 rounded-full bg-fuel" />
                  ))}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span
                    className={`type-label truncate max-sm:tracking-[0.04em] ${isNow ? "text-fuel" : "text-ink-muted"}`}
                  >
                    {dict.slots[slot]}
                  </span>
                  <span className="type-numeric text-[0.6875rem] text-ink-muted">
                    {fromMinutes(times[slot])}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {day.meals.length === 0 ? (
        <p className="type-body pt-3 text-ink-muted">{dict.app.empty.fuel}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {day.meals.map((meal) => (
            <li key={meal.id}>
              <button
                type="button"
                onClick={() => onEdit(meal)}
                aria-label={dict.app.editItem(meal.title)}
                className="grid w-full grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3 py-3 text-left"
              >
                <span className="type-label text-fuel">{dict.slots[meal.slot]}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="type-body">{meal.title}</span>
                  {meal.note ? (
                    <span className="type-caption text-ink-muted">{meal.note}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
