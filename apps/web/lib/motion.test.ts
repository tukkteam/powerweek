import { afterEach, describe, expect, it, vi } from "vitest";
import {
  durations,
  ease,
  easings,
  reducedMotion,
  springEasing,
  springs,
  subscribeReducedMotion,
  trembleAngle,
} from "./motion";

const pointsOf = (easing: string) => easing.slice("linear(".length, -1).split(",").map(Number);

describe("motion tokens", () => {
  it("every spring starts at 0, ends at 1 and settles in its duration", () => {
    for (const spring of Object.values(springs)) {
      const points = pointsOf(spring.easing);
      expect(points[0]).toBe(0);
      expect(points.at(-1)).toBe(1);
      // One sample every 20 ms, from 0 to the duration.
      expect((points.length - 1) * 20).toBe(spring.duration);
      expect(spring.duration).toBeLessThanOrEqual(800);
    }
  });

  it("only the bouncy spring bounces, and only a little", () => {
    const peak = (easing: string) => Math.max(...pointsOf(easing));
    expect(peak(springs.bouncy.easing)).toBeGreaterThan(1.03);
    expect(peak(springs.bouncy.easing)).toBeLessThan(1.05);
    expect(peak(springs.snappy.easing)).toBeLessThan(1.01);
    expect(peak(springs.smooth.easing)).toBe(1);
  });

  it("durations grow from instant to glide, and a reduced-motion fade fits in instant", () => {
    const order = [durations.instant, durations.quick, durations.base, durations.slow];
    expect([...order, durations.glide]).toEqual([...order, durations.glide].sort((a, b) => a - b));
    expect(durations.instant).toBeLessThanOrEqual(150);
  });

  it("falls back to the standard easing where linear() is not understood", () => {
    vi.stubGlobal("CSS", { supports: () => false });
    expect(springEasing("bouncy")).toBe(easings.standard);
    vi.stubGlobal("CSS", { supports: () => true });
    expect(springEasing("bouncy")).toBe(springs.bouncy.easing);
    vi.unstubAllGlobals();
  });
});

describe("ease", () => {
  it("runs from 0 to 1 along the curve", () => {
    const standard = ease("standard");
    expect(standard(0)).toBe(0);
    expect(standard(1)).toBe(1);
    expect(standard(-1)).toBe(0);
    expect(standard(2)).toBe(1);
    // Starts fast and lands softly: most of the way there by halfway.
    expect(standard(0.5)).toBeGreaterThan(0.85);
    for (let t = 0.1; t < 1; t += 0.1) expect(standard(t)).toBeGreaterThan(standard(t - 0.1));
  });

  it("matches known points of a CSS curve", () => {
    // ease-in-out (sway) is symmetric: halfway in time is halfway there.
    expect(ease("sway")(0.5)).toBeCloseTo(0.5, 4);
    expect(ease("sway")(0.25) + ease("sway")(0.75)).toBeCloseTo(1, 4);
    // The emphasized curve overshoots before it lands.
    expect(ease("emphasized")(0.7)).toBeGreaterThan(1);
  });
});

describe("reduced motion", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** A window whose reduced-motion preference the test can flip. */
  function fakeWindow(reduce: boolean) {
    const listeners = new Set<() => void>();
    const query = {
      get matches() {
        return reduce;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    };
    const matchMedia = vi.fn(() => query);
    vi.stubGlobal("window", { matchMedia });
    return {
      matchMedia,
      listeners,
      flip(next: boolean) {
        reduce = next;
        for (const fn of listeners) fn();
      },
    };
  }

  it("is false where there is no window, as on the server", () => {
    expect(reducedMotion()).toBe(false);
    expect(() => subscribeReducedMotion(() => {})()).not.toThrow();
  });

  it("reads the media query", () => {
    const win = fakeWindow(true);
    expect(reducedMotion()).toBe(true);
    expect(win.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    win.flip(false);
    expect(reducedMotion()).toBe(false);
  });

  it("tells subscribers when the preference changes, until they leave", () => {
    const win = fakeWindow(false);
    const seen: boolean[] = [];
    const leave = subscribeReducedMotion(() => seen.push(reducedMotion()));
    win.flip(true);
    win.flip(false);
    leave();
    win.flip(true);
    expect(seen).toEqual([true, false]);
    expect(win.listeners.size).toBe(0);
  });
});

describe("trembleAngle", () => {
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
