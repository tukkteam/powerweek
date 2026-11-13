import { describe, expect, it } from "vitest";
import {
  currentMealSlot,
  daySpans,
  dayWindow,
  durationMinutes,
  emptyDay,
  fromMinutes,
  MEAL_TIMES,
  position,
  spanProgress,
  toMinutes,
  workoutMinutes,
  zonedMinutes,
  type Day,
} from "../src";

describe("clock maths", () => {
  it("converts between HH:MM and minutes", () => {
    expect(toMinutes("08:30")).toBe(510);
    expect(fromMinutes(510)).toBe("08:30");
    expect(fromMinutes(1440)).toBe("24:00");
    expect(fromMinutes(-5)).toBe("00:00");
  });

  it("reads durations written as reps", () => {
    expect(durationMinutes("30 min")).toBe(30);
    expect(durationMinutes("45 s")).toBe(0.75);
    expect(durationMinutes("30-45 s")).toBe(0.5);
    expect(durationMinutes("1 h")).toBe(60);
    expect(durationMinutes("8-10")).toBeUndefined();
    expect(durationMinutes(undefined)).toBeUndefined();
  });

  it("knows the minute of the day in a time zone", () => {
    expect(zonedMinutes("Europe/Madrid", new Date("2026-11-13T13:32:00Z"))).toBe(14 * 60 + 32);
    expect(zonedMinutes("Europe/Madrid", new Date("2026-11-13T23:05:00Z"))).toBe(5);
  });
});

describe("workoutMinutes", () => {
  it("estimates about 2.5 minutes a set plus a warm-up, rounded to 5", () => {
    const workout = {
      exercises: [
        { id: "a", name: "Remo con barra", sets: 4 },
        { id: "b", name: "Curl martillo", sets: 3 },
        { id: "c", name: "Plancha", sets: 3, reps: "45 s" },
      ],
    };
    // 10 + 4·2.5 + 3·2.5 + (3·0.75 + 2) = 31.75 → 30
    expect(workoutMinutes(workout)).toBe(30);
  });

  it("uses the duration of cardio and stays between 20 and 120 minutes", () => {
    expect(workoutMinutes({ exercises: [{ id: "a", name: "Correr", reps: "45 min" }] })).toBe(55);
    expect(workoutMinutes({ exercises: [] })).toBe(20);
    expect(workoutMinutes({ exercises: [{ id: "a", name: "Bici", reps: "3 h" }] })).toBe(120);
  });
});

describe("daySpans", () => {
  const day: Day = {
    ...emptyDay(),
    agenda: [
      { id: "work", title: "Teletrabajo", time: "08:00", endTime: "18:00" },
      { id: "dentist", title: "Dentista", time: "13:30" },
      { id: "late", title: "Concierto", time: "22:00", endTime: "01:00" },
      { id: "call", title: "Llamar a mamá" },
    ],
    workout: {
      title: "Pierna",
      time: "19:00",
      exercises: [{ id: "sq", name: "Sentadilla", sets: 5 }],
    },
  };

  it("puts overlapping agenda items in separate lanes and skips untimed ones", () => {
    const { agenda, lanes } = daySpans(day);
    expect(agenda.map((s) => [s.id, s.lane])).toEqual([
      ["work", 0],
      ["dentist", 1],
      ["late", 0],
    ]);
    expect(lanes).toBe(2);
  });

  it("draws items without an end as short open spans and clamps past midnight", () => {
    const { agenda } = daySpans(day);
    expect(agenda.find((s) => s.id === "dentist")).toMatchObject({
      start: 810,
      end: 840,
      open: true,
    });
    expect(agenda.find((s) => s.id === "late")).toMatchObject({ end: 1440, open: false });
  });

  it("places a timed workout with its estimated length", () => {
    expect(daySpans(day).train).toMatchObject({ start: 1140, end: 1165, kind: "train" });
    expect(daySpans({ ...day, workout: { ...day.workout!, time: undefined } }).train).toBeNull();
  });

  it("widens the window for early starts", () => {
    expect(dayWindow([])).toEqual({ start: 360, end: 1440 });
    expect(dayWindow([{ start: 330, end: 400 }])).toEqual({ start: 300, end: 1440 });
    expect(position(900, { start: 360, end: 1440 })).toBe(0.5);
  });
});

describe("spanProgress", () => {
  const span = { start: 480, end: 1080 };

  it("follows the clock today", () => {
    expect(spanProgress(span, 420, "today")).toEqual({ state: "upcoming", progress: 0 });
    expect(spanProgress(span, 780, "today")).toEqual({ state: "live", progress: 0.5 });
    expect(spanProgress(span, 1100, "today")).toEqual({ state: "past", progress: 1 });
  });

  it("treats earlier days as done and later days as ahead", () => {
    expect(spanProgress(span, null, "past")).toEqual({ state: "past", progress: 1 });
    expect(spanProgress(span, null, "future")).toEqual({ state: "upcoming", progress: 0 });
  });
});

describe("currentMealSlot", () => {
  it("follows the Spanish timetable", () => {
    expect(currentMealSlot(7 * 60, MEAL_TIMES.es)).toBe("breakfast");
    expect(currentMealSlot(13 * 60, MEAL_TIMES.es)).toBe("lunch");
    expect(currentMealSlot(17 * 60, MEAL_TIMES.es)).toBe("snack");
    expect(currentMealSlot(23 * 60, MEAL_TIMES.es)).toBe("dinner");
  });
});
