import { describe, expect, it } from "vitest";
import { extractJson, parseAssistantOutput } from "./parse";

describe("extractJson", () => {
  it("reads a bare object", () => {
    expect(extractJson('{"operations":[],"reply":"ok"}')).toEqual({ operations: [], reply: "ok" });
  });

  it("tolerates code fences and prose around the object", () => {
    expect(extractJson('Here you go:\n```json\n{"reply":"hi"}\n```')).toEqual({ reply: "hi" });
  });

  it("returns null when there is no object", () => {
    expect(extractJson("sorry, I cannot")).toBeNull();
  });
});

describe("parseAssistantOutput", () => {
  it("normalises day names, op spelling and loose times", () => {
    const parsed = parseAssistantOutput(
      JSON.stringify({
        operations: [
          { op: "agenda_add", day: "Lunes", title: "Yoga", time: "7:30" },
          { op: "meal.set", day: "friday", slot: "dinner", title: "Salmón" },
        ],
        reply: "Hecho.",
      }),
    );
    expect(parsed?.operations).toEqual([
      { op: "agenda.add", day: "mon", title: "Yoga", time: "07:30" },
      { op: "meal.set", day: "fri", slot: "dinner", title: "Salmón" },
    ]);
    expect(parsed?.reply).toBe("Hecho.");
    expect(parsed?.dropped).toBe(0);
  });

  it("keeps valid operations when one is invalid", () => {
    const parsed = parseAssistantOutput(
      JSON.stringify({
        operations: [
          { op: "agenda.add", day: "someday", title: "?" },
          { op: "exercise.add", day: "wed", name: "Bench press", sets: "4", reps: 8 },
        ],
        reply: "",
      }),
    );
    expect(parsed?.operations).toEqual([
      { op: "exercise.add", day: "wed", name: "Bench press", sets: 4, reps: "8" },
    ]);
    expect(parsed?.dropped).toBe(1);
  });

  it("expands a single target day for day.copy", () => {
    const parsed = parseAssistantOutput(
      '{"operations":[{"op":"day.copy","from":"lunes","to":"miércoles"}],"reply":""}',
    );
    expect(parsed?.operations).toEqual([{ op: "day.copy", from: "mon", to: ["wed"] }]);
  });

  it("returns null for unusable output", () => {
    expect(parseAssistantOutput("not json")).toBeNull();
  });
});
