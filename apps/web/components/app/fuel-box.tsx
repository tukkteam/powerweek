"use client";

import {
  currentMealSlot,
  fromMinutes,
  MEAL_SLOTS,
  MEAL_TIMES,
  mealSlots,
  type DayKey,
  type Meal,
  type MealOption,
  type MealSlot,
  type PlanDoc,
} from "@powerweek/core";
import { Check, Utensils } from "lucide-react";
import { useApp } from "@/components/app/app-provider";
import { SectionCard } from "@/components/app/section-card";
import type { DayRelation } from "@/components/app/use-day-clock";
import { useLocale } from "@/components/i18n/locale-provider";

export interface MenuTarget {
  slot: MealSlot;
  scope: "day" | "week";
  options: MealOption[];
}

/**
 * Meals as a fuel gauge: four slots that fill orange as you plan them. A slot can hold one dish
 * or a range of options ("abanico"): you pick one each day with a tap, and the gauge fills.
 */
export function FuelBox({
  plan,
  dayKey,
  relation,
  now,
  onEdit,
  onAdd,
  onEditOptions,
  className,
}: {
  plan: PlanDoc;
  dayKey: DayKey;
  relation: DayRelation;
  now: number | null;
  onEdit: (meal: Meal) => void;
  onAdd: (slot?: MealSlot) => void;
  onEditOptions: (target: MenuTarget) => void;
  className?: string;
}) {
  const { pickOf, pick } = useApp();
  const { lang, dict } = useLocale();
  const times = MEAL_TIMES[lang];
  const current = relation === "today" && now !== null ? currentMealSlot(now, times) : null;
  const slots = mealSlots(plan, dayKey);
  const planned = MEAL_SLOTS.filter((slot) => {
    const s = slots[slot];
    return s.kind === "fixed" || (s.kind === "options" && pickOf(dayKey, slot));
  }).length;
  const anything = MEAL_SLOTS.some((slot) => slots[slot].kind !== "empty");

  return (
    <SectionCard
      id="fuel"
      tone="fuel"
      icon={Utensils}
      title={dict.categories.fuel}
      meta={dict.fuel.planned(planned, MEAL_SLOTS.length)}
      addLabel={dict.app.addTo(dict.categories.fuel)}
      onAdd={() => onAdd()}
      className={`scroll-mt-24 ${className ?? ""}`}
    >
      <ol className="grid grid-cols-4 gap-1.5">
        {MEAL_SLOTS.map((slot) => {
          const s = slots[slot];
          const isNow = slot === current;
          const chosen = s.kind === "options" ? pickOf(dayKey, slot) : null;
          return (
            <li key={slot}>
              <button
                type="button"
                onClick={() =>
                  s.kind === "fixed"
                    ? onEdit(s.meals[0]!)
                    : s.kind === "options"
                      ? onEditOptions({ slot, scope: s.scope, options: s.options })
                      : onAdd(slot)
                }
                aria-label={
                  s.kind === "fixed"
                    ? `${dict.slots[slot]}: ${s.meals.map((m) => m.title).join(", ")}`
                    : s.kind === "options"
                      ? `${dict.slots[slot]}: ${dict.fuel.options(s.options.length)}`
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
                    s.kind === "empty" ? "border border-dashed border-fuel/60 bg-fuel/10" : ""
                  } ${isNow ? "ring-2 ring-fuel/40 ring-offset-2 ring-offset-surface" : ""}`}
                >
                  {s.kind === "fixed"
                    ? s.meals.map((meal) => (
                        <span key={meal.id} className="h-full flex-1 rounded-full bg-fuel" />
                      ))
                    : s.kind === "options"
                      ? chosen
                        ? [<span key="chosen" className="h-full flex-1 rounded-full bg-fuel" />]
                        : s.options.map((option) => (
                            <span
                              key={option.id}
                              className="h-full flex-1 rounded-full bg-fuel/35"
                            />
                          ))
                      : null}
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

      {!anything ? (
        <p className="type-body pt-3 text-ink-muted">{dict.app.empty.fuel}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {MEAL_SLOTS.map((slot) => {
            const s = slots[slot];
            if (s.kind === "fixed")
              return s.meals.map((meal) => (
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
              ));
            if (s.kind !== "options") return null;
            const chosen = pickOf(dayKey, slot);
            return (
              <li key={slot} className="flex flex-col gap-2.5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="type-label text-fuel">
                    {dict.slots[slot]}
                    <span className="text-ink-muted">
                      {" · "}
                      {s.scope === "week" ? dict.fuel.scopeWeek : dict.fuel.scopeDay}
                      {chosen ? "" : ` · ${dict.fuel.choose}`}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onEditOptions({ slot, scope: s.scope, options: s.options })}
                    className="type-label shrink-0 text-ink-muted hover:text-ink"
                  >
                    {dict.fuel.editOptions}
                  </button>
                </div>
                <div
                  role="radiogroup"
                  aria-label={dict.slots[slot]}
                  className="flex flex-wrap gap-1.5"
                >
                  {s.options.map((option) => {
                    const on = chosen === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={
                          on
                            ? dict.fuel.unpickLabel(option.title)
                            : dict.fuel.pickLabel(option.title)
                        }
                        title={option.note}
                        onClick={() => pick(dayKey, slot, on ? null : option.id)}
                        className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[0.875rem] transition-[background-color,border-color,color,opacity] duration-200 ${
                          on
                            ? "border-fuel bg-fuel font-semibold text-bg"
                            : chosen
                              ? "border-line text-ink-muted hover:border-fuel/60 hover:text-ink"
                              : "border-fuel/45 hover:bg-fuel/10"
                        }`}
                      >
                        {on ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
                        {option.title}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
