import {
  clearable,
  compact,
  itemId,
  opt,
  optionalText,
  parts,
  sameText,
  text,
  type ChangeDraft,
  type ChangeKind,
} from "@tukkteam/modules";
import {
  DAY_KEYS,
  DayKeySchema,
  MINUTES_PER_DAY,
  dayRecord,
  defineWeekModule,
  eachDay,
  type DayKey,
} from "@tukkteam/modules/week";
import { z } from "zod";
import { messages, type FuelMessages } from "./messages";

export const FUEL_LIMITS = { title: 140, note: 280, mealsPerDay: 12, optionsPerMeal: 8 } as const;

export const MEAL_SLOTS = ["breakfast", "lunch", "snack", "dinner"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];
export const MealSlotSchema = z.enum(MEAL_SLOTS);

export const MealSchema = z
  .object({
    id: itemId,
    slot: MealSlotSchema,
    title: text(FUEL_LIMITS.title),
    note: optionalText(FUEL_LIMITS.note),
  })
  .strict();

/** One dish in a meal's range of options ("abanico"); the person picks one per date. */
export const MealOptionSchema = z
  .object({ id: itemId, title: text(FUEL_LIMITS.title), note: optionalText(FUEL_LIMITS.note) })
  .strict();

const OptionListSchema = z.array(MealOptionSchema).min(1).max(FUEL_LIMITS.optionsPerMeal);

/** Options for one day only, by slot. They win over the week's options for that slot. */
export const DayMenuSchema = z
  .object({
    breakfast: OptionListSchema.optional(),
    lunch: OptionListSchema.optional(),
    snack: OptionListSchema.optional(),
    dinner: OptionListSchema.optional(),
  })
  .strict();

/** Options shared by several days: every day, or only `days` when given. */
export const WeekMenuEntrySchema = z
  .object({ options: OptionListSchema, days: z.array(DayKeySchema).min(1).max(7).optional() })
  .strict();

export const WeekMenuSchema = z
  .object({
    breakfast: WeekMenuEntrySchema.optional(),
    lunch: WeekMenuEntrySchema.optional(),
    snack: WeekMenuEntrySchema.optional(),
    dinner: WeekMenuEntrySchema.optional(),
  })
  .strict();

export const FuelDaySchema = z
  .object({
    meals: z.array(MealSchema).max(FUEL_LIMITS.mealsPerDay),
    /** Per-day meal options. */
    menu: DayMenuSchema.optional(),
  })
  .strict();

export const FuelSchema = z
  .object({
    days: dayRecord(FuelDaySchema),
    /** Meal options shared across the week, by slot. */
    menu: WeekMenuSchema.optional(),
  })
  .strict();

export type Meal = z.infer<typeof MealSchema>;
export type MealOption = z.infer<typeof MealOptionSchema>;
export type DayMenu = z.infer<typeof DayMenuSchema>;
export type WeekMenu = z.infer<typeof WeekMenuSchema>;
export type FuelDay = z.infer<typeof FuelDaySchema>;
export type Fuel = z.infer<typeof FuelSchema>;

const MEAL_ORDER: Record<MealSlot, number> = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 };

export function sortMeals(items: Meal[]): Meal[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => MEAL_ORDER[a.item.slot] - MEAL_ORDER[b.item.slot] || a.index - b.index)
    .map(({ item }) => item);
}

/** What a meal slot holds on a day: fixed meals, a range of options, or nothing. */
export type SlotPlan =
  | { kind: "fixed"; meals: Meal[] }
  | { kind: "options"; options: MealOption[]; scope: "day" | "week" }
  | { kind: "empty" };

/** Resolve every slot of a day: fixed meals win, then the day's options, then the week's. */
export function mealSlots(state: Fuel, day: DayKey): Record<MealSlot, SlotPlan> {
  const d = state.days[day];
  const out = {} as Record<MealSlot, SlotPlan>;
  for (const slot of MEAL_SLOTS) {
    const fixed = d.meals.filter((meal) => meal.slot === slot);
    const own = d.menu?.[slot];
    const week = state.menu?.[slot];
    if (fixed.length) out[slot] = { kind: "fixed", meals: fixed };
    else if (own?.length) out[slot] = { kind: "options", options: own, scope: "day" };
    else if (week && (!week.days || week.days.includes(day)))
      out[slot] = { kind: "options", options: week.options, scope: "week" };
    else out[slot] = { kind: "empty" };
  }
  return out;
}

/** Things planned on a day: every fixed meal, and one for each slot that offers options. */
export function mealCount(state: Fuel, day: DayKey): number {
  return Object.values(mealSlots(state, day)).reduce(
    (count, slot) =>
      count + (slot.kind === "fixed" ? slot.meals.length : slot.kind === "options" ? 1 : 0),
    0,
  );
}

/** "Lentejas / Wok de pollo / Pasta" — how a range of options reads in the receipt. */
export function optionsLabel(options: readonly Pick<MealOption, "title">[]): string {
  return options.map((option) => option.title).join(" / ");
}

/** The key under which the option chosen for a slot is recorded for a date. */
export const pickKey = (slot: MealSlot) => `pick:${slot}`;

/** When each meal is usually eaten, for placing meals on the timeline. */
export type MealTimes = Readonly<Record<MealSlot, number>>;

export const MEAL_TIMES = {
  /** Spanish timetable: late lunch and dinner. */
  es: { breakfast: 8 * 60 + 30, lunch: 14 * 60, snack: 17 * 60 + 30, dinner: 21 * 60 },
  en: { breakfast: 7 * 60 + 30, lunch: 12 * 60 + 30, snack: 16 * 60, dinner: 19 * 60 },
} as const satisfies Record<string, MealTimes>;

export function mealTimes(lang: string): MealTimes {
  return lang === "en" ? MEAL_TIMES.en : MEAL_TIMES.es;
}

/** The slot whose time is closest ahead of "now" (or the last one late in the day). */
export function currentMealSlot(now: number, times: MealTimes): MealSlot {
  for (let i = 0; i < MEAL_SLOTS.length; i += 1) {
    const slot = MEAL_SLOTS[i]!;
    const next = MEAL_SLOTS[i + 1];
    const boundary = next ? (times[slot] + times[next]) / 2 : MINUTES_PER_DAY;
    if (now < boundary) return slot;
  }
  return "dinner";
}

function findMeal(state: Fuel, id: string): { day: DayKey; index: number } | null {
  for (const day of DAY_KEYS) {
    const index = state.days[day].meals.findIndex((meal) => meal.id === id);
    if (index >= 0) return { day, index };
  }
  return null;
}

const mealLine = (kind: ChangeKind, day: DayKey, meal: Meal, toDay?: DayKey): ChangeDraft =>
  compact({ kind, day, toDay, label: meal.title, data: { slot: meal.slot } });

const optionsLine = (
  kind: ChangeKind,
  day: DayKey,
  slot: MealSlot,
  options: readonly MealOption[],
  scope?: "week",
): ChangeDraft => compact({ kind, day, scope, label: optionsLabel(options), data: { slot } });

const note = z.string().trim().max(FUEL_LIMITS.note);

/** A meal option: a plain title ("Lentejas") or { title, note }. */
const OptionInput = z.preprocess(
  (value) => (typeof value === "string" ? { title: value } : value),
  z.object({ title: text(FUEL_LIMITS.title), note: opt(note) }),
);

const { operation, record } = parts<Fuel, FuelMessages>();

/** Meals: one dish per slot, or a range of options to pick from each day. */
export const fuel = defineWeekModule<Fuel, FuelMessages>({
  id: "fuel",
  version: 1,
  author: "PowerWeek",
  tone: "orange",
  icon: "utensils",
  messages,
  schema: FuelSchema,
  empty: () => ({ days: eachDay(() => ({ meals: [] })) }),

  operations: {
    "meal.set": operation({
      input: z.object({
        day: DayKeySchema,
        slot: MealSlotSchema,
        title: text(FUEL_LIMITS.title),
        note: opt(note),
      }),
      examples: [
        {
          fields: { day: "fri", slot: "dinner", title: "Salmon with vegetables" },
          hint: "sets or replaces the meal in that slot",
        },
      ],
      apply(state, input, ctx) {
        const d = state.days[input.day];
        const existing =
          input.slot === "snack" ? -1 : d.meals.findIndex((m) => m.slot === input.slot);
        if (existing >= 0) {
          const meal = compact({ ...d.meals[existing]!, title: input.title, note: input.note });
          d.meals[existing] = meal;
          ctx.change(mealLine("update", input.day, meal));
          return;
        }
        if (d.meals.length >= FUEL_LIMITS.mealsPerDay) return "limit";
        const meal: Meal = compact({
          id: ctx.newId(),
          slot: input.slot,
          title: input.title,
          note: input.note,
        });
        d.meals.push(meal);
        ctx.change(mealLine("add", input.day, meal));
      },
    }),

    "meal.update": operation({
      input: z.object({
        id: itemId,
        day: opt(DayKeySchema),
        slot: opt(MealSlotSchema),
        title: opt(text(FUEL_LIMITS.title)),
        note: clearable(note),
      }),
      examples: [{ fields: { id: "<meal id>", title: "...", day: "sat" } }],
      apply(state, input, ctx) {
        const found = findMeal(state, input.id);
        if (!found) return "not_found";
        const source = state.days[found.day];
        const meal = { ...source.meals[found.index]! };
        if (input.title !== undefined) meal.title = input.title;
        if (input.slot !== undefined) meal.slot = input.slot;
        if (input.note !== undefined) meal.note = input.note ?? undefined;
        compact(meal);
        const target = input.day ?? found.day;
        if (target !== found.day) {
          if (state.days[target].meals.length >= FUEL_LIMITS.mealsPerDay) return "limit";
          source.meals.splice(found.index, 1);
          state.days[target].meals.push(meal);
          ctx.change(mealLine("move", found.day, meal, target));
        } else {
          source.meals[found.index] = meal;
          ctx.change(mealLine("update", found.day, meal));
        }
      },
    }),

    "meal.remove": operation({
      input: z.object({ id: itemId }),
      examples: [{ fields: { id: "<meal id>" } }],
      apply(state, input, ctx) {
        const found = findMeal(state, input.id);
        if (!found) return "not_found";
        const [meal] = state.days[found.day].meals.splice(found.index, 1);
        ctx.change(mealLine("remove", found.day, meal!));
      },
    }),

    "menu.set": operation({
      input: z.object({
        slot: MealSlotSchema,
        options: z.array(OptionInput).min(1).max(FUEL_LIMITS.optionsPerMeal),
        days: opt(z.array(DayKeySchema).min(1).max(7)),
      }),
      examples: [
        {
          fields: {
            slot: "lunch",
            options: ["Lentils", "Chicken stir-fry", "Pesto pasta"],
            days: ["mon", "tue", "wed", "thu", "fri"],
          },
          hint: "options shared by several days (omit days = every day); replaces that slot's week options",
        },
      ],
      apply(state, input, ctx) {
        const menu = (state.menu ??= {});
        const before = menu[input.slot];
        const entry = compact({
          options: withIds(input.options, before?.options, ctx.newId),
          days: input.days ? DAY_KEYS.filter((day) => input.days!.includes(day)) : undefined,
        });
        menu[input.slot] = entry;
        ctx.change(
          optionsLine(
            before ? "update" : "add",
            entry.days?.[0] ?? "mon",
            input.slot,
            entry.options,
            "week",
          ),
        );
      },
    }),

    "menu.clear": operation({
      input: z.object({ slot: MealSlotSchema }),
      examples: [{ fields: { slot: "lunch" }, hint: "removes the week options of a slot" }],
      apply(state, input, ctx) {
        const entry = state.menu?.[input.slot];
        if (!entry) return "noop";
        delete state.menu![input.slot];
        ctx.change(
          optionsLine("remove", entry.days?.[0] ?? "mon", input.slot, entry.options, "week"),
        );
      },
    }),

    "options.set": operation({
      input: z.object({
        day: DayKeySchema,
        slot: MealSlotSchema,
        options: z.array(OptionInput).max(FUEL_LIMITS.optionsPerMeal),
      }),
      examples: [
        {
          fields: { day: "sat", slot: "dinner", options: ["Pizza", "Sushi"] },
          hint: "options for one day only; [] removes them",
        },
      ],
      apply(state, input, ctx) {
        const d = state.days[input.day];
        const before = d.menu?.[input.slot];
        if (input.options.length === 0) {
          if (!before) return "noop";
          delete d.menu![input.slot];
          ctx.change(optionsLine("remove", input.day, input.slot, before));
          return;
        }
        const options = withIds(input.options, before, ctx.newId);
        (d.menu ??= {})[input.slot] = options;
        ctx.change(optionsLine(before ? "update" : "add", input.day, input.slot, options));
      },
    }),
  },

  records: {
    /**
     * Choosing one option for a date is not a plan change: it is a fact about that date, like
     * ticking something off. `option` is the option's title (or id); null clears the choice.
     */
    pick: record({
      input: z.object({
        day: DayKeySchema,
        slot: MealSlotSchema,
        option: z.string().trim().min(1).max(FUEL_LIMITS.title).nullable(),
      }),
      examples: [
        {
          fields: { day: "fri", slot: "lunch", option: "Chicken stir-fry" },
          hint: "chooses one of that day's options for this week (\"today I'll have…\"); option null clears the choice",
        },
      ],
      resolve(state, input, ctx) {
        const key = pickKey(input.slot);
        if (input.option === null) {
          if (ctx.get(input.day, key) === undefined) return "noop";
          ctx.write(
            { day: input.day, key, value: null },
            {
              kind: "remove",
              day: input.day,
              label: "—",
              data: { slot: input.slot, picked: true },
            },
          );
          return;
        }
        const slot = mealSlots(state, input.day)[input.slot];
        if (slot.kind !== "options") return "not_found";
        const wanted = input.option;
        const option = slot.options.find((o) => o.id === wanted || sameText(o.title, wanted));
        if (!option) return "not_found";
        ctx.write(
          { day: input.day, key, value: option.id },
          {
            kind: "update",
            day: input.day,
            label: option.title,
            data: { slot: input.slot, picked: true },
          },
        );
      },
    }),
  },

  normalize(state) {
    for (const day of DAY_KEYS) {
      const d = state.days[day];
      d.meals = sortMeals(d.meals);
      if (d.menu && Object.keys(d.menu).length === 0) delete d.menu;
    }
    if (state.menu && Object.keys(state.menu).length === 0) delete state.menu;
  },

  describe(change, t) {
    const slot = change.data?.slot as MealSlot | undefined;
    const what = change.data?.picked ? t.picked(change.label) : change.label;
    return `${slot ? `${t.slots[slot]}: ` : ""}${what}`;
  },

  assistant: {
    about:
      'meals. "days": per day { meals: [{ id, slot, title, note }], menu }, with slot one of breakfast, lunch, snack or dinner (one meal per slot, except snack); the day\'s optional "menu" holds meal options for that day only, by slot: { "lunch": [{ id, title }] }. "menu": optional options shared by several days, by slot: { "dinner": { "options": [{ id, title }], "days": ["mon","tue"] } } (no "days" = every day). For each slot a fixed meal wins, then the day\'s options, then the week\'s. Each day the user picks one option.',
    rules: [
      'Meal slots: breakfast = desayuno; lunch = comida or almuerzo; snack = merienda or picoteo; dinner = cena. One dish is fuel.meal.set. Alternatives ("para comer lentejas, wok o pasta") are options: the same for several days or "every day" → one fuel.menu.set with days; one specific day → fuel.options.set. "Today I\'ll have X" when X is one of the day\'s options → fuel.pick. If the user asks you to propose or vary options (for a goal such as cheap and tasty, bulking, cutting or Asian food), you may create 3–4 short, realistic, varied dishes in their language that share common ingredients. Different options for each day ("un abanico distinto para cada día"): one fuel.options.set per day and slot, varied across days with no dish repeated in the same slot; if no meal is named, do it for every slot that already has options (all four if none), then fuel.menu.clear those slots so the week options do not linger.',
    ],
    view(state) {
      const days = Object.fromEntries(
        DAY_KEYS.filter((day) => state.days[day].meals.length > 0 || state.days[day].menu).map(
          (day) => [day, state.days[day]],
        ),
      );
      return state.menu ? { days, menu: state.menu } : { days };
    },
  },

  week: {
    load: mealCount,
    summary(state, day, t) {
      if (day) {
        const count = mealCount(state, day);
        return count > 0 ? t.summary(count) : null;
      }
      const planned = DAY_KEYS.reduce(
        (sum, key) =>
          sum + Object.values(mealSlots(state, key)).filter((s) => s.kind !== "empty").length,
        0,
      );
      return planned > 0 ? t.summary(planned) : null;
    },
    timeline(state, day, facts) {
      const times = mealTimes(facts.lang);
      const slots = mealSlots(state, day);
      // Meals sit at the usual time of their slot; extra snacks step 25 minutes to the right. A
      // slot with options shows one marker: pending until one is chosen, then like any meal.
      const markers = MEAL_SLOTS.flatMap((slot) => {
        const s = slots[slot];
        if (s.kind === "fixed")
          return s.meals.map((meal, index) => ({
            id: meal.id,
            at: times[slot] + index * 25,
            title: `${facts.t.slots[slot]}: ${meal.title}`,
          }));
        if (s.kind !== "options") return [];
        const chosen = s.options.find((option) => option.id === facts.record(pickKey(slot)));
        return [
          {
            id: `options-${slot}`,
            at: times[slot],
            title: `${facts.t.slots[slot]}: ${chosen?.title ?? facts.t.options(s.options.length)}`,
            pending: !chosen,
          },
        ];
      });
      return { markers };
    },
    clearDay(state, day, ctx) {
      const d = state.days[day];
      for (const meal of d.meals) ctx.change(mealLine("remove", day, meal));
      d.meals = [];
      for (const slot of MEAL_SLOTS) {
        const options = d.menu?.[slot];
        if (options) ctx.change(optionsLine("remove", day, slot, options));
      }
      delete d.menu;
    },
    copyDay(state, from, to, ctx) {
      const source = state.days[from];
      const target = state.days[to];
      target.meals = source.meals.map((meal) => ({ ...meal, id: ctx.newId() }));
      for (const meal of target.meals) ctx.change(mealLine("add", to, meal));
      if (source.menu) {
        target.menu = structuredClone(source.menu);
        for (const slot of MEAL_SLOTS) {
          const options = target.menu[slot];
          if (options) ctx.change(optionsLine("add", to, slot, options));
        }
      }
    },
  },
});

/** New options keep the id of an existing option with the same title, so picks survive edits. */
function withIds(
  inputs: readonly { title: string; note?: string }[],
  previous: readonly MealOption[] = [],
  newId: () => string,
): MealOption[] {
  return inputs.map((input) =>
    compact({
      id: previous.find((p) => sameText(p.title, input.title))?.id ?? newId(),
      title: input.title,
      note: input.note,
    }),
  );
}
