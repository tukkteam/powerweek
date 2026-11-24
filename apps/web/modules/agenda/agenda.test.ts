import { describe, expect, it } from "vitest";
import { agenda as module, kernel } from "../index";
import { read, run, week } from "../test-kit";

describe("agenda", () => {
  it("adds items sorted by time, untimed last", () => {
    const { doc, changes } = run(week(), [
      { op: "agenda.add", day: "wed", title: "Pádel", time: "18:30" },
      { op: "agenda.add", day: "wed", title: "Llamar a mamá" },
      { op: "agenda.add", day: "wed", title: "Yoga", time: "7:30" },
    ]);
    const { agenda } = read(doc);
    expect(agenda.days.wed.map((i) => i.title)).toEqual(["Yoga", "Pádel", "Llamar a mamá"]);
    expect(agenda.days.wed[0]).toEqual({ id: "id3", title: "Yoga", time: "07:30" });
    expect(changes).toHaveLength(3);
    expect(changes[0]).toEqual({
      kind: "add",
      module: "agenda",
      day: "wed",
      label: "Pádel",
      data: { time: "18:30" },
    });
    expect(kernel.describe(changes[0]!, "es")).toBe("Pádel · 18:30");
  });

  it("moves an item to another day and reports a move", () => {
    const start = week((w) => {
      w.agenda.days.wed.push({ id: "padel", title: "Pádel", time: "18:30" });
    });
    const { doc, changes } = run(start, [
      { op: "agenda.update", id: "padel", day: "thu", time: "19:00" },
    ]);
    expect(read(doc).agenda.days.wed).toEqual([]);
    expect(read(doc).agenda.days.thu).toEqual([{ id: "padel", title: "Pádel", time: "19:00" }]);
    expect(changes).toEqual([
      {
        kind: "move",
        module: "agenda",
        day: "wed",
        toDay: "thu",
        label: "Pádel",
        data: { time: "19:00" },
      },
    ]);
  });

  it("clears an optional field when the update sends null", () => {
    const start = week((w) => {
      w.agenda.days.mon.push({ id: "a", title: "Trabajo", time: "09:00", note: "Remoto" });
    });
    const { doc } = run(start, [{ op: "agenda.update", id: "a", time: null, note: null }]);
    expect(read(doc).agenda.days.mon[0]).toEqual({ id: "a", title: "Trabajo" });
  });

  it("enforces the limit of items per day", () => {
    const many = Array.from({ length: 41 }, (_, i) => ({
      op: "agenda.add",
      day: "mon",
      title: `Cosa ${i}`,
    }));
    const { doc, rejected } = run(week(), many);
    expect(read(doc).agenda.days.mon).toHaveLength(40);
    expect(rejected).toEqual([{ index: 40, op: "agenda.add", reason: "limit" }]);
  });

  it("is forgiving about how an operation is written and strict about what it means", () => {
    expect(
      kernel.parse([{ op: "agenda.add", day: "mon", title: " Yoga ", time: "8", note: null }])
        .operations,
    ).toEqual([{ op: "agenda.add", day: "mon", title: "Yoga", time: "08:00" }]);
    expect(
      kernel.parse([{ op: "agenda.remove", id: "x", reason: "user asked" }]).operations,
    ).toEqual([{ op: "agenda.remove", id: "x" }]);
    const bad = kernel.parse([
      { op: "agenda.add", day: "someday", title: "a" },
      { op: "agenda.add", day: "mon", title: "a", time: "25:00" },
      { op: "agenda.add", day: "mon", title: "" },
    ]);
    expect(bad.operations).toEqual([]);
    expect(bad.dropped).toBe(3);
  });

  it("puts timed items on the day's timeline and counts every item", () => {
    const start = week((w) => {
      w.agenda.days.mon.push(
        { id: "work", title: "Trabajo", time: "09:00", endTime: "18:00" },
        { id: "call", title: "Llamar a mamá" },
      );
    });
    const { agenda } = read(start);
    const t = kernel.messages(module, "es");
    expect(module.week!.load!(agenda, "mon")).toBe(2);
    expect(module.week!.summary!(agenda, "mon", t)).toBe("2 actividades");
    expect(module.week!.summary!(agenda, "tue", t)).toBeNull();
    expect(
      module.week!.timeline!(agenda, "mon", { lang: "es", t, record: () => undefined }).spans,
    ).toEqual([{ id: "work", title: "Trabajo", start: 540, end: 1080, open: false }]);
  });
});
