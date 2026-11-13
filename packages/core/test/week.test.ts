import { describe, expect, it } from "vitest";
import { addDays, dayKeyOf, isoWeek, weekDates, zonedToday } from "../src";

describe("calendar helpers", () => {
  it("knows 13 Nov 2026 is a Friday in week 46", () => {
    expect(dayKeyOf("2026-11-13")).toBe("fri");
    expect(isoWeek("2026-11-13")).toBe(46);
  });

  it("returns Monday-first week dates", () => {
    expect(weekDates("2026-11-11")).toEqual({
      mon: "2026-11-09",
      tue: "2026-11-10",
      wed: "2026-11-11",
      thu: "2026-11-12",
      fri: "2026-11-13",
      sat: "2026-11-14",
      sun: "2026-11-15",
    });
  });

  it("handles year boundaries for ISO weeks", () => {
    expect(isoWeek("2027-01-01")).toBe(53);
    expect(isoWeek("2026-01-01")).toBe(1);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("resolves today in the user's time zone", () => {
    const instant = new Date("2026-11-13T23:30:00Z");
    expect(zonedToday("Europe/Madrid", instant)).toEqual({ dayKey: "sat", isoDate: "2026-11-14" });
    expect(zonedToday("America/Mexico_City", instant)).toEqual({
      dayKey: "fri",
      isoDate: "2026-11-13",
    });
    expect(zonedToday("Not/AZone", instant).isoDate).toBe("2026-11-13");
  });
});
