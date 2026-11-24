import type { Change } from "@tukkteam/modules";
import { weekDates } from "@tukkteam/modules/week";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { dateRange, describeChange, formatDuration, shortDate, whereChanged } from "./format";

// The week on screen in these tests: Monday 23 to Sunday 29 November 2026.
const onScreen = weekDates("2026-11-25");

describe("format", () => {
  it("formats short dates per language", () => {
    expect(shortDate("2026-11-13", "es")).toBe("13 NOV");
    expect(shortDate("2026-11-13", "en")).toBe("13 NOV");
  });

  it("formats week ranges inside and across months", () => {
    expect(dateRange("2026-11-09", "2026-11-15", "es")).toBe("9–15 NOV");
    expect(dateRange("2026-11-30", "2026-12-06", "es")).toBe("30 NOV – 6 DIC");
  });

  it("describes receipt lines through each module, adding where a moved item went", () => {
    const dict = getDictionary("es");
    const moved: Change = {
      kind: "move",
      module: "agenda",
      day: "wed",
      toDay: "thu",
      label: "Pádel",
      data: { time: "18:30" },
    };
    const workout: Change = {
      kind: "add",
      module: "train",
      day: "mon",
      label: "Pierna",
      data: { exerciseCount: 2 },
    };
    const meal: Change = {
      kind: "add",
      module: "fuel",
      day: "fri",
      label: "Salmón",
      data: { slot: "dinner" },
    };
    expect(describeChange(moved, dict, "es")).toBe("Pádel · 18:30 → Jueves");
    expect(describeChange(workout, dict, "es")).toBe("Pierna · 2 ejercicios");
    expect(describeChange(meal, dict, "es")).toBe("Cena: Salmón");
    expect(describeChange(meal, getDictionary("en"), "en")).toBe("Dinner: Salmón");
    expect(whereChanged(moved, dict, "es", onScreen)).toBe("Miércoles");
    expect(whereChanged({ ...meal, scope: "week" }, dict, "es", onScreen)).toBe("SEM");
  });

  it("says which date a fact landed on when it is not the one on screen", () => {
    const dict = getDictionary("es");
    const pick: Change = { kind: "update", module: "fuel", day: "mon", label: "Pasta" };
    // On screen: the plain weekday, as for any change.
    expect(whereChanged({ ...pick, date: "2026-11-23" }, dict, "es", onScreen)).toBe("Lunes");
    // "Tomorrow", said on Sunday 29: the Monday that comes.
    expect(whereChanged({ ...pick, date: "2026-11-30" }, dict, "es", onScreen)).toBe("Lun 30 NOV");
    expect(
      whereChanged(
        { ...pick, day: "sun", date: "2026-11-22" },
        getDictionary("en"),
        "en",
        onScreen,
      ),
    ).toBe("Sun 22 NOV");
  });

  it("describes changes to the screen with the names people see", () => {
    const dict = getDictionary("es");
    const screen = (change: Partial<Change>): Change => ({
      kind: "add",
      module: "app",
      scope: "app",
      label: "fuel",
      ...change,
    });
    expect(describeChange(screen({}), dict, "es")).toBe("Módulo Comidas en pantalla");
    expect(describeChange(screen({ kind: "remove" }), dict, "es")).toBe(
      "Módulo Comidas fuera de pantalla",
    );
    expect(describeChange(screen({ kind: "move", data: { position: 1 } }), dict, "es")).toBe(
      "Comidas, al puesto 1",
    );
    expect(
      describeChange(
        screen({ kind: "move", label: "", data: { order: ["train", "agenda"] } }),
        dict,
        "es",
      ),
    ).toBe("Nuevo orden: Entreno, Agenda");
    expect(describeChange(screen({ label: "gone" }), getDictionary("en"), "en")).toBe(
      "gone module on screen",
    );
    expect(whereChanged(screen({}), dict, "es", onScreen)).toBe("PANTALLA");
  });

  it("formats durations compactly", () => {
    expect(formatDuration(208)).toBe("3 h 28 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(600)).toBe("10 h");
    expect(formatDuration(-3)).toBe("0 min");
  });
});
