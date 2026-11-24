import {
  clearable,
  compact,
  itemId,
  opt,
  optionalText,
  parts,
  text,
  type ChangeDraft,
  type ChangeKind,
} from "@tukkteam/modules";
import {
  DAY_KEYS,
  DayKeySchema,
  TimeSchema,
  dayRecord,
  defineWeekModule,
  eachDay,
  looseTime,
  spanOf,
  type DayKey,
} from "@tukkteam/modules/week";
import { z } from "zod";
import { messages, type AgendaMessages } from "./messages";

export const AGENDA_LIMITS = { title: 140, note: 280, perDay: 40 } as const;

export const AgendaItemSchema = z
  .object({
    id: itemId,
    title: text(AGENDA_LIMITS.title),
    time: TimeSchema.optional(),
    endTime: TimeSchema.optional(),
    note: optionalText(AGENDA_LIMITS.note),
  })
  .strict();

export const AgendaSchema = z
  .object({ days: dayRecord(z.array(AgendaItemSchema).max(AGENDA_LIMITS.perDay)) })
  .strict();

export type AgendaItem = z.infer<typeof AgendaItemSchema>;
export type Agenda = z.infer<typeof AgendaSchema>;

/** Timed items first in time order; untimed items keep their relative order at the end. */
export function sortAgenda(items: AgendaItem[]): AgendaItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ta = a.item.time;
      const tb = b.item.time;
      if (ta && tb) return ta === tb ? a.index - b.index : ta < tb ? -1 : 1;
      if (ta) return -1;
      if (tb) return 1;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

function find(state: Agenda, id: string): { day: DayKey; index: number } | null {
  for (const day of DAY_KEYS) {
    const index = state.days[day].findIndex((item) => item.id === id);
    if (index >= 0) return { day, index };
  }
  return null;
}

const line = (kind: ChangeKind, day: DayKey, item: AgendaItem, toDay?: DayKey): ChangeDraft =>
  compact({
    kind,
    day,
    toDay,
    label: item.title,
    data: item.time ? { time: item.time } : undefined,
  });

const note = z.string().trim().max(AGENDA_LIMITS.note);
const { operation } = parts<Agenda, AgendaMessages>();

/** Agenda: the things that happen at a time, or simply have to be done, on each day. */
export const agenda = defineWeekModule<Agenda, AgendaMessages>({
  id: "agenda",
  version: 1,
  author: "PowerWeek",
  tone: "blue",
  icon: "calendar-clock",
  messages,
  schema: AgendaSchema,
  empty: () => ({ days: eachDay(() => []) }),

  operations: {
    add: operation({
      input: z.object({
        day: DayKeySchema,
        title: text(AGENDA_LIMITS.title),
        time: opt(looseTime),
        endTime: opt(looseTime),
        note: opt(note),
      }),
      examples: [{ fields: { day: "mon", title: "Yoga", time: "07:30", endTime: "08:30" } }],
      apply(state, input, ctx) {
        const list = state.days[input.day];
        if (list.length >= AGENDA_LIMITS.perDay) return "limit";
        const item: AgendaItem = compact({
          id: ctx.newId(),
          title: input.title,
          time: input.time,
          endTime: input.endTime,
          note: input.note,
        });
        list.push(item);
        ctx.change(line("add", input.day, item));
      },
    }),

    update: operation({
      input: z.object({
        id: itemId,
        day: opt(DayKeySchema),
        title: opt(text(AGENDA_LIMITS.title)),
        time: clearable(looseTime),
        endTime: clearable(looseTime),
        note: clearable(note),
      }),
      examples: [
        {
          fields: { id: "<agenda id>", title: "...", time: "19:00", day: "thu" },
          hint: 'only the fields that change; "day" moves it; null clears time, endTime or note',
        },
      ],
      apply(state, input, ctx) {
        const found = find(state, input.id);
        if (!found) return "not_found";
        const source = state.days[found.day];
        const item = { ...source[found.index]! };
        if (input.title !== undefined) item.title = input.title;
        if (input.time !== undefined) item.time = input.time ?? undefined;
        if (input.endTime !== undefined) item.endTime = input.endTime ?? undefined;
        if (input.note !== undefined) item.note = input.note ?? undefined;
        compact(item);
        const target = input.day ?? found.day;
        if (target !== found.day) {
          if (state.days[target].length >= AGENDA_LIMITS.perDay) return "limit";
          source.splice(found.index, 1);
          state.days[target].push(item);
          ctx.change(line("move", found.day, item, target));
        } else {
          source[found.index] = item;
          ctx.change(line("update", found.day, item));
        }
      },
    }),

    remove: operation({
      input: z.object({ id: itemId }),
      examples: [{ fields: { id: "<agenda id>" } }],
      apply(state, input, ctx) {
        const found = find(state, input.id);
        if (!found) return "not_found";
        const [item] = state.days[found.day].splice(found.index, 1);
        ctx.change(line("remove", found.day, item!));
      },
    }),
  },

  normalize(state) {
    for (const day of DAY_KEYS) state.days[day] = sortAgenda(state.days[day]);
  },

  describe: (change) => [change.label, change.data?.time].filter(Boolean).join(" · "),

  assistant: {
    about:
      'appointments, work, classes and plans. Per day, a list of items { id, title, time, endTime, note }; "time" and "endTime" are optional.',
    view: (state) =>
      Object.fromEntries(
        DAY_KEYS.filter((day) => state.days[day].length > 0).map((day) => [day, state.days[day]]),
      ),
  },

  week: {
    load: (state, day) => state.days[day].length,
    summary(state, day, t) {
      const count = day
        ? state.days[day].length
        : DAY_KEYS.reduce((sum, key) => sum + state.days[key].length, 0);
      return count > 0 ? t.summary(count) : null;
    },
    timeline: (state, day) => ({
      spans: state.days[day].map(spanOf).filter((span) => span !== null),
    }),
    clearDay(state, day, ctx) {
      for (const item of state.days[day]) ctx.change(line("remove", day, item));
      state.days[day] = [];
    },
    copyDay(state, from, to, ctx) {
      state.days[to] = state.days[from].map((item) => ({ ...item, id: ctx.newId() }));
      for (const item of state.days[to]) ctx.change(line("add", to, item));
    },
  },
});
