import { z } from "zod";
import { isMoveSlug } from "./moves";
import {
  CategorySchema,
  DayKeySchema,
  LIMITS,
  MealSlotSchema,
  MoveSlugSchema,
  TimeSchema,
} from "./plan";

/**
 * Operations are the only way the plan changes. The assistant proposes them as JSON,
 * the UI sends them for manual edits, and `applyOperations` applies them.
 *
 * Schemas here are deliberately forgiving about *shape* (nulls, "8:00", "4" for sets)
 * because a language model writes them, and strict about *meaning* (days, slots, limits).
 */

const blankToUndefined = (value: unknown) =>
  value === null || (typeof value === "string" && value.trim() === "") ? undefined : value;

/** Accepts "8:00", "08:00", "8.00" and "8h" and normalises to "08:00". */
const looseTime = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const m = /^\s*(\d{1,2})(?:[:.h](\d{2}))?\s*h?\s*$/i.exec(value);
  if (!m) return value;
  const hh = m[1]!.padStart(2, "0");
  const mm = m[2] ?? "00";
  return `${hh}:${mm}`;
}, TimeSchema);

const looseInt = z.preprocess(
  (value) => (typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value),
  z.number().int().min(1).max(99),
);

const id = z.string().min(1).max(64);
const title = (max: number) => z.string().trim().min(1).max(max);

/**
 * A move slug from the library. Unknown slugs are dropped rather than rejected: a wrong
 * illustration guess must never cost the user their exercise. Null still clears on update.
 */
const looseMove = z.preprocess(
  (value) => (value === null || isMoveSlug(value) ? value : undefined),
  MoveSlugSchema.nullable().optional(),
);

/** Optional on create: null and "" mean "not given". */
const opt = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(blankToUndefined, schema.optional());
/** On update: undefined keeps the value, null clears it. */
const clearable = <T extends z.ZodTypeAny>(schema: T) => schema.nullable().optional();

const ExerciseInputSchema = z.object({
  name: title(LIMITS.exerciseName),
  sets: opt(looseInt),
  reps: opt(z.coerce.string().trim().max(LIMITS.reps)),
  load: opt(z.string().trim().max(LIMITS.load)),
  note: opt(z.string().trim().max(LIMITS.note)),
  move: opt(looseMove),
});

export const OperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("agenda.add"),
    day: DayKeySchema,
    title: title(LIMITS.title),
    time: opt(looseTime),
    endTime: opt(looseTime),
    note: opt(z.string().trim().max(LIMITS.note)),
  }),
  z.object({
    op: z.literal("agenda.update"),
    id,
    day: opt(DayKeySchema),
    title: opt(title(LIMITS.title)),
    time: clearable(looseTime),
    endTime: clearable(looseTime),
    note: clearable(z.string().trim().max(LIMITS.note)),
  }),
  z.object({ op: z.literal("agenda.remove"), id }),
  z.object({
    op: z.literal("workout.set"),
    day: DayKeySchema,
    title: title(LIMITS.workoutTitle),
    time: opt(looseTime),
    exercises: z.array(ExerciseInputSchema).max(LIMITS.exercisesPerWorkout),
    note: opt(z.string().trim().max(LIMITS.note)),
  }),
  z.object({
    op: z.literal("workout.update"),
    day: DayKeySchema,
    title: opt(title(LIMITS.workoutTitle)),
    time: clearable(looseTime),
    note: clearable(z.string().trim().max(LIMITS.note)),
  }),
  z.object({ op: z.literal("workout.clear"), day: DayKeySchema }),
  z.object({
    op: z.literal("exercise.add"),
    day: DayKeySchema,
    name: title(LIMITS.exerciseName),
    sets: opt(looseInt),
    reps: opt(z.coerce.string().trim().max(LIMITS.reps)),
    load: opt(z.string().trim().max(LIMITS.load)),
    note: opt(z.string().trim().max(LIMITS.note)),
    move: opt(looseMove),
    workoutTitle: opt(title(LIMITS.workoutTitle)),
  }),
  z.object({
    op: z.literal("exercise.update"),
    id,
    name: opt(title(LIMITS.exerciseName)),
    sets: clearable(looseInt),
    reps: clearable(z.coerce.string().trim().max(LIMITS.reps)),
    load: clearable(z.string().trim().max(LIMITS.load)),
    note: clearable(z.string().trim().max(LIMITS.note)),
    move: looseMove,
  }),
  z.object({ op: z.literal("exercise.remove"), id }),
  z.object({
    op: z.literal("meal.set"),
    day: DayKeySchema,
    slot: MealSlotSchema,
    title: title(LIMITS.title),
    note: opt(z.string().trim().max(LIMITS.note)),
  }),
  z.object({
    op: z.literal("meal.update"),
    id,
    day: opt(DayKeySchema),
    slot: opt(MealSlotSchema),
    title: opt(title(LIMITS.title)),
    note: clearable(z.string().trim().max(LIMITS.note)),
  }),
  z.object({ op: z.literal("meal.remove"), id }),
  z.object({
    op: z.literal("day.clear"),
    day: DayKeySchema,
    categories: opt(z.array(CategorySchema).min(1)),
  }),
  z.object({
    op: z.literal("day.copy"),
    from: DayKeySchema,
    to: z.array(DayKeySchema).min(1).max(7),
    categories: opt(z.array(CategorySchema).min(1)),
  }),
  z.object({
    op: z.literal("day.note"),
    day: DayKeySchema,
    note: z.string().trim().max(LIMITS.dayNote).nullable(),
  }),
]);

export type Operation = z.infer<typeof OperationSchema>;
export type OperationInput = z.input<typeof OperationSchema>;
export type OperationName = Operation["op"];

export const MAX_OPERATIONS = 60;
export const OperationsSchema = z.array(OperationSchema).max(MAX_OPERATIONS);

/** What the assistant must return. */
export const AssistantOutputSchema = z.object({
  operations: OperationsSchema,
  reply: z.string().trim().max(400),
});
export type AssistantOutput = z.infer<typeof AssistantOutputSchema>;
