import type { Change } from "@powerweek/core";
import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { dateRange, describeChange, shortDate } from "./format";

describe("format", () => {
  it("formats short dates per language", () => {
    expect(shortDate("2026-11-13", "es")).toBe("13 NOV");
    expect(shortDate("2026-11-13", "en")).toBe("13 NOV");
  });

  it("formats week ranges inside and across months", () => {
    expect(dateRange("2026-11-09", "2026-11-15", "es")).toBe("9–15 NOV");
    expect(dateRange("2026-11-30", "2026-12-06", "es")).toBe("30 NOV – 6 DIC");
  });

  it("describes receipt lines", () => {
    const dict = getDictionary("es");
    const moved: Change = {
      kind: "move",
      day: "wed",
      toDay: "thu",
      category: "agenda",
      label: "Pádel",
      time: "18:30",
    };
    const workout: Change = {
      kind: "add",
      day: "mon",
      category: "train",
      label: "Pierna",
      exerciseCount: 2,
    };
    const meal: Change = {
      kind: "add",
      day: "fri",
      category: "fuel",
      label: "Salmón",
      slot: "dinner",
    };
    expect(describeChange(moved, dict)).toBe("Pádel · 18:30 → Jueves");
    expect(describeChange(workout, dict)).toBe("Pierna · 2 ejercicios");
    expect(describeChange(meal, dict)).toBe("Cena: Salmón");
  });
});
