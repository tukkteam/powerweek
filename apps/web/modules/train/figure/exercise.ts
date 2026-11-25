/**
 * An exercise, as the mannequin performs it: a layout of where it is seen from, the gear it
 * uses and two or more key poses. The loop goes from the first pose to the last and back.
 */
import { blendPose, type Pose } from "./rig";
import { frame, type Gear, type View } from "./scene";

export interface Exercise {
  /** Where it is seen from. The framing (zoom, position) is worked out from the poses. */
  view: View;
  gear?: readonly Gear[];
  keys: readonly [Pose, Pose, ...Pose[]];
}

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
