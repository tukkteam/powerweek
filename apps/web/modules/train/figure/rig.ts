/**
 * The mannequin's skeleton. A pose is a handful of joint angles, in the words a trainer would
 * use (hip flexion, elbow bend, how far the torso leans); from them this works out where every
 * joint is in space. Nothing here draws: see scene.ts.
 *
 * Space is the gym floor: x to the figure's right, y up from the floor, z the way the figure
 * faces when it stands at ease. Lengths are in units where the figure stands 100 tall. Angles
 * are in degrees.
 */

export type Vec = readonly [number, number, number];
type Mat = readonly [Vec, Vec, Vec];

export const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const times = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const size = (a: Vec): number => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: Vec): Vec => {
  const n = size(a);
  return n ? times(a, 1 / n) : [0, 1, 0];
};
export const mix = (a: Vec, b: Vec, t: number): Vec => add(times(a, 1 - t), times(b, t));
export const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const rad = (degrees: number) => (degrees * Math.PI) / 180;
/** Turns about x: a positive angle tips "up" (y) towards "forward" (z). */
const rotX = (a: number): Mat => {
  const c = Math.cos(rad(a));
  const s = Math.sin(rad(a));
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
};
/** Turns about y: a positive angle swings "forward" (z) towards the figure's right (x). */
const rotY = (a: number): Mat => {
  const c = Math.cos(rad(a));
  const s = Math.sin(rad(a));
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
};
/** Turns about z: a positive angle tips "down" (-y) out towards the figure's right (x). */
const rotZ = (a: number): Mat => {
  const c = Math.cos(rad(a));
  const s = Math.sin(rad(a));
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
};
const mul = (a: Mat, b: Mat): Mat => {
  const col = (j: number): Vec => [b[0][j]!, b[1][j]!, b[2][j]!];
  return [0, 1, 2].map((i) => [0, 1, 2].map((j) => dot(a[i]!, col(j)))) as unknown as Mat;
};
const turn = (m: Mat, v: Vec): Vec => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const chain = (...ms: Mat[]): Mat => ms.reduce(mul);

/**
 * The figure's measurements. They are those of the standard pictorial figure of safety signs
 * (the unit system of ISO 3864-3, Annex A, as set out in the AEM pictorial guidelines): 12 units
 * tall, a trunk 2 units wide, a round head 1.75 units across that does not touch the body, and
 * limbs 1 unit wide that end in half circles, with pivots at shoulder, elbow, hand, hip, knee
 * and foot. Two legs side by side are as wide as the trunk, so one carries on into the other.
 * Here a unit is 100 / 12, so the figure stands 100 tall.
 */
export const UNIT = 100 / 12;
export const BODY = {
  /** Hip pivots up to shoulder pivots. The trunk reaches half a unit past each. */
  spine: 3.5 * UNIT,
  /** Half the head's width, and the gap between the head and the trunk. */
  head: (1.75 * UNIT) / 2,
  headGap: 0.25 * UNIT,
  /** Half the trunk's width; from front to back it is as thick as a limb. */
  trunk: UNIT,
  /** How far past its pivots the trunk reaches, top and bottom. */
  trunkEnd: 0.5 * UNIT,
  /** Shoulder pivots sit outside the trunk: the arms are bars beside it, not part of it. */
  shoulder: 1.56 * UNIT,
  /** Hip pivots: the legs side by side fill the trunk's width. */
  hip: 0.51 * UNIT,
  upperArm: 2 * UNIT,
  forearm: 2 * UNIT,
  thigh: 2.75 * UNIT,
  shin: 2.75 * UNIT,
  /** Half the width of an arm and of a leg. A foot pivot stands this far off the floor. */
  arm: 0.44 * UNIT,
  leg: 0.48 * UNIT,
  /** For a pointed foot's toes, which a pose may pin; the figure has no feet to draw. */
  foot: UNIT,
} as const;

/** An arm: by its angles, or told what to hold (`reach`, a point in space). */
export interface Arm {
  /** Raised forward: 0 hangs by the side, 90 points ahead, 180 is overhead. */
  flex?: number;
  /** Raised out to the side. */
  abduct?: number;
  /** Turned about its own length, which changes the way the elbow bends. */
  rotate?: number;
  /** Elbow: 0 is straight. */
  bend?: number;
  /** Put the hand here instead, bending the elbow as needed. */
  reach?: Vec;
  /**
   * Or here, measured from the base of the neck in the torso's own terms: out to the side, up
   * along the spine, forward of the chest. For hands on a bar across the shoulders, on the hips.
   */
  grip?: Vec;
  /**
   * With `reach` or `grip`: the way the elbow points, in the torso's terms (out, up, forward).
   * Default: back and down, a little out.
   */
  elbow?: Vec;
}

/** A leg: by its angles, or told where to stand (`plant`, where the ankle goes). */
export interface Leg {
  /** Thigh raised forward: 90 is level, as when sitting. */
  flex?: number;
  /** Thigh out to the side. */
  abduct?: number;
  /** Knee: 0 is straight. */
  bend?: number;
  /** Toes pointed down from the shin, for a foot off the floor. Left out, the foot lies flat. */
  point?: number;
  /** Put the ankle here instead, bending the knee as needed. */
  plant?: Vec;
  /** With `plant`: the way the knee points, in the hips' terms (out, up, forward). */
  knee?: Vec;
}

export interface Pose {
  /**
   * Where the hips are. Left out, the figure stands where its feet put it: ankles either side
   * of the origin, on the floor.
   */
  at?: Vec;
  /**
   * Or: hold the middle of these (or one joint, by its name) still at a point, and let the hips
   * fall where they must.
   */
  pin?: { what: "ankles" | "toes" | "hands" | "knees" | Joint; to: Vec };
  /** The whole body turned to face another way (about the vertical). */
  face?: number;
  /** The whole body tipped forward (90 lies face down) or back (-90 lies face up). */
  pitch?: number;
  /** The whole body rolled onto its side. */
  roll?: number;
  /** The torso leaning forward from the hips, sideways, and twisting. */
  lean?: number;
  side?: number;
  twist?: number;
  /** The head, nodding forward. */
  nod?: number;
  /** Both arms, both legs; `armL` and the rest override one side. */
  arms?: Arm;
  armL?: Arm;
  armR?: Arm;
  legs?: Leg;
  legL?: Leg;
  legR?: Leg;
}

export const JOINTS = [
  "pelvis",
  "chest",
  "head",
  "shoulderL",
  "shoulderR",
  "elbowL",
  "elbowR",
  "wristL",
  "wristR",
  "handL",
  "handR",
  "hipL",
  "hipR",
  "kneeL",
  "kneeR",
  "ankleL",
  "ankleR",
  "toeL",
  "toeR",
] as const;
export type Joint = (typeof JOINTS)[number];
export type Skeleton = Record<Joint, Vec>;

/**
 * Where a two-part limb bends to put its end on `target`: the middle joint, and the end (which
 * stops short if the target is out of reach). `towards` is the way the middle joint points.
 */
export function bendTo(from: Vec, target: Vec, a: number, b: number, towards: Vec) {
  const line = sub(target, from);
  const far = Math.min(Math.max(size(line), Math.abs(a - b) + 0.01), a + b - 0.01);
  const along = unit(line);
  // How far along the line the middle joint sits, and how far off it.
  const run = (a * a - b * b + far * far) / (2 * far);
  const rise = Math.sqrt(Math.max(0, a * a - run * run));
  const off = sub(towards, times(along, dot(towards, along)));
  // Pointing straight along the limb gives no side to bend to; pick one.
  const out = size(off) > 1e-6 ? unit(off) : unit([along[1], -along[0], 0.001]);
  return {
    middle: add(add(from, times(along, run)), times(out, rise)),
    end: add(from, times(along, far)),
  };
}

const DOWN: Vec = [0, -1, 0];
/** How far above the floor the middle of the front of a flat foot is. */
const SOLE = 2;
const middleOf = (a: Vec, b: Vec): Vec => times(add(a, b), 0.5);

/** Where every joint is, for a pose. */
export function skeleton(pose: Pose): Skeleton {
  const body = chain(rotY(pose.face ?? 0), rotX(pose.pitch ?? 0), rotZ(pose.roll ?? 0));
  const torso = chain(body, rotX(pose.lean ?? 0), rotZ(pose.side ?? 0), rotY(pose.twist ?? 0));
  const origin: Vec = [0, 0, 0];
  const chest = turn(torso, [0, BODY.spine, 0]);
  const skull = chain(torso, rotX(pose.nod ?? 0));
  const head = add(chest, turn(skull, [0, BODY.trunkEnd + BODY.headGap + BODY.head, 0]));
  const joints: Partial<Record<Joint, Vec>> = { pelvis: origin, chest, head };

  // Legs by their angles (planted legs are solved once the body is in place). A flat foot points
  // the way the body faces, its toes a little lower than the ankle, on the floor.
  const flatFoot: Vec = add(times(turn(rotY(pose.face ?? 0), [0, 0, 1]), BODY.foot), [
    0,
    -(BODY.leg - SOLE),
    0,
  ]);
  const footOf = (leg: Leg, shinWay: Vec, pointed: Vec): Vec =>
    leg.point === undefined ? flatFoot : times(leg.plant ? shinWay : pointed, BODY.foot);
  const legOf = (side: "L" | "R") => ({ ...pose.legs, ...(side === "L" ? pose.legL : pose.legR) });
  const armOf = (side: "L" | "R") => ({ ...pose.arms, ...(side === "L" ? pose.armL : pose.armR) });
  for (const side of ["L", "R"] as const) {
    const sign = side === "R" ? 1 : -1;
    const leg = legOf(side);
    const hip = turn(body, [sign * BODY.hip, 0, 0]);
    const thigh = chain(body, rotZ(sign * (leg.abduct ?? 0)), rotX(-(leg.flex ?? 0)));
    const knee = add(hip, turn(thigh, times(DOWN, BODY.thigh)));
    const shin = chain(thigh, rotX(leg.bend ?? 0));
    const ankle = add(knee, turn(shin, times(DOWN, BODY.shin)));
    const foot = footOf(leg, [0, -1, 0], turn(chain(shin, rotX(leg.point ?? 0)), [0, 0, 1]));
    joints[`hip${side}`] = hip;
    joints[`knee${side}`] = knee;
    joints[`ankle${side}`] = ankle;
    joints[`toe${side}`] = add(ankle, foot);

    const arm = armOf(side);
    const shoulder = add(chest, turn(torso, [sign * BODY.shoulder, 0, 0]));
    const upper = chain(
      torso,
      rotZ(sign * (arm.abduct ?? 0)),
      rotX(-(arm.flex ?? 0)),
      rotY(sign * (arm.rotate ?? 0)),
    );
    const elbow = add(shoulder, turn(upper, times(DOWN, BODY.upperArm)));
    const lower = chain(upper, rotX(-(arm.bend ?? 0)));
    const wrist = add(elbow, turn(lower, times(DOWN, BODY.forearm)));
    joints[`shoulder${side}`] = shoulder;
    joints[`elbow${side}`] = elbow;
    joints[`wrist${side}`] = wrist;
    // The hand is the end of the arm: there is nothing past the wrist to draw.
    joints[`hand${side}`] = wrist;
  }

  // Put the body where it belongs: at a point, pinned by a pair of joints, or standing.
  const s = joints as Skeleton;
  let shift: Vec;
  if (pose.at) shift = pose.at;
  else if (pose.pin) {
    const pair = { ankles: "ankle", toes: "toe", hands: "hand", knees: "knee" } as const;
    const { what } = pose.pin;
    // The middle of a pair of joints, or one joint: the foot a lunge turns on, say.
    const held =
      what in pair
        ? middleOf(
            s[`${pair[what as keyof typeof pair]}L`],
            s[`${pair[what as keyof typeof pair]}R`],
          )
        : s[what as Joint];
    shift = sub(pose.pin.to, held);
  } else {
    // Standing: the lower foot on the floor, the ankles either side of the origin.
    const between = middleOf(s.ankleL, s.ankleR);
    const lowest = Math.min(
      s.ankleL[1] - BODY.leg,
      s.ankleR[1] - BODY.leg,
      s.toeL[1] - SOLE,
      s.toeR[1] - SOLE,
    );
    shift = [-between[0], -lowest, -between[2]];
  }
  for (const name of JOINTS) s[name] = add(s[name], shift);

  // Limbs told where to go.
  for (const side of ["L", "R"] as const) {
    const sign = side === "R" ? 1 : -1;
    const arm = armOf(side);
    const target = arm.grip
      ? add(s.chest, turn(torso, [sign * arm.grip[0], arm.grip[1], arm.grip[2]]))
      : arm.reach;
    if (target) {
      const pole = arm.elbow ?? [0.35, -0.6, -0.75];
      const towards = turn(torso, [sign * pole[0], pole[1], pole[2]]);
      const { middle, end } = bendTo(
        s[`shoulder${side}`],
        target,
        BODY.upperArm,
        BODY.forearm,
        towards,
      );
      s[`elbow${side}`] = middle;
      s[`wrist${side}`] = end;
      s[`hand${side}`] = end;
    }
    const leg = legOf(side);
    if (leg.plant) {
      const pole = leg.knee ?? [0.1, 0.2, 1];
      const towards = turn(body, [sign * pole[0], pole[1], pole[2]]);
      const { middle, end } = bendTo(s[`hip${side}`], leg.plant, BODY.thigh, BODY.shin, towards);
      s[`knee${side}`] = middle;
      s[`ankle${side}`] = end;
      s[`toe${side}`] = add(end, footOf(leg, unit(sub(end, middle)), [0, 0, 1]));
    }
  }
  return s;
}

const blend = (a: number | undefined, b: number | undefined, t: number) =>
  a === undefined && b === undefined ? undefined : (a ?? 0) * (1 - t) + (b ?? 0) * t;
const blendVec = (a: Vec | undefined, b: Vec | undefined, t: number) =>
  a && b ? mix(a, b, t) : (b ?? a);

function between<T extends Arm | Leg>(
  a: T | undefined,
  b: T | undefined,
  t: number,
): T | undefined {
  if (!a && !b) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
    const x = (a as Record<string, unknown> | undefined)?.[key];
    const y = (b as Record<string, unknown> | undefined)?.[key];
    out[key] =
      Array.isArray(x) || Array.isArray(y)
        ? blendVec(x as Vec | undefined, y as Vec | undefined, t)
        : blend(x as number | undefined, y as number | undefined, t);
  }
  return out as T;
}

/**
 * The pose part of the way from one to another. Angles are blended, not positions, so a limb
 * swings round its joint instead of shrinking through the middle. Each limb is blended whole,
 * whichever of `arms` or `armL` a pose used to say it.
 */
export function blendPose(a: Pose, b: Pose, t: number): Pose {
  const arm = (pose: Pose, side: "L" | "R"): Arm => ({
    ...pose.arms,
    ...(side === "L" ? pose.armL : pose.armR),
  });
  const leg = (pose: Pose, side: "L" | "R"): Leg => ({
    ...pose.legs,
    ...(side === "L" ? pose.legL : pose.legR),
  });
  return {
    at: blendVec(a.at, b.at, t),
    pin: a.pin && b.pin ? { what: b.pin.what, to: mix(a.pin.to, b.pin.to, t) } : (b.pin ?? a.pin),
    face: blend(a.face, b.face, t),
    pitch: blend(a.pitch, b.pitch, t),
    roll: blend(a.roll, b.roll, t),
    lean: blend(a.lean, b.lean, t),
    side: blend(a.side, b.side, t),
    twist: blend(a.twist, b.twist, t),
    nod: blend(a.nod, b.nod, t),
    armL: between(arm(a, "L"), arm(b, "L"), t),
    armR: between(arm(a, "R"), arm(b, "R"), t),
    legL: between(leg(a, "L"), leg(b, "L"), t),
    legR: between(leg(a, "R"), leg(b, "R"), t),
  };
}
