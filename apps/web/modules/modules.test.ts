import { manifestOf, systemPrompt, userPrompt } from "@tukkteam/modules";
import { checkModule } from "@tukkteam/modules/testing";
import { weekLoads } from "@tukkteam/modules/week";
import { describe, expect, it } from "vitest";
import { locales } from "@/lib/i18n/config";
import { createAppKernel, kernel, MODULES } from "./index";
import { upgradeV1 } from "./legacy/plan-v1";
import { open, read, run, week } from "./test-kit";

describe("every module honours the contract", () => {
  it.each(MODULES.map((module) => [module.id, module] as const))("%s", (_id, module) => {
    expect(checkModule(module, { locales, kernel: createAppKernel })).toEqual([]);
  });

  it("can be listed as plain data", () => {
    const manifests = MODULES.map((module) => manifestOf(module));
    expect(new Set(manifests.map((manifest) => manifest.id)).size).toBe(MODULES.length);
    expect(JSON.parse(JSON.stringify(manifests))).toEqual(manifests);
    expect(manifestOf(kernel.get("fuel")!).records).toEqual(["fuel.pick"]);
  });
});

describe("whole days across modules", () => {
  const start = week((w) => {
    w.agenda.days.mon.push({ id: "work", title: "Trabajo", time: "09:00" });
    w.fuel.days.mon.meals.push({ id: "lunch", slot: "lunch", title: "Táper" });
    w.agenda.days.tue.push({ id: "old", title: "Viejo" });
    w.agenda.days.sun.push({ id: "a", title: "Brunch" });
    w.train.days.sun = { title: "Rodaje", exercises: [{ id: "e", name: "Correr 5 km" }] };
    w.fuel.days.sun.meals.push({ id: "m", slot: "dinner", title: "Cena fuera" });
    w.notes.days.sun = "Día tranquilo";
  });

  it("copies a day to several days with fresh ids, only in the modules named", () => {
    const { doc, changes } = run(
      start,
      [{ op: "day.copy", from: "mon", to: ["tue", "wed"], modules: ["agenda"] }],
      "c",
    );
    const state = read(doc);
    expect(state.agenda.days.tue).toEqual([{ id: "c1", title: "Trabajo", time: "09:00" }]);
    expect(state.agenda.days.wed).toEqual([{ id: "c2", title: "Trabajo", time: "09:00" }]);
    expect(state.fuel.days.tue.meals).toEqual([]);
    expect(changes.map((c) => `${c.kind}:${c.day}:${c.label}`)).toEqual([
      "remove:tue:Viejo",
      "add:tue:Trabajo",
      "add:wed:Trabajo",
    ]);
  });

  it("clears a whole day in every module that plans it, and leaves the note", () => {
    const { doc, changes } = run(start, [{ op: "day.clear", day: "sun" }]);
    const state = read(doc);
    expect(state.agenda.days.sun).toEqual([]);
    expect(state.train.days.sun).toBeNull();
    expect(state.fuel.days.sun).toEqual({ meals: [] });
    expect(state.notes.days.sun).toBe("Día tranquilo");
    expect(changes.map((c) => `${c.kind}:${c.module}`)).toEqual([
      "remove:agenda",
      "remove:train",
      "remove:fuel",
    ]);
  });

  it("still understands the categories of plan version 1", () => {
    const { doc } = run(start, [{ op: "day.clear", day: "sun", categories: ["train"] }]);
    expect(read(doc).train.days.sun).toBeNull();
    expect(read(doc).agenda.days.sun).toHaveLength(1);
  });

  it("skips operations it cannot apply and keeps the rest", () => {
    const { doc, changes, rejected } = run(week(), [
      { op: "agenda.remove", id: "missing" },
      { op: "workout.clear", day: "mon" },
      { op: "agenda.add", day: "mon", title: "Leer" },
    ]);
    expect(rejected).toEqual([
      { index: 0, op: "agenda.remove", reason: "not_found" },
      { index: 1, op: "train.workout.clear", reason: "noop" },
    ]);
    expect(read(doc).agenda.days.mon).toHaveLength(1);
    expect(changes).toHaveLength(1);
  });

  it("measures each day from the modules on screen", () => {
    const loads = weekLoads(kernel, start);
    expect(loads.sun).toEqual({
      count: 3,
      ratio: 1,
      parts: [
        { module: "agenda", count: 1 },
        { module: "train", count: 1 },
        { module: "fuel", count: 1 },
      ],
    });
    expect(loads.mon.count).toBe(2);
    expect(loads.wed).toEqual({ count: 0, ratio: 0, parts: [] });
    const withoutMeals = run(start, [{ op: "layout.remove", module: "Comidas" }]).doc;
    expect(weekLoads(kernel, withoutMeals).sun.count).toBe(2);
  });
});

describe("plans from before modules", () => {
  const v1 = {
    schemaVersion: 1,
    days: {
      mon: {
        agenda: [{ id: "a1", title: "Trabajo", time: "09:00", endTime: "18:00" }],
        workout: {
          title: "Pierna",
          time: "19:00",
          exercises: [{ id: "e1", name: "Sentadilla", sets: 5, reps: "5", move: "squat" }],
        },
        meals: [{ id: "m1", slot: "breakfast", title: "Avena" }],
        menu: { dinner: [{ id: "o1", title: "Pizza" }] },
        note: "Empieza la semana",
      },
      tue: { agenda: [], workout: null, meals: [] },
      wed: { agenda: [], workout: null, meals: [] },
      thu: { agenda: [], workout: null, meals: [] },
      fri: { agenda: [], workout: null, meals: [] },
      sat: { agenda: [], workout: null, meals: [] },
      sun: { agenda: [], workout: null, meals: [] },
    },
    menu: { lunch: { options: [{ id: "o2", title: "Lentejas" }], days: ["mon", "tue"] } },
  };

  it("become a document made of modules, losing nothing", () => {
    const doc = open(v1);
    expect(doc.schemaVersion).toBe(2);
    expect(doc.layout).toEqual(["agenda", "fuel", "train", "notes"]);
    expect([...kernel.unreadable(doc)]).toEqual([]);
    const state = read(doc);
    expect(state.agenda.days.mon).toEqual(v1.days.mon.agenda);
    expect(state.train.days.mon).toEqual(v1.days.mon.workout);
    expect(state.train.days.tue).toBeNull();
    expect(state.fuel.days.mon).toEqual({ meals: v1.days.mon.meals, menu: v1.days.mon.menu });
    expect(state.fuel.days.tue).toEqual({ meals: [] });
    expect(state.fuel.menu).toEqual(v1.menu);
    expect(state.notes.days).toEqual({ mon: "Empieza la semana" });
  });

  it("leave Notes off the screen when no day has a note", () => {
    const plain = structuredClone(v1);
    delete (plain.days.mon as { note?: string }).note;
    expect(open(plain).layout).toEqual(["agenda", "fuel", "train"]);
  });

  it("start blank when nothing was planned, so the person chooses their modules", () => {
    const blank = structuredClone(v1);
    blank.days.mon = { agenda: [], workout: null, meals: [] } as never;
    delete (blank as { menu?: unknown }).menu;
    expect(kernel.read(blank)).toEqual({ schemaVersion: 2, layout: [], modules: {} });
  });

  it("are refused when they do not validate whole, rather than guessed at", () => {
    // Upgrading the days that validate and dropping the rest would look like a plan, and the
    // first save would make the loss permanent. Not a document: the app says so and saves nothing.
    const damaged = structuredClone(v1);
    (damaged.days.tue as { agenda: unknown }).agenda = "nope";
    expect(upgradeV1(damaged)).toBeNull();
    expect(kernel.read(damaged)).toBeNull();
    expect(upgradeV1({ schemaVersion: 3 })).toBeNull();
    expect(kernel.read({ schemaVersion: 3, layout: [], modules: {} })).toBeNull();
  });
});

describe("what the assistant is told", () => {
  const host = { intro: "You edit a weekly plan.", rules: ["Change only what was asked."] };

  it("includes every module's operations and the move library only when Training is on screen", () => {
    const withTraining = systemPrompt(kernel, host, { onScreen: ["agenda", "train"] });
    expect(withTraining).toContain('{"op":"agenda.add","day":"mon","title":"Yoga"');
    expect(withTraining).toContain('{"op":"train.workout.set"');
    expect(withTraining).toContain('{"op":"fuel.pick"');
    expect(withTraining).toContain('{"op":"notes.set"');
    expect(withTraining).toContain('{"op":"layout.add"');
    expect(withTraining).toContain('{"op":"day.copy"');
    expect(withTraining).toContain("hammer-curl");
    expect(systemPrompt(kernel, host, { onScreen: ["agenda"] })).not.toContain("hammer-curl");
  });

  it("shows the plan of the modules on screen, with the week's shared options", () => {
    const doc = run(week(), [
      { op: "agenda.add", day: "mon", title: "Yoga" },
      { op: "fuel.menu.set", slot: "lunch", options: ["Lentejas", "Wok"] },
    ]).doc;
    const prompt = userPrompt(kernel, { doc, input: "hola" });
    expect(prompt).toContain('"agenda":{"mon":[{"id":"id1","title":"Yoga"}]}');
    expect(prompt).toContain('"menu":{"lunch":{"options":[{"id":"id2","title":"Lentejas"}');
    expect(prompt).toContain('"train":{}');
  });
});
