import { compact, sequentialIds, type Change, type Doc, type Json } from "@tukkteam/modules";
import { describe, expect, it } from "vitest";
import { kernel } from "../index";
import { read, week } from "../test-kit";
import { applyOperations, type Change as ChangeV1 } from "./oracle/apply";
import { OperationSchema, type Operation as OperationV1 } from "./oracle/operations";
import { DAY_KEYS, MEAL_SLOTS, PlanDocSchema, emptyPlan, type PlanDoc } from "./plan-v1";

/**
 * Parity with plan version 1. The old reducer is the oracle: random sequences of version 1
 * operations are applied there and, under their old names, through the modules. Both must end
 * with the same data and the same receipt. This is what makes the move to modules safe for the
 * plans people already have.
 */

/** A small seeded generator, so a failure can be reproduced from its seed. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TITLES = ["Yoga", "Pádel", "Trabajo", "Dentista", "Leer", "Inglés", "Compra", "Paseo"];
const DISHES = ["Lentejas", "Wok de pollo", "Pasta", "Salmón", "Tortilla", "Sushi", "lentejas"];
const EXERCISES = ["Sentadilla", "Press banca", "Remo con barra", "Plancha", "Correr 5 km"];
const MOVES = ["squat", "bench-press", "barbell-row", "plank", "made-up-move", undefined];
const TIMES = ["07:30", "8", "8h", "19.00", "13:30", "22:00", "25:00", "", null, undefined];
const NOTES = ["Remoto", "", null, undefined, "Con Marta"];
const CATEGORIES = ["agenda", "train", "fuel"];

function generator(rand: () => number) {
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;
  const maybe = <T>(value: T): T | undefined => (rand() < 0.5 ? value : undefined);
  const day = () => pick(DAY_KEYS);
  const some = <T>(list: readonly T[]) => list.filter(() => rand() < 0.5);

  const exercise = () => ({
    name: pick(EXERCISES),
    sets: pick([3, "4", 5, null, undefined]),
    reps: pick(["8", 10, "45 s", "8-10", undefined]),
    load: pick(["80 kg", "", undefined]),
    note: pick(NOTES),
    move: pick(MOVES),
  });

  /** An operation as a model might write it, aimed at things the plan holds when possible. */
  return (plan: PlanDoc): Record<string, unknown> => {
    const agendaIds = DAY_KEYS.flatMap((d) => plan.days[d].agenda.map((item) => item.id));
    const exerciseIds = DAY_KEYS.flatMap(
      (d) => plan.days[d].workout?.exercises.map((ex) => ex.id) ?? [],
    );
    const mealIds = DAY_KEYS.flatMap((d) => plan.days[d].meals.map((meal) => meal.id));
    const existing = (ids: string[]) => (ids.length && rand() < 0.85 ? pick(ids) : "missing");

    const kinds: (() => Record<string, unknown>)[] = [
      () => ({
        op: "agenda.add",
        day: day(),
        title: pick(TITLES),
        time: pick(TIMES),
        endTime: pick(TIMES),
        note: pick(NOTES),
      }),
      () => ({
        op: "agenda.update",
        id: existing(agendaIds),
        title: maybe(pick(TITLES)),
        time: pick(TIMES.filter((time) => time !== "")),
        endTime: pick([null, undefined, "20:00"]),
        note: pick([null, undefined, "Nota"]),
        day: maybe(day()),
      }),
      () => ({ op: "agenda.remove", id: existing(agendaIds) }),
      () => ({
        op: "workout.set",
        day: day(),
        title: pick(["Pierna", "Empuje", "Espalda"]),
        time: pick(TIMES),
        note: pick(NOTES),
        exercises: Array.from({ length: Math.floor(rand() * 4) }, exercise),
      }),
      () => ({
        op: "workout.update",
        day: day(),
        title: maybe("Pierna y core"),
        time: pick([null, undefined, "18:30", "7"]),
        note: pick([null, undefined, "Suave"]),
      }),
      () => ({ op: "workout.clear", day: day() }),
      () => ({ op: "exercise.add", day: day(), ...exercise(), workoutTitle: maybe("Extra") }),
      () => ({
        op: "exercise.update",
        id: existing(exerciseIds),
        name: maybe(pick(EXERCISES)),
        sets: pick([null, undefined, 4, "6"]),
        reps: pick([null, undefined, "12", 15]),
        load: pick([null, undefined, "60 kg"]),
        note: pick([null, undefined, "Lento"]),
        move: pick([...MOVES, null]),
      }),
      () => ({ op: "exercise.remove", id: existing(exerciseIds) }),
      () => ({
        op: "meal.set",
        day: day(),
        slot: pick([...MEAL_SLOTS, "brunch"]),
        title: pick(DISHES),
        note: pick(NOTES),
      }),
      () => ({
        op: "meal.update",
        id: existing(mealIds),
        day: maybe(day()),
        slot: maybe(pick(MEAL_SLOTS)),
        title: maybe(pick(DISHES)),
        note: pick([null, undefined, "Doble"]),
      }),
      () => ({ op: "meal.remove", id: existing(mealIds) }),
      () => ({
        op: "menu.set",
        slot: pick(MEAL_SLOTS),
        options: some(DISHES).map((title) => (rand() < 0.3 ? { title, note: "casero" } : title)),
        days: maybe(some(DAY_KEYS)),
      }),
      () => ({ op: "menu.clear", slot: pick(MEAL_SLOTS) }),
      () => ({ op: "meal.options", day: day(), slot: pick(MEAL_SLOTS), options: some(DISHES) }),
      () => ({ op: "day.clear", day: day(), categories: maybe(some(CATEGORIES)) }),
      () => ({
        op: "day.copy",
        from: day(),
        to: some(DAY_KEYS),
        categories: maybe(some(CATEGORIES)),
      }),
      () => ({ op: "day.note", day: day(), note: pick(["Descanso", "Viaje", "", null]) }),
    ];
    return pick(kinds)();
  };
}

/** A version 1 receipt line in the shape modules report. */
function toChange(change: ChangeV1): Change {
  const owner = change.category === "note" ? "notes" : change.category;
  const data: Record<string, Json> | undefined =
    change.category === "agenda"
      ? change.time
        ? { time: change.time }
        : undefined
      : change.category === "train"
        ? change.exerciseCount !== undefined
          ? { exerciseCount: change.exerciseCount }
          : change.prescription
            ? { prescription: change.prescription }
            : undefined
        : change.slot
          ? { slot: change.slot }
          : undefined;
  return compact({
    kind: change.kind,
    module: owner,
    day: change.day,
    toDay: change.toDay,
    scope: change.scope,
    label: change.label,
    data,
  });
}

const NAMES: Record<string, string> = {
  "workout.set": "train.workout.set",
  "workout.update": "train.workout.update",
  "workout.clear": "train.workout.clear",
  "exercise.add": "train.exercise.add",
  "exercise.update": "train.exercise.update",
  "exercise.remove": "train.exercise.remove",
  "meal.set": "fuel.meal.set",
  "meal.update": "fuel.meal.update",
  "meal.remove": "fuel.meal.remove",
  "menu.set": "fuel.menu.set",
  "menu.clear": "fuel.menu.clear",
  "meal.options": "fuel.options.set",
  "day.note": "notes.set",
};

const sorted = (changes: Change[]) =>
  changes.map((change) => JSON.stringify(change, Object.keys(change).sort())).sort();

function compare(seed: number, rounds: number, perRound: number) {
  const rand = mulberry32(seed);
  const next = generator(rand);
  let plan: PlanDoc = emptyPlan();
  let doc: Doc = week();
  let compared = 0;

  for (let round = 0; round < rounds; round += 1) {
    const raw: Record<string, unknown>[] = [];
    const parsed: OperationV1[] = [];
    for (let i = 0; i < perRound; i += 1) {
      const candidate = next(plan);
      const before = OperationSchema.safeParse(candidate);
      const after = kernel.parse([candidate]);
      // What version 1 accepted, the modules accept, and the other way round.
      expect(after.dropped === 0, `seed ${seed}: ${JSON.stringify(candidate)}`).toBe(
        before.success,
      );
      if (!before.success) continue;
      raw.push(candidate);
      parsed.push(before.data);
    }

    const prefix = `r${round}-`;
    const oracle = applyOperations(plan, parsed, {
      newId: sequentialIds(prefix),
      defaultWorkoutTitle: "Entrenamiento",
    });
    const modules = kernel.apply(doc, raw as never, { newId: sequentialIds(prefix), lang: "es" });
    const at = `seed ${seed}, round ${round}`;

    expect(PlanDocSchema.safeParse(oracle.plan).success, at).toBe(true);
    expect(read(modules.doc), at).toEqual(read(kernel.read(structuredClone(oracle.plan))));
    // Same lines in the receipt. Their order may differ in one place: version 1 listed a day's
    // meal options in the order they were stored, modules list them in the order of the day.
    expect(sorted(modules.changes), at).toEqual(sorted(oracle.changes.map(toChange)));
    // The one intended difference: copying a day that changes nothing is now reported as such.
    const rejected = modules.rejected.filter(
      (rejection) => !(rejection.op === "day.copy" && rejection.reason === "noop"),
    );
    expect(rejected, at).toEqual(
      oracle.rejected.map((rejection) => ({
        ...rejection,
        op: NAMES[rejection.op] ?? rejection.op,
      })),
    );
    expect([...kernel.unreadable(modules.doc)], at).toEqual([]);

    plan = oracle.plan;
    doc = modules.doc;
    compared += parsed.length;
  }
  return compared;
}

describe("parity with plan version 1", () => {
  it("ends with the same plan and the same receipt for random sequences of operations", () => {
    let compared = 0;
    for (let seed = 1; seed <= 250; seed += 1) compared += compare(seed, 4, 14);
    // Most generated operations are valid; make sure the comparison actually ran on plenty.
    expect(compared).toBeGreaterThan(8000);
  });

  it("holds when lists fill up to their limits", () => {
    const many = Array.from({ length: 45 }, (_, i) => ({
      op: "agenda.add",
      day: "mon",
      title: `Cosa ${i}`,
    }));
    const snacks = Array.from({ length: 14 }, (_, i) => ({
      op: "meal.set",
      day: "mon",
      slot: "snack",
      title: `Picoteo ${i}`,
    }));
    const exercises = Array.from({ length: 32 }, (_, i) => ({
      op: "exercise.add",
      day: "mon",
      name: `Ejercicio ${i}`,
    }));
    const raw = [...many, ...snacks, ...exercises, { op: "agenda.update", id: "t1", day: "mon" }];
    const parsed = raw.map((op) => OperationSchema.parse(op));
    const oracle = applyOperations(emptyPlan(), parsed, { newId: sequentialIds("t") });
    const modules = kernel.apply(week(), raw, { newId: sequentialIds("t"), lang: "en" });
    expect(read(modules.doc)).toEqual(read(kernel.read(oracle.plan)));
    expect(modules.rejected.map((r) => [r.index, r.reason])).toEqual(
      oracle.rejected.map((r) => [r.index, r.reason]),
    );
    expect(modules.rejected.length).toBeGreaterThan(8);
  });
});
