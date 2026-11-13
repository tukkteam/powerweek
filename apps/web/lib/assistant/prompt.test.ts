import { emptyPlan } from "@powerweek/core";
import { describe, expect, it } from "vitest";
import { buildMessages, tomorrowOf } from "./prompt";

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
});
