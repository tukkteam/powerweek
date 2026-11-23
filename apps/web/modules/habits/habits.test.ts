import {
  manifestOf,
  systemPrompt,
  userPrompt,
  type Doc,
  type Json,
  type Operation,
} from "@tukkteam/modules";
import { describe, expect, it } from "vitest";
import { habits, kernel } from "../index";
import { run, week } from "../test-kit";
import {
  amountOf,
  appliesOn,
  changesTo,
  fillOf,
  isDone,
  nextAmount,
  progressOf,
  recordOf,
  tidy,
  weekdays,
} from "./module";

const read = (doc: Doc) => kernel.state(doc, habits);

/** Three habits: h1 is a simple tick, h2 is counted, h3 applies to some days only. */
const start = run(
  week(),
  [
    { op: "habits.add", title: "Meditar" },
    { op: "habits.add", title: "Agua", target: 8, unit: "vasos" },
    { op: "habits.add", title: "Creatina", days: ["fri", "mon", "wed"] },
  ],
  "h",
).doc;

/** Resolve record operations against what is stored ("day|key"), as the assistant route does. */
function log(records: Operation[], stored: Record<string, Json> = {}) {
  return kernel.resolveRecords(start, records, {
    lang: "es",
    get: (_module, day, key) => stored[`${day}|${key}`],
  });
}

describe("habits", () => {
  it("adds a tick, a counted habit and one for some days, and comes on screen", () => {
    const { doc, changes } = run(
      week(),
      [
        { op: "habits.add", title: "Meditar" },
        { op: "habits.add", title: "Agua", target: 8, unit: "vasos" },
        { op: "habits.add", title: "Creatina", days: ["fri", "mon", "wed", "mon"] },
      ],
      "h",
    );
    expect(read(doc).items).toEqual([
      { id: "h1", title: "Meditar" },
      { id: "h2", title: "Agua", target: 8, unit: "vasos" },
      { id: "h3", title: "Creatina", days: ["mon", "wed", "fri"] },
    ]);
    expect(doc.layout.at(-1)).toBe("habits");
    expect(changes[0]).toEqual({ kind: "add", module: "app", scope: "app", label: "habits" });
    expect(changes[2]).toEqual({
      kind: "add",
      module: "habits",
      scope: "week",
      label: "Agua",
      data: { target: 8, unit: "vasos" },
    });
    expect(changes.slice(1).map((change) => kernel.describe(change, "es"))).toEqual([
      "Meditar",
      "Agua · 8 vasos",
      "Creatina · Lun, Mié, Vie",
    ]);
    expect(kernel.describe(changes[3]!, "en")).toBe("Creatina · Mon, Wed, Fri");
  });

  it("stores a target of 1 as a simple tick and all seven days as every day", () => {
    const { doc, changes } = run(week(), [
      {
        op: "habits.add",
        title: "Leer",
        target: 1,
        unit: "páginas",
        days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
      },
      { op: "habits.add", title: "Flexiones", target: 20 },
    ]);
    expect(read(doc).items).toEqual([
      { id: "id1", title: "Leer", unit: "páginas" },
      { id: "id2", title: "Flexiones", target: 20 },
    ]);
    expect(kernel.describe(changes.at(-1)!, "es")).toBe("Flexiones · 20 veces");
  });

  it("rejects a habit that already exists, whatever its case and accents", () => {
    const { doc, rejected } = run(start, [
      { op: "habits.add", title: " meditár " },
      { op: "habits.add", title: "AGUA", target: 10 },
    ]);
    expect(rejected).toEqual([
      { index: 0, op: "habits.add", reason: "conflict" },
      { index: 1, op: "habits.add", reason: "conflict" },
    ]);
    expect(doc).toBe(start);
  });

  it("holds at most 20 habits", () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ op: "habits.add", title: `Hábito ${i}` }));
    const { doc, rejected } = run(week(), many);
    expect(read(doc).items).toHaveLength(20);
    expect(rejected).toEqual([{ index: 20, op: "habits.add", reason: "limit" }]);
  });

  it("updates only the fields it is given, and null clears them", () => {
    const { doc, changes } = run(start, [
      { op: "habits.update", id: "h1", target: 2, unit: "veces", days: ["sun", "sat"] },
      { op: "habits.update", id: "h2", target: null, unit: null },
      { op: "habits.update", id: "h3", title: "Creatina 5 g", days: null },
    ]);
    expect(read(doc).items).toEqual([
      { id: "h1", title: "Meditar", target: 2, unit: "veces", days: ["sat", "sun"] },
      { id: "h2", title: "Agua" },
      { id: "h3", title: "Creatina 5 g" },
    ]);
    expect(changes.map((change) => [change.kind, change.scope])).toEqual([
      ["update", "week"],
      ["update", "week"],
      ["update", "week"],
    ]);
    expect(changes.map((change) => kernel.describe(change, "es"))).toEqual([
      "Meditar · 2 veces · Sáb, Dom",
      "Agua",
      "Creatina 5 g",
    ]);

    const tick = run(start, [{ op: "habits.update", id: "h2", target: 1 }]);
    expect(read(tick.doc).items[1]).toEqual({ id: "h2", title: "Agua", unit: "vasos" });
    const renamed = run(start, [{ op: "habits.update", id: "h1", title: "MEDITAR" }]);
    expect(read(renamed.doc).items[0]).toEqual({ id: "h1", title: "MEDITAR" });
  });

  it("rejects an update of nothing, of something missing, or onto another habit's title", () => {
    const { doc, rejected } = run(start, [
      { op: "habits.update", id: "missing", title: "Leer" },
      { op: "habits.update", id: "h2" },
      { op: "habits.update", id: "h2", title: "Agua", target: 8, unit: "vasos" },
      { op: "habits.update", id: "h1", target: null, days: null },
      { op: "habits.update", id: "h3", days: ["wed", "fri", "mon"] },
      { op: "habits.update", id: "h2", title: "meditar" },
    ]);
    expect(rejected.map((rejection) => rejection.reason)).toEqual([
      "not_found",
      "noop",
      "noop",
      "noop",
      "noop",
      "conflict",
    ]);
    expect(doc).toBe(start);
  });

  it("removes a habit and rejects one that is not there", () => {
    const { doc, changes, rejected } = run(start, [
      { op: "habits.remove", id: "h2" },
      { op: "habits.remove", id: "h2" },
    ]);
    expect(read(doc).items.map((habit) => habit.id)).toEqual(["h1", "h3"]);
    expect(changes).toEqual([
      {
        kind: "remove",
        module: "habits",
        scope: "week",
        label: "Agua",
        data: { target: 8, unit: "vasos" },
      },
    ]);
    expect(rejected).toEqual([{ index: 1, op: "habits.remove", reason: "not_found" }]);
  });

  it("is forgiving about how an operation is written and strict about what it means", () => {
    const parsed = kernel.parse([
      {
        op: "habits.add",
        title: " Leer ",
        target: "20",
        unit: " páginas ",
        days: ["Lunes", "miércoles"],
        why: "user asked",
      },
      { op: "habits_update", id: "h2", title: null, target: null, unit: "" },
      { op: "habits.log", habit: " Agua ", day: "Sábado", value: null, add: "-1" },
      { op: "habits.log", habit: "Agua", day: "sat", value: "3", add: null },
    ]);
    expect(parsed.operations).toEqual([
      { op: "habits.add", title: "Leer", target: 20, unit: "páginas", days: ["mon", "wed"] },
      { op: "habits.update", id: "h2", target: null, unit: null },
    ]);
    expect(parsed.records).toEqual([
      { op: "habits.log", habit: "Agua", day: "sat", value: null, add: -1 },
      { op: "habits.log", habit: "Agua", day: "sat", value: 3 },
    ]);
    expect(parsed.dropped).toBe(0);

    const bad = kernel.parse([
      { op: "habits.add", title: "" },
      { op: "habits.add", title: "Agua", target: 0 },
      { op: "habits.add", title: "Agua", target: 100 },
      { op: "habits.add", title: "Agua", target: 2.5 },
      { op: "habits.add", title: "Agua", unit: "una unidad muy larga" },
      { op: "habits.add", title: "Agua", days: ["someday"] },
      { op: "habits.add", title: "Agua", days: [] },
      { op: "habits.log", habit: "Agua", day: "someday" },
      { op: "habits.log", habit: "Agua", day: "mon", value: -1 },
      { op: "habits.log", habit: "Agua", day: "mon", add: 1.5 },
    ]);
    expect(bad.operations).toEqual([]);
    expect(bad.records).toEqual([]);
    expect(bad.dropped).toBe(10);
  });

  it("can be listed as plain data", () => {
    expect(manifestOf(habits)).toMatchObject({
      id: "habits",
      version: 1,
      author: "PowerWeek",
      tone: "teal",
      icon: "repeat",
      operations: ["habits.add", "habits.update", "habits.remove"],
      records: ["habits.log"],
    });
  });
});

describe("logging a habit on a date", () => {
  it("marks it done by id or by title, whatever its case and accents", () => {
    const logged = log([
      { op: "habits.log", habit: "h1", day: "mon" },
      { op: "habits.log", habit: " AGÜA ", day: "mon" },
      { op: "habits.log", habit: "Correr", day: "mon" },
    ]);
    expect(logged.writes).toEqual([
      { module: "habits", day: "mon", key: "h1", value: 1, upcoming: false, index: 0 },
      { module: "habits", day: "mon", key: "h2", value: 8, upcoming: false, index: 1 },
    ]);
    expect(logged.changes[0]).toEqual({
      kind: "add",
      module: "habits",
      day: "mon",
      label: "Meditar",
      data: { amount: 1 },
    });
    expect(logged.changes.map((change) => kernel.describe(change, "es"))).toEqual([
      "Meditar: hecho",
      "Agua: 8/8 vasos",
    ]);
    expect(kernel.describe(logged.changes[0]!, "en")).toBe("Meditar: done");
    expect(logged.rejected).toEqual([{ index: 2, op: "habits.log", reason: "not_found" }]);
  });

  it("sets the amount with value, and removes it with 0 or null", () => {
    const logged = log(
      [
        { op: "habits.log", habit: "h2", day: "mon", value: 3 },
        { op: "habits.log", habit: "h2", day: "tue", value: 0 },
        { op: "habits.log", habit: "h2", day: "wed", value: 4 },
        { op: "habits.log", habit: "h2", day: "wed", value: null },
        { op: "habits.log", habit: "h1", day: "mon", value: 0 },
      ],
      { "mon|h2": 5, "tue|h2": 2, "mon|h1": 1 },
    );
    expect(logged.writes.map((write) => [write.day, write.key, write.value])).toEqual([
      ["mon", "h2", 3],
      ["tue", "h2", null],
      ["wed", "h2", 4],
      ["wed", "h2", null],
      ["mon", "h1", null],
    ]);
    expect(logged.changes.map((change) => change.kind)).toEqual([
      "update",
      "remove",
      "add",
      "remove",
      "remove",
    ]);
    expect(logged.changes.map((change) => kernel.describe(change, "es"))).toEqual([
      "Agua: 3/8 vasos",
      "Agua: 0/8 vasos",
      "Agua: 4/8 vasos",
      "Agua: 0/8 vasos",
      "Meditar: sin hacer",
    ]);
  });

  it("adds to what is stored, also within one request, and never goes below zero", () => {
    const logged = log(
      [
        { op: "habits.log", habit: "Agua", day: "mon", add: 1 },
        { op: "habits.log", habit: "Agua", day: "mon", add: 1 },
        { op: "habits.log", habit: "Agua", day: "mon", add: -10 },
        { op: "habits.log", habit: "Agua", day: "mon", add: -1 },
        { op: "habits.log", habit: "Agua", day: "tue", add: 2 },
      ],
      { "mon|h2": 2 },
    );
    expect(logged.writes.map((write) => [write.day, write.value])).toEqual([
      ["mon", 3],
      ["mon", 4],
      ["mon", null],
      ["tue", 2],
    ]);
    expect(logged.rejected).toEqual([{ index: 3, op: "habits.log", reason: "noop" }]);
  });

  it("caps the amount at 99", () => {
    const logged = log(
      [
        { op: "habits.log", habit: "h2", day: "mon", value: 150 },
        { op: "habits.log", habit: "h2", day: "tue", add: 5 },
        { op: "habits.log", habit: "h2", day: "wed", add: 1 },
      ],
      { "tue|h2": 98, "wed|h2": 99 },
    );
    expect(logged.writes.map((write) => [write.day, write.value])).toEqual([
      ["mon", 99],
      ["tue", 99],
    ]);
    expect(logged.rejected).toEqual([{ index: 2, op: "habits.log", reason: "noop" }]);
  });

  it("rejects a log that would change nothing", () => {
    const logged = log(
      [
        { op: "habits.log", habit: "h1", day: "mon" },
        // More than the target was already done: marking it done does not lower it.
        { op: "habits.log", habit: "h2", day: "mon" },
        { op: "habits.log", habit: "h2", day: "tue", value: 0 },
        { op: "habits.log", habit: "h2", day: "tue", value: null },
        { op: "habits.log", habit: "h2", day: "mon", value: 10 },
        { op: "habits.log", habit: "h2", day: "mon", add: 0 },
      ],
      { "mon|h1": 1, "mon|h2": 10 },
    );
    expect(logged.writes).toEqual([]);
    expect(logged.rejected.map((rejection) => rejection.reason)).toEqual(Array(6).fill("noop"));
  });

  it("takes a number over a null value, and add over a null value", () => {
    const logged = log(
      [
        { op: "habits.log", habit: "h2", day: "mon", value: 6, add: 1 },
        { op: "habits.log", habit: "h2", day: "tue", value: null, add: 1 },
      ],
      { "mon|h2": 2, "tue|h2": 2 },
    );
    expect(logged.writes.map((write) => [write.day, write.value])).toEqual([
      ["mon", 6],
      ["tue", 3],
    ]);
  });
});

describe("habits in the week", () => {
  const state = read(start);
  const es = kernel.messages(habits, "es");
  const en = kernel.messages(habits, "en");

  it("counts the habits that apply to each day", () => {
    expect(habits.week!.load!(state, "mon")).toBe(3);
    expect(habits.week!.load!(state, "tue")).toBe(2);
    expect(habits.week!.summary!(state, "mon", es)).toBe("3 hábitos");
    expect(habits.week!.summary!(state, "tue", en)).toBe("2 habits");
  });

  it("counts every habit for the week, and says nothing when there is none", () => {
    expect(habits.week!.summary!(state, null, es)).toBe("3 hábitos");
    expect(habits.week!.summary!(state, null, en)).toBe("3 habits");
    const one = read(run(week(), [{ op: "habits.add", title: "Leer", days: ["sat"] }]).doc);
    expect(habits.week!.summary!(one, null, es)).toBe("1 hábito");
    expect(habits.week!.summary!(one, "sat", en)).toBe("1 habit");
    expect(habits.week!.summary!(one, "sun", es)).toBeNull();
    expect(habits.week!.load!(one, "sun")).toBe(0);
    expect(habits.week!.summary!(habits.empty(), null, es)).toBeNull();
  });

  it("takes no part in the timeline or in clearing and copying days", () => {
    expect(Object.keys(habits.week!)).toEqual(["load", "summary"]);
    const { doc } = run(start, [
      { op: "agenda.add", day: "mon", title: "Yoga" },
      { op: "day.copy", from: "mon", to: ["tue"] },
      { op: "day.clear", day: "mon" },
    ]);
    expect(read(doc)).toEqual(state);
  });
});

describe("what the assistant is told about habits", () => {
  const host = { intro: "You edit a weekly plan.", rules: [] };

  it("lists the operations with examples, and the rule that tells a habit from a log", () => {
    const prompt = systemPrompt(kernel, host, { onScreen: [], lang: "es" });
    expect(prompt).toContain('- habits (the user calls it "Hábitos"): things done regularly');
    expect(prompt).toContain('{"op":"habits.add","title":"Water","target":8,"unit":"glasses"}');
    expect(prompt).toContain('{"op":"habits.update","id":"<habit id>","target":10}');
    expect(prompt).toContain('{"op":"habits.remove","id":"<habit id>"}');
    expect(prompt).toContain('{"op":"habits.log","habit":"<habit id or title>","day":"mon"}');
    expect(prompt).toContain('{"op":"habits.log","habit":"Water","day":"mon","add":1}');
    expect(prompt).toContain("is habits.log with that day");
    expect(prompt).toContain("it belongs in the agenda");
  });

  it("shows the habits as a list, and only while the module is on screen", () => {
    const shown = userPrompt(kernel, { doc: start, input: "hola" });
    expect(shown).toContain(
      '"habits":[{"id":"h1","title":"Meditar"},{"id":"h2","title":"Agua","target":8,"unit":"vasos"},{"id":"h3","title":"Creatina","days":["mon","wed","fri"]}]',
    );
    const hidden = run(start, [{ op: "layout.remove", module: "Hábitos" }]).doc;
    expect(userPrompt(kernel, { doc: hidden, input: "hola" })).not.toContain('"habits":');
    expect(read(hidden)).toEqual(read(start));
  });
});

describe("what the views work out", () => {
  const [tick, water, creatine] = read(start).items;

  it("reads a stored record as an amount, whatever was stored", () => {
    expect(amountOf(undefined)).toBe(0);
    expect(amountOf(3)).toBe(3);
    expect(amountOf(3.7)).toBe(3);
    expect(amountOf(500)).toBe(99);
    expect(amountOf(-2)).toBe(0);
    expect(amountOf(true)).toBe(0);
    expect(amountOf("3")).toBe(0);
    expect(recordOf(3)).toBe(3);
    expect(recordOf(0)).toBeNull();
  });

  it("adds one on a tap, ticks and unticks a simple habit, and takes one off", () => {
    expect(nextAmount(water!, 3, { add: 1 })).toBe(4);
    expect(nextAmount(water!, 99, { add: 1 })).toBe(99);
    expect(nextAmount(water!, 1, { add: -1 })).toBe(0);
    expect(nextAmount(water!, 0, { add: -1 })).toBe(0);
    expect(nextAmount(tick!, 0, { value: 1 })).toBe(1);
    expect(nextAmount(tick!, 1, { value: 0 })).toBe(0);
    expect(nextAmount(water!, 3)).toBe(8);
    expect(nextAmount(water!, 10)).toBe(10);
  });

  it("fills the bar with the amount over the target", () => {
    expect(fillOf(water!, 0)).toBe(0);
    expect(fillOf(water!, 2)).toBe(0.25);
    expect(fillOf(water!, 12)).toBe(1);
    expect(fillOf(tick!, 1)).toBe(1);
    expect(isDone(water!, 7)).toBe(false);
    expect(isDone(water!, 8)).toBe(true);
    expect(isDone(tick!, 1)).toBe(true);
    expect(progressOf(water!, 3)).toBe("3/8 vasos");
    expect(progressOf(tick!, 0)).toBe("0/1");
  });

  it("knows which days a habit applies to", () => {
    expect(appliesOn(creatine!, "mon")).toBe(true);
    expect(appliesOn(creatine!, "tue")).toBe(false);
    expect(appliesOn(tick!, "sun")).toBe(true);
    expect(weekdays(["sun", "mon", "sun"])).toEqual(["mon", "sun"]);
    expect(weekdays([])).toBeUndefined();
    expect(weekdays(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])).toBeUndefined();
  });

  it("sends only what an edited form changes, and nothing when it changes nothing", () => {
    const same = tidy({ title: "Agua", target: 8, unit: "vasos", days: [] });
    expect(changesTo(water!, same)).toEqual({});
    const edited = tidy({ title: "Agua", target: 1, unit: undefined, days: ["sat", "sun"] });
    expect(changesTo(water!, edited)).toEqual({ target: null, unit: null, days: ["sat", "sun"] });
    const everyDay = tidy({ title: "Creatina 5 g", days: [] });
    expect(changesTo(creatine!, everyDay)).toEqual({ title: "Creatina 5 g", days: null });
  });
});
