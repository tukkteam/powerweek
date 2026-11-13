import { MOVE_ROWS, MOVE_SOURCE } from "./moves-data";
import { matchMoveSlug } from "./moves-match";
import type { Exercise } from "./plan";

/**
 * The move library: 302 exercises, each with three illustration frames served from
 * `apps/web/public/moves/<slug>/<frame>.svg`. Exercises in a plan point at a move with their
 * optional `move` slug (written by the assistant); when it is missing, `resolveMove` matches the
 * exercise name instead.
 */

export const MUSCLE_GROUPS = [
  "chest",
  "shoulders",
  "rear-delts",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "upper-back",
  "lats",
  "lower-back",
  "glutes",
  "quads",
  "hamstrings",
  "adductors",
  "hips",
  "calves",
  "cardio",
  "mobility",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "band",
  "kettlebell",
  "plate",
  "pull-up-bar",
  "cardio",
  "bench",
  "box",
  "wall",
  "towel",
  "doorway",
  "chair",
  "stability-ball",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

/** How an exercise is prescribed upstream: by reps, by time, or by distance. */
export type MoveType = "reps" | "time" | "distance";

/** One generated row: [slug, English name, equipment, primary, secondary, type, stretch?]. */
export type MoveRow = readonly [string, string, string, string, string, string, 1?];

export interface Move {
  slug: string;
  /** English name from the library. The UI shows the user's own exercise name instead. */
  name: string;
  equipment: Equipment;
  primary: readonly MuscleGroup[];
  secondary: readonly MuscleGroup[];
  type: MoveType;
  stretch: boolean;
}

export const MOVE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MOVE_FRAMES = [1, 2, 3] as const;
export { MOVE_SOURCE };

const groups = (value: string) =>
  value ? (value.split(" ") as MuscleGroup[]) : ([] as MuscleGroup[]);

export const MOVES: readonly Move[] = MOVE_ROWS.map(
  ([slug, name, equipment, primary, secondary, type, stretch]) => ({
    slug,
    name,
    equipment: equipment as Equipment,
    primary: groups(primary),
    secondary: groups(secondary),
    type: type as MoveType,
    stretch: stretch === 1,
  }),
);

const BY_SLUG = new Map(MOVES.map((move) => [move.slug, move]));

export function getMove(slug: string | null | undefined): Move | undefined {
  return slug ? BY_SLUG.get(slug) : undefined;
}

export function isMoveSlug(value: unknown): value is string {
  return typeof value === "string" && BY_SLUG.has(value);
}

/** The closest move for a free-text exercise name in Spanish or English, if any is close enough. */
export function matchMove(name: string): Move | undefined {
  return getMove(matchMoveSlug(name));
}

/** The move an exercise shows: its own `move` when valid, otherwise a match on its name. */
export function resolveMove(exercise: Pick<Exercise, "name" | "move">): Move | undefined {
  return getMove(exercise.move) ?? matchMove(exercise.name);
}

/** Sets assumed for an exercise without a set count, for volume and time estimates. */
export const DEFAULT_SETS = 3;

/**
 * How hard a list of exercises works each muscle group, 0..1 relative to the busiest group.
 * Primary muscles count every set, secondary muscles half a set.
 */
export function muscleLoad(
  exercises: readonly Pick<Exercise, "name" | "move" | "sets">[],
): Partial<Record<MuscleGroup, number>> {
  const load: Partial<Record<MuscleGroup, number>> = {};
  for (const exercise of exercises) {
    const move = resolveMove(exercise);
    if (!move) continue;
    const sets = exercise.sets ?? DEFAULT_SETS;
    for (const group of move.primary) load[group] = (load[group] ?? 0) + sets;
    for (const group of move.secondary) load[group] = (load[group] ?? 0) + sets / 2;
  }
  const max = Math.max(0, ...Object.values(load));
  if (max > 0) {
    for (const key of Object.keys(load) as MuscleGroup[]) load[key] = load[key]! / max;
  }
  return load;
}

/** Muscle groups sorted by load, strongest first. Cardio and mobility are not muscles. */
export function topMuscles(load: Partial<Record<MuscleGroup, number>>, limit = 3): MuscleGroup[] {
  return (Object.entries(load) as [MuscleGroup, number][])
    .filter(([group]) => group !== "cardio" && group !== "mobility")
    .sort((a, b) => b[1] - a[1] || MUSCLE_GROUPS.indexOf(a[0]) - MUSCLE_GROUPS.indexOf(b[0]))
    .slice(0, limit)
    .map(([group]) => group);
}
