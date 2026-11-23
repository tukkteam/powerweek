import type { Change } from "@tukkteam/modules";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { dateRange, describeChange, formatDuration, shortDate, whereChanged } from "./format";

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
    expect(whereChanged(moved, dict)).toBe("Miércoles");
    expect(whereChanged({ ...meal, scope: "week" }, dict)).toBe("SEM");
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
    expect(whereChanged(screen({}), dict)).toBe("PANTALLA");
  });

  it("formats durations compactly", () => {
    expect(formatDuration(208)).toBe("3 h 28 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(600)).toBe("10 h");
    expect(formatDuration(-3)).toBe("0 min");
  });
});
