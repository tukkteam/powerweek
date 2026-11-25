/** Pressing with the body: push-ups, dips, planks and their kin, on the floor or a wall. */
import {
  PROFILE,
  QUARTER,
  SIDE,
  dipBars,
  feet,
  hands,
  wall,
  type Family,
  type Gear,
  type Pose,
  type Vec,
  type View,
} from "./kit";

// ── Push-ups ────────────────────────────────────────────────────────────────────────────────

/** Where the feet of a body propped on the floor are: its ankles, toes down. */
const TOES: Vec = [0, 4, -50];
/** A hand flat on the floor is this high. */
const FLOOR = 3.7;
/** Where the hands of a push-up go. */
const PALMS: Vec = [14, FLOOR, 20];
/** Elbows back along the body, and out to the sides. */
const TUCKED: Vec = [0.6, -0.2, -0.8];
const FLARED: Vec = [1, -0.1, -0.3];
/** How far a push-up tips: arms straight, and chest to the floor. */
const UP = 66;
const DOWN = 82;

/**
 * A body in one line from its ankles, tipped `pitch` forward from upright, its hands on a
 * point. Every push-up is this, with the hands or the feet somewhere else.
 */
const propped = (
  pitch: number,
  palms: Vec = PALMS,
  elbow: Vec = TUCKED,
  more: Pose = {},
): Pose => ({
  pitch,
  pin: { what: "ankles", to: TOES },
  ...hands(palms, elbow),
  ...more,
});

/** More from the head end, for what differs from a push-up only in where the hands are. */
const HEAD_ON = QUARTER;

/**
 * A weighted vest. Gear is fixed to a joint, with nothing to put a plate out on the back by,
 * so the weight is worn: a pad round the trunk, under the arm on the near side.
 */
const VEST: Gear = {
  kind: "pad",
  from: "chest",
  to: "pelvis",
  wide: 19,
  thick: 10.5,
  place: "among",
};

/** A bench across the way the figure faces, its middle at `z`: for hands or feet. */
const across = (z: number): Gear => ({ kind: "bench", from: [-24, 0, z], to: [24, 0, z] });
/** How high a hand on a bench is, and an ankle with its toes on one. */
const ON_BENCH = 27 + FLOOR;
const TOES_ON_BENCH: Vec = [0, 31, -50];

// ── Dips ────────────────────────────────────────────────────────────────────────────────────

const BARS = 56;
/** On the bars of a dip station: hips at `high`, the torso leaning `lean`. */
const onBars = (high: number, lean: number, wide = 15, reach = 3): Pose => ({
  at: [0, high, 0],
  lean,
  legs: { flex: 12, bend: 84 },
  ...hands([wide, BARS, reach], [0.3, -0.2, -1]),
});
/** A plate hanging from a belt, between the legs. */
const HUNG = { on: "hips", by: [0, -17, 2] } as const;
const BELT: Gear[] = [
  { kind: "cable", from: "hips", to: HUNG },
  { kind: "plate", at: HUNG, along: [1, 0, 0], radius: 8.5, place: "among" },
];

/** Hands on the edge of something behind the body, hips at `high` in front of it. */
const behind = (high: number, legs: Pick<Pose, "legs" | "legL">, x = 13): Pose => ({
  at: [0, high, 3],
  ...legs,
  ...hands([x, ON_BENCH, -7], [0.2, 0.2, -1]),
});
const HEELS: Pick<Pose, "legs" | "legL"> = {
  legs: { plant: [5, 4, 38] },
  legL: { plant: [-5, 4, 38] },
};

// ── Handstands ──────────────────────────────────────────────────────────────────────────────

/** Upside down on the hands, hips at `high`, tipped `pitch` (180 is plumb). */
const inverted = (high: number, pitch = 180, z = 0): Pose => ({
  at: [0, high, z],
  pitch,
  ...hands([15, FLOOR, z - 1], [1, 0.1, 0.5]),
});

// ── Planks ──────────────────────────────────────────────────────────────────────────────────

/** A plank on the forearms. */
const onForearms = (pitch: number, more: Pose = {}): Pose =>
  propped(pitch, [13, FLOOR, 40], [0.1, -0.3, 1], more);

/**
 * A plank on one side, seen from in front of the body: the legs lean `legs` from upright
 * towards the figure's left and the torso `torso`, and the left forearm is on the floor. The
 * feet are put where that leaves the left shoulder over its elbow.
 */
function onSide(legs: number, torso = legs, more: Pose = {}, high = 8): Pose {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const reach =
    45.83 * Math.sin(rad(legs)) + 29.17 * Math.sin(rad(torso)) + 13 * Math.cos(rad(torso));
  return {
    roll: legs,
    side: torso - legs,
    pin: { what: "ankles", to: [reach - 45, high, 0] },
    armL: { reach: [-45, FLOOR, 16.5], elbow: [1, -0.35, 0] },
    armR: { grip: [10, -26, 3], elbow: [1, 0, -0.4] },
    ...more,
  };
}
/** Face on, a little from the head end: a body on its side is one long line across. */
const FACING: View = { yaw: 12 };

/** On hands and toes with the knees bent under the hips, just off the floor. */
const bear = (hand: number, handL: number, foot: number, footL: number): Pose => ({
  at: [0, 33, -12],
  pitch: 84,
  arms: { reach: [13, FLOOR, 17 + hand], elbow: [0.3, -0.2, -1] },
  armL: { reach: [-13, FLOOR, 17 + handL] },
  legs: { plant: [5, 5.5, -34 + foot], knee: [0.1, 0.1, 1] },
  legL: { plant: [-5, 5.5, -34 + footL] },
});

/** Sitting up on hands and feet, chest to the ceiling. */
const crab = (hand: number, handL: number, foot: number, footL: number): Pose => ({
  at: [0, 22, 0],
  pitch: -63,
  nod: 20,
  arms: { reach: [14, FLOOR, -31 + hand], elbow: [0.3, 0.2, -1] },
  armL: { reach: [-14, FLOOR, -31 + handL] },
  legs: { plant: [8, 4, 25 + foot] },
  legL: { plant: [-8, 4, 25 + footL] },
});

const family: Family = {
  "push-up": {
    view: PROFILE,
    keys: [propped(UP), propped(DOWN)],
  },
  "weighted-push-up": {
    view: PROFILE,
    gear: [VEST],
    keys: [propped(UP), propped(DOWN)],
  },
  "knee-push-up": {
    view: PROFILE,
    keys: [
      {
        pitch: 54,
        pin: { what: "knees", to: [0, 4, -22] },
        legs: { bend: 62 },
        ...hands([14, FLOOR, 25], TUCKED),
      },
      {
        pitch: 77,
        pin: { what: "knees", to: [0, 4, -22] },
        legs: { bend: 62 },
        ...hands([14, FLOOR, 25], TUCKED),
      },
    ],
  },
  "incline-push-up": {
    view: PROFILE,
    gear: [across(19)],
    keys: [propped(44, [14, ON_BENCH, 15]), propped(60, [14, ON_BENCH, 15])],
  },
  "decline-push-up": {
    view: PROFILE,
    gear: [across(-51)],
    keys: [
      { ...propped(87, [14, FLOOR, 26]), pin: { what: "ankles", to: TOES_ON_BENCH } },
      { ...propped(102, [14, FLOOR, 26]), pin: { what: "ankles", to: TOES_ON_BENCH } },
    ],
  },
  "wide-push-up": {
    view: HEAD_ON,
    keys: [propped(68, [27, FLOOR, 20], FLARED), propped(DOWN, [27, FLOOR, 20], FLARED)],
  },
  "diamond-push-up": {
    view: HEAD_ON,
    keys: [propped(UP, [3.6, FLOOR, 22], TUCKED), propped(DOWN, [3.6, FLOOR, 22], TUCKED)],
  },
  "archer-push-up": {
    view: HEAD_ON,
    keys: [
      propped(69, [29, FLOOR, 20], [1, 0, -0.4]),
      propped(81, [29, FLOOR, 20], [1, 0, -0.4], { face: 11 }),
    ],
  },
  "typewriter-push-up": {
    view: HEAD_ON,
    keys: [
      propped(81, [29, FLOOR, 20], [1, 0, -0.4], { face: -11 }),
      propped(81, [29, FLOOR, 20], [1, 0, -0.4], { face: 11 }),
    ],
  },
  "explosive-push-up": {
    view: PROFILE,
    keys: [propped(DOWN), propped(UP), propped(57, [14, 17, 21])],
  },
  "scapular-push-up": {
    view: PROFILE,
    keys: [propped(65.4), propped(68.6)],
  },
  "push-up-shoulder-tap": {
    view: { yaw: 60 },
    keys: [
      propped(DOWN, PALMS, TUCKED, { armR: { reach: [14, FLOOR, 20] } }),
      propped(UP, PALMS, TUCKED, { armR: { reach: [14, FLOOR, 20] } }),
      propped(UP, PALMS, TUCKED, { armR: { reach: [-7, 29, 21], elbow: [1, -0.6, 0.2] } }),
    ],
  },
  "hindu-push-up": {
    view: PROFILE,
    keys: [
      propped(28, [14, FLOOR, 14], TUCKED, { lean: 105 }),
      propped(84, [14, FLOOR, 14], TUCKED, { lean: 0 }),
      propped(87, [14, FLOOR, 14], TUCKED, { lean: -62, nod: -14 }),
    ],
  },
  "pike-push-up": {
    view: PROFILE,
    keys: [
      {
        ...propped(27, [14, FLOOR, 33], FLARED, { lean: 104, nod: 0 }),
        pin: { what: "ankles", to: [0, 4, -30] },
      },
      {
        ...propped(35, [14, FLOOR, 33], FLARED, { lean: 111, nod: -14 }),
        pin: { what: "ankles", to: [0, 4, -30] },
      },
    ],
  },
  "feet-elevated-pike-push-up": {
    view: PROFILE,
    gear: [across(-41)],
    keys: [
      {
        ...propped(42, [14, FLOOR, -1], FLARED, { lean: 128 }),
        pin: { what: "ankles", to: [0, 31, -40] },
      },
      {
        ...propped(62, [14, FLOOR, -1], FLARED, { lean: 114 }),
        pin: { what: "ankles", to: [0, 31, -40] },
      },
    ],
  },
  "handstand-push-up": {
    view: QUARTER,
    keys: [inverted(66), inverted(49)],
  },
  "wall-handstand-push-up": {
    view: SIDE,
    // Its back to the wall, heels on it.
    gear: [wall(8.6)],
    keys: [inverted(65.5, 184), inverted(48.5, 184)],
  },
  "wall-push-up": {
    view: SIDE,
    gear: [wall(51)],
    keys: [
      { ...propped(12, [14, 74, 47.3]), pin: { what: "ankles", to: [0, 4, 0] } },
      { ...propped(27, [14, 74, 47.3]), pin: { what: "ankles", to: [0, 4, 0] } },
    ],
  },
  "wall-walk": {
    view: SIDE,
    gear: [wall(-56, 122)],
    keys: [
      { ...propped(UP, [14, FLOOR, 19]), pin: { what: "ankles", to: [0, 4, -51.5] } },
      {
        ...propped(75, [14, FLOOR, 4], TUCKED, { lean: 88 }),
        pin: { what: "ankles", to: [0, 46, -51.5] },
      },
      { ...propped(172, [14, FLOOR, -37]), pin: { what: "ankles", to: [0, 111, -51.5] } },
    ],
  },
  dip: {
    view: SIDE,
    gear: dipBars(BARS),
    keys: [onBars(59.5, 8), onBars(38, 18)],
  },
  "weighted-dip": {
    view: SIDE,
    gear: [...dipBars(BARS), ...BELT],
    keys: [onBars(59.5, 8), onBars(38, 18)],
  },
  "chest-dip": {
    view: SIDE,
    gear: dipBars(BARS, 19),
    keys: [onBars(61, 22, 19, 8), onBars(41, 38, 19, 8)],
  },
  "bench-dip": {
    view: SIDE,
    gear: [across(-12)],
    keys: [behind(31, HEELS), behind(13, HEELS)],
  },
  "chair-dip": {
    view: SIDE,
    gear: [
      { kind: "bench", from: [0, 0, -25], to: [0, 0, -4], wide: 30 },
      { kind: "pad", from: [0, 29, -25.5], to: [0, 58, -28], wide: 30, thick: 3 },
    ],
    keys: [behind(31, feet(27, 6), 12), behind(13, feet(27, 6), 12)],
  },
  plank: {
    view: PROFILE,
    keys: [onForearms(76.4), onForearms(77.4)],
  },
  "plank-jack": {
    // From behind, where the legs are.
    view: { yaw: 138 },
    keys: [
      propped(UP, PALMS, TUCKED, { legs: { abduct: 2 } }),
      propped(UP, PALMS, TUCKED, { legs: { abduct: 24 } }),
    ],
  },
  "plank-shoulder-tap": {
    view: { yaw: 60 },
    keys: [
      propped(UP, PALMS, TUCKED, { legs: { abduct: 9 }, armR: { reach: [14, FLOOR, 20] } }),
      propped(UP, PALMS, TUCKED, {
        legs: { abduct: 9 },
        armR: { reach: [-7, 29, 21], elbow: [1, -0.6, 0.2] },
      }),
    ],
  },
  "mountain-climber": {
    view: PROFILE,
    keys: [
      {
        at: [0, 24, -8],
        pitch: 64,
        ...hands(PALMS, TUCKED),
        legR: { flex: 100, bend: 124 },
        legL: { flex: 0, bend: 0 },
      },
      {
        at: [0, 31, -10],
        pitch: 57,
        ...hands(PALMS, TUCKED),
        legR: { flex: 52, bend: 92 },
        legL: { flex: 52, bend: 92 },
      },
      {
        at: [0, 24, -8],
        pitch: 64,
        ...hands(PALMS, TUCKED),
        legR: { flex: 0, bend: 0 },
        legL: { flex: 100, bend: 124 },
      },
    ],
  },
  "bear-plank": {
    view: PROFILE,
    keys: [bear(0, 0, 0, 0), { ...bear(0, 0, 0, 0), at: [0, 34, -12] }],
  },
  "bear-crawl": {
    view: PROFILE,
    keys: [bear(8, -6, -6, 8), bear(-6, 8, 8, -6)],
  },
  "crab-walk": {
    view: PROFILE,
    keys: [crab(7, -6, -6, 7), crab(-6, 7, 7, -6)],
  },
  inchworm: {
    view: PROFILE,
    keys: [
      propped(-6, [14, FLOOR, -22], TUCKED, { lean: 146 }),
      propped(28, [14, FLOOR, 14], TUCKED, { lean: 105 }),
      propped(UP),
    ],
  },
  "side-plank": {
    view: FACING,
    keys: [onSide(71), onSide(70, 72)],
  },
  "side-plank-hip-dip": {
    view: FACING,
    keys: [onSide(80, 58), onSide(62, 82.5)],
  },
  "copenhagen-plank": {
    view: FACING,
    gear: [{ kind: "bench", from: [30, 0, -18], to: [30, 0, 18] }],
    keys: [
      onSide(85, 85, { legL: { flex: 62, bend: 74 } }, 26.8),
      onSide(86, 84, { legL: { flex: 62, bend: 74 } }, 26.4),
    ],
  },
  "ab-wheel": {
    view: PROFILE,
    gear: [
      { kind: "handle", wide: 30 },
      { kind: "plate", along: [1, 0, 0], radius: 6, thick: 3.4 },
    ],
    keys: [
      {
        pitch: 10,
        lean: 60,
        pin: { what: "knees", to: [0, 4, -20] },
        legs: { bend: 80 },
        ...hands([11, 6, 21], [0.3, -0.3, -1]),
      },
      {
        pitch: 62,
        lean: 18,
        pin: { what: "knees", to: [0, 4, -20] },
        legs: { bend: 28 },
        ...hands([11, 6, 58], [0.3, -0.3, -1]),
      },
    ],
  },
};

export default family;
