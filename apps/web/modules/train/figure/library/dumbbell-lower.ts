/** Dumbbells for the legs and the trunk: squats, lunges, hinges, carries. */
import {
  FRONT,
  QUARTER,
  REST,
  SIDE,
  feet,
  type Family,
  type Gear,
  type Pose,
  type Vec,
} from "./kit";

/** A dumbbell in each hand, held by the sides: its handle points the way the figure faces. */
const BY_SIDES: Gear = { kind: "dumbbells", along: [0, 0, 1] };
/** A dumbbell in each hand, held in front of the thighs: its handle lies across. */
const IN_FRONT: Gear = { kind: "dumbbells" };
/** One dumbbell held upright against the chest in both hands: the goblet hold. */
const GOBLET: Gear = { kind: "dumbbells", hand: "R", along: [0, 1, 0] };
const GOBLET_HOLD: Pose["arms"] = { grip: [2.5, -8, 9], elbow: [0.7, -1, 0] };
/**
 * One dumbbell held level by its two ends, a hand on each head, in front of everything: for a
 * weight that hangs between the legs, where a dumbbell in one hand would be hidden.
 */
const HEAD = { along: [1, 0, 0], radius: 4.6, thick: 4, place: "front" } as const;
const BY_ENDS: Gear[] = [
  { kind: "rail", points: ["handL", "handR"], place: "front" },
  { kind: "plate", at: "handL", ...HEAD },
  { kind: "plate", at: "handR", ...HEAD },
];
/** One dumbbell laid across the hips, a hand on either side of its middle. */
const ON_HIPS: Gear = { kind: "dumbbells", hand: "R" };
const HIPS_HOLD: Pose["arms"] = { grip: [2, -25, 6], elbow: [1, 0, 0.4] };

/** Arms hanging straight down beside a torso that leans `lean`. */
const down = (lean = 0): Pose["arms"] => ({ flex: lean, abduct: 4 });

/** How far each hip is from the middle, and how high the hips of a figure standing straight. */
const HIP = 4.25;
const TALL = 49.5;
/** The ankle of a foot flat on the floor, and of one up on its toes. */
const FLAT = 4;
const TOES = 9.5;

/**
 * A split stance: the hips at `hips`, the right foot (the near one) at `front` and the left at
 * `rear`, whose knee points at the floor. Feet stay where they are put while the hips move.
 */
const split = (hips: Vec, front: Vec, rear: Vec, lean = 8): Pose => ({
  at: hips,
  lean,
  legR: { plant: front },
  legL: { plant: rear, knee: [0, -0.6, 1] },
  arms: down(lean),
});
/** Standing straight, both feet under the hips at `z`, on something `high`. */
const upright = (z = 0, high = 0): Pose =>
  split([0, TALL + high, z], [HIP, FLAT + high, z], [-HIP, FLAT + high, z], 2);

const AHEAD: Vec = [HIP, FLAT, 20];
const BEHIND: Vec = [-HIP, TOES, -26];

/** A step or a plate to stand on: `high`, from `from` to `to` along the way the figure faces. */
const step = (high: number, from: number, to: number): Gear => ({
  kind: "box",
  at: [0, 0, (from + to) / 2],
  wide: 30,
  deep: to - from,
  high,
  place: "back",
});

const SQUAT: Pose["legs"] = { flex: 100, bend: 112 };
const HINGE: Pose["legs"] = { flex: 18, bend: 24 };
const SUMO: Pose["legs"] = { abduct: 24 };

const family: Family = {
  "goblet-squat": {
    view: SIDE,
    gear: [GOBLET],
    keys: [
      { lean: 3, arms: GOBLET_HOLD },
      { lean: 30, legs: SQUAT, arms: GOBLET_HOLD },
    ],
  },
  "heel-elevated-goblet-squat": {
    view: SIDE,
    gear: [step(4.5, -11, 3), GOBLET],
    keys: [
      { pin: { what: "ankles", to: [0, 8.5, -3] }, lean: 2, arms: GOBLET_HOLD },
      {
        pin: { what: "ankles", to: [0, 8.5, -3] },
        lean: 16,
        legs: { flex: 112, bend: 134 },
        arms: GOBLET_HOLD,
      },
    ],
  },
  "dumbbell-sumo-squat": {
    view: FRONT,
    gear: BY_ENDS,
    keys: [
      { lean: 2, legs: SUMO, arms: { flex: 2, abduct: -10.5 } },
      {
        lean: 14,
        legs: { abduct: 40, flex: 74, bend: 86 },
        arms: { flex: 30, abduct: -10.5 },
      },
    ],
  },
  "dumbbell-sumo-deadlift": {
    view: FRONT,
    gear: [IN_FRONT],
    keys: [
      { lean: 2, legs: SUMO, arms: { flex: 2, abduct: -9 } },
      {
        lean: 48,
        legs: { abduct: 34, flex: 66, bend: 74 },
        arms: { flex: 48, abduct: -9 },
      },
    ],
  },
  "dumbbell-romanian-deadlift": {
    view: SIDE,
    gear: [IN_FRONT],
    keys: [
      { lean: 2, arms: down(2) },
      { lean: 70, legs: HINGE, arms: down(70) },
    ],
  },
  "single-leg-romanian-deadlift": {
    view: SIDE,
    gear: [IN_FRONT],
    keys: [
      { pin: { what: "ankleR", to: [HIP, FLAT, 0] }, lean: 2, arms: down(2) },
      {
        pin: { what: "ankleR", to: [HIP, FLAT, 0] },
        lean: 76,
        legR: { flex: 14, bend: 18 },
        legL: { flex: -72, bend: 6 },
        arms: down(76),
      },
    ],
  },
  "split-squat": {
    view: SIDE,
    gear: [BY_SIDES],
    keys: [split([0, 44, -2], AHEAD, BEHIND), split([0, 28.5, -3], AHEAD, BEHIND)],
  },
  "bulgarian-split-squat": {
    view: SIDE,
    gear: [{ kind: "bench", from: [-22, 0, -44], to: [22, 0, -44] }, BY_SIDES],
    keys: [
      split([0, 46, -4], [HIP, FLAT, 12], [-HIP, 32, -38], 6),
      split([0, 28, -8], [HIP, FLAT, 12], [-HIP, 32, -38], 14),
    ],
  },
  "front-foot-elevated-split-squat": {
    view: SIDE,
    gear: [step(8, 9, 33), BY_SIDES],
    keys: [
      split([0, 46, -2], [HIP, FLAT + 8, 20], BEHIND),
      split([0, 30, -3], [HIP, FLAT + 8, 20], BEHIND),
    ],
  },
  "reverse-lunge": {
    view: SIDE,
    gear: [BY_SIDES],
    keys: [upright(), split([0, 28.5, -23], [HIP, FLAT, 0], [-HIP, TOES, -46])],
  },
  "deficit-reverse-lunge": {
    view: SIDE,
    gear: [step(9, -12, 14), BY_SIDES],
    keys: [upright(0, 9), split([0, 30, -23], [HIP, FLAT + 9, 0], [-HIP, TOES, -48])],
  },
  "walking-lunge": {
    view: SIDE,
    gear: [BY_SIDES],
    keys: [
      split([0, 28.5, -3], AHEAD, BEHIND),
      upright(),
      split([0, 28.5, -3], [HIP, TOES, -26], [-HIP, FLAT, 20]),
    ],
  },
  "dumbbell-curtsy-lunge": {
    view: { yaw: 28 },
    gear: [BY_SIDES],
    keys: [upright(), split([2, 31, -10], [HIP, FLAT, 2], [16, TOES, -28], 12)],
  },
  "dumbbell-lateral-lunge": {
    view: FRONT,
    gear: [IN_FRONT],
    keys: [
      {
        at: [0, TALL, 0],
        lean: 2,
        legR: { plant: [HIP, FLAT, 0] },
        legL: { plant: [-HIP, FLAT, 0] },
        arms: { flex: 2, abduct: -4 },
      },
      {
        at: [36, 28, -8],
        lean: 36,
        legR: { plant: [52, FLAT, 2], knee: [0.3, 0.2, 1] },
        legL: { plant: [-HIP, FLAT, 0] },
        arms: { flex: 36, abduct: -4 },
      },
    ],
  },
  "step-up": {
    view: SIDE,
    gear: [step(24, 11, 41), BY_SIDES],
    keys: [
      split([0, 47, 4], [HIP, 28, 22], [-HIP, FLAT, -2], 14),
      split([0, 73.4, 22], [HIP, 28, 22], [-HIP, 28, 20], 2),
    ],
  },
  "farmer-carry": {
    view: SIDE,
    gear: [BY_SIDES],
    keys: [
      { lean: 3, legR: { flex: 24, bend: 8 }, legL: { flex: -16, bend: 16 }, arms: down(3) },
      { lean: 3, legR: { flex: -16, bend: 16 }, legL: { flex: 24, bend: 8 }, arms: down(3) },
    ],
  },
  "dumbbell-glute-bridge": {
    view: { yaw: 70 },
    gear: [ON_HIPS],
    keys: [
      { at: [0, REST + 1, 0], pitch: -92, nod: 18, ...feet(24), arms: HIPS_HOLD },
      { at: [0, 21, 2], pitch: -122, nod: 48, ...feet(24), arms: HIPS_HOLD },
    ],
  },
  "dumbbell-hip-thrust": {
    view: { yaw: 70 },
    gear: [{ kind: "bench", from: [-26, 0, -31], to: [26, 0, -31] }, ON_HIPS],
    keys: [
      { at: [0, 13, -4], pitch: -48, ...feet(27), arms: HIPS_HOLD },
      { at: [0, 30, 2], pitch: -88, ...feet(27), arms: HIPS_HOLD },
    ],
  },
  "weighted-russian-twist": {
    view: QUARTER,
    gear: [ON_HIPS],
    keys: [
      {
        at: [0, REST, 0],
        pitch: -38,
        twist: -42,
        ...feet(31, 6),
        arms: { grip: [2, -12, 24], elbow: [1, -0.6, 0] },
      },
      {
        at: [0, REST, 0],
        pitch: -38,
        twist: 42,
        ...feet(31, 6),
        arms: { grip: [2, -12, 24], elbow: [1, -0.6, 0] },
      },
    ],
  },
  "dumbbell-side-bend": {
    view: FRONT,
    gear: [{ kind: "dumbbells", hand: "R", along: [0, 0, 1] }],
    keys: [
      { side: 0, armR: { abduct: 4 }, armL: { grip: [10, -27, 3], elbow: [1, 0, -0.4] } },
      { side: -24, armR: { abduct: 28 }, armL: { grip: [10, -27, 3], elbow: [1, 0, -0.4] } },
    ],
  },
};

export default family;
