/**
 * In-between poses. Upstream draws three key poses per exercise; played alone, the figure jumps
 * from one to the next. Here a pose halfway between two keys is drawn, the way an in-betweener
 * would: find which point of the first pose's silhouette becomes which point of the second's,
 * and bend the first drawing until every such point is halfway there.
 *
 * Used by scripts/moves.mjs. A drawing is a list of strokes, `{ points, closed }`, in SVG units.
 */
import { components, drawLine, faces } from "./image.mjs";
import { SIZE } from "./register.mjs";

/** Silhouettes are worked out at one pixel per unit. */
const W = SIZE;

/**
 * The silhouettes in a drawing: for each solid shape its lines make (a figure with its bench, a
 * machine standing apart), the outline as a ring of points about `step` units apart, clockwise,
 * and the pixels it covers. `pen` is the width the drawing is drawn with.
 */
export function silhouettes(drawing, pen, step = 4) {
  const ink = new Uint8Array(W * W);
  for (const { points, closed } of drawing) {
    const path = closed && points.length > 2 ? [...points, points[0]] : points;
    if (path.length === 1) drawLine(ink, W, W, path[0], path[0], Math.round(pen));
    for (let i = 1; i < path.length; i++)
      drawLine(ink, W, W, path[i - 1], path[i], Math.round(pen));
  }
  const { labels, outside } = faces(ink, W, W, 4);
  const solid = new Uint8Array(W * W);
  for (let i = 0; i < solid.length; i++) solid[i] = !labels[i] || !outside[labels[i]] ? 1 : 0;
  const parts = components(solid, W, W, true);
  const out = [];
  for (let label = 1; label < parts.areas.length; label++) {
    if (parts.areas[label] < 120) continue;
    const ring = resample(boundary(parts.labels, label), step);
    if (ring.length >= 8) out.push({ ring, area: parts.areas[label], label, labels: parts.labels });
  }
  return out.sort((a, b) => b.area - a.area);
}

// Neighbours clockwise from west, for following an edge with the shape on the right hand.
const RX = [-1, -1, 0, 1, 1, 1, 0, -1];
const RY = [0, -1, -1, -1, 0, 1, 1, 1];

/** The outer edge of one labelled shape, pixel by pixel, clockwise (Moore tracing). */
function boundary(labels, label) {
  let start = -1;
  for (let i = 0; i < labels.length && start < 0; i++) if (labels[i] === label) start = i;
  const at = (x, y) => x >= 0 && y >= 0 && x < W && y < W && labels[y * W + x] === label;
  const points = [];
  let x = start % W;
  let y = Math.floor(start / W);
  // We arrived at the first pixel from the west, so the search starts there.
  let from = 0;
  const first = { x, y };
  for (let guard = 0; guard < 4 * W * W; guard++) {
    points.push([x, y]);
    let found = -1;
    for (let k = 0; k < 8; k++) {
      const d = (from + k) % 8;
      if (at(x + RX[d], y + RY[d])) {
        found = d;
        break;
      }
    }
    if (found < 0) break; // a single pixel
    x += RX[found];
    y += RY[found];
    // Next time, start looking from the last empty pixel seen before this step.
    from = (found + (found % 2 ? 5 : 6)) % 8;
    if (x === first.x && y === first.y && points.length > 2) break;
  }
  return points;
}

/** A closed ring of points, respaced about `step` apart and lightly smoothed. */
function resample(ring, step) {
  const n = ring.length;
  if (n < 3) return ring;
  let total = 0;
  const along = [0];
  for (let i = 1; i <= n; i++) {
    const a = ring[i - 1];
    const b = ring[i % n];
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
    along.push(total);
  }
  const count = Math.max(8, Math.round(total / step));
  const out = [];
  let k = 0;
  for (let i = 0; i < count; i++) {
    const target = (i * total) / count;
    while (along[k + 1] < target) k++;
    const a = ring[k % n];
    const b = ring[(k + 1) % n];
    const t = (target - along[k]) / (along[k + 1] - along[k] || 1);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  // Take the pixel staircase off.
  return out.map((_, i) => {
    let x = 0;
    let y = 0;
    for (let d = -2; d <= 2; d++) {
      const p = out[(i + d + count) % count];
      x += p[0];
      y += p[1];
    }
    return [x / 5, y / 5];
  });
}

/** For each point of a ring: which way the outline heads there, and how sharply it turns. */
function describe(ring) {
  const n = ring.length;
  const heading = (i, reach) => {
    const a = ring[(i - reach + n) % n];
    const b = ring[(i + reach) % n];
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  const turn = (i, reach) => {
    let d = heading((i + reach) % n, reach) - heading((i - reach + n) % n, reach);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  };
  return ring.map((_, i) => ({ heading: heading(i, 2), bend: turn(i, 3), sweep: turn(i, 8) }));
}

/**
 * Which point of ring `a` becomes which point of ring `b`. Both run clockwise, and the frames are
 * lined up already, so the outlines are walked together: a point may only be matched after the
 * one before it. Among all such walks, the one where matched points are close, head the same
 * way and turn alike costs least (dynamic time warping). Returns `pairs` of indices and the
 * mean cost per step, a measure of how alike the two outlines are.
 */
export function matchRings(a, b) {
  const n = a.length;
  const m = b.length;
  const da = describe(a);
  const db = describe(b);
  // Start where the two outlines agree best: a point that stays put.
  let start = [0, 0];
  let nearest = Infinity;
  for (let i = 0; i < n; i += 2)
    for (let j = 0; j < m; j += 2) {
      const d =
        Math.hypot(a[i][0] - b[j][0], a[i][1] - b[j][1]) +
        12 * (1 - Math.cos(da[i].heading - db[j].heading));
      if (d < nearest) {
        nearest = d;
        start = [i, j];
      }
    }
  const cost = (i, j) => {
    const p = a[(start[0] + i) % n];
    const q = b[(start[1] + j) % m];
    const u = da[(start[0] + i) % n];
    const v = db[(start[1] + j) % m];
    return (
      Math.hypot(p[0] - q[0], p[1] - q[1]) / 30 +
      (1 - Math.cos(u.heading - v.heading)) +
      Math.abs(u.bend - v.bend) / 2 +
      Math.abs(u.sweep - v.sweep) / 2
    );
  };
  // Standing still on one outline while the other moves on stretches it; that costs a little.
  const WAIT = 0.35;
  const best = new Float64Array((n + 1) * (m + 1)).fill(Infinity);
  const came = new Uint8Array((n + 1) * (m + 1));
  best[0] = cost(0, 0);
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= m; j++) {
      if (!i && !j) continue;
      const here = cost(i % n, j % m);
      let value = Infinity;
      let via = 0;
      if (i && j && best[(i - 1) * (m + 1) + j - 1] < value) {
        value = best[(i - 1) * (m + 1) + j - 1];
        via = 1;
      }
      if (i && best[(i - 1) * (m + 1) + j] + WAIT < value) {
        value = best[(i - 1) * (m + 1) + j] + WAIT;
        via = 2;
      }
      if (j && best[i * (m + 1) + j - 1] + WAIT < value) {
        value = best[i * (m + 1) + j - 1] + WAIT;
        via = 3;
      }
      best[i * (m + 1) + j] = value + here;
      came[i * (m + 1) + j] = via;
    }
  const pairs = [];
  let i = n;
  let j = m;
  while (i || j) {
    pairs.push([(start[0] + i) % n, (start[1] + j) % m]);
    const via = came[i * (m + 1) + j];
    if (via === 1) {
      i--;
      j--;
    } else if (via === 2) i--;
    else j--;
  }
  pairs.reverse();
  return { pairs, cost: best[n * (m + 1) + m] / pairs.length };
}

/**
 * Bends points so that each handle `from[i]` lands on `to[i]` and everything in between follows
 * as rigidly as it can: no part is stretched or sheared, only moved and turned (moving least
 * squares, Schaefer et al. 2006). Returns the bent points.
 */
export function bend(points, from, to) {
  const n = from.length;
  if (!n) return points;
  return points.map(([vx, vy]) => {
    let total = 0;
    let px = 0;
    let py = 0;
    let qx = 0;
    let qy = 0;
    const weights = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const d2 = (from[i][0] - vx) ** 2 + (from[i][1] - vy) ** 2;
      // On a handle: go exactly where it goes.
      if (d2 < 1e-9) return [to[i][0], to[i][1]];
      const w = 1 / (d2 * d2);
      weights[i] = w;
      total += w;
      px += w * from[i][0];
      py += w * from[i][1];
      qx += w * to[i][0];
      qy += w * to[i][1];
    }
    px /= total;
    py /= total;
    qx /= total;
    qy /= total;
    // The best turn about the weighted centres: sum of dot and cross of the handle offsets.
    let dot = 0;
    let cross = 0;
    for (let i = 0; i < n; i++) {
      const ax = from[i][0] - px;
      const ay = from[i][1] - py;
      const bx = to[i][0] - qx;
      const by = to[i][1] - qy;
      dot += weights[i] * (ax * bx + ay * by);
      cross += weights[i] * (ax * by - ay * bx);
    }
    const size = Math.hypot(dot, cross) || 1;
    const cos = dot / size;
    const sin = cross / size;
    const dx = vx - px;
    const dy = vy - py;
    return [qx + cos * dx - sin * dy, qy + sin * dx + cos * dy];
  });
}

/** How much two shapes cover each other: shared pixels over all their pixels. */
function overlapOf(a, b) {
  let both = 0;
  let either = 0;
  for (let i = 0; i < a.labels.length; i++) {
    const inA = a.labels[i] === a.label;
    const inB = b.labels[i] === b.label;
    if (inA && inB) both++;
    if (inA || inB) either++;
  }
  return either ? both / either : 0;
}

/** Where the handles of drawing `a` go to bring it halfway to drawing `b`. */
function handles(a, b, pen) {
  const shapesA = silhouettes(a, pen);
  const shapesB = silhouettes(b, pen);
  const from = [];
  const to = [];
  for (const shape of shapesA) {
    // The shape of `b` this one turns into: the one it overlaps most.
    let partner = null;
    let most = 0;
    for (const other of shapesB) {
      const shared = overlapOf(shape, other);
      if (shared > most) {
        most = shared;
        partner = other;
      }
    }
    if (!partner) {
      // Nothing like it in the other pose: hold it where it is.
      for (const p of shape.ring) {
        from.push(p);
        to.push(p);
      }
      continue;
    }
    const { pairs } = matchRings(shape.ring, partner.ring);
    // Where each point of the outline goes: the average of everything it was matched with.
    const sum = shape.ring.map(() => [0, 0, 0]);
    for (const [i, j] of pairs) {
      sum[i][0] += partner.ring[j][0];
      sum[i][1] += partner.ring[j][1];
      sum[i][2]++;
    }
    const n = shape.ring.length;
    const goal = sum.map(([x, y, count], i) => (count ? [x / count, y / count] : shape.ring[i]));
    for (let i = 0; i < n; i += 2) {
      // Smooth the journeys of neighbouring points, then go half the way.
      let dx = 0;
      let dy = 0;
      for (let d = -3; d <= 3; d++) {
        const k = (i + d + n) % n;
        dx += goal[k][0] - shape.ring[k][0];
        dy += goal[k][1] - shape.ring[k][1];
      }
      from.push(shape.ring[i]);
      to.push([shape.ring[i][0] + dx / 14, shape.ring[i][1] + dy / 14]);
    }
  }
  return { from, to };
}

const halfway = (a, b, pen) => {
  const { from, to } = handles(a, b, pen);
  return a.map(({ points, closed }) => ({ points: bend(points, from, to), closed }));
};

/** Every solid pixel of a drawing, whichever shape it belongs to. */
function solidOf(drawing, pen) {
  const shapes = silhouettes(drawing, pen);
  const out = new Uint8Array(W * W);
  for (const { labels, label } of shapes)
    for (let i = 0; i < out.length; i++) if (labels[i] === label) out[i] = 1;
  return out;
}

/**
 * The pose halfway from drawing `a` to drawing `b`: `a` itself, bent until its silhouette is
 * halfway to `b`'s.
 *
 * Matching two drawings of a figure is guesswork when they differ much, and a wrong guess tears
 * the figure. So the answer is checked against itself: the pose halfway from `b` back to `a`
 * should be the same pose. `agreement` is how much the two silhouettes cover each other (1 is
 * perfect), and `strain` how much the most stretched part of a line grew (1 is none). Callers
 * decide what is good enough to show.
 */
export function between(a, b, pen) {
  const strokes = halfway(a, b, pen);
  const back = halfway(b, a, pen);
  const one = solidOf(strokes, pen);
  const other = solidOf(back, pen);
  let both = 0;
  let either = 0;
  for (let i = 0; i < one.length; i++) {
    if (one[i] && other[i]) both++;
    if (one[i] || other[i]) either++;
  }
  const grown = [];
  strokes.forEach(({ points }, s) => {
    for (let i = 1; i < points.length; i++) {
      const before = Math.hypot(
        a[s].points[i][0] - a[s].points[i - 1][0],
        a[s].points[i][1] - a[s].points[i - 1][1],
      );
      const after = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      if (before > 1.5) grown.push(after / before);
    }
  });
  grown.sort((x, y) => x - y);
  return {
    strokes,
    agreement: either ? both / either : 0,
    strain: grown.length ? grown[Math.floor(grown.length * 0.99)] : 1,
  };
}
