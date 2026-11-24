#!/usr/bin/env node
/**
 * Checks the module tones in tokens.json. A tone is the one colour a module draws itself in,
 * as text, as a fill under text and next to other modules' tones, so every tone must:
 *
 *   1. read as text on bg, surface and surface-raised (WCAG 4.5:1 or more);
 *   2. carry text in the bg colour when used as a fill (4.5:1 or more);
 *   3. stay apart from every other tone: OKLab ΔE×100 of 8 or more under simulated
 *      protanopia and deuteranopia, and 15 or more for full colour vision.
 *
 * The thresholds and the simulation (Machado, Oliveira and Fernandes 2009, severity 1) are the
 * ones commonly used to validate categorical palettes. Pairs listed in KNOWN are accepted
 * exceptions; the script fails if one of them stops being an exception, so the list stays true.
 *
 *   node scripts/tones.mjs    exit 1 when a tone breaks a rule
 */
import { readFileSync } from "node:fs";

const tokens = JSON.parse(readFileSync(new URL("../tokens.json", import.meta.url), "utf8"));

const TEXT_MIN = 4.5;
const CVD_MIN = 8;
const NORMAL_MIN = 15;

/**
 * Pairs that do not meet rule 3, by theme. Training (the brand colour) and Meals were chosen
 * before this check existed; by Day they are hard to tell apart with red-green colour blindness.
 * They never appear without their icon and name. Changing either is a brand decision.
 */
const KNOWN = { light: [["tone-volt", "tone-orange"]], dark: [] };

const MACHADO = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};

const toLinear = (hex) =>
  [0, 2, 4]
    .map((i) => parseInt(hex.replace(/^#/, "").slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));

const luminance = (hex) => {
  const [r, g, b] = toLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const oklab = ([r, g, b]) => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

const seenAs = (hex, kind) => {
  const rgb = toLinear(hex);
  if (!kind) return rgb;
  return MACHADO[kind].map((row) =>
    Math.max(0, Math.min(1, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])),
  );
};

/** Distance between two colours in OKLab ×100, optionally as seen with a colour vision deficiency. */
const distance = (a, b, kind) => {
  const x = oklab(seenAs(a, kind));
  const y = oklab(seenAs(b, kind));
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

const colours = new Map(tokens.color.tokens.map((token) => [token.name, token.value]));
const resolve = (name, theme) => {
  const value = colours.get(name)?.[theme];
  const alias = /^\{([^}]+)\}$/.exec(value ?? "");
  return alias ? resolve(alias[1], theme) : value;
};

const tones = [...colours.keys()].filter((name) => name.startsWith("tone-"));
const problems = [];

for (const theme of tokens.color.themes.map((entry) => entry.id)) {
  const bg = resolve("bg", theme);
  for (const tone of tones) {
    const hex = resolve(tone, theme);
    for (const surface of ["bg", "surface", "surface-raised"]) {
      const ratio = contrast(hex, resolve(surface, theme));
      if (ratio < TEXT_MIN)
        problems.push(
          `${theme}: ${tone} on ${surface} is ${ratio.toFixed(2)}:1, under ${TEXT_MIN}:1`,
        );
    }
    const under = contrast(bg, hex);
    if (under < TEXT_MIN)
      problems.push(`${theme}: bg text on ${tone} is ${under.toFixed(2)}:1, under ${TEXT_MIN}:1`);
  }

  const known = KNOWN[theme] ?? [];
  const isKnown = (a, b) => known.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  for (let i = 0; i < tones.length; i += 1) {
    for (let j = i + 1; j < tones.length; j += 1) {
      const [a, b] = [tones[i], tones[j]];
      const [x, y] = [resolve(a, theme), resolve(b, theme)];
      const cvd = Math.min(distance(x, y, "protan"), distance(x, y, "deutan"));
      const normal = distance(x, y);
      const apart = cvd >= CVD_MIN && normal >= NORMAL_MIN;
      if (!apart && !isKnown(a, b))
        problems.push(
          `${theme}: ${a} and ${b} are too close (colour-blind ${cvd.toFixed(1)}, needs ${CVD_MIN}; full vision ${normal.toFixed(1)}, needs ${NORMAL_MIN})`,
        );
      if (apart && isKnown(a, b))
        problems.push(`${theme}: ${a} and ${b} are apart now; remove them from KNOWN`);
    }
  }
}

if (problems.length > 0) {
  console.error(
    `Module tones: ${problems.length} problem(s)\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(`Module tones: ${tones.length} tones pass contrast and separation in every theme.`);
