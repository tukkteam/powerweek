/**
 * A worker thread of scripts/moves.mjs: redraws the moves it is given, writes their frames and
 * reports what it did to each.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import { anchorOf, compose3, readInk, redraw } from "./art.mjs";

const { source, publicDir, frames, entries } = workerData;
const round = (n) => Math.round(n * 100) / 100;

for (const { slug, equipment } of entries) {
  const drawings = [];
  let bytesIn = 0;
  for (const frame of frames) {
    const input = join(source, "assets", slug, `frame-${frame}.svg`);
    if (!existsSync(input)) throw new Error(`Missing ${input}`);
    const svg = readFileSync(input, "utf8");
    bytesIn += svg.length;
    drawings.push(redraw(await readInk(svg)));
  }
  const anchor = anchorOf(slug, equipment);
  const { svgs, transforms, links, stoodIn } = compose3(drawings, anchor);
  mkdirSync(join(publicDir, slug), { recursive: true });
  let bytesOut = 0;
  svgs.forEach((svg, i) => {
    if (!svg.includes('viewBox="0 0 512 512"') || !/ d="M[^"]{40,}"/.test(svg))
      throw new Error(`${slug} frame ${frames[i]}: nothing was drawn`);
    writeFileSync(join(publicDir, slug, `${frames[i]}.svg`), `${svg}\n`);
    bytesOut += svg.length + 1;
  });
  parentPort.postMessage({
    slug,
    anchor,
    bytesIn,
    bytesOut,
    // What upstream drew each frame with, and where each frame was put.
    upstreamWeight: drawings.map((d) => round(d.weight)),
    // The widest gap between lines that was closed in each frame before finding its lines.
    fused: drawings.map((d) => round(d.fused)),
    cut: drawings.map((d) => d.cut),
    // Frames that were all but empty upstream, and the frame that stands in for each.
    stoodIn,
    placed: transforms.map((t) => ({ scale: round(t.scale), dx: round(t.dx), dy: round(t.dy) })),
    links: links.map((l) => ({ ...l, score: round(l.score), gain: round(l.gain) })),
  });
}
