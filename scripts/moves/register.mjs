/**
 * Lines the frames of one exercise up with each other. Upstream, each frame is a drawing of its
 * own: the same bench or the same feet sit a little higher, lower or larger from frame to frame,
 * so the animation jumps. Here every frame is moved and scaled (never turned or bent) until what
 * stays still in the exercise lies on itself. Used by scripts/moves.mjs.
 *
 * A drawing is a cloud of points along its lines, in SVG units (the canvas is `SIZE` square).
 */
import { distanceTo } from "./image.mjs";

export const SIZE = 512;
/** Distance maps are kept at half resolution: one cell is two units. */
const CELL = 2;
const GRID = SIZE / CELL;

/** For every cell of the canvas, the distance in units to the nearest point of the cloud. */
export function distanceMap(points) {
  const hit = new Uint8Array(GRID * GRID);
  for (const [x, y] of points) {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    if (cx >= 0 && cy >= 0 && cx < GRID && cy < GRID) hit[cy * GRID + cx] = 1;
  }
  const map = distanceTo(hit, GRID, GRID);
  for (let i = 0; i < map.length; i++) map[i] *= CELL;
  return map;
}

/** Moves a point by a transform: scaled about the middle of the canvas, then shifted. */
export function apply({ scale, dx, dy }, [x, y]) {
  const c = SIZE / 2;
  return [c + (x - c) * scale + dx, c + (y - c) * scale + dy];
}

/** The transform that undoes `t`. */
export function inverse({ scale, dx, dy }) {
  return { scale: 1 / scale, dx: -dx / scale, dy: -dy / scale };
}

/** `b` after `a`: the single transform that does both. */
export function compose(a, b) {
  return { scale: a.scale * b.scale, dx: a.dx * b.scale + b.dx, dy: a.dy * b.scale + b.dy };
}

export const IDENTITY = { scale: 1, dx: 0, dy: 0 };

/**
 * How far the points land from a drawing, on average, with every miss counted as at most
 * `reach`: 0 when they all lie on its lines, 1 when none is near. Counting misses as no worse
 * than `reach` is what lets the parts that move in the exercise be ignored.
 */
function miss(points, map, t, reach) {
  const c = SIZE / 2;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const x = c + (points[i][0] - c) * t.scale + t.dx;
    const y = c + (points[i][1] - c) * t.scale + t.dy;
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) total += reach;
    else {
      const d = map[cy * GRID + cx];
      total += d < reach ? d : reach;
    }
  }
  return total / (points.length * reach);
}

/** How well `moving`, transformed by `t`, lies on `still` and the other way round: 0 to 1. */
export function overlap(still, moving, t, reach) {
  const back = inverse(t);
  return (
    1 - (miss(moving.points, still.map, t, reach) + miss(still.points, moving.map, back, reach)) / 2
  );
}

/** Every `n`th point, for the coarse passes. */
const thinned = (cloud, n) => ({ ...cloud, points: cloud.points.filter((_, i) => i % n === 0) });

/**
 * The transform that best lays `moving` on `still`, and how sure it is.
 *
 * Laying one drawing on another is ambiguous: in a squat the bar and the feet cannot both stay
 * put. Gravity settles it. With `anchor: "ground"` the lowest points of the two drawings (feet,
 * a bench, the base of a machine) are held level, within `slack`; with `"top"` the highest are
 * (the bar of a pull-up). `"free"` holds nothing and trusts upstream's placement unless the
 * evidence is strong. A frame cut off by the edge of the canvas cannot be anchored there, so it
 * is laid freely.
 *
 * Upstream frames are roughly in place already, so this looks nearby (up to `maxShift` units,
 * 0.7× to 1.43×) and a change must earn its keep: a transform has to beat the plain anchored
 * placement by `margin`, and scale and shift each cost a little.
 *
 * Returns `{ transform, score, gain }`: `score` is the overlap reached (0 to 1), `gain` how much
 * better that is than the plain placement.
 */
export function align(still, moving, options = {}) {
  const { maxShift = 72, margin = 0.02, scaleCost = 0.2, shiftCost = 0.06, slack = 10 } = options;
  const c = SIZE / 2;
  let anchor = options.anchor ?? "free";
  if (anchor === "ground" && (still.cut?.bottom || moving.cut?.bottom)) anchor = "free";
  if (anchor === "top" && (still.cut?.top || moving.cut?.top)) anchor = "free";
  const edge = anchor === "ground" ? "maxY" : "minY";
  /** How far the anchored edge of `moving` ends up from that of `still`. */
  const gap = (t) => c + (moving.box[edge] - c) * t.scale + t.dy - still.box[edge];
  /** The shift that leaves the anchored edges `by` apart at this scale. */
  const held = (scale, by) => by - (c + (moving.box[edge] - c) * scale - still.box[edge]);
  const allowed = (t) =>
    anchor === "free"
      ? Math.hypot(t.dx, t.dy) <= maxShift * 1.2
      : Math.abs(t.dx) <= maxShift * 1.2 && Math.abs(gap(t)) <= slack + 1e-9;

  const coarseStill = thinned(still, 4);
  const coarseMoving = thinned(moving, 4);
  const value = (t, a, b, reach) =>
    overlap(a, b, t, reach) -
    (scaleCost * Math.abs(Math.log(t.scale))) / Math.log(1.43) -
    (shiftCost * (anchor === "free" ? Math.hypot(t.dx, t.dy) : Math.abs(t.dx))) / maxShift;

  // Coarse: every scale and shift on a grid, with a forgiving reach.
  const found = [];
  for (let k = -12; k <= 12; k++) {
    const scale = 1.03 ** k;
    let best = null;
    const rows = [];
    if (anchor === "free") for (let dy = -maxShift; dy <= maxShift; dy += 6) rows.push(dy);
    else for (let by = -slack; by <= slack; by += slack / 3) rows.push(held(scale, by));
    for (const dy of rows)
      for (let dx = -maxShift; dx <= maxShift; dx += 6) {
        const t = { scale, dx, dy };
        const v = value(t, coarseStill, coarseMoving, 12);
        if (!best || v > best.v) best = { t, v };
      }
    found.push(best);
  }
  const plain = anchor === "free" ? IDENTITY : { scale: 1, dx: 0, dy: held(1, 0) };
  const unscaled = found.find((f) => f.t.scale === 1).t;
  found.sort((a, b) => b.v - a.v);
  const starts = [found[0].t, found[1].t, found[2].t, unscaled, plain];

  // Fine: climb from each start, in smaller and smaller steps, with a strict reach.
  const climb = (start, freeScale) => {
    let t = start;
    let v = value(t, still, moving, 5);
    for (const step of [3, 1.5, 0.75, 0.4]) {
      let moved = true;
      while (moved) {
        moved = false;
        const tries = [
          { ...t, dx: t.dx + step },
          { ...t, dx: t.dx - step },
          { ...t, dy: t.dy + step },
          { ...t, dy: t.dy - step },
        ];
        if (freeScale) {
          for (const scale of [t.scale * (1 + step / 150), t.scale / (1 + step / 150)]) {
            // Scaling moves the anchored edge; shift to keep it where it was.
            const dy = anchor === "free" ? t.dy : held(scale, gap(t));
            tries.push({ scale, dx: t.dx, dy });
          }
        }
        for (const next of tries) {
          if (!allowed(next)) continue;
          const nv = value(next, still, moving, 5);
          if (nv > v + 1e-6) {
            t = next;
            v = nv;
            moved = true;
          }
        }
      }
    }
    return { t, v };
  };

  const nothing = value(plain, still, moving, 5);
  let best = { t: plain, v: nothing };
  for (const start of starts) {
    const free = climb(start, true);
    if (free.v > best.v) best = free;
    const fixed = climb(
      { scale: 1, dx: start.dx, dy: anchor === "free" ? start.dy : held(1, gap(start)) },
      false,
    );
    if (fixed.v > best.v) best = fixed;
  }
  const gain = best.v - nothing;
  const transform = gain >= margin ? best.t : plain;
  return {
    transform,
    score: overlap(still, moving, transform, 5),
    gain: gain >= margin ? gain : 0,
    anchor,
  };
}

/**
 * Lines up the three frames of an exercise. Every pair is compared; the two pairs that agree
 * best decide, so one odd frame cannot drag the others. Returns one transform per frame, into a
 * shared space, and the overlap reached by the pairs used.
 */
export function alignFrames(clouds, options) {
  const pairs = [];
  for (let a = 0; a < clouds.length; a++)
    for (let b = a + 1; b < clouds.length; b++) {
      // `b` onto `a`.
      const result = align(clouds[a], clouds[b], options);
      pairs.push({ a, b, ...result });
    }
  pairs.sort((p, q) => q.score - p.score);
  const transforms = new Array(clouds.length).fill(null);
  const root = pairs[0].a;
  transforms[root] = IDENTITY;
  const used = [];
  // Grow a tree from the best pair: each new frame joins through its best link to a placed one.
  while (transforms.includes(null)) {
    const link = pairs.find((p) => (transforms[p.a] === null) !== (transforms[p.b] === null));
    if (transforms[link.b] === null)
      transforms[link.b] = compose(link.transform, transforms[link.a]);
    else transforms[link.a] = compose(inverse(link.transform), transforms[link.b]);
    used.push(link);
  }
  return {
    transforms,
    links: used.map(({ a, b, score, gain, anchor }) => ({ a, b, score, gain, anchor })),
  };
}

/**
 * The transform that fits everything (all frames, already lined up) inside the canvas with the
 * same margin all round, as large as it will go: every exercise then fills its card alike.
 */
export function fit(clouds, transforms, margin) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  clouds.forEach((cloud, i) => {
    for (const point of cloud.points) {
      const [x, y] = apply(transforms[i], point);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  });
  const room = SIZE - 2 * margin;
  const scale = Math.min(room / Math.max(maxX - minX, 1), room / Math.max(maxY - minY, 1));
  const c = SIZE / 2;
  // Scale about the middle of the canvas, then bring the middle of the drawing to it.
  return {
    scale,
    dx: -((minX + maxX) / 2 - c) * scale,
    dy: -((minY + maxY) / 2 - c) * scale,
  };
}
