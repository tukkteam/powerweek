import { describe, expect, it } from "vitest";
import {
  addDays,
  assignLanes,
  dayKeyOf,
  dayWindow,
  fromMinutes,
  isoWeek,
  looseTime,
  normaliseDayFields,
  position,
  spanOf,
  spanProgress,
  tomorrowOf,
  toMinutes,
  weekDates,
  zonedMinutes,
  zonedToday,
} from "../src/week";

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

  it("wraps the week around for tomorrow", () => {
    expect(tomorrowOf("sun")).toBe("mon");
    expect(tomorrowOf("wed")).toBe("thu");
  });

  it("forgives day names in Spanish and English", () => {
    expect(
      normaliseDayFields({ day: "Lunes", from: "friday", to: "miércoles", days: ["sáb", "D"] }),
    ).toEqual({ day: "mon", from: "fri", to: "wed", days: ["sat", "sun"] });
    // Only a whole-day copy takes one target for a list; a module's own `to` stays as written.
    expect(normaliseDayFields({ to: "martes" }, "day.copy")).toEqual({ to: ["tue"] });
    expect(normaliseDayFields({ to: "martes" }, "trips.add")).toEqual({ to: "tue" });
    expect(normaliseDayFields({ to: "Marta" }, "gifts.add")).toEqual({ to: "Marta" });
    expect(normaliseDayFields({ day: "someday", title: "Lunes" })).toEqual({
      day: "someday",
      title: "Lunes",
    });
  });
});

describe("clock maths", () => {
  it("converts between HH:MM and minutes", () => {
    expect(toMinutes("08:30")).toBe(510);
    expect(fromMinutes(510)).toBe("08:30");
    expect(fromMinutes(1440)).toBe("24:00");
    expect(fromMinutes(-5)).toBe("00:00");
  });

  it("accepts times the way people and models write them", () => {
    expect(looseTime.parse("8")).toBe("08:00");
    expect(looseTime.parse("8h")).toBe("08:00");
    expect(looseTime.parse("8.30")).toBe("08:30");
    expect(looseTime.parse("08:30")).toBe("08:30");
    expect(looseTime.safeParse("25:00").success).toBe(false);
  });

  it("knows the minute of the day in a time zone", () => {
    expect(zonedMinutes("Europe/Madrid", new Date("2026-11-13T13:32:00Z"))).toBe(14 * 60 + 32);
    expect(zonedMinutes("Europe/Madrid", new Date("2026-11-13T23:05:00Z"))).toBe(5);
  });
});

describe("timeline", () => {
  const items = [
    { id: "work", title: "Teletrabajo", time: "08:00", endTime: "18:00" },
    { id: "dentist", title: "Dentista", time: "13:30" },
    { id: "late", title: "Concierto", time: "22:00", endTime: "01:00" },
    { id: "call", title: "Llamar a mamá" },
  ];
  const spans = items.map(spanOf).filter((span) => span !== null);

  it("puts overlapping spans in separate lanes and skips items without a time", () => {
    expect(assignLanes(spans).map((s) => [s.id, s.lane])).toEqual([
      ["work", 0],
      ["dentist", 1],
      ["late", 0],
    ]);
  });

  it("draws items without an end as short open spans and clamps past midnight", () => {
    expect(spans.find((s) => s.id === "dentist")).toMatchObject({
      start: 810,
      end: 840,
      open: true,
    });
    expect(spans.find((s) => s.id === "late")).toMatchObject({ end: 1440, open: false });
  });

  it("widens the window for early starts", () => {
    expect(dayWindow([])).toEqual({ start: 360, end: 1440 });
    expect(dayWindow([{ start: 330, end: 400 }])).toEqual({ start: 300, end: 1440 });
    expect(position(900, { start: 360, end: 1440 })).toBe(0.5);
  });

  it("follows the clock today and treats other days as done or ahead", () => {
    const span = { start: 480, end: 1080 };
    expect(spanProgress(span, 420, "today")).toEqual({ state: "upcoming", progress: 0 });
    expect(spanProgress(span, 780, "today")).toEqual({ state: "live", progress: 0.5 });
    expect(spanProgress(span, 1100, "today")).toEqual({ state: "past", progress: 1 });
    expect(spanProgress(span, null, "past")).toEqual({ state: "past", progress: 1 });
    expect(spanProgress(span, null, "future")).toEqual({ state: "upcoming", progress: 0 });
  });
});
