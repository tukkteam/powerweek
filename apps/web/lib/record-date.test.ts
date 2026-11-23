import { describe, expect, it } from "vitest";
import { recordDate } from "./record-date";

// 2026-11-09 is a Monday; 2026-11-15 the Sunday of that week.
describe("the date a dated fact means", () => {
  it("keeps facts about the week on screen in that week", () => {
    expect(recordDate("2026-11-15", "mon", false)).toBe("2026-11-09");
    expect(recordDate("2026-11-09", "sun", false)).toBe("2026-11-15");
    expect(recordDate("2026-11-11", "wed", false)).toBe("2026-11-11");
  });

  it("reads a day as the next time it comes when the fact looks ahead", () => {
    // Sunday: "tomorrow" is next week's Monday.
    expect(recordDate("2026-11-15", "mon", true)).toBe("2026-11-16");
    expect(recordDate("2026-11-15", "wed", true)).toBe("2026-11-18");
    // Wednesday: today, Friday and next Monday.
    expect(recordDate("2026-11-11", "wed", true)).toBe("2026-11-11");
    expect(recordDate("2026-11-11", "fri", true)).toBe("2026-11-13");
    expect(recordDate("2026-11-11", "mon", true)).toBe("2026-11-16");
  });

  it("still reads yesterday as yesterday", () => {
    expect(recordDate("2026-11-11", "tue", true)).toBe("2026-11-10");
    expect(recordDate("2026-11-15", "sat", true)).toBe("2026-11-14");
    // Monday: yesterday was last week's Sunday.
    expect(recordDate("2026-11-09", "sun", true)).toBe("2026-11-08");
  });
});
