import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createKernel,
  docJsonSchema,
  emptyDoc,
  manifestOf,
  parseOutput,
  sequentialIds,
  systemPrompt,
  userPrompt,
  type Doc,
} from "../src";
import { checkModule } from "../src/testing";
import { createWeekKernel, DayKeySchema, defineWeekModule, eachDay, weekLoads } from "../src/week";
import { faulty, note, operation, record, tasks, type TaskMessages, type Tasks } from "./toy";

const locales = ["es", "en"] as const;
const kernel = createWeekKernel({ modules: [tasks, note], locales });
const ids = () => ({ newId: sequentialIds("t") });

/** A document built by hand, the way stored JSON arrives. */
function docWith(build: (doc: Doc) => void): Doc {
  const doc = emptyDoc(["tasks"]);
  build(doc);
  return doc;
}

/** Read stored JSON the test knows to be a document. */
function read(raw: unknown, from: { read(raw: unknown): Doc | null } = kernel): Doc {
  const doc = from.read(raw);
  if (!doc) throw new Error("Not a document");
  return doc;
}

describe("documents", () => {
  it("starts empty, with nothing on screen", () => {
    expect(kernel.empty()).toEqual({ schemaVersion: 2, layout: [], modules: {} });
    expect(kernel.state(kernel.empty(), tasks).days.mon).toEqual([]);
  });

  it("reads a stored document and keeps data of modules it does not know", () => {
    const stored = {
      schemaVersion: 2,
      layout: ["tasks", "gone"],
      modules: {
        tasks: { v: 1, data: tasks.empty() },
        gone: { v: 3, data: { anything: [1, 2, 3] } },
      },
    };
    const doc = read(stored);
    expect(doc.modules.gone).toEqual({ v: 3, data: { anything: [1, 2, 3] } });
    expect(kernel.onScreen(doc).map((module) => module.id)).toEqual(["tasks"]);
    const { doc: next } = kernel.apply(doc, [{ op: "tasks.add", day: "mon", title: "Leer" }]);
    expect(next.modules.gone).toEqual(stored.modules.gone);
    expect(next.layout).toEqual(["tasks", "gone"]);
  });

  it("does not guess at an envelope that does not validate", () => {
    // A newer kernel may have written what this one does not know. Keeping "what can be kept"
    // would show the rest as empty, and the next save would make that loss permanent.
    const entry = { v: 1, data: tasks.empty() };
    const strangers = [
      { schemaVersion: 2 },
      { schemaVersion: 2, layout: ["tasks"], modules: { tasks: entry }, extra: true },
      { schemaVersion: 2, layout: ["tasks"], modules: { tasks: { ...entry, meta: {} } } },
      { schemaVersion: 2, layout: ["tasks", "Not An Id"], modules: { tasks: entry } },
      { schemaVersion: 2, layout: ["tasks"], modules: { tasks: entry, broken: "nope" } },
      { schemaVersion: 2, layout: Array.from({ length: 25 }, (_, i) => `m${i}x`), modules: {} },
    ];
    for (const raw of strangers) expect(kernel.read(raw)).toBeNull();
  });

  it("uses the upgrade hook for documents from before the envelope", () => {
    const upgrading = createKernel({
      modules: [note],
      locales,
      upgrade: (raw) =>
        (raw as { legacy?: string }).legacy
          ? {
              schemaVersion: 2,
              layout: ["note"],
              modules: { note: { v: 2, data: { text: (raw as { legacy: string }).legacy } } },
            }
          : null,
    });
    expect(upgrading.state(read({ legacy: "hola" }, upgrading), note)).toEqual({ text: "hola" });
    expect(upgrading.read({ other: true })).toBeNull();
  });

  it("says so when something is not a document, and never makes up an empty one", () => {
    const strangers = [
      "garbage",
      null,
      undefined,
      7,
      [],
      {},
      { schemaVersion: 1, days: {} },
      { schemaVersion: 2 },
      { schemaVersion: 3, layout: [], modules: {} },
    ];
    for (const raw of strangers) expect(kernel.read(raw)).toBeNull();
  });

  it("hands out frozen documents and leaves alone what it was given", () => {
    const stored = {
      schemaVersion: 2,
      layout: ["tasks"],
      modules: { tasks: { v: 1, data: tasks.empty() } },
    };
    const doc = read(stored);
    expect(Object.isFrozen(stored.modules.tasks.data.days.mon)).toBe(false);
    expect(Object.isFrozen(doc)).toBe(true);
    expect(() => kernel.state(doc, tasks).days.mon.push({ id: "x", title: "x" })).toThrow();
    expect(() => doc.layout.push("note")).toThrow();

    const next = kernel.apply(doc, [{ op: "tasks.add", day: "mon", title: "Leer" }]).doc;
    expect(Object.isFrozen(kernel.state(next, tasks).days.mon[0])).toBe(true);
    expect(kernel.state(doc, tasks).days.mon).toEqual([]);
    // The data of a module nobody has used is frozen too: it is the same for everyone.
    expect(Object.isFrozen(kernel.state(kernel.empty(), tasks).days.mon)).toBe(true);
    expect(() => kernel.empty(["tasks"]).layout.push("note")).toThrow();
  });

  it("never shares what empty() returns between two documents", () => {
    const shared = eachDay<Tasks["days"]["mon"]>(() => []);
    const lazy = defineWeekModule<Tasks, TaskMessages>({
      ...tasks,
      empty: () => ({ days: shared }),
    });
    const sharing = createWeekKernel({ modules: [lazy], locales });
    const one = sharing.apply(sharing.empty(), [{ op: "tasks.add", day: "mon", title: "Leer" }]);
    expect(sharing.state(one.doc, lazy).days.mon).toHaveLength(1);
    expect(shared.mon).toEqual([]);
    expect(Object.isFrozen(shared.mon)).toBe(false);
    expect(sharing.state(sharing.empty(), lazy).days.mon).toEqual([]);
    expect(checkModule(lazy, { locales }).join("\n")).toMatch(/nothing shared between two calls/);
  });

  it("migrates data written by an older version of a module", () => {
    const doc = read({
      schemaVersion: 2,
      layout: ["note"],
      modules: { note: { v: 1, data: { body: "Comprar flores" } } },
    });
    expect(doc.modules.note).toEqual({ v: 2, data: { text: "Comprar flores" } });
  });

  it("keeps data as stored when a migration throws or returns what the module rejects", () => {
    const stored = {
      schemaVersion: 2,
      layout: ["note"],
      modules: { note: { v: 1, data: { body: "Comprar flores" } } },
    };
    const migrations: ((data: unknown) => unknown)[] = [
      () => ({ text: 5 }),
      () => "nothing",
      () => {
        throw new Error("boom");
      },
    ];
    for (const migrate of migrations) {
      const careless = createKernel({ modules: [{ ...note, migrate }], locales });
      const doc = read(stored, careless);
      expect(doc.modules.note).toEqual(stored.modules.note);
      expect(careless.unreadable(doc).has("note")).toBe(true);
      const result = careless.apply(doc, [{ op: "note.set", text: "Hola" }]);
      expect(result.doc.modules.note).toEqual(stored.modules.note);
    }
  });

  it("sets aside data it cannot read: never shown, never written, never lost", () => {
    const stored = {
      schemaVersion: 2,
      layout: ["tasks", "note"],
      modules: {
        tasks: { v: 1, data: { days: "damaged" } },
        note: { v: 9, data: { future: true } },
      },
    };
    const doc = read(stored);
    expect([...kernel.unreadable(doc)].sort()).toEqual(["note", "tasks"]);
    expect(kernel.state(doc, tasks)).toEqual(tasks.empty());
    const result = kernel.apply(doc, [
      { op: "tasks.add", day: "mon", title: "Leer" },
      { op: "note.set", text: "Hola" },
    ]);
    expect(result.rejected.map((r) => r.reason)).toEqual(["unavailable", "unavailable"]);
    expect(result.doc).toBe(doc);
    expect(result.doc.modules).toEqual(stored.modules);
    expect(userPrompt(kernel, { doc, input: "x" })).toContain("Current plan as json:\n{}");
  });

  it("describes the envelope as JSON Schema without naming any module", () => {
    const schema = JSON.stringify(docJsonSchema());
    expect(schema).toContain('"schemaVersion"');
    expect(schema).toContain('"layout"');
    expect(schema).not.toContain("tasks");
  });
});

describe("operations", () => {
  it("applies operations without touching the document it was given", () => {
    const start = kernel.empty(["tasks"]);
    const snapshot = structuredClone(start);
    const { doc, changes } = kernel.apply(
      start,
      [
        { op: "tasks.add", day: "wed", title: "Pádel", time: "18:30" },
        { op: "tasks.add", day: "wed", title: "Yoga", time: "7:30" },
      ],
      ids(),
    );
    expect(start).toEqual(snapshot);
    expect(kernel.state(doc, tasks).days.wed).toEqual([
      { id: "t2", title: "Yoga", time: "07:30" },
      { id: "t1", title: "Pádel", time: "18:30" },
    ]);
    expect(changes).toEqual([
      { kind: "add", module: "tasks", day: "wed", label: "Pádel", data: { time: "18:30" } },
      { kind: "add", module: "tasks", day: "wed", label: "Yoga", data: { time: "07:30" } },
    ]);
  });

  it("returns the same document when nothing changed", () => {
    const start = kernel.empty(["tasks"]);
    const result = kernel.apply(start, [{ op: "tasks.remove", id: "missing" }]);
    expect(result.doc).toBe(start);
    expect(result.rejected).toEqual([{ index: 0, op: "tasks.remove", reason: "not_found" }]);
  });

  it("refuses a line in the receipt for something saved exactly as it was", () => {
    const start = kernel.apply(
      kernel.empty(),
      [{ op: "tasks.add", day: "mon", title: "Leer", time: "09:00" }],
      ids(),
    ).doc;
    // The module reports an update whatever it is given; the kernel looks at the data.
    const result = kernel.apply(start, [
      { op: "tasks.update", id: "t1" },
      { op: "tasks.update", id: "t1", title: "Leer", time: "9:00" },
      { op: "tasks.update", id: "t1", time: "10:00" },
    ]);
    expect(result.rejected).toEqual([
      { index: 0, op: "tasks.update", reason: "noop" },
      { index: 1, op: "tasks.update", reason: "noop" },
    ]);
    expect(result.changes).toEqual([
      { kind: "update", module: "tasks", day: "mon", label: "Leer" },
    ]);
    // Stored JSON comes back from a database with its keys in another order: still the same.
    const reordered = read({
      schemaVersion: 2,
      layout: ["tasks"],
      modules: {
        tasks: {
          data: {
            days: { ...tasks.empty().days, mon: [{ time: "09:00", title: "Leer", id: "t1" }] },
          },
          v: 1,
        },
      },
    });
    const again = kernel.apply(reordered, [{ op: "tasks.update", id: "t1", title: "Leer" }]);
    expect(again.rejected.map((r) => r.reason)).toEqual(["noop"]);
    expect(again.doc).toBe(reordered);
    // An operation of a module that is off screen and changes nothing does not put it on screen.
    const hidden = kernel.apply(start, [{ op: "layout.remove", module: "tasks" }]).doc;
    expect(kernel.apply(hidden, [{ op: "tasks.update", id: "t1" }]).doc).toBe(hidden);
  });

  it("skips what cannot apply and keeps the rest", () => {
    const many = Array.from({ length: 4 }, (_, i) => ({
      op: "tasks.add",
      day: "mon",
      title: `Cosa ${i}`,
    }));
    const { doc, rejected } = kernel.apply(kernel.empty(["tasks"]), [
      ...many,
      { op: "tasks.add", day: "someday", title: "?" },
      { op: "nope.add" },
    ]);
    expect(kernel.state(doc, tasks).days.mon).toHaveLength(3);
    expect(rejected).toEqual([
      { index: 3, op: "tasks.add", reason: "limit" },
      { index: 4, op: "tasks.add", reason: "invalid" },
      { index: 5, op: "nope.add", reason: "unavailable" },
    ]);
  });

  it("uses the module's strings in the person's language for defaults", () => {
    const es = kernel.apply(kernel.empty(), [{ op: "tasks.add", day: "mon" }], { lang: "es" });
    const en = kernel.apply(kernel.empty(), [{ op: "tasks.add", day: "mon" }], { lang: "en" });
    expect(kernel.state(es.doc, tasks).days.mon[0]?.title).toBe("Tarea");
    expect(kernel.state(en.doc, tasks).days.mon[0]?.title).toBe("Task");
  });

  it("puts a module on screen when one of its operations applies", () => {
    const { doc, changes } = kernel.apply(kernel.empty(["note"]), [
      { op: "tasks.add", day: "mon", title: "Leer" },
    ]);
    expect(doc.layout).toEqual(["note", "tasks"]);
    expect(changes.map((c) => [c.kind, c.module, c.label])).toEqual([
      ["add", "app", "tasks"],
      ["add", "tasks", "Leer"],
    ]);
  });

  it("accepts other spellings of operation names", () => {
    const aliased = createWeekKernel({
      modules: [tasks],
      locales,
      aliases: { "todo.add": "tasks.add" },
    });
    const parsed = aliased.parse([
      { op: "TODO_ADD", day: "Lunes", title: "Leer" },
      { op: "tasks_add", day: "martes", title: "Correr" },
    ]);
    expect(parsed.operations).toEqual([
      { op: "tasks.add", day: "mon", title: "Leer" },
      { op: "tasks.add", day: "tue", title: "Correr" },
    ]);
  });

  it("never lets another spelling take an operation away from a module", () => {
    const shadowed = createWeekKernel({
      modules: [tasks, note],
      locales,
      aliases: { "tasks.add": "note.set" },
    });
    const result = shadowed.apply(shadowed.empty(), [
      { op: "tasks.add", day: "mon", title: "Leer" },
      // Not another spelling of anything: every object inherits a property by this name.
      { op: "constructor", text: "x" },
    ]);
    expect(shadowed.state(result.doc, tasks).days.mon).toHaveLength(1);
    expect(result.rejected).toEqual([{ index: 1, op: "constructor", reason: "unavailable" }]);
  });

  it("counts what the cap on one answer leaves out", () => {
    const capped = createWeekKernel({ modules: [tasks], locales, maxOperations: 2 });
    const parsed = capped.parse(Array.from({ length: 5 }, () => ({ op: "tasks.add", day: "mon" })));
    expect(parsed.operations).toHaveLength(2);
    expect(parsed.dropped).toBe(3);
  });

  it("validates an operation once, however it arrives", () => {
    const shouting = defineWeekModule<Tasks, TaskMessages>({
      ...tasks,
      operations: {
        shout: operation({
          input: z.object({ day: DayKeySchema, title: z.string().transform((s) => `${s}!`) }),
          examples: [{ fields: { day: "mon", title: "Hey" } }],
          apply(state, input, ctx) {
            state.days[input.day].push({ id: ctx.newId(), title: input.title });
            ctx.change({ kind: "add", day: input.day, label: input.title });
          },
        }),
      },
    });
    const loud = createWeekKernel({ modules: [shouting], locales });
    const parsed = loud.parse([{ op: "tasks.shout", day: "lunes", title: "Hey" }]);
    expect(parsed.operations).toEqual([{ op: "tasks.shout", day: "mon", title: "Hey!" }]);
    const spoken = loud.apply(loud.empty(), parsed.operations);
    expect(loud.state(spoken.doc, shouting).days.mon[0]?.title).toBe("Hey!");
    const typed = loud.apply(loud.empty(), [{ op: "tasks.shout", day: "mon", title: "Hey" }]);
    expect(loud.state(typed.doc, shouting).days.mon[0]?.title).toBe("Hey!");
    // The contract still asks for parsing that can be repeated: saved operations are replayed.
    expect(checkModule(shouting, { locales }).join("\n")).toMatch(/not idempotent/);
  });
});

describe("a faulty module cannot damage the document", () => {
  const guarded = createWeekKernel({ modules: [faulty, note], locales });
  const start = guarded.apply(guarded.empty(), [{ op: "tasks.add", day: "mon", title: "Leer" }], {
    newId: sequentialIds("k"),
  }).doc;

  it("undoes an operation that throws half way", () => {
    const result = guarded.apply(start, [
      { op: "tasks.explode" },
      { op: "note.set", text: "Hola" },
    ]);
    expect(result.rejected).toEqual([{ index: 0, op: "tasks.explode", reason: "invalid" }]);
    expect(guarded.state(result.doc, faulty).days.mon).toEqual([{ id: "k1", title: "Leer" }]);
    expect(guarded.state(result.doc, note)).toEqual({ text: "Hola" });
  });

  it("refuses a change that has no line in the receipt", () => {
    const result = guarded.apply(start, [{ op: "tasks.silent" }]);
    expect(result.rejected).toEqual([{ index: 0, op: "tasks.silent", reason: "noop" }]);
    expect(result.doc).toBe(start);
  });

  it("undoes an operation that leaves data the module's schema rejects, and only that one", () => {
    const result = guarded.apply(start, [
      { op: "tasks.add", day: "tue", title: "Correr" },
      { op: "tasks.corrupt", day: "tue" },
      { op: "tasks.add", day: "tue", title: "Nadar" },
      { op: "note.set", text: "Hola" },
    ]);
    expect(guarded.state(result.doc, faulty).days.tue.map((task) => task.title)).toEqual([
      "Correr",
      "Nadar",
    ]);
    expect(result.rejected).toEqual([{ index: 1, op: "tasks.corrupt", reason: "invalid" }]);
    expect(result.changes.map((c) => `${c.module}:${c.label}`)).toEqual([
      "tasks:Correr",
      "tasks:Nadar",
      "app:note",
      "note:Hola",
    ]);
    expect(faulty.schema.safeParse(result.doc.modules.tasks?.data).success).toBe(true);
  });

  it("does not put a module on screen for an operation it had to undo", () => {
    const result = guarded.apply(guarded.empty(["note"]), [{ op: "tasks.corrupt", day: "mon" }]);
    expect(result.doc.layout).toEqual(["note"]);
    expect(result.doc.modules.tasks).toBeUndefined();
    expect(result.changes).toEqual([]);
  });

  it("keeps a screen change the person asked for when a later operation is undone", () => {
    const result = guarded.apply(start, [
      { op: "layout.remove", module: "tasks" },
      { op: "tasks.corrupt", day: "mon" },
    ]);
    expect(result.doc.layout).toEqual([]);
    expect(result.changes).toEqual([
      { kind: "remove", module: "app", scope: "app", label: "tasks" },
    ]);
    expect(result.rejected).toEqual([{ index: 1, op: "tasks.corrupt", reason: "invalid" }]);
  });

  it("undoes a whole-day operation in every module when one of them breaks", () => {
    const chores = defineWeekModule<Tasks, TaskMessages>({ ...tasks, id: "chores" });
    const clumsy = defineWeekModule<Tasks, TaskMessages>({
      ...tasks,
      week: {
        ...tasks.week,
        copyDay(state, _from, to, ctx) {
          (state.days as Record<string, unknown>)[to] = "broken";
          ctx.change({ kind: "add", day: to, label: "?" });
        },
      },
    });
    const pair = createWeekKernel({ modules: [chores, clumsy], locales });
    const filled = pair.apply(pair.empty(), [
      { op: "chores.add", day: "mon", title: "Barrer" },
      { op: "tasks.add", day: "mon", title: "Leer" },
    ]).doc;
    const result = pair.apply(filled, [{ op: "day.copy", from: "mon", to: ["tue"] }]);
    expect(result.rejected).toEqual([{ index: 0, op: "day.copy", reason: "invalid" }]);
    expect(result.doc).toBe(filled);
  });
});

describe("what only reads cannot change the plan", () => {
  const meddling = defineWeekModule<Tasks, TaskMessages>({
    ...tasks,
    records: {
      done: record({
        input: z.object({ day: DayKeySchema }),
        examples: [{ fields: { day: "mon" } }],
        resolve(state, input, ctx) {
          state.days[input.day].length = 0;
          ctx.write(
            { day: input.day, key: "all", value: true },
            { kind: "update", day: input.day, label: "all" },
          );
        },
      }),
    },
    assistant: {
      ...tasks.assistant,
      view(state) {
        state.days.mon.pop();
        return state;
      },
    },
    week: {
      ...tasks.week,
      load(state, day) {
        state.days[day].push({ id: "x", title: "x" });
        return 1;
      },
    },
  });
  const strict = createWeekKernel({ modules: [meddling], locales });
  const doc = strict.apply(strict.empty(), [{ op: "tasks.add", day: "mon", title: "Leer" }], {
    newId: sequentialIds("m"),
  }).doc;

  it("contains a hook, a view or a record operation that tries to", () => {
    const before = JSON.stringify(doc);
    expect(weekLoads(strict, doc).mon.count).toBe(0);
    expect(userPrompt(strict, { doc, input: "x" })).toContain("Current plan as json:\n{}");
    const records = strict.resolveRecords(doc, [{ op: "tasks.done", day: "mon" }], {
      get: () => undefined,
    });
    expect(records.rejected).toEqual([{ index: 0, op: "tasks.done", reason: "invalid" }]);
    expect(records.writes).toEqual([]);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it("is found by the conformance check", () => {
    const problems = checkModule(meddling, { locales }).join("\n");
    expect(problems).toMatch(/assistant\.view fails on .* data, or tries to change it/);
    expect(problems).toMatch(/a week hook fails on .* data, or tries to change it/);
    expect(problems).toMatch(/tries to change the plan/);
  });
});

describe("the screen", () => {
  const start = kernel.empty(["tasks"]);

  it("adds, moves and removes modules, by id or by name in any language", () => {
    const added = kernel.apply(start, [{ op: "layout.add", module: "Nota", position: 1 }]);
    expect(added.doc.layout).toEqual(["note", "tasks"]);
    expect(added.changes).toEqual([{ kind: "add", module: "app", scope: "app", label: "note" }]);

    const moved = kernel.apply(added.doc, [{ op: "layout.move", module: "tasks", position: "1" }]);
    expect(moved.doc.layout).toEqual(["tasks", "note"]);
    expect(moved.changes[0]).toMatchObject({ kind: "move", label: "tasks", data: { position: 1 } });

    const removed = kernel.apply(moved.doc, [{ op: "layout.remove", module: "Tasks" }]);
    expect(removed.doc.layout).toEqual(["note"]);
  });

  it("keeps a module's data when it leaves the screen and shows it again untouched", () => {
    const filled = kernel.apply(start, [{ op: "tasks.add", day: "mon", title: "Leer" }], ids()).doc;
    const hidden = kernel.apply(filled, [{ op: "layout.remove", module: "tasks" }]).doc;
    expect(hidden.layout).toEqual([]);
    expect(hidden.modules.tasks).toEqual(filled.modules.tasks);
    const back = kernel.apply(hidden, [{ op: "layout.add", module: "tasks" }]).doc;
    expect(kernel.state(back, tasks).days.mon).toEqual([{ id: "t1", title: "Leer" }]);
  });

  it("sets the whole screen at once and reports what changed", () => {
    const result = kernel.apply(kernel.empty(["tasks"]), [
      { op: "layout.set", modules: ["note", "tasks", "unknown"] },
    ]);
    expect(result.doc.layout).toEqual(["note", "tasks"]);
    expect(result.changes.map((c) => [c.kind, c.label])).toEqual([["add", "note"]]);

    const reordered = kernel.apply(result.doc, [{ op: "layout.set", modules: ["tasks", "note"] }]);
    expect(reordered.changes).toEqual([
      { kind: "move", module: "app", scope: "app", label: "", data: { order: ["tasks", "note"] } },
    ]);
  });

  it("keeps a receipt line as it was when later operations change the screen again", () => {
    const result = kernel.apply(kernel.empty(["tasks", "note"]), [
      { op: "layout.set", modules: ["note", "tasks"] },
      { op: "layout.move", module: "tasks", position: 1 },
    ]);
    expect(result.doc.layout).toEqual(["tasks", "note"]);
    expect(result.changes[0]?.data).toEqual({ order: ["note", "tasks"] });
  });

  it("leaves on screen the modules this build does not know when the screen is set", () => {
    // Another device runs a newer build with a module called "habits".
    const stored = read({
      schemaVersion: 2,
      layout: ["tasks", "habits", "note"],
      modules: { habits: { v: 1, data: { items: [] } } },
    });
    const result = kernel.apply(stored, [{ op: "layout.set", modules: ["note", "tasks"] }]);
    expect(result.doc.layout).toEqual(["note", "habits", "tasks"]);
    expect(result.changes.map((c) => c.kind)).toEqual(["move"]);
    const emptied = kernel.apply(stored, [{ op: "layout.set", modules: [] }]);
    expect(emptied.doc.layout).toEqual(["habits"]);
    expect(kernel.apply(emptied.doc, [{ op: "layout.set", modules: [] }]).rejected[0]?.reason).toBe(
      "noop",
    );
  });

  it("rejects what would change nothing or names nothing known", () => {
    const result = kernel.apply(start, [
      { op: "layout.add", module: "tasks" },
      { op: "layout.remove", module: "note" },
      { op: "layout.add", module: "spaceship" },
      { op: "layout.move", module: "tasks", position: 1 },
    ]);
    expect(result.rejected.map((r) => r.reason)).toEqual(["noop", "noop", "not_found", "noop"]);
  });
});

describe("whole days", () => {
  const start = docWith((doc) => {
    doc.modules.tasks = {
      v: 1,
      data: {
        days: {
          ...tasks.empty().days,
          mon: [{ id: "a", title: "Trabajo", time: "09:00" }],
          tue: [{ id: "b", title: "Viejo" }],
        },
      },
    };
  });

  it("copies a day onto others with new ids, replacing what they had", () => {
    const { doc, changes } = kernel.apply(
      start,
      [{ op: "day.copy", from: "lunes", to: "martes" }],
      ids(),
    );
    expect(kernel.state(doc, tasks).days.tue).toEqual([
      { id: "t1", title: "Trabajo", time: "09:00" },
    ]);
    expect(changes.map((c) => `${c.kind}:${c.day}:${c.label}`)).toEqual([
      "remove:tue:Viejo",
      "add:tue:Trabajo",
    ]);
  });

  it("clears a day, only in the modules named when given", () => {
    const cleared = kernel.apply(start, [{ op: "day.clear", day: "mon" }]);
    expect(kernel.state(cleared.doc, tasks).days.mon).toEqual([]);
    const shown = kernel.apply(start, [{ op: "layout.add", module: "note" }]).doc;
    const other = kernel.apply(shown, [{ op: "day.clear", day: "mon", modules: ["note"] }]);
    expect(other.rejected).toEqual([{ index: 0, op: "day.clear", reason: "noop" }]);
    const nothing = kernel.apply(start, [{ op: "day.clear", day: "sun" }]);
    expect(nothing.rejected[0]?.reason).toBe("noop");
  });

  it("leaves alone the modules that are off screen, even when they are named", () => {
    const hidden = kernel.apply(start, [{ op: "layout.remove", module: "tasks" }]).doc;
    const named = kernel.apply(hidden, [
      { op: "day.clear", day: "mon", modules: ["tasks"] },
      { op: "day.copy", from: "mon", to: ["wed"], modules: ["Tareas"] },
    ]);
    expect(named.rejected.map((r) => r.reason)).toEqual(["not_found", "not_found"]);
    const everything = kernel.apply(hidden, [
      { op: "day.clear", day: "mon" },
      { op: "day.copy", from: "mon", to: ["wed"] },
    ]);
    expect(everything.rejected.map((r) => r.reason)).toEqual(["noop", "noop"]);
    expect(everything.doc).toBe(hidden);
    expect(kernel.state(hidden, tasks).days.mon).toHaveLength(1);
  });

  it("measures how busy each day is from the modules on screen", () => {
    const loads = weekLoads(kernel, start);
    expect(loads.mon).toEqual({ count: 1, ratio: 1, parts: [{ module: "tasks", count: 1 }] });
    expect(loads.sun).toEqual({ count: 0, ratio: 0, parts: [] });
    const hidden = kernel.apply(start, [{ op: "layout.remove", module: "tasks" }]).doc;
    expect(weekLoads(kernel, hidden).mon.count).toBe(0);
  });
});

describe("dated facts", () => {
  const start = kernel.apply(
    kernel.empty(),
    [{ op: "tasks.add", day: "mon", title: "Leer" }],
    ids(),
  ).doc;

  it("keeps record operations apart from operations on the document", () => {
    const parsed = kernel.parse([
      { op: "tasks.done", day: "lunes", task: "leer" },
      { op: "tasks.add", day: "tue", title: "Correr" },
      { op: "tasks.done", day: "mon" },
    ]);
    expect(parsed.records).toEqual([{ op: "tasks.done", day: "mon", task: "leer", done: true }]);
    expect(parsed.operations).toHaveLength(1);
    expect(parsed.dropped).toBe(1);
    expect(kernel.apply(start, parsed.records).rejected[0]?.reason).toBe("unavailable");
  });

  it("resolves them to writes, seeing earlier writes of the same request", () => {
    const stored = new Map<string, boolean>();
    const result = kernel.resolveRecords(
      start,
      [
        { op: "tasks.done", day: "mon", task: "Leer" },
        { op: "tasks.done", day: "mon", task: "Leer" },
        { op: "tasks.done", day: "mon", task: "Leer", done: false },
        { op: "tasks.done", day: "mon", task: "Nadar" },
      ],
      { get: (module, day, key) => stored.get(`${module}|${day}|${key}`) },
    );
    expect(result.writes).toEqual([
      { module: "tasks", day: "mon", key: "t1", value: true, upcoming: false, index: 0 },
      { module: "tasks", day: "mon", key: "t1", value: null, upcoming: false, index: 2 },
    ]);
    expect(result.rejected.map((r) => [r.index, r.reason])).toEqual([
      [1, "noop"],
      [3, "not_found"],
    ]);
    expect(result.changes).toHaveLength(2);
  });

  it("tells the host when a record means the next time a day comes", () => {
    const planning = defineWeekModule<Tasks, TaskMessages>({
      ...tasks,
      records: { done: { ...tasks.records!.done!, upcoming: true } },
    });
    const ahead = createWeekKernel({ modules: [planning], locales });
    const doc = ahead.apply(
      ahead.empty(),
      [{ op: "tasks.add", day: "mon", title: "Leer" }],
      ids(),
    ).doc;
    const asked: boolean[] = [];
    const result = ahead.resolveRecords(doc, [{ op: "tasks.done", day: "mon", task: "Leer" }], {
      get: (_module, _day, _key, upcoming) => {
        asked.push(upcoming);
        return undefined;
      },
    });
    expect(asked).toEqual([true]);
    expect(result.writes).toEqual([
      { module: "tasks", day: "mon", key: "t1", value: true, upcoming: true, index: 0 },
    ]);
  });
});

describe("the assistant protocol", () => {
  const host = {
    intro: "You edit a weekly plan.",
    conventions: "Day keys are mon to sun.",
    rules: ["Change only what the user asks for."],
  };

  it("lists every operation with an example, the rules, and references of modules on screen", () => {
    const prompt = systemPrompt(kernel, host, { onScreen: ["tasks"] });
    expect(prompt).toContain("You edit a weekly plan.");
    expect(prompt).toContain("- tasks: tasks: per day, a list of { id, title, time }.");
    expect(prompt).toContain('{"op":"tasks.add","day":"mon","title":"Call mum","time":"18:00"}');
    expect(prompt).toContain(
      '{"op":"tasks.update","id":"<task id>","time":"19:00"}   only the fields that change',
    );
    expect(prompt).toContain(
      '{"op":"layout.add","module":"<module id>"}   puts a module on screen',
    );
    expect(prompt).toContain('{"op":"day.clear"');
    expect(prompt).toContain("1. Change only what the user asks for.\n2. A task title is short.");
    expect(prompt).toContain("Task reference text");
    expect(systemPrompt(kernel, host, { onScreen: [] })).not.toContain("Task reference text");
    expect(systemPrompt(kernel, host, { onScreen: [], lang: "es" })).toContain(
      '- tasks (the user calls it "Tareas"): tasks: per day',
    );
  });

  it("shows the model what is on screen and the data of those modules", () => {
    const doc = kernel.apply(
      kernel.empty(["tasks"]),
      [{ op: "tasks.add", day: "fri", title: "Leer" }],
      ids(),
    ).doc;
    const prompt = userPrompt(kernel, { header: "Today is Friday.", doc, input: 'di "hola"' });
    expect(prompt).toContain("Today is Friday.");
    expect(prompt).toContain("Modules on screen, in order: tasks. Not on screen: note.");
    expect(prompt).toContain('{"tasks":{"fri":[{"id":"t1","title":"Leer"}]}}');
    expect(prompt).toContain('Request from the user: "di \\"hola\\""');
    expect(prompt).toMatch(/json/);
  });

  it("reads a model answer, tolerating fences and dropping what does not validate", () => {
    const output = parseOutput(
      kernel,
      'Sure:\n```json\n{"operations":[{"op":"tasks_add","day":"Viernes","title":" Leer "},{"op":"tasks.add","day":"someday"},{"op":"tasks.done","day":"fri","task":"Leer"}],"reply":" Hecho. "}\n```',
    );
    expect(output).toEqual({
      operations: [{ op: "tasks.add", day: "fri", title: "Leer" }],
      records: [{ op: "tasks.done", day: "fri", task: "Leer", done: true }],
      dropped: 1,
      reply: "Hecho.",
    });
    expect(parseOutput(kernel, "not json")).toBeNull();
    expect(parseOutput(kernel, '{"reply":"¿Qué día?"}')).toEqual({
      operations: [],
      records: [],
      dropped: 0,
      reply: "¿Qué día?",
    });
  });

  it("leaves out what a module fails to provide and keeps the rest of the prompt", () => {
    const broken = defineWeekModule<Tasks, TaskMessages>({
      ...tasks,
      assistant: {
        ...tasks.assistant,
        reference: () => {
          throw new Error("boom");
        },
        view: () => {
          throw new Error("boom");
        },
      },
    });
    const patient = createWeekKernel({ modules: [broken, note], locales });
    const system = systemPrompt(patient, host, { onScreen: ["tasks", "note"] });
    expect(system).toContain('{"op":"tasks.add"');
    expect(system).not.toContain("Task reference text");
    const doc = patient.apply(patient.empty(), [
      { op: "tasks.add", day: "fri", title: "Leer" },
      { op: "note.set", text: "Hola" },
    ]).doc;
    expect(userPrompt(patient, { doc, input: "x" })).toContain('{"note":{"text":"Hola"}}');
  });
});

describe("the contract", () => {
  it("refuses to start with modules that break it", () => {
    expect(() => createKernel({ modules: [tasks, tasks], locales })).toThrow(/Duplicate module/);
    for (const id of ["layout", "day", "app", "constructor"])
      expect(() => createKernel({ modules: [{ ...tasks, id }], locales })).toThrow(/reserved/);
    expect(() => createKernel({ modules: [{ ...tasks, id: "My Tasks" }], locales })).toThrow(
      /Invalid module id/,
    );
    expect(() => createKernel({ modules: [tasks], locales: ["es", "fr"] })).toThrow(
      /no strings for "fr"/,
    );
  });

  it("passes the conformance check, and the check finds what is wrong", () => {
    expect(checkModule(tasks, { locales })).toEqual([]);
    expect(checkModule(note, { locales })).toEqual([]);

    const problems = checkModule(faulty, { locales });
    expect(problems).toContain('"corrupt" has no example');

    const mistranslated = checkModule(
      {
        ...tasks,
        messages: { ...tasks.messages, en: { name: "Tasks", description: "", example: "" } },
      },
      { locales },
    );
    expect(mistranslated.join("\n")).toMatch(/"en" has no description/);
    expect(mistranslated.join("\n")).toMatch(/"en" has no example of what to say/);
    expect(mistranslated.join("\n")).toMatch(/do not have the same keys/);

    const stale = checkModule({ ...tasks, empty: () => ({ days: {} }) as never }, { locales });
    expect(stale).toContain("empty() does not pass the schema");
  });

  it("checks a module the way its host will read it when given the host's kernel", () => {
    // "s" is a size here, but a weekly planner reads `to` as a day and turns it into "sat".
    const sized = defineWeekModule<Tasks, TaskMessages>({
      ...tasks,
      operations: {
        ...tasks.operations,
        resize: operation({
          input: z.object({ to: z.enum(["s", "m", "l"]) }),
          examples: [{ fields: { to: "s" } }],
          apply(_state, input, ctx) {
            ctx.change({ kind: "update", scope: "week", label: input.to });
          },
        }),
      },
    });
    expect(checkModule(sized, { locales })).toEqual([]);
    expect(checkModule(sized, { locales, kernel: createWeekKernel }).join("\n")).toMatch(
      /does not validate the way the host reads it/,
    );
  });

  it("describes a module as plain data for a gallery or a registry", () => {
    expect(manifestOf(tasks)).toEqual({
      contract: 1,
      id: "tasks",
      version: 1,
      tone: "blue",
      icon: "list",
      names: {
        es: {
          name: "Tareas",
          description: "Cosas por hacer cada día.",
          example: "El lunes, llamar a mamá a las 18:00",
        },
        en: {
          name: "Tasks",
          description: "Things to do each day.",
          example: "Call mum on Monday at 6 pm",
        },
      },
      operations: ["tasks.add", "tasks.update", "tasks.remove"],
      records: ["tasks.done"],
    });
  });
});
