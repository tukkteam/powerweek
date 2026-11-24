/**
 * Redraws the move library with one pen. Upstream, the three frames of an exercise are three
 * separate drawings: traced outlines of lines that are hair-thin in one frame and marker-thick
 * in the next, at slightly different sizes and places. Played in a row they flicker and jump.
 *
 * For every frame this finds the line down the middle of each stroke and draws it again at one
 * weight; then it lines the frames of each exercise up with each other and fits them to the
 * canvas. The result is a stroked SVG path per frame: the same weight in every frame of every
 * exercise. Used by scripts/moves.mjs; the knobs are in `PEN`.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { close, depth, drawLine, faces, halve, strokeHalfWidth, thin, tidy } from "./image.mjs";
import { SIZE, alignFrames, apply, compose, distanceMap, fit } from "./register.mjs";
import {
  corners,
  declutter,
  graph,
  looseEnds,
  prune,
  simplify,
  smooth,
  strokes,
} from "./trace.mjs";
import { pathData, sample } from "./vector.mjs";

// sharp is a dependency of the web app (it draws the app icons); borrow it from there instead of
// adding it to the repository root.
const sharp = createRequire(fileURLToPath(new URL("../../apps/web/package.json", import.meta.url)))(
  "sharp",
);

/** How the library is drawn. Units are those of the SVG: the canvas is 512 square. */
export const PEN = {
  /** The weight of every line. */
  weight: 4.2,
  /** Space left around a drawing. */
  margin: 14,
  /** Frames are read at this many pixels per unit; more is slower and a little smoother. */
  resolution: 2,
  /**
   * Lines whose middles are closer than the weight plus this fuse into one: drawn at `weight`
   * they would touch, or leave a slit too thin to read.
   */
  slit: 0.6,
  /**
   * The widest gap ever closed, and how much ink closing it must add (as a share of the ink
   * there was) for a frame to count as drawn with hollow strokes.
   */
  hollow: 3,
  hollowGain: 0.12,
  /** How much the pixel staircase is smoothed, and how closely curves keep to it. */
  smoothing: 1.8,
  tolerance: 0.22,
  /** A turn sharper than this many degrees, measured over `cornerReach` units, stays a corner. */
  corner: 50,
  cornerReach: 4,
  /**
   * How much detail is taken out of a figure, in units of the finished drawing (see `declutter`
   * in trace.mjs). A line with the same enclosed area on both sides is a mark on something
   * rather than the edge of anything; marks shorter than `mark` go. Enclosed areas smaller than
   * `cell` square units (a kneecap, the squares of a six-pack) count as part of what surrounds
   * them, unless they are round. Set `mark` to 0 to keep every line upstream drew.
   *
   * Outlines are often left open (a neck that never meets the shoulder): gaps up to `outlineGap`
   * count as closed, and a loose end is carried on up to `carryOn` to the next line where doing
   * so closes an area off from the outside. `look` is how far from a line to search for what
   * lies beside it, where lines crowd together.
   */
  mark: 140,
  cell: 420,
  outlineGap: 5,
  carryOn: 30,
  look: 45,
};

/** A frame as ink: 1 where upstream painted, at `PEN.resolution` pixels per unit. */
export async function readInk(svg) {
  const side = SIZE * PEN.resolution;
  // Upstream paints white on a transparent canvas. A slight blur before the cut rounds off the
  // notches its tracing left along every edge.
  const { data } = await sharp(Buffer.from(svg), { density: 72 * PEN.resolution })
    .resize(side, side, { fit: "fill" })
    .flatten({ background: "#000000" })
    .extractChannel(0)
    .blur(0.5 * PEN.resolution)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ink = new Uint8Array(side * side);
  for (let i = 0; i < ink.length; i++) ink[i] = data[i] > 127 ? 1 : 0;
  return { ink, side };
}

/**
 * Reads a frame: finds the line down the middle of everything upstream drew and the solid shape
 * those lines enclose. The result is still pixels; `finish` turns it into strokes once the size
 * the frame will be shown at is known. Also returns `weight`, the typical width of the lines
 * upstream, and `points`, the lines as a cloud of points in SVG units.
 */
export function redraw({ ink, side }) {
  const px = PEN.resolution;
  // Fuse what would touch anyway once drawn with the pen: the hairline "echo" some frames have
  // beside each stroke, a stroke drawn as two thin edges, hatching tighter than the pen. How
  // wide a gap that is depends on how thin upstream drew: thick lines sit further apart already.
  const raw = (2 * strokeHalfWidth(ink, side, side)) / px;
  let gap = Math.min(PEN.hollow, Math.max(1, PEN.weight + PEN.slit - raw));
  let fused = close(ink, side, side, (gap / 2) * px);
  // Some frames draw every contour hollow: two lines with a channel between them. Closing the
  // widest gap we would ever close then adds a lot of ink (the channels), where on a plain
  // drawing it adds next to none. Those frames are closed that far, whatever their line width,
  // so each hollow stroke becomes one line.
  if (gap < PEN.hollow) {
    const wide = close(ink, side, side, (PEN.hollow / 2) * px);
    let before = 0;
    let after = 0;
    for (let i = 0; i < ink.length; i++) {
      before += ink[i];
      after += wide[i];
    }
    if (after > before * (1 + PEN.hollowGain)) {
      gap = PEN.hollow;
      fused = wide;
    }
  }
  const half = strokeHalfWidth(fused, side, side);
  const width = 2 * half;
  // Pores inside a stroke and crumbs beside it, judged against the stroke's own width.
  const clean = tidy(fused, side, side, 0.9 * width * width, 0.8 * width * width);
  const depths = depth(clean, side, side);
  const skeleton = prune(thin(clean, side, side), side, side, depths);
  const points = [];
  for (let i = 0; i < skeleton.length; i++)
    if (skeleton[i] && i % 3 === 0)
      points.push([((i % side) + 0.5) / px, (Math.floor(i / side) + 0.5) / px]);
  // A frame whose ink runs into the edge of the canvas was cut off upstream.
  const cut = { top: false, bottom: false };
  for (let x = 0; x < side; x++) {
    if (ink[2 * side + x]) cut.top = true;
    if (ink[(side - 3) * side + x]) cut.bottom = true;
  }
  return { skeleton, clean, depths, side, half, points, weight: width / px, fused: gap, cut };
}

/**
 * The strokes of a frame, in the frame's own SVG units, with the detail taken out. `scale` is
 * how much larger than upstream drew it the frame will be shown, so that "detail" means the
 * same in a figure drawn small as in one drawn large.
 */
export function finish(frame, scale = 1) {
  const px = PEN.resolution;
  const { side, depths } = frame;
  const size = (units) => (units * px) / scale;
  const gap = size(PEN.outlineGap);
  const lean = PEN.mark
    ? declutter(frame.skeleton, side, side, enclosed(frame, gap, size(PEN.carryOn)), {
        mark: size(PEN.mark),
        cell: size(1) * size(1) * PEN.cell,
        // From just past the stroke's own edge; then up to a good way into the figure.
        near: [frame.half + 2, frame.half + gap / 2 + 5],
        far: size(PEN.look),
        speck: size(4),
      })
    : frame.skeleton;
  // Taking a mark away leaves the stub of its junction on the line it left; prune those too.
  const skeleton = prune(lean, side, side, depths);
  return strokes(graph(skeleton, side, side))
    .map(({ points, closed }) => {
      const pinned = corners(points, closed, Math.round(PEN.cornerReach * px), PEN.corner);
      const smoothed = smooth(points, closed, PEN.smoothing * px, pinned);
      const kept = closed
        ? simplify([...smoothed, smoothed[0]], PEN.tolerance * px).slice(0, -1)
        : simplify(smoothed, PEN.tolerance * px);
      return { points: kept.map(([x, y]) => [(x + 0.5) / px, (y + 0.5) / px]), closed };
    })
    .filter((s) => s.points.length);
}

/**
 * The faces of a frame (see `faces` in image.mjs), with its outline completed first. Outlines
 * are often left open, and an open figure has no inside. Each loose end could be carried on to
 * the next line; the shortest gaps are tried first, and a stretch is kept when it turns open
 * ground into an enclosed area, which is what closing an outline does. The loose end of a mark
 * inside a figure that is already closed encloses nothing new and is left.
 */
export function enclosed(frame, gap, reach) {
  const { side, clean, skeleton } = frame;
  const stretches = looseEnds(skeleton, clean, side, side, reach)
    .map(([a, b]) => ({ a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]) }))
    .sort((p, q) => p.length - q.length);
  if (!stretches.length) return faces(clean, side, side, gap);
  // Judged at half size: it only has to tell whether an area closed.
  const half = side >> 1;
  const inside = (img) => {
    const { labels, outside } = faces(img, half, half, gap / 2);
    let n = 0;
    for (let i = 0; i < labels.length; i++) if (!labels[i] || !outside[labels[i]]) n++;
    return n;
  };
  const small = halve(clean, side, side);
  const completed = Uint8Array.from(clean);
  let before = inside(small);
  const worthwhile = 60 * (side / 1024) ** 2;
  for (const { a, b } of stretches) {
    const trial = Uint8Array.from(small);
    drawLine(trial, half, half, [a[0] / 2, a[1] / 2], [b[0] / 2, b[1] / 2], 2);
    const after = inside(trial);
    if (after - before < worthwhile) continue;
    small.set(trial);
    before = after;
    drawLine(completed, side, side, a, b);
  }
  return faces(completed, side, side, gap);
}

const cloud = (frame) => {
  const { points } = frame;
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [x, y] of points) {
    box.minX = Math.min(box.minX, x);
    box.maxX = Math.max(box.maxX, x);
    box.minY = Math.min(box.minY, y);
    box.maxY = Math.max(box.maxY, y);
  }
  return { points, map: distanceMap(points), box, cut: frame.cut };
};

/**
 * What stays still in an exercise, which decides how its frames are lined up: the "ground" for
 * nearly everything (feet, a bench, a machine), the "top" where the body hangs from a bar, and
 * "free" where nothing does (jumps, dips between bars): there upstream's placement is kept.
 */
export function anchorOf(slug, equipment) {
  if (/(^|-)(dip|jump|jumping|hop|burpee|running|high-knees)(-|$)/.test(slug))
    return /^(bench|chair)-dip$|hip-dip/.test(slug) ? "ground" : "free";
  if (equipment === "Pull-up Bar" || /pull-up|chin-up|hang/.test(slug)) return "top";
  return "ground";
}

/**
 * Lines up the frames of one exercise and fits them to the canvas. `given` are the results of
 * `redraw`, in frame order. The frames are lined up on everything upstream drew (the detail
 * helps find what stays still), and only then simplified. Returns the strokes of each frame in
 * place, their SVGs, and what was done, for the report.
 */
export function compose3(given, anchor = "ground") {
  const { frames, stoodIn } = standIns(given);
  const clouds = frames.map(cloud);
  const { transforms, links } = alignFrames(clouds, { anchor });
  const onto = fit(clouds, transforms, PEN.margin + PEN.weight / 2);
  const placed = transforms.map((t) => compose(t, onto));
  const drawings = frames.map((frame, i) =>
    finish(frame, placed[i].scale).map(({ points, closed }) => ({
      points: points.map((p) => apply(placed[i], p)),
      closed,
    })),
  );
  return { drawings, svgs: drawings.map(toSvg), transforms: placed, links, stoodIn };
}

/**
 * A frame that is all but empty upstream (a few specks where a figure should be) would blink the
 * drawing off. The pose before it stands in, or the one after for a first frame. Returns the
 * frames to use and, for each, the index of the frame that stood in for it (or null).
 */
export function standIns(frames) {
  const ink = frames.map((frame) => frame.points.length);
  const stoodIn = frames.map((_, i) => {
    const others = ink.filter((_, j) => j !== i).sort((a, b) => a - b);
    const typical = others[others.length >> 1];
    if (ink[i] >= 0.2 * typical) return null;
    return i > 0 ? i - 1 : 1;
  });
  return { frames: frames.map((f, i) => (stoodIn[i] === null ? f : frames[stoodIn[i]])), stoodIn };
}

/** The SVG of one frame: a single path, drawn with the pen, with no fill. */
export function toSvg(lines) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<path fill="none" stroke="#000" stroke-width="${PEN.weight}" stroke-linecap="round" ` +
    `stroke-linejoin="round" d="${pathData(lines)}"/></svg>`
  );
}
