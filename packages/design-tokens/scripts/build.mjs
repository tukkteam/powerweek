#!/usr/bin/env node
/**
 * Compiles tokens.json (the same file the PowerWeek Claude Design System holds) into
 * tokens.css: CSS custom properties per theme plus the shared scales.
 *
 *   node scripts/build.mjs          write tokens.css
 *   node scripts/build.mjs --check  fail if tokens.css is out of date (used in CI)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const tokens = JSON.parse(readFileSync(new URL("tokens.json", root), "utf8"));
const outFile = fileURLToPath(new URL("tokens.css", root));

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

const scales = [
  ...(tokens.spacing?.tokens ?? []).map((t) => [t.name, t.value]),
  ...(tokens.radius?.tokens ?? []).map((t) => [t.name, t.value]),
  ...Object.entries(tokens.type?.families ?? {}).map(([key, stack]) => [`font-${key}`, stack]),
];
blocks.push(`:root {\n${decls(scales)}\n}`);

const css = `${blocks.join("\n\n")}\n`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(outFile, "utf8");
  } catch {}
  if (current !== css) {
    console.error("tokens.css is out of date. Run: pnpm tokens");
    process.exit(1);
  }
  console.log("tokens.css is up to date.");
} else {
  writeFileSync(outFile, css);
  console.log(`Wrote ${outFile}`);
}
