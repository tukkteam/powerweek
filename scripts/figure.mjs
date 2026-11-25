#!/usr/bin/env node
/**
 * Draws the mannequin's exercises to a PNG contact sheet, to look at poses without a browser.
 *
 *   pnpm figure squat deadlift             three stills of each: start, halfway, end
 *   pnpm figure --all                      every exercise
 *   pnpm figure squat --turn               one pose seen from eight sides
 *   pnpm figure squat --steps 8            eight stills along the way out
 *   pnpm figure --family cable             every exercise in library/cable.ts, and only that
 *                                          file is loaded: others may be half written
 *   pnpm figure --missing                  the moves of the catalogue not laid out yet
 *   options: --out FILE (default tmp/figure.png)  --size 220  --columns N  --rows 5
 *
 * A sheet of more than `--rows` rows is written as several files: figure-1.png, figure-2.png…
 *
 * Names may be slugs or the start of one (`banded-` draws every banded move). After drawing, it
 * prints what the tests would find wrong with those exercises (figure/checks.ts).
 */
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = resolve(root, "apps/web");
// The web app owns the tools this borrows: the module loader of its test runner, and sharp.
const fromWeb = createRequire(resolve(web, "package.json"));
const { createViteServer } = await import(pathToFileURL(fromWeb.resolve("vitest/node")).href);
const sharp = fromWeb("sharp");

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  if (at < 0) return fallback;
  const [, value] = args.splice(at, 2);
  return value;
};
const flag = (name) => {
  const at = args.indexOf(`--${name}`);
  if (at >= 0) args.splice(at, 1);
  return at >= 0;
};
const out = resolve(root, option("out", "tmp/figure.png"));
const size = Number(option("size", 220));
const steps = Number(option("steps", 3));
const rows = Number(option("rows", 5));
const turn = flag("turn");
const family = option("family");
const missing = flag("missing");
const all = flag("all") || Boolean(family && !args.length);
const columns = Number(option("columns", turn ? 4 : steps === 3 ? 6 : steps));

const server = await createViteServer({
  root: web,
  configFile: false,
  logLevel: "error",
  appType: "custom",
  resolve: { alias: { "@": web } },
  oxc: { jsx: { runtime: "automatic" } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const load = (file) => server.ssrLoadModule(`/modules/train/${file}`);
  const EXERCISES = family
    ? (await load(`figure/library/${family}.ts`)).default
    : (await load("figure/library.ts")).EXERCISES;
  if (missing) {
    const { MOVES } = await load("moves.ts");
    const todo = MOVES.filter((move) => !EXERCISES[move.slug]);
    const by = Object.groupBy(todo, (move) => move.equipment);
    for (const [equipment, moves] of Object.entries(by))
      console.log(`${equipment} (${moves.length}): ${moves.map((move) => move.slug).join(" ")}`);
    console.log(`${MOVES.length - todo.length} of ${MOVES.length} laid out, ${todo.length} to go.`);
    process.exit(0);
  }
  const { sheet } = await load("figure/sheet.tsx");
  const { problems } = await load("figure/checks.ts");
  const known = Object.keys(EXERCISES);
  const slugs = all
    ? known
    : args.flatMap((name) => {
        const found = known.filter((slug) => slug === name);
        const begun = found.length ? found : known.filter((slug) => slug.startsWith(name));
        if (!begun.length) console.error(`No exercise called ${name}`);
        return begun;
      });
  if (!slugs.length) {
    console.error("Nothing to draw. Give slugs, or --all.");
    process.exitCode = 1;
  } else {
    const cells = slugs.flatMap((slug) => {
      const exercise = EXERCISES[slug];
      if (turn)
        return [0, 45, 90, 135, 180, 225, 270, 315].map((yaw) => ({
          label: `${slug} · ${yaw}°`,
          exercise: { ...exercise, view: { ...exercise.view, yaw } },
          phase: 0.25,
        }));
      return Array.from({ length: steps }, (_, k) => ({
        label: `${slug} · ${k + 1}/${steps}`,
        exercise,
        phase: steps === 1 ? 0 : (k / (steps - 1)) * 0.5,
      }));
    });
    mkdirSync(dirname(out), { recursive: true });
    const each = columns * rows;
    const pages = Math.ceil(cells.length / each);
    const files = [];
    for (let page = 0; page < pages; page++) {
      const svg = sheet(cells.slice(page * each, (page + 1) * each), {
        columns,
        size,
        ink: "#d7ff3f",
        paper: "#101010",
        text: "#aaaaaa",
      });
      const file = pages > 1 ? out.replace(/(\.\w+)$/, `-${page + 1}$1`) : out;
      await sharp(Buffer.from(svg), { density: 72 }).png().toFile(file);
      files.push(file);
    }
    console.log(`${cells.length} drawings of ${slugs.length} exercises:\n${files.join("\n")}`);
    // What the tests would say of them.
    let wrong = 0;
    for (const slug of slugs)
      for (const problem of problems(EXERCISES[slug])) {
        console.log(`✗ ${slug}: ${problem}`);
        wrong++;
      }
    console.log(wrong ? `${wrong} problems.` : "No problems found by the checks.");
  }
} finally {
  await server.close();
}
