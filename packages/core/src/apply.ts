import { newId as defaultNewId } from "./ids";
import type { Operation } from "./operations";
import {
  CATEGORIES,
  DAY_KEYS,
  LIMITS,
  sortAgenda,
  sortMeals,
  type AgendaItem,
  type Category,
  type Day,
  type DayKey,
  type Exercise,
  type Meal,
  type MealSlot,
  type PlanDoc,
} from "./plan";

export type ChangeKind = "add" | "update" | "remove" | "move";

/** One line of the Change Receipt. User content stays raw; the UI localises days, slots and kinds. */
export interface Change {
  kind: ChangeKind;
  day: DayKey;
  toDay?: DayKey;
  category: Category | "note";
  label: string;
  time?: string;
  slot?: MealSlot;
  prescription?: string;
  exerciseCount?: number;
}

export type RejectionReason = "not_found" | "limit" | "noop";

export interface Rejection {
  index: number;
  op: Operation["op"];
  reason: RejectionReason;
}

export interface ApplyResult {
  plan: PlanDoc;
  changes: Change[];
  rejected: Rejection[];
}

export interface ApplyOptions {
  newId?: () => string;
  /** Title for a workout created implicitly by `exercise.add` ("Entrenamiento" / "Workout"). */
  defaultWorkoutTitle?: string;
}

/** "5 × 5 · 80 kg", "3 × 45 s", "12" — the data line under an exercise. */
export function formatPrescription(
  ex: Pick<Exercise, "sets" | "reps" | "load">,
): string | undefined {
  const volume =
    ex.sets && ex.reps ? `${ex.sets} × ${ex.reps}` : ex.sets ? `${ex.sets} ×` : ex.reps;
  const parts = [volume, ex.load].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

function clean<T extends object>(value: T): T {
  for (const key of Object.keys(value) as (keyof T)[]) {
    if (value[key] === undefined || value[key] === null) delete value[key];
  }
  return value;
}

/**
 * Apply operations to a plan. Pure: never mutates `plan`. Operations that cannot apply
 * (unknown id, a full day) are skipped and reported in `rejected`; the rest still apply.
 */
export function applyOperations(
  plan: PlanDoc,
  operations: readonly Operation[],
  options: ApplyOptions = {},
): ApplyResult {
  const makeId = options.newId ?? defaultNewId;
  const workoutTitle = options.defaultWorkoutTitle ?? "Workout";
  const next: PlanDoc = structuredClone(plan);
  const changes: Change[] = [];
  const rejected: Rejection[] = [];
  const days = next.days;

  const findAgenda = (id: string) => {
    for (const day of DAY_KEYS) {
      const index = days[day].agenda.findIndex((item) => item.id === id);
      if (index >= 0) return { day, index };
    }
    return null;
  };
  const findExercise = (id: string) => {
    for (const day of DAY_KEYS) {
      const index = days[day].workout?.exercises.findIndex((ex) => ex.id === id) ?? -1;
      if (index >= 0) return { day, index };
    }
    return null;
  };
  const findMeal = (id: string) => {
    for (const day of DAY_KEYS) {
      const index = days[day].meals.findIndex((meal) => meal.id === id);
      if (index >= 0) return { day, index };
    }
    return null;
  };

  const agendaChange = (kind: ChangeKind, day: DayKey, item: AgendaItem, toDay?: DayKey): Change =>
    clean({ kind, day, toDay, category: "agenda" as const, label: item.title, time: item.time });
  const exerciseChange = (kind: ChangeKind, day: DayKey, ex: Exercise): Change =>
    clean({
      kind,
      day,
      category: "train" as const,
      label: ex.name,
      prescription: formatPrescription(ex),
    });
  const mealChange = (kind: ChangeKind, day: DayKey, meal: Meal, toDay?: DayKey): Change =>
    clean({ kind, day, toDay, category: "fuel" as const, label: meal.title, slot: meal.slot });

  const removeCategories = (day: DayKey, categories: readonly Category[]) => {
    const d = days[day];
    if (categories.includes("agenda")) {
      for (const item of d.agenda) changes.push(agendaChange("remove", day, item));
      d.agenda = [];
    }
    if (categories.includes("train") && d.workout) {
      changes.push({
        kind: "remove",
        day,
        category: "train",
        label: d.workout.title,
        exerciseCount: d.workout.exercises.length,
      });
      d.workout = null;
    }
    if (categories.includes("fuel")) {
      for (const meal of d.meals) changes.push(mealChange("remove", day, meal));
      d.meals = [];
    }
  };

  operations.forEach((op, index) => {
    const reject = (reason: RejectionReason) => rejected.push({ index, op: op.op, reason });

    switch (op.op) {
      case "agenda.add": {
        const d = days[op.day];
        if (d.agenda.length >= LIMITS.agendaPerDay) return reject("limit");
        const item: AgendaItem = clean({
          id: makeId(),
          title: op.title,
          time: op.time,
          endTime: op.endTime,
          note: op.note,
        });
        d.agenda.push(item);
        changes.push(agendaChange("add", op.day, item));
        return;
      }
      case "agenda.update": {
        const found = findAgenda(op.id);
        if (!found) return reject("not_found");
        const source = days[found.day];
        const item = { ...source.agenda[found.index]! };
        if (op.title !== undefined) item.title = op.title;
        if (op.time !== undefined) item.time = op.time ?? undefined;
        if (op.endTime !== undefined) item.endTime = op.endTime ?? undefined;
        if (op.note !== undefined) item.note = op.note ?? undefined;
        clean(item);
        const target = op.day ?? found.day;
        if (target !== found.day) {
          if (days[target].agenda.length >= LIMITS.agendaPerDay) return reject("limit");
          source.agenda.splice(found.index, 1);
          days[target].agenda.push(item);
          changes.push(agendaChange("move", found.day, item, target));
        } else {
          source.agenda[found.index] = item;
          changes.push(agendaChange("update", found.day, item));
        }
        return;
      }
      case "agenda.remove": {
        const found = findAgenda(op.id);
        if (!found) return reject("not_found");
        const [item] = days[found.day].agenda.splice(found.index, 1);
        changes.push(agendaChange("remove", found.day, item!));
        return;
      }
      case "workout.set": {
        const d = days[op.day];
        const existed = d.workout !== null;
        d.workout = clean({
          title: op.title,
          note: op.note,
          exercises: op.exercises.map((ex) =>
            clean({
              id: makeId(),
              name: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              load: ex.load,
              note: ex.note,
            }),
          ),
        });
        changes.push({
          kind: existed ? "update" : "add",
          day: op.day,
          category: "train",
          label: op.title,
          exerciseCount: op.exercises.length,
        });
        return;
      }
      case "workout.update": {
        const workout = days[op.day].workout;
        if (!workout) return reject("not_found");
        if (op.title !== undefined) workout.title = op.title;
        if (op.note !== undefined) workout.note = op.note ?? undefined;
        clean(workout);
        changes.push({
          kind: "update",
          day: op.day,
          category: "train",
          label: workout.title,
          exerciseCount: workout.exercises.length,
        });
        return;
      }
      case "workout.clear": {
        if (!days[op.day].workout) return reject("noop");
        removeCategories(op.day, ["train"]);
        return;
      }
      case "exercise.add": {
        const d = days[op.day];
        if (!d.workout) d.workout = { title: op.workoutTitle ?? workoutTitle, exercises: [] };
        if (d.workout.exercises.length >= LIMITS.exercisesPerWorkout) return reject("limit");
        const ex: Exercise = clean({
          id: makeId(),
          name: op.name,
          sets: op.sets,
          reps: op.reps,
          load: op.load,
          note: op.note,
        });
        d.workout.exercises.push(ex);
        changes.push(exerciseChange("add", op.day, ex));
        return;
      }
      case "exercise.update": {
        const found = findExercise(op.id);
        if (!found) return reject("not_found");
        const workout = days[found.day].workout!;
        const ex = { ...workout.exercises[found.index]! };
        if (op.name !== undefined) ex.name = op.name;
        if (op.sets !== undefined) ex.sets = op.sets ?? undefined;
        if (op.reps !== undefined) ex.reps = op.reps ?? undefined;
        if (op.load !== undefined) ex.load = op.load ?? undefined;
        if (op.note !== undefined) ex.note = op.note ?? undefined;
        workout.exercises[found.index] = clean(ex);
        changes.push(exerciseChange("update", found.day, ex));
        return;
      }
      case "exercise.remove": {
        const found = findExercise(op.id);
        if (!found) return reject("not_found");
        const [ex] = days[found.day].workout!.exercises.splice(found.index, 1);
        changes.push(exerciseChange("remove", found.day, ex!));
        return;
      }
      case "meal.set": {
        const d = days[op.day];
        const existing = op.slot === "snack" ? -1 : d.meals.findIndex((m) => m.slot === op.slot);
        if (existing >= 0) {
          const meal = clean({ ...d.meals[existing]!, title: op.title, note: op.note });
          d.meals[existing] = meal;
          changes.push(mealChange("update", op.day, meal));
          return;
        }
        if (d.meals.length >= LIMITS.mealsPerDay) return reject("limit");
        const meal: Meal = clean({ id: makeId(), slot: op.slot, title: op.title, note: op.note });
        d.meals.push(meal);
        changes.push(mealChange("add", op.day, meal));
        return;
      }
      case "meal.update": {
        const found = findMeal(op.id);
        if (!found) return reject("not_found");
        const source = days[found.day];
        const meal = { ...source.meals[found.index]! };
        if (op.title !== undefined) meal.title = op.title;
        if (op.slot !== undefined) meal.slot = op.slot;
        if (op.note !== undefined) meal.note = op.note ?? undefined;
        clean(meal);
        const target = op.day ?? found.day;
        if (target !== found.day) {
          if (days[target].meals.length >= LIMITS.mealsPerDay) return reject("limit");
          source.meals.splice(found.index, 1);
          days[target].meals.push(meal);
          changes.push(mealChange("move", found.day, meal, target));
        } else {
          source.meals[found.index] = meal;
          changes.push(mealChange("update", found.day, meal));
        }
        return;
      }
      case "meal.remove": {
        const found = findMeal(op.id);
        if (!found) return reject("not_found");
        const [meal] = days[found.day].meals.splice(found.index, 1);
        changes.push(mealChange("remove", found.day, meal!));
        return;
      }
      case "day.clear": {
        const categories = op.categories ?? CATEGORIES;
        const before = changes.length;
        removeCategories(op.day, categories);
        if (changes.length === before) reject("noop");
        return;
      }
      case "day.copy": {
        const categories = op.categories ?? CATEGORIES;
        const from: Day = structuredClone(days[op.from]);
        for (const target of op.to) {
          if (target === op.from) continue;
          removeCategories(target, categories);
          const d = days[target];
          if (categories.includes("agenda")) {
            d.agenda = from.agenda.map((item) => ({ ...item, id: makeId() }));
            for (const item of d.agenda) changes.push(agendaChange("add", target, item));
          }
          if (categories.includes("train") && from.workout) {
            d.workout = {
              ...from.workout,
              exercises: from.workout.exercises.map((ex) => ({ ...ex, id: makeId() })),
            };
            changes.push({
              kind: "add",
              day: target,
              category: "train",
              label: from.workout.title,
              exerciseCount: from.workout.exercises.length,
            });
          }
          if (categories.includes("fuel")) {
            d.meals = from.meals.map((meal) => ({ ...meal, id: makeId() }));
            for (const meal of d.meals) changes.push(mealChange("add", target, meal));
          }
        }
        return;
      }
      case "day.note": {
        const d = days[op.day];
        const before = d.note;
        if (op.note) d.note = op.note;
        else delete d.note;
        if (before === d.note) return reject("noop");
        changes.push({
          kind: op.note ? (before ? "update" : "add") : "remove",
          day: op.day,
          category: "note",
          label: op.note ?? before ?? "",
        });
        return;
      }
    }
  });

  for (const day of DAY_KEYS) {
    days[day].agenda = sortAgenda(days[day].agenda);
    days[day].meals = sortMeals(days[day].meals);
  }

  return { plan: next, changes, rejected };
}
