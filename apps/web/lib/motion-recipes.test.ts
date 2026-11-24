import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SCREENS, slideTo } from "@/components/app/page-slide";
import { durations, springs, tempo } from "./motion";

/*
 * The recipes in docs/motion.md are how the app stays one way of moving. These tests make sure
 * new code uses them, and that the one dial (`tempo`) reaches every value.
 */

const app = fileURLToPath(new URL("..", import.meta.url));
const root = fileURLToPath(new URL("../../..", import.meta.url));

function sources(dir: string, match: RegExp): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sources(path, match));
    else if (match.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(path);
  }
  return found;
}

describe("recipes", () => {
  it("every dialog opens and closes with useDialogMotion", () => {
    const files = ["app", "components", "modules"].flatMap((d) => sources(join(app, d), /\.tsx$/));
    const bare = files
      .filter((f) => /<dialog\b/.test(readFileSync(f, "utf8")))
      .filter((f) => !/useDialogMotion\(/.test(readFileSync(f, "utf8")))
      .map((f) => relative(app, f));
    expect(bare, `Use useDialogMotion (docs/motion.md) in: ${bare.join(", ")}`).toEqual([]);
  });

  it("no dialog is closed directly, skipping the way back", () => {
    const files = ["components", "modules"].flatMap((d) => sources(join(app, d), /\.tsx$/));
    const direct = files
      .filter((f) => /\b(?:ref|dialogRef|Ref)\.current\?\.close\(\)/.test(readFileSync(f, "utf8")))
      .map((f) => relative(app, f));
    expect(direct, `Call close() from useDialogMotion in: ${direct.join(", ")}`).toEqual([]);
  });

  it("every screen of the app slides in and out with PageSlide", () => {
    const pages = sources(join(app, "app/[lang]/app"), /^page\.tsx$/);
    expect(pages.length).toBeGreaterThanOrEqual(SCREENS.length);
    const still = pages
      .filter((f) => !/<PageSlide>/.test(readFileSync(f, "utf8")))
      .map((f) => relative(app, f));
    expect(still, `Wrap these pages in <PageSlide>: ${still.join(", ")}`).toEqual([]);
  });

  it("screens slide the way their tabs are laid out", () => {
    expect(slideTo("today", "week")).toEqual(["pw-forward"]);
    expect(slideTo("week", "settings")).toEqual(["pw-forward"]);
    expect(slideTo("settings", "today")).toEqual(["pw-back"]);
    expect(slideTo("week", "today")).toEqual(["pw-back"]);
    // Staying put, or arriving from outside the app, doesn't slide.
    expect(slideTo("week", "week")).toBeUndefined();
    expect(slideTo(null, "week")).toBeUndefined();
  });
});

describe("the tempo dial", () => {
  const tokens = JSON.parse(
    readFileSync(join(root, "packages/design-tokens/tokens.json"), "utf8"),
  ) as {
    motion: {
      tempo: { value: number };
      durations: { name: string; value: string }[];
      springs: { name: string; response: number }[];
    };
  };

  it("is the one in tokens.json", () => {
    expect(tempo).toBe(tokens.motion.tempo.value);
  });

  it("scales every duration and every spring", () => {
    for (const t of tokens.motion.durations) {
      const key = t.name.replace("duration-", "") as keyof typeof durations;
      expect(durations[key]).toBe(Math.round(Number.parseInt(t.value) * tempo));
    }
    for (const t of tokens.motion.springs) {
      const key = t.name.replace("spring-", "") as keyof typeof springs;
      expect(springs[key].response).toBeCloseTo(t.response * tempo, 3);
    }
  });
});
