/**
 * Springs as SwiftUI describes them, turned into something CSS and the Web Animations API can
 * play: a `linear()` easing sampled from the spring, and the time it takes to settle.
 *
 * `response` is the period of the spring without damping, in seconds: smaller is faster.
 * `damping` is the damping ratio: 1 settles without overshooting, lower values bounce.
 */

/** One sample every 20 ms: finer than a frame at 60 Hz, so the curve plays smoothly. */
export const STEP_MS = 20;

/** A spring has settled once it stays within 0.1 % of its target: 1 px over 1000 px. */
export const SETTLED = 0.001;

/** Where a spring released from 0 towards 1 is after `t` seconds. */
export function springAt(t, { response, damping }) {
  const omega = (2 * Math.PI) / response;
  if (damping >= 1) return 1 - Math.exp(-omega * t) * (1 + omega * t);
  const damped = omega * Math.sqrt(1 - damping * damping);
  const decay = Math.exp(-damping * omega * t);
  return 1 - decay * (Math.cos(damped * t) + ((damping * omega) / damped) * Math.sin(damped * t));
}

/**
 * The spring sampled every `STEP_MS` until it settles: its duration in milliseconds and the
 * points of its curve, rounded to three decimals, starting at 0 and ending exactly at 1.
 */
export function sampleSpring(spring) {
  if (!(spring.response > 0) || !(spring.damping > 0))
    throw new Error(`A spring needs a positive response and damping: ${JSON.stringify(spring)}`);
  let last = 0;
  for (let ms = 0; ms <= 5000; ms++)
    if (Math.abs(1 - springAt(ms / 1000, spring)) > SETTLED) last = ms;
  if (last >= 5000) throw new Error(`This spring takes more than 5 s to settle: ${spring.name}`);
  const steps = Math.ceil((last + 1) / STEP_MS);
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const value = springAt((i * STEP_MS) / 1000, spring);
    points.push(Math.round(value * 1000) / 1000);
  }
  points[0] = 0;
  points[steps] = 1;
  return { duration: steps * STEP_MS, points };
}

/** The points as a CSS `linear()` easing. */
export const linearEasing = (points) => `linear(${points.join(", ")})`;
