import { describe, expect, it } from "vitest";
import { kernel, train } from "../index";
import { read, run, week } from "../test-kit";
import { durationMinutes, formatPrescription, MOVE_CATALOGUE, workoutMinutes } from "./module";

describe("training", () => {
  it("replaces a workout and creates one implicitly when an exercise is added", () => {
    const { doc, changes } = run(
      week(),
      [
        {
          op: "train.workout.set",
          day: "mon",
          title: "Pierna y core",
          exercises: [
            { name: "Sentadilla", sets: "5", reps: 5, load: "80 kg" },
            { name: "Plancha", sets: 3, reps: "45 s" },
          ],
        },
        { op: "train.exercise.add", day: "fri", name: "Press banca", sets: 4, reps: "8" },
      ],
      "x",
    );
    const { days } = read(doc).train;
    expect(days.mon?.exercises.map((e) => formatPrescription(e))).toEqual([
      "5 × 5 · 80 kg",
      "3 × 45 s",
    ]);
    expect(days.fri).toEqual({
      title: "Entrenamiento",
      exercises: [{ id: "x3", name: "Press banca", sets: 4, reps: "8" }],
    });
    expect(changes.map((c) => [c.kind, c.module, c.day])).toEqual([
      ["add", "train", "mon"],
      ["add", "train", "fri"],
    ]);
    expect(changes.map((c) => kernel.describe(c, "es"))).toEqual([
      "Pierna y core · 2 ejercicios",
      "Press banca · 4 × 8",
    ]);
  });

  it("keeps the move the assistant picked and drops slugs the library does not know", () => {
    const { doc } = run(week(), [
      {
        op: "train.workout.set",
        day: "thu",
        title: "Espalda",
        time: "19:00",
        exercises: [
          { name: "Remo con barra", sets: 4, reps: "6-8", move: "barbell-row" },
          { name: "Jalón raro", sets: 3, move: "made-up-move" },
        ],
      },
      { op: "train.exercise.add", day: "thu", name: "Curl martillo", move: "hammer-curl" },
    ]);
    expect(read(doc).train.days.thu).toEqual({
      title: "Espalda",
      time: "19:00",
      exercises: [
        { id: "id1", name: "Remo con barra", sets: 4, reps: "6-8", move: "barbell-row" },
        { id: "id2", name: "Jalón raro", sets: 3 },
        { id: "id3", name: "Curl martillo", move: "hammer-curl" },
      ],
    });
  });

  it("drops a stale move when an exercise is renamed without a new one", () => {
    const start = week((w) => {
      w.train.days.mon = {
        title: "Pecho",
        exercises: [{ id: "e1", name: "Press banca", sets: 4, move: "bench-press" }],
      };
    });
    const first = (ops: Parameters<typeof run>[1]) =>
      read(run(start, ops).doc).train.days.mon?.exercises[0];

    expect(first([{ op: "train.exercise.update", id: "e1", name: "Fondos" }])).toEqual({
      id: "e1",
      name: "Fondos",
      sets: 4,
    });
    expect(
      first([{ op: "train.exercise.update", id: "e1", name: "Fondos", move: "dip" }])?.move,
    ).toBe("dip");
    expect(first([{ op: "train.exercise.update", id: "e1", sets: 5 }])?.move).toBe("bench-press");
    expect(first([{ op: "train.exercise.update", id: "e1", move: null }])?.move).toBeUndefined();
  });

  it("sets, changes and clears the workout time", () => {
    const start = week((w) => {
      w.train.days.tue = { title: "Pierna", exercises: [] };
    });
    const timed = run(start, [{ op: "train.workout.update", day: "tue", time: "7:30" }]);
    expect(read(timed.doc).train.days.tue?.time).toBe("07:30");
    const cleared = run(timed.doc, [{ op: "train.workout.update", day: "tue", time: null }]);
    expect(read(cleared.doc).train.days.tue).toEqual({ title: "Pierna", exercises: [] });
  });

  it("rejects what names nothing and what would change nothing", () => {
    const { rejected } = run(week(), [
      { op: "train.workout.clear", day: "mon" },
      { op: "train.workout.update", day: "mon", title: "Pierna" },
      { op: "train.exercise.remove", id: "missing" },
    ]);
    expect(rejected.map((r) => [r.op, r.reason])).toEqual([
      ["train.workout.clear", "noop"],
      ["train.workout.update", "not_found"],
      ["train.exercise.remove", "not_found"],
    ]);
  });

  it("accepts sets as text and reps as numbers", () => {
    expect(
      kernel.parse([
        { op: "train.exercise.add", day: "wed", name: "Bench press", sets: "4", reps: 8 },
      ]).operations,
    ).toEqual([{ op: "train.exercise.add", day: "wed", name: "Bench press", sets: 4, reps: "8" }]);
  });
});

describe("session length", () => {
  it("reads durations written as reps", () => {
    expect(durationMinutes("30 min")).toBe(30);
    expect(durationMinutes("45 s")).toBe(0.75);
    expect(durationMinutes("30-45 s")).toBe(0.5);
    expect(durationMinutes("1 h")).toBe(60);
    expect(durationMinutes("8-10")).toBeUndefined();
    expect(durationMinutes(undefined)).toBeUndefined();
  });

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

  it("places a timed workout on the day's timeline with its estimated length", () => {
    const start = week((w) => {
      w.train.days.mon = {
        title: "Pierna",
        time: "19:00",
        exercises: [{ id: "sq", name: "Sentadilla", sets: 5 }],
      };
      w.train.days.tue = { title: "Sin hora", exercises: [] };
    });
    const t = kernel.messages(train, "es");
    const facts = { lang: "es", t, record: () => undefined };
    const state = read(start).train;
    expect(train.week!.timeline!(state, "mon", facts).spans).toEqual([
      { id: "workout", title: "Pierna", start: 1140, end: 1165, open: true, icon: true },
    ]);
    expect(train.week!.timeline!(state, "tue", facts).spans).toBeUndefined();
    expect(train.week!.load!(state, "tue")).toBe(1);
    expect(train.week!.summary!(state, null, t)).toBe("2 entrenos · 1 ejercicio");
  });
});

describe("move catalogue for the assistant", () => {
  it("lists every move slug once so the model can link exercises to illustrations", () => {
    const slugs = MOVE_CATALOGUE.split("\n").flatMap((line) => line.split(": ")[1]!.split(", "));
    expect(slugs).toHaveLength(302);
    expect(new Set(slugs).size).toBe(302);
    expect(MOVE_CATALOGUE).toMatch(/^chest: bench-press, /);
    expect(train.assistant.reference!()).toContain("hammer-curl");
  });
});
