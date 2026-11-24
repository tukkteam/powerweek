import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findMotionLiterals } from "./motion-literals";

const lines = (path: string, source: string) => findMotionLiterals(path, source).map((f) => f.line);

describe("findMotionLiterals", () => {
  it("finds curves, keywords and durations typed into CSS", () => {
    const css = [
      ".a { transition: width 700ms cubic-bezier(0.2, 0.8, 0.2, 1); }",
      ".b { animation: pw-fade 200ms ease-out both; }",
      ".c {",
      "  transition:",
      "    top var(--duration-slow) var(--easing-standard),",
      "    filter 160ms var(--easing-standard);",
      "}",
      ".d { --curve: cubic-bezier(0, 0, 1, 1); }",
      ".e { transition-duration: 1.2s; }",
    ].join("\n");
    expect(lines("x.css", css)).toEqual([1, 2, 5, 8, 9]);
  });

  it("lets tokens, loops, delays and comments through in CSS", () => {
    const css = [
      ".a { transition: width var(--duration-glide) var(--easing-standard); }",
      ".b { animation: pw-live 1600ms var(--easing-sway) infinite; }",
      ".c { animation: pw-march 1.4s linear infinite; }",
      ".d { animation-delay: 350ms; transition-delay: 80ms; }",
      "/* was: transition: width 700ms cubic-bezier(0.2, 0.8, 0.2, 1); */",
      ".e { transition: none; }",
    ].join("\n");
    expect(lines("x.css", css)).toEqual([]);
  });

  it("finds Tailwind durations, easings and arbitrary values in code", () => {
    const tsx = [
      'const a = "transition-colors duration-150 ease-out";',
      'const b = "transition ease-in-out";',
      'const c = "duration-[250ms]";',
      'const d = "[transition:opacity_200ms_ease]";',
      'const e = "transition duration-(--duration-quick) ease-standard";',
    ].join("\n");
    expect(lines("x.tsx", tsx)).toEqual([1, 2, 3, 4]);
  });

  it("finds literals in style objects and in the Web Animations API", () => {
    const tsx = [
      "node.animate(frames, { duration: 260, easing: EASE });",
      'node.animate(frames, { duration: durations.base, easing: "ease-out" });',
      "node.animate(frames, { duration: springs.bouncy.duration, easing: springEasing('bouncy') });",
      "const style = { transition: `scale ${MS}ms ${CURVE}` };",
      'const ok = { transition: "scale var(--spring-bouncy-duration) var(--spring-bouncy)" };',
      'const loop = { animationDuration: "300ms", animationDelay: "-80ms" };',
      'const fallback = "cubic-bezier(0.2, 0.8, 0.2, 1)";',
    ].join("\n");
    expect(lines("x.tsx", tsx)).toEqual([1, 2, 4, 7]);
  });

  it("ignores comments in code, but not URLs in strings", () => {
    const ts = [
      "// eases out like cubic-bezier(0.2, 0.8, 0.2, 1) over 200ms",
      "/** duration-150 used to be here */",
      'const url = "https://example.com/duration-150";',
    ].join("\n");
    expect(lines("x.ts", ts)).toEqual([3]);
  });

  it("does not count a duration that is not motion", () => {
    const ts = [
      "const wait = setTimeout(done, 3500);",
      "const LONG_PRESS = 400;",
      "const meal = { duration: 45 };",
    ].join("\n");
    expect(lines("x.ts", ts)).toEqual([]);
  });
});

describe("the app", () => {
  it("takes every easing and duration from the motion tokens", () => {
    const app = fileURLToPath(new URL("..", import.meta.url));
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
          for (const f of findMotionLiterals(path, readFileSync(path, "utf8")))
            offenders.push(`${relative(app, path)}:${f.line}  ${f.why}\n    ${f.text}`);
      }
    };
    for (const dir of ["app", "components", "lib", "modules"]) walk(join(app, dir));
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
