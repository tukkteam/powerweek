#!/usr/bin/env node
/**
 * Imports the PowerWeek move library: 302 exercise illustrations (three frames each) from
 * Workout Guide by Bryl Lim (https://github.com/bryllim/workout-guide), whose pose artwork builds
 * on Everkinetic (https://github.com/everkinetic/data). Artwork license: CC BY-SA 4.0.
 *
 * - Optimises every frame with SVGO (whole-unit coordinates, no fill colour) into
 *   apps/web/public/moves/<slug>/<frame>.svg. The app tints them with CSS masks.
 * - Writes the catalogue (name, equipment, muscles, type) to packages/core/src/moves-data.ts.
 *
 * Usage: pnpm moves              downloads the pinned commit from GitHub
 *        pnpm moves --from DIR   uses a local checkout of bryllim/workout-guide instead
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { optimize } from "svgo";

const REPO = "bryllim/workout-guide";
const COMMIT = "aac599224bb9780305239607ef98540b7e0ce389";
const FRAMES = [1, 2, 3];

const root = fileURLToPath(new URL("..", import.meta.url));
const publicDir = join(root, "apps/web/public/moves");
const dataFile = join(root, "packages/core/src/moves-data.ts");

/** Upstream equipment and muscle names → PowerWeek ids (see packages/core/src/moves.ts). */
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

const SVGO = {
  multipass: true,
  floatPrecision: 0,
  plugins: [
    {
      name: "preset-default",
      params: { overrides: { convertPathData: { floatPrecision: 0, transformPrecision: 2 } } },
    },
    "removeDimensions",
    { name: "removeAttrs", params: { attrs: "fill" } },
  ],
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

rmSync(publicDir, { recursive: true, force: true });
let bytesIn = 0;
let bytesOut = 0;
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

  mkdirSync(join(publicDir, slug), { recursive: true });
  for (const frame of FRAMES) {
    const input = join(source, "assets", slug, `frame-${frame}.svg`);
    if (!existsSync(input)) throw new Error(`Missing ${input}`);
    const svg = readFileSync(input, "utf8");
    const { data } = optimize(svg, SVGO);
    if (!data.includes('viewBox="0 0 512 512"') || !data.includes("<path")) {
      throw new Error(`${slug} frame ${frame}: unexpected SVG after optimisation`);
    }
    writeFileSync(join(publicDir, slug, `${frame}.svg`), `${data}\n`);
    bytesIn += statSync(input).size;
    bytesOut += data.length + 1;
  }
}

writeFileSync(
  join(publicDir, "README.md"),
  `# Move library artwork

The exercise illustrations in this folder come from **Workout Guide** by Bryl Lim
(https://github.com/${REPO}, commit \`${COMMIT.slice(0, 7)}\`), whose pose artwork builds on
**Everkinetic** (https://github.com/everkinetic/data).

- License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0),
  https://creativecommons.org/licenses/by-sa/4.0/
- Changes: optimised with SVGO (coordinates rounded to whole units, fill colour removed).
  PowerWeek tints them at render time with CSS masks.
- These adapted files are shared under the same license. The rest of PowerWeek is MIT.
- Per-frame credits, including the Everkinetic source of each adapted pose, are listed in the
  upstream manifest: https://github.com/${REPO}/blob/${COMMIT}/packages/workout-guide/manifest.json

Regenerate with \`pnpm moves\` (see scripts/moves.mjs).
`,
);

const body = rows.map((row) => `  ${JSON.stringify(row)},`).join("\n");
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

/** [slug, English name, equipment, primary muscles, secondary muscles, type, stretch?] */
export const MOVE_ROWS: readonly MoveRow[] = [
${body}
];
`,
);

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
console.log(
  `${rows.length} moves, ${rows.length * FRAMES.length} frames: ${mb(bytesIn)} → ${mb(bytesOut)}`,
);
