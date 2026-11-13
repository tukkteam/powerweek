import { emptyPlan } from "@powerweek/core";
import { describe, expect, it } from "vitest";
import { buildMessages, MOVE_CATALOGUE, tomorrowOf } from "./prompt";

describe("assistant prompt", () => {
  it("wraps the week around for tomorrow", () => {
    expect(tomorrowOf("sun")).toBe("mon");
    expect(tomorrowOf("wed")).toBe("thu");
  });

  it("mentions json in the user message (the gateway requires it for JSON mode)", () => {
    const [system, user] = buildMessages(
      { lang: "es", todayIso: "2026-11-13", todayKey: "fri", plan: emptyPlan() },
      "hola",
    );
    expect(system?.role).toBe("system");
    expect(user?.content).toMatch(/json/);
    expect(user?.content).toContain('"hola"');
    expect(system?.content).toContain("Today is fri; tomorrow is sat");
  });

  it("asks for replies in the interface language", () => {
    const [es] = buildMessages(
      { lang: "es", todayIso: "2026-11-13", todayKey: "fri", plan: emptyPlan() },
      "x",
    );
    const [en] = buildMessages(
      { lang: "en", todayIso: "2026-11-13", todayKey: "fri", plan: emptyPlan() },
      "x",
    );
    expect(es?.content).toContain("Spanish");
    expect(en?.content).toContain("in English");
  });

  it("lists every move slug once so the model can link exercises to illustrations", () => {
    const slugs = MOVE_CATALOGUE.split("\n").flatMap((line) => line.split(": ")[1]!.split(", "));
    expect(slugs).toHaveLength(302);
    expect(new Set(slugs).size).toBe(302);
    expect(MOVE_CATALOGUE).toMatch(/^chest: bench-press, /);
    const [system] = buildMessages(
      { lang: "es", todayIso: "2026-11-13", todayKey: "fri", plan: emptyPlan() },
      "x",
    );
    expect(system?.content).toContain('"move"');
    expect(system?.content).toContain("hammer-curl");
  });
});
