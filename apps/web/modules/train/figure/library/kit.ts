/**
 * What exercises are laid out with: the usual views, the usual places a body is put (on a
 * bench, on the floor, on a seat) and gear that is several pieces together (an incline bench,
 * a cable column). An exercise in this folder is a view, some gear and key poses; start from
 * the one most like it.
 *
 * Space: x to the figure's right, y up from the floor, z the way it faces. The figure stands
 * 100 tall. Lying on its back (`pitch: -90`) its head is towards -z; face down (`pitch: 90`)
 * towards +z.
 */
import type { Exercise } from "../exercise";
import { BODY, type Pose, type Vec } from "../rig";
import type { Gear, View } from "../scene";

export type { Exercise, Gear, Pose, Vec, View };
export type Family = Readonly<Record<string, Exercise>>;

// ── Views ───────────────────────────────────────────────────────────────────────────────────

/** From the side, a little from the front: most lifts, and anything that folds at the hips. */
export const SIDE: View = { yaw: 68 };
/** Nearly face on: anything where the arms or legs move out to the sides. */
export const FRONT: View = { yaw: 18 };
/** Between the two: when both the reach forward and the width matter. */
export const QUARTER: View = { yaw: 42 };
/** Nearly square from the side: floor work, where the body is one long line. */
export const PROFILE: View = { yaw: 78 };

// ── Where a body is put ─────────────────────────────────────────────────────────────────────

/** How far the middle of a body lying down, or the hips of one sitting, is above what holds it. */
export const REST = BODY.leg + 1;
/** The usual heights: the top of a bench or a seat, a bar to hang from. */
export const BENCH_HIGH = 27;
export const BAR_HIGH = 126;

/** The feet flat on the floor, `wide` apart, `ahead` of the origin: for `legs` and `legL`. */
export const feet = (ahead: number, wide = 9): Pick<Pose, "legs" | "legL"> => ({
  legs: { plant: [wide, 4, ahead] },
  legL: { plant: [-wide, 4, ahead] },
});

/** Both hands on a point `wide` apart: for `arms` and `armL`. Add `elbow` to taste. */
export const hands = ([x, y, z]: Vec, elbow?: Vec): Pick<Pose, "arms" | "armL"> => ({
  arms: elbow ? { reach: [x, y, z], elbow } : { reach: [x, y, z] },
  armL: { reach: [-x, y, z] },
});

/** Lying on a flat bench (`flatBench`), feet on the floor. */
export const ON_BENCH: Pose = { at: [0, BENCH_HIGH + REST, 6], pitch: -90, ...feet(34) };
/** Lying on the floor, face up. Head towards -z. */
export const SUPINE: Pose = { at: [0, REST, 0], pitch: -90 };
/** Lying on the floor, face down. Head towards +z. */
export const PRONE: Pose = { at: [0, REST, 0], pitch: 90 };
/** Sitting on a seat or a bench `high` (hips over the origin), feet on the floor ahead. */
export const sitting = (high = BENCH_HIGH, z = 0): Pose => ({
  at: [0, high + REST, z],
  ...feet(z + 23, 7),
});
/** Hanging from a bar at `BAR_HIGH`, arms straight. */
export const HANGING: Pose = {
  at: [0, 64.5, 0],
  ...hands([17, BAR_HIGH, 0], [0.9, -0.4, 0.1]),
};

// ── Gear in several pieces ──────────────────────────────────────────────────────────────────

/** A flat bench along the way the figure faces, for lying on (`ON_BENCH`) or sitting across. */
export const flatBench = (from = -43, to = 11, high = BENCH_HIGH): Gear => ({
  kind: "bench",
  from: [0, 0, from],
  to: [0, 0, to],
  high,
});

/**
 * The pad behind a body whose hips are at `at`, leaning `pitch` (0 upright, -90 flat on its
 * back, 90 face down on it): the back of a seat, the slope of an incline bench. It runs from
 * `below` the hips to `long` up the spine.
 */
export function backrest(at: Vec, pitch: number, long = 40, below = 2): Gear {
  const a = (pitch * Math.PI) / 180;
  // Up the spine, and out of the back (or out of the chest, face down).
  const up: Vec = [0, Math.cos(a), Math.sin(a)];
  const out: Vec = pitch > 0 ? [0, -Math.sin(a), Math.cos(a)] : [0, Math.sin(a), -Math.cos(a)];
  const off = BODY.leg + 3.2;
  const along = (d: number): Vec => [
    at[0],
    at[1] + out[1] * off + up[1] * d,
    at[2] + out[2] * off + up[2] * d,
  ];
  return { kind: "pad", from: along(-below), to: along(long) };
}

/** The pad a sitter's thighs rest on: hips at `at`, `long` towards the knees. */
export const seatPad = (at: Vec, long = 17): Gear => ({
  kind: "pad",
  from: [at[0], at[1] - BODY.leg - 3.2, at[2] - 5],
  to: [at[0], at[1] - BODY.leg - 3.2, at[2] + long],
});

/** A post from the floor up to a point: what holds a seat or a pad up. */
export const post = ([x, y, z]: Vec): Gear => ({
  kind: "rail",
  points: [
    [x, 0.6, z],
    [x, y, z],
  ],
});

/**
 * An adjustable bench set for a body with its hips at `at`, leaning `pitch` back (-90 is flat):
 * a seat, a back and what holds them up. Sit or lie with `{ at, pitch }`.
 */
export function inclineBench(at: Vec, pitch: number): Gear[] {
  const back = backrest(at, pitch);
  const seat = seatPad(at, 14);
  const top = (back as Extract<Gear, { kind: "pad" }>).to as Vec;
  return [
    seat,
    back,
    post([at[0], at[1] - BODY.leg - 4.5, at[2] + 6]),
    post([at[0], top[1] - 5, top[2] + 6]),
  ];
}

/** A seat `high` with its hips at z, and a back if `pitch` is given (0 is upright). */
export function seat(high = BENCH_HIGH, z = 0, pitch?: number): Gear[] {
  const at: Vec = [0, high + REST, z];
  return [
    seatPad(at),
    ...(pitch === undefined ? [] : [backrest(at, pitch, 34)]),
    post([0, high - 3, z + 4]),
  ];
}

/**
 * The column of a cable machine at `z`, with its pulley `high`: draw the cable from `pulley`
 * to the hands (`{ kind: "cable", from: pulley }`).
 */
export function cableColumn(z: number, high: number, top = 132) {
  const pulley: Vec = [0, high, z];
  const gear: Gear[] = [
    {
      kind: "rail",
      points: [
        [0, 0.6, z],
        [0, top, z],
      ],
    },
    { kind: "box", at: [0, 0, z - 9], wide: 12, deep: 8, high: 46 },
  ];
  return { pulley, gear };
}

/** A bar to hang from, with its posts. */
export const pullUpBar = (high = BAR_HIGH): Gear => ({ kind: "bar", high });

/** The two rails of a dip station, at `high`, either side of the figure. */
export function dipBars(high = 56, wide = 15): Gear[] {
  return [-1, 1].map((side) => ({
    kind: "rail" as const,
    points: [
      [side * wide, 0.6, -12],
      [side * wide, high, -12],
      [side * wide, high, 14],
    ] as Vec[],
  }));
}

/** A wall at `z`, as high as it needs to be. */
export const wall = (z: number, high = 124): Gear => ({
  kind: "rail",
  points: [
    [0, 0.6, z],
    [0, high, z],
  ],
});

/** The two uprights a Smith machine's bar runs on, at `z`. Add `{ kind: "barbell" }`. */
export function smith(z = 0, high = 128): Gear[] {
  return [-1, 1].map((side) => ({
    kind: "rail" as const,
    points: [
      [side * 33, 0.6, z],
      [side * 33, high, z],
    ] as Vec[],
  }));
}
