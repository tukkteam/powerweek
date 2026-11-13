import { DEFAULT_SETS, resolveMove } from "./moves";
import type { AgendaItem, Day, MealSlot, Workout } from "./plan";

/**
 * Time maths for the day timeline. Everything is in minutes since midnight (0..1440) so the UI
 * can place blocks with plain percentages. Pure and clock-free: callers pass "now".
 */

export const MINUTES_PER_DAY = 1440;
/** The timeline shows at least 06:00–24:00 and widens when the plan starts earlier. */
export const DEFAULT_WINDOW = { start: 6 * 60, end: MINUTES_PER_DAY } as const;
/** An agenda item with a start but no end is drawn this long. */
export const POINT_MINUTES = 30;

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function fromMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(minutes)));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

export type SpanKind = "agenda" | "train";

export interface Span {
  id: string;
  kind: SpanKind;
  title: string;
  start: number;
  end: number;
  /** True when the end is a guess (no end time, or an estimated workout). */
  open: boolean;
  /** Row on the timeline so overlapping spans never cover each other (0-based). */
  lane: number;
}

/** Estimated session length: ~2.5 minutes per set plus a warm-up, between 20 and 120 minutes. */
export function workoutMinutes(workout: Pick<Workout, "exercises">): number {
  let minutes = 10;
  for (const exercise of workout.exercises) {
    const timed = durationMinutes(exercise.reps);
    const sets = exercise.sets ?? (timed ? 1 : DEFAULT_SETS);
    const stretch = resolveMove(exercise)?.stretch ?? false;
    minutes += timed ? timed * sets + (sets - 1) : sets * (stretch ? 1 : 2.5);
  }
  return Math.min(120, Math.max(20, Math.round(minutes / 5) * 5));
}

/** "30 min", "45 s", "1 h", "20'" → minutes; undefined for rep counts like "8-10". */
export function durationMinutes(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m =
    /^\s*(\d+(?:[.,]\d+)?)\s*(?:-\s*\d+(?:[.,]\d+)?\s*)?(h|hr|hrs|hora|horas|min|mins|minutos?|'|s|sec|secs|seg|segundos?|")\s*$/i.exec(
      text,
    );
  if (!m) return undefined;
  const value = Number(m[1]!.replace(",", "."));
  const unit = m[2]!.toLowerCase();
  if (unit.startsWith("h")) return value * 60;
  if (unit === "s" || unit === '"' || unit.startsWith("se")) return value / 60;
  return value;
}

/** Give each span the first lane where it does not overlap the previous span. */
function assignLanes(spans: Omit<Span, "lane">[]): Span[] {
  const laneEnds: number[] = [];
  return [...spans]
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .map((span) => {
      let lane = laneEnds.findIndex((end) => end <= span.start);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = span.end;
      return { ...span, lane };
    });
}

function agendaSpan(item: AgendaItem): Omit<Span, "lane"> | null {
  if (!item.time) return null;
  const start = toMinutes(item.time);
  const end = item.endTime ? toMinutes(item.endTime) : undefined;
  // An end before the start runs past midnight: draw it to the end of the day.
  const close = end === undefined ? undefined : end > start ? end : MINUTES_PER_DAY;
  return {
    id: item.id,
    kind: "agenda",
    title: item.title,
    start,
    end: close ?? Math.min(MINUTES_PER_DAY, start + POINT_MINUTES),
    open: close === undefined,
  };
}

/** Timed agenda items in lanes, plus the workout when it has a start time (always its own lane). */
export function daySpans(day: Day): { agenda: Span[]; train: Span | null; lanes: number } {
  const agenda = assignLanes(
    day.agenda.map(agendaSpan).filter((s): s is Omit<Span, "lane"> => s !== null),
  );
  const lanes = agenda.reduce((max, span) => Math.max(max, span.lane + 1), 0);
  let train: Span | null = null;
  if (day.workout?.time) {
    const start = toMinutes(day.workout.time);
    train = {
      id: "workout",
      kind: "train",
      title: day.workout.title,
      start,
      end: Math.min(MINUTES_PER_DAY, start + workoutMinutes(day.workout)),
      open: true,
      lane: 0,
    };
  }
  return { agenda, train, lanes };
}

/** The visible window: 06:00–24:00, widened to the hour before the earliest item. */
export function dayWindow(spans: readonly Pick<Span, "start" | "end">[]): {
  start: number;
  end: number;
} {
  const earliest = Math.min(DEFAULT_WINDOW.start, ...spans.map((s) => s.start));
  return { start: Math.floor(earliest / 60) * 60, end: DEFAULT_WINDOW.end };
}

/** Where a time falls in a window, 0..1. */
export function position(minutes: number, window: { start: number; end: number }): number {
  const width = window.end - window.start;
  return width <= 0 ? 0 : Math.max(0, Math.min(1, (minutes - window.start) / width));
}

export type SpanState = "past" | "live" | "upcoming";

/** How far through a span "now" is. `now` is null for days that are not today. */
export function spanProgress(
  span: Pick<Span, "start" | "end">,
  now: number | null,
  dayRelation: "past" | "today" | "future",
): { state: SpanState; progress: number } {
  if (dayRelation === "past") return { state: "past", progress: 1 };
  if (dayRelation === "future" || now === null) return { state: "upcoming", progress: 0 };
  if (now >= span.end) return { state: "past", progress: 1 };
  if (now < span.start) return { state: "upcoming", progress: 0 };
  return { state: "live", progress: (now - span.start) / Math.max(1, span.end - span.start) };
}

/** When each meal is usually eaten, for placing meals on the timeline. */
export type MealTimes = Readonly<Record<MealSlot, number>>;

export const MEAL_TIMES = {
  /** Spanish timetable: late lunch and dinner. */
  es: { breakfast: 8 * 60 + 30, lunch: 14 * 60, snack: 17 * 60 + 30, dinner: 21 * 60 },
  en: { breakfast: 7 * 60 + 30, lunch: 12 * 60 + 30, snack: 16 * 60, dinner: 19 * 60 },
} as const satisfies Record<string, MealTimes>;

/** The slot whose time is closest ahead of "now" (or the last one late in the day). */
export function currentMealSlot(now: number, times: MealTimes): MealSlot {
  const order: MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];
  for (let i = 0; i < order.length; i += 1) {
    const slot = order[i]!;
    const next = order[i + 1];
    const boundary = next ? (times[slot] + times[next]) / 2 : MINUTES_PER_DAY;
    if (now < boundary) return slot;
  }
  return "dinner";
}
