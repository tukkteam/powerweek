import { z } from "zod";

/** ISO weekday order: the week starts on Monday. */
export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];
export const DayKeySchema = z.enum(DAY_KEYS);

/** The three things a day is made of. Colour and icon live in the design system. */
export const CATEGORIES = ["agenda", "train", "fuel"] as const;
export type Category = (typeof CATEGORIES)[number];
export const CategorySchema = z.enum(CATEGORIES);

export const MEAL_SLOTS = ["breakfast", "lunch", "snack", "dinner"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];
export const MealSlotSchema = z.enum(MEAL_SLOTS);

/** 24h clock, zero padded: "07:30". */
export const TimeSchema = z
  .string()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "Expected HH:MM (24h)")
  .meta({ id: "TimeOfDay" });

/** Slug of an illustrated move in the move library (see moves.ts), e.g. "bench-press". */
export const MoveSlugSchema = z
  .string()
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a move slug")
  .meta({ id: "MoveSlug" });

export const LIMITS = {
  title: 140,
  note: 280,
  exerciseName: 100,
  workoutTitle: 80,
  reps: 20,
  load: 20,
  agendaPerDay: 40,
  exercisesPerWorkout: 30,
  mealsPerDay: 12,
  dayNote: 500,
} as const;

const IdSchema = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const AgendaItemSchema = z
  .object({
    id: IdSchema,
    title: text(LIMITS.title),
    time: TimeSchema.optional(),
    endTime: TimeSchema.optional(),
    note: optionalText(LIMITS.note),
  })
  .strict()
  .meta({ id: "AgendaItem" });

export const ExerciseSchema = z
  .object({
    id: IdSchema,
    name: text(LIMITS.exerciseName),
    sets: z.number().int().min(1).max(99).optional(),
    reps: optionalText(LIMITS.reps),
    load: optionalText(LIMITS.load),
    note: optionalText(LIMITS.note),
    /** The illustration and muscle data to show; matched from the name when missing. */
    move: MoveSlugSchema.optional(),
  })
  .strict()
  .meta({ id: "Exercise" });

export const WorkoutSchema = z
  .object({
    title: text(LIMITS.workoutTitle),
    /** Optional start time; places the session on the day timeline. */
    time: TimeSchema.optional(),
    exercises: z.array(ExerciseSchema).max(LIMITS.exercisesPerWorkout),
    note: optionalText(LIMITS.note),
  })
  .strict()
  .meta({ id: "Workout" });

export const MealSchema = z
  .object({
    id: IdSchema,
    slot: MealSlotSchema,
    title: text(LIMITS.title),
    note: optionalText(LIMITS.note),
  })
  .strict()
  .meta({ id: "Meal" });

export const DaySchema = z
  .object({
    agenda: z.array(AgendaItemSchema).max(LIMITS.agendaPerDay),
    workout: WorkoutSchema.nullable(),
    meals: z.array(MealSchema).max(LIMITS.mealsPerDay),
    note: optionalText(LIMITS.dayNote),
  })
  .strict()
  .meta({ id: "Day" });

export const PlanDocSchema = z
  .object({
    schemaVersion: z.literal(1),
    days: z
      .object({
        mon: DaySchema,
        tue: DaySchema,
        wed: DaySchema,
        thu: DaySchema,
        fri: DaySchema,
        sat: DaySchema,
        sun: DaySchema,
      })
      .strict(),
  })
  .strict();

export type AgendaItem = z.infer<typeof AgendaItemSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type Workout = z.infer<typeof WorkoutSchema>;
export type Meal = z.infer<typeof MealSchema>;
export type Day = z.infer<typeof DaySchema>;
export type PlanDoc = z.infer<typeof PlanDocSchema>;

export function emptyDay(): Day {
  return { agenda: [], workout: null, meals: [] };
}

export function emptyPlan(): PlanDoc {
  return {
    schemaVersion: 1,
    days: {
      mon: emptyDay(),
      tue: emptyDay(),
      wed: emptyDay(),
      thu: emptyDay(),
      fri: emptyDay(),
      sat: emptyDay(),
      sun: emptyDay(),
    },
  };
}

/**
 * Parse a stored plan. Days that fail validation are reset individually so one
 * corrupted day never takes the whole week down.
 */
export function coercePlan(input: unknown): PlanDoc {
  const strict = PlanDocSchema.safeParse(input);
  if (strict.success) return strict.data;

  const plan = emptyPlan();
  const days = (input as { days?: Record<string, unknown> } | null)?.days;
  if (!days || typeof days !== "object") return plan;
  for (const key of DAY_KEYS) {
    const parsed = DaySchema.safeParse(days[key]);
    if (parsed.success) plan.days[key] = parsed.data;
  }
  return plan;
}

const MEAL_ORDER: Record<MealSlot, number> = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 };

/** Timed items first in time order; untimed items keep their relative order at the end. */
export function sortAgenda(items: AgendaItem[]): AgendaItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ta = a.item.time;
      const tb = b.item.time;
      if (ta && tb) return ta === tb ? a.index - b.index : ta < tb ? -1 : 1;
      if (ta) return -1;
      if (tb) return 1;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

export function sortMeals(items: Meal[]): Meal[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => MEAL_ORDER[a.item.slot] - MEAL_ORDER[b.item.slot] || a.index - b.index)
    .map(({ item }) => item);
}

/** Number of things planned on a day: agenda items, exercises (a workout counts at least 1) and meals. */
export function dayLoad(day: Day): number {
  const training = day.workout ? Math.max(1, day.workout.exercises.length) : 0;
  return day.agenda.length + training + day.meals.length;
}

/** Load per day normalised to the busiest day (0..1), for the Week Pulse. */
export function weekLoads(plan: PlanDoc): Record<DayKey, { count: number; ratio: number }> {
  const counts = DAY_KEYS.map((key) => dayLoad(plan.days[key]));
  const max = Math.max(1, ...counts);
  const out = {} as Record<DayKey, { count: number; ratio: number }>;
  DAY_KEYS.forEach((key, i) => {
    const count = counts[i] ?? 0;
    out[key] = { count, ratio: count / max };
  });
  return out;
}

/** Every item id in the plan with its day and category; used for lookups and completion keys. */
export function indexPlan(plan: PlanDoc): Map<string, { day: DayKey; category: Category }> {
  const index = new Map<string, { day: DayKey; category: Category }>();
  for (const day of DAY_KEYS) {
    const d = plan.days[day];
    for (const item of d.agenda) index.set(item.id, { day, category: "agenda" });
    for (const ex of d.workout?.exercises ?? []) index.set(ex.id, { day, category: "train" });
    for (const meal of d.meals) index.set(meal.id, { day, category: "fuel" });
  }
  return index;
}

/** JSON Schema (draft 2020-12) of a plan document; the database enforces it with pg_jsonschema. */
export function planJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(PlanDocSchema, { target: "draft-2020-12" }) as Record<string, unknown>;
}
