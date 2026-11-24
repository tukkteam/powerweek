// Tests for the move library pipeline. Run with `node --test scripts/` (part of `pnpm test`).
import assert from "node:assert/strict";
import { test } from "node:test";
import { PEN, anchorOf, finish, redraw, standIns, toSvg } from "./art.mjs";
import { close, distanceTo, strokeHalfWidth, thin, tidy } from "./image.mjs";
import {
  IDENTITY,
  align,
  alignFrames,
  apply,
  compose,
  distanceMap,
  fit,
  inverse,
} from "./register.mjs";
import { corners, graph, prune, simplify, smooth, strokes } from "./trace.mjs";
import { pathData, sample } from "./vector.mjs";

/** A blank image with the rectangles given as [x0, y0, x1, y1] (inclusive) filled in. */
function image(w, h, ...boxes) {
  const img = new Uint8Array(w * h);
  for (const [x0, y0, x1, y1] of boxes)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) img[y * w + x] = 1;
  return img;
}
const count = (img) => img.reduce((sum, v) => sum + v, 0);

test("distanceTo measures exact distances to the nearest set pixel", () => {
  const d = distanceTo(image(9, 9, [4, 4, 4, 4]), 9, 9);
  assert.equal(d[4 * 9 + 4], 0);
  assert.equal(d[4 * 9 + 7], 3);
  assert.ok(Math.abs(d[1 * 9 + 0] - 5) < 1e-9); // 3 up, 4 across
});

test("close joins two lines across a narrow gap and leaves a wide one open", () => {
  const two = image(40, 30, [5, 5, 34, 8], [5, 11, 34, 14], [5, 24, 34, 27]);
  const closed = close(two, 40, 30, 1.5);
  assert.equal(closed[9 * 40 + 20], 1, "the two-pixel gap is filled");
  assert.equal(closed[19 * 40 + 20], 0, "the nine-pixel gap is not");
});

test("tidy fills pores and drops crumbs, and keeps what is big enough", () => {
  const img = image(40, 40, [5, 5, 24, 24], [30, 30, 30, 30], [32, 5, 37, 10]);
  img[15 * 40 + 15] = 0; // a pore
  const out = tidy(img, 40, 40, 4, 4);
  assert.equal(out[15 * 40 + 15], 1);
  assert.equal(out[30 * 40 + 30], 0);
  assert.equal(out[7 * 40 + 34], 1);
});

test("strokeHalfWidth reads the width of the strokes, not their length", () => {
  const bar = image(80, 40, [5, 10, 74, 17]); // 8 pixels thick
  assert.ok(Math.abs(strokeHalfWidth(bar, 80, 40) - 4) <= 0.5);
});

test("thin leaves one line down the middle of a stroke", () => {
  const bar = image(80, 40, [5, 10, 74, 17]);
  const line = thin(bar, 80, 40);
  const ys = new Set();
  let n = 0;
  for (let i = 0; i < line.length; i++)
    if (line[i]) {
      n++;
      ys.add(Math.floor(i / 80));
    }
  assert.ok(n >= 55 && n <= 70, `about as long as the bar: ${n}`);
  assert.ok(
    [...ys].every((y) => y >= 12 && y <= 15),
    "and in its middle",
  );
  const { nodes, edges } = graph(line, 80, 40);
  assert.equal(edges.length, 1);
  assert.equal(nodes.filter((node) => !node.junction).length, 2);
});

test("a cross is two strokes that carry straight on, not four that stop", () => {
  const cross = image(61, 61, [5, 30, 55, 30], [30, 5, 30, 55]);
  const g = graph(cross, 61, 61);
  assert.equal(g.nodes.filter((node) => node.junction).length, 1);
  assert.equal(g.edges.length, 4);
  const lines = strokes(g);
  assert.equal(lines.length, 2);
  for (const line of lines) assert.ok(line.points.length > 45 && !line.closed);
});

test("prune removes a spur no longer than the stroke is wide, and keeps a real branch", () => {
  const w = 80;
  const skeleton = image(w, 40, [5, 20, 70, 20], [30, 16, 30, 19], [50, 2, 50, 19]);
  // The stroke is 6 pixels deep where the branches leave it.
  const depths = new Float64Array(w * 40).fill(3);
  const kept = prune(skeleton, w, 40, depths);
  assert.equal(kept[17 * w + 30], 0, "the four-pixel spur is gone");
  assert.equal(kept[8 * w + 50], 1, "the long branch stays");
  assert.equal(count(kept) < count(skeleton), true);
});

test("a ring is one closed stroke and a lone pixel is a dot", () => {
  const ring = image(30, 30, [5, 5, 20, 5], [5, 20, 20, 20], [5, 5, 5, 20], [20, 5, 20, 20]);
  ring[25 * 30 + 26] = 1;
  const lines = strokes(graph(thin(ring, 30, 30), 30, 30));
  assert.equal(lines.filter((l) => l.closed).length, 1);
  assert.equal(lines.filter((l) => l.points.length === 1).length, 1);
});

test("smooth irons out a staircase but leaves corners and ends where they are", () => {
  const stairs = Array.from({ length: 41 }, (_, i) => [i, i % 2]);
  const smoothed = smooth(stairs, false, 2);
  assert.deepEqual(smoothed[0], stairs[0]);
  assert.deepEqual(smoothed[40], stairs[40]);
  assert.ok(Math.abs(smoothed[20][1] - 0.5) < 0.1);

  const elbow = [
    ...Array.from({ length: 30 }, (_, i) => [i, 0]),
    ...Array.from({ length: 30 }, (_, i) => [29, i + 1]),
  ];
  const found = corners(elbow, false, 8);
  assert.deepEqual(found, [29]);
  assert.deepEqual(smooth(elbow, false, 3, found)[29], [29, 0]);
  assert.notDeepEqual(smooth(elbow, false, 3)[29], [29, 0]);
});

test("simplify keeps the points a line needs", () => {
  const line = Array.from({ length: 50 }, (_, i) => [i, 0]);
  assert.equal(simplify(line, 0.2).length, 2);
  const bent = [...line, [49, 10]];
  assert.equal(simplify(bent, 0.2).length, 3);
});

test("pathData draws lines, curves, sharp corners, loops and dots compactly", () => {
  assert.equal(
    pathData([
      {
        points: [
          [10, 10],
          [20, 10],
        ],
        closed: false,
      },
    ]),
    "M10 10l10 0",
  );
  assert.equal(pathData([{ points: [[5.04, 5.06]], closed: false }]), "M5 5.1h.01");
  // A right angle stays two straight lines.
  assert.equal(
    pathData([
      {
        points: [
          [0, 0],
          [10, 0],
          [10, 10],
        ],
        closed: false,
      },
    ]),
    "M0 0l10 0l0 10",
  );
  // A gentle bend becomes a curve through the midpoints.
  const bend = pathData([
    {
      points: [
        [0, 0],
        [10, 0],
        [20, 3],
        [30, 8],
      ],
      closed: false,
    },
  ]);
  assert.match(bend, /^M0 0l5 0q5 0 10 1\.5t10 4l5 2\.5$/);
  const loop = pathData([
    {
      points: [
        [0, 0],
        [10, -4],
        [20, 0],
        [20, 10],
        [10, 14],
        [0, 10],
      ],
      closed: true,
    },
  ]);
  assert.ok(loop.endsWith("z") && loop.includes("q"));
});

test("sample spaces points evenly along a stroke", () => {
  const points = sample(
    [
      {
        points: [
          [0, 0],
          [10, 0],
        ],
        closed: false,
      },
    ],
    2,
  );
  assert.equal(points.length, 6);
  assert.deepEqual(points[3], [6, 0]);
});

test("transforms compose and invert", () => {
  const a = { scale: 1.2, dx: 5, dy: -3 };
  const b = { scale: 0.8, dx: -7, dy: 11 };
  const p = [100, 300];
  const both = apply(compose(a, b), p);
  const stepwise = apply(b, apply(a, p));
  assert.ok(Math.hypot(both[0] - stepwise[0], both[1] - stepwise[1]) < 1e-9);
  const back = apply(inverse(a), apply(a, p));
  assert.ok(Math.hypot(back[0] - p[0], back[1] - p[1]) < 1e-9);
});

/** A drawing as a cloud: a bench (which stays still) and an arm at some height (which moves). */
function scene(armY, t = IDENTITY) {
  const lines = [
    {
      points: [
        [150, 400],
        [360, 400],
      ],
      closed: false,
    },
    {
      points: [
        [170, 400],
        [170, 460],
      ],
      closed: false,
    },
    {
      points: [
        [340, 400],
        [340, 460],
      ],
      closed: false,
    },
    {
      points: [
        [200, 400],
        [200, 330],
        [300, 330],
        [300, 400],
      ],
      closed: false,
    },
    {
      points: [
        [220, armY],
        [330, armY - 30],
      ],
      closed: false,
    },
  ].map(({ points, closed }) => ({ points: points.map((p) => apply(t, p)), closed }));
  const points = sample(lines, 1.5);
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [x, y] of points) {
    box.minX = Math.min(box.minX, x);
    box.maxX = Math.max(box.maxX, x);
    box.minY = Math.min(box.minY, y);
    box.maxY = Math.max(box.maxY, y);
  }
  return { points, map: distanceMap(points), box, cut: { top: false, bottom: false } };
}

test("align finds how a frame was shifted and scaled, ignoring the part that moves", () => {
  const still = scene(250);
  const placed = { scale: 1.15, dx: 22, dy: -14 };
  const moving = scene(150, placed);
  const { transform, gain } = align(still, moving, { anchor: "free" });
  const expected = inverse(placed);
  assert.ok(gain > 0.1);
  assert.ok(Math.abs(transform.scale - expected.scale) < 0.02, `scale ${transform.scale}`);
  assert.ok(Math.abs(transform.dx - expected.dx) < 2.5, `dx ${transform.dx}`);
  assert.ok(Math.abs(transform.dy - expected.dy) < 2.5, `dy ${transform.dy}`);
});

test("align leaves a frame alone when there is nothing to go on", () => {
  const a = scene(250);
  const dots = {
    ...a,
    points: [
      [40, 40],
      [60, 480],
      [470, 90],
    ],
  };
  dots.map = distanceMap(dots.points);
  assert.deepEqual(align(a, dots, { anchor: "free" }).transform, IDENTITY);
});

test('with the "ground" anchor the lowest points end up level', () => {
  const still = scene(250);
  const moving = scene(150, { scale: 1, dx: 0, dy: -40 });
  const { transform } = align(still, moving, { anchor: "ground" });
  const bottom = apply(transform, [0, moving.box.maxY])[1];
  assert.ok(Math.abs(bottom - still.box.maxY) <= 10);
  assert.ok(Math.abs(transform.dy - 40) < 3);
});

test("alignFrames lines three frames up and fit fills the canvas with an even margin", () => {
  const clouds = [
    scene(250),
    scene(200, { scale: 1.1, dx: 15, dy: 10 }),
    scene(150, { scale: 0.92, dx: -12, dy: 8 }),
  ];
  const { transforms } = alignFrames(clouds, { anchor: "ground" });
  // The left end of the bench top lands in the same place in every frame.
  const corner = (i, t) => apply(transforms[i], apply(t, [150, 400]));
  const a = corner(0, IDENTITY);
  const b = corner(1, { scale: 1.1, dx: 15, dy: 10 });
  const c = corner(2, { scale: 0.92, dx: -12, dy: 8 });
  assert.ok(
    Math.hypot(a[0] - b[0], a[1] - b[1]) < 5,
    `frame 2 is ${Math.hypot(a[0] - b[0], a[1] - b[1])} off`,
  );
  assert.ok(
    Math.hypot(a[0] - c[0], a[1] - c[1]) < 5,
    `frame 3 is ${Math.hypot(a[0] - c[0], a[1] - c[1])} off`,
  );

  const onto = fit(clouds, transforms, 20);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  clouds.forEach((cloud, i) => {
    for (const p of cloud.points) {
      const [x, y] = apply(compose(transforms[i], onto), p);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  });
  assert.ok(minX >= 20 - 1e-6 && maxX <= 492 + 1e-6 && minY >= 20 - 1e-6 && maxY <= 492 + 1e-6);
  assert.ok(Math.abs(minX - 20) < 1e-6 || Math.abs(minY - 20) < 1e-6, "as large as it will go");
  assert.ok(Math.abs(minX + maxX - 512) < 1e-6 && Math.abs(minY + maxY - 512) < 1e-6, "centred");
});

test("anchorOf knows what stays still", () => {
  assert.equal(anchorOf("squat", "Barbell"), "ground");
  assert.equal(anchorOf("pull-up", "Bodyweight"), "top");
  assert.equal(anchorOf("dead-hang", "Pull-up Bar"), "top");
  assert.equal(anchorOf("jump-squat", "Bodyweight"), "free");
  assert.equal(anchorOf("dip", "Bodyweight"), "free");
  assert.equal(anchorOf("bench-dip", "Bench"), "ground");
  assert.equal(anchorOf("side-plank-hip-dip", "Bodyweight"), "ground");
});

test("a frame that is all but empty is replaced by the pose before it", () => {
  const frame = (n) => ({ points: Array.from({ length: n }, (_, i) => [i, 0]) });
  const { frames, stoodIn } = standIns([frame(300), frame(4), frame(280)]);
  assert.deepEqual(stoodIn, [null, 0, null]);
  assert.equal(frames[1], frames[0]);
  assert.deepEqual(standIns([frame(300), frame(250), frame(280)]).stoodIn, [null, null, null]);
  assert.deepEqual(standIns([frame(3), frame(250), frame(280)]).stoodIn, [1, null, null]);
});

/** Ink at the pipeline's resolution, with bars `t` pixels thick either side of each line given. */
function inked(t, ...lines) {
  const side = 512 * PEN.resolution;
  const ink = new Uint8Array(side * side);
  for (const [x0, y0, x1, y1] of lines)
    for (let y = y0 - t; y <= y1 + t; y++)
      for (let x = x0 - t; x <= x1 + t; x++) ink[y * side + x] = 1;
  return { ink, side };
}
const drawnLength = (lines) =>
  lines.reduce(
    (sum, s) =>
      sum +
      (s.closed ? [...s.points, s.points[0]] : s.points)
        .slice(1)
        .reduce((n, p, i) => n + Math.hypot(p[0] - s.points[i][0], p[1] - s.points[i][1]), 0),
    0,
  );

test("redraw turns thick and thin versions of a drawing into the same lines", () => {
  const drawing = (t) => redraw(inked(t, [200, 300, 800, 300], [500, 300, 500, 700]));
  const thinOne = drawing(2);
  const thickOne = drawing(9);
  assert.ok(thickOne.weight > 3 * thinOne.weight, "upstream drew them very differently");
  // A 300-unit bar and a 200-unit post, whatever they were drawn with.
  assert.ok(
    Math.abs(drawnLength(finish(thinOne)) - 500) < 12,
    `thin: ${drawnLength(finish(thinOne))}`,
  );
  assert.ok(
    Math.abs(drawnLength(finish(thickOne)) - 500) < 25,
    `thick: ${drawnLength(finish(thickOne))}`,
  );
  const svg = toSvg(finish(thickOne));
  assert.match(svg, new RegExp(`stroke-width="${PEN.weight}"`));
  assert.match(svg, /fill="none"/);
});

// A square outline (200 units a side), a mark drawn inside it, and a line outside it.
const square = [
  [200, 200, 600, 200],
  [200, 600, 600, 600],
  [200, 200, 200, 600],
  [600, 200, 600, 600],
];
const mark = [340, 400, 420, 400];
const cable = [700, 300, 700, 460];

test("finish takes a mark off a shape and keeps the shape and what lies outside it", () => {
  const lines = finish(redraw(inked(2, ...square, mark, cable)));
  // 800 units of outline and 80 of cable; the 40-unit mark is gone.
  assert.ok(Math.abs(drawnLength(lines) - 880) < 20, `drawn: ${drawnLength(lines)}`);
  assert.ok(
    lines.every((line) =>
      line.points.every(([x, y]) => !(x > 150 && x < 250 && y > 190 && y < 210)),
    ),
  );
  // With simplifying turned off, the mark is drawn too.
  const keep = PEN.mark;
  PEN.mark = 0;
  try {
    assert.ok(Math.abs(drawnLength(finish(redraw(inked(2, ...square, mark, cable)))) - 920) < 20);
  } finally {
    PEN.mark = keep;
  }
});

test("an outline left open still has an inside", () => {
  // The top edge stops 20 units short of the corner.
  const open = [[200, 200, 560, 200], ...square.slice(1)];
  const lines = finish(redraw(inked(2, ...open, mark)));
  assert.ok(Math.abs(drawnLength(lines) - 780) < 20, `drawn: ${drawnLength(lines)}`);
});

test("a round shape inside a figure is a thing of its own, however small", () => {
  // A 16-unit square "head" inside the big square: small, but drawn all the way round.
  const head = [
    [380, 380, 412, 380],
    [380, 412, 412, 412],
    [380, 380, 380, 412],
    [412, 380, 412, 412],
  ];
  const lines = finish(redraw(inked(2, ...square, ...head)));
  assert.ok(Math.abs(drawnLength(lines) - 864) < 20, `drawn: ${drawnLength(lines)}`);
});
