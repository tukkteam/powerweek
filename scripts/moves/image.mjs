/**
 * Binary image operations for the move library pipeline (scripts/moves.mjs). An image is a
 * Uint8Array of 0 and 1, row by row, with its width and height passed alongside. Nothing here
 * knows about drawings: distances, morphology, connected components and thinning.
 */

const INF = 1e20;

/** One-dimensional squared distance transform (Felzenszwalb and Huttenlocher). */
function transform1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s;
    do {
      const p = v[k];
      s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
    } while (s <= z[k] && --k >= 0);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const p = v[k];
    d[q] = (q - p) * (q - p) + f[p];
  }
}

/**
 * For every pixel, the distance to the nearest pixel where `features` is set (0 on a feature).
 * Exact Euclidean distances, in pixels.
 */
export function distanceTo(features, w, h) {
  const out = new Float64Array(w * h);
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = features[y * w + x] ? 0 : INF;
    transform1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = out[y * w + x];
    transform1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]);
  }
  return out;
}

export function invert(img) {
  const out = new Uint8Array(img.length);
  for (let i = 0; i < img.length; i++) out[i] = img[i] ? 0 : 1;
  return out;
}

/** Depth of every ink pixel: its distance to the nearest background pixel (0 outside ink). */
export function depth(ink, w, h) {
  return distanceTo(invert(ink), w, h);
}

/** Grows ink by a disc of `radius` pixels. */
export function dilate(ink, w, h, radius) {
  const d = distanceTo(ink, w, h);
  const out = new Uint8Array(ink.length);
  for (let i = 0; i < out.length; i++) out[i] = d[i] <= radius ? 1 : 0;
  return out;
}

/** Shrinks ink by a disc of `radius` pixels. */
export function erode(ink, w, h, radius) {
  const d = depth(ink, w, h);
  const out = new Uint8Array(ink.length);
  for (let i = 0; i < out.length; i++) out[i] = d[i] > radius ? 1 : 0;
  return out;
}

/** Closes gaps narrower than `2 * radius`: grow, then shrink back. */
export function close(ink, w, h, radius) {
  return radius > 0 ? erode(dilate(ink, w, h, radius), w, h, radius) : ink;
}

/**
 * Connected components of the set pixels. `eight` joins diagonal neighbours too. Returns the
 * label of each pixel (0 where unset, components from 1) and the area of each component.
 */
export function components(img, w, h, eight) {
  const labels = new Int32Array(w * h);
  const areas = [0];
  const stack = new Int32Array(w * h);
  for (let start = 0; start < img.length; start++) {
    if (!img[start] || labels[start]) continue;
    const label = areas.length;
    let top = 0;
    let area = 0;
    stack[top++] = start;
    labels[start] = label;
    while (top) {
      const i = stack[--top];
      area++;
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || (!eight && dx && dy)) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (img[j] && !labels[j]) {
            labels[j] = label;
            stack[top++] = j;
          }
        }
      }
    }
    areas.push(area);
  }
  return { labels, areas };
}

/** Removes ink specks smaller than `minArea` and fills background holes smaller than `maxHole`. */
export function tidy(ink, w, h, minArea, maxHole) {
  const out = Uint8Array.from(ink);
  const holes = components(invert(out), w, h, false);
  for (let i = 0; i < out.length; i++)
    if (holes.labels[i] && holes.areas[holes.labels[i]] < maxHole) out[i] = 1;
  const specks = components(out, w, h, true);
  for (let i = 0; i < out.length; i++)
    if (specks.labels[i] && specks.areas[specks.labels[i]] < minArea) out[i] = 0;
  return out;
}

/**
 * The faces of a drawing: the areas its lines divide the canvas into, once gaps in those lines
 * up to `gap` pixels are closed. Returns the face of each pixel (0 on a line), the area of each
 * face, which faces are outside (they reach the edge of the canvas) rather than enclosed, and
 * which are round: nearly as much area as a circle with their edge would hold.
 */
export function faces(ink, w, h, gap) {
  const { labels, areas } = components(invert(close(ink, w, h, gap / 2)), w, h, false);
  const outside = new Uint8Array(areas.length);
  for (let x = 0; x < w; x++) {
    outside[labels[x]] = 1;
    outside[labels[(h - 1) * w + x]] = 1;
  }
  for (let y = 0; y < h; y++) {
    outside[labels[y * w]] = 1;
    outside[labels[y * w + w - 1]] = 1;
  }
  outside[0] = 0;
  // The edge of a face, counted in pixel sides it shares with anything else.
  const edge = new Float64Array(areas.length);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const label = labels[i];
      if (!label) continue;
      if (labels[i - 1] !== label) edge[label]++;
      if (labels[i + 1] !== label) edge[label]++;
      if (labels[i - w] !== label) edge[label]++;
      if (labels[i + w] !== label) edge[label]++;
    }
  const round = new Uint8Array(areas.length);
  // Pixel sides overstate a slanted edge by up to √2; 4/π on average for a circle.
  const perimeter = edge.map((sides) => (sides * Math.PI) / 4);
  for (let face = 1; face < areas.length; face++) {
    const p = perimeter[face];
    round[face] = p && (4 * Math.PI * areas[face]) / (p * p) > 0.72 ? 1 : 0;
  }
  return { labels, areas, outside, round };
}

/**
 * The typical half-width of the strokes in a drawing, in pixels: the median depth along the
 * ridges of the depth map (the middle of each stroke).
 */
export function strokeHalfWidth(ink, w, h, depths = depth(ink, w, h)) {
  const ridge = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const d = depths[i];
      if (d < 1) continue;
      let top = true;
      for (let dy = -1; dy <= 1 && top; dy++)
        for (let dx = -1; dx <= 1; dx++) if (depths[i + dy * w + dx] > d + 1e-9) top = false;
      if (top) ridge.push(d);
    }
  }
  if (!ridge.length) return 0;
  ridge.sort((a, b) => a - b);
  return ridge[ridge.length >> 1];
}

// Neighbours clockwise from north: N, NE, E, SE, S, SW, W, NW.
const DX = [0, 1, 1, 1, 0, -1, -1, -1];
const DY = [-1, -1, 0, 1, 1, 1, 0, -1];

/**
 * Thins ink to lines one pixel wide that run down the middle of every stroke and keep its
 * connections (Zhang and Suen), then removes the extra pixel thinning leaves on diagonal steps,
 * so every pixel on a plain line has exactly two neighbours.
 */
export function thin(ink, w, h) {
  const img = Uint8Array.from(ink);
  // Work inside a one-pixel border, so neighbours never need a bounds check.
  for (let x = 0; x < w; x++) img[x] = img[(h - 1) * w + x] = 0;
  for (let y = 0; y < h; y++) img[y * w] = img[y * w + w - 1] = 0;
  let live = [];
  for (let i = 0; i < img.length; i++) if (img[i]) live.push(i);
  const off = DX.map((dx, k) => DY[k] * w + dx);
  const n = new Uint8Array(8);
  let changed = true;
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      const remove = [];
      for (const i of live) {
        let count = 0;
        for (let k = 0; k < 8; k++) count += n[k] = img[i + off[k]];
        if (count < 2 || count > 6) continue;
        let turns = 0;
        for (let k = 0; k < 8; k++) if (!n[k] && n[(k + 1) & 7]) turns++;
        if (turns !== 1) continue;
        // N, E, S, W are n[0], n[2], n[4], n[6].
        const ok = step
          ? !(n[0] && n[2] && n[6]) && !(n[0] && n[4] && n[6])
          : !(n[0] && n[2] && n[4]) && !(n[2] && n[4] && n[6]);
        if (ok) remove.push(i);
      }
      if (remove.length) {
        changed = true;
        for (const i of remove) img[i] = 0;
        live = live.filter((i) => img[i]);
      }
    }
  }
  // A pixel with two neighbours that also touch each other across a corner is redundant: taking
  // it out leaves them joined diagonally, unless the opposite diagonal still hangs on it.
  for (const i of live) {
    const at = (k) => img[i + off[k]];
    if (
      (at(0) && at(2) && !at(5)) ||
      (at(2) && at(4) && !at(7)) ||
      (at(4) && at(6) && !at(1)) ||
      (at(6) && at(0) && !at(3))
    ) {
      // Never shorten a line: keep a pixel whose removal would leave a neighbour stranded.
      let count = 0;
      for (let k = 0; k < 8; k++) count += at(k);
      if (count >= 2) img[i] = 0;
    }
  }
  return img;
}

/** Half the size: each pixel is set where any of the four it covers was. */
export function halve(img, w, h) {
  const hw = w >> 1;
  const hh = h >> 1;
  const out = new Uint8Array(hw * hh);
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < hw; x++) {
      const i = 2 * y * w + 2 * x;
      out[y * hw + x] = img[i] | img[i + 1] | img[i + w] | img[i + w + 1];
    }
  return out;
}

/** Draws a straight line `width` pixels wide into an image. */
export function drawLine(img, w, h, [x0, y0], [x1, y1], width = 3) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2 || 1;
  const r = (width - 1) / 2;
  for (let s = 0; s <= steps; s++) {
    const cx = x0 + ((x1 - x0) * s) / steps;
    const cy = y0 + ((y1 - y0) * s) / steps;
    for (let y = Math.round(cy - r); y <= Math.round(cy + r); y++)
      for (let x = Math.round(cx - r); x <= Math.round(cx + r); x++)
        if (x >= 0 && y >= 0 && x < w && y < h) img[y * w + x] = 1;
  }
}

export const NEIGHBOURS = { DX, DY };
