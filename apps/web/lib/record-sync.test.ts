import type { Json } from "@tukkteam/modules";
import { describe, expect, it } from "vitest";
import type { Entries } from "./plan-api";
import { createRecordSync, type Fact } from "./record-sync";

/** A database made of promises the test settles by hand, to put events in any order. */
function harness(initial: Record<string, Json> = {}) {
  const database = new Map<string, Json>(Object.entries(initial));
  const reads: { answer: (ok?: boolean) => void }[] = [];
  const writes: { fact: Fact; answer: (ok?: boolean) => void }[] = [];
  let screen: Entries = new Map();
  let failures = 0;
  const sync = createRecordSync({
    read: () =>
      new Promise((resolve) => {
        // What a read returns is what the database held when it ran, not when it answers.
        const snapshot = new Map(database);
        reads.push({ answer: (ok = true) => resolve(ok ? snapshot : null) });
      }),
    write: (fact) =>
      new Promise((resolve) => {
        writes.push({
          fact,
          answer: (ok = true) => {
            const id = `${fact.isoDate}|${fact.module}|${fact.key}`;
            if (ok && fact.value === null) database.delete(id);
            else if (ok) database.set(id, fact.value as Json);
            resolve(ok);
          },
        });
      }),
    show: (entries) => {
      screen = entries;
    },
    failed: () => {
      failures += 1;
    },
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return {
    sync,
    database,
    reads,
    writes,
    settle,
    seen: (key: string) => screen.get(`2026-11-24|habits|${key}`),
    failures: () => failures,
    tap: (key: string, value: Json | null) => sync.set("2026-11-24", "habits", key, value),
  };
}

describe("dated facts on screen and in the database", () => {
  it("shows a tap at once and stores it", async () => {
    const h = harness();
    h.tap("water", 1);
    expect(h.seen("water")).toBe(1);
    await h.settle();
    h.writes[0]!.answer();
    await h.settle();
    expect(h.database.get("2026-11-24|habits|water")).toBe(1);
    expect(h.reads).toHaveLength(0);
  });

  it("writes quick taps on one fact in order, and does not make other facts wait", async () => {
    const h = harness();
    h.tap("water", 1);
    h.tap("water", 2);
    h.tap("read", true);
    await h.settle();
    // The second tap on water waits for the first; the tick next to it does not.
    expect(h.writes.map((w) => `${w.fact.key}=${w.fact.value}`)).toEqual(["water=1", "read=true"]);
    h.writes[0]!.answer();
    await h.settle();
    expect(h.writes.map((w) => `${w.fact.key}=${w.fact.value}`)).toEqual([
      "water=1",
      "read=true",
      "water=2",
    ]);
    h.writes[1]!.answer();
    h.writes[2]!.answer();
    await h.settle();
    expect(h.seen("water")).toBe(2);
    expect(h.database.get("2026-11-24|habits|water")).toBe(2);
  });

  it("puts a fact back when it could not be stored, even with no network to ask", async () => {
    const h = harness({ "2026-11-24|habits|water": 3 });
    void h.sync.load();
    await h.settle();
    h.reads[0]!.answer();
    await h.settle();
    expect(h.seen("water")).toBe(3);

    h.tap("water", 4);
    h.tap("read", true);
    await h.settle();
    h.writes[0]!.answer(false);
    h.writes[1]!.answer(false);
    await h.settle();
    // Offline: the reload fails too. The screen still goes back to what is stored.
    h.reads[1]?.answer(false);
    await h.settle();
    expect(h.seen("water")).toBe(3);
    expect(h.seen("read")).toBeUndefined();
    expect(h.failures()).toBe(2);

    // When the network is back, it looks again.
    const before = h.reads.length;
    h.sync.retry();
    await h.settle();
    expect(h.reads.length).toBe(before + 1);
    h.reads.at(-1)!.answer();
    await h.settle();
    expect(h.seen("water")).toBe(3);
  });

  it("keeps the later tap when an earlier write of the same fact fails", async () => {
    const h = harness();
    h.tap("water", 1);
    h.tap("water", 2);
    await h.settle();
    h.writes[0]!.answer(false);
    await h.settle();
    expect(h.seen("water")).toBe(2);
    h.writes[1]!.answer();
    await h.settle();
    h.reads.at(-1)?.answer();
    await h.settle();
    expect(h.seen("water")).toBe(2);
    expect(h.database.get("2026-11-24|habits|water")).toBe(2);
  });

  it("never shows a read over a tap made while it was on its way, and looks again", async () => {
    const h = harness({ "2026-11-24|habits|read": true });
    // The assistant stored something and the app reloads…
    void h.sync.load();
    await h.settle();
    // …a tap lands and is stored before that read answers.
    h.tap("water", 1);
    await h.settle();
    h.writes[0]!.answer();
    await h.settle();
    h.reads[0]!.answer();
    await h.settle();
    expect(h.seen("water")).toBe(1);
    // The first read is not shown (it did not know about the tap); a second one is taken.
    expect(h.reads).toHaveLength(2);
    h.reads[1]!.answer();
    await h.settle();
    expect(h.seen("water")).toBe(1);
    expect(h.seen("read")).toBe(true);
  });

  it("does not show a read that started while a write was still on its way", async () => {
    const h = harness();
    h.tap("water", 1);
    await h.settle();
    // The read runs before the write reaches the database, but answers after it.
    void h.sync.load();
    await h.settle();
    h.writes[0]!.answer();
    await h.settle();
    h.reads[0]!.answer();
    await h.settle();
    expect(h.seen("water")).toBe(1);
    h.reads[1]!.answer();
    await h.settle();
    expect(h.seen("water")).toBe(1);
    expect(h.reads).toHaveLength(2);
  });

  it("stops touching the screen once disposed, while writes still finish", async () => {
    const h = harness();
    h.tap("water", 1);
    await h.settle();
    h.sync.dispose();
    h.writes[0]!.answer();
    await h.settle();
    expect(h.database.get("2026-11-24|habits|water")).toBe(1);
    h.tap("water", 2);
    expect(h.seen("water")).toBe(1);
  });
});
