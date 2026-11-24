import {
  clearable,
  compact,
  itemId,
  looseInt,
  opt,
  optionalText,
  parts,
  text,
  type ChangeDraft,
  type ChangeKind,
} from "@tukkteam/modules";
import {
  DAY_KEYS,
  DayKeySchema,
  MINUTES_PER_DAY,
  TimeSchema,
  dayRecord,
  defineWeekModule,
  eachDay,
  looseTime,
  toMinutes,
  type DayKey,
} from "@tukkteam/modules/week";
import { z } from "zod";
import { messages, type TrainMessages } from "./messages";
import {
  DEFAULT_SETS,
  MOVES,
  MUSCLE_GROUPS,
  isMoveSlug,
  resolveMove,
  type MuscleGroup,
} from "./moves";

export const TRAIN_LIMITS = {
  title: 80,
  exerciseName: 100,
  reps: 20,
  load: 20,
  note: 280,
  exercises: 30,
} as const;

/** Slug of an illustrated move in the move library (see moves.ts), e.g. "bench-press". */
export const MoveSlugSchema = z
  .string()
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Expected a move slug");

export const ExerciseSchema = z
  .object({
    id: itemId,
    name: text(TRAIN_LIMITS.exerciseName),
    sets: z.number().int().min(1).max(99).optional(),
    reps: optionalText(TRAIN_LIMITS.reps),
    load: optionalText(TRAIN_LIMITS.load),
    note: optionalText(TRAIN_LIMITS.note),
    /** The illustration and muscle data to show; matched from the name when missing. */
    move: MoveSlugSchema.optional(),
  })
  .strict();

export const WorkoutSchema = z
  .object({
    title: text(TRAIN_LIMITS.title),
    /** Optional start time; places the session on the day timeline. */
    time: TimeSchema.optional(),
    exercises: z.array(ExerciseSchema).max(TRAIN_LIMITS.exercises),
    note: optionalText(TRAIN_LIMITS.note),
  })
  .strict();

/** At most one workout per day. */
export const TrainSchema = z.object({ days: dayRecord(WorkoutSchema.nullable()) }).strict();

export type Exercise = z.infer<typeof ExerciseSchema>;
export type Workout = z.infer<typeof WorkoutSchema>;
export type Train = z.infer<typeof TrainSchema>;

/** The key under which a finished session is recorded for a date. */
export const WORKOUT_DONE = "workout";

/** "5 × 5 · 80 kg", "3 × 45 s", "12" — the data line under an exercise. */
export function formatPrescription(
  ex: Pick<Exercise, "sets" | "reps" | "load">,
): string | undefined {
  const volume =
    ex.sets && ex.reps ? `${ex.sets} × ${ex.reps}` : ex.sets ? `${ex.sets} ×` : ex.reps;
  const list = [volume, ex.load].filter(Boolean);
  return list.length ? list.join(" · ") : undefined;
}

/** "30 min", "45 s", "1 h", "20'" → minutes; undefined for rep counts like "8-10". */
export function durationMinutes(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const m =
    /^\s*(\d+(?:[.,]\d+)?)\s*(?:-\s*\d+(?:[.,]\d+)?\s*)?(h|hr|hrs|hora|horas|min|mins|minutos?|'|s|sec|secs|seg|segundos?|")\s*$/i.exec(
      value,
    );
  if (!m) return undefined;
  const amount = Number(m[1]!.replace(",", "."));
  const unit = m[2]!.toLowerCase();
  if (unit.startsWith("h")) return amount * 60;
  if (unit === "s" || unit === '"' || unit.startsWith("se")) return amount / 60;
  return amount;
}

/** Estimated session length: ~2.5 minutes per set plus a warm-up, between 20 and 120 minutes. */
export function workoutMinutes(workout: Pick<Workout, "exercises">): number {
  let minutes = 10;
  for (const exercise of workout.exercises) {
    const timed = durationMinutes(exercise.reps);
    const sets = exercise.sets ?? (timed ? 1 : DEFAULT_SETS);
    const stretch = resolveMove(exercise)?.stretch ?? false;
    minutes += timed ? timed * sets + (sets - 1) : sets * (stretch ? 1 : 2.5);
  }
  return Math.min(120, Math.max(20, Math.round(minutes / 5) * 5));
}

/**
 * The move library as the model sees it: slugs grouped by what they train. Built once; about
 * 1,500 tokens. The model links each exercise to a slug, so no image is ever generated.
 */
export const MOVE_CATALOGUE: string = (() => {
  const groups = new Map<string, string[]>();
  for (const move of MOVES) {
    const group: MuscleGroup = move.stretch
      ? "mobility"
      : move.equipment === "cardio"
        ? "cardio"
        : move.primary[0]!;
    groups.set(group, [...(groups.get(group) ?? []), move.slug]);
  }
  return MUSCLE_GROUPS.filter((group) => groups.has(group))
    .map((group) => `${group}: ${groups.get(group)!.join(", ")}`)
    .join("\n");
})();

function findExercise(state: Train, id: string): { day: DayKey; index: number } | null {
  for (const day of DAY_KEYS) {
    const index = state.days[day]?.exercises.findIndex((ex) => ex.id === id) ?? -1;
    if (index >= 0) return { day, index };
  }
  return null;
}

const exerciseLine = (kind: ChangeKind, day: DayKey, ex: Exercise): ChangeDraft => {
  const prescription = formatPrescription(ex);
  return compact({ kind, day, label: ex.name, data: prescription ? { prescription } : undefined });
};

const workoutLine = (kind: ChangeKind, day: DayKey, workout: Workout): ChangeDraft => ({
  kind,
  day,
  label: workout.title,
  data: { exerciseCount: workout.exercises.length },
});

const sets = looseInt(1, 99);
const reps = z.coerce.string().trim().max(TRAIN_LIMITS.reps);
const load = z.string().trim().max(TRAIN_LIMITS.load);
const note = z.string().trim().max(TRAIN_LIMITS.note);

/**
 * A move slug from the library. Unknown slugs are dropped rather than rejected: a wrong
 * illustration guess must never cost the person their exercise. Null still clears on update.
 */
const looseMove = z.preprocess(
  (value) => (value === null || isMoveSlug(value) ? value : undefined),
  MoveSlugSchema.nullable().optional(),
);

const ExerciseInput = z.object({
  name: text(TRAIN_LIMITS.exerciseName),
  sets: opt(sets),
  reps: opt(reps),
  load: opt(load),
  note: opt(note),
  move: opt(looseMove),
});

const { operation } = parts<Train, TrainMessages>();

/** Training: one workout per day, made of exercises linked to the illustrated move library. */
export const train = defineWeekModule<Train, TrainMessages>({
  id: "train",
  version: 1,
  author: "PowerWeek",
  tone: "volt",
  icon: "dumbbell",
  messages,
  schema: TrainSchema,
  empty: () => ({ days: eachDay(() => null) }),

  operations: {
    "workout.set": operation({
      input: z.object({
        day: DayKeySchema,
        title: text(TRAIN_LIMITS.title),
        time: opt(looseTime),
        exercises: z.array(ExerciseInput).max(TRAIN_LIMITS.exercises),
        note: opt(note),
      }),
      examples: [
        {
          fields: {
            day: "mon",
            title: "Leg day",
            time: "19:00",
            exercises: [{ name: "Back squat", sets: 5, reps: "5", load: "80 kg", move: "squat" }],
          },
          hint: "creates or replaces the whole workout of that day; time is optional",
        },
      ],
      apply(state, input, ctx) {
        const existed = state.days[input.day] !== null;
        const workout: Workout = compact({
          title: input.title,
          time: input.time,
          note: input.note,
          exercises: input.exercises.map((ex) =>
            compact({
              id: ctx.newId(),
              name: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              load: ex.load,
              note: ex.note,
              move: ex.move ?? undefined,
            }),
          ),
        });
        state.days[input.day] = workout;
        ctx.change(workoutLine(existed ? "update" : "add", input.day, workout));
      },
    }),

    "workout.update": operation({
      input: z.object({
        day: DayKeySchema,
        title: opt(text(TRAIN_LIMITS.title)),
        time: clearable(looseTime),
        note: clearable(note),
      }),
      examples: [
        {
          fields: { day: "mon", title: "Legs and core", time: "18:30" },
          hint: "null clears time or note",
        },
      ],
      apply(state, input, ctx) {
        const workout = state.days[input.day];
        if (!workout) return "not_found";
        if (input.title !== undefined) workout.title = input.title;
        if (input.time !== undefined) workout.time = input.time ?? undefined;
        if (input.note !== undefined) workout.note = input.note ?? undefined;
        compact(workout);
        ctx.change(workoutLine("update", input.day, workout));
      },
    }),

    "workout.clear": operation({
      input: z.object({ day: DayKeySchema }),
      examples: [{ fields: { day: "mon" } }],
      apply(state, input, ctx) {
        const workout = state.days[input.day];
        if (!workout) return "noop";
        ctx.change(workoutLine("remove", input.day, workout));
        state.days[input.day] = null;
      },
    }),

    "exercise.add": operation({
      input: ExerciseInput.extend({
        day: DayKeySchema,
        workoutTitle: opt(text(TRAIN_LIMITS.title)),
      }),
      examples: [
        {
          fields: {
            day: "wed",
            name: "Bench press",
            sets: 4,
            reps: "8",
            load: "60 kg",
            move: "bench-press",
          },
          hint: "adds to the day's workout (creates one if missing)",
        },
      ],
      apply(state, input, ctx) {
        const workout = (state.days[input.day] ??= {
          title: input.workoutTitle ?? ctx.t.defaultTitle,
          exercises: [],
        });
        if (workout.exercises.length >= TRAIN_LIMITS.exercises) return "limit";
        const ex: Exercise = compact({
          id: ctx.newId(),
          name: input.name,
          sets: input.sets,
          reps: input.reps,
          load: input.load,
          note: input.note,
          move: input.move ?? undefined,
        });
        workout.exercises.push(ex);
        ctx.change(exerciseLine("add", input.day, ex));
      },
    }),

    "exercise.update": operation({
      input: z.object({
        id: itemId,
        name: opt(text(TRAIN_LIMITS.exerciseName)),
        sets: clearable(sets),
        reps: clearable(reps),
        load: clearable(load),
        note: clearable(note),
        move: looseMove,
      }),
      examples: [
        {
          fields: { id: "<exercise id>", sets: 3, reps: "10" },
          hint: 'a new name for a different movement also needs its new "move"',
        },
      ],
      apply(state, input, ctx) {
        const found = findExercise(state, input.id);
        if (!found) return "not_found";
        const workout = state.days[found.day]!;
        const ex = { ...workout.exercises[found.index]! };
        if (input.name !== undefined) {
          // A new name may be a different movement: drop a move the operation does not restate.
          if (input.name !== ex.name && input.move === undefined) delete ex.move;
          ex.name = input.name;
        }
        if (input.move !== undefined) ex.move = input.move ?? undefined;
        if (input.sets !== undefined) ex.sets = input.sets ?? undefined;
        if (input.reps !== undefined) ex.reps = input.reps ?? undefined;
        if (input.load !== undefined) ex.load = input.load ?? undefined;
        if (input.note !== undefined) ex.note = input.note ?? undefined;
        workout.exercises[found.index] = compact(ex);
        ctx.change(exerciseLine("update", found.day, ex));
      },
    }),

    "exercise.remove": operation({
      input: z.object({ id: itemId }),
      examples: [{ fields: { id: "<exercise id>" } }],
      apply(state, input, ctx) {
        const found = findExercise(state, input.id);
        if (!found) return "not_found";
        const [ex] = state.days[found.day]!.exercises.splice(found.index, 1);
        ctx.change(exerciseLine("remove", found.day, ex!));
      },
    }),
  },

  describe(change, t) {
    const count = change.data?.exerciseCount;
    if (typeof count === "number") return `${change.label} · ${t.exercises(count)}`;
    return [change.label, change.data?.prescription].filter(Boolean).join(" · ");
  },

  assistant: {
    about:
      'workouts. Per day, null or one workout { title, time, exercises: [{ id, name, sets, reps, load, note, move }] }. At most one workout per day; "time" is its optional start.',
    rules: [
      'Exercises: "4x8", "4 × 8" or "four by eight" means sets 4 and reps "8". Keep reps as text ("8-10", "45 s") and keep units in load ("80 kg").',
      'A full routine for a day ("on Monday I do legs: squat 5x5 and lunges 3x10") is one train.workout.set. Adding single exercises to an existing workout is train.exercise.add. A time for the session ("legs at 7 pm") is the workout "time", not an agenda item.',
      'Give every exercise a "move": the slug from the move library below that shows the same movement, preferring the variant with the same equipment (barbell, dumbbell, cable, machine, band, bodyweight). Use only slugs from the list. Leave "move" out when nothing is close (sports, classes, chores).',
    ],
    reference: () => `Move library, grouped by what each move trains:\n${MOVE_CATALOGUE}`,
    view: (state) =>
      Object.fromEntries(
        DAY_KEYS.filter((day) => state.days[day] !== null).map((day) => [day, state.days[day]]),
      ),
  },

  week: {
    load(state, day) {
      const workout = state.days[day];
      return workout ? Math.max(1, workout.exercises.length) : 0;
    },
    summary(state, day, t) {
      if (day) {
        const workout = state.days[day];
        return workout ? t.exercises(workout.exercises.length) : null;
      }
      const workouts = DAY_KEYS.map((key) => state.days[key]).filter((w) => w !== null);
      if (workouts.length === 0) return null;
      const total = workouts.reduce((sum, workout) => sum + workout.exercises.length, 0);
      return `${t.workouts(workouts.length)} · ${t.exercises(total)}`;
    },
    timeline(state, day) {
      const workout = state.days[day];
      if (!workout?.time) return {};
      const start = toMinutes(workout.time);
      return {
        spans: [
          {
            id: WORKOUT_DONE,
            title: workout.title,
            start,
            end: Math.min(MINUTES_PER_DAY, start + workoutMinutes(workout)),
            open: true,
            icon: true,
          },
        ],
      };
    },
    clearDay(state, day, ctx) {
      const workout = state.days[day];
      if (!workout) return;
      ctx.change(workoutLine("remove", day, workout));
      state.days[day] = null;
    },
    copyDay(state, from, to, ctx) {
      const source = state.days[from];
      if (!source) return;
      const copy: Workout = {
        ...structuredClone(source),
        exercises: source.exercises.map((ex) => ({ ...ex, id: ctx.newId() })),
      };
      state.days[to] = copy;
      ctx.change(workoutLine("add", to, copy));
    },
  },
});
