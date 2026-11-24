/**
 * From a thinned drawing (lines one pixel wide, see `thin` in image.mjs) to strokes: lists of
 * points that follow each line of the drawing, as a pen would. Used by scripts/moves.mjs.
 */
import { NEIGHBOURS, components } from "./image.mjs";

const { DX, DY } = NEIGHBOURS;

/**
 * Reads the skeleton as a graph. Nodes are line ends and junctions (a junction is a cluster of
 * touching pixels with three or more neighbours); edges are the runs of pixels between them.
 * Loops with no node at all come back as edges whose `from` and `to` are -1.
 */
export function graph(skeleton, w, h) {
  const degree = new Uint8Array(w * h);
  const pixels = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!skeleton[i]) continue;
      let n = 0;
      for (let k = 0; k < 8; k++) n += skeleton[i + DY[k] * w + DX[k]];
      degree[i] = n;
      pixels.push(i);
    }
  }

  // Nodes: every end (one neighbour), every lone pixel, every cluster of junction pixels.
  const nodeOf = new Int32Array(w * h).fill(-1);
  const nodes = [];
  for (const start of pixels) {
    if (nodeOf[start] >= 0 || degree[start] === 2) continue;
    const id = nodes.length;
    const members = [start];
    nodeOf[start] = id;
    if (degree[start] >= 3) {
      for (let m = 0; m < members.length; m++) {
        const i = members[m];
        for (let k = 0; k < 8; k++) {
          const j = i + DY[k] * w + DX[k];
          if (skeleton[j] && degree[j] >= 3 && nodeOf[j] < 0) {
            nodeOf[j] = id;
            members.push(j);
          }
        }
      }
    }
    let sx = 0;
    let sy = 0;
    for (const i of members) {
      sx += i % w;
      sy += Math.floor(i / w);
    }
    nodes.push({
      id,
      members,
      x: sx / members.length,
      y: sy / members.length,
      junction: degree[start] >= 3,
      edges: [],
    });
  }

  const edges = [];
  const seen = new Uint8Array(w * h);
  const point = (i) => [i % w, Math.floor(i / w)];
  const addEdge = (from, to, run) => {
    const points = run.map(point);
    if (from >= 0) points.unshift([nodes[from].x, nodes[from].y]);
    if (to >= 0) points.push([nodes[to].x, nodes[to].y]);
    const edge = { id: edges.length, from, to, run, points };
    edges.push(edge);
    if (from >= 0) nodes[from].edges.push(edge);
    if (to >= 0 && (to !== from || run.length)) nodes[to].edges.push(edge);
  };

  /** Follows plain pixels from `first` (coming from `prev`) until it meets a node. */
  const walk = (prev, first) => {
    const run = [];
    let before = prev;
    let at = first;
    while (nodeOf[at] < 0) {
      seen[at] = 1;
      run.push(at);
      let next = -1;
      for (let k = 0; k < 8; k++) {
        const j = at + DY[k] * w + DX[k];
        if (!skeleton[j] || j === before) continue;
        // Prefer the way on over stepping back into the node we just left.
        if (next < 0 || (nodeOf[next] >= 0 && nodeOf[j] < 0 && !seen[j])) next = j;
      }
      if (next < 0 || (nodeOf[next] < 0 && seen[next])) return { run, to: -1 };
      before = at;
      at = next;
    }
    return { run, to: nodeOf[at] };
  };

  const joined = new Set();
  for (const node of nodes) {
    for (const i of node.members) {
      for (let k = 0; k < 8; k++) {
        const j = i + DY[k] * w + DX[k];
        if (!skeleton[j]) continue;
        if (nodeOf[j] < 0) {
          if (seen[j]) continue;
          const { run, to } = walk(i, j);
          // A run of one or two pixels that leaves a junction and comes straight back is a
          // thinning artefact, not a loop.
          if (to === node.id && run.length < 3) continue;
          addEdge(node.id, to, run);
        } else if (nodeOf[j] !== node.id) {
          // Two nodes side by side: an end right next to a junction, or two ends.
          const key = Math.min(node.id, nodeOf[j]) + ":" + Math.max(node.id, nodeOf[j]);
          if (!joined.has(key)) {
            joined.add(key);
            addEdge(node.id, nodeOf[j], []);
          }
        }
      }
    }
  }

  // What is left are closed loops that touch no node.
  for (const start of pixels) {
    if (seen[start] || nodeOf[start] >= 0) continue;
    const run = [];
    let before = -1;
    let at = start;
    while (at >= 0 && !seen[at]) {
      seen[at] = 1;
      run.push(at);
      let next = -1;
      for (let k = 0; k < 8; k++) {
        const j = at + DY[k] * w + DX[k];
        if (skeleton[j] && j !== before && !seen[j]) next = j;
      }
      before = at;
      at = next;
    }
    if (run.length > 2) addEdge(-1, -1, run);
  }
  return { nodes, edges };
}

export function lengthOf(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++)
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return total;
}

/**
 * Removes the short side branches thinning grows towards every corner and bristle of a stroke:
 * an edge from a junction to a free end is a spur when it is not much longer than the stroke is
 * wide there. Returns the pruned skeleton. `depths` is the depth map of the ink.
 */
export function prune(skeleton, w, h, depths, reach = 2, rounds = 3) {
  let current = skeleton;
  for (let round = 0; round < rounds; round++) {
    const { nodes, edges } = graph(current, w, h);
    const next = Uint8Array.from(current);
    let removed = 0;
    for (const edge of edges) {
      if (edge.from < 0 || edge.to < 0 || edge.from === edge.to) continue;
      const a = nodes[edge.from];
      const b = nodes[edge.to];
      const [end, junction] = a.junction ? [b, a] : [a, b];
      if (end.junction || !junction.junction || end.edges.length !== 1) continue;
      const here = depths[Math.round(junction.y) * w + Math.round(junction.x)];
      if (lengthOf(edge.points) > reach * here + 2) continue;
      for (const i of edge.run) next[i] = 0;
      for (const i of end.members) next[i] = 0;
      removed++;
    }
    if (!removed) break;
    current = next;
  }
  return current;
}

/** The direction an edge leaves one of its ends in, measured a few pixels along it. */
function heading(points, fromStart, reach) {
  const n = points.length;
  const origin = fromStart ? points[0] : points[n - 1];
  let travelled = 0;
  let k = fromStart ? 1 : n - 2;
  let at = origin;
  while (k >= 0 && k < n) {
    travelled += Math.hypot(points[k][0] - at[0], points[k][1] - at[1]);
    at = points[k];
    if (travelled >= reach) break;
    k += fromStart ? 1 : -1;
  }
  const dx = at[0] - origin[0];
  const dy = at[1] - origin[1];
  const size = Math.hypot(dx, dy) || 1;
  return [dx / size, dy / size];
}

/**
 * Joins edges into strokes. Where lines meet, the two that carry straight on through the
 * junction become one stroke, as the pen that drew them did, and the others end there. Returns
 * `{ points, closed }` for each stroke.
 */
export function strokes({ nodes, edges }, reach = 10) {
  // partner[2 * edge + side] is the edge end this end continues into (side 0 = from, 1 = to).
  const partner = new Int32Array(edges.length * 2).fill(-1);
  for (const node of nodes) {
    if (!node.junction) continue;
    const ends = [];
    for (const edge of node.edges) {
      if (edge.from === node.id)
        ends.push({ key: edge.id * 2, dir: heading(edge.points, true, reach) });
      if (edge.to === node.id && (edge.from !== node.id || edge.run.length))
        ends.push({ key: edge.id * 2 + 1, dir: heading(edge.points, false, reach) });
    }
    const pairs = [];
    for (let a = 0; a < ends.length; a++)
      for (let b = a + 1; b < ends.length; b++) {
        if (ends[a].key >> 1 === ends[b].key >> 1) continue;
        const dot = ends[a].dir[0] * ends[b].dir[0] + ends[a].dir[1] * ends[b].dir[1];
        // Straight on means the two leave in opposite directions (within about 35 degrees).
        if (dot < -0.82) pairs.push({ a: ends[a].key, b: ends[b].key, dot });
      }
    pairs.sort((p, q) => p.dot - q.dot);
    for (const { a, b } of pairs) {
      if (partner[a] >= 0 || partner[b] >= 0) continue;
      partner[a] = b;
      partner[b] = a;
    }
  }

  const used = new Uint8Array(edges.length);
  const out = [];
  const follow = (startKey) => {
    // Walk from an end with no partner, edge after edge, until the line stops.
    const points = [];
    const through = [];
    let key = startKey;
    let closed = false;
    let last = -1;
    while (key >= 0) {
      const edge = edges[key >> 1];
      if (used[edge.id]) {
        closed = true;
        break;
      }
      used[edge.id] = 1;
      through.push(edge.id);
      const run = key & 1 ? [...edge.points].reverse() : edge.points;
      for (let i = points.length ? 1 : 0; i < run.length; i++) points.push(run[i]);
      last = key & 1 ? edge.from : edge.to;
      key = partner[key ^ 1];
    }
    const first = startKey & 1 ? edges[startKey >> 1].to : edges[startKey >> 1].from;
    // `edges` are the graph edges the stroke runs along; `ends` the nodes it starts and stops at.
    return { points, closed, edges: through, ends: closed ? [] : [first, last] };
  };
  for (const edge of edges) {
    if (used[edge.id]) continue;
    if (edge.from < 0) {
      used[edge.id] = 1;
      out.push({ points: edge.points, closed: true, edges: [edge.id], ends: [] });
    } else if (partner[edge.id * 2] < 0) out.push(follow(edge.id * 2));
    else if (partner[edge.id * 2 + 1] < 0) out.push(follow(edge.id * 2 + 1));
  }
  // Rings of edges that all continue into each other.
  for (const edge of edges) if (!used[edge.id]) out.push({ ...follow(edge.id * 2), closed: true });
  // A pixel on its own is a dot: an eye, a navel, the end of a bar seen head-on.
  for (const node of nodes)
    if (!node.edges.length)
      out.push({ points: [[node.x, node.y]], closed: false, edges: [], ends: [node.id, node.id] });
  for (const stroke of out) {
    const { points } = stroke;
    const last = points.length - 1;
    if (
      stroke.closed &&
      last > 0 &&
      points[0][0] === points[last][0] &&
      points[0][1] === points[last][1]
    )
      points.pop();
  }
  return out.filter((s) => s.points.length);
}

/**
 * Where a stroke turns a real corner (the leg of a bench, an elbow of a frame), as opposed to
 * bending. Measured over `reach` points to either side, so the pixel staircase does not count.
 * Returns the indices of the corner points.
 */
export function corners(points, closed, reach, degrees = 50) {
  const n = points.length;
  if (n < 2 * reach + 1) return [];
  const limit = Math.cos((degrees * Math.PI) / 180);
  const at = (i) => points[closed ? ((i % n) + n) % n : i];
  const turn = new Float64Array(n).fill(1);
  for (let i = closed ? 0 : reach; i < (closed ? n : n - reach); i++) {
    const a = at(i - reach);
    const b = at(i);
    const c = at(i + reach);
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const vx = c[0] - b[0];
    const vy = c[1] - b[1];
    turn[i] = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1);
  }
  const found = [];
  for (let i = 0; i < n; i++) {
    if (turn[i] > limit) continue;
    // The sharpest point of its neighbourhood only.
    let sharpest = true;
    for (let k = -reach; k <= reach && sharpest; k++) {
      const j = closed ? (((i + k) % n) + n) % n : i + k;
      if (j < 0 || j >= n || j === i) continue;
      if (turn[j] < turn[i] || (turn[j] === turn[i] && j < i)) sharpest = false;
    }
    if (sharpest) found.push(i);
  }
  return found;
}

/**
 * Smooths a stroke: the pixel staircase becomes a curve. Each point moves to a Gaussian-weighted
 * average of its neighbours along the line. The ends of an open stroke and the `pinned` points
 * (its corners) stay where they are, and nothing is averaged across them.
 */
export function smooth(points, closed, sigma, pinned = []) {
  const n = points.length;
  if (n < 3 || sigma <= 0) return points;
  const radius = Math.ceil(sigma * 3);
  const kernel = [];
  for (let k = -radius; k <= radius; k++) kernel.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  // How many points away the nearest fixed point is, along the stroke.
  const room = new Int32Array(n).fill(radius);
  const fixed = [...pinned];
  if (!closed) fixed.push(0, n - 1);
  for (const f of fixed)
    for (let k = -radius; k <= radius; k++) {
      const j = closed ? (((f + k) % n) + n) % n : f + k;
      if (j >= 0 && j < n) room[j] = Math.min(room[j], Math.abs(k));
    }
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const span = room[i];
    if (!span) {
      out[i] = points[i];
      continue;
    }
    let x = 0;
    let y = 0;
    let total = 0;
    for (let k = -span; k <= span; k++) {
      const p = points[closed ? (((i + k) % n) + n) % n : i + k];
      const weight = kernel[k + radius];
      x += p[0] * weight;
      y += p[1] * weight;
      total += weight;
    }
    out[i] = [x / total, y / total];
  }
  return out;
}

/** Drops the points a line does not need: none of them was further than `tolerance` from it. */
export function simplify(points, tolerance) {
  const n = points.length;
  if (n < 3) return points;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const dx = points[b][0] - ax;
    const dy = points[b][1] - ay;
    const size = Math.hypot(dx, dy);
    let worst = 0;
    let index = -1;
    for (let i = a + 1; i < b; i++) {
      const px = points[i][0] - ax;
      const py = points[i][1] - ay;
      const off = size ? Math.abs(px * dy - py * dx) / size : Math.hypot(px, py);
      if (off > worst) {
        worst = off;
        index = i;
      }
    }
    if (worst > tolerance) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * Takes the detail out of a drawing and leaves what it is a drawing of. Seen small, the marks
 * inside a figure (muscles, creases, the plates of a weight stack) crowd it; its outline, its
 * limbs, its clothes and the machine are what read.
 *
 * What tells a contour from a mark is what lies on either side. A drawing divides the canvas
 * into faces: the outside, and every area its lines enclose (`faces` in image.mjs). A contour
 * has a different face on each side: body and outside, arm and chest, shorts and thigh. A mark
 * has the same enclosed face on both: it is a line drawn on something, not the edge of
 * anything. Marks shorter than `mark` pixels go. Lines with the outside on both sides (a cable,
 * a bar drawn as one line) are not marks and stay. When it cannot tell, a line stays.
 *
 * Finding the face beside a line takes two looks. Close by (`near` pixels) is enough for most.
 * Where lines crowd together there is no open face nearby, so the second look goes further
 * (`far` pixels), straight through other undecided lines, and stops at the first line already
 * known to be a contour: the face on this side of that contour is the answer.
 *
 * Small faces (under `cell` pixels: a kneecap, the squares of a six-pack) are first merged into
 * the enclosed neighbour they share most of their edge with, so the line between them goes too.
 * A small face that is round (a head, the end of a dumbbell) is a thing in its own right and is
 * left alone. Scraps shorter than `speck` go unless out in the open.
 */
export function declutter(skeleton, w, h, faces, { mark, cell, near, far, speck }) {
  const g = graph(skeleton, w, h);
  const lines = strokes(g);
  const { labels, areas, outside, round } = faces;
  const UNKNOWN = -1;
  /** The face at a point: 0 outside, UNKNOWN on a line or where lines were closed together. */
  const faceAt = (x, y) => {
    const cx = Math.round(x);
    const cy = Math.round(y);
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) return 0;
    const label = labels[cy * w + cx];
    return label ? (outside[label] ? 0 : label) : UNKNOWN;
  };

  // Which stroke, and which of its points, each pixel of the skeleton belongs to.
  const owner = new Int32Array(w * h).fill(-1);
  const index = new Int32Array(w * h);
  lines.forEach(({ points }, n) => {
    points.forEach(([x, y], k) => {
      const i = Math.round(y) * w + Math.round(x);
      if (owner[i] < 0) {
        owner[i] = n;
        index[i] = k;
      }
    });
  });
  const tangent = (points, k) => {
    const a = points[Math.max(0, k - 3)];
    const b = points[Math.min(points.length - 1, k + 3)];
    const size = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / size, (b[1] - a[1]) / size];
  };
  /** The two normals of a stroke at a point: side 0 and side 1. */
  const normals = ([tx, ty]) => [
    [ty, -tx],
    [-ty, tx],
  ];

  // First look: the face close by on each side, for every few points of every stroke.
  const samples = lines.map(({ points }) => {
    const found = [];
    if (points.length < 2) return found;
    for (let k = 0; k < points.length; k += 3) {
      const sides = [UNKNOWN, UNKNOWN];
      normals(tangent(points, k)).forEach(([nx, ny], side) => {
        for (let d = near[0]; d <= near[1] && sides[side] === UNKNOWN; d += 1)
          sides[side] = faceAt(points[k][0] + nx * d, points[k][1] + ny * d);
      });
      found.push({ k, sides });
    }
    return found;
  });

  // Merge small faces into the enclosed neighbour they touch most.
  const parent = new Int32Array(areas.length).map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  const touching = new Map();
  for (const found of samples)
    for (const {
      sides: [a, b],
    } of found) {
      if (a <= 0 || b <= 0 || a === b) continue;
      const key = a < b ? a * areas.length + b : b * areas.length + a;
      touching.set(key, (touching.get(key) ?? 0) + 1);
    }
  const small = [];
  for (let face = 1; face < areas.length; face++)
    if (!outside[face] && areas[face] < cell && !round[face]) small.push(face);
  small.sort((a, b) => areas[a] - areas[b]);
  for (const face of small) {
    let best = -1;
    let most = 0;
    for (const [key, count] of touching) {
      const a = Math.floor(key / areas.length);
      const b = key % areas.length;
      const other = a === face ? b : b === face ? a : -1;
      if (other > 0 && count > most && find(other) !== find(face)) {
        most = count;
        best = other;
      }
    }
    if (best > 0) parent[find(face)] = find(best);
  }
  const same = (a, b) => a === b || (a > 0 && b > 0 && find(a) === find(b));

  /** The face a stroke mostly has on one side, among the samples that could tell. */
  const mostly = (found, side) => {
    const votes = new Map();
    for (const { sides } of found) {
      const face = sides[side];
      if (face === UNKNOWN) continue;
      const key = face > 0 ? find(face) : 0;
      votes.set(key, (votes.get(key) ?? 0) + 1);
    }
    let best = UNKNOWN;
    let most = 0;
    for (const [face, count] of votes)
      if (count > most) {
        most = count;
        best = face;
      }
    return { face: best, share: found.length ? most / found.length : 0 };
  };

  // A stroke is a contour once both its sides are known and differ.
  const contour = new Uint8Array(lines.length);
  const side = lines.map(() => [UNKNOWN, UNKNOWN]);
  const settle = () => {
    let news = 0;
    lines.forEach((_, n) => {
      if (contour[n]) return;
      const a = mostly(samples[n], 0);
      const b = mostly(samples[n], 1);
      if (a.face === UNKNOWN || b.face === UNKNOWN || a.share < 0.3 || b.share < 0.3) return;
      if (same(a.face, b.face)) return;
      contour[n] = 1;
      side[n] = [a.face, b.face];
      news++;
    });
    return news;
  };
  settle();

  // Second look, for sides still unknown: further out, through undecided lines, up to the first
  // contour. Repeated while it keeps finding new contours.
  for (let round = 0; round < 3; round++) {
    lines.forEach(({ points }, n) => {
      if (contour[n]) return;
      for (const sample of samples[n]) {
        const [x, y] = points[sample.k];
        normals(tangent(points, sample.k)).forEach(([nx, ny], s) => {
          if (sample.sides[s] !== UNKNOWN) return;
          for (let d = near[0]; d <= far; d += 1) {
            const px = x + nx * d;
            const py = y + ny * d;
            const face = faceAt(px, py);
            if (face !== UNKNOWN) {
              sample.sides[s] = face;
              return;
            }
            const i = Math.round(py) * w + Math.round(px);
            const hit = owner[i];
            if (hit < 0 || hit === n || !contour[hit]) continue;
            // We came from the side of that contour its normal points back along our ray to.
            const [n0] = normals(tangent(lines[hit].points, index[i]));
            const from = n0[0] * -nx + n0[1] * -ny > 0 ? 0 : 1;
            sample.sides[s] = side[hit][from];
            return;
          }
        });
      }
    });
    if (!settle()) break;
  }

  const next = Uint8Array.from(skeleton);
  const dead = new Uint8Array(g.edges.length);
  lines.forEach((line, n) => {
    if (!line.edges.length) {
      // A dot stays only out in the open.
      const [x, y] = line.points[0];
      let open = 0;
      for (const [ux, uy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        let face = UNKNOWN;
        for (let d = near[0]; d <= far && face === UNKNOWN; d += 2)
          face = faceAt(x + ux * d, y + uy * d);
        if (face === 0) open++;
      }
      if (open < 4) for (const i of g.nodes[line.ends[0]].members) next[i] = 0;
      return;
    }
    const found = samples[n];
    const length = lengthOf(line.points);
    if (contour[n] || !found.length || length >= mark) return;
    let marks = 0;
    let open = 0;
    for (const {
      sides: [a, b],
    } of found) {
      if (a > 0 && b > 0 && same(a, b)) marks++;
      if (a === 0 && b === 0) open++;
    }
    // A scrap too short to be anything goes unless it clearly lies out in the open.
    if (length < speck ? open === found.length : marks < 0.6 * found.length) return;
    for (const id of line.edges) {
      dead[id] = 1;
      for (const i of g.edges[id].run) next[i] = 0;
    }
  });
  // A line end or a junction with nothing left attached goes with its strokes.
  for (const node of g.nodes)
    if (node.edges.length && node.edges.every((edge) => dead[edge.id]))
      for (const i of node.members) next[i] = 0;
  // Crumbs left where several marks met.
  const bits = components(next, w, h, true);
  for (let i = 0; i < next.length; i++)
    if (next[i] && bits.areas[bits.labels[i]] < speck && faceAt(i % w, Math.floor(i / w)) !== 0)
      next[i] = 0;
  return next;
}

/**
 * Where a drawing's outline could be completed: for every loose end of a line, the straight
 * stretch from that end, carrying on the way it was heading (or a little to either side), to the
 * next line it would meet within `reach` pixels. `ink` is the drawing the skeleton came from;
 * a stretch starts once it is clear of the ink around its own end. Returns the stretches as
 * pairs of points. Which of them really close an outline is for the caller to judge.
 */
export function looseEnds(skeleton, ink, w, h, reach) {
  const { nodes } = graph(skeleton, w, h);
  const out = [];
  for (const node of nodes) {
    if (node.junction || node.edges.length !== 1) continue;
    const { points, from } = node.edges[0];
    if (points.length < 4) continue;
    const [dx, dy] = heading(points, from === node.id, 12);
    // `heading` points along the line, away from this end; the gap lies the other way.
    let best = null;
    for (const turn of [0, -0.3, 0.3]) {
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      const ux = -(dx * cos - dy * sin);
      const uy = -(dx * sin + dy * cos);
      let clear = false;
      for (let d = 1; d <= reach; d++) {
        const x = Math.round(node.x + ux * d);
        const y = Math.round(node.y + uy * d);
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) break;
        const on = ink[y * w + x];
        if (!on) clear = true;
        else if (clear) {
          if (!best || d < best.d) best = { d, to: [node.x + ux * (d + 2), node.y + uy * (d + 2)] };
          break;
        }
      }
    }
    if (best) out.push([[node.x, node.y], best.to]);
  }
  return out;
}
