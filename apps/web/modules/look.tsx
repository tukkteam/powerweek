import {
  BookOpen,
  Box,
  CalendarClock,
  ChartColumn,
  Droplets,
  Dumbbell,
  ListChecks,
  Moon,
  Repeat,
  StickyNote,
  Target,
  TriangleAlert,
  Utensils,
  Wallet,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { createElement, type CSSProperties } from "react";

/**
 * How a module looks from the outside: one colour and one icon, both named in its definition.
 * Inside a module's own views there are no colour names at all, only "tone": the element that
 * wraps the module sets the `--tone` variable and classes like `text-tone` or `bg-tone/15` pick
 * it up. That is what lets a person (or a new module) change colour without touching a view.
 */

/** Tone names a module can ask for; each is a pair of colours (Night, Day) in the tokens. */
export const TONES = [
  "blue",
  "volt",
  "orange",
  "sand",
  "violet",
  "rose",
  "teal",
  "yellow",
  "sky",
] as const;
export type Tone = (typeof TONES)[number];

/** The inline style that gives an element, and everything inside it, a module's colour. */
export function toneStyle(tone: string): CSSProperties {
  const name = (TONES as readonly string[]).includes(tone) ? tone : "volt";
  return { "--tone": `var(--tone-${name})` } as CSSProperties;
}

/** Icons a module can ask for by name. Add to this list when a module needs a new one. */
const ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  "calendar-clock": CalendarClock,
  "chart-column": ChartColumn,
  droplets: Droplets,
  dumbbell: Dumbbell,
  "list-checks": ListChecks,
  moon: Moon,
  repeat: Repeat,
  "sticky-note": StickyNote,
  target: Target,
  "triangle-alert": TriangleAlert,
  utensils: Utensils,
  wallet: Wallet,
};

/** A module's icon by name; a plain box when the name is not in the list. */
export function ModuleIcon({ name, ...props }: { name: string } & LucideProps) {
  return createElement(ICONS[name] ?? Box, { "aria-hidden": true, ...props });
}
