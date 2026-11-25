/**
 * The gear the mannequin uses: weights, benches, bars, the frames and cables of machines. Each
 * piece is drawn in space like the figure, so the same bench or barbell serves any exercise
 * seen from any side, and a machine is a few pieces put together (see library/kit.ts).
 *
 * The rules that keep gear from looking improvised:
 * - one set of sizes: a plate is the same plate wherever it turns up, and a shape is drawn at
 *   its size, with no edge added round it;
 * - round weights are short cylinders, seen from wherever the view is;
 * - of two weights alike, the one nearer the viewer is drawn larger (`nearer`);
 * - each piece has its place among the parts of the figure, and is set off from what lies
 *   behind it by the same gap as they are.
 */
import {
  GAP,
  disc,
  drum,
  line,
  n,
  project,
  rounded,
  towardsViewer,
  type Point,
  type View,
} from "./canvas";
import {
  BODY,
  add,
  cross,
  dot,
  mix,
  size,
  sub,
  times,
  unit,
  type Joint,
  type Skeleton,
  type Vec,
} from "./rig";

const PAIRS = {
  hands: "hand",
  elbows: "elbow",
  shoulders: "shoulder",
  hips: "hip",
  knees: "knee",
  ankles: "ankle",
  toes: "toe",
} as const;

type Jointed = Joint | keyof typeof PAIRS;

/**
 * Where a piece of gear is fixed: a point in space, a joint of the figure (the gear then moves
 * with it: a cable to a hand, a pad on the ankles), the middle of a pair of joints, or a place
 * `by` so much from one of those: a plate hanging below the hips, a saddle under them.
 */
export type Anchor = Vec | Jointed | { on: Jointed; by: Vec };

export function anchored(anchor: Anchor, s: Skeleton): Vec {
  if (typeof anchor !== "string") {
    if ("on" in anchor) return add(anchored(anchor.on, s), anchor.by);
    return anchor as Vec;
  }
  if (anchor in PAIRS) {
    const name = PAIRS[anchor as keyof typeof PAIRS];
    return mix(s[`${name}L`], s[`${name}R`], 0.5);
  }
  return s[anchor as Joint];
}

/**
 * A piece of gear: what it is and where it goes. `place` overrides where it is drawn among the
 * parts of the figure (each kind has its own sensible place): behind all of the figure, among
 * its near limbs by how near it is, or in front of all of it.
 */
export type Gear = { place?: "back" | "among" | "front" } & (
  | {
      /**
       * A barbell through the hands (or at `at`), lying along `along` (default: side to side).
       * `wide` is its length (default 72; an EZ bar is about 48), `radius` that of its plates.
       */
      kind: "barbell";
      at?: Anchor;
      along?: Vec;
      plates?: number;
      wide?: number;
      radius?: number;
    }
  /**
   * A barbell with one end on the floor at `pivot` and the other in the hands (or at `to`).
   * Its plate sits `plate` along the bar from the hands (default: 9 before them).
   */
  | { kind: "landmine"; pivot: Vec; to?: Anchor; plate?: number; plates?: number }
  /** A plain bar through the hands (or at `at`), `wide` from end to end: a cable handle. */
  | { kind: "handle"; at?: Anchor; wide?: number; along?: Vec }
  /** A line through these points: the frame of a machine or a rack, a lever, a wall. */
  | { kind: "rail"; points: readonly Anchor[] }
  /**
   * A dumbbell in each hand (or one), lying along `along` (default: side to side). Or a single
   * one `at` a place: held in both hands, hanging from them, resting on the hips.
   */
  | { kind: "dumbbells"; along?: Vec; hand?: "L" | "R"; at?: Anchor }
  /** A kettlebell held in both hands (or one): it hangs the way the arms point. */
  | { kind: "kettlebell"; hand?: "L" | "R" }
  /**
   * A round weight on its own, in the hands (or at `at`), its axis along `along` (default: the
   * way the figure faces): a plate held to the chest, a wheel, the roller pad of a machine.
   */
  | { kind: "plate"; at?: Anchor; along?: Vec; radius?: number; thick?: number }
  /** A ball: a stability ball, a medicine ball. */
  | { kind: "ball"; at: Anchor; radius: number }
  /** A flat bench: its top `high` off the floor, from `from` to `to` (points on the floor). */
  | { kind: "bench"; from: Vec; to: Vec; high?: number; wide?: number }
  /**
   * A pad: a slab whose middle runs from `from` to `to`, `wide` across and `thick`. The back of
   * a seat, the sloping part of a bench, a platform.
   */
  | { kind: "pad"; from: Anchor; to: Anchor; wide?: number; thick?: number }
  /** A bar overhead to hang from, at `high`, with the posts that hold it. */
  | { kind: "bar"; high: number; z?: number; wide?: number }
  /** A box, a step, a weight stack: `wide` by `deep`, `high`, its middle at `at` on the floor. */
  | { kind: "box"; at: Vec; wide?: number; deep?: number; high: number }
  /**
   * A cable, a band or a strap from `from` to between the hands (or to `to`), or to `each`
   * hand, or to one.
   */
  | { kind: "cable"; from: Anchor; to?: Anchor; each?: boolean; hand?: "L" | "R" }
  /** A slack rope: from `from` to `to`, sagging towards `via`. */
  | { kind: "rope"; from: Anchor; via: Anchor; to: Anchor }
);

/**
 * What gear measures, in the units the figure is 100 tall in. One set of sizes for every
 * exercise: a plate is the same plate wherever it turns up.
 */
export const LINE = 2.3;
const BARBELL = { wide: 72, inset: 6, radius: 11, thick: 4.5, step: 2.5 } as const;
const DUMBBELL = { reach: 7, radius: 4.6, thick: 4 } as const;
export const KETTLEBELL = { radius: 6, rise: 4.4, wide: 3.4 } as const;
const PLATE = { radius: 9, thick: 3.5 } as const;
const PAD = { thick: 4.4, wide: 15, corner: 1.1 } as const;

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

export type Limb = "armL" | "armR" | "legL" | "legR";

/**
 * Something of the gear that is drawn as one: its shapes and lines join with no gap between
 * them, and the whole is set off from what lies behind it, like a part of the figure.
 */
export interface Piece {
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
const Y: Vec = [0, 1, 0];
const Z: Vec = [0, 0, 1];

/**
 * Where a kettlebell is on the canvas: it hangs from the hands the way the arms point. It is a
 * sign more than a solid: a ball with a loop, drawn facing the viewer wherever it is seen from,
 * since that is what says kettlebell. `way` is the way it hangs, on the canvas.
 */
export function kettlebell(s: Skeleton, view: View, hand?: "L" | "R") {
  const zoom = view.zoom ?? 1;
  const sides = hand ? ([hand] as const) : (["L", "R"] as const);
  const grip = times(
    sides.reduce<Vec>((sum, side) => add(sum, s[`hand${side}`]), [0, 0, 0]),
    1 / sides.length,
  );
  const pull = sides.reduce<Vec>(
    (sum, side) => add(sum, sub(s[`wrist${side}`], s[`elbow${side}`])),
    [0, 0, 0],
  );
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
    ...sides.map((side) => {
      const [hx, hy] = project(s[`hand${side}`], view);
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

/** A slab whose middle runs from `a` to `b`, with soft corners, seen from anywhere. */
function slab(a: Vec, b: Vec, wide: number, thick: number, view: View): string {
  const way = unit(sub(b, a));
  const level = cross(way, Y);
  // A slab standing on end has no level side of its own: it is as wide as the figure is.
  const across: Vec = size(level) > 1e-3 ? unit(level) : X;
  const up = cross(across, way);
  const c = PAD.corner;
  const corners: Point[] = [];
  for (const end of [add(a, times(way, c)), add(b, times(way, -c))])
    for (const side of [-1, 1])
      for (const face of [-1, 1])
        corners.push(
          project(
            add(add(end, times(across, side * (wide / 2 - c))), times(up, face * (thick / 2 - c))),
            view,
          ),
        );
  return rounded(corners, c * (view.zoom ?? 1));
}

export function drawGear(gear: readonly Gear[], s: Skeleton, view: View): Piece[] {
  const out: Piece[] = [];
  const P = (p: Vec) => project(p, view);
  const depth = (p: Vec) => project(p, view)[2];
  const at = (anchor: Anchor) => anchored(anchor, s);
  const zoom = view.zoom ?? 1;
  const hands = at("hands");
  for (const item of gear) {
    if (item.kind === "barbell") {
      const axis = unit(item.along ?? X);
      const centre = at(item.at ?? "hands");
      const half = (item.wide ?? BARBELL.wide) / 2;
      const radius = item.radius ?? BARBELL.radius;
      const bar = line(P(add(centre, times(axis, -half))), P(add(centre, times(axis, half))));
      const ends = [-1, 1]
        .map((sign) => {
          const first = add(centre, times(axis, sign * (half - BARBELL.inset)));
          const scale = nearer(depth(first) - depth(centre));
          let solids = "";
          for (let k = 0; k < (item.plates ?? 1); k++)
            solids += drum(
              add(first, times(axis, sign * k * BARBELL.thick * 1.05)),
              axis,
              (radius - k * BARBELL.step) * scale,
              BARBELL.thick * scale,
              view,
            );
          return { solids, depth: depth(first) };
        })
        .sort((a, b) => a.depth - b.depth);
      const [far, near] = [ends[0]!, ends[1]!];
      if (!item.place && Math.abs(dot(axis, towardsViewer(view))) > 0.5) {
        // Seen from its end, more or less: one plate is beyond the figure and one this side.
        out.push({ solids: far.solids, lines: bar, where: "back", depth: far.depth });
        out.push({ solids: near.solids, lines: "", where: "front", depth: near.depth });
      } else {
        // Seen across: one thing, behind the figure, whose hands close round the bar.
        out.push({
          solids: far.solids + near.solids,
          lines: bar,
          where: item.place ?? "back",
          depth: depth(centre),
        });
      }
    } else if (item.kind === "landmine") {
      const to = at(item.to ?? "hands");
      const way = unit(sub(to, item.pivot));
      let solids = "";
      for (let k = 0; k < (item.plates ?? 1); k++)
        solids += drum(
          add(to, times(way, (item.plate ?? -9) - k * BARBELL.thick * 1.05)),
          way,
          BARBELL.radius - 1 - k * BARBELL.step,
          BARBELL.thick,
          view,
        );
      out.push({
        solids,
        lines: line(P(item.pivot), P(add(to, times(way, 5)))),
        where: item.place ?? "back",
        depth: depth(to),
      });
    } else if (item.kind === "handle") {
      const axis = unit(item.along ?? X);
      const half = (item.wide ?? 44) / 2;
      const centre = at(item.at ?? "hands");
      out.push({
        solids: "",
        lines: line(P(add(centre, times(axis, -half))), P(add(centre, times(axis, half)))),
        where: item.place ?? "back",
        depth: depth(centre),
      });
    } else if (item.kind === "rail") {
      let lines = "";
      for (let i = 1; i < item.points.length; i++)
        lines += line(P(at(item.points[i - 1]!)), P(at(item.points[i]!)));
      out.push({
        solids: "",
        lines,
        where: item.place ?? "back",
        depth: Math.max(...item.points.map((point) => depth(at(point)))),
      });
    } else if (item.kind === "dumbbells" && item.at) {
      const axis = unit(item.along ?? X);
      const centre = at(item.at);
      let solids = "";
      for (const sign of [-1, 1])
        solids += drum(
          add(centre, times(axis, sign * DUMBBELL.reach)),
          axis,
          DUMBBELL.radius,
          DUMBBELL.thick,
          view,
        );
      out.push({
        solids,
        lines: line(
          P(add(centre, times(axis, -DUMBBELL.reach))),
          P(add(centre, times(axis, DUMBBELL.reach))),
        ),
        where: item.place ?? "among",
        depth: depth(centre),
      });
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
      const { centre: c, way } = kettlebell(s, view, item.hand);
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
        where: item.place ?? "among",
        depth: c[2],
      });
    } else if (item.kind === "plate") {
      const centre = at(item.at ?? "hands");
      out.push({
        solids: drum(
          centre,
          unit(item.along ?? Z),
          item.radius ?? PLATE.radius,
          item.thick ?? PLATE.thick,
          view,
        ),
        lines: "",
        where: item.place ?? "among",
        depth: depth(centre),
      });
    } else if (item.kind === "ball") {
      const centre = at(item.at);
      out.push({
        solids: disc(P(centre), item.radius * zoom),
        lines: "",
        where: item.place ?? "back",
        depth: depth(centre),
      });
    } else if (item.kind === "bench") {
      const high = item.high ?? 27;
      const wide = item.wide ?? PAD.wide;
      const way = unit(sub(item.to, item.from));
      const across: Vec = [way[2], 0, -way[0]];
      const lift = (p: Vec): Vec => [p[0], high - PAD.thick / 2, p[2]];
      let lines = "";
      for (const t of [0.14, 0.86]) {
        const foot = mix(item.from, item.to, t);
        const base = (side: number): Vec => [
          foot[0] + (across[0] * side * wide) / 2,
          0.6,
          foot[2] + (across[2] * side * wide) / 2,
        ];
        lines += line(P(lift(foot)), P([foot[0], 0.6, foot[2]])) + line(P(base(-1)), P(base(1)));
      }
      out.push({
        solids: slab(lift(item.from), lift(item.to), wide, PAD.thick, view),
        lines,
        where: item.place ?? "back",
        depth: depth(mix(item.from, item.to, 0.5)),
      });
    } else if (item.kind === "pad") {
      const from = at(item.from);
      const to = at(item.to);
      out.push({
        solids: slab(from, to, item.wide ?? PAD.wide, item.thick ?? PAD.thick, view),
        lines: "",
        where: item.place ?? "back",
        depth: depth(mix(from, to, 0.5)),
      });
    } else if (item.kind === "bar") {
      const z = item.z ?? 0;
      const wide = (item.wide ?? 62) / 2;
      let lines = line(P([-wide, item.high, z]), P([wide, item.high, z]));
      for (const sign of [-1, 1])
        lines += line(P([sign * wide, item.high, z]), P([sign * wide, 0.6, z]));
      out.push({ solids: "", lines, where: item.place ?? "back", depth: 0 });
    } else if (item.kind === "box") {
      const c = PAD.corner;
      const w = (item.wide ?? 34) / 2 - c;
      const d = (item.deep ?? 34) / 2 - c;
      const [x, , z] = item.at;
      const corners: Point[] = [];
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          for (const y of [c, item.high - c]) corners.push(P([x + sx * w, y, z + sz * d]));
      out.push({
        solids: rounded(corners, c * zoom),
        lines: "",
        // A box this side of where the figure stands is in front of it. Where it stands, not
        // where it is: the box must not change sides as the figure moves.
        where:
          item.place ?? (depth([x, item.high / 2, z]) > depth([0, 0, 0]) + 8 ? "front" : "back"),
        depth: depth([x, item.high / 2, z]),
      });
    } else if (item.kind === "cable") {
      const from = at(item.from);
      let lines = "";
      if (!item.each && !item.hand) lines += line(P(from), P(at(item.to ?? "hands")));
      else
        for (const side of ["L", "R"] as const) {
          if (item.hand && item.hand !== side) continue;
          lines += line(P(from), P(s[`hand${side}`]));
        }
      out.push({ solids: "", lines, where: item.place ?? "back", depth: depth(from) });
    } else if (item.kind === "rope") {
      const [a, via, b] = [P(at(item.from)), P(at(item.via)), P(at(item.to))];
      out.push({
        solids: "",
        lines: `M${n(a[0])} ${n(a[1])}Q${n(via[0])} ${n(via[1])} ${n(b[0])} ${n(b[1])}`,
        where: item.place ?? "back",
        depth: via[2],
      });
    }
  }
  return out;
}

/** The points in space a piece of gear reaches to, for framing a scene. */
export function reachOf(item: Gear, s: Skeleton): Vec[] {
  const at = (anchor: Anchor) => anchored(anchor, s);
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
    const centre = at(item.at ?? "hands");
    const half = (item.wide ?? BARBELL.wide) / 2;
    const reach = half - BARBELL.inset + (item.plates ?? 1) * BARBELL.thick;
    return [-1, 1].flatMap((sign) => [
      add(centre, times(axis, sign * half)),
      ...round(
        add(centre, times(axis, sign * reach)),
        (item.radius ?? BARBELL.radius) * nearer(reach),
      ),
    ]);
  }
  if (item.kind === "landmine") {
    const to = at(item.to ?? "hands");
    const way = unit(sub(to, item.pivot));
    return [
      item.pivot,
      add(to, times(way, 5)),
      ...round(add(to, times(way, item.plate ?? -9)), BARBELL.radius),
    ];
  }
  if (item.kind === "dumbbells" && item.at) {
    const axis = unit(item.along ?? X);
    return [-1, 1].flatMap((sign) =>
      round(
        add(at(item.at!), times(axis, sign * (DUMBBELL.reach + DUMBBELL.thick / 2))),
        DUMBBELL.radius,
      ),
    );
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
  if (item.kind === "plate") return round(at(item.at ?? "hands"), item.radius ?? PLATE.radius);
  if (item.kind === "ball") return round(at(item.at), item.radius);
  if (item.kind === "bench") return [item.from, item.to, add(item.from, [0, item.high ?? 27, 0])];
  if (item.kind === "pad")
    return [...round(at(item.from), PAD.thick), ...round(at(item.to), PAD.thick)];
  if (item.kind === "bar") {
    const wide = (item.wide ?? 62) / 2;
    return [
      [-wide, item.high, item.z ?? 0],
      [wide, item.high, item.z ?? 0],
      [-wide, 0, item.z ?? 0],
      [wide, 0, item.z ?? 0],
    ];
  }
  if (item.kind === "box") {
    const w = (item.wide ?? 34) / 2;
    const d = (item.deep ?? 34) / 2;
    return [-1, 1].flatMap((sx) =>
      [-1, 1].flatMap((sz): Vec[] => [
        [item.at[0] + sx * w, 0, item.at[2] + sz * d],
        [item.at[0] + sx * w, item.high, item.at[2] + sz * d],
      ]),
    );
  }
  if (item.kind === "handle") {
    const axis = unit(item.along ?? X);
    const half = (item.wide ?? 44) / 2;
    const centre = at(item.at ?? "hands");
    return [add(centre, times(axis, half)), add(centre, times(axis, -half))];
  }
  if (item.kind === "rail") return item.points.map(at);
  if (item.kind === "rope") return [at(item.from), at(item.via), at(item.to)];
  // A kettlebell is placed on the canvas, not in space: see `flatReachOf`.
  if (item.kind === "kettlebell") return [];
  return [at(item.from)];
}

/** What a piece of gear placed on the canvas reaches to there: [x, y, how far round]. */
export function flatReachOf(item: Gear, s: Skeleton, view: View): [number, number, number][] {
  if (item.kind !== "kettlebell") return [];
  const [x, y] = kettlebell(s, view, item.hand).centre;
  return [[x, y, KETTLEBELL.radius * (view.zoom ?? 1)]];
}
