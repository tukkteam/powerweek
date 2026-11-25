/** Machines: a seat, pads and a lever or a stack, laid out from the pieces in kit.ts. */
import {
  BENCH_HIGH,
  FRONT,
  QUARTER,
  REST,
  SIDE,
  backrest,
  dipBars,
  feet,
  flatBench,
  hands,
  hanging,
  post,
  pullUpBar,
  seatPad,
  sitting,
  smith,
  type Exercise,
  type Family,
  type Gear,
  type Pose,
  type Vec,
} from "./kit";

type Anchor = NonNullable<Extract<Gear, { kind: "plate" }>["at"]>;

// ── One maker's range ───────────────────────────────────────────────────────────────────────
// Every machine here is the same few things: pads the body rests on, a post, a weight stack,
// and the one part that moves, fixed to a joint so that it follows.

/** Where the hips are on a seat low enough for the feet to stand on the floor. */
const LOW: Vec = [0, BENCH_HIGH + REST, 0];
/** And on a seat high enough for the legs to swing free. */
const SEAT: Vec = [0, BENCH_HIGH + 6 + REST, 0];

/** The weight stack. */
const stack = (z: number, place?: "back"): Gear => ({
  kind: "box",
  at: [0, 0, z],
  wide: 14,
  deep: 9,
  high: 62,
  place,
});
/** A seat with a back that leans `lean`, on its post. */
const chair = (at: Vec, lean: number, long = 36): Gear[] => [
  seatPad(at, 19),
  backrest(at, lean, long),
  post([0, at[1] - 9, at[2] + 4]),
];
/** The round pad a limb pushes against. */
const roller = (at: Anchor, place: "back" | "front" = "front"): Gear => ({
  kind: "plate",
  at,
  along: [1, 0, 0],
  radius: 3.6,
  thick: 16,
  place,
});
/** The arm of a machine: from where it turns to the joint that moves it. */
const lever = (pivot: Vec, to: Anchor): Gear => ({ kind: "rail", points: [pivot, to] });
/** A plate on a machine loaded with plates, seen from its side. */
const load = (at: Vec): Gear => ({ kind: "plate", at, along: [1, 0, 0], radius: 8, place: "back" });

/** The pads either side of the knees that the thighs open or close. */
const KNEE_PADS: Gear[] = (["kneeL", "kneeR"] as const).map((at) => ({
  kind: "plate",
  at,
  along: [1, 0, 0],
  radius: 5.6,
  thick: 17,
  place: "back",
}));

/** Hands resting on the grips beside a seat. */
const BY_SEAT: Pose["arms"] = { grip: [10, -30, 4] };

// ── Kneeling on the pad of an assisted station ──────────────────────────────────────────────

/** Shins level behind the knees; the toes, which carry the pad, just under them. */
const KNEELING: Pose["legs"] = { flex: 0, bend: 90, point: -38 };
/** The pad the knees and shins ride on, the arm that lifts it and the stack behind. */
const kneePad = (z: number): Gear[] => [
  { kind: "pad", from: "toeL", to: "toeR", wide: 38 },
  { kind: "rail", points: [[0, 0.6, z], [0, 40, z], "toes"] },
  stack(z - 9),
];

// ── A leg press ─────────────────────────────────────────────────────────────────────────────

const PRESS: Vec = [0, 16, 0];
/** The way the sled runs: up and away. */
const SLED: Vec = [0, 0.707, 0.707];
const LEG_PRESS: Gear[] = [
  seatPad(PRESS, 5),
  backrest(PRESS, -50, 36),
  post([0, 34, -32]),
  // The plate the feet push, which follows them, and the track it runs on.
  { kind: "plate", at: "toes", along: SLED, radius: 12, thick: 6, place: "back" },
  {
    kind: "rail",
    points: [
      [0, 14, 30],
      [0, 62, 78],
      [0, 0.6, 78],
    ],
  },
];
const pressed = (out: number): Pose => ({
  at: PRESS,
  lean: -50,
  nod: 24,
  legs: { plant: [8, 34 + out, 22 + out], knee: [0.2, 1, 0.3], point: 0 },
  legL: { plant: [-8, 34 + out, 22 + out] },
  arms: { grip: [11, -30, 3] },
});

// ── Calf raises: the toes on a block, the heels free ────────────────────────────────────────

const BLOCK: Gear = { kind: "box", at: [0, 0, 8], wide: 34, deep: 12, high: 8, place: "back" };
const ON_BLOCK: Pose["pin"] = { what: "toes", to: [0, 10, 14] };
/** Standing flat on it, and up on the toes. */
const HEELS_DOWN: Pose["legs"] = { point: 14 };
const HEELS_UP: Pose["legs"] = { point: 58 };

// ── Leg curls ───────────────────────────────────────────────────────────────────────────────

const LYING: Vec = [0, BENCH_HIGH + REST, 0];
const LYING_CURL: Exercise = {
  view: { yaw: 70 },
  gear: [flatBench(-19, 40), stack(66), lever([0, LYING[1] - 3, -23], "ankles"), roller("ankles")],
  keys: [
    {
      at: LYING,
      pitch: 90,
      nod: -18,
      legs: { bend: 4 },
      ...hands([14, 19, 34], [1, 0, -0.3]),
    },
    {
      at: LYING,
      pitch: 90,
      nod: -18,
      legs: { bend: 116 },
      ...hands([14, 19, 34], [1, 0, -0.3]),
    },
  ],
};

// ── The Smith machine: the barbell lifts of barbell.ts, the bar on its rails ────────────────

const BAR: Gear = { kind: "barbell" };
const ON_BACK: Pose["arms"] = { grip: [15, 1.5, -5] };
const UNDER: Vec = [0.8, -0.5, -0.4];
/** A stride: the near foot ahead, the far one behind on its toes. */
const AHEAD: Pose["legR"] = { plant: [5, 4, 18], knee: [0.1, 0.2, 1] };
const BEHIND: Pose["legL"] = { plant: [-5, 7, -24], knee: [0, -0.5, 1] };

const family: Family = {
  // ── Seated, pushing and pulling ──────────────────────────────────────────────────────────
  "machine-chest-press": {
    view: SIDE,
    gear: [
      ...chair(LOW, -8),
      stack(-27),
      lever([0, 104, 8], "hands"),
      { kind: "handle", wide: 36 },
    ],
    keys: [
      { ...sitting(), lean: -8, ...hands([17, 57, 8], [1, -0.2, -0.5]) },
      { ...sitting(), lean: -8, ...hands([17, 57, 27], [1, -0.2, -0.5]) },
    ],
  },
  "machine-shoulder-press": {
    view: QUARTER,
    gear: [
      ...chair(LOW, -6),
      stack(-27),
      lever([0, 72, -24], "handR"),
      lever([0, 72, -24], "handL"),
    ],
    keys: [
      { ...sitting(), lean: -6, ...hands([18, 66, 3], [1, -0.6, 0]) },
      { ...sitting(), lean: -6, ...hands([15, 92, 0], [1, -0.6, 0]) },
    ],
  },
  "machine-lateral-raise": {
    view: { yaw: 30 },
    gear: [
      ...chair(LOW, -4),
      stack(-27),
      // The pads the elbows lift.
      { kind: "plate", at: "elbowR", radius: 4.8, thick: 8, place: "front" },
      { kind: "plate", at: "elbowL", radius: 4.8, thick: 8, place: "front" },
    ],
    keys: [
      { ...sitting(), lean: -4, arms: { abduct: 12, bend: 80 } },
      { ...sitting(), lean: -4, arms: { abduct: 84, bend: 80 } },
    ],
  },
  "pec-deck": {
    view: QUARTER,
    gear: [
      ...chair(LOW, -6),
      stack(-27),
      lever([0, 64, -22], "handR"),
      lever([0, 64, -22], "handL"),
    ],
    keys: [
      { ...sitting(), lean: -6, arms: { abduct: 90, flex: -4, bend: 16 } },
      { ...sitting(), lean: -6, arms: { abduct: 90, flex: 98, bend: 16 } },
    ],
  },
  "reverse-pec-deck": {
    view: QUARTER,
    gear: [
      seatPad(LOW, 19),
      backrest(LOW, 6, 36),
      post([0, LOW[1] - 9, 4]),
      stack(27, "back"),
      lever([0, 64, 22], "handR"),
      lever([0, 64, 22], "handL"),
    ],
    keys: [
      { ...sitting(), lean: 6, arms: { abduct: 90, flex: 94, bend: 10 } },
      { ...sitting(), lean: 6, arms: { abduct: 90, flex: -12, bend: 10 } },
    ],
  },
  "machine-row": {
    view: SIDE,
    gear: [
      seatPad(LOW, 19),
      post([0, LOW[1] - 9, 4]),
      // The pad the chest leans on.
      { kind: "pad", from: [0, 42, 10], to: [0, 68, 10] },
      post([0, 42, 10]),
      stack(50),
      lever([0, 98, 44], "hands"),
      { kind: "handle", wide: 32 },
    ],
    keys: [
      { ...sitting(), lean: 4, ...hands([13, 58, 34], [0.5, -0.3, -1]) },
      { ...sitting(), lean: 4, ...hands([13, 55, 11], [0.5, -0.3, -1]) },
    ],
  },
  "preacher-curl": {
    view: SIDE,
    gear: [
      seatPad(LOW, 12),
      post([0, LOW[1] - 9, 2]),
      // The sloping pad the upper arms lie on.
      { kind: "pad", from: [0, 51, 7], to: [0, 37.7, 21.6] },
      post([0, 40, 17]),
      stack(52),
      lever([0, 49, 19.5], "hands"),
      { kind: "handle", wide: 32 },
    ],
    keys: [
      { ...sitting(), lean: 14, arms: { flex: 62, abduct: 2, bend: 14 } },
      { ...sitting(), lean: 14, arms: { flex: 62, abduct: 2, bend: 122 } },
    ],
  },
  "t-bar-row": {
    view: SIDE,
    gear: [{ kind: "landmine", pivot: [0, 1.2, -56], plate: 3, plates: 2, place: "among" }],
    keys: [
      { lean: 56, legs: { flex: 34, bend: 42 }, arms: hanging(56, 6) },
      {
        lean: 56,
        legs: { flex: 34, bend: 42 },
        arms: { grip: [6, -23, 6], elbow: [0.6, 0.1, -1] },
      },
    ],
  },
  "chest-supported-row": {
    view: SIDE,
    gear: [
      backrest([0, 36, 0], 52, 33, 3),
      post([0, 30, 8]),
      post([0, 44, 30]),
      { kind: "landmine", pivot: [0, 3, -44], plate: 3, place: "among" },
    ],
    keys: [
      {
        at: [0, 36, 0],
        pitch: 52,
        nod: -24,
        legs: { plant: [6, 4, -30], knee: [0.1, -0.2, 1] },
        legL: { plant: [-6, 4, -30] },
        arms: hanging(52, 8),
      },
      {
        at: [0, 36, 0],
        pitch: 52,
        nod: -24,
        legs: { plant: [6, 4, -30], knee: [0.1, -0.2, 1] },
        legL: { plant: [-6, 4, -30] },
        arms: { grip: [8, -20, 7], elbow: [0.7, 0.1, -1] },
      },
    ],
  },

  // ── Seated, for the legs ─────────────────────────────────────────────────────────────────
  "leg-extension": {
    view: SIDE,
    gear: [
      ...chair(SEAT, -14),
      stack(-24),
      // The lever turns about the knees and carries the roller the shins push against.
      lever([0, SEAT[1] - 6, 21], "ankles"),
      roller("ankles"),
    ],
    keys: [
      { at: SEAT, lean: -14, legs: { flex: 88, bend: 96 }, arms: BY_SEAT },
      { at: SEAT, lean: -14, legs: { flex: 88, bend: 8 }, arms: BY_SEAT },
    ],
  },
  "seated-leg-curl": {
    view: SIDE,
    gear: [
      ...chair(SEAT, -14),
      stack(-24),
      // The pad that holds the thighs down.
      { kind: "pad", from: [0, SEAT[1] + 7, 9], to: [0, SEAT[1] + 7, 21], thick: 4 },
      lever([0, SEAT[1] - 6, 21], "ankles"),
      roller("ankles"),
    ],
    keys: [
      { at: SEAT, lean: -14, legs: { flex: 88, bend: 8 }, arms: BY_SEAT },
      { at: SEAT, lean: -14, legs: { flex: 88, bend: 104 }, arms: BY_SEAT },
    ],
  },
  "leg-curl": LYING_CURL,
  "lying-leg-curl": LYING_CURL,
  "hip-abduction-machine": {
    view: FRONT,
    gear: [...chair(SEAT, -18), stack(-24), ...KNEE_PADS],
    keys: [
      {
        at: SEAT,
        lean: -18,
        legs: { plant: [5, 16, 23], knee: [0.2, 0.7, 1] },
        legL: { plant: [-5, 16, 23] },
        arms: BY_SEAT,
      },
      {
        at: SEAT,
        lean: -18,
        legs: { plant: [23, 16, 17], knee: [1, 0.7, 1] },
        legL: { plant: [-23, 16, 17] },
        arms: BY_SEAT,
      },
    ],
  },
  "hip-adduction-machine": {
    view: FRONT,
    gear: [...chair(SEAT, -18), stack(-24), ...KNEE_PADS],
    keys: [
      {
        at: SEAT,
        lean: -18,
        legs: { plant: [27, 16, 14], knee: [1, 0.7, 1] },
        legL: { plant: [-27, 16, 14] },
        arms: BY_SEAT,
      },
      {
        at: SEAT,
        lean: -18,
        legs: { plant: [6, 16, 23], knee: [0.2, 0.7, 1] },
        legL: { plant: [-6, 16, 23] },
        arms: BY_SEAT,
      },
    ],
  },
  "seated-calf-raise": {
    view: SIDE,
    gear: [
      seatPad(LOW, 12),
      post([0, LOW[1] - 9, 2]),
      { kind: "box", at: [0, 0, 30], wide: 30, deep: 10, high: 6, place: "back" },
      // The pad on the knees, on an arm loaded with a plate.
      roller("knees"),
      { kind: "rail", points: ["knees", [0, 34, 54], [0, 0.6, 54]] },
      load([0, 37, 47]),
    ],
    keys: [
      {
        at: LOW,
        lean: 6,
        legs: { plant: [7, 8, 21] },
        legL: { plant: [-7, 8, 21] },
        arms: { grip: [9, -22, 17] },
      },
      {
        at: LOW,
        lean: 6,
        legs: { plant: [7, 14.5, 21] },
        legL: { plant: [-7, 14.5, 21] },
        arms: { grip: [9, -22, 17] },
      },
    ],
  },

  // ── Leg press and hack squat ─────────────────────────────────────────────────────────────
  "leg-press": {
    view: SIDE,
    gear: LEG_PRESS,
    keys: [pressed(11), pressed(0)],
  },
  "leg-press-calf-raise": {
    view: SIDE,
    gear: LEG_PRESS,
    keys: [pressed(10.5), pressed(13.5)],
  },
  "hack-squat": {
    view: SIDE,
    gear: [
      // The back pad the body slides with, drawn the whole length of its run.
      backrest([0, 36, 0], -32, 62, 5),
      post([0, 74, -44]),
      // The plate the feet stand on, square to the run.
      { kind: "pad", from: [0, 6.5, 9], to: [0, 17, 26], wide: 26 },
    ],
    keys: [
      {
        at: [0, 53, -10.6],
        pitch: -32,
        legs: { plant: [8, 17, 14] },
        legL: { plant: [-8, 17, 14] },
        arms: { grip: [15, 3, 5], elbow: [0.5, -1, 0.3] },
      },
      {
        at: [0, 36, 0],
        pitch: -32,
        legs: { plant: [8, 17, 14] },
        legL: { plant: [-8, 17, 14] },
        arms: { grip: [15, 3, 5], elbow: [0.5, -1, 0.3] },
      },
    ],
  },
  "belt-squat": {
    view: SIDE,
    gear: [
      { kind: "box", at: [0, 0, 0], wide: 44, deep: 34, high: 10, place: "back" },
      // The belt round the hips pulls on an arm under the platform, loaded with a plate.
      { kind: "cable", from: "hips", to: [0, 10, -6], place: "among" },
      {
        kind: "rail",
        points: [
          [0, 4, 14],
          [0, 6, 48],
        ],
      },
      load([0, 8, 42]),
      post([0, 70, 30]),
      { kind: "handle", wide: 26 },
    ],
    keys: [
      { pin: { what: "ankles", to: [0, 14, 0] }, lean: 6, ...hands([10, 70, 28]) },
      {
        pin: { what: "ankles", to: [0, 14, 0] },
        lean: 28,
        legs: { flex: 96, bend: 108 },
        ...hands([10, 70, 28]),
      },
    ],
  },

  // ── Calf raises ──────────────────────────────────────────────────────────────────────────
  "standing-calf-raise": {
    view: SIDE,
    gear: [
      BLOCK,
      stack(-42),
      // The arm that rests on the shoulders.
      { kind: "rail", points: [[0, 0.6, -33], [0, 84, -33], "shoulders"] },
    ],
    keys: [
      { pin: ON_BLOCK, legs: HEELS_DOWN, arms: { grip: [12, 2, 7], elbow: [0.4, -1, 0] } },
      { pin: ON_BLOCK, legs: HEELS_UP, arms: { grip: [12, 2, 7], elbow: [0.4, -1, 0] } },
    ],
  },
  "donkey-calf-raise": {
    view: SIDE,
    gear: [
      BLOCK,
      stack(-42),
      // The arm that rests on the hips, and the pad the forearms lean on.
      { kind: "rail", points: [[0, 0.6, -33], [0, 72, -33], "hips"] },
      { kind: "plate", at: "hips", along: [1, 0, 0], radius: 7, thick: 18, place: "back" },
      { kind: "pad", from: [0, 38, 42], to: [0, 38, 58] },
      post([0, 36, 50]),
    ],
    keys: [
      {
        pin: ON_BLOCK,
        lean: 80,
        nod: -30,
        legs: HEELS_DOWN,
        ...hands([11, 44, 52], [0.2, -1, -0.3]),
      },
      {
        pin: ON_BLOCK,
        lean: 80,
        nod: -30,
        legs: HEELS_UP,
        ...hands([11, 44, 52], [0.2, -1, -0.3]),
      },
    ],
  },

  // ── Lying and leaning ────────────────────────────────────────────────────────────────────
  "reverse-hyperextension": {
    view: { yaw: 70 },
    gear: [
      flatBench(3, 44, 52),
      // The arm the legs swing, with its plate.
      lever([0, 50, 4], "ankles"),
      roller("ankles"),
    ],
    keys: [
      {
        at: [0, 57, 0],
        pitch: 90,
        nod: -18,
        legs: { flex: 76, bend: 4 },
        ...hands([13, 42, 40], [1, 0, -0.3]),
      },
      {
        at: [0, 57, 0],
        pitch: 90,
        nod: -18,
        legs: { flex: -8, bend: 4 },
        ...hands([13, 42, 40], [1, 0, -0.3]),
      },
    ],
  },
  "machine-glute-kickback": {
    view: SIDE,
    gear: [
      stack(-34),
      lever([0, 50, -8], "ankleR"),
      roller("ankleR"),
      post([0, 66, 38]),
      { kind: "handle", wide: 26 },
    ],
    keys: [
      {
        pin: { what: "ankleL", to: [-4.25, 4, 0] },
        lean: 40,
        legL: { flex: 14, bend: 16 },
        legR: { flex: 52, bend: 100 },
        ...hands([11, 66, 38]),
      },
      {
        pin: { what: "ankleL", to: [-4.25, 4, 0] },
        lean: 40,
        legL: { flex: 14, bend: 16 },
        legR: { flex: -30, bend: 14 },
        ...hands([11, 66, 38]),
      },
    ],
  },
  "captains-chair-knee-raise": {
    view: { yaw: 60 },
    gear: [
      backrest([0, 64, 0], 0, 34),
      // The pads the forearms rest on, and the frame that carries them.
      ...[-1, 1].flatMap((side): Gear[] => [
        { kind: "pad", from: [side * 14, 70, -3], to: [side * 14, 70, 17], wide: 8 },
        {
          kind: "rail",
          points: [
            [side * 14, 0.6, -10],
            [side * 14, 70, -10],
            [side * 14, 70, -3],
          ],
        },
      ]),
    ],
    keys: [
      { at: [0, 64, 0], legs: { flex: 4, bend: 6 }, arms: { abduct: 4, bend: 90 } },
      { at: [0, 64, 0], legs: { flex: 96, bend: 100 }, arms: { abduct: 4, bend: 90 } },
    ],
  },

  // ── Assisted: kneeling on a pad that takes some of the weight ────────────────────────────
  "assisted-pull-up": {
    view: { yaw: 34 },
    gear: [pullUpBar(), ...kneePad(-30)],
    keys: [
      { at: [0, 64.5, 0], legs: KNEELING, ...hands([17, 126, 0], [0.9, -0.4, 0.1]) },
      { at: [0, 86, 2], legs: KNEELING, ...hands([17, 126, 0], [0.9, -0.4, 0.1]) },
    ],
  },
  "assisted-chin-up": {
    view: { yaw: 34 },
    gear: [pullUpBar(), ...kneePad(-30)],
    keys: [
      { at: [0, 64.5, 0], legs: KNEELING, ...hands([11, 126, 0], [0.6, -0.7, 0.6]) },
      { at: [0, 86, 2], legs: KNEELING, ...hands([11, 126, 0], [0.6, -0.7, 0.6]) },
    ],
  },
  "assisted-dip": {
    view: { yaw: 52 },
    gear: [...dipBars(), ...kneePad(-30)],
    keys: [
      { at: [0, 61.5, 0], legs: KNEELING, ...hands([15, 58, 0], [0.3, 0.2, -1]) },
      { at: [0, 47, -4], lean: 18, legs: KNEELING, ...hands([15, 58, 0], [0.3, 0.2, -1]) },
    ],
  },

  // ── The Smith machine ────────────────────────────────────────────────────────────────────
  "smith-machine-squat": {
    view: SIDE,
    gear: [...smith(-2.4), BAR],
    keys: [
      { pin: { what: "ankles", to: [0, 4, 0] }, lean: 4, arms: ON_BACK },
      // Halfway down, leaning as far as keeps the bar on its rails.
      {
        pin: { what: "ankles", to: [0, 4, 0] },
        lean: 36,
        legs: { flex: 50, bend: 56 },
        arms: ON_BACK,
      },
      {
        pin: { what: "ankles", to: [0, 4, 0] },
        lean: 40,
        legs: { flex: 100, bend: 112 },
        arms: ON_BACK,
      },
    ],
  },
  "smith-machine-bench-press": {
    view: { yaw: 64 },
    gear: [flatBench(), ...smith(-18), BAR],
    keys: [
      { at: [0, 32, 6], pitch: -90, nod: 13, ...feet(34), ...hands([17, 64, -18], UNDER) },
      { at: [0, 32, 6], pitch: -90, nod: 13, ...feet(34), ...hands([17, 43, -18], UNDER) },
    ],
  },
  "smith-machine-romanian-deadlift": {
    view: SIDE,
    gear: [...smith(5), BAR],
    keys: [
      { lean: 2, ...hands([14, 46.5, 5], [0.3, 0, -1]) },
      { lean: 64, legs: { flex: 26, bend: 34 }, ...hands([14, 29, 5], [0.3, 0, -1]) },
    ],
  },
  "smith-machine-hip-thrust": {
    view: { yaw: 70 },
    gear: [
      { kind: "bench", from: [-26, 0, -31], to: [26, 0, -31] },
      ...smith(-1),
      { kind: "barbell", at: "hips" },
    ],
    keys: [
      { at: [0, 13, -2], pitch: -48, ...feet(27), arms: { grip: [15, -25, 5] } },
      { at: [0, 30, 0], pitch: -88, ...feet(27), arms: { grip: [15, -25, 5] } },
    ],
  },
  "smith-machine-split-squat": {
    view: SIDE,
    gear: [...smith(-3), BAR],
    keys: [
      { at: [0, 44, 0], lean: 4, legR: AHEAD, legL: BEHIND, arms: ON_BACK },
      { at: [0, 27, 0], lean: 4, legR: AHEAD, legL: BEHIND, arms: ON_BACK },
    ],
  },
  "smith-machine-reverse-lunge": {
    view: SIDE,
    gear: [...smith(-3), BAR],
    keys: [
      {
        at: [0, 47.5, 0],
        lean: 4,
        legR: { plant: [5, 4, 12], knee: [0.1, 0.2, 1] },
        legL: { plant: [-5, 4, 12], knee: [0, -0.5, 1] },
        arms: ON_BACK,
      },
      {
        at: [0, 28, 0],
        lean: 4,
        legR: { plant: [5, 4, 12], knee: [0.1, 0.2, 1] },
        legL: BEHIND,
        arms: ON_BACK,
      },
    ],
  },
  "smith-machine-bulgarian-split-squat": {
    view: SIDE,
    gear: [{ kind: "bench", from: [-20, 0, -38], to: [20, 0, -38] }, ...smith(-3), BAR],
    keys: [
      {
        at: [0, 44, 0],
        lean: 4,
        legR: AHEAD,
        legL: { plant: [-5, 31, -34], knee: [0, -0.5, 1] },
        arms: ON_BACK,
      },
      {
        at: [0, 27, 0],
        lean: 4,
        legR: AHEAD,
        legL: { plant: [-5, 31, -34], knee: [0, -0.5, 1] },
        arms: ON_BACK,
      },
    ],
  },
};

export default family;
