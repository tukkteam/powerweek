import { z } from "zod";
import type { Doc } from "../doc";
import { opt } from "../fields";
import {
  createKernel,
  type Kernel,
  type KernelConfig,
  type SystemContext,
  type SystemOperationSpec,
} from "../kernel";
import type { AnyInput, ApplyContext, Json, ModuleId, ModuleMessages, ModuleSpec } from "../module";
import { DAY_KEYS, DayKeySchema, normaliseDayFields, type DayKey } from "./days";
import type { TimelineMarker, TimelineSpan } from "./timeline";

/** What a module may know about one day of the visible week when it draws itself. */
export interface DayFacts<Msg> {
  lang: string;
  t: Msg;
  /** A dated fact this module stored for that day, if any. */
  record(key: string): Json | undefined;
}

export interface Timeline {
  /** Things that take a stretch of the day. Overlapping ones are stacked in lanes. */
  spans?: TimelineSpan[];
  /** Things that happen at a moment of the day. */
  markers?: TimelineMarker[];
}

/**
 * What a module adds to a weekly planner besides its data. Every hook is optional: a module
 * that leaves one out simply takes no part in that piece of the interface.
 */
export interface WeekHooks<State, Msg> {
  /** How many things are planned on a day; drives the bar of that day. */
  load?(state: State, day: DayKey): number;
  /** A short count for a day ("3 activities"), or for the whole week when `day` is null. */
  summary?(state: State, day: DayKey | null, t: Msg): string | null;
  /** What to draw on the day's timeline. */
  timeline?(state: State, day: DayKey, facts: DayFacts<Msg>): Timeline;
  /** Empty one day, reporting everything removed. */
  clearDay?(state: State, day: DayKey, ctx: ApplyContext<Msg>): void;
  /** Copy one day onto another (already emptied), reporting everything added. */
  copyDay?(state: State, from: DayKey, to: DayKey, ctx: ApplyContext<Msg>): void;
}

export type WeekModule<State, Msg extends ModuleMessages = ModuleMessages> = ModuleSpec<
  State,
  Msg
> & { week?: WeekHooks<State, Msg> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWeekModule = WeekModule<any, any>;

/** Declares a module for a weekly planner. Returns it unchanged; the point is the type check. */
export function defineWeekModule<State, Msg extends ModuleMessages = ModuleMessages>(
  spec: WeekModule<State, Msg>,
): WeekModule<State, Msg> {
  return spec;
}

const reference = z.string().trim().min(1).max(64);

/** The modules an operation on a whole day works on: the ones named, or everything on screen. */
function chosen<M extends AnyWeekModule>(
  doc: Doc,
  names: readonly string[] | undefined,
  ctx: SystemContext<M>,
): M[] {
  if (!names) {
    return doc.layout
      .map((id) => ctx.modules.find((module) => module.id === id))
      .filter((module): module is M => module !== undefined);
  }
  const out: M[] = [];
  for (const name of names) {
    const module = ctx.find(name);
    if (module && !out.includes(module)) out.push(module);
  }
  return out;
}

/** Operations on a whole day, across every module that takes part: clear it, copy it. */
export function dayOperations<M extends AnyWeekModule>(): Record<
  string,
  SystemOperationSpec<M, AnyInput>
> {
  const clear: SystemOperationSpec<M, { day: DayKey; modules?: string[] }> = {
    input: z.object({ day: DayKeySchema, modules: opt(z.array(reference).min(1)) }),
    examples: [
      {
        fields: { day: "sun", modules: ["<module id>"] },
        hint: "empties a day; omit modules to clear every module on screen",
      },
    ],
    apply(doc, input, ctx) {
      const targets = chosen(doc, input.modules, ctx);
      if (input.modules && targets.length === 0) return "not_found";
      for (const module of targets) {
        if (!module.week?.clearDay) continue;
        const slot = ctx.open(module.id);
        if (slot) module.week.clearDay(slot.state, input.day, slot.ctx);
      }
    },
  };

  const copy: SystemOperationSpec<M, { from: DayKey; to: DayKey[]; modules?: string[] }> = {
    input: z.object({
      from: DayKeySchema,
      to: z.array(DayKeySchema).min(1).max(7),
      modules: opt(z.array(reference).min(1)),
    }),
    examples: [
      {
        fields: { from: "mon", to: ["wed", "fri"], modules: ["<module id>"] },
        hint: "copies a day onto others, replacing what they had; omit modules to copy every module on screen",
      },
    ],
    apply(doc, input, ctx) {
      const targets = chosen(doc, input.modules, ctx).filter((module) => module.week?.copyDay);
      if (input.modules && targets.length === 0) return "not_found";
      for (const to of input.to) {
        if (to === input.from) continue;
        for (const module of targets) {
          const slot = ctx.open(module.id);
          if (slot) module.week!.clearDay?.(slot.state, to, slot.ctx);
        }
        for (const module of targets) {
          const slot = ctx.open(module.id);
          if (slot) module.week!.copyDay!(slot.state, input.from, to, slot.ctx);
        }
      }
    },
  };

  return { "day.clear": clear, "day.copy": copy };
}

/** A kernel for a weekly planner: day operations included and day names forgiven. */
export function createWeekKernel<M extends AnyWeekModule>(config: KernelConfig<M>): Kernel<M> {
  return createKernel({
    ...config,
    system: { ...dayOperations<M>(), ...config.system },
    normalise: (fields) => normaliseDayFields(config.normalise ? config.normalise(fields) : fields),
  });
}

export interface DayLoad {
  count: number;
  /** 0..1 relative to the busiest day of the week. */
  ratio: number;
  /** The count split by module, in screen order, leaving out modules with nothing that day. */
  parts: { module: ModuleId; count: number }[];
}

/** How busy each day is, counting the modules on screen. A module that fails counts as zero. */
export function weekLoads<M extends AnyWeekModule>(
  kernel: Kernel<M>,
  doc: Doc,
): Record<DayKey, DayLoad> {
  const shown = kernel.onScreen(doc);
  const out = {} as Record<DayKey, DayLoad>;
  for (const day of DAY_KEYS) {
    const parts: DayLoad["parts"] = [];
    for (const module of shown) {
      if (!module.week?.load) continue;
      let count = 0;
      try {
        count = Math.max(0, Math.round(module.week.load(kernel.state(doc, module), day)) || 0);
      } catch {
        count = 0;
      }
      if (count > 0) parts.push({ module: module.id, count });
    }
    out[day] = { count: parts.reduce((sum, part) => sum + part.count, 0), ratio: 0, parts };
  }
  const max = Math.max(1, ...DAY_KEYS.map((day) => out[day].count));
  for (const day of DAY_KEYS) out[day].ratio = out[day].count / max;
  return out;
}
