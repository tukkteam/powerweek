import { DAY_KEYS, weekDates } from "@tukkteam/modules/week";
import { describe, expect, it } from "vitest";
import { recordDate } from "./record-date";

// 2026-11-23 is a Monday; 2026-11-29 the Sunday of that week.
const WEEK = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"];

describe("the date a dated fact means", () => {
  it("is the date of that day in the week on screen, whichever way the fact looks", () => {
    for (const today of WEEK.slice(1)) {
      const dates = weekDates(today);
      for (const day of DAY_KEYS) {
        expect(recordDate(today, day, false)).toBe(dates[day]);
        expect(recordDate(today, day, true)).toBe(dates[day]);
      }
    }
  });

  it("reads tomorrow as tomorrow on a Sunday, for a fact that looks ahead", () => {
    expect(recordDate("2026-11-29", "mon", true)).toBe("2026-11-30");
    // Only tomorrow: Tuesday said on a Sunday is still the one on screen.
    expect(recordDate("2026-11-29", "tue", true)).toBe("2026-11-24");
    // What was done on Monday, said on Sunday, is the Monday of this week.
    expect(recordDate("2026-11-29", "mon", false)).toBe("2026-11-23");
  });

  it("reads yesterday as yesterday on a Monday, for a fact that looks back", () => {
    expect(recordDate("2026-11-23", "sun", false)).toBe("2026-11-22");
    // A choice for Sunday made on Monday is for the Sunday on screen.
    expect(recordDate("2026-11-23", "sun", true)).toBe("2026-11-29");
    expect(recordDate("2026-11-23", "sat", false)).toBe("2026-11-28");
  });

  it("gives the same date to a tap and to a spoken fact for every other day", () => {
    // A pick tapped on Monday's card is stored on that Monday; on Thursday, changing or
    // clearing "Monday's" by voice reaches the same date.
    expect(recordDate("2026-11-26", "mon", true)).toBe(weekDates("2026-11-26").mon);
    expect(recordDate("2026-11-26", "mon", false)).toBe(weekDates("2026-11-26").mon);
  });
});
