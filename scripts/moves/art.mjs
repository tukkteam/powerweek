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
import { close, depth, strokeHalfWidth, thin, tidy } from "./image.mjs";
import { SIZE, alignFrames, apply, compose, distanceMap, fit } from "./register.mjs";
import { corners, graph, lengthOf, prune, simplify, smooth, strokes } from "./trace.mjs";
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
 * The strokes of a frame, in SVG units: the line down the middle of everything upstream drew.
 * Also returns `weight`, the typical width of the lines upstream, for the report.
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
  const lines = strokes(graph(skeleton, side, side));
  const drawn = lines
    .map(({ points, closed }) => {
      const pinned = corners(points, closed, Math.round(PEN.cornerReach * px), PEN.corner);
      const smoothed = smooth(points, closed, PEN.smoothing * px, pinned);
      const kept = closed
        ? simplify([...smoothed, smoothed[0]], PEN.tolerance * px).slice(0, -1)
        : simplify(smoothed, PEN.tolerance * px);
      return { points: kept.map(([x, y]) => [(x + 0.5) / px, (y + 0.5) / px]), closed };
    })
    .filter((s) => s.points.length);
  // A frame whose ink runs into the edge of the canvas was cut off upstream.
  const cut = { top: false, bottom: false };
  for (let x = 0; x < side; x++) {
    if (ink[2 * side + x]) cut.top = true;
    if (ink[(side - 3) * side + x]) cut.bottom = true;
  }
  return { strokes: drawn, weight: width / px, fused: gap, cut };
}

const cloud = (drawing) => {
  const points = sample(drawing.strokes, 1.5);
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [x, y] of points) {
    box.minX = Math.min(box.minX, x);
    box.maxX = Math.max(box.maxX, x);
    box.minY = Math.min(box.minY, y);
    box.maxY = Math.max(box.maxY, y);
  }
  return { points, map: distanceMap(points), box, cut: drawing.cut };
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
 * Lines up the frames of one exercise and fits them to the canvas. `drawings` are the results of
 * `redraw`, in frame order. Returns the SVG of each frame and what was done, for the report.
 */
export function compose3(given, anchor = "ground") {
  const { drawings, stoodIn } = standIns(given);
  const clouds = drawings.map(cloud);
  const { transforms, links } = alignFrames(clouds, { anchor });
  const onto = fit(clouds, transforms, PEN.margin + PEN.weight / 2);
  const placed = transforms.map((t) => compose(t, onto));
  const svgs = drawings.map((drawing, i) =>
    toSvg(
      drawing.strokes.map(({ points, closed }) => ({
        points: points.map((p) => apply(placed[i], p)),
        closed,
      })),
    ),
  );
  return { svgs, transforms: placed, links, stoodIn };
}

/**
 * A frame that is all but empty upstream (a few specks where a figure should be) would blink the
 * drawing off. The pose before it stands in, or the one after for a first frame. Returns the
 * drawings to use and, for each frame, the index of the frame that stood in for it (or null).
 */
export function standIns(drawings) {
  const ink = drawings.map((d) => d.strokes.reduce((sum, s) => sum + lengthOf(s.points), 0));
  const stoodIn = drawings.map((_, i) => {
    const others = ink.filter((_, j) => j !== i).sort((a, b) => a - b);
    const typical = others[others.length >> 1];
    if (ink[i] >= 0.2 * typical) return null;
    return i > 0 ? i - 1 : 1;
  });
  return {
    drawings: drawings.map((d, i) => (stoodIn[i] === null ? d : drawings[stoodIn[i]])),
    stoodIn,
  };
}

/** The SVG of one frame: a single path, drawn with the pen, with no fill. */
export function toSvg(lines) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<path fill="none" stroke="#000" stroke-width="${PEN.weight}" stroke-linecap="round" ` +
    `stroke-linejoin="round" d="${pathData(lines)}"/></svg>`
  );
}
