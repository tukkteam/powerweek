/**
 * Motion shared by the screens that move things by hand. Until the motion tokens of #25 exist,
 * this is the one place these values live.
 */

/**
 * A spring with a little give: it overshoots by about 4 % and settles in `SPRING_MS`. Written
 * as a CSS `linear()` easing, sampled from a damped spring (period 0.38 s, damping ratio 0.72),
 * so CSS transitions and the Web Animations API can both use it.
 */
export const SPRING =
  "linear(0, 0.047, 0.158, 0.299, 0.448, 0.587, 0.71, 0.811, 0.89, 0.949, 0.989, 1.016, 1.031, 1.037, 1.038, 1.035, 1.031, 1.025, 1.019, 1.014, 1.01, 1.006, 1.003, 1.001, 1, 0.999, 0.999, 0.999, 1)";
export const SPRING_MS = 560;

/** For browsers without `linear()` (Safari before 17.2): an ease-out with no overshoot. */
const FALLBACK = "cubic-bezier(0.2, 0.8, 0.2, 1)";

/**
 * The spring, or the fallback where `linear()` is not understood. Use it for the Web Animations
 * API, which throws on an easing it cannot parse. Client only.
 */
export function springEasing(): string {
  return typeof CSS !== "undefined" && CSS.supports("transition-timing-function", SPRING)
    ? SPRING
    : FALLBACK;
}

/** The person asked for less motion. Client only. */
export function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * How far a card of this width turns while it trembles, in degrees, so that its edges move the
 * same `reach` in pixels whatever its size: a narrow card turns more, a wide one less.
 */
export function trembleAngle(width: number, reach = 1.6): number {
  if (!(width > 0)) return 0;
  return (Math.atan(reach / (width / 2)) * 180) / Math.PI;
}
