/** Floor work for the trunk and the hips: lying, sitting, on all fours. */
import { BODY } from "../rig";
import {
  PROFILE,
  QUARTER,
  REST,
  backrest,
  feet,
  hands,
  post,
  type Family,
  type Gear,
  type Pose,
  type Vec,
} from "./kit";

const deg = (radians: number) => (radians * 180) / Math.PI;
const mirrored = ([x, y, z]: Vec): Vec => [-x, y, z];

// ── Lying on the back ───────────────────────────────────────────────────────────────────────

/** How far the hips are tipped up off the floor when they are `high`, the shoulders staying down. */
const tipped = (high: number) => deg(Math.asin((high - REST) / BODY.spine));

/**
 * Lying on the back with the hips raised to `high` (`REST` is flat on the floor). The shoulders
 * stay where they are, the head stays down and the arms lie by the sides.
 */
function bridge(high: number = REST): Pose {
  const tip = tipped(high);
  return {
    at: [0, high, BODY.spine * (Math.cos((tip * Math.PI) / 180) - 1)],
    pitch: -90 - tip,
    nod: 16 + tip,
    arms: { flex: -tip, abduct: 7 },
  };
}

/**
 * The angles that put a foot on the floor `ahead` for a body bridged to `high`: a leg that
 * takes turns with the other is posed by its angles in every key, standing or lifted.
 */
function standing(high: number, ahead: number): NonNullable<Pose["legs"]> {
  const { at } = bridge(high) as { at: Vec };
  const [dy, dz] = [BODY.leg - at[1], ahead - at[2]];
  const half = Math.acos(Math.min(1, Math.hypot(dy, dz) / 2 / BODY.thigh));
  return { flex: deg(Math.atan2(dy, dz) + half) - tipped(high), bend: deg(2 * half) };
}
/** A leg lifted to `up` above the floor (90 is straight up), whatever the hips are doing. */
const lifted = (high: number, up: number, bend = 0): NonNullable<Pose["legs"]> => ({
  flex: up - tipped(high),
  bend,
});

/** Flat on the back, nothing else said: the limbs are posed one by one. */
const ON_BACK: Pose = { at: [0, REST, 0], pitch: -90, nod: 16 };
/** A dead bug's limbs: held over the body, and reached out just off the floor. */
const TABLE_ARM = { flex: 90 };
const TABLE_LEG = { flex: 90, bend: 90 };
const REACHED = { flex: 171 };
const REACHED_LEG = { flex: 9, bend: 0 };

/** Where the feet stand for a bridge, and how high the hips go. */
const HEELS = 25;
const BRIDGED = 21;

/** A frog pump's legs: the soles together, the knees fallen out to the sides. */
const FROG: Pick<Pose, "legs" | "legL"> = {
  legs: { plant: [3.5, 4, 21], knee: [1, 0, 0.8] },
  legL: { plant: [-3.5, 4, 21] },
};

/** Hands by the ears, elbows forward: for bringing an elbow to a knee. */
const AT_EARS: Pose["arms"] = { grip: [8, 12.5, 4], elbow: [0.6, 0.1, 1] };
/** Arms crossed on the chest, each hand on the other shoulder: the head stays in view. */
const CROSSED: Pose["arms"] = { grip: [-8, -4, 6.5], elbow: [0.5, -1, 0.6] };
/** Flat on the back, knees up, ready to crunch; and curled up. */
const CRUNCH: Pose = { at: [0, REST, 0], pitch: -90, nod: 16, ...feet(HEELS) };
const CURLED = { lean: 27, nod: 24 };

/** The bench of a decline sit-up, for hips at `DECLINE`, and the roller the feet hook under. */
const DECLINE: Vec = [0, 40, 4];
const declineBench: Gear[] = [
  backrest(DECLINE, -106, 44, 8),
  post([0, 30, 0]),
  post([0, 18, -34]),
  { kind: "plate", at: "ankles", along: [1, 0, 0], radius: 5.6, thick: 16, place: "back" },
  { kind: "rail", points: ["ankles", [0, 32, 20]] },
];

/** A heel tap: knees up, heels close in, shoulders off the floor; a hand reaches each heel in turn. */
const TAP = 9;
const TAPPING: Pose = { at: [0, REST, 0], pitch: -90, lean: 16, nod: 26, ...feet(TAP + 7) };

/** Sitting on the floor leaning back, propped on the hands behind. */
const PROPPED = hands([11, 3.7, -27], [0.3, 0, -1]);

/**
 * A dragon flag: the body one straight line from the shoulders, which stay on the floor, at
 * `pitch` (-180 would stand it on them, -90 lay it flat). The hands hold on behind the head.
 */
const SHOULDERS: Vec = [0, 8, -10];
function flag(pitch: number): Pose {
  const a = (pitch * Math.PI) / 180;
  return {
    at: [0, SHOULDERS[1] - BODY.spine * Math.cos(a), SHOULDERS[2] - BODY.spine * Math.sin(a)],
    pitch,
    // The head stays on the floor, chin to the chest as the body goes up.
    nod: -pitch - 92,
    ...hands([8, 4, SHOULDERS[2] - 27], [0.5, -0.6, 0.6]),
  };
}

/** A stability ball, and the heels on top of it. */
const BALL = 13;
const ON_BALL: Vec = [5, 2 * BALL + BODY.leg, 42];
const onBall: Pick<Pose, "legs" | "legL"> = {
  legs: { plant: ON_BALL },
  legL: { plant: mirrored(ON_BALL) },
};
/** A pose moved `ahead` along the floor. */
const slid = (pose: Pose, ahead: number): Pose => {
  const [x, y, z] = pose.at as Vec;
  return { ...pose, at: [x, y, z + ahead] };
};

// ── On all fours ────────────────────────────────────────────────────────────────────────────

/** Hips over the knees, shoulders over the hands, head up. Head towards +z. */
const HIPS = BODY.leg + BODY.thigh;
const ALL_FOURS: Pose = { at: [0, HIPS, 0], pitch: 76, nod: -32 };
const HAND_R = { reach: [13, 3.7, 41] as Vec };
const HAND_L = { reach: mirrored(HAND_R.reach) };
/** A knee on the floor under its hip: the shin lies back along the floor. */
const KNEE_R = { plant: [BODY.hip, BODY.leg, -BODY.shin] as Vec, knee: [0, 0, 1] as Vec };
const KNEE_L = { ...KNEE_R, plant: mirrored(KNEE_R.plant) };
/** Where the foot of a bent leg is when its thigh has swung `up` behind (0 kneels, 90 is level). */
function kicked(up: number): Vec {
  const a = (up * Math.PI) / 180;
  const knee = [HIPS - BODY.thigh * Math.cos(a), -BODY.thigh * Math.sin(a)] as const;
  return [BODY.hip, knee[0] + BODY.shin * Math.sin(a), knee[1] - BODY.shin * Math.cos(a)];
}
/** An arm reached out ahead and a leg reached out behind, level with the trunk. */
const AHEAD = { reach: [13, 39, 60] as Vec };
const BEHIND = {
  plant: [-BODY.hip, HIPS + 1, -BODY.thigh - BODY.shin + 0.5] as Vec,
  knee: [0, 0, 1] as Vec,
};

// ── On one side ─────────────────────────────────────────────────────────────────────────────

/**
 * Lying on the left side along x, head towards -x, facing the viewer of `ON_SIDE_VIEW`. The
 * trunk is propped up a little, the lower arm stretched out under the head, the upper hand on
 * the hip. The right leg is the upper one.
 */
const ON_SIDE: Pose = {
  at: [0, BODY.trunk + 0.3, 0],
  roll: 90,
  side: -18,
  nod: 0,
  armL: { reach: [-62, 3.7, 5], elbow: [0, 0, 1] },
  armR: { grip: [13.5, -25, 3], elbow: [1, 0, 0.2] },
};
const ON_SIDE_VIEW = { yaw: 22, tilt: 24 };
/** A clamshell's legs: hips and knees bent, the feet together. */
const SHELL_L = { plant: [31, BODY.leg, 0] as Vec, knee: [0, 0, 1] as Vec };
const SHELL_R: Vec = [31, 3 * BODY.leg + 0.5, 0];

/**
 * A hip airplane: standing on the left leg, hinged over level with the right leg out behind
 * and the arms out like wings. The body lies along x; `pitch` then turns it about its own
 * length: 90 faces the floor, less opens the hips away from the standing leg, more closes them
 * over it.
 */
const AIRPLANE: Pose = {
  at: [0, 47, 0],
  roll: 90,
  nod: -28,
  arms: { abduct: 88 },
  legR: {},
  legL: { plant: [0, BODY.leg, -BODY.hip], knee: [0, 1, 0.3] },
};

const family: Family = {
  "glute-bridge": {
    view: PROFILE,
    keys: [
      { ...bridge(), ...feet(HEELS) },
      { ...bridge(BRIDGED), ...feet(HEELS) },
    ],
  },
  "single-leg-glute-bridge": {
    view: PROFILE,
    keys: [
      { ...bridge(), legL: { plant: [-6, 4, HEELS] }, legR: lifted(REST, 44) },
      { ...bridge(BRIDGED), legL: { plant: [-6, 4, HEELS] }, legR: lifted(BRIDGED, 44) },
    ],
  },
  "glute-bridge-march": {
    view: PROFILE,
    keys: [
      {
        ...bridge(BRIDGED),
        legL: standing(BRIDGED, HEELS),
        legR: lifted(BRIDGED, 92, 92),
      },
      {
        ...bridge(BRIDGED),
        legL: standing(BRIDGED, HEELS),
        legR: standing(BRIDGED, HEELS),
      },
      {
        ...bridge(BRIDGED),
        legL: lifted(BRIDGED, 92, 92),
        legR: standing(BRIDGED, HEELS),
      },
    ],
  },
  "frog-pump": {
    // Seen from a little above, so the knees fallen out to the sides show.
    view: { yaw: 58, tilt: 32 },
    keys: [
      { ...bridge(), ...FROG },
      { ...bridge(17), ...FROG },
    ],
  },
  "lying-hamstring-walkout": {
    view: PROFILE,
    keys: [
      { ...bridge(BRIDGED), ...feet(HEELS) },
      {
        ...bridge(16),
        legs: { plant: [9, 4, HEELS + 11] },
        legL: { plant: [-9, 4, HEELS + 3] },
      },
      { ...bridge(11), ...feet(HEELS + 17) },
    ],
  },
  "towel-hamstring-curl": {
    view: PROFILE,
    // The towel slides with the feet.
    gear: [{ kind: "pad", from: "toeL", to: "toeR", wide: 15, thick: 2.2 }],
    keys: [
      { ...bridge(11), ...feet(HEELS + 17) },
      { ...bridge(BRIDGED), ...feet(HEELS) },
    ],
  },
  crunch: {
    view: PROFILE,
    keys: [
      { ...CRUNCH, arms: CROSSED },
      { ...CRUNCH, ...CURLED, arms: CROSSED },
    ],
  },
  "weighted-crunch": {
    view: PROFILE,
    gear: [{ kind: "plate", along: [0, 0.97, 0.24], radius: 10 }],
    keys: [
      { ...CRUNCH, arms: { grip: [6, -7, 7], elbow: [1, -0.3, 0.4] } },
      { ...CRUNCH, ...CURLED, arms: { grip: [6, -7, 7], elbow: [1, -0.3, 0.4] } },
    ],
  },
  "decline-sit-up": {
    view: { yaw: 70 },
    gear: declineBench,
    keys: [
      { at: DECLINE, pitch: -106, nod: 13, legs: { flex: 74, bend: 96 }, arms: CROSSED },
      { at: DECLINE, pitch: -106, lean: 82, legs: { flex: 74, bend: 96 }, arms: CROSSED },
    ],
  },
  "reverse-crunch": {
    view: PROFILE,
    keys: [
      { ...bridge(), legs: lifted(REST, 90, 90) },
      { ...bridge(14), legs: lifted(14, 128, 104) },
    ],
  },
  "lying-leg-raise": {
    view: PROFILE,
    keys: [
      { ...bridge(), legs: { flex: 7 } },
      { ...bridge(), legs: { flex: 90 } },
    ],
  },
  "flutter-kick": {
    view: PROFILE,
    keys: [
      { ...bridge(), nod: 26, legR: { flex: 9 }, legL: { flex: 27 } },
      { ...bridge(), nod: 26, legR: { flex: 27 }, legL: { flex: 9 } },
    ],
  },
  "toe-touch": {
    view: PROFILE,
    keys: [
      { at: [0, REST, 0], pitch: -90, nod: 16, legs: { flex: 90 }, arms: { flex: 90 } },
      { at: [0, REST, 0], pitch: -90, lean: 28, nod: 20, legs: { flex: 90 }, arms: { flex: 80 } },
    ],
  },
  "v-up": {
    view: PROFILE,
    keys: [
      { at: [0, REST, 0], pitch: -90, nod: 16, legs: { flex: 0 }, arms: { flex: 180 } },
      { at: [0, REST, 0], pitch: -90, lean: 60, nod: 6, legs: { flex: 58 }, arms: { flex: 80 } },
    ],
  },
  "hollow-body-hold": {
    view: PROFILE,
    keys: [
      { at: [0, REST, 0], pitch: -90, lean: 16, nod: 6, legs: { flex: 16 }, arms: { flex: 177 } },
      {
        at: [0, REST, 0],
        pitch: -90,
        lean: 17.5,
        nod: 6,
        legs: { flex: 17.5 },
        arms: { flex: 177 },
      },
    ],
  },
  "hollow-rock": {
    view: PROFILE,
    keys: [
      { at: [0, REST, 3], pitch: -79, lean: 18, nod: 6, legs: { flex: 18 }, arms: { flex: 177 } },
      { at: [0, REST, -3], pitch: -101, lean: 18, nod: 6, legs: { flex: 18 }, arms: { flex: 177 } },
    ],
  },
  "dead-bug": {
    view: PROFILE,
    keys: [
      { ...ON_BACK, armR: REACHED, armL: TABLE_ARM, legR: TABLE_LEG, legL: REACHED_LEG },
      { ...ON_BACK, armR: TABLE_ARM, armL: TABLE_ARM, legR: TABLE_LEG, legL: TABLE_LEG },
      { ...ON_BACK, armR: TABLE_ARM, armL: REACHED, legR: REACHED_LEG, legL: TABLE_LEG },
    ],
  },
  "bicycle-crunch": {
    view: PROFILE,
    keys: [
      {
        at: [0, REST, 0],
        pitch: -90,
        ...CURLED,
        twist: -30,
        arms: AT_EARS,
        legL: { flex: 108, bend: 104 },
        legR: { flex: 16, bend: 6 },
      },
      {
        at: [0, REST, 0],
        pitch: -90,
        ...CURLED,
        twist: 30,
        arms: AT_EARS,
        legR: { flex: 108, bend: 104 },
        legL: { flex: 16, bend: 6 },
      },
    ],
  },
  "russian-twist": {
    view: QUARTER,
    keys: [
      {
        at: [0, REST, 0],
        pitch: -38,
        twist: -42,
        legs: { flex: 82, bend: 58 },
        arms: { grip: [2, -12, 22] },
      },
      {
        at: [0, REST, 0],
        pitch: -38,
        twist: 42,
        legs: { flex: 82, bend: 58 },
        arms: { grip: [2, -12, 22] },
      },
    ],
  },
  "heel-tap": {
    view: PROFILE,
    keys: [
      {
        ...TAPPING,
        side: -18,
        armR: { reach: [14, 3.7, TAP], elbow: [1, 0, 0.3] },
        armL: { reach: [-14, 3.7, TAP - 12], elbow: [1, 0, 0.3] },
      },
      {
        ...TAPPING,
        side: 18,
        armR: { reach: [14, 3.7, TAP - 12], elbow: [1, 0, 0.3] },
        armL: { reach: [-14, 3.7, TAP], elbow: [1, 0, 0.3] },
      },
    ],
  },
  "seated-knee-tuck": {
    view: PROFILE,
    keys: [
      { at: [0, REST, 0], pitch: -38, ...PROPPED, legs: { flex: 62, bend: 2 } },
      { at: [0, REST, 0], pitch: -38, lean: 14, ...PROPPED, legs: { flex: 122, bend: 116 } },
    ],
  },
  "dragon-flag": {
    view: PROFILE,
    keys: [flag(-168), flag(-138), flag(-109)],
  },
  "stability-ball-hamstring-curl": {
    view: PROFILE,
    gear: [{ kind: "ball", at: [0, BALL, ON_BALL[2]], radius: BALL }],
    keys: [
      { ...bridge(14), ...onBall },
      { ...slid(bridge(25), 17), ...onBall },
    ],
  },
  "bird-dog": {
    view: PROFILE,
    keys: [
      { ...ALL_FOURS, armR: AHEAD, armL: HAND_L, legR: KNEE_R, legL: BEHIND },
      { ...ALL_FOURS, armR: HAND_R, armL: HAND_L, legR: KNEE_R, legL: KNEE_L },
      {
        ...ALL_FOURS,
        armR: HAND_R,
        armL: { ...AHEAD, reach: mirrored(AHEAD.reach) },
        legR: { ...BEHIND, plant: mirrored(BEHIND.plant) },
        legL: KNEE_L,
      },
    ],
  },
  "donkey-kick": {
    view: PROFILE,
    // The knee stays bent as the thigh swings up, so the foot goes round the hip: three keys.
    keys: [0, 45, 88].map((up) => ({
      ...ALL_FOURS,
      armR: HAND_R,
      armL: HAND_L,
      legR: { ...KNEE_R, plant: kicked(up) },
      legL: KNEE_L,
    })) as [Pose, Pose, Pose],
  },
  "fire-hydrant": {
    view: { yaw: 45 },
    keys: [
      {
        ...ALL_FOURS,
        armR: HAND_R,
        armL: HAND_L,
        legR: KNEE_R,
        legL: KNEE_L,
      },
      {
        ...ALL_FOURS,
        armR: HAND_R,
        armL: HAND_L,
        legR: { plant: [BODY.hip + 20, 16, -BODY.shin], knee: [1, 1, 0.9] },
        legL: KNEE_L,
      },
    ],
  },
  clamshell: {
    view: ON_SIDE_VIEW,
    keys: [
      { ...ON_SIDE, legL: SHELL_L, legR: { plant: SHELL_R, knee: [0, 0, 1] } },
      { ...ON_SIDE, legL: SHELL_L, legR: { plant: SHELL_R, knee: [0.85, 0, 0.55] } },
    ],
  },
  "side-lying-hip-abduction": {
    view: ON_SIDE_VIEW,
    keys: [
      { ...ON_SIDE, legL: { flex: 38, bend: 70 }, legR: { abduct: 2 } },
      { ...ON_SIDE, legL: { flex: 38, bend: 70 }, legR: { abduct: 34 } },
    ],
  },
  "side-lying-leg-raise": {
    view: ON_SIDE_VIEW,
    keys: [
      { ...ON_SIDE, legL: {}, legR: { abduct: 2 } },
      { ...ON_SIDE, legL: {}, legR: { abduct: 46 } },
    ],
  },
  "hip-airplane": {
    view: { yaw: 55 },
    keys: [
      { ...AIRPLANE, pitch: 122 },
      { ...AIRPLANE, pitch: 58 },
    ],
  },
};

export default family;
