import {
  clearable,
  compact,
  itemId,
  looseInt,
  opt,
  parts,
  sameText,
  text,
  type ChangeDraft,
  type ChangeKind,
  type Json,
} from "@tukkteam/modules";
import {
  DAY_KEYS,
  DayKeySchema,
  defineWeekModule,
  isDayKey,
  type DayKey,
} from "@tukkteam/modules/week";
import { z } from "zod";
import { messages, type HabitsMessages } from "./messages";

export const HABIT_LIMITS = { items: 20, title: 80, unit: 16, target: 99, amount: 99 } as const;

/**
 * Something to do on some or all days of the week. `target` is how many times or units a day
 * make it done, left out for a simple tick (once). `days` is left out when it is every day.
 */
export const HabitSchema = z
  .object({
    id: itemId,
    title: text(HABIT_LIMITS.title),
    target: z.number().int().min(2).max(HABIT_LIMITS.target).optional(),
    unit: text(HABIT_LIMITS.unit).optional(),
    days: z.array(DayKeySchema).min(1).max(7).optional(),
  })
  .strict();

export const HabitsSchema = z
  .object({ items: z.array(HabitSchema).max(HABIT_LIMITS.items) })
  .strict();

export type Habit = z.infer<typeof HabitSchema>;
export type Habits = z.infer<typeof HabitsSchema>;

/** How much in a day makes a habit done: 1 for a simple tick. */
export const targetOf = (habit: Habit): number => habit.target ?? 1;

export const appliesOn = (habit: Habit, day: DayKey): boolean =>
  !habit.days || habit.days.includes(day);

/** The habits of one day, in the person's order. */
export const habitsOn = (state: Habits, day: DayKey): Habit[] =>
  state.items.filter((habit) => appliesOn(habit, day));

/** A habit by its id, or by its title ignoring case and accents. */
export function findHabit(state: Habits, reference: string): Habit | undefined {
  const wanted = reference.trim();
  return (
    state.items.find((habit) => habit.id === wanted) ??
    state.items.find((habit) => sameText(habit.title, wanted))
  );
}

const cap = (amount: number) => Math.max(0, Math.min(HABIT_LIMITS.amount, Math.trunc(amount)));

/**
 * How much a stored record stands for. Records are free-form JSON, so anything that is not a
 * number counts as nothing done.
 */
export const amountOf = (value: Json | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? cap(value) : 0;

/** What to store for an amount: nothing done is no record at all. */
export const recordOf = (amount: number): number | null => (amount > 0 ? amount : null);

/**
 * The amount a log leaves for a day, given what was stored. A `value` sets it, `add` adds to it,
 * a null `value` clears it, and with none of them the habit is marked done: raised to its target
 * (never lowered, when more than the target was already done).
 */
export function nextAmount(
  habit: Habit,
  stored: number,
  change: { value?: number | null; add?: number } = {},
): number {
  if (typeof change.value === "number") return cap(change.value);
  if (change.add !== undefined) return cap(stored + change.add);
  if (change.value === null) return 0;
  return Math.max(stored, targetOf(habit));
}

export const isDone = (habit: Habit, amount: number): boolean => amount >= targetOf(habit);

/** How full a habit's bar is, 0..1. */
export const fillOf = (habit: Habit, amount: number): number =>
  Math.max(0, Math.min(1, amount / targetOf(habit)));

const ratio = (amount: number, target: number, unit?: string) =>
  `${amount}/${target}${unit ? ` ${unit}` : ""}`;

/** "3/8 vasos": how far a habit is on a day. */
export const progressOf = (habit: Habit, amount: number): string =>
  ratio(amount, targetOf(habit), habit.unit);

/** Weekdays in week order without repeats; nothing when it is none or all seven (every day). */
export function weekdays(days: readonly DayKey[] | undefined): DayKey[] | undefined {
  const kept = DAY_KEYS.filter((day) => days?.includes(day));
  return kept.length === 0 || kept.length === DAY_KEYS.length ? undefined : kept;
}

/** What a model or a form may write for each field of a habit. A target of 1 is a simple tick. */
const field = {
  title: text(HABIT_LIMITS.title),
  target: looseInt(1, HABIT_LIMITS.target),
  unit: text(HABIT_LIMITS.unit),
  days: z.array(DayKeySchema).min(1).max(7),
};

/** When updating a text: leaving it out keeps it, null or "" clears it. */
const clearableText = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    clearable(schema),
  );

const AddInput = z.object({
  title: field.title,
  target: opt(field.target),
  unit: opt(field.unit),
  days: opt(field.days),
});
const UpdateInput = z.object({
  id: itemId,
  title: opt(field.title),
  target: clearable(field.target),
  unit: clearableText(field.unit),
  days: clearable(field.days),
});
const RemoveInput = z.object({ id: itemId });
const LogInput = z.object({
  /** The habit's id or its title. */
  habit: field.title,
  day: DayKeySchema,
  value: clearable(looseInt(0, Number.MAX_SAFE_INTEGER)),
  add: opt(looseInt(-HABIT_LIMITS.amount, HABIT_LIMITS.amount)),
});

/** What `habits.add` takes, and what an editor form states: a habit without its id. */
export type HabitFields = z.output<typeof AddInput>;
/** What `habits.update` takes besides the id: only what changes, null to clear. */
export type HabitChanges = Omit<z.output<typeof UpdateInput>, "id">;

/**
 * This module's plan operations as a view writes them. An operation is sent as loose JSON, so
 * this is what lets the compiler check their names and fields.
 */
export type HabitOperation =
  | ({ op: "habits.add" } & HabitFields)
  | ({ op: "habits.update" } & z.output<typeof UpdateInput>)
  | ({ op: "habits.remove" } & z.output<typeof RemoveInput>);

/** Fields as they are stored: a target of 1 is a simple tick, and every day is no days at all. */
export function tidy(fields: HabitFields): Omit<Habit, "id"> {
  return compact({
    title: fields.title,
    target: fields.target !== undefined && fields.target > 1 ? fields.target : undefined,
    unit: fields.unit || undefined,
    days: weekdays(fields.days),
  });
}

/** The fields of `habits.update` that turn a habit into `next`; empty when nothing differs. */
export function changesTo(habit: Habit, next: Omit<Habit, "id">): HabitChanges {
  const changes: HabitChanges = {};
  if (next.title !== habit.title) changes.title = next.title;
  if (next.target !== habit.target) changes.target = next.target ?? null;
  if (next.unit !== habit.unit) changes.unit = next.unit ?? null;
  if (String(next.days) !== String(habit.days)) changes.days = next.days ?? null;
  return changes;
}

/** How much of what, for the receipt. */
const measure = (habit: Habit): Record<string, Json> => ({
  ...(habit.target ? { target: habit.target } : {}),
  ...(habit.unit ? { unit: habit.unit } : {}),
});

/** A habit belongs to the whole week, so its changes are not tied to one day. */
const planLine = (kind: ChangeKind, habit: Habit): ChangeDraft => ({
  kind,
  scope: "week",
  label: habit.title,
  data: { ...measure(habit), ...(habit.days ? { days: habit.days } : {}) },
});

const logLine = (kind: ChangeKind, day: DayKey, habit: Habit, amount: number): ChangeDraft => ({
  kind,
  day,
  label: habit.title,
  data: { ...measure(habit), amount },
});

const { operation, record } = parts<Habits, HabitsMessages>();

/** Habits: things to do on some or all days of the week, ticked or counted on each date. */
export const habits = defineWeekModule<Habits, HabitsMessages>({
  id: "habits",
  version: 1,
  author: "PowerWeek",
  tone: "teal",
  icon: "repeat",
  messages,
  schema: HabitsSchema,
  empty: () => ({ items: [] }),

  operations: {
    add: operation({
      input: AddInput,
      examples: [
        {
          fields: { title: "Water", target: 8, unit: "glasses" },
          hint: "target = times or units a day, unit = what is counted; omit both for a simple tick",
        },
        {
          fields: { title: "Creatine", days: ["mon", "wed", "fri"] },
          hint: "days = the weekdays it applies to; omit for every day",
        },
      ],
      apply(state, input, ctx) {
        // Titles stay unique: the assistant logs a habit by its title.
        if (state.items.some((habit) => sameText(habit.title, input.title))) return "conflict";
        if (state.items.length >= HABIT_LIMITS.items) return "limit";
        const habit: Habit = { id: ctx.newId(), ...tidy(input) };
        state.items.push(habit);
        ctx.change(planLine("add", habit));
      },
    }),

    update: operation({
      input: UpdateInput,
      examples: [
        {
          fields: { id: "<habit id>", target: 10 },
          hint: "only the fields that change (title, target, unit, days); null clears target (back to a simple tick), unit or days (back to every day)",
        },
      ],
      apply(state, input, ctx) {
        const habit = state.items.find((item) => item.id === input.id);
        if (!habit) return "not_found";
        const next = tidy({
          title: input.title ?? habit.title,
          target: input.target === undefined ? habit.target : (input.target ?? undefined),
          unit: input.unit === undefined ? habit.unit : (input.unit ?? undefined),
          days: input.days === undefined ? habit.days : (input.days ?? undefined),
        });
        const changes = changesTo(habit, next);
        if (Object.keys(changes).length === 0) return "noop";
        const taken = state.items.some(
          (other) => other !== habit && sameText(other.title, next.title),
        );
        if (changes.title !== undefined && taken) return "conflict";
        const changed: Habit = { id: habit.id, ...next };
        state.items[state.items.indexOf(habit)] = changed;
        ctx.change(planLine("update", changed));
      },
    }),

    remove: operation({
      input: RemoveInput,
      examples: [{ fields: { id: "<habit id>" } }],
      apply(state, input, ctx) {
        const habit = state.items.find((item) => item.id === input.id);
        if (!habit) return "not_found";
        state.items.splice(state.items.indexOf(habit), 1);
        ctx.change(planLine("remove", habit));
      },
    }),
  },

  records: {
    /**
     * What was done on a date: a fact about that date, not a change to the plan. The record's key
     * is the habit's id and its value the amount, a whole number from 1 up; nothing stored means
     * not done.
     */
    log: record({
      input: LogInput,
      examples: [
        {
          fields: { habit: "<habit id or title>", day: "mon" },
          hint: 'done that day ("I meditated")',
        },
        {
          fields: { habit: "Water", day: "mon", value: 3 },
          hint: 'the amount so far that day ("3 glasses so far"); value 0 or null clears it',
        },
        {
          fields: { habit: "Water", day: "mon", add: 1 },
          hint: 'that many more ("one more glass"); negative takes some off',
        },
      ],
      resolve(state, input, ctx) {
        const habit = findHabit(state, input.habit);
        if (!habit) return "not_found";
        const before = amountOf(ctx.get(input.day, habit.id));
        const amount = nextAmount(habit, before, input);
        if (amount === before) return "noop";
        ctx.write(
          { day: input.day, key: habit.id, value: recordOf(amount) },
          logLine(
            before === 0 ? "add" : amount === 0 ? "remove" : "update",
            input.day,
            habit,
            amount,
          ),
        );
      },
    }),
  },

  describe(change, t) {
    const data = change.data ?? {};
    const target = typeof data.target === "number" ? data.target : 1;
    const unit = typeof data.unit === "string" ? data.unit : undefined;
    // What was done on a date: "Agua: 3/8 vasos", "Meditar: hecho".
    if (typeof data.amount === "number") {
      const state =
        target > 1 ? ratio(data.amount, target, unit) : data.amount > 0 ? t.done : t.notDone;
      return `${change.label}: ${state}`;
    }
    // The habit itself: "Agua · 8 vasos", "Creatina · Lun, Mié, Vie".
    const goal = target > 1 ? (unit ? `${target} ${unit}` : t.times(target)) : "";
    const days = Array.isArray(data.days) ? data.days.filter(isDayKey) : [];
    return [change.label, goal, days.map((day) => t.days[day]).join(", ")]
      .filter(Boolean)
      .join(" · ");
  },

  assistant: {
    about:
      'things done regularly on some or all days of the week, ticked or counted each day. A list of habits { id, title, target, unit, days }: "target" is how many times or units a day (left out = once, a simple tick), "unit" is what is counted ("glasses"), "days" are the weekdays it applies to (left out = every day). What was done on each date is not part of the plan and is not shown.',
    rules: [
      'Habits: something done regularly and ticked or counted each day ("meditate every day", "8 glasses of water a day", "creatine on weekdays") is a habit: ONE habits.add, with "days" for the weekdays it applies to (omit "days" for every day), "target" when it is counted and "unit" for what is counted. If a habit with that name exists, change it with habits.update instead. What the user says they did is not a change to the plan: "I meditated", "3 glasses so far" or "one more glass" is habits.log with that day (today unless they name another): nothing else = done, "value" = the amount so far, "add" = that many more. A one-off thing with a time ("dentist on Thursday at 13:30") is not a habit: it belongs in the agenda.',
    ],
    view: (state) => state.items,
  },

  week: {
    load: (state, day) => habitsOn(state, day).length,
    summary(state, day, t) {
      const count = day ? habitsOn(state, day).length : state.items.length;
      return count > 0 ? t.summary(count) : null;
    },
  },
});
