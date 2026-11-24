import type { KernelConfig } from "@tukkteam/modules";
import { createWeekKernel, type AnyWeekModule } from "@tukkteam/modules/week";
import { locales } from "@/lib/i18n/config";
import { agenda } from "./agenda/module";
import { fuel } from "./fuel/module";
import { habits } from "./habits/module";
import { upgradeV1 } from "./legacy/plan-v1";
import { notes } from "./notes/module";
import { train } from "./train/module";

/**
 * Every module this build ships, in the order the assistant reads about them and the gallery
 * lists them. To add a module, write its folder and add it here and in `views.tsx`.
 */
export const MODULES = [agenda, fuel, train, notes, habits] as const;
export type AppModule = (typeof MODULES)[number];

/** Operation names from before modules, so old habits and old clients keep working. */
const ALIASES: Record<string, string> = {
  "workout.set": "train.workout.set",
  "workout.update": "train.workout.update",
  "workout.clear": "train.workout.clear",
  "exercise.add": "train.exercise.add",
  "exercise.update": "train.exercise.update",
  "exercise.remove": "train.exercise.remove",
  "meal.set": "fuel.meal.set",
  "meal.update": "fuel.meal.update",
  "meal.remove": "fuel.meal.remove",
  "menu.set": "fuel.menu.set",
  "menu.clear": "fuel.menu.clear",
  "meal.options": "fuel.options.set",
  "meal.pick": "fuel.pick",
  "day.note": "notes.set",
};

/** Whole-day operations used to name "categories"; they name modules now. */
function normalise(fields: Record<string, unknown>, op: string): Record<string, unknown> {
  if (!op.startsWith("day.") || !("categories" in fields) || "modules" in fields) return fields;
  const { categories, ...rest } = fields;
  return { ...rest, modules: categories };
}

/** At most this many operations in one assistant answer. */
export const MAX_OPERATIONS = 60;

/**
 * The kernel as PowerWeek sets it up, for any list of modules. A module's tests pass it to
 * `checkModule`, so the module is checked the way the app will read it.
 */
export const createAppKernel = <M extends AnyWeekModule>(config: KernelConfig<M>) =>
  createWeekKernel<M>({
    ...config,
    aliases: ALIASES,
    normalise,
    maxOperations: MAX_OPERATIONS,
  });

export const kernel = createAppKernel<AppModule>({
  modules: MODULES,
  locales,
  upgrade: upgradeV1,
});

export { agenda, fuel, habits, notes, train };
