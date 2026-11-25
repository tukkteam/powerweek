/**
 * From strokes (lists of points) to the `d` of an SVG path, drawn with one pen. Curves are
 * quadratic B-splines through the midpoints of each stroke's points, which keeps them smooth and
 * the file small; sharp turns stay sharp. Used by scripts/moves.mjs.
 */

/** A number with one decimal and no wasted characters: 0.5 → ".5", -0.0 → "0". */
function number(value) {
  const text = (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, "");
  if (text === "-0") return "0";
  return text.replace(/^(-?)0\./, "$1.");
}

/** Writes path commands with relative coordinates, tracking the rounding so it never drifts. */
class Pen {
  constructor() {
    this.parts = [];
    this.x = 0;
    this.y = 0;
  }
  values(command, numbers) {
    let text = command;
    numbers.forEach((n, i) => {
      const item = number(n);
      text += i && !item.startsWith("-") ? ` ${item}` : item;
    });
    this.parts.push(text);
  }
  round(v) {
    return Math.round(v * 10) / 10;
  }
  move([x, y]) {
    this.x = this.round(x);
    this.y = this.round(y);
    this.values("M", [this.x, this.y]);
    this.run = 0;
  }
  line([x, y]) {
    const dx = this.round(x - this.x);
    const dy = this.round(y - this.y);
    if (!dx && !dy) return;
    this.values("l", [dx, dy]);
    this.x = this.round(this.x + dx);
    this.y = this.round(this.y + dy);
    this.run = 0;
  }
  /** A curve to `to`, bending towards `control`. */
  curve(control, [x, y]) {
    const dx = this.round(x - this.x);
    const dy = this.round(y - this.y);
    // `t` repeats the bend of the curve before it, which is what a B-spline does; say the
    // control point outright now and then so rounding cannot build up along a long stroke.
    if (this.run > 0 && this.run < 8) this.values("t", [dx, dy]);
    else {
      this.values("q", [this.round(control[0] - this.x), this.round(control[1] - this.y), dx, dy]);
      this.run = 0;
    }
    this.run++;
    this.x = this.round(this.x + dx);
    this.y = this.round(this.y + dy);
  }
  dot() {
    this.parts.push("h.01");
  }
  close() {
    this.parts.push("z");
  }
}

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Whether the line turns sharply at `b`: a corner to keep, not a curve to round. */
function isCorner(a, b, c, degrees) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const vx = c[0] - b[0];
  const vy = c[1] - b[1];
  const lu = Math.hypot(ux, uy);
  const lv = Math.hypot(vx, vy);
  if (lu < 1 || lv < 1) return false;
  const cos = (ux * vx + uy * vy) / (lu * lv);
  return cos < Math.cos((degrees * Math.PI) / 180);
}

/** Draws the points from `from` to `to` (inclusive) as one smooth run, from where the pen is. */
function run(pen, points, from, to) {
  if (to - from === 1) return pen.line(points[to]);
  pen.line(mid(points[from], points[from + 1]));
  for (let i = from + 1; i < to; i++) pen.curve(points[i], mid(points[i], points[i + 1]));
  pen.line(points[to]);
}

/**
 * The path data for a drawing. `strokes` are `{ points, closed }` in the units of the SVG.
 * `corner` is the turn, in degrees, from which a bend is kept sharp.
 */
export function pathData(strokes, corner = 55) {
  const pen = new Pen();
  for (const { points, closed } of strokes) {
    const n = points.length;
    if (n === 1) {
      pen.move(points[0]);
      pen.dot();
      continue;
    }
    if (closed && n >= 3) {
      const corners = [];
      for (let i = 0; i < n; i++)
        if (isCorner(points[(i + n - 1) % n], points[i], points[(i + 1) % n], corner))
          corners.push(i);
      if (!corners.length) {
        // One unbroken curve round the loop.
        pen.move(mid(points[n - 1], points[0]));
        for (let i = 0; i < n; i++) pen.curve(points[i], mid(points[i], points[(i + 1) % n]));
        pen.close();
        continue;
      }
      // Start at a corner and go round to it again.
      const turned = [
        ...points.slice(corners[0]),
        ...points.slice(0, corners[0]),
        points[corners[0]],
      ];
      draw(pen, turned, corner);
      pen.close();
      continue;
    }
    draw(pen, points, corner);
  }
  return pen.parts.join("");
}

function draw(pen, points, corner) {
  pen.move(points[0]);
  let from = 0;
  for (let i = 1; i < points.length - 1; i++) {
    if (isCorner(points[i - 1], points[i], points[i + 1], corner)) {
      run(pen, points, from, i);
      from = i;
    }
  }
  run(pen, points, from, points.length - 1);
}

/** Points spaced about `step` apart along every stroke: the drawing as a cloud of points. */
export function sample(strokes, step) {
  const out = [];
  for (const { points, closed } of strokes) {
    const path = closed && points.length > 2 ? [...points, points[0]] : points;
    out.push(path[0]);
    let carry = 0;
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1];
      const dx = path[i][0] - ax;
      const dy = path[i][1] - ay;
      const size = Math.hypot(dx, dy);
      let at = step - carry;
      while (at <= size) {
        out.push([ax + (dx * at) / size, ay + (dy * at) / size]);
        at += step;
      }
      carry = size - (at - step);
    }
  }
  return out;
}
