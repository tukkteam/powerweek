import { describe, expect, it } from "vitest";
import { clearable, compact, looseInt, looseNumber, opt, sameText, text } from "../src";

describe("field helpers", () => {
  it("compares titles the same way on every device", () => {
    expect(sameText("Cumpleaños", " cumpleanos ")).toBe(true);
    expect(sameText("CAFÉ", "cafe")).toBe(true);
    expect(sameText("Pádel", "Papel")).toBe(false);
  });

  it("forgives the shape a model writes and stays strict about meaning", () => {
    expect(opt(text(10)).parse("")).toBeUndefined();
    expect(opt(text(10)).parse(null)).toBeUndefined();
    expect(opt(text(10)).parse(" Leer ")).toBe("Leer");
    expect(clearable(text(10)).parse(null)).toBeNull();
    expect(looseInt(1, 9).parse("4")).toBe(4);
    expect(looseInt(-5, 5).parse("-1")).toBe(-1);
    expect(looseInt(1, 9).safeParse("40").success).toBe(false);
    expect(looseNumber(0, 10).parse("1,5")).toBe(1.5);
    expect(compact({ a: 1, b: undefined, c: null })).toEqual({ a: 1 });
  });
});
