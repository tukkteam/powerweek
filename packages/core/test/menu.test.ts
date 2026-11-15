import { describe, expect, it } from "vitest";
import {
  applyOperations,
  dayLoadIn,
  emptyPlan,
  mealSlots,
  OperationSchema,
  PickSchema,
  sequentialIds,
  type Operation,
} from "../src";

const ops = (input: unknown[]): Operation[] => input.map((op) => OperationSchema.parse(op));

describe("meal options", () => {
  it("sets week options for some days and keeps ids when titles repeat", () => {
    const first = applyOperations(
      emptyPlan(),
      ops([
        {
          op: "menu.set",
          slot: "lunch",
          options: ["Lentejas", { title: "Wok de pollo", note: "con arroz" }],
          days: ["fri", "mon", "tue"],
        },
      ]),
      { newId: sequentialIds("o") },
    );
    expect(first.plan.menu).toEqual({
      lunch: {
        options: [
          { id: "o1", title: "Lentejas" },
          { id: "o2", title: "Wok de pollo", note: "con arroz" },
        ],
        days: ["mon", "tue", "fri"],
      },
    });
    expect(first.changes[0]).toMatchObject({
      kind: "add",
      scope: "week",
      label: "Lentejas / Wok de pollo",
    });

    const again = applyOperations(
      first.plan,
      ops([{ op: "menu.set", slot: "lunch", options: ["wok de pollo", "Pasta"] }]),
      { newId: sequentialIds("n") },
    );
    expect(again.plan.menu?.lunch?.options.map((o) => o.id)).toEqual(["o2", "n1"]);
    expect(again.plan.menu?.lunch?.days).toBeUndefined();
  });

  it("resolves slots: fixed meals, then the day's options, then the week's", () => {
    const { plan } = applyOperations(
      emptyPlan(),
      ops([
        { op: "menu.set", slot: "dinner", options: ["Salmón", "Tortilla"], days: ["mon", "tue"] },
        { op: "meal.options", day: "tue", slot: "dinner", options: ["Pizza", "Sushi"] },
        { op: "meal.set", day: "mon", slot: "dinner", title: "Cena fuera" },
      ]),
      { newId: sequentialIds() },
    );
    expect(mealSlots(plan, "mon").dinner.kind).toBe("fixed");
    expect(mealSlots(plan, "tue").dinner).toMatchObject({ kind: "options", scope: "day" });
    expect(mealSlots(plan, "wed").dinner.kind).toBe("empty");
    expect(dayLoadIn(plan, "tue")).toBe(1);
  });

  it("clears options per day and per week, and with day.clear", () => {
    const { plan } = applyOperations(
      emptyPlan(),
      ops([
        { op: "menu.set", slot: "snack", options: ["Fruta", "Yogur"] },
        { op: "meal.options", day: "wed", slot: "lunch", options: ["Arroz", "Garbanzos"] },
      ]),
    );
    const cleared = applyOperations(
      plan,
      ops([
        { op: "meal.options", day: "wed", slot: "lunch", options: [] },
        { op: "menu.clear", slot: "snack" },
        { op: "menu.clear", slot: "snack" },
      ]),
    );
    expect(cleared.plan.days.wed.menu).toBeUndefined();
    expect(cleared.plan.menu).toBeUndefined();
    expect(cleared.rejected).toEqual([{ index: 2, op: "menu.clear", reason: "noop" }]);

    const wiped = applyOperations(
      plan,
      ops([{ op: "day.clear", day: "wed", categories: ["fuel"] }]),
    );
    expect(wiped.plan.days.wed.menu).toBeUndefined();
  });

  it("parses picks separately from plan operations", () => {
    expect(
      PickSchema.parse({ op: "meal.pick", day: "fri", slot: "lunch", option: " Wok " }),
    ).toEqual({
      op: "meal.pick",
      day: "fri",
      slot: "lunch",
      option: "Wok",
    });
    expect(
      OperationSchema.safeParse({ op: "meal.pick", day: "fri", slot: "lunch", option: "Wok" })
        .success,
    ).toBe(false);
  });
});
