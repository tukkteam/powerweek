import type { Doc, Json, ModuleMessages } from "@tukkteam/modules";
import {
  assignLanes,
  type AnyWeekModule,
  type DayKey,
  type Laned,
  type TimelineMarker,
  type TimelineSpan,
} from "@tukkteam/modules/week";
import { kernel } from "./index";

/**
 * What the screens need from the modules, gathered in one place. Screens never ask a module
 * directly: they ask here, and a module that throws simply contributes nothing, so one faulty
 * module cannot take the app down with it.
 */

export interface Shown {
  module: AnyWeekModule;
  /** The module's data; its empty data when what is stored cannot be read. */
  state: unknown;
  /** The module's strings in the person's language. */
  t: ModuleMessages;
  /** False when this version of the module cannot read what is stored. */
  readable: boolean;
}

/** The modules on screen, in order, each with its data and strings. */
export function shownModules(doc: Doc, lang: string): Shown[] {
  const broken = kernel.unreadable(doc);
  return kernel.onScreen(doc).map((module) => ({
    module: module as AnyWeekModule,
    state: kernel.state(doc, module),
    t: kernel.messages(module, lang),
    readable: !broken.has(module.id),
  }));
}

/** Modules this build knows that are not on screen, in gallery order. */
export function hiddenModules(doc: Doc, lang: string): Shown[] {
  const broken = kernel.unreadable(doc);
  return kernel.modules
    .filter((module) => !doc.layout.includes(module.id))
    .map((module) => ({
      module: module as AnyWeekModule,
      state: kernel.state(doc, module),
      t: kernel.messages(module, lang),
      readable: !broken.has(module.id),
    }));
}

function attempt<T>(run: () => T, fallback: T): T {
  try {
    return run();
  } catch {
    return fallback;
  }
}

/** How many things a module plans on a day; zero when it does not count or fails. */
export function loadOf(shown: Shown, day: DayKey): number {
  if (!shown.readable) return 0;
  return attempt(() => Math.max(0, shown.module.week?.load?.(shown.state, day) ?? 0), 0);
}

export interface Summary {
  id: string;
  tone: string;
  text: string;
}

/** One short count per module for a day, or for the whole week when `day` is null. */
export function summaries(shown: readonly Shown[], day: DayKey | null): Summary[] {
  return shown.flatMap((entry) => {
    if (!entry.readable) return [];
    const text = attempt(
      () => entry.module.week?.summary?.(entry.state, day, entry.t) ?? null,
      null,
    );
    return text ? [{ id: entry.module.id, tone: entry.module.tone, text }] : [];
  });
}

interface Owner {
  module: string;
  tone: string;
  /** Name of the module's icon. */
  glyph: string;
  /** Row on the timeline, counting from the top. */
  row: number;
}

export interface DayTimeline {
  /** Things with a duration, each on its row: modules stack in screen order. */
  spans: (Laned<TimelineSpan> & Owner)[];
  spanRows: number;
  /** Things at a moment, one row per module that has any, below the spans. */
  markers: (TimelineMarker & Owner)[];
  markerRows: number;
}

/** Everything the modules on screen place on one day's timeline. */
export function dayTimeline(
  shown: readonly Shown[],
  day: DayKey,
  lang: string,
  record: (module: string, key: string) => Json | undefined,
): DayTimeline {
  const out: DayTimeline = { spans: [], spanRows: 0, markers: [], markerRows: 0 };
  for (const entry of shown) {
    const { module } = entry;
    if (!entry.readable || !module.week?.timeline) continue;
    const timeline = attempt(
      () =>
        module.week!.timeline!(entry.state, day, {
          lang,
          t: entry.t,
          record: (key) => record(module.id, key),
        }),
      {},
    );
    const owner = { module: module.id, tone: module.tone, glyph: module.icon };
    const spans = assignLanes((timeline.spans ?? []).filter((span) => span.end > span.start));
    if (spans.length > 0) {
      for (const span of spans)
        out.spans.push({ ...span, ...owner, row: out.spanRows + span.lane });
      out.spanRows += Math.max(...spans.map((span) => span.lane)) + 1;
    }
    const markers = timeline.markers ?? [];
    if (markers.length > 0) {
      for (const marker of markers) out.markers.push({ ...marker, ...owner, row: out.markerRows });
      out.markerRows += 1;
    }
  }
  return out;
}
