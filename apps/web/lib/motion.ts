/**
 * Motion for the app: the motion tokens (`@powerweek/design-tokens/motion`, generated from
 * tokens.json, where `tempo` sets the pace of everything), the helpers that play them from code,
 * and the one place that asks whether the person wants less motion. CSS reads the same tokens as
 * variables (`--easing-*`, `--duration-*`, `--spring-*`). docs/motion.md lists the recipes built
 * on them and says which to use for what.
 */
import {
  bezier,
  durations,
  easings,
  press,
  springs,
  tempo,
  type EasingName,
  type SpringName,
} from "@powerweek/design-tokens/motion";
import { useSyncExternalStore } from "react";

export { bezier, durations, easings, press, springs, tempo, type EasingName, type SpringName };

/**
 * A spring's easing for the Web Animations API, which throws on an easing it cannot parse: the
 * spring, or the standard easing where `linear()` is not understood (Safari before 17.2).
 * Client only.
 */
export function springEasing(name: SpringName): string {
  const { easing } = springs[name];
  return typeof CSS !== "undefined" && CSS.supports("transition-timing-function", easing)
    ? easing
    : easings.standard;
}

/**
 * A spring token in the shape the `motion` library takes (mass 1): the same spring CSS plays as
 * `--spring-*`, but simulated, so it can be interrupted and carry its velocity into the next
 * animation. Stiffness is the square of the angular frequency; damping is twice the damping
 * ratio times it.
 */
export function physics(name: SpringName): {
  type: "spring";
  stiffness: number;
  damping: number;
  mass: 1;
} {
  const { response, damping } = springs[name];
  const omega = (2 * Math.PI) / response;
  return { type: "spring", stiffness: omega * omega, damping: 2 * damping * omega, mass: 1 };
}

/**
 * An easing as a function from progress (0 to 1) to eased progress, for code that moves numbers
 * itself, so a tweened number and a CSS fill next to it move as one.
 */
export function ease(name: EasingName): (t: number) => number {
  const [x1, y1, x2, y2] = bezier[name];
  const at = (a: number, b: number, s: number) =>
    3 * a * s * (1 - s) ** 2 + 3 * b * s ** 2 * (1 - s) + s ** 3;
  const slope = (a: number, b: number, s: number) =>
    3 * a * (1 - s) ** 2 + 6 * (b - a) * s * (1 - s) + 3 * (1 - b) * s ** 2;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // Find the curve parameter whose x is t (Newton's method, then halving if it stalls).
    let s = t;
    for (let i = 0; i < 8; i++) {
      const dx = slope(x1, x2, s);
      if (Math.abs(dx) < 1e-6) break;
      s -= (at(x1, x2, s) - t) / dx;
    }
    if (!(s >= 0 && s <= 1) || Math.abs(at(x1, x2, s) - t) > 1e-5) {
      let low = 0;
      let high = 1;
      s = t;
      for (let i = 0; i < 40; i++) {
        if (at(x1, x2, s) < t) low = s;
        else high = s;
        s = (low + high) / 2;
      }
    }
    return at(y1, y2, s);
  };
}

// ── Reduced motion ──────────────────────────────────────────────────────────────────────────
// The one place code asks. CSS asks in one place too: the reduced-motion block at the end of
// app/globals.css.

export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** The person asked for less motion. Client only; false where there is no window. */
export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_MOTION).matches;
}

/** Calls `onChange` whenever the preference changes; returns the unsubscribe. */
export function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Whether the person asked for less motion, kept up to date while the page is open. False on
 * the server and in the first render, so the markup matches before hydration.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, reducedMotion, () => false);
}

// ── Arranging ───────────────────────────────────────────────────────────────────────────────

/**
 * How far a card of this width turns while it trembles, in degrees, so that its edges move the
 * same `reach` in pixels whatever its size: a narrow card turns more, a wide one less.
 */
export function trembleAngle(width: number, reach = 1.6): number {
  if (!(width > 0)) return 0;
  return (Math.atan(reach / (width / 2)) * 180) / Math.PI;
}

// ── Pressing ────────────────────────────────────────────────────────────────────────────────

/**
 * How far a pressed control of this size scales, so that its edges move about `press.reach`
 * pixels: an icon button sinks to `press.deep`, a wide card only to `press.shallow`. It goes by
 * the longer side, so a long thin row moves as little as a card.
 */
export function pressScale(width: number, height: number): number {
  const side = Math.max(width, height);
  if (!(side > 0)) return press.shallow;
  const scale = 1 - (2 * press.reach) / side;
  return Math.min(press.shallow, Math.max(press.deep, Number(scale.toFixed(4))));
}
