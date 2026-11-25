/** Legs with the body alone: squats, lunges, jumps. */
import { FRONT, QUARTER, SIDE, hands, wall, type Family, type Pose, type Vec } from "./kit";

/** How high an ankle is when its foot is flat on the floor, and the hips of a figure standing. */
const ANKLE = 4;
const HIPS_HIGH = 49.5;
/** How far a hip is from the middle of the body: a foot under it stands this far out. */
const HIP = 4.25;

/** Hands on the hips, and clasped in front of the chest. */
const ON_HIPS: Pose["arms"] = { grip: [10, -26, 2], elbow: [1, 0, -0.4] };
const CLASPED: Pose["arms"] = { grip: [3, -8, 13], elbow: [0.8, -0.6, 0] };

/** The bottom of a squat on both legs, and the lean that goes with it. */
const SQUAT = { flex: 100, bend: 112 } as const;
const SQUAT_LEAN = 38;

/** Both feet where they are put: the right, then the left. `knee` is the way the knees point. */
const planted = (right: Vec, left: Vec, knee?: Vec): Pick<Pose, "legR" | "legL"> => ({
  legR: knee ? { plant: right, knee } : { plant: right },
  legL: knee ? { plant: left, knee } : { plant: left },
});
// ── One leg ─────────────────────────────────────────────────────────────────────────────────

/** Standing on the right foot, which stays where it is. */
const ON_RIGHT: Pose["pin"] = { what: "ankleR", to: [HIP, ANKLE, 0] };
/** The bottom of a squat on one leg: deep, and the lean that keeps it over the foot. */
const PISTOL = { flex: 112, bend: 128 } as const;

// ── Down to the floor and back ──────────────────────────────────────────────────────────────

/** Where the hands go on the floor, and the feet when they shoot back. */
const HANDS_DOWN: Vec = [13, 3.7, 28];
const FEET_BACK = -42;
/**
 * The way the knees point, in the body's own terms: up it and forward of it while it is
 * upright, up it and behind it once it is face down, so that as the feet shoot back the knees
 * come through towards the chest and never towards the floor.
 */
const KNEES_UP: Vec = [0.1, 1, 1];
const KNEES_OVER: Vec = [0.1, 1, -1];
const UPRIGHT: Pose = {
  at: [0, 49.6, 0],
  ...planted([6, ANKLE, 0], [-6, ANKLE, 0], KNEES_UP),
  ...hands([15, 46.5, 2]),
};
const IN_THE_AIR: Pose = {
  at: [0, 63, 0],
  ...planted([6, 17, 0], [-6, 17, 0], KNEES_UP),
  ...hands([9, 123, 4]),
};
const CROUCH: Pose = {
  at: [0, 22, -6],
  lean: 65,
  ...planted([6, ANKLE, 0], [-6, ANKLE, 0], KNEES_UP),
  ...hands(HANDS_DOWN),
};
const PLANK: Pose = {
  at: [0, 22.6, 0],
  pitch: 66,
  ...planted([6, ANKLE, FEET_BACK], [-6, ANKLE, FEET_BACK], KNEES_OVER),
  ...hands(HANDS_DOWN),
};

const family: Family = {
  // ── Squats ────────────────────────────────────────────────────────────────────────────────
  "bodyweight-squat": {
    view: SIDE,
    keys: [
      { arms: { flex: 6, bend: 4 } },
      { lean: SQUAT_LEAN, legs: SQUAT, arms: { flex: 124, bend: 4 } },
    ],
  },
  "jump-squat": {
    view: SIDE,
    keys: [
      {
        pin: { what: "ankles", to: [0, ANKLE, 0] },
        lean: SQUAT_LEAN,
        legs: { flex: 92, bend: 104, point: 4 },
        arms: { flex: -4, bend: 24 },
      },
      {
        pin: { what: "ankles", to: [0, 17, 0] },
        lean: 0,
        legs: { flex: 0, bend: 0, point: 52 },
        arms: { flex: 150, bend: 12 },
      },
    ],
  },
  "wall-sit": {
    view: SIDE,
    gear: [wall(-30)],
    keys: [
      { nod: 8, legs: { flex: 90, bend: 90 }, arms: { flex: 38, bend: 10 } },
      { nod: 8, legs: { flex: 88.5, bend: 88.5 }, arms: { flex: 38, bend: 10 } },
    ],
  },
  "sissy-squat": {
    view: SIDE,
    keys: [
      {
        pin: { what: "toes", to: [0, ANKLE, 0] },
        legs: { flex: 0, bend: 0, point: 0 },
        arms: { flex: 16, bend: 6 },
      },
      {
        pin: { what: "toes", to: [0, 2.5, 0] },
        pitch: -36,
        legs: { flex: 0, bend: 84, point: 0 },
        arms: { flex: 58, bend: 6 },
      },
    ],
  },
  "cossack-squat": {
    view: FRONT,
    keys: [
      {
        at: [-17, 21, -7],
        lean: 28,
        ...planted([26, ANKLE, 0], [-26, ANKLE, 0], [0.5, 0.3, 1]),
        arms: CLASPED,
      },
      {
        at: [0, 43, 0],
        lean: 4,
        ...planted([26, ANKLE, 0], [-26, ANKLE, 0], [0.5, 0.3, 1]),
        arms: CLASPED,
      },
      {
        at: [17, 21, -7],
        lean: 28,
        ...planted([26, ANKLE, 0], [-26, ANKLE, 0], [0.5, 0.3, 1]),
        arms: CLASPED,
      },
    ],
  },

  // ── Squats on one leg ─────────────────────────────────────────────────────────────────────
  "pistol-squat": {
    view: SIDE,
    keys: [
      { pin: ON_RIGHT, lean: 4, legR: {}, legL: { flex: 28, bend: 4 }, arms: { flex: 66 } },
      {
        pin: ON_RIGHT,
        lean: 38,
        legR: PISTOL,
        legL: { flex: 96, bend: 0 },
        arms: { flex: 124 },
      },
    ],
  },
  "assisted-pistol-squat": {
    view: SIDE,
    // Something to hold on to: a post.
    gear: [
      {
        kind: "rail",
        points: [
          [0, 0.6, 34],
          [0, 94, 34],
        ],
      },
    ],
    keys: [
      {
        pin: ON_RIGHT,
        lean: 4,
        legR: {},
        legL: { flex: 28, bend: 4 },
        ...hands([3, 74, 33]),
      },
      {
        pin: ON_RIGHT,
        lean: 28,
        legR: PISTOL,
        legL: { flex: 96, bend: 0 },
        ...hands([3, 46, 33]),
      },
    ],
  },
  "shrimp-squat": {
    view: SIDE,
    keys: [
      {
        pin: ON_RIGHT,
        lean: 6,
        legR: {},
        legL: { flex: -8, bend: 122 },
        arms: { flex: 30, bend: 6 },
      },
      {
        pin: ON_RIGHT,
        lean: 44,
        legR: { flex: 95, bend: 125 },
        legL: { flex: -35, bend: 118 },
        arms: { flex: 132, bend: 6 },
      },
    ],
  },
  "skater-squat": {
    view: SIDE,
    keys: [
      {
        pin: ON_RIGHT,
        lean: 8,
        legR: {},
        legL: { flex: 8, bend: 52 },
        arms: { flex: 12, bend: 30 },
      },
      {
        pin: ON_RIGHT,
        lean: 58,
        legR: { flex: 92, bend: 118 },
        legL: { flex: -32, bend: 80 },
        arms: { flex: 150, bend: 4 },
      },
    ],
  },
  "single-leg-box-squat": {
    view: SIDE,
    gear: [{ kind: "box", at: [0, 0, -27], wide: 30, deep: 22, high: 21 }],
    keys: [
      { pin: ON_RIGHT, lean: 4, legR: {}, legL: { flex: 25, bend: 6 }, arms: { flex: 60 } },
      {
        pin: ON_RIGHT,
        lean: 22,
        legR: { flex: 90, bend: 90 },
        legL: { flex: 84, bend: 14 },
        arms: { flex: 112 },
      },
    ],
  },
  "step-down": {
    view: QUARTER,
    // Standing on the edge of a box, the other foot goes down beside it to touch the floor.
    gear: [{ kind: "box", at: [-18, 0, 0], wide: 34, deep: 26, high: 14 }],
    keys: [
      {
        pin: { what: "ankleL", to: [-HIP, 18, 0] },
        legL: {},
        legR: { flex: 8, bend: 6, abduct: 3 },
        arms: ON_HIPS,
      },
      {
        pin: { what: "ankleL", to: [-HIP, 18, 0] },
        lean: 24,
        legL: { flex: 60, bend: 78 },
        legR: { flex: 12, bend: 0, abduct: 3 },
        arms: ON_HIPS,
      },
    ],
  },

  // ── Lunges ────────────────────────────────────────────────────────────────────────────────
  "forward-lunge": {
    view: SIDE,
    keys: [
      {
        at: [0, HIPS_HIGH, 0],
        legR: { plant: [HIP, ANKLE, 0] },
        legL: { plant: [-HIP, ANKLE, 0], knee: [0, -1, 0.3] },
        arms: ON_HIPS,
      },
      {
        at: [0, 46, 10],
        legR: { plant: [HIP, 11, 28] },
        legL: { plant: [-HIP, 5.5, 0], knee: [0, -1, 0.3] },
        arms: ON_HIPS,
      },
      {
        at: [0, 28, 26],
        lean: 6,
        legR: { plant: [HIP, ANKLE, 48] },
        legL: { plant: [-HIP, 9, 0], knee: [0, -1, 0.3] },
        arms: ON_HIPS,
      },
    ],
  },
  "lateral-lunge": {
    view: FRONT,
    keys: [
      {
        at: [0, HIPS_HIGH, 0],
        ...planted([6, ANKLE, 0], [-6, ANKLE, 0], [0.4, 0.2, 1]),
        arms: CLASPED,
      },
      {
        at: [8, 47, -2],
        lean: 8,
        ...planted([28, 10, 0], [-6, ANKLE, 0], [0.4, 0.2, 1]),
        arms: CLASPED,
      },
      {
        at: [32, 27, -10],
        lean: 34,
        ...planted([46, ANKLE, 0], [-6, ANKLE, 0], [0.4, 0.2, 1]),
        arms: CLASPED,
      },
    ],
  },
  "curtsy-lunge": {
    view: { yaw: 24 },
    keys: [
      {
        at: [0, HIPS_HIGH, 0],
        legL: { plant: [-HIP, ANKLE, 0] },
        legR: { plant: [HIP, ANKLE, 0], knee: [0, -1, 0.4] },
        arms: CLASPED,
      },
      {
        at: [0, 46, -3],
        legL: { plant: [-HIP, ANKLE, 0] },
        legR: { plant: [4, 11, -16], knee: [0, -1, 0.4] },
        arms: CLASPED,
      },
      {
        at: [-2, 30, -8],
        lean: 14,
        legL: { plant: [-HIP, ANKLE, 0] },
        legR: { plant: [-16, 9, -30], knee: [0, -1, 0.4] },
        arms: CLASPED,
      },
    ],
  },

  // ── Calves ────────────────────────────────────────────────────────────────────────────────
  "calf-raise": {
    view: SIDE,
    keys: [
      { pin: { what: "toes", to: [0, 2, 0] }, legs: { point: 14 }, arms: ON_HIPS },
      { pin: { what: "toes", to: [0, 2, 0] }, legs: { point: 58 }, arms: ON_HIPS },
    ],
  },
  "single-leg-calf-raise": {
    view: SIDE,
    keys: [
      {
        pin: { what: "toeR", to: [HIP, 2, 0] },
        legR: { point: 14 },
        legL: { flex: 6, bend: 78 },
        arms: ON_HIPS,
      },
      {
        pin: { what: "toeR", to: [HIP, 2, 0] },
        legR: { point: 58 },
        legL: { flex: 6, bend: 78 },
        arms: ON_HIPS,
      },
    ],
  },

  // ── Down to the floor and back ────────────────────────────────────────────────────────────
  burpee: { view: { yaw: 74 }, keys: [IN_THE_AIR, CROUCH, PLANK] },
  "squat-thrust": { view: { yaw: 74 }, keys: [UPRIGHT, CROUCH, PLANK] },
  "half-burpee": { view: { yaw: 74 }, keys: [PLANK, CROUCH] },
  sprawl: {
    view: { yaw: 74 },
    keys: [
      // On guard, the hands come down, and the legs shoot back with the hips to the floor.
      {
        at: [0, 42, 0],
        lean: 22,
        ...planted([9, ANKLE, 0], [-9, ANKLE, 0], KNEES_UP),
        ...hands([8, 72, 24]),
      },
      CROUCH,
      {
        at: [0, 9, 4],
        pitch: 90,
        lean: -55,
        ...planted([6, ANKLE, -41.5], [-6, ANKLE, -41.5], KNEES_OVER),
        ...hands([13, 3.7, 27]),
      },
    ],
  },

  // ── On the spot ───────────────────────────────────────────────────────────────────────────
  "high-knees": {
    view: SIDE,
    keys: [
      {
        at: [0, 50.6, 0],
        lean: 4,
        legR: { flex: 92, bend: 96 },
        legL: {},
        armR: { flex: -34, bend: 85 },
        armL: { flex: 56, bend: 85 },
      },
      {
        at: [0, 49.8, 0],
        lean: 4,
        legR: {},
        legL: {},
        armR: { flex: 10, bend: 85 },
        armL: { flex: 10, bend: 85 },
      },
      {
        at: [0, 50.6, 0],
        lean: 4,
        legR: {},
        legL: { flex: 92, bend: 96 },
        armR: { flex: 56, bend: 85 },
        armL: { flex: -34, bend: 85 },
      },
    ],
  },
  "fast-feet": {
    view: QUARTER,
    keys: [
      {
        at: [0, 42, 0],
        lean: 24,
        legR: { flex: 52, bend: 92, abduct: 8 },
        legL: { flex: 34, bend: 68, abduct: 8 },
        armR: { flex: 14, bend: 90 },
        armL: { flex: 40, bend: 90 },
      },
      {
        at: [0, 42, 0],
        lean: 24,
        legR: { flex: 34, bend: 68, abduct: 8 },
        legL: { flex: 34, bend: 68, abduct: 8 },
        armR: { flex: 27, bend: 90 },
        armL: { flex: 27, bend: 90 },
      },
      {
        at: [0, 42, 0],
        lean: 24,
        legR: { flex: 34, bend: 68, abduct: 8 },
        legL: { flex: 52, bend: 92, abduct: 8 },
        armR: { flex: 40, bend: 90 },
        armL: { flex: 14, bend: 90 },
      },
    ],
  },
  "jumping-jack": {
    view: FRONT,
    keys: [
      { legs: { abduct: 2 }, arms: { abduct: 8, bend: 4 } },
      { legs: { abduct: 22 }, arms: { abduct: 166, bend: 12 } },
    ],
  },
  "seal-jack": {
    view: { yaw: 28 },
    keys: [
      // The hands meet in front, and open wide as the feet jump apart.
      { legs: { abduct: 2 }, ...hands([1.5, 79, 30.5]) },
      { legs: { abduct: 12 }, ...hands([31, 77.5, 27]) },
      { legs: { abduct: 22 }, ...hands([45, 76, 6]) },
    ],
  },
  "skater-hop": {
    view: { yaw: 28 },
    keys: [
      // Landed on one leg, the other swept behind it; in the air; landed on the other.
      {
        at: [-22, 37, 0],
        lean: 42,
        side: -14,
        legL: { flex: 46, bend: 86 },
        legR: { flex: -16, bend: 64, abduct: -24 },
        armR: { flex: 96, bend: 30 },
        armL: { flex: 4, bend: 40 },
      },
      {
        at: [0, 57, 0],
        lean: 24,
        legL: { flex: 16, bend: 34, abduct: 18 },
        legR: { flex: 16, bend: 34, abduct: 18 },
        armR: { flex: 40, bend: 36 },
        armL: { flex: 40, bend: 36 },
      },
      {
        at: [22, 37, 0],
        lean: 42,
        side: 14,
        legL: { flex: -16, bend: 64, abduct: -24 },
        legR: { flex: 46, bend: 86 },
        armR: { flex: 4, bend: 40 },
        armL: { flex: 96, bend: 30 },
      },
    ],
  },
  "lateral-shuffle": {
    view: FRONT,
    keys: [
      {
        at: [-8, 38, -5],
        lean: 26,
        ...planted([6, ANKLE, 0], [-22, ANKLE, 0], [0.4, 0.2, 1]),
        arms: { flex: 34, bend: 96 },
      },
      {
        at: [0, 41, -5],
        lean: 26,
        ...planted([6, ANKLE, 0], [-6, ANKLE, 0], [0.4, 0.2, 1]),
        arms: { flex: 34, bend: 96 },
      },
      {
        at: [8, 38, -5],
        lean: 26,
        ...planted([22, ANKLE, 0], [-6, ANKLE, 0], [0.4, 0.2, 1]),
        arms: { flex: 34, bend: 96 },
      },
    ],
  },
};

export default family;
