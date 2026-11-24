"use client";

import { fromMinutes, type DayKey } from "@tukkteam/modules/week";
import { Check } from "lucide-react";
import { useState } from "react";
import { EditorDialog, Field, fieldClass } from "@/components/app/editor-dialog";
import { CellHeader, ModuleCard } from "@/components/app/module-card";
import { useTapped } from "@/components/app/use-tapped";
import { useLocale } from "@/components/i18n/locale-provider";
import type { CardProps, ModuleRecords, ModuleViews, ViewProps } from "../host";
import type { FuelMessages } from "./messages";
import {
  currentMealSlot,
  FUEL_LIMITS,
  fuel,
  MEAL_SLOTS,
  mealSlots,
  mealTimes,
  pickKey,
  type Fuel,
  type Meal,
  type MealOption,
  type MealSlot,
} from "./module";

type Editing =
  | { kind: "meal"; item?: Meal; slot?: MealSlot }
  | {
      kind: "menu";
      slot: MealSlot;
      scope: "day" | "week";
      options: MealOption[];
      /** Days the week options apply to, kept when they are edited. */
      days?: DayKey[];
    }
  | null;

/** The id of the option chosen for a slot on a day, if any. */
const pickOf = (records: ModuleRecords, day: DayKey, slot: MealSlot): string | null => {
  const value = records.get(day, pickKey(slot));
  return typeof value === "string" ? value : null;
};

/**
 * Meals as a fuel gauge: four slots that fill as you plan them. A slot can hold one dish or a
 * range of options ("abanico"): you pick one each day with a tap, and the gauge fills.
 */
function FuelCard({
  data,
  t,
  lang,
  day,
  relation,
  now,
  records,
  dispatch,
  focus,
}: CardProps<Fuel, FuelMessages>) {
  const { dict } = useLocale();
  const [editing, setEditing] = useState<Editing>(null);
  const times = mealTimes(lang);
  const current = relation === "today" && now !== null ? currentMealSlot(now, times) : null;
  const slots = mealSlots(data, day);
  const planned = MEAL_SLOTS.filter((slot) => {
    const s = slots[slot];
    return s.kind === "fixed" || (s.kind === "options" && pickOf(records, day, slot));
  }).length;
  const anything = MEAL_SLOTS.some((slot) => slots[slot].kind !== "empty");

  const editOptions = (slot: MealSlot, scope: "day" | "week", options: MealOption[]) =>
    setEditing({ kind: "menu", slot, scope, options, days: data.menu?.[slot]?.days });

  // A meal tapped on the day's timeline opens its editor. (A slot with options has nothing to
  // edit there: the card is already scrolled into view, where an option is one tap away.)
  const tapped = useTapped(focus);
  if (tapped) {
    const meal = data.days[day].meals.find((candidate) => candidate.id === tapped);
    if (meal) setEditing({ kind: "meal", item: meal });
  }

  return (
    <>
      <ModuleCard
        icon={fuel.icon}
        title={t.name}
        meta={t.planned(planned, MEAL_SLOTS.length)}
        addLabel={dict.app.addTo(t.name)}
        onAdd={() => setEditing({ kind: "meal" })}
      >
        <ol className="grid grid-cols-4 gap-1.5">
          {MEAL_SLOTS.map((slot) => {
            const s = slots[slot];
            const isNow = slot === current;
            const chosen = s.kind === "options" ? pickOf(records, day, slot) : null;
            return (
              <li key={slot}>
                <button
                  type="button"
                  onClick={() =>
                    s.kind === "fixed"
                      ? setEditing({ kind: "meal", item: s.meals[0]! })
                      : s.kind === "options"
                        ? editOptions(slot, s.scope, s.options)
                        : setEditing({ kind: "meal", slot })
                  }
                  aria-label={
                    s.kind === "fixed"
                      ? `${t.slots[slot]}: ${s.meals.map((m) => m.title).join(", ")}`
                      : s.kind === "options"
                        ? `${t.slots[slot]}: ${t.options(s.options.length)}`
                        : t.addSlot(t.slots[slot])
                  }
                  className="group flex w-full flex-col gap-2 rounded-[10px] px-0.5 py-1.5 text-left transition-colors hover:bg-surface-raised sm:px-1.5"
                >
                  <span className="type-label h-3 text-tone" aria-hidden="true">
                    {isNow ? t.now : ""}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`flex h-3 gap-[3px] rounded-full ${
                      s.kind === "empty" ? "border border-dashed border-tone/60 bg-tone/10" : ""
                    } ${isNow ? "ring-2 ring-tone/40 ring-offset-2 ring-offset-surface" : ""}`}
                  >
                    {s.kind === "fixed"
                      ? s.meals.map((meal) => (
                          <span key={meal.id} className="h-full flex-1 rounded-full bg-tone" />
                        ))
                      : s.kind === "options"
                        ? chosen
                          ? [<span key="chosen" className="h-full flex-1 rounded-full bg-tone" />]
                          : s.options.map((option) => (
                              <span
                                key={option.id}
                                className="h-full flex-1 rounded-full bg-tone/35"
                              />
                            ))
                        : null}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span
                      className={`type-label truncate max-sm:tracking-[0.04em] ${isNow ? "text-tone" : "text-ink-muted"}`}
                    >
                      {t.slots[slot]}
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
          <p className="type-body pt-3 text-ink-muted">{t.empty}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {MEAL_SLOTS.map((slot) => {
              const s = slots[slot];
              if (s.kind === "fixed")
                return s.meals.map((meal) => (
                  <li key={meal.id}>
                    <button
                      type="button"
                      onClick={() => setEditing({ kind: "meal", item: meal })}
                      aria-label={dict.app.editItem(meal.title)}
                      className="grid w-full grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3 py-3 text-left"
                    >
                      <span className="type-label text-tone">{t.slots[meal.slot]}</span>
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
              const chosen = pickOf(records, day, slot);
              return (
                <li key={slot} className="flex flex-col gap-2.5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="type-label text-tone">
                      {t.slots[slot]}
                      <span className="text-ink-muted">
                        {" · "}
                        {s.scope === "week" ? t.scopeWeek : t.scopeDay}
                        {chosen ? "" : ` · ${t.choose}`}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => editOptions(slot, s.scope, s.options)}
                      className="type-label shrink-0 text-ink-muted hover:text-ink"
                    >
                      {t.editOptions}
                    </button>
                  </div>
                  <div
                    role="radiogroup"
                    aria-label={t.slots[slot]}
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
                          aria-label={on ? t.unpickLabel(option.title) : t.pickLabel(option.title)}
                          title={option.note}
                          onClick={() => records.set(day, pickKey(slot), on ? null : option.id)}
                          className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[0.875rem] transition-[background-color,border-color,color,opacity] duration-200 ${
                            on
                              ? "border-tone bg-tone font-semibold text-bg"
                              : chosen
                                ? "border-line text-ink-muted hover:border-tone/60 hover:text-ink"
                                : "border-tone/45 hover:bg-tone/10"
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
      </ModuleCard>

      <EditorDialog
        open={editing?.kind === "meal"}
        formKey={editing?.kind === "meal" ? (editing.item?.id ?? `new-${editing.slot}`) : "none"}
        title={editing?.kind === "meal" && editing.item ? t.editor.editMeal : t.editor.newMeal}
        onClose={() => setEditing(null)}
        dispatch={dispatch}
        onSubmit={(form) =>
          editing?.kind === "meal" && editing.item
            ? {
                op: "fuel.meal.update",
                id: editing.item.id,
                slot: form.text("slot"),
                title: form.text("title"),
                note: form.orNull("note"),
              }
            : {
                op: "fuel.meal.set",
                day,
                slot: form.text("slot"),
                title: form.text("title"),
                note: form.orUndefined("note"),
              }
        }
        onDelete={
          editing?.kind === "meal" && editing.item
            ? () => ({ op: "fuel.meal.remove", id: (editing.item as Meal).id })
            : undefined
        }
      >
        <Field label={t.editor.slot}>
          <select
            name="slot"
            defaultValue={
              editing?.kind === "meal" ? (editing.item?.slot ?? editing.slot ?? "lunch") : "lunch"
            }
            className={fieldClass}
          >
            {MEAL_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {t.slots[slot]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.editor.meal}>
          <input
            name="title"
            required
            maxLength={FUEL_LIMITS.title}
            defaultValue={editing?.kind === "meal" ? editing.item?.title : undefined}
            className={fieldClass}
          />
        </Field>
        <Field label={dict.editor.note} hint={dict.editor.optional}>
          <input
            name="note"
            maxLength={FUEL_LIMITS.note}
            defaultValue={editing?.kind === "meal" ? editing.item?.note : undefined}
            className={fieldClass}
          />
        </Field>
      </EditorDialog>

      <EditorDialog
        open={editing?.kind === "menu"}
        formKey={editing?.kind === "menu" ? `${editing.slot}-${editing.scope}` : "none"}
        title={
          editing?.kind === "menu" ? `${t.editor.optionsTitle} · ${t.slots[editing.slot]}` : ""
        }
        onClose={() => setEditing(null)}
        dispatch={dispatch}
        onSubmit={(form) => {
          const menu = editing as Extract<Editing, { kind: "menu" }>;
          const options = form
            .text("options")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
          return form.raw("scope") === "week"
            ? { op: "fuel.menu.set", slot: menu.slot, options, days: menu.days }
            : { op: "fuel.options.set", day, slot: menu.slot, options };
        }}
        onDelete={() => {
          const menu = editing as Extract<Editing, { kind: "menu" }>;
          return menu.scope === "week"
            ? { op: "fuel.menu.clear", slot: menu.slot }
            : { op: "fuel.options.set", day, slot: menu.slot, options: [] };
        }}
      >
        <Field label={t.editor.optionsTitle} hint={t.editor.optionsHint}>
          <textarea
            name="options"
            required
            rows={4}
            defaultValue={
              editing?.kind === "menu"
                ? editing.options.map((option) => option.title).join("\n")
                : undefined
            }
            className={`${fieldClass} h-auto py-3 leading-relaxed`}
          />
        </Field>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="type-label mb-1.5 text-ink-muted">{t.editor.optionsScope}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["day", "week"] as const).map((scope) => (
              <label
                key={scope}
                className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-line text-[0.9375rem] font-bold text-ink-muted has-checked:border-tone has-checked:text-ink"
              >
                <input
                  type="radio"
                  name="scope"
                  value={scope}
                  defaultChecked={editing?.kind === "menu" && editing.scope === scope}
                  className="accent-(--tone)"
                />
                {scope === "day" ? t.editor.scopeThisDay : t.editor.scopeEveryDay}
              </label>
            ))}
          </div>
        </fieldset>
      </EditorDialog>
    </>
  );
}

function FuelCell({ data, t, day, records }: ViewProps<Fuel, FuelMessages>) {
  const { dict } = useLocale();
  const slots = mealSlots(data, day);
  const lines = MEAL_SLOTS.flatMap((slot) => {
    const s = slots[slot];
    if (s.kind === "fixed")
      return s.meals.map((meal) => ({ key: meal.id, slot, text: meal.title, pending: false }));
    if (s.kind !== "options") return [];
    const chosen = s.options.find((option) => option.id === pickOf(records, day, slot));
    return [
      { key: slot, slot, text: chosen?.title ?? t.options(s.options.length), pending: !chosen },
    ];
  });
  const planned = MEAL_SLOTS.filter((slot) => slots[slot].kind !== "empty").length;
  const shown = lines.slice(0, 3);
  const more = lines.length - shown.length;
  return (
    <>
      <CellHeader title={t.name} extra={t.planned(planned, MEAL_SLOTS.length)} />
      <span className="grid grid-cols-4 gap-1" aria-hidden="true">
        {MEAL_SLOTS.map((slot) => {
          const s = slots[slot];
          const full = s.kind === "fixed" || (s.kind === "options" && pickOf(records, day, slot));
          return (
            <span
              key={slot}
              className={`h-1.5 rounded-full ${full ? "bg-tone" : s.kind === "options" ? "bg-tone/45" : "bg-tone/15"}`}
            />
          );
        })}
      </span>
      <span className="flex flex-col gap-1">
        {shown.map((line) => (
          <span key={line.key} className="flex min-w-0 items-baseline gap-2">
            <span className="type-label w-[4.25rem] shrink-0 truncate text-[0.625rem] text-tone">
              {t.slots[line.slot]}
            </span>
            <span
              className={`truncate text-[0.875rem] ${line.pending ? "text-ink-muted italic" : ""}`}
            >
              {line.text}
            </span>
          </span>
        ))}
      </span>
      {more > 0 ? (
        <span className="type-label mt-auto text-ink-muted">{dict.week.more(more)}</span>
      ) : null}
    </>
  );
}

function FuelPeek({ data, t, day, records }: ViewProps<Fuel, FuelMessages>) {
  const slots = mealSlots(data, day);
  return (
    <ul className="flex flex-col gap-2.5">
      {MEAL_SLOTS.map((slot) => {
        const s = slots[slot];
        if (s.kind === "empty") return null;
        const chosen = s.kind === "options" ? pickOf(records, day, slot) : null;
        return (
          <li key={slot} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3">
            <span className="type-label text-tone">{t.slots[slot]}</span>
            <span className="flex min-w-0 flex-col gap-1">
              {s.kind === "fixed"
                ? s.meals.map((meal) => (
                    <span key={meal.id} className="text-[0.9375rem] leading-snug">
                      {meal.title}
                    </span>
                  ))
                : s.options.map((option) => (
                    <span
                      key={option.id}
                      className={`text-[0.9375rem] leading-snug ${
                        chosen === option.id
                          ? "font-semibold text-tone"
                          : chosen
                            ? "text-ink-muted"
                            : ""
                      }`}
                    >
                      {chosen === option.id ? "✓ " : "· "}
                      {option.title}
                    </span>
                  ))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export const views: ModuleViews<Fuel, FuelMessages> = {
  Card: FuelCard,
  WeekCell: FuelCell,
  weekWeight: 3,
  Peek: FuelPeek,
};
