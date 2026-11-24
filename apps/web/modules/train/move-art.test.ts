import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MOVE_FRAMES } from "./moves";
import { moveLoop } from "./move-art";
import { MOVE_BETWEENS, MOVE_ROWS } from "./moves-data";

/*
 * The illustrations are generated (pnpm moves), and what makes them play well is that they are
 * all drawn the same way. These checks hold the committed files to that, so a hand-edited frame
 * or a half-finished regeneration cannot slip in.
 */

const dir = fileURLToPath(new URL("../../public/moves", import.meta.url));
const FRAME =
  /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 512 512"><path fill="none" stroke="#000" stroke-width="([\d.]+)" stroke-linecap="round" stroke-linejoin="round" d="([^"]+)"\/><\/svg>\n$/;

/** Everything the path touches or bends towards: a box the drawing is certainly inside. */
function reach(d: string) {
  let x = 0;
  let y = 0;
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const see = (px: number, py: number) => {
    box.minX = Math.min(box.minX, px);
    box.maxX = Math.max(box.maxX, px);
    box.minY = Math.min(box.minY, py);
    box.maxY = Math.max(box.maxY, py);
  };
  for (const [, command, rest] of d.matchAll(/([MlqthzZ])([^MlqthzZ]*)/g)) {
    const n = (rest!.match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []).map(Number);
    if (command === "M") [x, y] = [n[0]!, n[1]!];
    else if (command === "l" || command === "t") [x, y] = [x + n[0]!, y + n[1]!];
    else if (command === "q") {
      see(x + n[0]!, y + n[1]!);
      [x, y] = [x + n[2]!, y + n[3]!];
    } else if (command === "h") x += n[0]!;
    see(x, y);
  }
  return box;
}

describe("move art", () => {
  const BETWEENS = ["1-2", "2-3"] as const;
  const has = (slug: string, i: number) => Boolean((MOVE_BETWEENS[slug] ?? 0) & (i + 1));
  // The key poses of every move, and the in-between poses the catalogue says it has.
  const frames = MOVE_ROWS.flatMap(([slug]) =>
    [...MOVE_FRAMES, ...BETWEENS.filter((_, i) => has(slug, i))].map((frame) => ({
      slug,
      frame,
      file: `${dir}/${slug}/${frame}.svg`,
    })),
  );

  it("has three frames for every move, and exactly the in-betweens the catalogue lists", () => {
    expect(MOVE_ROWS.length).toBeGreaterThanOrEqual(300);
    const missing = frames.filter((f) => !existsSync(f.file)).map((f) => `${f.slug}/${f.frame}`);
    expect(missing).toEqual([]);
    const unlisted = MOVE_ROWS.flatMap(([slug]) =>
      BETWEENS.filter((name, i) => !has(slug, i) && existsSync(`${dir}/${slug}/${name}.svg`)).map(
        (name) => `${slug}/${name}`,
      ),
    );
    expect(unlisted).toEqual([]);
    expect(Object.keys(MOVE_BETWEENS).every((slug) => MOVE_ROWS.some(([s]) => s === slug))).toBe(
      true,
    );
  });

  it("plays every move as five poses: the keys, with an in-between or the middle key between", () => {
    const [slug] = Object.entries(MOVE_BETWEENS).find(([, mask]) => mask === 3) ?? [];
    if (slug) expect(moveLoop(slug)).toEqual([1, "1-2", 2, "2-3", 3]);
    const [plain] = MOVE_ROWS.find(([s]) => !MOVE_BETWEENS[s]) ?? [];
    if (plain) expect(moveLoop(plain)).toEqual([1, 2, 2, 2, 3]);
    const [first] = Object.entries(MOVE_BETWEENS).find(([, mask]) => mask === 1) ?? [];
    if (first) expect(moveLoop(first)).toEqual([1, "1-2", 2, 2, 3]);
  });

  it("draws every frame of every move with the same pen, inside the canvas", () => {
    const weights = new Set<string>();
    const wrong: string[] = [];
    let bytes = 0;
    for (const { slug, frame, file } of frames) {
      const svg = readFileSync(file, "utf8");
      bytes += svg.length;
      const match = FRAME.exec(svg);
      if (!match) {
        wrong.push(`${slug}/${frame}: not a single stroked path`);
        continue;
      }
      weights.add(match[1]!);
      const d = match[2]!;
      // A figure is hundreds of units of line; a frame with next to nothing would blink.
      if (d.length < 600) wrong.push(`${slug}/${frame}: almost empty`);
      if (svg.length > 40_000) wrong.push(`${slug}/${frame}: ${svg.length} bytes`);
      const box = reach(d);
      if (box.minX < 6 || box.minY < 6 || box.maxX > 506 || box.maxY > 506)
        wrong.push(`${slug}/${frame}: runs off the canvas`);
    }
    expect(wrong).toEqual([]);
    expect([...weights], "one line weight for the whole library").toHaveLength(1);
    expect(bytes).toBeLessThan(9 * 1024 * 1024);
  });

  it("fills the canvas alike: each move reaches its margin on at least one side", () => {
    const loose: string[] = [];
    for (const [slug] of MOVE_ROWS) {
      const boxes = MOVE_FRAMES.map((frame) =>
        reach(FRAME.exec(readFileSync(`${dir}/${slug}/${frame}.svg`, "utf8"))![2]!),
      );
      const span = Math.max(
        Math.max(...boxes.map((b) => b.maxX)) - Math.min(...boxes.map((b) => b.minX)),
        Math.max(...boxes.map((b) => b.maxY)) - Math.min(...boxes.map((b) => b.minY)),
      );
      if (span < 440) loose.push(`${slug}: ${Math.round(span)}`);
    }
    expect(loose).toEqual([]);
  });
});
