/**
 * The canvas the mannequin and its gear are drawn on: how a point in space lands on it, and the
 * few shapes everything is made of. Paths are SVG path data, in canvas units.
 */
import { add, type Vec } from "./rig";

/** The drawing is this many units square; the figure stands 100 tall in it. */
export const CANVAS = 160;
export const FLOOR = 150;

export interface View {
  /** Where it is seen from: 0 is face on, 90 from the figure's right side, 180 from behind. */
  yaw: number;
  /** How far above eye level, in degrees. A little shows the ground the feet stand on. */
  tilt?: number;
  /** Larger or smaller than life (1), and moved sideways or up, in units. */
  zoom?: number;
  shift?: readonly [number, number];
}

export type Point = readonly [number, number, number];

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
export function towardsViewer(view: View): Vec {
  const yaw = (view.yaw * Math.PI) / 180;
  const tilt = ((view.tilt ?? 0) * Math.PI) / 180;
  return [Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt)];
}

export const n = (value: number) => {
  const text = value.toFixed(1);
  return text === "-0.0" ? "0.0" : text;
};

/** A filled circle. */
export function disc([x, y]: Point | readonly [number, number], r: number): string {
  return `M${n(x - r)} ${n(y)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`;
}

/** A limb: a rounded shape from `a` to `b`, `ra` thick at one end and `rb` at the other. */
export function limb(a: Point, b: Point, ra: number, rb: number): string {
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

export const outline = (points: readonly Point[]) =>
  points.map(([x, y], i) => `${i ? "L" : "M"}${n(x)} ${n(y)}`).join("") + "Z";
export const line = (a: Point, b: Point) => `M${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}`;

/**
 * A round weight (a plate, the head of a dumbbell) seen from anywhere: a short cylinder. End on
 * it is a disc, edge on a bar with soft ends, and in between the outline of the two rims.
 */
export function drum(centre: Vec, axis: Vec, radius: number, thick: number, view: View): string {
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
export function rounded(points: readonly Point[], r: number): string {
  const ring: Point[] = [];
  for (const [x, y] of points)
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * 2 * Math.PI;
      ring.push([x + Math.cos(a) * r, y + Math.sin(a) * r, 0]);
    }
  return hull(ring);
}

/** The outline round a set of points on the canvas (their convex hull), as a closed path. */
export function hull(points: readonly Point[]): string {
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

/** The gap that sets every part of the figure off from what lies behind it. */
export const GAP = 1.3;
