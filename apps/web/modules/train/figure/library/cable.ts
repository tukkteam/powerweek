/**
 * Cable machines: a column, a pulley, a cable to the hands (or an ankle). What tells one
 * exercise from another is where the pulley is and where the cable ends, so every exercise
 * here uses the same column and the least attachment that says what is held.
 */
import {
  BENCH_HIGH,
  FRONT,
  QUARTER,
  REST,
  SIDE,
  feet,
  hands,
  inclineBench,
  type Family,
  type Gear,
  type Pose,
  type Vec,
} from "./kit";

// ── The machine ─────────────────────────────────────────────────────────────────────────────

const TOP = 130;
/** Pulley heights: by the floor, at the chest, above the head. */
const LOW = 9;
const MID = 72;
const HIGH = 120;

/**
 * One column of a cable machine, standing at (x, z) on the floor, with its pulley `high` up
 * it and its weight stack on the side away from the figure. Draw the cable from `pulley`.
 * A low machine (a rowing station) has a shorter column: `top`.
 */
function column(x: number, z: number, high: number, top = TOP): { pulley: Vec; gear: Gear[] } {
  const pulley: Vec = [x, high, z];
  // A column in front or behind has its wheel turned to the side; one beside, to the front.
  const beside = Math.abs(x) > Math.abs(z);
  const away = beside ? Math.sign(x) : Math.sign(z);
  return {
    pulley,
    gear: [
      {
        kind: "rail",
        points: [
          [x, 0.6, z],
          [x, top, z],
        ],
      },
      {
        kind: "box",
        at: beside ? [x + away * 8, 0, z] : [x, 0, z + away * 8],
        wide: beside ? 9 : 13,
        deep: beside ? 13 : 9,
        high: 44,
        place: "back",
      },
      {
        kind: "plate",
        at: pulley,
        along: beside ? [0, 0, 1] : [1, 0, 0],
        radius: 2.7,
        thick: 2.2,
        place: "back",
      },
    ],
  };
}

/** A column and the cable from it: to both hands, to `each` (a rope), or to one joint. */
function cabled(
  x: number,
  z: number,
  high: number,
  to: "hands" | "each" | "handL" | "handR" | "ankleL" | "ankleR" = "hands",
  top = TOP,
): Gear[] {
  const { pulley, gear } = column(x, z, high, top);
  const cable: Gear =
    to === "each"
      ? { kind: "cable", from: pulley, each: true }
      : to === "hands"
        ? { kind: "cable", from: pulley }
        : { kind: "cable", from: pulley, to };
  return [...gear, cable];
}

/** A short straight bar in the hands. */
const BAR: Gear = { kind: "handle", wide: 24 };

// ── Stances ─────────────────────────────────────────────────────────────────────────────────

/** One foot ahead of the other, to brace against a pull from in front or behind. */
const STRIDE: Pick<Pose, "legL" | "legR"> = {
  legL: { flex: 17, bend: 15 },
  legR: { flex: -13, bend: 9 },
};
/** Feet apart, knees soft: braced against a pull from the side. */
const BRACED: Pose["legs"] = { abduct: 9, flex: 9, bend: 16 };
/** A hand resting on the hip. */
const ON_HIP: NonNullable<Pose["arms"]> = { grip: [9.5, -27, 3], elbow: [1, -0.2, -0.5] };

// ── Pulldowns: a seat under a pulley overhead ───────────────────────────────────────────────

const PULLDOWN_SEAT = 28;
const OVERHEAD: Vec = [0, 132, 4];
const pulldownRig = (wide: number): Gear[] => [
  { kind: "bench", from: [0, 0, -9], to: [0, 0, 9], high: PULLDOWN_SEAT },
  {
    kind: "rail",
    points: [[0, 0.6, -26], [0, 132, -26], OVERHEAD],
  },
  { kind: "plate", at: OVERHEAD, along: [1, 0, 0], radius: 2.7, thick: 2.2, place: "back" },
  { kind: "cable", from: OVERHEAD },
  { kind: "handle", wide },
];
const pulldownSeat = (lean: number): Pose => ({
  at: [0, PULLDOWN_SEAT + REST, 0],
  lean,
  ...feet(23, 7),
});

// ── Kneeling ────────────────────────────────────────────────────────────────────────────────

/** On both knees, the shins along the floor behind, the thighs `back` from upright. */
const kneeling = (back: number): Pose => ({
  pin: { what: "knees", to: [0, 4, 0] },
  legs: { flex: back, bend: 90 + back },
});

const INCLINE: Vec = [0, BENCH_HIGH + REST, 0];

const family: Family = {
  // ── The column in front ──────────────────────────────────────────────────────────────────
  "tricep-pushdown": {
    view: SIDE,
    gear: [...cabled(0, 34, HIGH), BAR],
    keys: [
      { lean: 9, legs: { flex: 6, bend: 10 }, arms: { flex: 8, abduct: 3, bend: 122 } },
      { lean: 9, legs: { flex: 6, bend: 10 }, arms: { flex: 8, abduct: 3, bend: 8 } },
    ],
  },
  "rope-tricep-pushdown": {
    view: SIDE,
    gear: cabled(0, 34, HIGH, "each"),
    keys: [
      { lean: 9, legs: { flex: 6, bend: 10 }, arms: { flex: 8, abduct: 1, bend: 122 } },
      { lean: 9, legs: { flex: 6, bend: 10 }, arms: { flex: 2, abduct: 9, bend: 6 } },
    ],
  },
  "cable-curl": {
    view: SIDE,
    gear: [...cabled(0, 34, LOW), BAR],
    keys: [
      { lean: -3, arms: { flex: 6, abduct: 3, bend: 12 } },
      { lean: -3, arms: { flex: 12, abduct: 3, bend: 138 } },
    ],
  },
  "rope-hammer-curl": {
    view: SIDE,
    gear: cabled(0, 34, LOW, "each"),
    keys: [
      { lean: -3, arms: { flex: 6, abduct: 5, bend: 12 } },
      { lean: -3, arms: { flex: 10, abduct: 5, bend: 128 } },
    ],
  },
  "straight-arm-pulldown": {
    view: SIDE,
    gear: [...cabled(0, 46, HIGH), { kind: "handle", wide: 34 }],
    keys: [
      { lean: 24, legs: { flex: 14, bend: 18 }, arms: { flex: 146, abduct: 3, bend: 8 } },
      { lean: 24, legs: { flex: 14, bend: 18 }, arms: { flex: 32, abduct: 3, bend: 8 } },
    ],
  },
  "face-pull": {
    view: SIDE,
    gear: cabled(0, 48, 98, "each"),
    keys: [
      { lean: -5, ...STRIDE, ...hands([8, 88, 26], [1, 0.5, -0.3]) },
      { lean: -9, ...STRIDE, ...hands([18, 91, 2], [1, 0.5, -0.3]) },
    ],
  },
  "seated-row": {
    view: SIDE,
    gear: [
      { kind: "bench", from: [0, 0, -12], to: [0, 0, 12], high: 21 },
      // The plate the feet push against.
      {
        kind: "rail",
        points: [
          [0, 0.6, 40],
          [0, 22, 44],
        ],
      },
      ...cabled(0, 54, 37, "hands", 78),
      { kind: "handle", wide: 16 },
    ],
    keys: [
      {
        at: [0, 21 + REST, 0],
        lean: 14,
        legs: { plant: [7, 13, 37], knee: [0.1, 1, 0.2] },
        legL: { plant: [-7, 13, 37] },
        ...hands([7, 41, 33], [0.3, -0.3, -1]),
      },
      {
        at: [0, 21 + REST, 0],
        lean: -9,
        legs: { plant: [7, 13, 37], knee: [0.1, 1, 0.2] },
        legL: { plant: [-7, 13, 37] },
        ...hands([8, 40, 9], [0.3, -0.3, -1]),
      },
    ],
  },
  "single-arm-cable-row": {
    view: SIDE,
    gear: cabled(0, 54, 60, "handR"),
    keys: [
      {
        lean: 12,
        ...STRIDE,
        armR: { grip: [13, -17, 29], elbow: [0.3, -0.2, -1] },
        armL: ON_HIP,
      },
      {
        lean: 8,
        twist: -10,
        ...STRIDE,
        armR: { grip: [15, -22, 2], elbow: [0.3, -0.1, -1] },
        armL: ON_HIP,
      },
    ],
  },
  "cable-kickback": {
    view: SIDE,
    gear: cabled(0, 40, LOW, "ankleR"),
    keys: [
      {
        pin: { what: "ankleL", to: [-4.3, 4, 0] },
        lean: 38,
        legL: { flex: 14, bend: 10 },
        legR: { flex: 38, bend: 52 },
        ...hands([7, 84, 38], [0.6, -1, 0]),
      },
      {
        pin: { what: "ankleL", to: [-4.3, 4, 0] },
        lean: 38,
        legL: { flex: 14, bend: 10 },
        legR: { flex: -40, bend: 12 },
        ...hands([7, 84, 38], [0.6, -1, 0]),
      },
    ],
  },
  "cable-crunch": {
    view: SIDE,
    gear: cabled(0, 44, HIGH, "each"),
    keys: [
      { ...kneeling(4), lean: 8, arms: { grip: [8, 9, 9], elbow: [0.5, -1, 0.3] } },
      { ...kneeling(22), lean: 78, nod: 18, arms: { grip: [8, 9, 9], elbow: [0.5, -1, 0.3] } },
    ],
  },

  // ── The column behind ────────────────────────────────────────────────────────────────────
  "overhead-tricep-extension": {
    view: SIDE,
    gear: cabled(0, -40, 104, "each"),
    keys: [
      { lean: 30, ...STRIDE, arms: { flex: 158, abduct: 2, bend: 118 } },
      { lean: 30, ...STRIDE, arms: { flex: 158, abduct: 2, bend: 8 } },
    ],
  },
  "cable-front-raise": {
    view: SIDE,
    gear: [...cabled(0, -34, LOW), BAR],
    keys: [
      { lean: 1, arms: { flex: 8, abduct: 3, bend: 8 } },
      { lean: -3, arms: { flex: 92, abduct: 3, bend: 8 } },
    ],
  },
  "cable-pull-through": {
    view: SIDE,
    gear: cabled(0, -42, LOW, "each"),
    keys: [
      {
        lean: 66,
        legs: { abduct: 7, flex: 20, bend: 28 },
        arms: { flex: 34, abduct: -9, bend: 4 },
      },
      { lean: 2, legs: { abduct: 7, flex: 0, bend: 0 }, arms: { flex: 10, abduct: -9, bend: 4 } },
    ],
  },

  // ── Under a pulley overhead ──────────────────────────────────────────────────────────────
  "lat-pulldown": {
    view: { yaw: 52 },
    gear: pulldownRig(48),
    keys: [
      { ...pulldownSeat(-4), ...hands([21, 93, 4], [0.9, -0.5, -0.1]) },
      { ...pulldownSeat(-12), ...hands([18, 67, 5], [0.9, -0.5, -0.1]) },
    ],
  },
  "wide-grip-lat-pulldown": {
    view: { yaw: 40 },
    gear: pulldownRig(66),
    keys: [
      { ...pulldownSeat(-4), ...hands([28, 90, 3], [1, -0.4, -0.1]) },
      { ...pulldownSeat(-10), ...hands([27, 69, 3], [1, -0.5, -0.1]) },
    ],
  },
  "close-grip-lat-pulldown": {
    view: { yaw: 62 },
    gear: pulldownRig(14),
    keys: [
      { ...pulldownSeat(-6), ...hands([5, 95, 5], [0.5, -0.6, 0.6]) },
      { ...pulldownSeat(-18), ...hands([5, 64, 5], [0.5, -0.9, -0.2]) },
    ],
  },

  // ── A column on either side ──────────────────────────────────────────────────────────────
  "cable-fly": {
    view: FRONT,
    gear: [...cabled(54, -8, HIGH, "handR"), ...cabled(-54, -8, HIGH, "handL")],
    keys: [
      { lean: 12, ...STRIDE, ...hands([43, 88, 2], [0.5, -0.4, -1]) },
      { lean: 12, ...STRIDE, ...hands([3, 50, 27], [1, -0.1, -0.3]) },
    ],
  },
  "incline-cable-fly": {
    view: { yaw: 30 },
    gear: [
      ...inclineBench(INCLINE, -52),
      ...cabled(56, -20, LOW, "handR"),
      ...cabled(-56, -20, LOW, "handL"),
    ],
    keys: [
      { at: INCLINE, pitch: -52, ...feet(27), ...hands([42, 50, -24], [0.4, -1, -0.2]) },
      { at: INCLINE, pitch: -52, ...feet(27), ...hands([3, 86, -12], [1, -0.4, -0.2]) },
    ],
  },
  "cable-rear-delt-fly": {
    view: FRONT,
    gear: [
      ...column(54, 10, 100).gear,
      ...column(-54, 10, 100).gear,
      // Crossed: each hand holds the cable from the other side.
      { kind: "cable", from: [54, 100, 10], to: "handL" },
      { kind: "cable", from: [-54, 100, 10], to: "handR" },
    ],
    keys: [
      { lean: 4, legs: { flex: 6, bend: 10 }, ...hands([-9, 84, 27], [0.6, -0.5, -0.6]) },
      { lean: 4, legs: { flex: 6, bend: 10 }, ...hands([44, 82, -8], [0.2, -0.6, -1]) },
    ],
  },

  // ── The column to one side ───────────────────────────────────────────────────────────────
  "cable-lateral-raise": {
    view: FRONT,
    gear: cabled(-50, 4, LOW, "handR"),
    keys: [
      { armR: { abduct: 6, flex: 10, bend: 10 }, armL: ON_HIP },
      { armR: { abduct: 86, flex: 8, bend: 12 }, armL: ON_HIP },
    ],
  },
  "cable-standing-hip-abduction": {
    view: FRONT,
    gear: cabled(-48, 0, LOW, "ankleR"),
    keys: [
      {
        pin: { what: "ankleL", to: [-4.3, 4, 0] },
        legR: { abduct: -4, flex: 8, bend: 4 },
        armL: { reach: [-46, 84, 0], elbow: [0, -1, 0.2] },
        armR: ON_HIP,
      },
      {
        pin: { what: "ankleL", to: [-4.3, 4, 0] },
        side: -4,
        legR: { abduct: 34, flex: 0, bend: 4 },
        armL: { reach: [-46, 84, 0], elbow: [0, -1, 0.2] },
        armR: ON_HIP,
      },
    ],
  },
  "cable-standing-hip-adduction": {
    view: FRONT,
    gear: cabled(50, 0, LOW, "ankleR"),
    keys: [
      {
        pin: { what: "ankleL", to: [-10, 4, 0] },
        legR: { abduct: 32, flex: 0, bend: 4 },
        armR: { reach: [48, 86, 0], elbow: [0, -1, 0.2] },
        armL: ON_HIP,
      },
      {
        pin: { what: "ankleL", to: [-10, 4, 0] },
        legR: { abduct: -12, flex: 16, bend: 4 },
        armR: { reach: [48, 86, 0], elbow: [0, -1, 0.2] },
        armL: ON_HIP,
      },
    ],
  },
  "pallof-press": {
    view: QUARTER,
    gear: cabled(52, 6, MID),
    keys: [
      { legs: BRACED, ...hands([3, 71, 10], [0.8, -0.7, 0]) },
      { legs: BRACED, ...hands([3, 73, 32], [0.8, -0.7, 0]) },
    ],
  },
  "cable-pallof-hold": {
    view: QUARTER,
    gear: cabled(52, 6, MID),
    keys: [
      { legs: BRACED, ...hands([3, 73, 32], [0.8, -0.7, 0]) },
      { legs: BRACED, twist: 3, ...hands([2, 73, 31], [0.8, -0.7, 0]) },
    ],
  },
  "half-kneeling-pallof-press": {
    view: QUARTER,
    gear: cabled(52, 6, 50),
    keys: [
      {
        pin: { what: "kneeR", to: [4.3, 4, 0] },
        legR: { flex: 0, bend: 90 },
        legL: { flex: 90, bend: 90 },
        ...hands([3, 49, 10], [0.8, -0.7, 0]),
      },
      {
        pin: { what: "kneeR", to: [4.3, 4, 0] },
        legR: { flex: 0, bend: 90 },
        legL: { flex: 90, bend: 90 },
        ...hands([3, 51, 32], [0.8, -0.7, 0]),
      },
    ],
  },
  "cable-woodchop": {
    view: { yaw: 36 },
    gear: cabled(-52, 6, HIGH),
    keys: [
      {
        legs: BRACED,
        twist: -38,
        side: -6,
        armR: { reach: [-20, 100, 16], elbow: [0.6, -0.6, -0.4] },
        armL: { reach: [-24, 100, 16], elbow: [0.6, -0.6, -0.4] },
      },
      {
        legs: BRACED,
        twist: 0,
        lean: 6,
        armR: { reach: [4, 74, 31], elbow: [0.6, -0.6, -0.4] },
        armL: { reach: [0, 74, 31], elbow: [0.6, -0.6, -0.4] },
      },
      {
        legs: BRACED,
        twist: 38,
        lean: 14,
        side: 6,
        armR: { reach: [28, 44, 12], elbow: [0.6, -0.6, -0.4] },
        armL: { reach: [24, 44, 12], elbow: [0.6, -0.6, -0.4] },
      },
    ],
  },
};

export default family;
