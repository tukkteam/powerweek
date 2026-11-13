#!/usr/bin/env node
/**
 * Generates the app icons from one SVG: seven pill bars (one per weekday) on a volt tile.
 * Run with `pnpm --filter @powerweek/web icons` after changing the mark.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const VOLT = "#d4ff3a";
const INK = "#0b0b0c";
const HEIGHTS = [0.55, 0.38, 0.85, 0.3, 0.7, 0.22, 0.48];

/** @param {{ size: number, radius: number, inset: number }} o */
function markSvg({ size, radius, inset }) {
  const area = size - inset * 2;
  const gap = area * 0.045;
  const barWidth = (area * 0.8 - gap * 6) / 7;
  const startX = inset + area * 0.1;
  const baseline = inset + area * 0.84;
  const maxHeight = area * 0.66;
  const bars = HEIGHTS.map((h, i) => {
    const height = Math.max(barWidth, h * maxHeight);
    const x = startX + i * (barWidth + gap);
    return `<rect x="${x.toFixed(2)}" y="${(baseline - height).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${height.toFixed(2)}" rx="${(barWidth / 2).toFixed(2)}" fill="${INK}"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${VOLT}"/>${bars}</svg>`;
}

const out = new URL("../public/", import.meta.url);
writeFileSync(new URL("icon.svg", out), markSvg({ size: 512, radius: 112, inset: 0 }));

const targets = [
  { file: "icon-192.png", size: 192, radius: 42, inset: 0 },
  { file: "icon-512.png", size: 512, radius: 112, inset: 0 },
  { file: "apple-touch-icon.png", size: 180, radius: 0, inset: 0 },
  // Maskable: full-bleed volt, mark inside the 80% safe zone.
  { file: "icon-maskable-512.png", size: 512, radius: 0, inset: 64 },
];

for (const t of targets) {
  const svg = t.inset
    ? markSvg({ size: t.size, radius: 0, inset: t.inset }).replace(
        `rx="0" fill="${VOLT}"`,
        `fill="${VOLT}"`,
      )
    : markSvg(t);
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(fileURLToPath(new URL(t.file, out)));
  console.log(`wrote public/${t.file}`);
}
