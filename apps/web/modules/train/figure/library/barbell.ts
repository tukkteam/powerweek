/** Barbell lifts, and what is done with a landmine or an EZ bar. */
import {
  BENCH_HIGH,
  FRONT,
  ON_BENCH,
  QUARTER,
  REST,
  SIDE,
  backrest,
  feet,
  flatBench,
  hands,
  hanging,
  inclineBench,
  post,
  sitting,
  type Family,
  type Gear,
  type Pose,
  type Vec,
} from "./kit";

const BAR: Gear = { kind: "barbell" };
/** An EZ bar, or any short bar with small plates. */
const SHORT_BAR: Gear = { kind: "barbell", wide: 50, radius: 6.5 };
/** The bar across the back of the shoulders, and across the front of them. */
const ON_BACK: Pose["arms"] = { grip: [15, 1.5, -5] };
const ON_FRONT: Pose["arms"] = { grip: [12, 2, 8], elbow: [0.3, 0.2, 1] };
/** Elbows out and down, as under a bar being pressed. */
const UNDER: Vec = [0.8, -0.5, -0.4];

/** Arms hanging straight down from a torso leaning `lean`, by their angles. */
const hang = (lean: number): Pose["arms"] => ({ flex: lean, abduct: 3 });

const INCLINE: Vec = [0, BENCH_HIGH + REST, 0];
const DECLINE: Vec = [0, 40, 4];
const LANDMINE: Vec = [0, 1.2, 78];

const family: Family = {
  squat: {
    view: SIDE,
    gear: [BAR],
    keys: [
      { lean: 4, arms: ON_BACK },
      { lean: 40, legs: { flex: 100, bend: 112 }, arms: ON_BACK },
    ],
  },
  "front-squat": {
    view: SIDE,
    gear: [BAR],
    keys: [
      { lean: 2, arms: ON_FRONT },
      { lean: 24, legs: { flex: 104, bend: 124 }, arms: ON_FRONT },
    ],
  },
  "good-morning": {
    view: SIDE,
    gear: [BAR],
    keys: [
      { lean: 4, arms: ON_BACK },
      { lean: 74, legs: { flex: 16, bend: 22 }, arms: ON_BACK },
    ],
  },
  deadlift: {
    view: SIDE,
    gear: [BAR],
    keys: [
      { lean: 2, ...hands([14, 47, 7]) },
      { lean: 62, legs: { flex: 62, bend: 58 }, ...hands([14, 21, 12]) },
    ],
  },
  "romanian-deadlift": {
    view: SIDE,
    gear: [BAR],
    keys: [
      { lean: 2, arms: hang(2) },
      { lean: 70, legs: { flex: 18, bend: 24 }, arms: hang(70) },
    ],
  },
  "rack-pull": {
    view: SIDE,
    gear: [
      BAR,
      // The pins of a rack hold the bar at the knees.
      {
        kind: "rail",
        points: [
          [-33, 0.6, 16],
          [-33, 62, 16],
        ],
      },
      {
        kind: "rail",
        points: [
          [33, 0.6, 16],
          [33, 62, 16],
        ],
      },
    ],
    keys: [
      { lean: 2, arms: hang(2) },
      { lean: 38, legs: { flex: 30, bend: 34 }, arms: hang(38) },
    ],
  },
  "sumo-deadlift": {
    view: FRONT,
    gear: [BAR],
    keys: [
      { lean: 2, legs: { abduct: 24 }, ...hands([7, 44, 8]) },
      { lean: 46, legs: { abduct: 34, flex: 70, bend: 78 }, ...hands([7, 21, 12]) },
    ],
  },
  "trap-bar-deadlift": {
    view: SIDE,
    gear: [{ kind: "barbell", wide: 78 }],
    keys: [
      { lean: 2, ...hands([19, 46, 0]) },
      { lean: 48, legs: { flex: 74, bend: 80 }, ...hands([19, 21, 2]) },
    ],
  },
  "barbell-row": {
    view: SIDE,
    gear: [BAR],
    keys: [
      { lean: 58, legs: { flex: 30, bend: 38 }, arms: hanging(58) },
      {
        lean: 58,
        legs: { flex: 30, bend: 38 },
        arms: { grip: [14, -24, 5], elbow: [0.4, 0.1, -1] },
      },
    ],
  },
  "pendlay-row": {
    view: SIDE,
    gear: [BAR],
    keys: [
      { lean: 84, legs: { flex: 44, bend: 50 }, arms: hanging(84) },
      {
        lean: 84,
        legs: { flex: 44, bend: 50 },
        arms: { grip: [15, -16, 6], elbow: [0.5, 0.1, -1] },
      },
    ],
  },
  shrug: {
    view: FRONT,
    gear: [BAR],
    keys: [
      { ...hands([15, 46.5, 6], [0.1, -0.3, -1]) },
      { nod: 5, ...hands([15, 51.5, 5], [0.1, -0.3, -1]) },
    ],
  },
  "upright-row": {
    view: FRONT,
    gear: [SHORT_BAR],
    keys: [
      { arms: { grip: [6, -36, 7], elbow: [1, 0.9, -0.2] } },
      { arms: { grip: [6, -9, 7], elbow: [1, 0.9, -0.2] } },
    ],
  },
  "bench-press": {
    view: { yaw: 64 },
    gear: [flatBench(), BAR],
    keys: [
      { ...ON_BENCH, ...hands([17, 64, -19], UNDER) },
      { ...ON_BENCH, ...hands([17, 43, -17], UNDER) },
    ],
  },
  "close-grip-bench-press": {
    view: { yaw: 64 },
    gear: [flatBench(), BAR],
    keys: [
      { ...ON_BENCH, ...hands([8, 64, -19], [0.3, -0.6, -0.4]) },
      { ...ON_BENCH, ...hands([8, 43, -15], [0.3, -0.6, -0.4]) },
    ],
  },
  "incline-bench-press": {
    view: { yaw: 64 },
    gear: [...inclineBench(INCLINE, -52), BAR],
    keys: [
      { at: INCLINE, pitch: -52, ...feet(27), ...hands([17, 90, -20], UNDER) },
      { at: INCLINE, pitch: -52, ...feet(27), ...hands([17, 61, -16], UNDER) },
    ],
  },
  "decline-bench-press": {
    view: { yaw: 64 },
    gear: [
      backrest(DECLINE, -106, 44, 8),
      post([0, 30, 0]),
      post([0, 18, -34]),
      // The roller the feet hook under.
      { kind: "plate", at: "ankles", along: [1, 0, 0], radius: 3.4, thick: 16, place: "back" },
      BAR,
    ],
    keys: [
      {
        at: DECLINE,
        pitch: -106,
        legs: { flex: 74, bend: 96 },
        ...hands([17, 64, -22], UNDER),
      },
      {
        at: DECLINE,
        pitch: -106,
        legs: { flex: 74, bend: 96 },
        ...hands([17, 44, -21], UNDER),
      },
    ],
  },
  "skull-crusher": {
    view: { yaw: 64 },
    gear: [flatBench(), SHORT_BAR],
    keys: [
      { ...ON_BENCH, ...hands([7, 65, -24], [0.2, 0.4, 1]) },
      { ...ON_BENCH, ...hands([7, 40, -39], [0.2, 0.4, 1]) },
    ],
  },
  "overhead-press": {
    view: FRONT,
    gear: [BAR],
    keys: [
      { arms: { grip: [14, 1, 7], elbow: [0.5, -0.8, 0.2] } },
      { arms: { grip: [13, 31, 1], elbow: [0.9, -0.3, 0.1] } },
    ],
  },
  "push-press": {
    view: FRONT,
    gear: [BAR],
    keys: [
      { arms: { grip: [14, 1, 7], elbow: [0.5, -0.8, 0.2] } },
      { legs: { flex: 28, bend: 44 }, arms: { grip: [14, 1, 7], elbow: [0.5, -0.8, 0.2] } },
      { arms: { grip: [13, 31, 1], elbow: [0.9, -0.3, 0.1] } },
    ],
  },
  "hip-thrust": {
    view: { yaw: 70 },
    gear: [
      { kind: "bench", from: [-26, 0, -31], to: [26, 0, -31] },
      { kind: "barbell", at: "hips" },
    ],
    keys: [
      { at: [0, 13, -4], pitch: -48, ...feet(27), arms: { grip: [15, -25, 5] } },
      { at: [0, 30, 2], pitch: -88, ...feet(27), arms: { grip: [15, -25, 5] } },
    ],
  },
  "barbell-glute-bridge": {
    view: { yaw: 70 },
    gear: [{ kind: "barbell", at: "hips", radius: 8.5 }],
    keys: [
      {
        at: [0, 9, 0],
        pitch: -96,
        nod: 18,
        ...feet(24),
        arms: { grip: [15, -25, 5], elbow: [1, 0, 0.4] },
      },
      {
        at: [0, 21, 2],
        pitch: -122,
        nod: 48,
        ...feet(24),
        arms: { grip: [15, -25, 5], elbow: [1, 0, 0.4] },
      },
    ],
  },
  "ez-bar-curl": {
    view: { yaw: 72 },
    gear: [SHORT_BAR],
    keys: [{ arms: { flex: 2, abduct: 4, bend: 8 } }, { arms: { flex: 14, abduct: 4, bend: 140 } }],
  },
  "reverse-curl": {
    view: { yaw: 72 },
    gear: [{ kind: "barbell", wide: 64, radius: 8 }],
    keys: [{ arms: { flex: 2, abduct: 4, bend: 8 } }, { arms: { flex: 10, abduct: 4, bend: 132 } }],
  },
  "drag-curl": {
    view: { yaw: 72 },
    gear: [{ kind: "barbell", wide: 64, radius: 8 }],
    keys: [
      { arms: { flex: 2, abduct: 4, bend: 8 } },
      { arms: { flex: -28, abduct: 4, bend: 118 } },
    ],
  },
  "wrist-curl": {
    view: QUARTER,
    gear: [flatBench(-8, 8), SHORT_BAR],
    keys: [
      { ...sitting(), lean: 34, ...hands([8, 39, 31], [0.2, -1, 0.2]) },
      { ...sitting(), lean: 34, ...hands([8, 44, 30], [0.2, -1, 0.2]) },
    ],
  },
  "landmine-press": {
    view: SIDE,
    gear: [{ kind: "landmine", pivot: LANDMINE, to: "handR" }],
    keys: [
      {
        lean: 6,
        legL: { flex: 14, bend: 10 },
        legR: { flex: -16, bend: 8 },
        armR: { grip: [12, -2, 9], elbow: [0.4, -1, -0.2] },
        armL: { grip: [9, -27, 3] },
      },
      {
        lean: 12,
        legL: { flex: 14, bend: 10 },
        legR: { flex: -16, bend: 8 },
        armR: { grip: [10, 26, 30], elbow: [0.4, -1, -0.2] },
        armL: { grip: [9, -27, 3] },
      },
    ],
  },
  "landmine-squat": {
    view: SIDE,
    gear: [{ kind: "landmine", pivot: LANDMINE }],
    keys: [
      { lean: 8, arms: { grip: [4, -6, 11], elbow: [0.6, -1, 0] } },
      { lean: 30, legs: { flex: 98, bend: 112 }, arms: { grip: [4, -6, 11], elbow: [0.6, -1, 0] } },
    ],
  },
  "landmine-romanian-deadlift": {
    view: SIDE,
    gear: [{ kind: "landmine", pivot: LANDMINE }],
    keys: [
      { lean: 2, arms: { flex: 8, abduct: -12 } },
      { lean: 66, legs: { flex: 18, bend: 24 }, arms: { flex: 70, abduct: -12 } },
    ],
  },
  "meadows-row": {
    view: { yaw: 50 },
    gear: [{ kind: "landmine", pivot: [74, 1.2, 12], to: "handR", plate: 9, place: "among" }],
    keys: [
      {
        lean: 60,
        legL: { flex: 48, bend: 40 },
        legR: { flex: 4, bend: 20 },
        armR: hanging(60),
        armL: { grip: [10, -22, 22], elbow: [0.6, -0.4, 0.4] },
      },
      {
        lean: 60,
        legL: { flex: 48, bend: 40 },
        legR: { flex: 4, bend: 20 },
        armR: { grip: [15, -20, 4], elbow: [0.7, 0.1, -1] },
        armL: { grip: [10, -22, 22], elbow: [0.6, -0.4, 0.4] },
      },
    ],
  },
};

export default family;
