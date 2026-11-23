import { describe, expect, it } from "vitest";
import { kernel } from "../index";
import { read, run, week } from "../test-kit";

describe("notes", () => {
  it("sets, changes and removes a day note", () => {
    const added = run(week(), [{ op: "notes.set", day: "fri", note: "Viaje a Valencia" }]);
    expect(read(added.doc).notes.days.fri).toBe("Viaje a Valencia");
    expect(added.changes[0]).toMatchObject({ kind: "add", module: "notes", day: "fri" });
    expect(kernel.describe(added.changes[0]!, "es")).toBe("Nota: Viaje a Valencia");

    const changed = run(added.doc, [{ op: "notes.set", day: "fri", note: "Viaje a Sevilla" }]);
    expect(changed.changes[0]?.kind).toBe("update");

    const removed = run(changed.doc, [{ op: "notes.set", day: "fri", note: null }]);
    expect(read(removed.doc).notes.days.fri).toBeUndefined();
    expect(removed.changes[0]).toMatchObject({ kind: "remove", label: "Viaje a Sevilla" });
  });

  it("rejects a note that changes nothing", () => {
    const { rejected } = run(week(), [{ op: "notes.set", day: "fri", note: null }]);
    expect(rejected).toEqual([{ index: 0, op: "notes.set", reason: "noop" }]);
  });

  it("still answers to the name it had before modules", () => {
    const { doc } = run(week(), [{ op: "day.note", day: "sat", note: "Descanso" }]);
    expect(read(doc).notes.days.sat).toBe("Descanso");
  });
});
