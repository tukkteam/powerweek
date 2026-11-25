/**
 * Draws the mannequin and its gear. A scene is a figure in a pose, the gear it uses and where
 * it is seen from; this turns it into a few SVG path strings, one per layer, which `Figure`
 * paints in the current colour.
 *
 * The figure is a silhouette: a head, a trunk and limbs, with nothing drawn on them. Depth is
 * shown the way pictograms show it: limbs on the far side are dimmer, and every part is set off
 * by a thin gap from whatever lies behind it.
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

/**
 * A round weight (a plate, the head of a dumbbell) seen from anywhere: a short cylinder. End on
 * it is a disc, edge on a bar with soft ends, and in between the outline of the two rims.
 */
function drum(centre: Vec, axis: Vec, radius: number, thick: number, view: View): string {
  const zoom = view.zoom ?? 1;
  const c = project(centre, view);
  const tip = project(add(centre, axis), view);
  // How much of its axis lies across the picture: none end on, all of it edge on.
  const along = Math.hypot(tip[0] - c[0], tip[1] - c[1]) / zoom;
  const r = radius * zoom;
  if (along < 0.02) return disc(c, r);
  const ux = (tip[0] - c[0]) / (along * zoom);
  const uy = (tip[1] - c[1]) / (along * zoom);
  // A rim is an ellipse this wide; never quite flat, so an edge has no sharp corners.
  const rim = Math.max(r * Math.sqrt(Math.max(0, 1 - along * along)), 0.9 * zoom);
  const half = (thick / 2) * along * zoom;
  const turn = n((Math.atan2(uy, ux) * 180) / Math.PI);
  const at = (su: number, sv: number) =>
    `${n(c[0] + ux * half * su - uy * r * sv)} ${n(c[1] + uy * half * su + ux * r * sv)}`;
  const arc = `A${n(rim)} ${n(r)} ${turn} 0 1 `;
  return `M${at(-1, 1)}${arc}${at(-1, -1)}L${at(1, -1)}${arc}${at(1, 1)}Z`;
}

/** The outline round some points on the canvas, its corners rounded to `r`. */
function rounded(points: readonly Point[], r: number): string {
  const ring: Point[] = [];
  for (const [x, y] of points)
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * 2 * Math.PI;
      ring.push([x + Math.cos(a) * r, y + Math.sin(a) * r, 0]);
    }
  return hull(ring);
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
  /** A kettlebell held in both hands: it hangs the way the arms point. */
  | { kind: "kettlebell" }
  /** A bench: its top `high` off the floor, from `from` to `to` (points on the floor). */
  | { kind: "bench"; from: Vec; to: Vec; high?: number; wide?: number }
  /** A bar overhead to hang from, at `high`, with the posts that hold it. */
  | { kind: "bar"; high: number; z?: number; wide?: number }
  /** A box or step: `wide` by `deep`, `high`, its middle at `at` on the floor. */
  | { kind: "box"; at: Vec; wide?: number; deep?: number; high: number }
  /** A cable or band from a fixed point to between the hands, or to `each` hand, or to one. */
  | { kind: "cable"; from: Vec; each?: boolean; hand?: "L" | "R" };

/**
 * What gear measures, in the units the figure is 100 tall in. One set of sizes for every
 * exercise: a plate is the same plate wherever it turns up.
 */
const LINE = 2.3;
const BARBELL = { half: 36, plate: 30, radius: 11, thick: 4.5, step: 2.5 } as const;
const DUMBBELL = { reach: 7, radius: 4.6, thick: 4 } as const;
const KETTLEBELL = { radius: 6, rise: 4.4, wide: 3.4 } as const;
const PAD = { thick: 4.4, corner: 1.1 } as const;

/**
 * Of two weights alike, the one nearer the viewer is drawn larger and the one further away
 * smaller: `depth` is how much nearer than the middle of the pair. Two that are nearly level
 * (`level` or less apart) are drawn all but alike; at `range` the difference would be the whole
 * size. A weight on its own is drawn at its size.
 */
const NEARER = { level: 12, range: 200 } as const;
export function nearer(depth: number): number {
  const d = Math.abs(depth);
  return 1 + (Math.sign(depth) * d * d) / (d + NEARER.level) / NEARER.range;
}

type Limb = "armL" | "armR" | "legL" | "legR";

/**
 * Something of the gear that is drawn as one: its shapes and lines join with no gap between
 * them, and the whole is set off from what lies behind it, like a part of the figure.
 */
interface Piece {
  solids: string;
  lines: string;
  /**
   * Where it goes among the parts of the figure: behind all of it; in front of the body, among
   * the limbs on the near side by how near it is; in front of all of it; or just behind or in
   * front of one limb.
   */
  where: "back" | "among" | "front" | { limb: Limb; side: "behind" | "before" };
  /** How near the viewer it is, to order pieces that go in the same place. */
  depth: number;
}

const X: Vec = [1, 0, 0];

/**
 * Where a kettlebell is on the canvas: it hangs from the hands the way the arms point. It is a
 * sign more than a solid: a ball with a loop, drawn facing the viewer wherever it is seen from,
 * since that is what says kettlebell. `way` is the way it hangs, on the canvas.
 */
function kettlebell(s: Skeleton, view: View) {
  const zoom = view.zoom ?? 1;
  const grip = times(add(s.handL, s.handR), 0.5);
  const pull = add(sub(s.wristL, s.elbowL), sub(s.wristR, s.elbowR));
  const hang: Vec = size(pull) > 1e-6 ? unit(pull) : [0, -1, 0];
  const from = project(grip, view);
  const to = project(add(grip, hang), view);
  // Arms that point at the viewer give it no way to hang on the canvas: then it hangs down.
  const seen = Math.hypot(to[0] - from[0], to[1] - from[1]) / zoom;
  const x = (to[0] - from[0]) / zoom;
  const y = (to[1] - from[1]) / zoom + Math.max(0, 0.35 - seen);
  const way = [x / Math.hypot(x, y), y / Math.hypot(x, y)] as const;
  // Its handle stops a gap short of the hands, so the whole of it shows: short of whichever
  // hand reaches further that way, when the two are not together.
  const past = Math.max(
    ...[s.handL, s.handR].map((hand) => {
      const [hx, hy] = project(hand, view);
      return (hx - from[0]) * way[0] + (hy - from[1]) * way[1];
    }),
  );
  const drop = past + (BODY.arm + GAP + LINE / 2 + KETTLEBELL.rise + KETTLEBELL.radius) * zoom;
  const centre: Point = [
    from[0] + way[0] * drop,
    from[1] + way[1] * drop,
    project(add(grip, times(hang, drop / zoom)), view)[2],
  ];
  return { centre, way };
}

function drawGear(gear: readonly Gear[], s: Skeleton, view: View): Piece[] {
  const out: Piece[] = [];
  const P = (p: Vec) => project(p, view);
  const depth = (p: Vec) => project(p, view)[2];
  const zoom = view.zoom ?? 1;
  const hands = times(add(s.handL, s.handR), 0.5);
  for (const item of gear) {
    if (item.kind === "barbell") {
      const axis = unit(item.along ?? X);
      const centre = item.at ?? hands;
      const bar = line(
        P(add(centre, times(axis, -BARBELL.half))),
        P(add(centre, times(axis, BARBELL.half))),
      );
      const ends = [-1, 1]
        .map((sign) => {
          const first = add(centre, times(axis, sign * BARBELL.plate));
          const scale = nearer(depth(first) - depth(centre));
          let solids = "";
          for (let k = 0; k < (item.plates ?? 1); k++)
            solids += drum(
              add(first, times(axis, sign * k * BARBELL.thick * 1.05)),
              axis,
              (BARBELL.radius - k * BARBELL.step) * scale,
              BARBELL.thick * scale,
              view,
            );
          return { solids, depth: depth(first) };
        })
        .sort((a, b) => a.depth - b.depth);
      const [far, near] = [ends[0]!, ends[1]!];
      if (Math.abs(dot(axis, towardsViewer(view))) > 0.5) {
        // Seen from its end, more or less: one plate is beyond the figure and one this side.
        out.push({ solids: far.solids, lines: bar, where: "back", depth: far.depth });
        out.push({ solids: near.solids, lines: "", where: "front", depth: near.depth });
      } else {
        // Seen across: one thing, behind the figure, whose hands close round the bar.
        out.push({
          solids: far.solids + near.solids,
          lines: bar,
          where: "back",
          depth: depth(centre),
        });
      }
    } else if (item.kind === "handle") {
      const axis = unit(item.along ?? X);
      const half = (item.wide ?? 44) / 2;
      out.push({
        solids: "",
        lines: line(P(add(hands, times(axis, -half))), P(add(hands, times(axis, half)))),
        where: "back",
        depth: depth(hands),
      });
    } else if (item.kind === "rail") {
      let lines = "";
      for (let i = 1; i < item.points.length; i++)
        lines += line(P(item.points[i - 1]!), P(item.points[i]!));
      out.push({ solids: "", lines, where: "back", depth: 0 });
    } else if (item.kind === "dumbbells") {
      const axis = unit(item.along ?? X);
      for (const side of ["L", "R"] as const) {
        if (item.hand && item.hand !== side) continue;
        const hand = s[`hand${side}`];
        // One size for the whole dumbbell: its two heads match.
        const scale = item.hand ? 1 : nearer(depth(hand) - depth(hands));
        const reach = DUMBBELL.reach * scale;
        let solids = "";
        for (const sign of [-1, 1])
          solids += drum(
            add(hand, times(axis, sign * reach)),
            axis,
            DUMBBELL.radius * scale,
            DUMBBELL.thick * scale,
            view,
          );
        // Seen across, the hand closes round the handle, between the heads. Seen from its end,
        // more or less, the near head is this side of the hand, and the dumbbell covers it.
        const endOn = Math.abs(dot(axis, towardsViewer(view))) > 0.5;
        out.push({
          solids,
          lines: line(P(add(hand, times(axis, -reach))), P(add(hand, times(axis, reach)))),
          where: { limb: `arm${side}`, side: endOn ? "before" : "behind" },
          depth: depth(hand),
        });
      }
    } else if (item.kind === "kettlebell") {
      const { centre: c, way } = kettlebell(s, view);
      const [dx, dy] = way;
      // An arch from one shoulder of the ball to the other.
      const foot = Math.sqrt(KETTLEBELL.radius ** 2 - KETTLEBELL.wide ** 2);
      const peak = (KETTLEBELL.radius + KETTLEBELL.rise - foot / 4) / 0.75;
      const arch = [
        [foot, -KETTLEBELL.wide],
        [peak, -KETTLEBELL.wide * 1.4],
        [peak, KETTLEBELL.wide * 1.4],
        [foot, KETTLEBELL.wide],
      ].map(([up, side]) => [
        c[0] - dx * up! * zoom - dy * side! * zoom,
        c[1] - dy * up! * zoom + dx * side! * zoom,
      ]);
      out.push({
        solids: disc(c, KETTLEBELL.radius * zoom),
        lines:
          `M${n(arch[0]![0]!)} ${n(arch[0]![1]!)}` +
          `C${arch
            .slice(1)
            .map(([x, y]) => `${n(x!)} ${n(y!)}`)
            .join(" ")}`,
        where: "among",
        depth: c[2],
      });
    } else if (item.kind === "bench") {
      const high = item.high ?? 27;
      const wide = (item.wide ?? 15) / 2 - PAD.corner;
      const way = unit(sub(item.to, item.from));
      const across: Vec = [way[2], 0, -way[0]];
      const from = add(item.from, times(way, PAD.corner));
      const to = add(item.to, times(way, -PAD.corner));
      // The pad: a slab with soft corners, seen from anywhere.
      const corners: Point[] = [];
      for (const end of [from, to])
        for (const side of [-1, 1])
          for (const y of [high - PAD.corner, high - PAD.thick + PAD.corner])
            corners.push(
              P([end[0] + across[0] * side * wide, y, end[2] + across[2] * side * wide]),
            );
      let lines = "";
      for (const t of [0.14, 0.86]) {
        const foot = mix(item.from, item.to, t);
        const under: Vec = [foot[0], high - PAD.thick / 2, foot[2]];
        const base = (side: number): Vec => [
          foot[0] + across[0] * side * (wide + PAD.corner),
          0.6,
          foot[2] + across[2] * side * (wide + PAD.corner),
        ];
        lines += line(P(under), P([foot[0], 0.6, foot[2]])) + line(P(base(-1)), P(base(1)));
      }
      out.push({
        solids: rounded(corners, PAD.corner * zoom),
        lines,
        where: "back",
        depth: depth(mix(item.from, item.to, 0.5)) - 1000,
      });
    } else if (item.kind === "bar") {
      const z = item.z ?? 0;
      const wide = (item.wide ?? 62) / 2;
      let lines = line(P([-wide, item.high, z]), P([wide, item.high, z]));
      for (const sign of [-1, 1])
        lines += line(P([sign * wide, item.high, z]), P([sign * wide, 0.6, z]));
      out.push({ solids: "", lines, where: "back", depth: 0 });
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
      let lines = outline(top);
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const)
        lines += line(corner(sx, item.high, sz), corner(sx, 0.6, sz));
      lines += outline([
        corner(-1, 0.6, -1),
        corner(1, 0.6, -1),
        corner(1, 0.6, 1),
        corner(-1, 0.6, 1),
      ]);
      // A box the figure stands behind is in front of it.
      const before = depth([x, item.high / 2, z]) > depth(s.pelvis);
      out.push({ solids: "", lines, where: before ? "front" : "back", depth: 0 });
    } else if (item.kind === "cable") {
      let lines = "";
      if (!item.each && !item.hand) lines += line(P(item.from), P(hands));
      else
        for (const side of ["L", "R"] as const) {
          if (item.hand && item.hand !== side) continue;
          lines += line(P(item.from), P(s[`hand${side}`]));
        }
      out.push({ solids: "", lines, where: "back", depth: 0 });
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

/** The gap that sets every part of the figure off from what lies behind it. */
export const GAP = 1.3;

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

/** The points in space a piece of gear reaches to, for framing a scene. */
function reachOf(item: Gear, s: Skeleton): Vec[] {
  const hands = times(add(s.handL, s.handR), 0.5);
  const round = (p: Vec, r: number): Vec[] => [
    add(p, [r, 0, 0]),
    add(p, [-r, 0, 0]),
    add(p, [0, r, 0]),
    add(p, [0, -r, 0]),
    add(p, [0, 0, r]),
    add(p, [0, 0, -r]),
  ];
  // Weights are measured at their largest: the one nearer the viewer is drawn larger.
  if (item.kind === "barbell") {
    const axis = unit(item.along ?? X);
    const centre = item.at ?? hands;
    const reach = BARBELL.plate + (item.plates ?? 1) * BARBELL.thick;
    return [-1, 1].flatMap((sign) => [
      add(centre, times(axis, sign * BARBELL.half)),
      ...round(add(centre, times(axis, sign * reach)), BARBELL.radius * nearer(reach)),
    ]);
  }
  if (item.kind === "dumbbells") {
    const axis = unit(item.along ?? X);
    const scale = nearer(size(sub(s.handL, s.handR)) / 2);
    return [s.handL, s.handR].flatMap((hand) =>
      [-1, 1].flatMap((sign) =>
        round(
          add(hand, times(axis, sign * (DUMBBELL.reach + DUMBBELL.thick / 2) * scale)),
          DUMBBELL.radius * scale,
        ),
      ),
    );
  }
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
  // A kettlebell is placed on the canvas, not in space: `frame` measures it there.
  if (item.kind === "kettlebell") return [];
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
    if (gear.some((item) => item.kind === "kettlebell")) {
      // A kettlebell is placed on the canvas, not in space.
      const [x, y] = kettlebell(s, plain).centre;
      const pad = KETTLEBELL.radius + 1.5;
      minX = Math.min(minX, x - pad);
      maxX = Math.max(maxX, x + pad);
      minY = Math.min(minY, y - pad);
      maxY = Math.max(maxY, y + pad);
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
