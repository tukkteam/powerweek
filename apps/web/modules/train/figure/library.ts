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
      { lean: 2, arms: { reach: [14, 47, 7] }, armL: { reach: [-14, 47, 7] } },
      {
        lean: 62,
        legs: { flex: 62, bend: 58 },
        arms: { reach: [14, 21, 12] },
        armL: { reach: [-14, 21, 12] },
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
        legs: { plant: [9, 4, 34] },
        legL: { plant: [-9, 4, 34] },
        arms: { reach: [17, 64, -19], elbow: [0.8, -0.5, -0.4] },
        armL: { reach: [-17, 64, -19] },
      },
      {
        at: [0, 32, 6],
        pitch: -90,
        legs: { plant: [9, 4, 34] },
        legL: { plant: [-9, 4, 34] },
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
    view: { yaw: 72 },
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
        pin: { what: "ankles", to: [0, 4, -50] },
        arms: { reach: [14, 3.7, 20], elbow: [0.6, -0.2, -0.8] },
        armL: { reach: [-14, 3.7, 20] },
      },
      {
        pitch: 82,
        pin: { what: "ankles", to: [0, 4, -50] },
        arms: { reach: [14, 3.7, 20], elbow: [0.6, -0.2, -0.8] },
        armL: { reach: [-14, 3.7, 20] },
      },
    ],
  },
  "pull-up": {
    view: { yaw: 24 },
    gear: [{ kind: "bar", high: 126 }],
    keys: [
      {
        at: [0, 64.5, 0],
        legs: { flex: 4, bend: 20 },
        arms: { reach: [17, 126, 0], elbow: [0.9, -0.4, 0.1] },
        armL: { reach: [-17, 126, 0] },
      },
      {
        at: [0, 86, 2],
        legs: { flex: 8, bend: 28 },
        arms: { reach: [17, 126, 0], elbow: [0.9, -0.4, 0.1] },
        armL: { reach: [-17, 126, 0] },
      },
    ],
  },
  plank: {
    view: { yaw: 78 },
    keys: [
      {
        pitch: 78.5,
        pin: { what: "ankles", to: [0, 4, -50] },
        arms: { reach: [13, 3.7, 40], elbow: [0.1, -0.3, 1] },
        armL: { reach: [-13, 3.7, 40] },
      },
      {
        pitch: 79.5,
        pin: { what: "ankles", to: [0, 4, -50] },
        arms: { reach: [13, 3.7, 40], elbow: [0.1, -0.3, 1] },
        armL: { reach: [-13, 3.7, 40] },
      },
    ],
  },
  "hanging-knee-raise": {
    view: { yaw: 60 },
    gear: [{ kind: "bar", high: 126 }],
    keys: [
      {
        at: [0, 64.5, 0],
        legs: { flex: 4, bend: 8 },
        arms: { reach: [16, 126, 0], elbow: [0.9, -0.4, 0.1] },
        armL: { reach: [-16, 126, 0] },
      },
      {
        at: [0, 64.5, -2],
        lean: 8,
        legs: { flex: 98, bend: 104 },
        arms: { reach: [16, 126, 0], elbow: [0.9, -0.4, 0.1] },
        armL: { reach: [-16, 126, 0] },
      },
    ],
  },
  "kettlebell-swing": {
    view: SIDE,
    gear: [{ kind: "kettlebell" }],
    keys: [
      { lean: 58, legs: { flex: 58, bend: 42 }, arms: { flex: 22, abduct: -18, bend: 4 } },
      { lean: -3, legs: { flex: 0, bend: 0 }, arms: { flex: 88, abduct: -18, bend: 4 } },
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
        legs: { plant: [7, 4, 23] },
        legL: { plant: [-7, 4, 23] },
        arms: { reach: [21, 93, 4], elbow: [0.9, -0.5, -0.1] },
        armL: { reach: [-21, 93, 4] },
      },
      {
        at: [0, 33, 0],
        lean: -12,
        legs: { plant: [7, 4, 23] },
        legL: { plant: [-7, 4, 23] },
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
