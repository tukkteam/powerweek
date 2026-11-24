/**
 * Draws the mannequin and its gear. A scene is a figure in a pose, the gear it uses and where
 * it is seen from; this turns it into a few SVG path strings, one per layer, which `Figure`
 * paints in the current colour.
 *
 * The figure is a silhouette: a head, a torso and tapering limbs, with nothing drawn on them.
 * Depth is shown the way pictograms show it: limbs on the far side are dimmer, and a limb that
 * passes in front of the body is set off from it by a thin gap.
 */
import {
  BODY,
  add,
  cross,
  dot,
  mix,
  size,
  skeleton,
  sub,
  times,
  unit,
  type Pose,
  type Skeleton,
  type Vec,
} from "./rig";

/** The drawing is this many units square; the figure stands 100 tall in it. */
export const CANVAS = 160;
const FLOOR = 150;

export interface View {
  /** Where it is seen from: 0 is face on, 90 from the figure's right side, 180 from behind. */
  yaw: number;
  /** How far above eye level, in degrees. A little shows the ground the feet stand on. */
  tilt?: number;
  /** Larger or smaller than life (1), and moved sideways or up, in units. */
  zoom?: number;
  shift?: readonly [number, number];
}

type Point = readonly [number, number, number];

/**
 * A point in space as [x, y] on the canvas, with how near the viewer it is across the floor
 * (larger is nearer). Height does not count as nearness, so tilting the view does not reorder
 * a standing figure's parts.
 */
export function project(p: Vec, view: View): Point {
  const yaw = (view.yaw * Math.PI) / 180;
  const tilt = ((view.tilt ?? 0) * Math.PI) / 180;
  const across = -p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw);
  const away = p[2] * Math.cos(yaw) + p[0] * Math.sin(yaw);
  const up = p[1] * Math.cos(tilt) - away * Math.sin(tilt);
  const zoom = view.zoom ?? 1;
  const [sx, sy] = view.shift ?? [0, 0];
  return [CANVAS / 2 + sx + across * zoom, FLOOR - sy - up * zoom, away];
}

/** The way towards the viewer, in space. */
function towardsViewer(view: View): Vec {
  const yaw = (view.yaw * Math.PI) / 180;
  const tilt = ((view.tilt ?? 0) * Math.PI) / 180;
  return [Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt)];
}

const n = (value: number) => {
  const text = value.toFixed(1);
  return text === "-0.0" ? "0.0" : text;
};

/** A filled circle. */
function disc([x, y]: Point | readonly [number, number], r: number): string {
  return `M${n(x - r)} ${n(y)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`;
}

/** A limb: a rounded shape from `a` to `b`, `ra` thick at one end and `rb` at the other. */
function limb(a: Point, b: Point, ra: number, rb: number): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  // Seen end on, a limb is a disc.
  if (length < 0.5) return disc(a, Math.max(ra, rb));
  const nx = -dy / length;
  const ny = dx / length;
  return (
    `M${n(a[0] + nx * ra)} ${n(a[1] + ny * ra)}` +
    `L${n(b[0] + nx * rb)} ${n(b[1] + ny * rb)}` +
    `A${n(rb)} ${n(rb)} 0 0 0 ${n(b[0] - nx * rb)} ${n(b[1] - ny * rb)}` +
    `L${n(a[0] - nx * ra)} ${n(a[1] - ny * ra)}` +
    `A${n(ra)} ${n(ra)} 0 0 0 ${n(a[0] + nx * ra)} ${n(a[1] + ny * ra)}Z`
  );
}

const outline = (points: readonly Point[]) =>
  points.map(([x, y], i) => `${i ? "L" : "M"}${n(x)} ${n(y)}`).join("") + "Z";
const line = (a: Point, b: Point) => `M${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}`;

/** A round plate (of a barbell, a dumbbell) seen from anywhere: an ellipse, or a disc end on. */
function plate(centre: Vec, axis: Vec, radius: number, thick: number, view: View): string {
  const c = project(centre, view);
  const tip = project(add(centre, axis), view);
  const facing = Math.abs(dot(axis, towardsViewer(view)));
  const along = Math.hypot(tip[0] - c[0], tip[1] - c[1]);
  const zoom = view.zoom ?? 1;
  const major = radius * zoom;
  // How wide it looks along its axis: its face turned towards us, plus its edge.
  const minor = Math.max(
    (radius * facing + (thick / 2) * Math.sqrt(1 - facing * facing)) * zoom,
    0.9,
  );
  if (along < 1e-3) return disc(c, major);
  const ux = (tip[0] - c[0]) / along;
  const uy = (tip[1] - c[1]) / along;
  const turn = n((Math.atan2(uy, ux) * 180) / Math.PI);
  const arc = `A${n(minor)} ${n(major)} ${turn} 1 0 `;
  return (
    `M${n(c[0] - ux * minor)} ${n(c[1] - uy * minor)}` +
    `${arc}${n(c[0] + ux * minor)} ${n(c[1] + uy * minor)}` +
    `${arc}${n(c[0] - ux * minor)} ${n(c[1] - uy * minor)}Z`
  );
}

// ── Gear ────────────────────────────────────────────────────────────────────────────────────

/**
 * A piece of gear: what it is and where it goes. Gear is drawn in space like the figure, so the
 * same bench or barbell serves any exercise seen from any side.
 */
export type Gear =
  /** A barbell through the hands (or at `at`), lying along `along` (default: side to side). */
  | { kind: "barbell"; at?: Vec; along?: Vec; plates?: number }
  /** A plain bar through the hands, `wide` from end to end: the handle of a cable machine. */
  | { kind: "handle"; wide?: number; along?: Vec }
  /** A fixed part of a machine or a rack: a line through these points. */
  | { kind: "rail"; points: readonly Vec[] }
  /** A dumbbell in each hand (or one), lying along `along` (default: side to side). */
  | { kind: "dumbbells"; along?: Vec; hand?: "L" | "R" }
  /** A kettlebell hanging from the hands. */
  | { kind: "kettlebell" }
  /** A bench: its top `high` off the floor, from `from` to `to` (points on the floor). */
  | { kind: "bench"; from: Vec; to: Vec; high?: number; wide?: number }
  /** A bar overhead to hang from, at `high`, with the posts that hold it. */
  | { kind: "bar"; high: number; z?: number; wide?: number }
  /** A box or step: `wide` by `deep`, `high`, its middle at `at` on the floor. */
  | { kind: "box"; at: Vec; wide?: number; deep?: number; high: number }
  /** A cable or band from a fixed point to between the hands, or to `each` hand, or to one. */
  | { kind: "cable"; from: Vec; each?: boolean; hand?: "L" | "R" };

interface GearPaths {
  /** Lines (stroked) and solids (filled), behind the figure and in front of it. */
  lines: string;
  solids: string;
  frontLines: string;
  frontSolids: string;
}

const X: Vec = [1, 0, 0];

function drawGear(gear: readonly Gear[], s: Skeleton, view: View): GearPaths {
  const out = { lines: "", solids: "", frontLines: "", frontSolids: "" };
  const P = (p: Vec) => project(p, view);
  const hands = times(add(s.handL, s.handR), 0.5);
  const near = (p: Vec) => project(p, view)[2] >= project(s.chest, view)[2];
  for (const item of gear) {
    if (item.kind === "barbell") {
      const axis = unit(item.along ?? X);
      const centre = item.at ?? hands;
      const half = 36;
      // The bar goes behind the figure, whose hands close round it; the plates go where they are.
      out.lines += line(P(add(centre, times(axis, -half))), P(add(centre, times(axis, half))));
      for (const sign of [-1, 1])
        for (let k = 0; k < (item.plates ?? 1); k++) {
          const at = add(centre, times(axis, sign * (half - 5 - k * 4)));
          const shape = plate(at, axis, 11 - k * 2.5, 3, view);
          if (near(at)) out.frontSolids += shape;
          else out.solids += shape;
        }
    } else if (item.kind === "handle") {
      const axis = unit(item.along ?? X);
      const half = (item.wide ?? 44) / 2;
      out.lines += line(P(add(hands, times(axis, -half))), P(add(hands, times(axis, half))));
    } else if (item.kind === "rail") {
      for (let i = 1; i < item.points.length; i++)
        out.lines += line(P(item.points[i - 1]!), P(item.points[i]!));
    } else if (item.kind === "dumbbells") {
      const axis = unit(item.along ?? X);
      for (const side of ["L", "R"] as const) {
        if (item.hand && item.hand !== side) continue;
        const hand = s[`hand${side}`];
        const bar = line(P(add(hand, times(axis, -5))), P(add(hand, times(axis, 5))));
        const ends = [-1, 1].map((sign) =>
          plate(add(hand, times(axis, sign * 5)), axis, 4.2, 3.4, view),
        );
        if (near(hand)) {
          out.frontLines += bar;
          out.frontSolids += ends.join("");
        } else {
          out.lines += bar;
          out.solids += ends.join("");
        }
      }
    } else if (item.kind === "kettlebell") {
      const top = P(hands);
      const zoom = view.zoom ?? 1;
      const ball: Point = [top[0], top[1] + 8.5 * zoom, top[2]];
      out.frontSolids += disc(ball, 6.2 * zoom);
      out.frontLines +=
        `M${n(top[0] - 3.4 * zoom)} ${n(ball[1] - 4 * zoom)}` +
        `Q${n(top[0] - 4 * zoom)} ${n(top[1] - 1.5 * zoom)} ${n(top[0])} ${n(top[1] - 1.5 * zoom)}` +
        `T${n(top[0] + 3.4 * zoom)} ${n(ball[1] - 4 * zoom)}`;
    } else if (item.kind === "bench") {
      const high = item.high ?? 27;
      const wide = (item.wide ?? 15) / 2;
      const way = unit(sub(item.to, item.from));
      const across: Vec = [way[2], 0, -way[0]];
      const top = (p: Vec, side: number): Vec => [
        p[0] + across[0] * side * wide,
        high - 2.5,
        p[2] + across[2] * side * wide,
      ];
      // The pad, seen from anywhere: its four corners, drawn with a thick rounded edge.
      out.solids += outline([
        P(top(item.from, -1)),
        P(top(item.from, 1)),
        P(top(item.to, 1)),
        P(top(item.to, -1)),
      ]);
      for (const t of [0.14, 0.86]) {
        const foot = mix(item.from, item.to, t);
        const under: Vec = [foot[0], high - 5, foot[2]];
        const base = (side: number): Vec => [
          foot[0] + across[0] * side * wide,
          0.6,
          foot[2] + across[2] * side * wide,
        ];
        out.lines += line(P(under), P([foot[0], 0.6, foot[2]])) + line(P(base(-1)), P(base(1)));
      }
    } else if (item.kind === "bar") {
      const z = item.z ?? 0;
      const wide = (item.wide ?? 62) / 2;
      out.lines += line(P([-wide, item.high, z]), P([wide, item.high, z]));
      for (const sign of [-1, 1])
        out.lines += line(P([sign * wide, item.high, z]), P([sign * wide, 0.6, z]));
    } else if (item.kind === "box") {
      const w = (item.wide ?? 34) / 2;
      const d = (item.deep ?? 34) / 2;
      const [x, , z] = item.at;
      const corner = (sx: number, y: number, sz: number): Point => P([x + sx * w, y, z + sz * d]);
      const top = [
        corner(-1, item.high, -1),
        corner(1, item.high, -1),
        corner(1, item.high, 1),
        corner(-1, item.high, 1),
      ];
      out.lines += outline(top);
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const)
        out.lines += line(corner(sx, item.high, sz), corner(sx, 0.6, sz));
      out.lines += outline([
        corner(-1, 0.6, -1),
        corner(1, 0.6, -1),
        corner(1, 0.6, 1),
        corner(-1, 0.6, 1),
      ]);
    } else if (item.kind === "cable") {
      if (!item.each && !item.hand) out.lines += line(P(item.from), P(hands));
      else
        for (const side of ["L", "R"] as const) {
          if (item.hand && item.hand !== side) continue;
          out.lines += line(P(item.from), P(s[`hand${side}`]));
        }
    }
  }
  return out;
}

// ── The figure ──────────────────────────────────────────────────────────────────────────────

/** The trunk's corners are rounded by an edge this thick drawn round it. */
const CORNER = 2.2;

/** The outline round a set of points on the canvas (their convex hull), as a closed path. */
function hull(points: readonly Point[]): string {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: Point, a: Point, b: Point) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: readonly Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (out.length >= 2 && turn(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return outline([...half(sorted), ...half([...sorted].reverse())]);
}

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

/** The gap that sets a limb off from the body it passes in front of. */
export const GAP = 1.3;

export interface Drawing {
  /** Gear behind the figure: lines to stroke and shapes to fill. */
  gearLines: string;
  gearSolids: string;
  /** Limbs on the far side of the body. */
  back: string;
  /** The torso, to fill and to stroke `torsoEdge` thick. */
  torso: string;
  torsoEdge: number;
  head: string;
  /** Limbs on the near side, and the part of them that is set off from what lies behind. */
  front: string;
  cut: string;
  /** Everything the figure covers, to set it off from the gear behind it. */
  figure: string;
  /** Gear in front of the figure. */
  frontLines: string;
  frontSolids: string;
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

  let back = "";
  let front = "";
  let cut = "";
  for (const side of ["L", "R"] as const) {
    const arm = [at(`shoulder${side}`), at(`elbow${side}`), at(`wrist${side}`)] as const;
    const leg = [at(`hip${side}`), at(`knee${side}`), at(`ankle${side}`)] as const;
    for (const [joints, wide] of [
      [arm, BODY.arm * zoom],
      [leg, BODY.leg * zoom],
    ] as const) {
      // A limb is two bars of one width with round ends: no hand, no foot.
      const shape = limb(joints[0], joints[1], wide, wide) + limb(joints[1], joints[2], wide, wide);
      // A limb is on the far side when the joint it hangs from is well behind the middle of
      // the body (the chest for an arm, the hips for a leg), wherever the limb itself reaches.
      const far =
        joints === arm
          ? joints[0][2] < at("chest")[2] - FAR.arm
          : joints[0][2] < at("pelvis")[2] - FAR.leg;
      if (far) back += shape;
      else if (joints === arm) {
        // An arm is a bar beside the trunk: where it crosses the body, all of it is set off.
        front += shape;
        cut += shape;
      } else {
        front += shape;
        // A leg carries on from the trunk, so it is set off only from a little way down.
        const from: Point = [
          joints[0][0] + (joints[1][0] - joints[0][0]) * 0.45,
          joints[0][1] + (joints[1][1] - joints[0][1]) * 0.45,
          0,
        ];
        cut += limb(from, joints[1], wide, wide) + limb(joints[1], joints[2], wide, wide);
      }
    }
  }
  const torso = trunk(s, P, zoom);
  const head = disc(at("head"), BODY.head * zoom);
  const g = drawGear(gear, s, view);
  const left = project([0, 0, 0], view);
  return {
    gearLines: g.lines,
    gearSolids: g.solids,
    back,
    torso,
    torsoEdge: CORNER * zoom,
    head,
    front,
    cut,
    figure: back + front + head,
    frontLines: g.frontLines,
    frontSolids: g.frontSolids,
    lineWidth: 2.3 * zoom,
    floor: `M${n(14)} ${n(left[1] + 0.4)}L${n(CANVAS - 14)} ${n(left[1] + 0.4)}`,
  };
}

/** The points in space a piece of gear reaches to, for framing a scene. */
function reachOf(item: Gear, s: Skeleton): Vec[] {
  const hands = times(add(s.handL, s.handR), 0.5);
  if (item.kind === "barbell") {
    const axis = unit(item.along ?? X);
    const centre = item.at ?? hands;
    return [-1, 1].flatMap((sign) => {
      const end = add(centre, times(axis, sign * 36));
      return [
        end,
        add(end, [0, 11, 0]),
        add(end, [0, -11, 0]),
        add(end, [0, 0, 11]),
        add(end, [0, 0, -11]),
      ];
    });
  }
  if (item.kind === "dumbbells")
    return [s.handL, s.handR].flatMap((h) => [add(h, [7, 5, 7]), add(h, [-7, -5, -7])]);
  if (item.kind === "kettlebell") return [add(hands, [0, -15, 0])];
  if (item.kind === "bench") return [item.from, item.to, add(item.from, [0, item.high ?? 27, 0])];
  if (item.kind === "bar") {
    const wide = (item.wide ?? 62) / 2;
    return [
      [-wide, item.high, item.z ?? 0],
      [wide, item.high, item.z ?? 0],
      [-wide, 0, item.z ?? 0],
      [wide, 0, item.z ?? 0],
    ];
  }
  if (item.kind === "box") return [add(item.at, [0, item.high, 0]), item.at];
  if (item.kind === "handle") {
    const axis = unit(item.along ?? X);
    const half = (item.wide ?? 44) / 2;
    return [add(hands, times(axis, half)), add(hands, times(axis, -half))];
  }
  if (item.kind === "rail") return [...item.points];
  return [item.from];
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
