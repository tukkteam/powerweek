/**
 * The exercises the mannequin knows, by the slug of the move (see moves-data.ts). They are laid
 * out by family in ./library; `pnpm figure <slug>` draws one to look at, and /es/dev/figure
 * shows them all moving.
 */
import type { Exercise } from "./exercise";
import barbell from "./library/barbell";
import dumbbellUpper from "./library/dumbbell-upper";
import dumbbellLower from "./library/dumbbell-lower";
import machine from "./library/machine";
import cable from "./library/cable";
import band from "./library/band";
import press from "./library/press";
import hang from "./library/hang";
import core from "./library/core";
import legs from "./library/legs";
import more from "./library/more";

export { poseAt, viewOf, type Exercise } from "./exercise";

/** Every family, by the name of its file. */
export const FAMILIES = {
  barbell,
  "dumbbell-upper": dumbbellUpper,
  "dumbbell-lower": dumbbellLower,
  machine,
  cable,
  band,
  press,
  hang,
  core,
  legs,
  more,
} as const;

export const EXERCISES: Readonly<Record<string, Exercise>> = Object.assign(
  {},
  ...Object.values(FAMILIES),
);

/** Whether the mannequin knows this move. */
export const hasFigure = (slug: string | undefined): slug is string =>
  Boolean(slug && EXERCISES[slug]);
