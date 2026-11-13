import { describe, expect, it } from "vitest";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";

type Shape = string | Shape[] | { [key: string]: Shape };

/** Reduce a dictionary to its structure: keys and value kinds, not the words. */
function shape(value: unknown): Shape {
  if (typeof value === "function") return "function";
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]));
  }
  return typeof value;
}

describe("dictionaries", () => {
  it("Spanish and English have exactly the same keys and kinds of values", () => {
    expect(shape(en)).toEqual(shape(es));
  });

  it("pluralise counts in both languages", () => {
    expect(es.receipt.title(1)).toBe("1 cambio en tu semana");
    expect(es.receipt.title(3)).toBe("3 cambios en tu semana");
    expect(en.receipt.title(1)).toBe("1 change to your week");
    expect(en.receipt.title(2)).toBe("2 changes to your week");
  });
});
