import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EQUIPMENT,
  getMove,
  isMoveSlug,
  matchMove,
  MOVE_FRAMES,
  MOVE_SLUG_PATTERN,
  MOVES,
  MUSCLE_GROUPS,
  muscleLoad,
  resolveMove,
  topMuscles,
} from "../src";

const publicMoves = new URL("../../../apps/web/public/moves/", import.meta.url);

describe("move library", () => {
  it("has 302 moves with unique, valid slugs and known muscles and equipment", () => {
    expect(MOVES).toHaveLength(302);
    expect(new Set(MOVES.map((m) => m.slug)).size).toBe(MOVES.length);
    for (const move of MOVES) {
      expect(move.slug).toMatch(MOVE_SLUG_PATTERN);
      expect(EQUIPMENT).toContain(move.equipment);
      expect(move.primary.length).toBeGreaterThan(0);
      for (const group of [...move.primary, ...move.secondary])
        expect(MUSCLE_GROUPS).toContain(group);
    }
  });

  it("ships the three frames of every move", () => {
    for (const move of MOVES) {
      for (const frame of MOVE_FRAMES) {
        expect(existsSync(new URL(`${move.slug}/${frame}.svg`, publicMoves)), move.slug).toBe(true);
      }
    }
  });

  it("looks moves up by slug", () => {
    expect(getMove("bench-press")).toMatchObject({
      name: "Bench Press",
      equipment: "barbell",
      primary: ["chest"],
      secondary: ["triceps", "shoulders"],
    });
    expect(getMove("not-a-move")).toBeUndefined();
    expect(isMoveSlug("hammer-curl")).toBe(true);
    expect(isMoveSlug("Hammer Curl")).toBe(false);
  });
});

describe("matchMove", () => {
  const cases: [string, string | string[]][] = [
    // The routine that prompted the move library.
    ["Press de banca con barra", "bench-press"],
    ["Press inclinado con mancuernas", "incline-dumbbell-press"],
    ["Aperturas con mancuernas", "dumbbell-fly"],
    ["Press cerrado con barra", "close-grip-bench-press"],
    ["Extensión de tríceps con mancuerna", "dumbbell-overhead-tricep-extension"],
    ["Sentadilla con barra", "squat"],
    ["Peso muerto rumano con mancuernas", "dumbbell-romanian-deadlift"],
    ["Zancadas con mancuernas", ["walking-lunge", "reverse-lunge"]],
    ["Hip thrust con barra", "hip-thrust"],
    ["Plancha", "plank"],
    ["Remo con barra", "barbell-row"],
    ["Remo inclinado con mancuernas", "dumbbell-bent-over-row"],
    ["Curl de bíceps con barra", ["ez-bar-curl", "bicep-curl"]],
    ["Curl martillo con mancuernas", "hammer-curl"],
    // Common Spanish names.
    ["Dominadas", "pull-up"],
    ["Fondos", "dip"],
    ["Press militar", "overhead-press"],
    ["Elevaciones laterales", "lateral-raise"],
    ["Jalón al pecho", "lat-pulldown"],
    ["Remo en polea baja", "seated-row"],
    ["Curl femoral tumbado", "lying-leg-curl"],
    ["Extensión de cuádriceps", "leg-extension"],
    ["Prensa", "leg-press"],
    ["Gemelos", "calf-raise"],
    ["Abdominales", "crunch"],
    ["Plancha lateral", "side-plank"],
    ["Sentadilla búlgara", "bulgarian-split-squat"],
    ["Tríceps en polea", "tricep-pushdown"],
    ["Press de hombros con mancuernas sentado", "seated-dumbbell-press"],
    ["Elevación de piernas colgado", "hanging-leg-raise"],
    ["Correr 5 km", "running"],
    ["Bici estática", "cycling"],
    ["Natación", "swimming"],
    ["Comba", "jump-rope"],
    // English, abbreviations and plurals.
    ["Barbell Bench Press", "bench-press"],
    ["DB shoulder press", ["seated-dumbbell-press", "standing-dumbbell-press"]],
    ["Pull-ups", "pull-up"],
    ["Skullcrushers", "skull-crusher"],
    ["RDL", "romanian-deadlift"],
  ];

  it.each(cases)("%s → %s", (name, expected) => {
    const slug = matchMove(name)?.slug;
    if (Array.isArray(expected)) expect(expected).toContain(slug);
    else expect(slug).toBe(expected);
  });

  it("returns nothing for things that are not exercises", () => {
    expect(matchMove("Teletrabajo")).toBeUndefined();
    expect(matchMove("Pádel con Marta")).toBeUndefined();
    expect(matchMove("")).toBeUndefined();
  });

  it("prefers the exercise's own move over its name", () => {
    expect(resolveMove({ name: "Press de banca", move: "push-up" })?.slug).toBe("push-up");
    expect(resolveMove({ name: "Press de banca", move: "gone" })?.slug).toBe("bench-press");
  });
});

describe("muscleLoad", () => {
  it("weighs primary muscles by sets and secondary muscles by half", () => {
    const load = muscleLoad([
      { name: "Remo con barra", sets: 4 },
      { name: "Curl martillo", sets: 2 },
    ]);
    // Rows: lats + upper back 4, biceps and rear delts 2. Hammer curls: biceps 2, forearms 1.
    expect(load.lats).toBe(1);
    expect(load["upper-back"]).toBe(1);
    expect(load.biceps).toBe(1);
    expect(load.forearms).toBe(0.25);
    expect(topMuscles(load, 3)).toEqual(["biceps", "upper-back", "lats"]);
  });

  it("ignores exercises without a move and never reports cardio as a muscle", () => {
    const load = muscleLoad([{ name: "Teletrabajo" }, { name: "Correr", move: "running" }]);
    expect(load.cardio).toBeGreaterThan(0);
    expect(topMuscles(load)).not.toContain("cardio");
  });
});
