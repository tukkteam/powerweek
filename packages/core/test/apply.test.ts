import { describe, expect, it } from "vitest";
import {
  applyOperations,
  emptyPlan,
  formatPrescription,
  OperationSchema,
  sequentialIds,
  type Operation,
  type PlanDoc,
} from "../src";

const ops = (input: unknown[]): Operation[] => input.map((op) => OperationSchema.parse(op));

function planWith(build: (plan: PlanDoc) => void): PlanDoc {
  const plan = emptyPlan();
  build(plan);
  return plan;
}

describe("applyOperations", () => {
  it("never mutates the input plan", () => {
    const plan = emptyPlan();
    const snapshot = structuredClone(plan);
    applyOperations(plan, ops([{ op: "agenda.add", day: "mon", title: "Yoga", time: "07:30" }]));
    expect(plan).toEqual(snapshot);
  });

  it("adds agenda items sorted by time, untimed last", () => {
    const { plan, changes } = applyOperations(
      emptyPlan(),
      ops([
        { op: "agenda.add", day: "wed", title: "Pádel", time: "18:30" },
        { op: "agenda.add", day: "wed", title: "Llamar a mamá" },
        { op: "agenda.add", day: "wed", title: "Yoga", time: "7:30" },
      ]),
      { newId: sequentialIds() },
    );
    expect(plan.days.wed.agenda.map((i) => i.title)).toEqual(["Yoga", "Pádel", "Llamar a mamá"]);
    expect(plan.days.wed.agenda[0]).toEqual({ id: "id3", title: "Yoga", time: "07:30" });
    expect(changes).toHaveLength(3);
    expect(changes[0]).toEqual({
      kind: "add",
      day: "wed",
      category: "agenda",
      label: "Pádel",
      time: "18:30",
    });
  });

  it("moves an agenda item to another day and reports a move", () => {
    const start = planWith((p) => {
      p.days.wed.agenda.push({ id: "padel", title: "Pádel", time: "18:30" });
    });
    const { plan, changes } = applyOperations(
      start,
      ops([{ op: "agenda.update", id: "padel", day: "thu", time: "19:00" }]),
    );
    expect(plan.days.wed.agenda).toEqual([]);
    expect(plan.days.thu.agenda).toEqual([{ id: "padel", title: "Pádel", time: "19:00" }]);
    expect(changes).toEqual([
      { kind: "move", day: "wed", toDay: "thu", category: "agenda", label: "Pádel", time: "19:00" },
    ]);
  });

  it("clears an optional field when the update sends null", () => {
    const start = planWith((p) => {
      p.days.mon.agenda.push({ id: "a", title: "Trabajo", time: "09:00", note: "Remoto" });
    });
    const { plan } = applyOperations(
      start,
      ops([{ op: "agenda.update", id: "a", time: null, note: null }]),
    );
    expect(plan.days.mon.agenda[0]).toEqual({ id: "a", title: "Trabajo" });
  });

  it("replaces a workout and creates one implicitly for exercise.add", () => {
    const { plan, changes } = applyOperations(
      emptyPlan(),
      ops([
        {
          op: "workout.set",
          day: "mon",
          title: "Pierna y core",
          exercises: [
            { name: "Sentadilla", sets: "5", reps: 5, load: "80 kg" },
            { name: "Plancha", sets: 3, reps: "45 s" },
          ],
        },
        { op: "exercise.add", day: "fri", name: "Press banca", sets: 4, reps: "8" },
      ]),
      { newId: sequentialIds("x"), defaultWorkoutTitle: "Entrenamiento" },
    );
    expect(plan.days.mon.workout?.exercises.map((e) => formatPrescription(e))).toEqual([
      "5 × 5 · 80 kg",
      "3 × 45 s",
    ]);
    expect(plan.days.fri.workout).toEqual({
      title: "Entrenamiento",
      exercises: [{ id: "x3", name: "Press banca", sets: 4, reps: "8" }],
    });
    expect(changes.map((c) => [c.kind, c.category, c.day])).toEqual([
      ["add", "train", "mon"],
      ["add", "train", "fri"],
    ]);
  });

  it("upserts breakfast/lunch/dinner by slot but appends snacks", () => {
    const start = planWith((p) => {
      p.days.sat.meals.push({ id: "m1", slot: "dinner", title: "Pizza" });
    });
    const { plan, changes } = applyOperations(
      start,
      ops([
        { op: "meal.set", day: "sat", slot: "dinner", title: "Salmón con verduras" },
        { op: "meal.set", day: "sat", slot: "snack", title: "Fruta" },
        { op: "meal.set", day: "sat", slot: "breakfast", title: "Tortitas de avena" },
      ]),
      { newId: sequentialIds("m") },
    );
    expect(plan.days.sat.meals.map((m) => [m.slot, m.title])).toEqual([
      ["breakfast", "Tortitas de avena"],
      ["snack", "Fruta"],
      ["dinner", "Salmón con verduras"],
    ]);
    expect(plan.days.sat.meals.find((m) => m.slot === "dinner")?.id).toBe("m1");
    expect(changes.map((c) => c.kind)).toEqual(["update", "add", "add"]);
  });

  it("copies a day to several days with fresh ids", () => {
    const start = planWith((p) => {
      p.days.mon.agenda.push({ id: "work", title: "Trabajo", time: "09:00" });
      p.days.mon.meals.push({ id: "lunch", slot: "lunch", title: "Táper" });
      p.days.tue.agenda.push({ id: "old", title: "Viejo" });
    });
    const { plan, changes } = applyOperations(
      start,
      ops([{ op: "day.copy", from: "mon", to: ["tue", "wed"], categories: ["agenda"] }]),
      { newId: sequentialIds("c") },
    );
    expect(plan.days.tue.agenda).toEqual([{ id: "c1", title: "Trabajo", time: "09:00" }]);
    expect(plan.days.wed.agenda).toEqual([{ id: "c2", title: "Trabajo", time: "09:00" }]);
    expect(plan.days.tue.meals).toEqual([]);
    expect(changes.map((c) => `${c.kind}:${c.day}:${c.label}`)).toEqual([
      "remove:tue:Viejo",
      "add:tue:Trabajo",
      "add:wed:Trabajo",
    ]);
  });

  it("clears a whole day and reports every removed item", () => {
    const start = planWith((p) => {
      p.days.sun.agenda.push({ id: "a", title: "Brunch" });
      p.days.sun.workout = { title: "Rodaje", exercises: [{ id: "e", name: "Correr 5 km" }] };
      p.days.sun.meals.push({ id: "m", slot: "dinner", title: "Cena fuera" });
    });
    const { plan, changes } = applyOperations(start, ops([{ op: "day.clear", day: "sun" }]));
    expect(plan.days.sun).toEqual({ agenda: [], workout: null, meals: [] });
    expect(changes.map((c) => `${c.kind}:${c.category}`)).toEqual([
      "remove:agenda",
      "remove:train",
      "remove:fuel",
    ]);
  });

  it("skips operations it cannot apply and keeps the rest", () => {
    const { plan, changes, rejected } = applyOperations(
      emptyPlan(),
      ops([
        { op: "agenda.remove", id: "missing" },
        { op: "workout.clear", day: "mon" },
        { op: "agenda.add", day: "mon", title: "Leer" },
      ]),
    );
    expect(rejected).toEqual([
      { index: 0, op: "agenda.remove", reason: "not_found" },
      { index: 1, op: "workout.clear", reason: "noop" },
    ]);
    expect(plan.days.mon.agenda).toHaveLength(1);
    expect(changes).toHaveLength(1);
  });

  it("enforces per-day limits", () => {
    const many = Array.from({ length: 41 }, (_, i) => ({
      op: "agenda.add",
      day: "mon",
      title: `Cosa ${i}`,
    }));
    const { plan, rejected } = applyOperations(emptyPlan(), ops(many));
    expect(plan.days.mon.agenda).toHaveLength(40);
    expect(rejected).toEqual([{ index: 40, op: "agenda.add", reason: "limit" }]);
  });

  it("sets and removes a day note", () => {
    const added = applyOperations(
      emptyPlan(),
      ops([{ op: "day.note", day: "fri", note: "Viaje a Valencia" }]),
    );
    expect(added.plan.days.fri.note).toBe("Viaje a Valencia");
    const removed = applyOperations(added.plan, ops([{ op: "day.note", day: "fri", note: null }]));
    expect(removed.plan.days.fri.note).toBeUndefined();
    expect(removed.changes[0]?.kind).toBe("remove");
  });
});
