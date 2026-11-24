import { optionalText, parts } from "@tukkteam/modules";
import { DAY_KEYS, DayKeySchema, dayRecord, defineWeekModule } from "@tukkteam/modules/week";
import { z } from "zod";
import { messages, type NotesMessages } from "./messages";

export const NOTE_LIMIT = 500;

/** One optional free text per day. */
export const NotesSchema = z.object({ days: dayRecord(optionalText(NOTE_LIMIT)) }).strict();
export type Notes = z.infer<typeof NotesSchema>;

const { operation } = parts<Notes, NotesMessages>();

/**
 * Notes: the smallest useful module. One piece of data, one operation, no dated facts. A good
 * place to start reading if you want to write a module.
 */
export const notes = defineWeekModule<Notes, NotesMessages>({
  id: "notes",
  version: 1,
  author: "PowerWeek",
  tone: "sand",
  icon: "sticky-note",
  messages,
  schema: NotesSchema,
  empty: () => ({ days: {} }),

  operations: {
    set: operation({
      input: z.object({
        day: DayKeySchema,
        note: z.string().trim().max(NOTE_LIMIT).nullable(),
      }),
      examples: [{ fields: { day: "sat", note: "Rest day" }, hint: "note null removes it" }],
      apply(state, input, ctx) {
        const before = state.days[input.day];
        if (input.note) state.days[input.day] = input.note;
        else delete state.days[input.day];
        if (before === state.days[input.day]) return "noop";
        ctx.change({
          kind: input.note ? (before ? "update" : "add") : "remove",
          day: input.day,
          label: input.note ?? before ?? "",
        });
      },
    }),
  },

  describe: (change, t) => `${t.label}: ${change.label}`,

  assistant: {
    about: 'free text. Per day, one optional note: { "sat": "Rest day" }.',
    view: (state) => state.days,
  },

  week: {
    summary(state, day, t) {
      if (day) return null;
      const count = DAY_KEYS.filter((key) => state.days[key]).length;
      return count > 0 ? t.summary(count) : null;
    },
  },
});
