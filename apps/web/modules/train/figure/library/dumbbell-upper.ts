/** Dumbbells for the upper body: presses, raises, rows, curls, triceps. */
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
  seat,
  sitting,
  type Family,
  type Gear,
  type Pose,
  type Vec,
} from "./kit";

/** A dumbbell in each hand: its handle across the body, or along the way the figure faces. */
const ACROSS: Gear = { kind: "dumbbells" };
const ALONG: Gear = { kind: "dumbbells", along: [0, 0, 1] };
/** One dumbbell, in the right hand (or in both, held together). */
const ONE_ACROSS: Gear = { kind: "dumbbells", hand: "R" };
const ONE_ALONG: Gear = { kind: "dumbbells", hand: "R", along: [0, 0, 1] };

/** Seen from the side, a little more square than SIDE: curls, where the far arm adds nothing. */
const CURL = { yaw: 72 } as const;
/** Lying on a bench, seen as the barbell presses are. */
const LYING = { yaw: 64 } as const;

/** Elbows out and down, as under a weight being pressed. */
const UNDER: Vec = [0.8, -0.5, -0.4];
/** Elbows back, as at the top of a row. */
const BACK: Vec = [0.5, 0.1, -1];

/** A press overhead, in the torso's terms: beside the shoulders, then up at arm's length. */
const RACKED: Pose["arms"] = { grip: [19, 3, 3], elbow: [0.8, -0.7, 0.1] };
const OVERHEAD: Pose["arms"] = { grip: [15, 32, 1], elbow: [0.8, -0.7, 0.1] };

/** Sitting upright against a back. */
const SEATED: Pose = { ...sitting(), lean: -6 };
const CHAIR: Gear[] = seat(BENCH_HIGH, 0, -6);

/** The hips on an incline bench, for pressing and for curling; and on a decline one. */
const INCLINE: Vec = [0, BENCH_HIGH + REST, 0];
const DECLINE: Vec = [0, 40, 4];
const DECLINE_BENCH: Gear[] = [
  backrest(DECLINE, -106, 44, 8),
  post([0, 30, 0]),
  post([0, 18, -34]),
  // The roller the feet hook under.
  { kind: "plate", at: "ankles", along: [1, 0, 0], radius: 3.4, thick: 16, place: "back" },
];

/** Bent over from the hips, knees soft: rows, kickbacks, rear-delt raises. */
const BENT = { lean: 60, legs: { flex: 30, bend: 38 } } as const;

/**
 * Lying chest down on an incline bench: the body one straight line from the feet on the floor
 * to the head, the pad under the thighs and the chest, the shoulders clear of its top.
 */
const PROPPED: Vec = [0, 34.5, 0];
const ON_CHEST: Pose = {
  at: PROPPED,
  pitch: 48,
  nod: -14,
  legs: { plant: [7, 4, -34] },
  legL: { plant: [-7, 4, -34] },
};
const CHEST_BENCH: Gear[] = [backrest(PROPPED, 48, 24, 14), post([0, 20, -3]), post([0, 42, 21])];

/** One knee and one hand on a bench beside the figure, the other foot on the floor. */
const BESIDE: Gear = { kind: "bench", from: [-9, 0, -16], to: [-9, 0, 44] };
const ON_ONE_KNEE: Pose = {
  at: [0, 49.5, 0],
  lean: 72,
  nod: -16,
  legR: { plant: [6, 4, -2] },
  legL: { flex: 36, bend: 126 },
  armL: { reach: [-10, BENCH_HIGH + 3.7, 37], elbow: [-0.2, 0.2, -1] },
};

const family: Family = {
  // ── Presses ──────────────────────────────────────────────────────────────────────────────
  "dumbbell-bench-press": {
    view: LYING,
    gear: [flatBench(), ACROSS],
    keys: [
      { ...ON_BENCH, ...hands([15, 64, -22], UNDER) },
      { ...ON_BENCH, ...hands([21, 41, -20], UNDER) },
    ],
  },
  "incline-dumbbell-press": {
    view: LYING,
    gear: [...inclineBench(INCLINE, -52), ACROSS],
    keys: [
      { at: INCLINE, pitch: -52, ...feet(27), ...hands([15, 82, -21], UNDER) },
      { at: INCLINE, pitch: -52, ...feet(27), ...hands([21, 58, -17], UNDER) },
    ],
  },
  "decline-dumbbell-press": {
    view: LYING,
    gear: [...DECLINE_BENCH, ACROSS],
    keys: [
      { at: DECLINE, pitch: -106, legs: { flex: 74, bend: 96 }, ...hands([15, 64, -24], UNDER) },
      { at: DECLINE, pitch: -106, legs: { flex: 74, bend: 96 }, ...hands([21, 41, -22], UNDER) },
    ],
  },
  "dumbbell-fly": {
    view: QUARTER,
    gear: [flatBench(), ALONG],
    keys: [
      // Three keys, so the hands go round an arc with the arms long, not straight across.
      { ...ON_BENCH, ...hands([5, 63, -23], [0.6, 0, -1]) },
      { ...ON_BENCH, ...hands([35, 54, -23], [0.6, 0, -1]) },
      { ...ON_BENCH, ...hands([43, 37, -23], [0.6, 0, -1]) },
    ],
  },
  "seated-dumbbell-press": {
    view: { yaw: 32 },
    gear: [...CHAIR, ACROSS],
    keys: [
      { ...SEATED, arms: RACKED },
      { ...SEATED, arms: OVERHEAD },
    ],
  },
  "standing-dumbbell-press": {
    view: FRONT,
    gear: [ACROSS],
    keys: [{ arms: RACKED }, { arms: OVERHEAD }],
  },
  "arnold-press": {
    view: QUARTER,
    gear: [...CHAIR, ACROSS],
    keys: [
      // It starts with the dumbbells before the chest, palms in, and turns out as it rises.
      { ...SEATED, arms: { grip: [6, -4, 11], elbow: [0.3, -1, 0.2] } },
      { ...SEATED, arms: { grip: [19, 6, 3], elbow: [0.8, -0.7, 0.1] } },
      { ...SEATED, arms: OVERHEAD },
    ],
  },

  // ── Raises ───────────────────────────────────────────────────────────────────────────────
  "lateral-raise": {
    view: FRONT,
    gear: [ALONG],
    keys: [{ arms: { abduct: 9, bend: 12 } }, { arms: { abduct: 88, flex: 8, bend: 14 } }],
  },
  "front-raise": {
    view: CURL,
    gear: [ACROSS],
    keys: [{ arms: { flex: 4, abduct: 5, bend: 8 } }, { arms: { flex: 92, abduct: 5, bend: 8 } }],
  },
  "bent-over-rear-delt-raise": {
    view: QUARTER,
    gear: [ALONG],
    keys: [
      { ...BENT, lean: 72, arms: { flex: 72, abduct: 4, bend: 14 } },
      { ...BENT, lean: 72, arms: { flex: 4, abduct: 86, bend: 14 } },
    ],
  },
  "rear-delt-fly": {
    // The same raise sitting on the end of a bench, the chest down towards the knees.
    view: QUARTER,
    gear: [flatBench(-10, 6), ALONG],
    keys: [
      { ...sitting(), lean: 64, nod: -12, arms: { flex: 64, abduct: 4, bend: 14 } },
      { ...sitting(), lean: 64, nod: -12, arms: { flex: 4, abduct: 86, bend: 14 } },
    ],
  },
  "dumbbell-shrug": {
    view: FRONT,
    gear: [ALONG],
    keys: [
      { ...hands([17, 46.5, 2], [0.1, -0.3, -1]) },
      { nod: 5, ...hands([17, 51.5, 1], [0.1, -0.3, -1]) },
    ],
  },

  // ── Rows ─────────────────────────────────────────────────────────────────────────────────
  "dumbbell-bent-over-row": {
    view: SIDE,
    gear: [ALONG],
    keys: [
      { ...BENT, arms: hanging(60) },
      { ...BENT, arms: { grip: [15, -24, 4], elbow: BACK } },
    ],
  },
  "one-arm-dumbbell-row": {
    view: SIDE,
    gear: [BESIDE, ONE_ALONG],
    keys: [
      { ...ON_ONE_KNEE, armR: hanging(72) },
      { ...ON_ONE_KNEE, armR: { grip: [15, -22, 3], elbow: BACK } },
    ],
  },

  // ── Curls ────────────────────────────────────────────────────────────────────────────────
  "bicep-curl": {
    view: CURL,
    gear: [ACROSS],
    keys: [{ arms: { flex: 2, abduct: 5, bend: 6 } }, { arms: { flex: 14, abduct: 5, bend: 140 } }],
  },
  "hammer-curl": {
    view: CURL,
    gear: [ALONG],
    keys: [{ arms: { flex: 2, abduct: 5, bend: 6 } }, { arms: { flex: 10, abduct: 5, bend: 132 } }],
  },
  "incline-dumbbell-curl": {
    view: LYING,
    gear: [...inclineBench(INCLINE, -50), ACROSS],
    keys: [
      // Leaning back, the arms hang straight down behind the body.
      { at: INCLINE, pitch: -50, ...feet(27), arms: { flex: -50, abduct: 6, bend: 6 } },
      { at: INCLINE, pitch: -50, ...feet(27), arms: { flex: -42, abduct: 6, bend: 136 } },
    ],
  },
  "spider-curl": {
    view: SIDE,
    gear: [...CHEST_BENCH, ACROSS],
    keys: [
      // Chest down on the bench, the arms hang straight down ahead of it.
      { ...ON_CHEST, arms: { flex: 48, abduct: 4, bend: 6 } },
      { ...ON_CHEST, arms: { flex: 52, abduct: 4, bend: 134 } },
    ],
  },
  "concentration-curl": {
    view: QUARTER,
    gear: [flatBench(-10, 6), ONE_ACROSS],
    keys: [
      {
        ...sitting(),
        ...feet(22, 15),
        lean: 44,
        nod: -8,
        armR: { flex: 56, abduct: -8, bend: 12 },
        armL: { reach: [-15, 37, 16] },
      },
      {
        ...sitting(),
        ...feet(22, 15),
        lean: 44,
        nod: -8,
        armR: { flex: 56, abduct: -8, bend: 128 },
        armL: { reach: [-15, 37, 16] },
      },
    ],
  },
  "wrist-extension": {
    view: QUARTER,
    gear: [flatBench(-8, 8), ACROSS],
    keys: [
      { ...sitting(), lean: 34, ...hands([8, 39, 31], [0.2, -1, 0.2]) },
      { ...sitting(), lean: 34, ...hands([8, 44.5, 30], [0.2, -1, 0.2]) },
    ],
  },

  // ── Triceps ──────────────────────────────────────────────────────────────────────────────
  "dumbbell-skull-crusher": {
    view: LYING,
    gear: [flatBench(), ALONG],
    keys: [
      { ...ON_BENCH, ...hands([10, 65, -24], [0.2, 0.4, 1]) },
      { ...ON_BENCH, ...hands([10, 40, -39], [0.2, 0.4, 1]) },
    ],
  },
  "single-dumbbell-skullcrusher": {
    view: LYING,
    gear: [flatBench(), ONE_ACROSS],
    keys: [
      { ...ON_BENCH, ...hands([3, 65, -24], [0.5, 0.4, 1]) },
      { ...ON_BENCH, ...hands([3, 40, -40], [0.5, 0.4, 1]) },
    ],
  },
  "dumbbell-overhead-tricep-extension": {
    view: QUARTER,
    gear: [{ kind: "dumbbells", hand: "R", along: [0, 1, 0] }],
    keys: [
      // One dumbbell in both hands: overhead, then lowered behind the head.
      { arms: { grip: [3, 31, -1], elbow: [0.4, 1, 0.5] } },
      { arms: { grip: [3, 4, -15], elbow: [0.4, 1, 0.5] } },
    ],
  },
  "single-arm-dumbbell-tricep-extension": {
    view: QUARTER,
    gear: [ONE_ALONG],
    keys: [
      {
        armR: { grip: [13, 32, 0], elbow: [0.2, 1, 0.5] },
        armL: { grip: [10, -27, 3] },
      },
      {
        armR: { grip: [6, 6, -13], elbow: [0.2, 1, 0.5] },
        armL: { grip: [10, -27, 3] },
      },
    ],
  },
  "tricep-kickback": {
    view: SIDE,
    gear: [ALONG],
    keys: [
      // The upper arms stay along the body; only the forearms swing back.
      { ...BENT, lean: 70, arms: { flex: -6, abduct: 4, bend: 96 } },
      { ...BENT, lean: 70, arms: { flex: -6, abduct: 4, bend: 4 } },
    ],
  },
};

export default family;
