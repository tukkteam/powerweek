import { describe, expect, it } from "vitest";
import { kernel } from "@/modules";
import { buildMessages } from "./prompt";

const blank = kernel.empty(["agenda", "fuel", "train"]);
const at = { todayIso: "2026-11-13", todayKey: "fri" } as const;

describe("assistant prompt", () => {
  it("mentions json in the user message (the gateway requires it for JSON mode)", () => {
    const [system, user] = buildMessages({ ...at, lang: "es", doc: blank }, "hola");
    expect(system?.role).toBe("system");
    expect(user?.content).toMatch(/json/);
    expect(user?.content).toContain('"hola"');
    expect(user?.content).toContain("Today is Friday (fri), 2026-11-13.");
    expect(system?.content).toContain("Today is fri; tomorrow is sat");
  });

  it("asks for replies in the interface language and names modules as the user sees them", () => {
    const [es] = buildMessages({ ...at, lang: "es", doc: blank }, "x");
    const [en] = buildMessages({ ...at, lang: "en", doc: blank }, "x");
    expect(es?.content).toContain("Spanish");
    expect(es?.content).toContain('- fuel (the user calls it "Comidas")');
    expect(en?.content).toContain("in English");
    expect(en?.content).toContain('- fuel (the user calls it "Meals")');
  });

  it("tells the model what is on screen and how to change it", () => {
    const [system, user] = buildMessages(
      { ...at, lang: "es", doc: kernel.empty(["agenda"]) },
      "quita la agenda",
    );
    const others = kernel.modules.map((module) => module.id).filter((id) => id !== "agenda");
    expect(user?.content).toContain(
      `Modules on screen, in order: agenda. Not on screen: ${others.join(", ")}.`,
    );
    expect(system?.content).toContain('{"op":"layout.remove","module":"<module id>"}');
    expect(system?.content).toContain("layout.remove (everything in it is kept)");
  });

  it("sends the move library only while Training is on screen", () => {
    const [withTraining] = buildMessages({ ...at, lang: "es", doc: blank }, "x");
    const [without] = buildMessages({ ...at, lang: "es", doc: kernel.empty(["agenda"]) }, "x");
    expect(withTraining?.content).toContain("hammer-curl");
    expect(without?.content).not.toContain("hammer-curl");
    // Its operations stay listed, so "los lunes hago pierna" can bring the module back.
    expect(without?.content).toContain('{"op":"train.workout.set"');
  });
});
