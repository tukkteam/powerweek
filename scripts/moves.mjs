#!/usr/bin/env node
/**
 * Imports the PowerWeek move library: 302 exercise illustrations (three frames each) from
 * Workout Guide by Bryl Lim (https://github.com/bryllim/workout-guide), whose pose artwork builds
 * on Everkinetic (https://github.com/everkinetic/data). Artwork license: CC BY-SA 4.0.
 *
 * - Redraws every frame with one pen, takes the detail out of the figures and lines up the frames
 *   of each exercise (scripts/moves/art.mjs says how and why) into apps/web/public/moves/<slug>/<frame>.svg. The app tints them
 *   with CSS masks.
 * - Writes the catalogue (name, equipment, muscles, type) to
 *   apps/web/modules/train/moves-data.ts.
 *
 * Usage: pnpm moves                 downloads the pinned commit from GitHub
 *        pnpm moves --from DIR      uses a local checkout of bryllim/workout-guide instead
 *        pnpm moves --only a,b      redraws only those moves (the catalogue is left alone)
 *        pnpm moves --report FILE   also writes what was done to each move, as JSON
 *
 * Drawing takes a few minutes; it runs on every core.
 *
 * DEPRECATED since 2026-11-25: the drawn frames are superseded by the mannequin
 * (docs/adr/0013-mannequin.md, apps/web/modules/train/figure) and kept only as a fallback for a
 * move with no figure. Removal is tracked in https://github.com/tukkteam/powerweek/issues/35.
 * The catalogue import is not deprecated: moves-data.ts still comes from here.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { PEN } from "./moves/art.mjs";

console.warn(
  "pnpm moves: the drawn frames are deprecated (ADR 0013) and kept only as a fallback; " +
    "removal is tracked in https://github.com/tukkteam/powerweek/issues/35",
);

const REPO = "bryllim/workout-guide";
const COMMIT = "aac599224bb9780305239607ef98540b7e0ce389";
const FRAMES = [1, 2, 3];

const root = fileURLToPath(new URL("..", import.meta.url));
const publicDir = join(root, "apps/web/public/moves");
const dataFile = join(root, "apps/web/modules/train/moves-data.ts");

/** Upstream equipment and muscle names → PowerWeek ids (see apps/web/modules/train/moves.ts). */
const EQUIPMENT = {
  Barbell: "barbell",
  Dumbbell: "dumbbell",
  Machine: "machine",
  Cable: "cable",
  Bodyweight: "bodyweight",
  "Resistance Band": "band",
  Kettlebell: "kettlebell",
  Plate: "plate",
  "Pull-up Bar": "pull-up-bar",
  Cardio: "cardio",
  Bench: "bench",
  Box: "box",
  Wall: "wall",
  Towel: "towel",
  Doorway: "doorway",
  Chair: "chair",
  "Stability Ball": "stability-ball",
};
const MUSCLES = {
  Chest: ["chest"],
  Shoulders: ["shoulders"],
  "Rear Delts": ["rear-delts"],
  Biceps: ["biceps"],
  Triceps: ["triceps"],
  Forearms: ["forearms"],
  Grip: ["forearms"],
  Core: ["core"],
  "Upper Back": ["upper-back"],
  Back: ["lats", "upper-back"],
  Lats: ["lats"],
  "Lower Back": ["lower-back"],
  Glutes: ["glutes"],
  Quads: ["quads"],
  Hamstrings: ["hamstrings"],
  Legs: ["quads", "hamstrings", "glutes", "calves"],
  Calves: ["calves"],
  "Posterior Chain": ["hamstrings", "glutes", "lower-back"],
  Adductors: ["adductors"],
  Groin: ["adductors"],
  Hips: ["hips"],
  Cardio: ["cardio"],
  Mobility: ["mobility"],
};
const TYPES = {
  weight_reps: "reps",
  bodyweight_reps: "reps",
  assisted_bodyweight: "reps",
  duration: "time",
  distance_duration: "distance",
};

function arg(name) {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : undefined;
}

async function sourceDir() {
  const from = arg("--from");
  if (from) return join(from, "packages/workout-guide");
  const tmp = mkdtempSync(join(tmpdir(), "powerweek-moves-"));
  const url = `https://codeload.github.com/${REPO}/tar.gz/${COMMIT}`;
  console.log(`Downloading ${REPO}@${COMMIT.slice(0, 7)}…`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
  const archive = join(tmp, "source.tar.gz");
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  execFileSync("tar", ["-xzf", archive, "-C", tmp]);
  return join(tmp, `workout-guide-${COMMIT}`, "packages/workout-guide");
}

function mapAll(names, table, slug) {
  const out = [];
  for (const name of names) {
    const ids = table[name];
    if (!ids) throw new Error(`${slug}: unknown muscle "${name}" — add it to MUSCLES`);
    for (const id of ids) if (!out.includes(id)) out.push(id);
  }
  return out;
}

const source = await sourceDir();
const manifest = JSON.parse(readFileSync(join(source, "manifest.json"), "utf8"));
if (!Array.isArray(manifest) || manifest.length < 300) {
  throw new Error(`Unexpected manifest: ${manifest.length} entries`);
}

const only = arg("--only")?.split(",");
if (only) {
  const unknown = only.filter((slug) => !manifest.some((entry) => entry.slug === slug));
  if (unknown.length) throw new Error(`Unknown moves: ${unknown.join(", ")}`);
} else rmSync(publicDir, { recursive: true, force: true });
const rows = [];

for (const entry of manifest) {
  const { slug } = entry;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Bad slug: ${slug}`);
  const equipment = EQUIPMENT[entry.equipment];
  if (!equipment) throw new Error(`${slug}: unknown equipment "${entry.equipment}"`);
  const type = TYPES[entry.exerciseType];
  if (!type) throw new Error(`${slug}: unknown type "${entry.exerciseType}"`);

  const primary = mapAll([entry.primaryMuscle], MUSCLES, slug);
  const secondary = mapAll(entry.secondaryMuscles, MUSCLES, slug).filter(
    (id) => !primary.includes(id),
  );
  rows.push([
    slug,
    entry.name,
    equipment,
    primary.join(" "),
    secondary.join(" "),
    type,
    ...(entry.isStretch ? [1] : []),
  ]);
}

// Draw, on every core: each worker takes every nth move.
const todo = manifest
  .filter((entry) => !only || only.includes(entry.slug))
  .map(({ slug, equipment }) => ({ slug, equipment }));
const threads = Math.max(1, Math.min(availableParallelism() - 1, 8, todo.length));
console.log(`Drawing ${todo.length} moves on ${threads} threads…`);
const done = [];
await Promise.all(
  Array.from({ length: threads }, (_, n) => {
    const entries = todo.filter((_, i) => i % threads === n);
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./moves/worker.mjs", import.meta.url), {
        workerData: { source, publicDir, frames: FRAMES, entries },
      });
      worker.on("message", (result) => {
        done.push(result);
        if (done.length % 50 === 0) console.log(`  ${done.length} of ${todo.length}`);
      });
      worker.on("error", reject);
      worker.on("exit", (code) =>
        code ? reject(new Error(`A worker stopped (${code})`)) : resolve(),
      );
    });
  }),
);
done.sort((a, b) => a.slug.localeCompare(b.slug));
const bytesIn = done.reduce((sum, d) => sum + d.bytesIn, 0);
const bytesOut = done.reduce((sum, d) => sum + d.bytesOut, 0);
const report = arg("--report");
if (report) writeFileSync(report, `${JSON.stringify({ pen: PEN, moves: done }, null, 1)}\n`);

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const kept = done.reduce((sum, d) => sum + d.between.filter((b) => b.kept).length, 0);
const summary = `${done.length} moves, ${done.length * FRAMES.length} frames and ${kept} in-betweens: ${mb(bytesIn)} → ${mb(bytesOut)}`;
if (only) {
  console.log(summary);
  console.log(
    "The catalogue was left alone: run without --only to update which moves have in-betweens.",
  );
  process.exit(0);
}

writeFileSync(
  join(publicDir, "README.md"),
  `# Move library artwork

> **Deprecated** since 2026-11-25. PowerWeek draws every exercise with its own mannequin
> (docs/adr/0013-mannequin.md); these frames are kept only as a fallback for a move that has no
> figure yet, and are due to be removed: https://github.com/tukkteam/powerweek/issues/35

The exercise illustrations in this folder come from **Workout Guide** by Bryl Lim
(https://github.com/${REPO}, commit \`${COMMIT.slice(0, 7)}\`), whose pose artwork builds on
**Everkinetic** (https://github.com/everkinetic/data).

- License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0),
  https://creativecommons.org/licenses/by-sa/4.0/
- Changes: every frame is redrawn. Upstream's traced outlines are reduced to the line down the
  middle of each stroke and drawn again with a single pen (stroke width ${PEN.weight} on the 512
  canvas), so every frame of every exercise has the same line weight; marks drawn inside the
  figures (muscles, creases, machine details) are left out; the three frames of each
  exercise are moved and scaled so that what stays still (the floor, a bench, a bar) lies in
  the same place; and each exercise is fitted to the canvas with the same margin. The three
  poses of each exercise are upstream's. Files named 1-2.svg and 2-3.svg are new: a pose
  halfway between two of upstream's, made by bending the first until its outline is halfway
  to the second's (only where that holds together). PowerWeek tints the drawings at render
  time with CSS masks.
- These adapted files are shared under the same license. The rest of PowerWeek is MIT.
- Per-frame credits, including the Everkinetic source of each adapted pose, are listed in the
  upstream manifest: https://github.com/${REPO}/blob/${COMMIT}/packages/workout-guide/manifest.json

Regenerate with \`pnpm moves\` (see scripts/moves.mjs).
`,
);

const body = rows.map((row) => `  ${JSON.stringify(row)},`).join("\n");
const betweens = done
  .map((d) => [d.slug, (d.between[0].kept ? 1 : 0) + (d.between[1].kept ? 2 : 0)])
  .filter(([, mask]) => mask)
  .map(([slug, mask]) => `  ${JSON.stringify(slug)}: ${mask},`)
  .join("\n");
writeFileSync(
  dataFile,
  `// Generated by scripts/moves.mjs from ${REPO}@${COMMIT.slice(0, 7)}. Do not edit by hand.
// Catalogue: Workout Guide by Bryl Lim (MIT). Artwork in apps/web/public/moves: CC BY-SA 4.0,
// based on Everkinetic. See THIRD_PARTY_NOTICES.md.
import type { MoveRow } from "./moves";

export const MOVE_SOURCE = {
  name: "Workout Guide",
  author: "Bryl Lim",
  url: "https://github.com/${REPO}",
  commit: "${COMMIT}",
  artLicense: "CC BY-SA 4.0",
  artLicenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  basedOn: { name: "Everkinetic", url: "https://github.com/everkinetic/data" },
} as const;

/**
 * Which moves have a pose drawn between their key poses, for a smoother loop: 1 = between frames
 * 1 and 2 (1-2.svg), 2 = between 2 and 3 (2-3.svg), 3 = both. Moves not listed have neither.
 * @deprecated The drawn frames are a fallback only; the mannequin draws every move (ADR 0013).
 * Removal: issue #35.
 */
export const MOVE_BETWEENS: Readonly<Record<string, 1 | 2 | 3>> = {
${betweens}
};

/** [slug, English name, equipment, primary muscles, secondary muscles, type, stretch?] */
export const MOVE_ROWS: readonly MoveRow[] = [
${body}
];
`,
);

console.log(summary);
