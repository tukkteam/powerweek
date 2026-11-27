"use client";

import { sameText } from "@tukkteam/modules";
import { DAY_KEYS, isDayKey, type DayKey } from "@tukkteam/modules/week";
import { Check, Minus, Pencil } from "lucide-react";
import { useState } from "react";
import { EditorDialog, Field, fieldClass, type FormReader } from "@/components/app/editor-dialog";
import { CellHeader, ModuleCard } from "@/components/app/module-card";
import { useLocale } from "@/components/i18n/locale-provider";
import { buzz } from "@/lib/haptics";
import { useJustDone } from "@/lib/use-just-done";
import type { CardProps, ModuleRecords, ModuleViews, ViewProps } from "../host";
import type { HabitsMessages } from "./messages";
import {
  amountOf,
  appliesOn,
  changesTo,
  fillOf,
  HABIT_LIMITS,
  habits,
  habitsOn,
  isDone,
  nextAmount,
  progressOf,
  recordOf,
  targetOf,
  tidy,
  type Habit,
  type HabitOperation,
  type Habits,
} from "./module";

type Editing = { item?: Habit } | null;

/** How much of a habit was done on a day of the visible week. */
const amountOn = (records: ModuleRecords, habit: Habit, day: DayKey): number =>
  amountOf(records.get(day, habit.id));

/** "2/5": how many of a day's habits are done. */
const tally = (records: ModuleRecords, list: readonly Habit[], day: DayKey): string =>
  `${list.filter((habit) => isDone(habit, amountOn(records, habit, day))).length}/${list.length}`;

/** The habit a submitted form states, as it would be stored. No day ticked means every day. */
function readForm(form: FormReader): Omit<Habit, "id"> {
  return tidy({
    title: form.text("title"),
    target: Number(form.text("target")) || undefined,
    unit: form.orUndefined("unit"),
    days: form.all("days").filter(isDayKey),
  });
}

/**
 * Habits as bars that fill: one row per habit of the day, with the week in miniature beside it.
 * Tapping a row adds one (a habit done once a day is ticked and unticked).
 */
function HabitsCard({ data, t, day, records, dispatch }: CardProps<Habits, HabitsMessages>) {
  const { dict } = useLocale();
  const [editing, setEditing] = useState<Editing>(null);
  const today = habitsOn(data, day);
  const item = editing?.item;

  const taken = (title: string) =>
    data.items.some((other) => other.id !== item?.id && sameText(other.title, title.trim()));

  return (
    <>
      <ModuleCard
        icon={habits.icon}
        title={t.name}
        meta={today.length > 0 ? tally(records, today, day) : undefined}
        addLabel={data.items.length < HABIT_LIMITS.items ? dict.app.addTo(t.name) : undefined}
        onAdd={() => setEditing({})}
      >
        {today.length === 0 ? (
          <p className="type-body py-2 text-ink-muted">
            {data.items.length === 0 ? t.empty : t.noneToday}
          </p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {today.map((habit) => (
              <HabitRow
                key={habit.id}
                habit={habit}
                day={day}
                t={t}
                records={records}
                onEdit={() => setEditing({ item: habit })}
              />
            ))}
          </ul>
        )}
      </ModuleCard>

      <EditorDialog
        open={editing !== null}
        formKey={item?.id ?? "new"}
        title={item ? t.editor.editTitle : t.editor.newTitle}
        onClose={() => setEditing(null)}
        dispatch={dispatch}
        onSubmit={(form): HabitOperation => {
          const fields = readForm(form);
          return item
            ? { op: "habits.update", id: item.id, ...changesTo(item, fields) }
            : { op: "habits.add", ...fields };
        }}
        onDelete={item ? (): HabitOperation => ({ op: "habits.remove", id: item.id }) : undefined}
      >
        <Field label={dict.editor.title}>
          <input
            name="title"
            required
            maxLength={HABIT_LIMITS.title}
            defaultValue={item?.title}
            onChange={(event) =>
              event.currentTarget.setCustomValidity(
                taken(event.currentTarget.value) ? t.editor.duplicate : "",
              )
            }
            className={fieldClass}
          />
        </Field>
        <div className="grid grid-cols-2 items-end gap-3">
          <Field label={t.editor.target} hint={dict.editor.optional}>
            <input
              name="target"
              type="number"
              inputMode="numeric"
              min={1}
              max={HABIT_LIMITS.target}
              step={1}
              defaultValue={item?.target}
              placeholder="1"
              className={fieldClass}
            />
          </Field>
          <Field label={t.editor.unit} hint={dict.editor.optional}>
            <input
              name="unit"
              maxLength={HABIT_LIMITS.unit}
              defaultValue={item?.unit}
              placeholder={t.editor.unitExample}
              className={fieldClass}
            />
          </Field>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="type-label mb-1.5 text-ink-muted">{t.editor.days}</legend>
          <div className="grid grid-cols-7 gap-1">
            {DAY_KEYS.map((key) => (
              <label
                key={key}
                className="relative flex h-11 cursor-pointer items-center justify-center rounded-[10px] border border-line text-[0.8125rem] font-bold text-ink-muted has-checked:border-tone has-checked:bg-tone has-checked:text-bg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"
              >
                <input
                  type="checkbox"
                  name="days"
                  value={key}
                  defaultChecked={item ? appliesOn(item, key) : true}
                  className="sr-only"
                />
                {t.days[key]}
              </label>
            ))}
          </div>
        </fieldset>
      </EditorDialog>
    </>
  );
}

function HabitRow({
  habit,
  day,
  t,
  records,
  onEdit,
}: {
  habit: Habit;
  day: DayKey;
  t: HabitsMessages;
  records: ModuleRecords;
  onEdit: () => void;
}) {
  const { dict } = useLocale();
  const amount = amountOn(records, habit, day);
  const counted = targetOf(habit) > 1;
  const done = isDone(habit, amount);
  const due = DAY_KEYS.filter((key) => appliesOn(habit, key));
  const kept = due.filter((key) => isDone(habit, amountOn(records, habit, key))).length;

  const log = (change: { value?: number; add?: number }) => {
    const next = nextAmount(habit, amount, change);
    if (next === amount) return;
    if (!done && isDone(habit, next)) buzz("done");
    records.set(day, habit.id, recordOf(next));
  };
  const action = counted
    ? t.addOne(habit.title, progressOf(habit, amount))
    : done
      ? dict.app.markUndone(habit.title)
      : dict.app.markDone(habit.title);

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-[10px] px-2 transition-colors hover:bg-surface-raised">
      <button
        type="button"
        role={counted ? undefined : "checkbox"}
        aria-checked={counted ? undefined : done}
        aria-label={`${action}. ${t.thisWeek(kept, due.length)}`}
        onClick={() => log(counted ? { add: 1 } : { value: done ? 0 : 1 })}
        className="flex min-w-0 flex-col gap-2 py-2.5 text-left"
      >
        <span className="flex min-h-6 items-center justify-between gap-3">
          <span className={`type-body truncate font-semibold ${done ? "text-ink-muted" : ""}`}>
            {habit.title}
          </span>
          <Amount habit={habit} amount={amount} t={t} />
        </span>
        <span className="flex items-center gap-3">
          <Bar habit={habit} amount={amount} className="h-2 flex-1" />
          <WeekBars habit={habit} records={records} current={day} />
        </span>
      </button>
      <span className="flex items-center">
        {/* The place of "minus one" is kept on every row, so the bars line up down the card. */}
        {counted ? (
          <button
            type="button"
            onClick={() => log({ add: -1 })}
            aria-label={t.removeOne(habit.title)}
            className={`flex size-11 items-center justify-center rounded-full text-ink-muted hover:text-ink ${
              amount > 0 ? "" : "invisible"
            }`}
          >
            <Minus size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <span className="size-11" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={onEdit}
          aria-label={dict.app.editItem(habit.title)}
          className="flex size-11 items-center justify-center rounded-full text-ink-muted hover:text-ink"
        >
          <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </span>
    </li>
  );
}

/** "3/8 vasos" for a counted habit; a tick for a habit done once a day. */
function Amount({ habit, amount, t }: { habit: Habit; amount: number; t: HabitsMessages }) {
  const done = isDone(habit, amount);
  const justDone = useJustDone(done);
  if (targetOf(habit) > 1)
    return (
      <span
        key={justDone ? "done" : "count"}
        className={`type-numeric max-w-[60%] shrink-0 truncate ${done ? "text-tone" : "text-ink-muted"} ${
          justDone ? "pw-pop" : ""
        }`}
      >
        {progressOf(habit, amount)}
      </span>
    );
  return (
    <span
      role="img"
      aria-label={done ? t.done : t.notDone}
      className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        done ? "border-tone bg-tone text-bg" : "border-tone/60"
      }`}
    >
      {done ? (
        <Check
          size={14}
          strokeWidth={3}
          aria-hidden="true"
          className={justDone ? "pw-pop" : undefined}
        />
      ) : null}
    </span>
  );
}

/** A bar as full as a habit is on a day. */
function Bar({ habit, amount, className }: { habit: Habit; amount: number; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative block overflow-hidden rounded-full bg-tone/15 ${className}`}
    >
      <span
        className="pw-fill absolute inset-y-0 left-0 rounded-full bg-tone"
        style={{ width: `${fillOf(habit, amount) * 100}%` }}
      />
    </span>
  );
}

/**
 * The visible week in miniature: one bar per weekday, as full as that day was. The day on screen
 * is the wide one; a day the habit does not apply to is a stub, so the difference does not hang
 * on a shade.
 */
function WeekBars({
  habit,
  records,
  current,
}: {
  habit: Habit;
  records: ModuleRecords;
  current: DayKey;
}) {
  return (
    <span aria-hidden="true" className="flex shrink-0 items-end gap-[3px]">
      {DAY_KEYS.map((day) => {
        const fill = fillOf(habit, amountOn(records, habit, day));
        return (
          <span
            key={day}
            className={`pw-bar relative block overflow-hidden rounded-full bg-tone/15 ${
              day === current ? "w-2.5" : "w-1.5"
            } ${appliesOn(habit, day) ? "h-4" : "h-1.5"}`}
          >
            <span
              className="pw-bar absolute inset-x-0 bottom-0 bg-tone"
              // A little done still has to show in a bar this small.
              style={{ height: `${(fill > 0 ? Math.max(fill, 0.2) : 0) * 100}%` }}
            />
          </span>
        );
      })}
    </span>
  );
}

function HabitsCell({ data, t, day, records }: ViewProps<Habits, HabitsMessages>) {
  const { dict } = useLocale();
  const today = habitsOn(data, day);
  const shown = today.slice(0, 4);
  const more = today.length - shown.length;
  return (
    <>
      <CellHeader title={t.name} extra={tally(records, today, day)} />
      <span className="flex flex-col gap-2">
        {shown.map((habit) => (
          <span key={habit.id} className="flex flex-col gap-1">
            <span className="truncate text-[0.875rem] leading-snug font-semibold">
              {habit.title}
            </span>
            <Bar habit={habit} amount={amountOn(records, habit, day)} className="h-1" />
          </span>
        ))}
      </span>
      {more > 0 ? (
        <span className="type-label mt-auto text-ink-muted">{dict.week.more(more)}</span>
      ) : null}
    </>
  );
}

function HabitsPeek({ data, t, day, records }: ViewProps<Habits, HabitsMessages>) {
  return (
    <ul className="flex flex-col gap-3">
      {habitsOn(data, day).map((habit) => {
        const amount = amountOn(records, habit, day);
        return (
          <li key={habit.id} className="flex flex-col gap-1.5">
            <span className="flex min-h-6 items-center justify-between gap-3">
              <span className="min-w-0 text-[0.9375rem] leading-snug font-semibold">
                {habit.title}
              </span>
              <Amount habit={habit} amount={amount} t={t} />
            </span>
            <Bar habit={habit} amount={amount} className="h-1.5" />
          </li>
        );
      })}
    </ul>
  );
}

export const views: ModuleViews<Habits, HabitsMessages> = {
  Card: HabitsCard,
  WeekCell: HabitsCell,
  weekWeight: 3,
  Peek: HabitsPeek,
};
