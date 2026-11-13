import { describe, expect, it } from "vitest";
import {
  AssistantOutputSchema,
  coercePlan,
  emptyPlan,
  OperationSchema,
  PlanDocSchema,
  weekLoads,
} from "../src";

describe("OperationSchema", () => {
  it("normalises loose model output", () => {
    const op = OperationSchema.parse({
      op: "agenda.add",
      day: "mon",
      title: " Yoga ",
      time: "8",
      note: null,
    });
    expect(op).toEqual({ op: "agenda.add", day: "mon", title: "Yoga", time: "08:00" });
  });

  it("accepts 8h and 8.30 as times", () => {
    expect(
      OperationSchema.parse({ op: "agenda.add", day: "mon", title: "a", time: "8h" }),
    ).toMatchObject({ time: "08:00" });
    expect(
      OperationSchema.parse({ op: "agenda.add", day: "mon", title: "a", time: "8.30" }),
    ).toMatchObject({ time: "08:30" });
  });

  it("rejects unknown days, slots and impossible times", () => {
    expect(OperationSchema.safeParse({ op: "agenda.add", day: "monday", title: "a" }).success).toBe(
      false,
    );
    expect(
      OperationSchema.safeParse({ op: "meal.set", day: "mon", slot: "brunch", title: "a" }).success,
    ).toBe(false);
    expect(
      OperationSchema.safeParse({ op: "agenda.add", day: "mon", title: "a", time: "25:00" })
        .success,
    ).toBe(false);
  });

  it("strips keys the model invents", () => {
    const op = OperationSchema.parse({ op: "agenda.remove", id: "x", reason: "user asked" });
    expect(op).toEqual({ op: "agenda.remove", id: "x" });
  });

  it("parses the assistant envelope", () => {
    const out = AssistantOutputSchema.parse({
      operations: [{ op: "workout.clear", day: "sun" }],
      reply: "Listo: domingo sin entreno.",
    });
    expect(out.operations).toHaveLength(1);
  });
});

describe("plan documents", () => {
  it("validates the empty plan", () => {
    expect(PlanDocSchema.safeParse(emptyPlan()).success).toBe(true);
  });

  it("salvages valid days from a corrupted document", () => {
    const broken = {
      schemaVersion: 1,
      days: {
        mon: { agenda: [{ id: "a", title: "Trabajo" }], workout: null, meals: [] },
        tue: { agenda: "nope" },
      },
    };
    const plan = coercePlan(broken);
    expect(plan.days.mon.agenda).toHaveLength(1);
    expect(plan.days.tue).toEqual({ agenda: [], workout: null, meals: [] });
  });

  it("computes week loads relative to the busiest day", () => {
    const plan = emptyPlan();
    plan.days.mon.agenda.push({ id: "1", title: "a" }, { id: "2", title: "b" });
    plan.days.tue.workout = { title: "Empuje", exercises: [] };
    const loads = weekLoads(plan);
    expect(loads.mon).toEqual({ count: 2, ratio: 1 });
    expect(loads.tue).toEqual({ count: 1, ratio: 0.5 });
    expect(loads.sun).toEqual({ count: 0, ratio: 0 });
  });
});
