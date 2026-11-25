/**
 * Finds motion written by hand: an easing curve or a duration typed into a component or a
 * stylesheet instead of taken from the motion tokens. `motion-literals.test.ts` runs it over the
 * whole app, so `pnpm verify` (and CI) fail when one slips in.
 *
 * Allowed on purpose: the period of an endless loop (`infinite`), which is the rhythm of one
 * illustration rather than shared motion; delays, which are choreography; the `linear` keyword.
 */

export interface MotionLiteral {
  line: number;
  text: string;
  why: string;
}

const CURVE = /cubic-bezier\(|linear\(\s*\d/;
const TIME = /(?<![\w.-])\d+(?:\.\d+)?m?s\b/;
const KEYWORD = /(?<![\w-])ease(?:-in|-out|-in-out)?(?![\w-])/;

/** CSS declarations that carry motion (the `-delay` ones are left out on purpose). */
const CSS_DECLARATION =
  /(?<![\w-])(?:transition|animation)(?:-duration|-timing-function)?\s*:\s*([^;{}]+)/g;
/** The same as a Tailwind arbitrary property: `[transition:…]`. */
const ARBITRARY = /\[(?:transition|animation)(?:-duration|-timing-function)?:([^\]]+)\]/g;
/** The same in a React style object. */
const STYLE_KEY =
  /\b(?:transition|animation|transitionDuration|transitionTimingFunction|animationTimingFunction)\s*:\s*(["'`])([^"'`]*)\1/g;
/**
 * Web Animations API and `motion` options: a number or a string typed in place of a token. A
 * duration of exactly 0 is a jump to a value, not motion, so it may stay.
 */
const ANIMATE_OPTION = /\b(duration|easing|ease)\s*:\s*(?:(?!0(?![\d.]))\d|["'`])/g;

const TAILWIND: [RegExp, string][] = [
  [/(?<![\w-])duration-\d/, "a Tailwind duration; use duration-(--duration-…)"],
  [/(?<![\w-])ease-(?:in|out|in-out)(?![\w-])/, "a Tailwind easing; use ease-standard and friends"],
  [/(?<![\w-])(?:duration|ease)-\[/, "an arbitrary Tailwind duration or easing; use a token"],
];

function checkValue(value: string): string | null {
  if (CURVE.test(value))
    return "a hand-written easing curve; use an --easing-* or --spring-* token";
  if (KEYWORD.test(value)) return "an `ease` keyword; use an --easing-* token";
  if (!/\binfinite\b/.test(value) && (TIME.test(value) || /\}m?s\b/.test(value)))
    return "a hand-written duration; use a --duration-* token";
  return null;
}

/** Blanks comments but keeps every other character, so offsets and line numbers stay right. */
function withoutComments(text: string, css: boolean): string {
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  const out = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  return css ? out : out.replace(/(^|[^:"'`\\])(\/\/[^\n]*)/gm, (_, lead, c) => lead + blank(c));
}

/** Motion literals in one file. `path` decides whether it is read as CSS or as code. */
export function findMotionLiterals(path: string, source: string): MotionLiteral[] {
  const css = path.endsWith(".css");
  const text = withoutComments(source, css);
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  const lineOf = (index: number) => {
    let line = 0;
    while (line + 1 < starts.length && starts[line + 1]! <= index) line++;
    return line + 1;
  };

  const found = new Map<number, string>();
  const add = (index: number, why: string) => {
    const line = lineOf(index);
    if (!found.has(line)) found.set(line, why);
  };
  const values = (pattern: RegExp, group: number) => {
    for (const m of text.matchAll(pattern)) {
      // In a Tailwind arbitrary value, `_` stands for a space.
      const why = checkValue(m[group]!.replaceAll("_", " "));
      if (why) add(m.index! + m[0].indexOf(m[group]!), why);
    }
  };

  if (css) values(CSS_DECLARATION, 1);
  else {
    values(ARBITRARY, 1);
    values(STYLE_KEY, 2);
    if (/\banimate\(/.test(text))
      for (const m of text.matchAll(ANIMATE_OPTION))
        add(m.index!, `a hand-written ${m[1]} in an animation; use durations, easings or springs`);
  }
  text.split("\n").forEach((line, i) => {
    if (CURVE.test(line)) add(starts[i]!, "a hand-written easing curve; use the motion tokens");
    if (!css) for (const [pattern, why] of TAILWIND) if (pattern.test(line)) add(starts[i]!, why);
  });

  const lines = source.split("\n");
  return [...found]
    .sort(([a], [b]) => a - b)
    .map(([line, why]) => ({ line, text: lines[line - 1]!.trim(), why }));
}
