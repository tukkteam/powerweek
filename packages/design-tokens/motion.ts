// PowerWeek motion tokens, generated from tokens.json by @powerweek/design-tokens. Do not edit by hand.

/** The pace dial these values were built with (tokens.json, motion.tempo). */
export const tempo = 1;

/** Easing curves as CSS values. Read `bezier` for the four control numbers. */
export const easings = {
  /** The default. Anything arriving or moving to a new place: entrances, glides, fills, fades and colour. Starts fast, lands softly. */
  "standard": "cubic-bezier(0.2, 0.8, 0.2, 1)",
  /** Small things that should feel alive as they appear or grow: Week Pulse bars, controls popping in. Overshoots a little. */
  "emphasized": "cubic-bezier(0.34, 1.56, 0.64, 1)",
  /** Things leaving: a sheet closing, a card dismissed. Starts slow and gets out of the way. */
  "exit": "cubic-bezier(0.3, 0, 1, 1)",
  /** Loops that go back and forth: listening bars, a breathing dot, the tremble while arranging. */
  "sway": "cubic-bezier(0.42, 0, 0.58, 1)",
} as const;

/** The control points of each easing, for code that eases numbers itself. */
export const bezier = {
  /** The default. Anything arriving or moving to a new place: entrances, glides, fills, fades and colour. Starts fast, lands softly. */
  "standard": [0.2, 0.8, 0.2, 1],
  /** Small things that should feel alive as they appear or grow: Week Pulse bars, controls popping in. Overshoots a little. */
  "emphasized": [0.34, 1.56, 0.64, 1],
  /** Things leaving: a sheet closing, a card dismissed. Starts slow and gets out of the way. */
  "exit": [0.3, 0, 1, 1],
  /** Loops that go back and forth: listening bars, a breathing dot, the tremble while arranging. */
  "sway": [0.42, 0, 0.58, 1],
} as const satisfies Record<keyof typeof easings, readonly [number, number, number, number]>;

/** Durations in milliseconds. */
export const durations = {
  /** Press feedback and hover colour. Also the longest fade allowed with reduced motion. */
  "instant": 150,
  /** Fades, colour, borders and shadows. */
  "quick": 200,
  /** Small movements: a bar growing, a card rising in, a tile settling. */
  "base": 260,
  /** Larger movements: the Day Bar resizing, blocks gliding to a new place, a pressed box sinking. */
  "slow": 440,
  /** Progress: fills and numbers moving to a new value slowly enough to follow. */
  "glide": 700,
  /** The step between things arriving one after another: the rows of a dialog, the controls of a card in edit mode. */
  "stagger": 40,
} as const;

/**
 * Springs: `response` (seconds) and `damping` (ratio) as in SwiftUI, and the same spring as a
 * CSS `linear()` easing that settles in `duration` milliseconds.
 */
export const springs = {
  /** Presses and toggles: quick, with almost no bounce. */
  "snappy": {
    response: 0.28,
    damping: 0.85,
    duration: 400,
    easing: "linear(0, 0.078, 0.242, 0.424, 0.588, 0.722, 0.823, 0.895, 0.943, 0.973, 0.991, 1, 1.005, 1.006, 1.006, 1.005, 1.004, 1.003, 1.002, 1.001, 1)",
  },
  /** Opening and closing details, moving between screens: no bounce at all. */
  "smooth": {
    response: 0.4,
    damping: 1,
    duration: 600,
    easing: "linear(0, 0.04, 0.131, 0.243, 0.358, 0.466, 0.562, 0.645, 0.715, 0.774, 0.821, 0.859, 0.89, 0.914, 0.934, 0.949, 0.96, 0.97, 0.977, 0.982, 0.986, 0.99, 0.992, 0.994, 0.995, 0.997, 0.997, 0.998, 0.999, 0.999, 1)",
  },
  /** Things moved by hand: a card dropped into place, neighbours making room. Overshoots about 4 % and settles. */
  "bouncy": {
    response: 0.38,
    damping: 0.72,
    duration: 620,
    easing: "linear(0, 0.047, 0.158, 0.299, 0.448, 0.587, 0.71, 0.811, 0.89, 0.949, 0.989, 1.016, 1.031, 1.037, 1.038, 1.035, 1.031, 1.025, 1.019, 1.014, 1.01, 1.006, 1.003, 1.001, 1, 0.999, 0.999, 0.999, 0.999, 0.999, 0.999, 1)",
  },
} as const;

/** How far a pressed control sinks. It scales so its edges move about `reach` pixels: small buttons go down to `deep`, wide cards stop at `shallow`. `dim` is the brightness it takes while held, the only change left with reduced motion. Press in over duration-instant, spring back on spring-snappy. */
export const press = {
  deep: 0.96,
  shallow: 0.98,
  reach: 3,
  dim: 0.9,
} as const;

export type EasingName = keyof typeof easings;
export type DurationName = keyof typeof durations;
export type SpringName = keyof typeof springs;
