/**
 * What must hold for an exercise to be drawn well, all the way round its loop: used by the
 * tests, and by `pnpm figure`, which prints what is wrong with the exercises it draws.
 */
import { poseAt, viewOf, type Exercise } from "./exercise";
import { BODY, skeleton, type Arm, type Leg, type Pose } from "./rig";
import { CANVAS, draw, project } from "./scene";

/** How a pose is put in place, and how each of its limbs is posed. */
function ways(pose: Pose): string {
  const arm = (one: Arm | undefined) => (one?.reach ? "reach" : one?.grip ? "grip" : "angles");
  const leg = (one: Leg | undefined) => (one?.plant ? "plant" : "angles");
  return [
    pose.at ? "at" : pose.pin ? `pin ${pose.pin.what}` : "standing",
    `armL ${arm({ ...pose.arms, ...pose.armL })}`,
    `armR ${arm({ ...pose.arms, ...pose.armR })}`,
    `legL ${leg({ ...pose.legs, ...pose.legL })}`,
    `legR ${leg({ ...pose.legs, ...pose.legR })}`,
  ].join(", ");
}

/** Everything wrong with an exercise, in words. Empty when it is sound. */
export function problems(exercise: Exercise, eased: (t: number) => number = (t) => t): string[] {
  const found = new Set<string>();
  // Poses are blended field by field, so a limb held by `reach` in one key and by angles in
  // the next is held by `reach` all the way: it would not move as either key says.
  const first = ways(exercise.keys[0]);
  exercise.keys.forEach((key, k) => {
    if (ways(key) !== first)
      found.add(`key ${k + 1} is posed another way than key 1 (${ways(key)} / ${first})`);
  });
  const view = viewOf(exercise);
  const gear = exercise.gear ?? [];
  let parts = -1;
  for (let phase = 0; phase < 1; phase += 0.05) {
    const pose = poseAt(exercise, phase, eased);
    const s = skeleton(pose);
    for (const [name, joint] of Object.entries(s)) {
      if (!joint.every(Number.isFinite)) found.add(`${name} is nowhere`);
      // A limb is as thick as it is: its joints stay that far above the floor, near enough.
      const least = name === "head" ? BODY.head - 1.5 : name.startsWith("toe") ? -0.5 : 2;
      if (joint[1] < least) found.add(`${name} goes through the floor`);
      const [x, y] = project(joint, view);
      if (!(x > 2 && x < CANVAS - 2 && y > 2 && y < CANVAS - 2))
        found.add(`${name} is off the canvas`);
    }
    const drawing = draw(pose, gear, view);
    if (parts < 0) parts = drawing.parts.length;
    if (drawing.parts.length !== parts) found.add("the number of parts changes as it moves");
    for (const part of drawing.parts)
      if (/NaN|undefined|Infinity/.test(part.shape + part.lines + part.halo))
        found.add("a part has no shape");
  }
  return [...found];
}
