/** Resistance bands: round the legs, or from an anchor to the hands. */
import {
  FRONT,
  PROFILE,
  QUARTER,
  REST,
  SIDE,
  SUPINE,
  hands,
  post,
  sitting,
  type Family,
  type Gear,
  type Pose,
  type Vec,
  type View,
} from "./kit";

/**
 * A loop band round both legs: above the knees, or round the ankles. It is drawn over the legs,
 * so it shows from any side: from the front as a strap across them, from the side, where one
 * leg hides the other, as a mark on the near one.
 */
const AT_KNEES: Gear = { kind: "cable", from: "kneeL", to: "kneeR", place: "front" };
const AT_ANKLES: Gear = { kind: "cable", from: "ankleL", to: "ankleR", place: "front" };
/** A band tied to a post `high` up, at `at` on the floor, and held in the hands. */
const tied = ([x, , z]: Vec, high: number, each = false): Gear[] => [
  post([x, high, z]),
  { kind: "cable", from: [x, high, z], each },
];

const ON_HIPS: Pose["arms"] = { grip: [10, -26, 4], elbow: [1, -0.2, -0.5] };
/** Hands together in front of the chest. */
const CLASPED: Pose["arms"] = { grip: [4, -10, 12], elbow: [1, -0.7, 0.2] };
/** Elbows out to the sides, for a body lying on its back with its hands by its hips. */
const BY_SIDES = hands([14, 3.7, 3], [1, 0, 0.3]);

/** Floor work with the knees apart: from the side, but enough from the front to see it. */
const ACROSS: View = { yaw: 62 };

/** Feet flat, `wide` apart, knees pushed `out` against the band. */
const stance = (wide: number, ahead: number, out: number): Pick<Pose, "legs" | "legL"> => ({
  legs: { plant: [wide, 4, ahead], knee: [out, 0.2, 1] },
  legL: { plant: [-wide, 4, ahead] },
});

/** On hands and knees: hips over the knees, arms straight under the shoulders. */
const ALL_FOURS: Pose = {
  at: [0, 27, 0],
  pitch: 70,
  nod: -8,
  ...hands([13, 3.7, 28]),
};
/** A leg kneeling under a body on all fours. */
const KNEELING = { flex: 70, bend: 90 } as const;

/** Lying on the right side, head towards +x, propped a little so the shoulder clears the floor. */
const ON_SIDE: Pose = {
  at: [0, 8.6, 0],
  roll: -90,
  side: 16,
  armR: { flex: 170, abduct: -14 },
  armL: { reach: [26, 3.7, 15], elbow: [-1, 0.2, 0.2] },
};

const family: Family = {
  "banded-squat": {
    view: QUARTER,
    gear: [AT_KNEES],
    keys: [
      { at: [0, 48, 0], lean: 3, ...stance(13, 0, 0.5), arms: CLASPED },
      { at: [0, 26, -13], lean: 30, ...stance(13, 0, 1.3), arms: CLASPED },
    ],
  },
  "banded-lateral-walk": {
    view: FRONT,
    gear: [AT_ANKLES],
    keys: [
      {
        at: [-9, 41, -3],
        lean: 18,
        legs: { plant: [0, 4, 0] },
        legL: { plant: [-18, 4, 0] },
        arms: ON_HIPS,
      },
      {
        at: [-1, 39, -3],
        lean: 18,
        legs: { plant: [16, 4, 0] },
        legL: { plant: [-18, 4, 0] },
        arms: ON_HIPS,
      },
      {
        at: [7, 41, -3],
        lean: 18,
        legs: { plant: [16, 4, 0] },
        legL: { plant: [-2, 4, 0] },
        arms: ON_HIPS,
      },
    ],
  },
  "banded-monster-walk": {
    view: QUARTER,
    gear: [AT_ANKLES],
    keys: [
      {
        at: [0, 40, 1],
        lean: 18,
        legs: { plant: [13, 4, 13] },
        legL: { plant: [-13, 4, -9] },
        arms: ON_HIPS,
      },
      {
        at: [0, 40, 1],
        lean: 18,
        legs: { plant: [13, 4, -9] },
        legL: { plant: [-13, 4, 13] },
        arms: ON_HIPS,
      },
    ],
  },
  "banded-glute-bridge": {
    view: ACROSS,
    gear: [AT_KNEES],
    keys: [
      { ...SUPINE, ...stance(13, 24, 0.7), ...BY_SIDES },
      { at: [0, 21, 2], pitch: -122, nod: 48, ...stance(13, 24, 1.2), ...BY_SIDES },
    ],
  },
  "banded-hip-thrust": {
    view: ACROSS,
    gear: [{ kind: "bench", from: [-26, 0, -31], to: [26, 0, -31] }, AT_KNEES],
    keys: [
      { at: [0, 13, -4], pitch: -48, ...stance(13, 27, 0.7), arms: { grip: [7, -22, 6] } },
      { at: [0, 30, 2], pitch: -88, ...stance(13, 27, 1.2), arms: { grip: [7, -22, 6] } },
    ],
  },
  "banded-frog-pump": {
    view: { yaw: 56 },
    gear: [AT_KNEES],
    keys: [
      {
        ...SUPINE,
        legs: { plant: [2.6, 4, 18], knee: [1, 0, 0.9] },
        legL: { plant: [-2.6, 4, 18] },
        ...BY_SIDES,
      },
      {
        at: [0, 16, 1],
        pitch: -112,
        nod: 38,
        legs: { plant: [2.6, 4, 18], knee: [1, 0, 0.9] },
        legL: { plant: [-2.6, 4, 18] },
        ...BY_SIDES,
      },
    ],
  },
  "banded-clamshell": {
    view: { yaw: 20, tilt: 30 },
    gear: [AT_KNEES],
    keys: [
      {
        ...ON_SIDE,
        legR: { flex: 45, bend: 90 },
        legL: { plant: [-32.4, 12.4, 0], knee: [0, 0, 1] },
      },
      {
        ...ON_SIDE,
        legR: { flex: 45, bend: 90 },
        legL: { plant: [-32.4, 12.4, 0], knee: [1, 0, 0.45] },
      },
    ],
  },
  "banded-fire-hydrant": {
    view: { yaw: 38 },
    gear: [AT_KNEES],
    keys: [
      {
        ...ALL_FOURS,
        legL: KNEELING,
        legR: { plant: [4.25, 4.1, -22.9], knee: [0, -0.34, 0.94] },
      },
      {
        ...ALL_FOURS,
        legL: KNEELING,
        legR: { plant: [23, 15, -22.9], knee: [1, -0.17, 0.47] },
      },
    ],
  },
  "banded-donkey-kick": {
    view: PROFILE,
    gear: [AT_KNEES],
    keys: [
      { ...ALL_FOURS, legL: KNEELING, legR: KNEELING },
      { ...ALL_FOURS, legL: KNEELING, legR: { flex: -14, bend: 90 } },
    ],
  },
  "banded-kickback": {
    view: SIDE,
    gear: [AT_ANKLES],
    keys: [
      {
        pin: { what: "ankleL", to: [-4.25, 4, 0] },
        lean: 10,
        legL: { flex: 8, bend: 8 },
        legR: { flex: 2, bend: 8 },
        arms: ON_HIPS,
      },
      {
        pin: { what: "ankleL", to: [-4.25, 4, 0] },
        lean: 18,
        legL: { flex: 14, bend: 8 },
        legR: { flex: -34, bend: 10 },
        arms: ON_HIPS,
      },
    ],
  },
  "banded-standing-hip-abduction": {
    view: FRONT,
    gear: [AT_ANKLES],
    keys: [
      {
        pin: { what: "ankleL", to: [-4.25, 4, 0] },
        legR: { abduct: 5 },
        arms: ON_HIPS,
      },
      {
        pin: { what: "ankleL", to: [-4.25, 4, 0] },
        side: -6,
        legR: { abduct: 36 },
        arms: ON_HIPS,
      },
    ],
  },
  "banded-seated-hip-abduction": {
    view: FRONT,
    gear: [{ kind: "bench", from: [-22, 0, -3], to: [22, 0, -3] }, AT_KNEES],
    keys: [
      {
        ...sitting(),
        lean: 6,
        legs: { plant: [6, 4, 24], knee: [0.1, 0.4, 1] },
        legL: { plant: [-6, 4, 24] },
        arms: ON_HIPS,
      },
      {
        ...sitting(),
        lean: 6,
        legs: { plant: [11, 4, 23], knee: [1, 0.4, 0.8] },
        legL: { plant: [-11, 4, 23] },
        arms: ON_HIPS,
      },
    ],
  },
  "band-pull-apart": {
    view: { yaw: 28 },
    gear: [{ kind: "cable", from: "handL", to: "handR", place: "front" }],
    keys: [
      { ...hands([6, 67, 31], [0.3, -1, -0.2]) },
      { ...hands([34, 66, 23], [0.3, -1, -0.2]) },
      { ...hands([43, 65, 6], [0.3, -1, -0.2]) },
    ],
  },
  "banded-face-pull": {
    view: SIDE,
    gear: tied([0, 0, 62], 88, true),
    keys: [
      { lean: -3, ...hands([6, 82, 33], [1, 0.25, -0.4]) },
      { lean: -6, ...hands([15, 88, 5], [1, 0.25, -0.4]) },
    ],
  },
  "banded-row": {
    view: PROFILE,
    gear: [{ kind: "cable", from: "ankles", each: true }],
    keys: [
      {
        at: [0, REST, 0],
        lean: 8,
        legs: { flex: 96, bend: 12 },
        ...hands([8, 22, 33], [0.4, -0.2, -1]),
      },
      {
        at: [0, REST, 0],
        lean: -8,
        legs: { flex: 96, bend: 12 },
        ...hands([13, 21, 3], [0.4, -0.2, -1]),
      },
    ],
  },
  "banded-lat-pulldown": {
    view: { yaw: 36 },
    gear: [
      { kind: "bar", high: 122 },
      { kind: "cable", from: [0, 122, 0], each: true },
    ],
    keys: [
      {
        pin: { what: "knees", to: [0, 4, 0] },
        legs: { bend: 90 },
        ...hands([11, 97, 3], [1, -0.5, 0.1]),
      },
      {
        pin: { what: "knees", to: [0, 4, 0] },
        legs: { bend: 90 },
        ...hands([20, 62, 3], [1, -0.5, 0.1]),
      },
    ],
  },
  "banded-pallof-press": {
    view: QUARTER,
    gear: tied([-64, 0, 6], 70),
    keys: [
      { legs: { abduct: 9 }, ...hands([3, 69, 11], [0.8, -0.8, 0]) },
      { legs: { abduct: 9 }, ...hands([3, 72, 33], [0.8, -0.8, 0]) },
    ],
  },
  "banded-woodchop": {
    view: { yaw: 30 },
    gear: tied([-60, 0, 4], 122),
    keys: [
      {
        twist: -34,
        side: -6,
        legs: { abduct: 11, flex: 4, bend: 6 },
        armR: { reach: [-13, 104, 17], elbow: [0.3, -0.6, -0.4] },
        armL: { reach: [-19, 106, 13], elbow: [0.3, -0.6, -0.4] },
      },
      {
        twist: 32,
        lean: 16,
        legs: { abduct: 11, flex: 16, bend: 26 },
        armR: { reach: [27, 38, 12], elbow: [0.3, -0.6, -0.4] },
        armL: { reach: [21, 39, 17], elbow: [0.3, -0.6, -0.4] },
      },
    ],
  },
  "banded-dead-bug": {
    view: PROFILE,
    gear: tied([0, 0, -82], 10),
    keys: [
      {
        ...SUPINE,
        ...hands([6, 37, -28], [1, 0, 0.2]),
        legR: { flex: 90, bend: 90 },
        legL: { flex: 16, bend: 4 },
      },
      {
        ...SUPINE,
        ...hands([6, 37, -28], [1, 0, 0.2]),
        legR: { flex: 16, bend: 4 },
        legL: { flex: 90, bend: 90 },
      },
    ],
  },
};

export default family;
