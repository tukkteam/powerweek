/** Cardio, stretches, and the odd piece of kit: a kettlebell, a plate. */
import {
  FRONT,
  PROFILE,
  QUARTER,
  REST,
  SIDE,
  hands,
  post,
  type Family,
  type Gear,
  type Pose,
  type Vec,
} from "./kit";

type Arm = NonNullable<Pose["arms"]>;
type Leg = NonNullable<Pose["legs"]>;

/**
 * A stride: its two opposite poses, one leg and the other arm forward, then the other way. The
 * loop passes through the middle of the stride on its own.
 */
const stride = (lean: number, front: Leg, back: Leg, fore: Arm, aft: Arm): [Pose, Pose] => [
  { lean, legR: front, legL: back, armL: fore, armR: aft },
  { lean, legL: front, legR: back, armR: fore, armL: aft },
];

/** A wheel seen as its rim: a ring standing on the floor plane the figure moves in. */
function ring(centre: Vec, radius: number, sides = 24): Gear {
  const points: Vec[] = [];
  for (let k = 0; k <= sides; k++) {
    const a = (k / sides) * 2 * Math.PI;
    points.push([centre[0], centre[1] + Math.sin(a) * radius, centre[2] + Math.cos(a) * radius]);
  }
  return { kind: "rail", points };
}

/** A line through fixed points. */
const rail = (...points: Vec[]): Gear => ({ kind: "rail", points });

/** Hands on the hips. */
const ON_HIPS: Arm = { grip: [10, -27, 3], elbow: [1, -0.2, -0.5] };

// ── A bicycle, and what turns on a crank ────────────────────────────────────────────────────

/** Where a foot is on a pedal: `turn` 0 at the top, 90 forward, 180 at the bottom. */
const pedal = (crank: Vec, turn: number, side: 1 | -1): Vec => {
  const a = (turn * Math.PI) / 180;
  return [side * 7, crank[1] + 4 + Math.cos(a) * 8, crank[2] + Math.sin(a) * 8];
};
/** Pedalling: the right foot from the top, by the front, to the bottom; the left opposite. */
const pedalling = (crank: Vec, pose: (k: number) => Pose): [Pose, Pose, Pose] =>
  [0, 90, 180].map((turn, k) => ({
    ...pose(k),
    legR: { plant: pedal(crank, turn, 1) },
    legL: { plant: pedal(crank, turn + 180, -1) },
  })) as [Pose, Pose, Pose];

const BIKE_CRANK: Vec = [0, 17, 4];
const BIKE: Gear[] = [
  ring([0, 16.8, -30], 16),
  ring([0, 16.8, 42], 16),
  // The frame: rear wheel to the crank and up to the saddle; saddle to the bars; the fork.
  rail([0, 16.8, -30], BIKE_CRANK, [0, 49, -9], [0, 16.8, -30]),
  rail([0, 49, -9], [0, 58, 30], BIKE_CRANK),
  rail([0, 16.8, 42], [0, 58, 30], [0, 68, 31]),
  { kind: "pad", from: [0, 50, -15], to: [0, 50, -3], wide: 8, thick: 3.4 },
  { kind: "handle", wide: 22 },
];

const FAN_CRANK: Vec = [0, 20, 4];
const FAN_BIKE: Gear[] = [
  // The fan, its hub, and the frame that carries the saddle.
  ring([0, 22, 34], 19),
  { kind: "plate", at: [0, 22, 34], along: [1, 0, 0], radius: 6, thick: 3, place: "back" },
  rail([0, 1.5, -30], [0, 1.5, 52]),
  rail([0, 1.5, -12], [0, 52, -11]),
  rail(FAN_CRANK, [0, 22, 34]),
  { kind: "pad", from: [0, 53, -17], to: [0, 53, -4], wide: 9, thick: 3.4 },
  // The arms of the machine, one to each hand.
  { kind: "rail", points: [[0, 24, 22], "handR"] },
  { kind: "rail", points: [[0, 24, 22], "handL"] },
];

// ── Machines one stands or sits on ──────────────────────────────────────────────────────────

/** How high the middle of a treadmill's deck is at `z`: it slopes up the way the figure faces. */
const DECK = { from: [0, 4, -36] as Vec, to: [0, 15, 40] as Vec };
const onDeck = (z: number, x: number): Vec => [
  x,
  DECK.from[1] +
    ((DECK.to[1] - DECK.from[1]) * (z - DECK.from[2])) / (DECK.to[2] - DECK.from[2]) +
    6.4,
  z,
];
const TREADMILL: Gear[] = [
  { kind: "pad", from: DECK.from, to: DECK.to, wide: 24 },
  post([0, 13, 36]),
  rail([0, 15, 40], [0, 76, 48], [0, 72, 36]),
];

const ROWER: Gear[] = [
  // The beam the seat runs on, the flywheel, and the board the feet push against.
  rail([0, 11, -30], [0, 11, 58]),
  post([0, 11, -28]),
  ring([0, 16, 70], 13),
  rail([0, 11, 58], [0, 16, 70]),
  { kind: "pad", from: [0, 13, 42], to: [0, 29, 46], wide: 16, thick: 3 },
  { kind: "cable", from: [0, 26, 66] },
  { kind: "handle", wide: 26 },
];

const STAIRS: Gear[] = [
  { kind: "box", at: [0, 0, 12], wide: 30, deep: 14, high: 10, place: "back" },
  { kind: "box", at: [0, 0, 26], wide: 30, deep: 14, high: 20, place: "back" },
  { kind: "box", at: [0, 0, 40], wide: 30, deep: 14, high: 30, place: "back" },
  rail([0, 30, 46], [0, 72, 44], [0, 68, 30]),
];

const ELLIPTICAL: Gear[] = [
  ring([0, 18, -40], 14),
  rail([0, 1.5, -48], [0, 1.5, 50]),
  rail([0, 1.5, 46], [0, 100, 42]),
  // The bars the pedals ride on, from the flywheel to each foot, and the levers to the hands.
  { kind: "rail", points: [[0, 18, -40], "ankleR"] },
  { kind: "rail", points: [[0, 18, -40], "ankleL"] },
  { kind: "rail", points: [[0, 30, 44], "handR"] },
  { kind: "rail", points: [[0, 30, 44], "handL"] },
];

const SKIERG: Gear[] = [
  rail([0, 0.6, 42], [0, 128, 42], [0, 128, 32]),
  { kind: "box", at: [0, 0, 40], wide: 22, deep: 16, high: 5, place: "back" },
  { kind: "cable", from: [0, 127, 32], each: true },
];

/** A skipping rope: from hand to hand, round under the feet. */
const SKIPPING_ROPE: Gear = {
  kind: "rail",
  points: [
    "handR",
    ...[20, 40, 60, 80, 100, 120, 140, 160].map((turn): Vec => {
      const a = (turn * Math.PI) / 180;
      return [Math.cos(a) * 25, 46 - Math.sin(a) * 44.4, 0];
    }),
    "handL",
  ],
};

// ── Stretches ───────────────────────────────────────────────────────────────────────────────

/** On all fours: knees on the floor under the hips, the trunk tipped `pitch`, hands down. */
const allFours = (pitch: number, nod: number): Pose => ({
  pin: { what: "knees", to: [0, 4, 0] },
  pitch,
  nod,
  legs: { flex: pitch, bend: 90 },
  ...hands([13, 3.7, 40], [0.2, -0.2, -1]),
});

const family: Family = {
  "kettlebell-swing": {
    view: SIDE,
    gear: [{ kind: "kettlebell" }],
    keys: [
      { lean: 58, legs: { flex: 58, bend: 42 }, arms: { flex: 22, abduct: -18, bend: 4 } },
      { lean: -3, legs: { flex: 0, bend: 0 }, arms: { flex: 88, abduct: -18, bend: 4 } },
    ],
  },
  "kettlebell-romanian-deadlift": {
    view: SIDE,
    gear: [{ kind: "kettlebell" }],
    keys: [
      { lean: 2, arms: { flex: 6, abduct: -14, bend: 4 } },
      { lean: 66, legs: { flex: 18, bend: 24 }, arms: { flex: 68, abduct: -14, bend: 4 } },
    ],
  },
  "plate-front-raise": {
    view: QUARTER,
    gear: [{ kind: "plate" }],
    keys: [
      { arms: { flex: 12, abduct: -10, bend: 8 } },
      { arms: { flex: 92, abduct: -10, bend: 8 } },
    ],
  },

  // ── Cardio ──
  running: {
    view: SIDE,
    keys: stride(
      14,
      { flex: 62, bend: 78 },
      { flex: -28, bend: 18 },
      { flex: 48, bend: 90 },
      { flex: -42, bend: 85 },
    ),
  },
  walking: {
    view: SIDE,
    keys: stride(
      3,
      { flex: 24, bend: 6 },
      { flex: -18, bend: 14 },
      { flex: 24, bend: 16 },
      { flex: -20, bend: 10 },
    ),
  },
  hiking: {
    view: SIDE,
    gear: [
      // A pole in each hand, planted ahead.
      { kind: "cable", from: "handL", to: [-15, 0.6, 30] },
      { kind: "cable", from: "handR", to: [15, 0.6, 30], place: "front" },
    ],
    keys: stride(
      11,
      { flex: 46, bend: 54 },
      { flex: -20, bend: 12 },
      { flex: 44, bend: 62 },
      { flex: 4, bend: 76 },
    ),
  },
  "treadmill-incline-walk": {
    view: SIDE,
    gear: TREADMILL,
    keys: [
      {
        at: [0, 56, 1],
        lean: 9,
        legR: { plant: onDeck(14, 4.25) },
        legL: { plant: onDeck(-14, -4.25) },
        armL: { flex: 26, bend: 30 },
        armR: { flex: -20, bend: 24 },
      },
      {
        at: [0, 56, 1],
        lean: 9,
        legL: { plant: onDeck(14, -4.25) },
        legR: { plant: onDeck(-14, 4.25) },
        armR: { flex: 26, bend: 30 },
        armL: { flex: -20, bend: 24 },
      },
    ],
  },
  cycling: {
    view: SIDE,
    gear: BIKE,
    keys: pedalling(BIKE_CRANK, () => ({
      at: [0, 56, -8],
      lean: 42,
      nod: -18,
      ...hands([9, 68, 31], [0.5, -0.8, -0.3]),
    })),
  },
  "assault-bike": {
    view: SIDE,
    gear: FAN_BIKE,
    keys: pedalling(FAN_CRANK, (k) => ({
      at: [0, 59, -10],
      lean: 16,
      armR: { reach: [12, 80 - k * 2, 30 - k * 9], elbow: [0.5, -0.8, -0.4] },
      armL: { reach: [-12, 76 + k * 2, 12 + k * 9], elbow: [0.5, -0.8, -0.4] },
    })),
  },
  rowing: {
    view: PROFILE,
    gear: ROWER,
    keys: [
      {
        at: [0, 17.5, 18],
        lean: 24,
        legs: { plant: [6, 22, 38], knee: [0.1, 1, 0.3] },
        legL: { plant: [-6, 22, 38] },
        ...hands([9, 34, 60], [0.3, -0.5, -0.8]),
      },
      {
        at: [0, 17.5, -7],
        lean: -20,
        legs: { plant: [6, 22, 38], knee: [0.1, 1, 0.3] },
        legL: { plant: [-6, 22, 38] },
        ...hands([11, 33, 2], [0.8, -0.2, -0.8]),
      },
    ],
  },
  "stair-climber": {
    view: SIDE,
    gear: STAIRS,
    keys: [
      {
        at: [0, 58, 14],
        lean: 10,
        legR: { plant: [5, 24, 26] },
        legL: { plant: [-5, 14, 12] },
        ...hands([13, 68, 32], [0.3, -0.8, -0.5]),
      },
      {
        at: [0, 58, 14],
        lean: 10,
        legL: { plant: [-5, 24, 26] },
        legR: { plant: [5, 14, 12] },
        ...hands([13, 68, 32], [0.3, -0.8, -0.5]),
      },
    ],
  },
  elliptical: {
    view: SIDE,
    gear: ELLIPTICAL,
    keys: [
      {
        at: [0, 54, 0],
        lean: 6,
        legR: { plant: [6, 12, 16] },
        legL: { plant: [-6, 15, -14] },
        armR: { reach: [12, 80, 23], elbow: [0.4, -0.8, -0.5] },
        armL: { reach: [-12, 84, 35], elbow: [0.4, -0.8, -0.5] },
      },
      {
        at: [0, 54, 0],
        lean: 6,
        legL: { plant: [-6, 12, 16] },
        legR: { plant: [6, 15, -14] },
        armL: { reach: [-12, 80, 23], elbow: [0.4, -0.8, -0.5] },
        armR: { reach: [12, 84, 35], elbow: [0.4, -0.8, -0.5] },
      },
    ],
  },
  skierg: {
    view: SIDE,
    gear: SKIERG,
    keys: [
      { lean: 2, ...hands([9, 110, 23], [0.4, -0.3, 0.8]) },
      { lean: 44, legs: { flex: 42, bend: 52 }, ...hands([9, 44, 6], [0.4, -0.3, -0.8]) },
    ],
  },
  swimming: {
    view: PROFILE,
    gear: [rail([0, 43.5, -64], [0, 43.5, 66])],
    // Front crawl: one arm pulls down through the water while the other comes over the top.
    keys: [
      {
        at: [0, 40, 0],
        pitch: 86,
        nod: -24,
        legR: { flex: 10, bend: 8 },
        legL: { flex: -8, bend: 6 },
        armR: { flex: 172, bend: 6 },
        armL: { flex: 12, bend: 8 },
      },
      {
        at: [0, 40, 0],
        pitch: 86,
        nod: -24,
        legL: { flex: 10, bend: 8 },
        legR: { flex: -8, bend: 6 },
        armR: { flex: 12, bend: 8 },
        armL: { flex: -188, bend: 6 },
      },
    ],
  },
  "jump-rope": {
    view: FRONT,
    gear: [SKIPPING_ROPE],
    keys: [
      { at: [0, 50, 0], arms: { grip: [24, -30, 4], elbow: [0.4, -0.2, -1] } },
      {
        at: [0, 60, 0],
        legs: { flex: 8, bend: 16 },
        arms: { grip: [24, -30, 4], elbow: [0.4, -0.2, -1] },
      },
    ],
  },
  "battle-ropes": {
    view: SIDE,
    gear: [
      { kind: "rope", from: "handL", via: [-6, 4, 44], to: [-4, 1.5, 86] },
      { kind: "rope", from: "handR", via: [6, 40, 46], to: [4, 1.5, 86], place: "front" },
    ],
    keys: [
      {
        lean: 28,
        legs: { flex: 52, bend: 72 },
        armR: { flex: 78, bend: 24 },
        armL: { flex: 30, bend: 34 },
      },
      {
        lean: 28,
        legs: { flex: 52, bend: 72 },
        armL: { flex: 78, bend: 24 },
        armR: { flex: 30, bend: 34 },
      },
    ],
  },

  // ── Stretches ──
  "cat-cow-stretch": {
    view: PROFILE,
    keys: [allFours(84, -34), allFours(76, 42)],
  },
  "childs-pose": {
    view: PROFILE,
    keys: [
      {
        pin: { what: "knees", to: [0, 4, 0] },
        lean: 93,
        nod: -8,
        legs: { flex: 66, bend: 156 },
        ...hands([9, 3.7, 38], [0.6, 0.4, 0.2]),
      },
      {
        pin: { what: "knees", to: [0, 4, 0] },
        lean: 97,
        nod: -4,
        legs: { flex: 68, bend: 158 },
        ...hands([9, 3.7, 41], [0.6, 0.4, 0.2]),
      },
    ],
  },
  "kneeling-hip-flexor-stretch": {
    view: SIDE,
    keys: [
      {
        pin: { what: "kneeR", to: [4.25, 4, 0] },
        lean: -2,
        legR: { flex: -16, bend: 74 },
        legL: { plant: [-4.25, 4, 34] },
        arms: ON_HIPS,
      },
      {
        pin: { what: "kneeR", to: [4.25, 4, 0] },
        lean: -6,
        legR: { flex: -32, bend: 58 },
        legL: { plant: [-4.25, 4, 34] },
        arms: ON_HIPS,
      },
    ],
  },
  "hamstring-stretch": {
    view: SIDE,
    keys: [
      {
        lean: 48,
        legR: { flex: 26, bend: 0 },
        legL: { flex: -4, bend: 26 },
        arms: { flex: 74, bend: 6 },
      },
      {
        lean: 62,
        legR: { flex: 28, bend: 0 },
        legL: { flex: -4, bend: 34 },
        arms: { flex: 84, bend: 6 },
      },
    ],
  },
  "standing-quad-stretch": {
    view: SIDE,
    keys: [
      {
        pin: { what: "ankleL", to: [-4.25, 4, 0] },
        legR: { flex: -8, bend: 138 },
        armR: { reach: [7, 47, -15], elbow: [0.5, 0.2, -1] },
        armL: { grip: [26, -6, 8] },
      },
      {
        pin: { what: "ankleL", to: [-4.25, 4, 0] },
        legR: { flex: -18, bend: 144 },
        armR: { reach: [7, 50, -21], elbow: [0.5, 0.2, -1] },
        armL: { grip: [26, -6, 8] },
      },
    ],
  },
  "seated-forward-fold-stretch": {
    view: PROFILE,
    keys: [
      {
        at: [0, REST, 0],
        lean: 34,
        nod: 8,
        legs: { flex: 90, bend: 0 },
        ...hands([7, 11, 34], [1, -0.1, -0.2]),
      },
      {
        at: [0, REST, 0],
        lean: 56,
        nod: 16,
        legs: { flex: 90, bend: 0 },
        ...hands([7, 11, 45], [1, -0.1, -0.2]),
      },
    ],
  },
  "butterfly-stretch": {
    view: { yaw: 24, tilt: 14 },
    keys: [
      {
        at: [0, REST, 0],
        lean: 6,
        legs: { plant: [3.5, 4, 25], knee: [1, 0.42, 0.3] },
        legL: { plant: [-3.5, 4, 25] },
        ...hands([5, 10, 23], [1, -0.3, -0.2]),
      },
      {
        at: [0, REST, 0],
        lean: 20,
        nod: 8,
        legs: { plant: [3.5, 4, 25], knee: [1, 0.12, 0.3] },
        legL: { plant: [-3.5, 4, 25] },
        ...hands([5, 10, 23], [1, -0.3, -0.2]),
      },
    ],
  },
  "cross-body-shoulder-stretch": {
    view: FRONT,
    keys: [
      {
        armR: { grip: [-21, -5, 9], elbow: [-0.2, -0.3, 1] },
        armL: { grip: [-1, -7, 13], elbow: [0.4, -1, 0.3] },
      },
      {
        armR: { grip: [-26, -4, 7], elbow: [-0.2, -0.3, 1] },
        armL: { grip: [-4, -6, 11], elbow: [0.4, -1, 0.3] },
      },
    ],
  },
  "arm-circles": {
    view: FRONT,
    keys: [
      { arms: { abduct: 76, flex: 14, bend: 4 } },
      { arms: { abduct: 90, flex: -4, bend: 4 } },
      { arms: { abduct: 106, flex: 14, bend: 4 } },
    ],
  },
  "torso-twist-stretch": {
    view: { yaw: 0 },
    keys: [
      {
        twist: -42,
        legs: { abduct: 9 },
        arms: { grip: [11, -5, 11], elbow: [1, 0, 0.1] },
      },
      {
        twist: 42,
        legs: { abduct: 9 },
        arms: { grip: [11, -5, 11], elbow: [1, 0, 0.1] },
      },
    ],
  },
  "leg-swings-stretch": {
    view: SIDE,
    gear: [rail([-22, 0.6, 6], [-22, 60, 6])],
    keys: [
      {
        pin: { what: "ankleL", to: [-4.25, 4, 0] },
        legR: { flex: 52, bend: 6 },
        armL: { reach: [-22, 60, 6] },
        armR: { flex: -24, abduct: 12, bend: 10 },
      },
      {
        pin: { what: "ankleL", to: [-4.25, 4, 0] },
        legR: { flex: -34, bend: 14 },
        armL: { reach: [-22, 60, 6] },
        armR: { flex: 26, abduct: 12, bend: 10 },
      },
    ],
  },
  "worlds-greatest-stretch": {
    view: { yaw: 60 },
    keys: [
      {
        at: [0, 31, 0],
        lean: 58,
        nod: -10,
        legR: { plant: [6, 4, 27] },
        legL: { plant: [-5, 4, -38], knee: [0, -0.4, 1] },
        armL: { reach: [-8, 3.7, 24] },
        armR: { reach: [17, 3.7, 26], elbow: [1, 0.2, -0.4] },
      },
      {
        at: [0, 31, 0],
        lean: 58,
        twist: 62,
        nod: -10,
        legR: { plant: [6, 4, 27] },
        legL: { plant: [-5, 4, -38], knee: [0, -0.4, 1] },
        armL: { reach: [-8, 3.7, 24] },
        armR: { reach: [22, 84, 6], elbow: [1, 0.2, -0.4] },
      },
    ],
  },
  "wall-calf-stretch": {
    view: SIDE,
    gear: [rail([0, 0.6, 37], [0, 112, 37])],
    keys: [
      {
        at: [0, 44, -8],
        lean: 20,
        legR: { plant: [4.25, 4, -30] },
        legL: { plant: [-4.25, 4, 5] },
        ...hands([12, 76, 33.3], [0.5, -0.8, -0.2]),
      },
      {
        at: [0, 42, -4.5],
        lean: 24,
        legR: { plant: [4.25, 4, -30] },
        legL: { plant: [-4.25, 4, 5] },
        ...hands([12, 76, 33.3], [0.5, -0.8, -0.2]),
      },
    ],
  },
  "doorway-chest-stretch": {
    view: { yaw: 30 },
    gear: [{ kind: "bar", high: 118, wide: 60 }],
    keys: [
      {
        at: [0, 49, 3],
        lean: 3,
        legR: { plant: [4.25, 4, 10] },
        legL: { plant: [-4.25, 4, -8] },
        ...hands([30, 96, 0], [1, -0.1, -0.3]),
      },
      {
        at: [0, 48.5, 9],
        lean: 8,
        legR: { plant: [4.25, 4, 16] },
        legL: { plant: [-4.25, 4, -8] },
        ...hands([30, 96, 0], [1, -0.1, -0.5]),
      },
    ],
  },
};

export default family;
