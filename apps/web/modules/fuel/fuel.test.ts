import type { Json } from "@tukkteam/modules";
import { describe, expect, it } from "vitest";
import { fuel, kernel } from "../index";
import { read, run, week } from "../test-kit";
import { currentMealSlot, MEAL_TIMES, mealCount, mealSlots } from "./module";

describe("meals", () => {
  it("upserts breakfast, lunch and dinner by slot but appends snacks", () => {
    const start = week((w) => {
      w.fuel.days.sat.meals.push({ id: "m1", slot: "dinner", title: "Pizza" });
    });
    const { doc, changes } = run(
      start,
      [
        { op: "fuel.meal.set", day: "sat", slot: "dinner", title: "Salmón con verduras" },
        { op: "fuel.meal.set", day: "sat", slot: "snack", title: "Fruta" },
        { op: "fuel.meal.set", day: "sat", slot: "breakfast", title: "Tortitas de avena" },
      ],
      "m",
    );
    const meals = read(doc).fuel.days.sat.meals;
    expect(meals.map((m) => [m.slot, m.title])).toEqual([
      ["breakfast", "Tortitas de avena"],
      ["snack", "Fruta"],
      ["dinner", "Salmón con verduras"],
    ]);
    expect(meals.find((m) => m.slot === "dinner")?.id).toBe("m1");
    expect(changes.map((c) => c.kind)).toEqual(["update", "add", "add"]);
    expect(kernel.describe(changes[0]!, "es")).toBe("Cena: Salmón con verduras");
  });

  it("rejects slots that do not exist", () => {
    expect(
      kernel.parse([{ op: "fuel.meal.set", day: "mon", slot: "brunch", title: "a" }]).dropped,
    ).toBe(1);
  });
});

describe("meal options", () => {
  it("sets week options for some days and keeps ids when titles repeat", () => {
    const first = run(
      week(),
      [
        {
          op: "fuel.menu.set",
          slot: "lunch",
          options: ["Lentejas", { title: "Wok de pollo", note: "con arroz" }],
          days: ["fri", "mon", "tue"],
        },
      ],
      "o",
    );
    expect(read(first.doc).fuel.menu).toEqual({
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

    const again = run(
      first.doc,
      [{ op: "fuel.menu.set", slot: "lunch", options: ["wok de pollo", "Pasta"] }],
      "n",
    );
    const lunch = read(again.doc).fuel.menu?.lunch;
    expect(lunch?.options.map((o) => o.id)).toEqual(["o2", "n1"]);
    expect(lunch?.days).toBeUndefined();
  });

  it("resolves slots: fixed meals, then the day's options, then the week's", () => {
    const { doc } = run(week(), [
      {
        op: "fuel.menu.set",
        slot: "dinner",
        options: ["Salmón", "Tortilla"],
        days: ["mon", "tue"],
      },
      { op: "fuel.options.set", day: "tue", slot: "dinner", options: ["Pizza", "Sushi"] },
      { op: "fuel.meal.set", day: "mon", slot: "dinner", title: "Cena fuera" },
    ]);
    const state = read(doc).fuel;
    expect(mealSlots(state, "mon").dinner.kind).toBe("fixed");
    expect(mealSlots(state, "tue").dinner).toMatchObject({ kind: "options", scope: "day" });
    expect(mealSlots(state, "wed").dinner.kind).toBe("empty");
    expect(mealCount(state, "tue")).toBe(1);
  });

  it("clears options per day and per week, and when a day is cleared", () => {
    const { doc } = run(week(), [
      { op: "fuel.menu.set", slot: "snack", options: ["Fruta", "Yogur"] },
      { op: "fuel.options.set", day: "wed", slot: "lunch", options: ["Arroz", "Garbanzos"] },
    ]);
    const cleared = run(doc, [
      { op: "fuel.options.set", day: "wed", slot: "lunch", options: [] },
      { op: "fuel.menu.clear", slot: "snack" },
      { op: "fuel.menu.clear", slot: "snack" },
    ]);
    expect(read(cleared.doc).fuel.days.wed.menu).toBeUndefined();
    expect(read(cleared.doc).fuel.menu).toBeUndefined();
    expect(cleared.rejected).toEqual([{ index: 2, op: "fuel.menu.clear", reason: "noop" }]);

    const wiped = run(doc, [{ op: "day.clear", day: "wed", modules: ["fuel"] }]);
    expect(read(wiped.doc).fuel.days.wed.menu).toBeUndefined();
  });
});

describe("picking an option for a date", () => {
  const { doc } = run(
    week(),
    [{ op: "fuel.options.set", day: "sat", slot: "dinner", options: ["Pizza", "Sushi"] }],
    "o",
  );

  it("is a dated fact, kept apart from the plan", () => {
    const parsed = kernel.parse([
      {
        op: "fuel.menu.set",
        slot: "lunch",
        options: ["Lentejas", "Wok"],
        days: ["lunes", "martes"],
      },
      { op: "meal.pick", day: "sábado", slot: "dinner", option: " Sushi " },
    ]);
    expect(parsed.operations).toHaveLength(1);
    expect(parsed.operations[0]).toMatchObject({ op: "fuel.menu.set", days: ["mon", "tue"] });
    expect(parsed.records).toEqual([
      { op: "fuel.pick", day: "sat", slot: "dinner", option: "Sushi" },
    ]);
    expect(parsed.dropped).toBe(0);
  });

  it("matches the option by title or id and stores its id", () => {
    const stored = new Map<string, Json>();
    const options = {
      lang: "es",
      get: (_: string, day: string, key: string) => stored.get(`${day}|${key}`),
    };
    const picked = kernel.resolveRecords(
      doc,
      [
        { op: "fuel.pick", day: "sat", slot: "dinner", option: "sushi" },
        { op: "fuel.pick", day: "sat", slot: "dinner", option: "Paella" },
        { op: "fuel.pick", day: "sat", slot: "lunch", option: "Sushi" },
      ],
      options,
    );
    expect(picked.writes).toEqual([
      { module: "fuel", day: "sat", key: "pick:dinner", value: "o2" },
    ]);
    expect(picked.rejected.map((r) => r.reason)).toEqual(["not_found", "not_found"]);
    expect(kernel.describe(picked.changes[0]!, "es")).toBe("Cena: Elegido: Sushi");

    stored.set("sat|pick:dinner", "o2");
    const cleared = kernel.resolveRecords(
      doc,
      [
        { op: "fuel.pick", day: "sat", slot: "dinner", option: null },
        { op: "fuel.pick", day: "fri", slot: "dinner", option: null },
      ],
      options,
    );
    expect(cleared.writes).toEqual([
      { module: "fuel", day: "sat", key: "pick:dinner", value: null },
    ]);
    expect(cleared.rejected.map((r) => r.reason)).toEqual(["noop"]);
  });

  it("shows a pending marker on the day's timeline until one is chosen", () => {
    const t = kernel.messages(fuel, "es");
    const state = read(doc).fuel;
    const pending = fuel.week!.timeline!(state, "sat", { lang: "es", t, record: () => undefined });
    expect(pending.markers).toEqual([
      { id: "options-dinner", at: 21 * 60, title: "Cena: 2 opciones", pending: true },
    ]);
    const chosen = fuel.week!.timeline!(state, "sat", { lang: "en", t, record: () => "o2" });
    expect(chosen.markers).toEqual([
      { id: "options-dinner", at: 19 * 60, title: "Cena: Sushi", pending: false },
    ]);
  });
});

describe("meal times", () => {
  it("follows the Spanish timetable", () => {
    expect(currentMealSlot(7 * 60, MEAL_TIMES.es)).toBe("breakfast");
    expect(currentMealSlot(13 * 60, MEAL_TIMES.es)).toBe("lunch");
    expect(currentMealSlot(17 * 60, MEAL_TIMES.es)).toBe("snack");
    expect(currentMealSlot(23 * 60, MEAL_TIMES.es)).toBe("dinner");
  });
});
