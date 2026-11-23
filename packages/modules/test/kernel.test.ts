import { describe, expect, it } from "vitest";
import {
  createKernel,
  docJsonSchema,
  manifestOf,
  parseOutput,
  sequentialIds,
  systemPrompt,
  userPrompt,
  type Doc,
} from "../src";
import { checkModule } from "../src/testing";
import { createWeekKernel, weekLoads } from "../src/week";
import { faulty, note, tasks } from "./toy";

const locales = ["es", "en"] as const;
const kernel = createWeekKernel({ modules: [tasks, note], locales });
const ids = () => ({ newId: sequentialIds("t") });

function docWith(build: (doc: Doc) => void): Doc {
  const doc = kernel.empty(["tasks"]);
  build(doc);
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
    const doc = kernel.read(stored);
    expect(doc.modules.gone).toEqual({ v: 3, data: { anything: [1, 2, 3] } });
    expect(kernel.onScreen(doc).map((module) => module.id)).toEqual(["tasks"]);
    const { doc: next } = kernel.apply(doc, [{ op: "tasks.add", day: "mon", title: "Leer" }]);
    expect(next.modules.gone).toEqual(stored.modules.gone);
    expect(next.layout).toEqual(["tasks", "gone"]);
  });

  it("salvages what it can from a damaged envelope and falls back to the upgrade hook", () => {
    const doc = kernel.read({
      schemaVersion: 2,
      layout: ["tasks", "Not An Id", "tasks"],
      modules: { tasks: { v: 1, data: tasks.empty() }, broken: "nope" },
      extra: true,
    });
    expect(doc.layout).toEqual(["tasks"]);
    expect(Object.keys(doc.modules)).toEqual(["tasks"]);
    expect(kernel.read("garbage")).toEqual(kernel.empty());

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
    expect(upgrading.state(upgrading.read({ legacy: "hola" }), note)).toEqual({ text: "hola" });
  });

  it("migrates data written by an older version of a module", () => {
    const doc = kernel.read({
      schemaVersion: 2,
      layout: ["note"],
      modules: { note: { v: 1, data: { body: "Comprar flores" } } },
    });
    expect(doc.modules.note).toEqual({ v: 2, data: { text: "Comprar flores" } });
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
    const doc = kernel.read(stored);
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

  it("undoes everything a module did when it leaves data its own schema rejects", () => {
    const result = guarded.apply(start, [
      { op: "tasks.add", day: "tue", title: "Correr" },
      { op: "tasks.corrupt", day: "tue" },
      { op: "note.set", text: "Hola" },
    ]);
    expect(guarded.state(result.doc, faulty)).toEqual(guarded.state(start, faulty));
    expect(result.changes.map((c) => c.module)).toEqual(["app", "note"]);
    expect(result.rejected).toEqual([
      { index: 0, op: "tasks.add", reason: "invalid" },
      { index: 1, op: "tasks.corrupt", reason: "invalid" },
    ]);
    expect(faulty.schema.safeParse(result.doc.modules.tasks?.data).success).toBe(true);
  });

  it("takes a module back off the screen when its first change is undone", () => {
    const result = guarded.apply(guarded.empty(["note"]), [{ op: "tasks.corrupt", day: "mon" }]);
    expect(result.doc.layout).toEqual(["note"]);
    expect(result.changes).toEqual([]);
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
    const other = kernel.apply(start, [{ op: "day.clear", day: "mon", modules: ["note"] }]);
    expect(other.rejected).toEqual([{ index: 0, op: "day.clear", reason: "noop" }]);
    const nothing = kernel.apply(start, [{ op: "day.clear", day: "sun" }]);
    expect(nothing.rejected[0]?.reason).toBe("noop");
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
      { module: "tasks", day: "mon", key: "t1", value: true },
      { module: "tasks", day: "mon", key: "t1", value: null },
    ]);
    expect(result.rejected.map((r) => [r.index, r.reason])).toEqual([
      [1, "noop"],
      [3, "not_found"],
    ]);
    expect(result.changes).toHaveLength(2);
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
});

describe("the contract", () => {
  it("refuses to start with modules that break it", () => {
    expect(() => createKernel({ modules: [tasks, tasks], locales })).toThrow(/Duplicate module/);
    expect(() => createKernel({ modules: [{ ...tasks, id: "layout" }], locales })).toThrow(
      /reserved/,
    );
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
      { ...tasks, messages: { ...tasks.messages, en: { name: "Tasks", description: "" } } },
      { locales },
    );
    expect(mistranslated.join("\n")).toMatch(/"en" has no description/);
    expect(mistranslated.join("\n")).toMatch(/do not have the same keys/);

    const stale = checkModule({ ...tasks, empty: () => ({ days: {} }) as never }, { locales });
    expect(stale).toContain("empty() does not pass the schema");
  });

  it("describes a module as plain data for a gallery or a registry", () => {
    expect(manifestOf(tasks)).toEqual({
      contract: 1,
      id: "tasks",
      version: 1,
      tone: "blue",
      icon: "list",
      names: {
        es: { name: "Tareas", description: "Cosas por hacer cada día." },
        en: { name: "Tasks", description: "Things to do each day." },
      },
      operations: ["tasks.add", "tasks.update", "tasks.remove"],
      records: ["tasks.done"],
    });
  });
});
