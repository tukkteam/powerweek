import { MINUTES_PER_DAY, toMinutes } from "./time";

/**
 * Time maths for a day's timeline. Everything is in minutes since midnight (0..1440) so an
 * interface can place blocks with plain percentages. Pure and clock-free: callers pass "now".
 */

/** The timeline shows at least 06:00–24:00 and widens when something starts earlier. */
export const DEFAULT_WINDOW = { start: 6 * 60, end: MINUTES_PER_DAY } as const;
/** Something with a start but no end is drawn this long. */
export const POINT_MINUTES = 30;

/** Something that takes a stretch of the day. */
export interface TimelineSpan {
  id: string;
  title: string;
  start: number;
  end: number;
  /** True when the end is a guess (no end time, or an estimate). */
  open: boolean;
  /** Draw the module's icon before the title: for a span that stands for the module that day. */
  icon?: boolean;
}

/** Something that happens at a moment of the day. */
export interface TimelineMarker {
  id: string;
  at: number;
  title: string;
  /** Still to be decided or done; drawn as an outline. */
  pending?: boolean;
}

/** A span with its row, so overlapping spans never cover each other (0-based). */
export type Laned<T> = T & { lane: number };

/** A span for an item with a start time and maybe an end time; null when it has no time. */
export function spanOf(item: {
  id: string;
  title: string;
  time?: string;
  endTime?: string;
}): TimelineSpan | null {
  if (!item.time) return null;
  const start = toMinutes(item.time);
  const end = item.endTime ? toMinutes(item.endTime) : undefined;
  // An end before the start runs past midnight: draw it to the end of the day.
  const close = end === undefined ? undefined : end > start ? end : MINUTES_PER_DAY;
  return {
    id: item.id,
    title: item.title,
    start,
    end: close ?? Math.min(MINUTES_PER_DAY, start + POINT_MINUTES),
    open: close === undefined,
  };
}

/** Give each span the first lane where it does not overlap the previous span. */
export function assignLanes<T extends { start: number; end: number }>(
  spans: readonly T[],
): Laned<T>[] {
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

/** The visible window: 06:00–24:00, widened to the hour before the earliest item. */
export function dayWindow(spans: readonly { start: number; end: number }[]): {
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

export type DayRelation = "past" | "today" | "future";
export type SpanState = "past" | "live" | "upcoming";

/** How far through a span "now" is. `now` is null for days that are not today. */
export function spanProgress(
  span: { start: number; end: number },
  now: number | null,
  dayRelation: DayRelation,
): { state: SpanState; progress: number } {
  if (dayRelation === "past") return { state: "past", progress: 1 };
  if (dayRelation === "future" || now === null) return { state: "upcoming", progress: 0 };
  if (now >= span.end) return { state: "past", progress: 1 };
  if (now < span.start) return { state: "upcoming", progress: 0 };
  return { state: "live", progress: (now - span.start) / Math.max(1, span.end - span.start) };
}
