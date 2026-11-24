/**
 * The exercises the mannequin knows, by the slug of the move (see moves-data.ts). An exercise
 * is a layout: where it is seen from, the gear it uses, and two or three key poses. The loop
 * goes from the first pose to the last and back.
 *
 * To add one: copy the exercise most like it and change the angles. Space is x to the figure's
 * right, y up from the floor, z the way it faces; the figure stands 100 tall. Look at the result
 * on /es/dev/figure.
 */
import { blendPose, type Pose } from "./rig";
import { frame, type Gear, type View } from "./scene";

export interface Exercise {
  /** Where it is seen from. The framing (zoom, position) is worked out from the poses. */
  view: View;
  gear?: readonly Gear[];
  keys: readonly [Pose, Pose, ...Pose[]];
}

/** Seen from the side, a little from the front and above: most lifts read best this way. */
const SIDE: View = { yaw: 68 };
/** Seen nearly face on: for anything where the arms move out to the sides. */
const FRONT: View = { yaw: 18 };

export const EXERCISES: Readonly<Record<string, Exercise>> = {
  squat: {
    view: SIDE,
    gear: [{ kind: "barbell" }],
    keys: [
      { lean: 4, arms: { grip: [15, 1.5, -5] } },
      { lean: 40, legs: { flex: 100, bend: 112 }, arms: { grip: [15, 1.5, -5] } },
    ],
  },
  deadlift: {
    view: SIDE,
    gear: [{ kind: "barbell" }],
    keys: [
      { lean: 2, arms: { reach: [13, 45, 8] }, armL: { reach: [-13, 45, 8] } },
      {
        lean: 62,
        nod: -25,
        legs: { flex: 62, bend: 58 },
        arms: { reach: [13, 21, 12] },
        armL: { reach: [-13, 21, 12] },
      },
    ],
  },
  "bench-press": {
    view: { yaw: 64 },
    gear: [{ kind: "bench", from: [0, 0, -43], to: [0, 0, 11] }, { kind: "barbell" }],
    keys: [
      {
        at: [0, 32, 6],
        pitch: -90,
        legs: { plant: [10, 3.6, 34] },
        legL: { plant: [-10, 3.6, 34] },
        arms: { reach: [17, 65, -19], elbow: [0.8, -0.5, -0.4] },
        armL: { reach: [-17, 65, -19] },
      },
      {
        at: [0, 32, 6],
        pitch: -90,
        legs: { plant: [10, 3.6, 34] },
        legL: { plant: [-10, 3.6, 34] },
        arms: { reach: [17, 43, -17], elbow: [0.8, -0.5, -0.4] },
        armL: { reach: [-17, 43, -17] },
      },
    ],
  },
  "overhead-press": {
    view: FRONT,
    gear: [{ kind: "barbell" }],
    keys: [
      { arms: { grip: [14, 1, 7], elbow: [0.5, -0.8, 0.2] } },
      { arms: { grip: [13, 31, 1], elbow: [0.9, -0.3, 0.1] } },
    ],
  },
  "bicep-curl": {
    view: { yaw: 58 },
    gear: [{ kind: "dumbbells" }],
    keys: [{ arms: { flex: 2, abduct: 5, bend: 6 } }, { arms: { flex: 14, abduct: 5, bend: 140 } }],
  },
  "lateral-raise": {
    view: FRONT,
    gear: [{ kind: "dumbbells", along: [0, 0, 1] }],
    keys: [{ arms: { abduct: 9, bend: 12 } }, { arms: { abduct: 88, flex: 8, bend: 14 } }],
  },
  "push-up": {
    view: { yaw: 78 },
    keys: [
      {
        pitch: 66,
        nod: -24,
        pin: { what: "toes", to: [0, 2, -50] },
        legs: { point: 62 },
        arms: { reach: [12, 1.6, 22], elbow: [0.6, -0.2, -0.8] },
        armL: { reach: [-12, 1.6, 22] },
      },
      {
        pitch: 83,
        nod: -30,
        pin: { what: "toes", to: [0, 2, -50] },
        legs: { point: 78 },
        arms: { reach: [12, 1.6, 22], elbow: [0.6, -0.2, -0.8] },
        armL: { reach: [-12, 1.6, 22] },
      },
    ],
  },
  "pull-up": {
    view: { yaw: 24 },
    gear: [{ kind: "bar", high: 126 }],
    keys: [
      {
        at: [0, 62, 0],
        legs: { flex: 4, bend: 22, point: 30 },
        arms: { reach: [16, 126, 0], elbow: [0.9, -0.4, 0.1] },
        armL: { reach: [-16, 126, 0] },
      },
      {
        at: [0, 88, 2],
        legs: { flex: 8, bend: 30, point: 30 },
        arms: { reach: [16, 126, 0], elbow: [0.9, -0.4, 0.1] },
        armL: { reach: [-16, 126, 0] },
      },
    ],
  },
  plank: {
    view: { yaw: 78 },
    keys: [
      {
        pitch: 80,
        nod: -22,
        pin: { what: "toes", to: [0, 2, -50] },
        legs: { point: 74 },
        arms: { reach: [9, 2, 43], elbow: [0.2, -0.3, 1] },
        armL: { reach: [-9, 2, 43] },
      },
      {
        pitch: 81.2,
        nod: -22,
        pin: { what: "toes", to: [0, 2, -50] },
        legs: { point: 75 },
        arms: { reach: [9, 2, 43], elbow: [0.2, -0.3, 1] },
        armL: { reach: [-9, 2, 43] },
      },
    ],
  },
  "hanging-knee-raise": {
    view: { yaw: 60 },
    gear: [{ kind: "bar", high: 126 }],
    keys: [
      {
        at: [0, 62, 0],
        legs: { flex: 4, bend: 8, point: 32 },
        arms: { reach: [15, 126, 0], elbow: [0.9, -0.4, 0.1] },
        armL: { reach: [-15, 126, 0] },
      },
      {
        at: [0, 62, -2],
        lean: 8,
        legs: { flex: 98, bend: 104, point: 20 },
        arms: { reach: [15, 126, 0], elbow: [0.9, -0.4, 0.1] },
        armL: { reach: [-15, 126, 0] },
      },
    ],
  },
  "kettlebell-swing": {
    view: SIDE,
    gear: [{ kind: "kettlebell" }],
    keys: [
      { lean: 58, nod: -30, legs: { flex: 58, bend: 42 }, arms: { flex: 22, abduct: -9, bend: 4 } },
      { lean: -3, legs: { flex: 0, bend: 0 }, arms: { flex: 88, abduct: -9, bend: 4 } },
    ],
  },
  "lat-pulldown": {
    view: { yaw: 52 },
    gear: [
      { kind: "bench", from: [0, 0, -9], to: [0, 0, 9], high: 28 },
      {
        kind: "rail",
        points: [
          [0, 0, -26],
          [0, 132, -26],
          [0, 132, 4],
        ],
      },
      { kind: "cable", from: [0, 132, 4] },
      { kind: "handle", wide: 48 },
    ],
    keys: [
      {
        at: [0, 33, 0],
        lean: -4,
        legs: { plant: [8, 3.6, 22] },
        legL: { plant: [-8, 3.6, 22] },
        arms: { reach: [21, 95, 4], elbow: [0.9, -0.5, -0.1] },
        armL: { reach: [-21, 95, 4] },
      },
      {
        at: [0, 33, 0],
        lean: -12,
        legs: { plant: [8, 3.6, 22] },
        legL: { plant: [-8, 3.6, 22] },
        arms: { reach: [18, 67, 5], elbow: [0.9, -0.5, -0.1] },
        armL: { reach: [-18, 67, 5] },
      },
    ],
  },
};

/** Whether the mannequin knows this move. */
export const hasFigure = (slug: string | undefined): slug is string =>
  Boolean(slug && EXERCISES[slug]);

/**
 * The pose at a point in the loop. `phase` runs from 0 to 1: out from the first key to the last
 * over the first half, back over the second, resting a moment at either end. `eased` shapes the
 * journey (slow out of a rest, slow into the next).
 */
export function poseAt(exercise: Exercise, phase: number, eased: (t: number) => number): Pose {
  const { keys } = exercise;
  const there = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  const REST = 0.14;
  const moving = Math.min(1, Math.max(0, (there - REST) / (1 - 2 * REST)));
  const along = eased(moving) * (keys.length - 1);
  const from = Math.min(keys.length - 2, Math.floor(along));
  return blendPose(keys[from]!, keys[from + 1]!, along - from);
}

const framed = new WeakMap<Exercise, View>();
/** The view an exercise is drawn from, framed to fit everything it does. */
export function viewOf(exercise: Exercise): View {
  let view = framed.get(exercise);
  if (!view) {
    // The key poses and the poses halfway between them.
    const poses = exercise.keys.flatMap((key, i) =>
      i ? [blendPose(exercise.keys[i - 1]!, key, 0.5), key] : [key],
    );
    view = frame(poses, exercise.gear ?? [], exercise.view);
    framed.set(exercise, view);
  }
  return view;
}
