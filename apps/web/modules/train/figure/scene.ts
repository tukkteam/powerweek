/**
 * Draws the mannequin and its gear. A scene is a figure in a pose, the gear it uses and where
 * it is seen from; this turns it into parts, back to front, which `Figure` paints in the
 * current colour.
 *
 * The figure is a silhouette: a head, a trunk and limbs, with nothing drawn on them. Depth is
 * shown the way pictograms show it: limbs on the far side are dimmer, and every part is set off
 * by a thin gap from whatever lies behind it.
 */
import { CANVAS, FLOOR, disc, hull, limb, n, project, type Point, type View } from "./canvas";
import { LINE, drawGear, flatReachOf, reachOf, type Gear, type Limb, type Piece } from "./gear";
import {
  BODY,
  cross,
  add,
  size,
  skeleton,
  sub,
  times,
  unit,
  type Pose,
  type Skeleton,
  type Vec,
} from "./rig";

export { CANVAS, GAP, project, type View } from "./canvas";
export { nearer, type Anchor, type Gear } from "./gear";

// ── The figure ──────────────────────────────────────────────────────────────────────────────

/** The trunk's corners are rounded by an edge this thick drawn round it. */
const CORNER = 2.2;

/**
 * The trunk: a slab as wide as two legs and as thick as one, from the hips to half a unit above
 * the shoulders, seen from wherever the view is. Its top is square and follows the shoulders.
 * At the hips it is wrapped round the round tops of the two legs: standing, the legs carry
 * straight on from it; bent over, the hip is a curve and not a corner.
 */
function trunk(s: Skeleton, P: (p: Vec) => Point, zoom: number): string {
  const up = unit(sub(s.chest, s.pelvis));
  const inset = CORNER / 2;
  const across = unit(sub(s.shoulderR, s.shoulderL));
  const ahead = cross(across, up);
  const top = add(s.chest, times(up, BODY.trunkEnd - inset));
  const points: Point[] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      points.push(
        P(
          add(
            add(top, times(across, sx * (BODY.trunk - inset))),
            times(ahead, sz * (BODY.leg - inset)),
          ),
        ),
      );
  const round = (BODY.leg - inset) * zoom;
  for (const hip of [P(s.hipL), P(s.hipR)])
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * 2 * Math.PI;
      points.push([hip[0] + Math.cos(a) * round, hip[1] + Math.sin(a) * round, 0]);
    }
  return hull(points);
}

/**
 * How much further away than the middle of the body a shoulder or a hip must be for its limb to
 * count as on the far side. Seen nearly face on, neither arm and neither leg is.
 */
const FAR = { arm: 6.5, leg: 2.6 } as const;

/**
 * One part of the picture: of the figure (the head, the trunk, an arm or a leg) or of its gear
 * (a plate, a bench, the lines of a rack). Every part is set off, by the same thin gap, from
 * whatever lies behind it.
 */
export interface Part {
  /** Its shape, to fill, and to stroke `edge` thick (which is what rounds the trunk's corners). */
  shape: string;
  edge: number;
  /** Its lines, to stroke `lineWidth` thick: the bar of a barbell, the posts of a rack. */
  lines: string;
  /** What is cleared, a gap's width larger all round, from everything behind this part. */
  halo: string;
  /** What it is, which sets how bright: the figure, a limb on its far side (dimmer), gear. */
  tone: "body" | "far" | "gear";
}

export interface Drawing {
  /**
   * Everything in the picture, from what is furthest back to what is in front. An exercise has
   * the same number of parts all the way round its loop; which is in front of which may change.
   */
  parts: readonly Part[];
  /** How thick gear lines are, and the floor line. */
  lineWidth: number;
  floor: string;
}

/** A scene, drawn. */
export function draw(pose: Pose, gear: readonly Gear[], view: View): Drawing {
  const s = skeleton(pose);
  const zoom = view.zoom ?? 1;
  const P = (p: Vec) => project(p, view);
  const at = (name: keyof Skeleton) => P(s[name]);

  const pieces = drawGear(gear, s, view);
  const ofGear = (piece: Piece): Part => ({
    shape: piece.solids,
    edge: 0,
    lines: piece.lines,
    halo: piece.solids,
    tone: "gear",
  });
  const backToFront = (a: { depth: number }, b: { depth: number }) => a.depth - b.depth;
  const placed = (where: "back" | "front") =>
    pieces
      .filter((piece) => piece.where === where)
      .sort(backToFront)
      .map(ofGear);
  const held = (limb: Limb, side: "behind" | "before") =>
    pieces
      .filter(
        (piece) =>
          typeof piece.where === "object" && piece.where.limb === limb && piece.where.side === side,
      )
      .map(ofGear);

  // A limb goes with whatever it holds: the far head of a dumbbell, the arm, the near head.
  const behind: { parts: Part[]; depth: number }[] = [];
  const before: { parts: Part[]; depth: number }[] = [];
  let nearLegs = "";
  for (const side of ["L", "R"] as const) {
    const arm = [at(`shoulder${side}`), at(`elbow${side}`), at(`wrist${side}`)] as const;
    const leg = [at(`hip${side}`), at(`knee${side}`), at(`ankle${side}`)] as const;
    for (const [joints, wide] of [
      [arm, BODY.arm * zoom],
      [leg, BODY.leg * zoom],
    ] as const) {
      // A limb is two bars of one width with round ends: no hand, no foot.
      const lower = limb(joints[1], joints[2], wide, wide);
      const shape = limb(joints[0], joints[1], wide, wide) + lower;
      // A limb is on the far side when the joint it hangs from is well behind the middle of
      // the body (the chest for an arm, the hips for a leg), wherever the limb itself reaches.
      const far =
        joints === arm
          ? joints[0][2] < at("chest")[2] - FAR.arm
          : joints[0][2] < at("pelvis")[2] - FAR.leg;
      let halo = shape;
      if (joints === leg && !far) {
        // A leg in front carries on from the trunk, so it is set off only from a little way
        // down: at the hip the two are one shape.
        const from: Point = [
          joints[0][0] + (joints[1][0] - joints[0][0]) * 0.45,
          joints[0][1] + (joints[1][1] - joints[0][1]) * 0.45,
          0,
        ];
        halo = limb(from, joints[1], wide, wide) + lower;
        nearLegs += shape;
      }
      const depth = (joints[0][2] + joints[1][2] + joints[2][2]) / 3;
      const name: Limb = `${joints === arm ? "arm" : "leg"}${side}`;
      (far ? behind : before).push({
        parts: [
          ...held(name, "behind"),
          { shape, edge: 0, lines: "", halo, tone: far ? "far" : "body" },
          ...held(name, "before"),
        ],
        depth,
      });
    }
  }
  for (const piece of pieces)
    if (piece.where === "among") before.push({ parts: [ofGear(piece)], depth: piece.depth });
  const torso = trunk(s, P, zoom);
  const head = disc(at("head"), BODY.head * zoom);
  // Gear that is only lines, behind the figure, is one part: the rails, posts and cables of a
  // machine join each other.
  const rig = pieces.filter((piece) => piece.where === "back" && !piece.solids);
  // Back to front: gear beyond the figure, its far limbs, the trunk, the head, the near limbs
  // and gear held among them, gear this side of the figure. Among limbs on the same side, the
  // one nearer the viewer is in front. Just behind the trunk goes a part that paints nothing:
  // it clears the gap round the whole of the near legs, so that the top of a thigh, which is
  // one shape with the trunk, is still set off from the far leg behind it.
  const parts: Part[] = [
    { shape: "", edge: 0, lines: rig.map((piece) => piece.lines).join(""), halo: "", tone: "gear" },
    ...placed("back").filter((part) => part.shape),
    ...behind.sort(backToFront).flatMap((limb) => limb.parts),
    { shape: "", edge: 0, lines: "", halo: nearLegs, tone: "body" },
    { shape: torso, edge: CORNER * zoom, lines: "", halo: torso, tone: "body" },
    { shape: head, edge: 0, lines: "", halo: head, tone: "body" },
    ...before.sort(backToFront).flatMap((limb) => limb.parts),
    ...placed("front"),
  ];
  const left = project([0, 0, 0], view);
  return {
    parts,
    lineWidth: LINE * zoom,
    floor: `M${n(14)} ${n(left[1] + 0.4)}L${n(CANVAS - 14)} ${n(left[1] + 0.4)}`,
  };
}

/**
 * The view that frames a set of poses: the same angle, zoomed and moved so that everything the
 * figure and its gear reach, in any of the poses, fits the canvas with a margin. Exercises then
 * fill their cards alike, whether the figure stands, hangs or lies down.
 */
export function frame(poses: readonly Pose[], gear: readonly Gear[], view: View, margin = 9): View {
  const plain: View = { yaw: view.yaw, tilt: view.tilt };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const see = (p: Vec, pad: number) => {
    const [x, y] = project(p, plain);
    minX = Math.min(minX, x - pad);
    maxX = Math.max(maxX, x + pad);
    minY = Math.min(minY, y - pad);
    maxY = Math.max(maxY, y + pad);
  };
  for (const pose of poses) {
    const s = skeleton(pose);
    for (const joint of Object.values(s)) see(joint, BODY.leg + 1);
    for (const p of [s.chest, s.pelvis]) see(p, BODY.trunk + 1);
    see(s.head, BODY.head + 1);
    for (const item of gear) for (const p of reachOf(item, s)) see(p, 1.5);
    for (const item of gear)
      for (const [x, y, pad] of flatReachOf(item, s, plain)) {
        minX = Math.min(minX, x - pad - 1.5);
        maxX = Math.max(maxX, x + pad + 1.5);
        minY = Math.min(minY, y - pad - 1.5);
        maxY = Math.max(maxY, y + pad + 1.5);
      }
  }
  // The floor the figure stands on is part of the picture.
  see([0, 0, 0], 1);
  const zoom = Math.min(1.5, (CANVAS - 2 * margin) / Math.max(maxX - minX, maxY - minY));
  // `project` puts the origin at the middle of the canvas across and at FLOOR down.
  return {
    ...plain,
    zoom,
    shift: [
      -((minX + maxX) / 2 - CANVAS / 2) * zoom,
      ((minY + maxY) / 2 - FLOOR) * zoom + (FLOOR - CANVAS / 2),
    ],
  };
}

/** How far apart two points are on the canvas, for tests. */
export const apart = (a: Point, b: Point) => size([a[0] - b[0], a[1] - b[1], 0]);
