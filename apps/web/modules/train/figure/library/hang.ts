/** Hanging and pulling with the body, and back work lying face down. */
import {
  BAR_HIGH,
  PRONE,
  backrest,
  dipBars,
  hands,
  post,
  pullUpBar,
  type Family,
  type Gear,
  type Pose,
  type Vec,
  type View,
} from "./kit";

// ── Under a bar ─────────────────────────────────────────────────────────────────────────────

/** A bar is seen from the front when the grip is what matters, from the side when the body is. */
const ACROSS: View = { yaw: 24 };
const ALONG: View = { yaw: 60 };

/** How high the hips are hanging at arm's length, and with the chin over the bar. */
const LOW = 64.5;
const TOP = 86;
/** Elbows out to the sides (an overhand grip), or ahead of the body (underhand, neutral). */
const OUT: Vec = [0.9, -0.4, 0.1];
const AHEAD: Vec = [0.35, -0.5, 1];
/** Legs hanging, and tucked a little as the body goes up. */
const DANGLE: Pose["legs"] = { flex: 4, bend: 20 };
const TUCK: Pose["legs"] = { flex: 8, bend: 28 };
/** Legs a little ahead of the body, as the chest lifts in an active hang. */
const ACTIVE: Pose["legs"] = { flex: 9, bend: 5 };

/**
 * A pull-up: from arm's length to the chin over the bar, hands `wide` from the middle. Seen
 * from the side the body goes up behind the bar, `back` of it; from the front it hides it.
 */
const pull = (wide: number, elbow: Vec, back = -2, high = BAR_HIGH): [Pose, Pose] => [
  { at: [0, LOW + high - BAR_HIGH, 0], legs: DANGLE, ...hands([wide, high, 0], elbow) },
  { at: [0, TOP + high - BAR_HIGH, -back], legs: TUCK, ...hands([wide, high, 0], elbow) },
];

/** A weight hung from a belt: a plate between the thighs, on a chain from the hips. */
const HUNG = { on: "hips", by: [0, -17, 2] } as const;
const BELT: Gear[] = [
  { kind: "cable", from: "hips", to: HUNG, place: "front" },
  { kind: "plate", at: HUNG, radius: 7.5, place: "front" },
];

/** The handles a neutral grip holds: two short bars across the bar, pointing ahead. */
const HANDLES: Gear[] = [-1, 1].map((side) => ({
  kind: "rail" as const,
  points: [
    [side * 12, BAR_HIGH, -8],
    [side * 12, BAR_HIGH, 8],
  ] as Vec[],
}));

/** How high the parallel bars of an L-sit are. */
const BARS = 56;

// ── Leaning back from a hold ────────────────────────────────────────────────────────────────

/** Where the feet stand to lean back and row, and the post or frame that is held. */
const HEELS: Vec = [0, 4, 6];
const ANCHOR_Z = 26;

// ── On a back extension bench ───────────────────────────────────────────────────────────────

/** The hips on the pad of a 45° bench, the legs straight down and back to its foot plate. */
const ON_PAD: Vec = [0, 44, 0];
const SLOPE = 45;
const ROMAN_CHAIR: Gear[] = [
  // The pad under the hips and the top of the thighs, and what holds it up.
  backrest(ON_PAD, SLOPE, 1, 19),
  post([0, 30, 9]),
  // The roller behind the ankles, and the foot plate.
  { kind: "plate", at: [0, 17.6, -38.4], along: [1, 0, 0], radius: 3.4, thick: 16 },
  {
    kind: "rail",
    points: [
      [0, 0.6, 9],
      [0, 0.6, -30],
      [0, 17.6, -38.4],
    ],
  },
];
/** Arms folded across the chest. */
const FOLDED: Pose["arms"] = { grip: [-3, -9, 6], elbow: [1, -0.7, 0.4] };

// ── Face down on the floor ──────────────────────────────────────────────────────────────────

/**
 * Seen from the side and a little from above: on the floor, an arm out to the side lies along
 * the same line as the body unless it is looked down on.
 */
const FLAT: View = { yaw: 76, tilt: 24 };

const family: Family = {
  "pull-up": {
    view: ACROSS,
    gear: [pullUpBar()],
    keys: pull(17, OUT),
  },
  "weighted-pull-up": {
    view: ACROSS,
    gear: [pullUpBar(), ...BELT],
    keys: pull(17, OUT),
  },
  "negative-pull-up": {
    view: ACROSS,
    // A box to step up from: the way up is not the exercise, the way down is.
    gear: [pullUpBar(), { kind: "box", at: [0, 0, -24], wide: 30, deep: 22, high: 24 }],
    keys: pull(17, OUT),
  },
  "towel-pull-up": {
    view: ACROSS,
    gear: [
      pullUpBar(BAR_HIGH + 13),
      { kind: "cable", from: [14, BAR_HIGH + 13, 0], hand: "R" },
      { kind: "cable", from: [-14, BAR_HIGH + 13, 0], hand: "L" },
    ],
    keys: pull(11, AHEAD),
  },
  "chin-up": {
    view: ALONG,
    gear: [pullUpBar()],
    keys: pull(10, AHEAD, 9),
  },
  "weighted-chin-up": {
    view: ALONG,
    gear: [pullUpBar(), ...BELT],
    keys: pull(10, AHEAD, 9),
  },
  "neutral-grip-pull-up": {
    view: { yaw: 42 },
    gear: [pullUpBar(), ...HANDLES],
    keys: pull(12, [0.6, -0.5, 0.8], 9),
  },
  "commando-pull-up": {
    view: ACROSS,
    gear: [pullUpBar()],
    // Side on to the bar, one hand in front of the other, the head coming up beside it.
    keys: [
      {
        at: [0, LOW, 0],
        face: 90,
        legs: DANGLE,
        armR: { reach: [9, BAR_HIGH, 0], elbow: [0.5, -0.6, 0.6] },
        armL: { reach: [-9, BAR_HIGH, 0], elbow: [0.5, -0.6, 0.6] },
      },
      {
        at: [0, TOP, 10],
        face: 90,
        legs: TUCK,
        armR: { reach: [9, BAR_HIGH, 0], elbow: [0.5, -0.6, 0.6] },
        armL: { reach: [-9, BAR_HIGH, 0], elbow: [0.5, -0.6, 0.6] },
      },
    ],
  },
  "l-sit-pull-up": {
    view: ALONG,
    gear: [pullUpBar()],
    keys: [
      { at: [0, LOW, 0], legs: { flex: 90, bend: 2 }, ...hands([16, BAR_HIGH, 0], OUT) },
      { at: [0, TOP, -9], legs: { flex: 90, bend: 2 }, ...hands([16, BAR_HIGH, 0], OUT) },
    ],
  },
  "dead-hang": {
    view: ACROSS,
    gear: [pullUpBar()],
    // A hold: all the way down, the head between the arms.
    keys: [
      { at: [0, 63.8, 0], nod: 6, legs: { flex: 2, bend: 6 }, ...hands([17, BAR_HIGH, 0], AHEAD) },
      { at: [0, 64.4, 0], nod: 6, legs: { flex: 3, bend: 8 }, ...hands([17, BAR_HIGH, 0], AHEAD) },
    ],
  },
  "active-hang": {
    view: ALONG,
    gear: [pullUpBar()],
    // A hold: the shoulders drawn down and the chest lifted, under arms that stay straight.
    keys: [
      { at: [0, 64.2, 0], lean: -12, legs: ACTIVE, ...hands([16, BAR_HIGH, 0], OUT) },
      { at: [0, 64.6, 0], lean: -13, legs: ACTIVE, ...hands([16, BAR_HIGH, 0], OUT) },
    ],
  },
  "scapular-pull-up": {
    view: ALONG,
    gear: [pullUpBar()],
    // From the dead hang to the active one and back.
    keys: [
      { at: [0, 63.9, 0], lean: 0, legs: { flex: 2, bend: 6 }, ...hands([16, BAR_HIGH, 0], OUT) },
      { at: [0, 64.8, 0], lean: -15, legs: ACTIVE, ...hands([16, BAR_HIGH, 0], OUT) },
    ],
  },
  "hanging-knee-raise": {
    view: ALONG,
    gear: [pullUpBar()],
    keys: [
      { at: [0, LOW, 0], legs: { flex: 4, bend: 8 }, ...hands([16, BAR_HIGH, 0], OUT) },
      {
        at: [0, LOW, -2],
        lean: 8,
        legs: { flex: 98, bend: 104 },
        ...hands([16, BAR_HIGH, 0], OUT),
      },
    ],
  },
  "hanging-leg-raise": {
    view: ALONG,
    gear: [pullUpBar()],
    keys: [
      { at: [0, LOW, 0], legs: { flex: 4, bend: 4 }, ...hands([16, BAR_HIGH, 0], OUT) },
      { at: [0, LOW, -3], lean: 6, legs: { flex: 94, bend: 4 }, ...hands([16, BAR_HIGH, 0], OUT) },
    ],
  },
  "l-sit-hold": {
    view: { yaw: 66 },
    // On parallel bars, the arms straight, the legs held out level.
    gear: dipBars(BARS),
    keys: [
      {
        at: [0, BARS + 3.6, 0],
        legs: { flex: 88, bend: 2 },
        ...hands([15, BARS, 1], [0.2, 0, -1]),
      },
      {
        at: [0, BARS + 4.2, 0],
        legs: { flex: 91, bend: 2 },
        ...hands([15, BARS, 1], [0.2, 0, -1]),
      },
    ],
  },
  "inverted-row": {
    view: { yaw: 70 },
    gear: [{ kind: "bar", high: 56, z: -16 }],
    // Under a low bar, the body a plank on its heels, the chest coming up to the bar.
    keys: [
      {
        pin: { what: "ankles", to: [0, 4, 46] },
        pitch: -74,
        ...hands([17, 56, -16], [0.9, -0.2, -0.5]),
      },
      {
        pin: { what: "ankles", to: [0, 4, 46] },
        pitch: -54,
        ...hands([17, 56, -16], [0.9, -0.2, -0.5]),
      },
    ],
  },
  "towel-row": {
    view: { yaw: 70 },
    gear: [post([0, 112, ANCHOR_Z]), { kind: "cable", from: [0, 88, ANCHOR_Z], each: true }],
    // Leaning back from a towel round a post, the body a plank on its heels.
    keys: [
      {
        pin: { what: "ankles", to: HEELS },
        pitch: -34,
        arms: { grip: [9, -3, 31], elbow: [0.6, -0.4, -1] },
      },
      {
        pin: { what: "ankles", to: HEELS },
        pitch: -14,
        arms: { grip: [10, -10, 9], elbow: [0.6, -0.4, -1] },
      },
    ],
  },
  "doorway-row": {
    view: { yaw: 58 },
    // A door frame, a hand on either side of it, the feet at its foot.
    gear: [{ kind: "bar", high: 124, z: ANCHOR_Z, wide: 46 }],
    keys: [
      {
        pin: { what: "ankles", to: [0, 4, ANCHOR_Z - 6] },
        pitch: -19,
        ...hands([23, 76, ANCHOR_Z], [0.9, -0.3, -0.6]),
      },
      {
        pin: { what: "ankles", to: [0, 4, ANCHOR_Z - 6] },
        pitch: -5,
        ...hands([23, 76, ANCHOR_Z], [0.9, -0.3, -0.6]),
      },
    ],
  },
  "back-extension": {
    view: { yaw: 72 },
    gear: ROMAN_CHAIR,
    keys: [
      { at: ON_PAD, pitch: SLOPE, lean: 72, nod: -10, arms: FOLDED },
      { at: ON_PAD, pitch: SLOPE, lean: 0, nod: -10, arms: FOLDED },
    ],
  },
  "glute-focused-back-extension": {
    view: { yaw: 72 },
    gear: ROMAN_CHAIR,
    // The chin tucked and the back rounded: a shorter way up, stopping short of straight.
    keys: [
      { at: ON_PAD, pitch: SLOPE, lean: 78, nod: 34, legs: { abduct: 10 }, arms: FOLDED },
      { at: ON_PAD, pitch: SLOPE, lean: 16, nod: 34, legs: { abduct: 10 }, arms: FOLDED },
    ],
  },
  "nordic-hamstring-curl": {
    view: { yaw: 74 },
    gear: [
      // What holds the ankles down.
      { kind: "plate", at: [0, 12, -23], along: [1, 0, 0], radius: 3.4, thick: 16 },
      post([0, 12, -29]),
    ],
    keys: [
      {
        pin: { what: "knees", to: [0, 4.2, 0] },
        pitch: 4,
        legs: { bend: 86 },
        arms: { flex: 30, bend: 118 },
      },
      {
        pin: { what: "knees", to: [0, 4.2, 0] },
        pitch: 62,
        legs: { bend: 28 },
        nod: -14,
        arms: { flex: 56, bend: 96 },
      },
    ],
  },
  "prone-y-raise": {
    view: FLAT,
    keys: [
      { ...PRONE, arms: { abduct: 150, flex: 0 } },
      { ...PRONE, lean: -6, nod: -24, arms: { abduct: 150, flex: -26 } },
    ],
  },
  "prone-t-raise": {
    view: FLAT,
    keys: [
      { ...PRONE, arms: { abduct: 90, flex: 0 } },
      { ...PRONE, lean: -6, nod: -24, arms: { abduct: 90, flex: -26 } },
    ],
  },
  "reverse-snow-angel": {
    view: FLAT,
    // Arms held off the floor, swept from overhead down to the hips.
    keys: [
      { ...PRONE, lean: -5, nod: -24, arms: { abduct: 168, flex: -14 } },
      { ...PRONE, lean: -5, nod: -24, arms: { abduct: 14, flex: -14 } },
    ],
  },
  superman: {
    view: { yaw: 76 },
    keys: [
      { ...PRONE, nod: -30, arms: { abduct: 172, flex: 0 }, legs: { flex: 0 } },
      { ...PRONE, lean: -10, nod: -30, arms: { abduct: 172, flex: -20 }, legs: { flex: -17 } },
    ],
  },
  "superman-hold": {
    view: { yaw: 76 },
    keys: [
      { ...PRONE, lean: -9, nod: -29, arms: { abduct: 172, flex: -18 }, legs: { flex: -15 } },
      { ...PRONE, lean: -10, nod: -30, arms: { abduct: 172, flex: -20 }, legs: { flex: -17 } },
    ],
  },
};

export default family;
