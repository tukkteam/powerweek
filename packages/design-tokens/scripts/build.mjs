#!/usr/bin/env node
/**
 * Compiles tokens.json (the same file the PowerWeek Claude Design System holds) into
 * tokens.css: CSS custom properties per theme plus the shared scales and motion; and into
 * motion.ts: the motion tokens for TypeScript.
 *
 *   node scripts/build.mjs          write tokens.css and motion.ts
 *   node scripts/build.mjs --check  fail if either is out of date (used in CI)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { linearEasing, sampleSpring } from "./spring.mjs";

const root = new URL("..", import.meta.url);
const tokens = JSON.parse(readFileSync(new URL("tokens.json", root), "utf8"));
const outFile = fileURLToPath(new URL("tokens.css", root));
const tsFile = fileURLToPath(new URL("motion.ts", root));

const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const alias = (value) => {
  const m = /^\{([^}]+)\}$/.exec(String(value).trim());
  return m ? `var(--${m[1]})` : value;
};
const valueFor = (token, themeId, firstThemeId) => {
  if (typeof token.value === "string")
    return themeId === firstThemeId ? alias(token.value) : undefined;
  return token.value[themeId] === undefined ? undefined : alias(token.value[themeId]);
};
const decls = (entries, indent = "  ") =>
  entries.map(([k, v]) => `${indent}--${k}: ${v};`).join("\n");

const themes = tokens.color.themes;
const first = themes[0].id;
const themed = [...tokens.color.tokens, ...(tokens.shadow?.tokens ?? [])];
for (const t of themed) if (!NAME.test(t.name)) throw new Error(`Invalid token name: ${t.name}`);

const blocks = [];
blocks.push(
  `/* ${tokens.name} — generated from tokens.json by @powerweek/design-tokens. Do not edit by hand. */`,
);

for (const theme of themes) {
  const entries = themed
    .map((t) => [t.name, valueFor(t, theme.id, first)])
    .filter(([, v]) => v !== undefined);
  const scheme = theme.id === "light" ? "light" : "dark";
  const selector =
    theme.id === first ? `:root,\n[data-theme="${theme.id}"]` : `[data-theme="${theme.id}"]`;
  blocks.push(`${selector} {\n  color-scheme: ${scheme};\n${decls(entries)}\n}`);
}

// "system" follows the OS: the first theme by default, the light theme when the OS asks for it.
const light = themes.find((t) => t.id === "light");
if (light) {
  const entries = themed
    .map((t) => [t.name, valueFor(t, light.id, first)])
    .filter(([, v]) => v !== undefined);
  blocks.push(
    `@media (prefers-color-scheme: light) {\n  [data-theme="system"] {\n    color-scheme: light;\n${decls(entries, "    ")}\n  }\n}`,
  );
}

// ── Motion: easings, durations and springs ──────────────────────────────────────────────────
const motion = tokens.motion ?? { easings: [], durations: [], springs: [] };
// The pace dial: every duration and every spring's response scale by it.
const tempo = motion.tempo?.value ?? 1;
if (!(tempo >= 0.5 && tempo <= 2))
  throw new Error(`motion.tempo must be between 0.5 and 2: ${tempo}`);
const paced = (n, places = 0) => Number((n * tempo).toFixed(places));
const named = (list, prefix) =>
  list.map((t) => {
    if (!NAME.test(t.name) || !t.name.startsWith(`${prefix}-`))
      throw new Error(`Motion tokens in this group are named ${prefix}-…: ${t.name}`);
    return { ...t, key: t.name.slice(prefix.length + 1) };
  });
const BEZIER = /^cubic-bezier\(\s*([\d.]+),\s*(-?[\d.]+),\s*([\d.]+),\s*(-?[\d.]+)\s*\)$/;
const easings = named(motion.easings, "easing").map((t) => {
  const m = BEZIER.exec(t.value);
  const points = m?.slice(1).map(Number);
  if (!points || points[0] > 1 || points[2] > 1)
    throw new Error(`Easings are cubic-bezier() with x between 0 and 1: ${t.name}`);
  return { ...t, points };
});
const durations = named(motion.durations, "duration").map((t) => {
  const m = /^(\d+)ms$/.exec(t.value);
  if (!m) throw new Error(`Durations are whole milliseconds, like "200ms": ${t.name}`);
  const ms = paced(Number(m[1]));
  return { ...t, ms, value: `${ms}ms` };
});
const springs = named(motion.springs, "spring").map((t) => {
  const response = paced(t.response, 3);
  return { ...t, response, ...sampleSpring({ ...t, response }) };
});

// How a pressed control sinks: scale limits, the reach in pixels, and the brightness held.
const press = motion.press ?? { deep: 0.96, shallow: 0.98, reach: 3, dim: 0.9, usage: "" };
if (!(press.deep > 0.8 && press.deep <= press.shallow && press.shallow <= 1))
  throw new Error("motion.press: 0.8 < deep <= shallow <= 1");
if (!(press.reach > 0 && press.dim > 0 && press.dim <= 1))
  throw new Error("motion.press: reach above 0, dim between 0 and 1");

const scales = [
  ...(tokens.spacing?.tokens ?? []).map((t) => [t.name, t.value]),
  ...(tokens.radius?.tokens ?? []).map((t) => [t.name, t.value]),
  ...Object.entries(tokens.type?.families ?? {}).map(([key, stack]) => [`font-${key}`, stack]),
  ...easings.map((t) => [t.name, t.value]),
  ...durations.map((t) => [t.name, t.value]),
  ...springs.flatMap((t) => [
    [t.name, linearEasing(t.points)],
    [`${t.name}-duration`, `${t.duration}ms`],
  ]),
];
blocks.push(`:root {\n${decls(scales)}\n}`);

// Browsers without linear() (Safari before 17.2) get the standard easing instead of a spring.
if (springs.length && easings.some((t) => t.key === "standard")) {
  const fallback = springs.map((t) => [t.name, "var(--easing-standard)"]);
  blocks.push(
    `@supports not (transition-timing-function: linear(0, 1)) {\n  :root {\n${decls(fallback, "    ")}\n  }\n}`,
  );
}

const css = `${blocks.join("\n\n")}\n`;

// The same values for TypeScript: the Web Animations API, springs in JS, tweened numbers.
const entries = (list, value) =>
  list.map((t) => `  /** ${t.usage} */\n  ${JSON.stringify(t.key)}: ${value(t)},`).join("\n");
const ts = `// ${tokens.name} motion tokens, generated from tokens.json by @powerweek/design-tokens. Do not edit by hand.

/** The pace dial these values were built with (tokens.json, motion.tempo). */
export const tempo = ${tempo};

/** Easing curves as CSS values. Read \`bezier\` for the four control numbers. */
export const easings = {
${entries(easings, (t) => JSON.stringify(t.value))}
} as const;

/** The control points of each easing, for code that eases numbers itself. */
export const bezier = {
${entries(easings, (t) => `[${t.points.join(", ")}]`)}
} as const satisfies Record<keyof typeof easings, readonly [number, number, number, number]>;

/** Durations in milliseconds. */
export const durations = {
${entries(durations, (t) => String(t.ms))}
} as const;

/**
 * Springs: \`response\` (seconds) and \`damping\` (ratio) as in SwiftUI, and the same spring as a
 * CSS \`linear()\` easing that settles in \`duration\` milliseconds.
 */
export const springs = {
${entries(
  springs,
  (t) =>
    `{\n    response: ${t.response},\n    damping: ${t.damping},\n    duration: ${t.duration},\n    easing: ${JSON.stringify(linearEasing(t.points))},\n  }`,
)}
} as const;

/** ${press.usage} */
export const press = {
  deep: ${press.deep},
  shallow: ${press.shallow},
  reach: ${press.reach},
  dim: ${press.dim},
} as const;

export type EasingName = keyof typeof easings;
export type DurationName = keyof typeof durations;
export type SpringName = keyof typeof springs;
`;

const outputs = [
  [outFile, css],
  [tsFile, ts],
];
if (process.argv.includes("--check")) {
  const stale = outputs.filter(([file, content]) => {
    try {
      return readFileSync(file, "utf8") !== content;
    } catch {
      return true;
    }
  });
  if (stale.length) {
    console.error(`${stale.map(([f]) => basename(f)).join(" and ")} out of date. Run: pnpm tokens`);
    process.exit(1);
  }
  console.log("tokens.css and motion.ts are up to date.");
} else {
  for (const [file, content] of outputs) {
    writeFileSync(file, content);
    console.log(`Wrote ${file}`);
  }
}
