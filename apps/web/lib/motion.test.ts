import { describe, expect, it } from "vitest";
import { SPRING, trembleAngle } from "./motion";

describe("motion", () => {
  it("the spring starts at 0, ends at 1 and overshoots only a little", () => {
    const points = SPRING.slice("linear(".length, -1).split(",").map(Number);
    expect(points[0]).toBe(0);
    expect(points.at(-1)).toBe(1);
    expect(Math.max(...points)).toBeGreaterThan(1);
    expect(Math.max(...points)).toBeLessThan(1.05);
  });

  it("turns narrow cards more than wide ones, so their edges move the same", () => {
    const phone = trembleAngle(358);
    const half = trembleAngle(600);
    const wide = trembleAngle(1216);
    expect(phone).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(wide);
    // The edge of each moves the same distance: half the width times the tangent.
    for (const [width, angle] of [
      [358, phone],
      [1216, wide],
    ])
      expect((width / 2) * Math.tan((angle * Math.PI) / 180)).toBeCloseTo(1.6, 5);
  });

  it("does not turn a card it cannot measure", () => {
    expect(trembleAngle(0)).toBe(0);
    expect(trembleAngle(Number.NaN)).toBe(0);
  });
});
