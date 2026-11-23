import { z } from "zod";
import { clearable, compact, itemId, opt, parts, text, type ModuleMessages } from "../src";
import {
  DAY_KEYS,
  DayKeySchema,
  dayRecord,
  defineWeekModule,
  eachDay,
  looseTime,
  spanOf,
  TimeSchema,
} from "../src/week";

/** A small list module used to test the kernel: things to do per day, with an optional time. */
const TaskSchema = z.object({ id: itemId, title: text(80), time: TimeSchema.optional() }).strict();
export const TasksSchema = z.object({ days: dayRecord(z.array(TaskSchema).max(3)) }).strict();
export type Tasks = z.infer<typeof TasksSchema>;

interface TaskMessages extends ModuleMessages {
  untitled: string;
  count: (n: number) => string;
}

const { operation, record } = parts<Tasks, TaskMessages>();

const find = (state: Tasks, id: string) => {
  for (const day of DAY_KEYS) {
    const index = state.days[day].findIndex((task) => task.id === id);
    if (index >= 0) return { day, index };
  }
  return null;
};

export const tasks = defineWeekModule<Tasks, TaskMessages>({
  id: "tasks",
  version: 1,
  tone: "blue",
  icon: "list",
  messages: {
    es: {
      name: "Tareas",
      description: "Cosas por hacer cada día.",
      untitled: "Tarea",
      count: (n) => `${n} tareas`,
    },
    en: {
      name: "Tasks",
      description: "Things to do each day.",
      untitled: "Task",
      count: (n) => `${n} tasks`,
    },
  },
  schema: TasksSchema,
  empty: () => ({ days: eachDay(() => []) }),
  operations: {
    add: operation({
      input: z.object({ day: DayKeySchema, title: opt(text(80)), time: opt(looseTime) }),
      examples: [{ fields: { day: "mon", title: "Call mum", time: "18:00" } }],
      apply(state, input, ctx) {
        const list = state.days[input.day];
        if (list.length >= 3) return "limit";
        const task = compact({
          id: ctx.newId(),
          title: input.title ?? ctx.t.untitled,
          time: input.time,
        });
        list.push(task);
        ctx.change(
          compact({
            kind: "add" as const,
            day: input.day,
            label: task.title,
            data: task.time ? { time: task.time } : undefined,
          }),
        );
      },
    }),
    update: operation({
      input: z.object({
        id: itemId,
        title: opt(text(80)),
        time: clearable(looseTime),
        day: opt(DayKeySchema),
      }),
      examples: [
        { fields: { id: "<task id>", time: "19:00" }, hint: "only the fields that change" },
      ],
      apply(state, input, ctx) {
        const found = find(state, input.id);
        if (!found) return "not_found";
        const task = { ...state.days[found.day][found.index]! };
        if (input.title !== undefined) task.title = input.title;
        if (input.time !== undefined) task.time = input.time ?? undefined;
        compact(task);
        const target = input.day ?? found.day;
        state.days[found.day].splice(found.index, 1);
        state.days[target].push(task);
        ctx.change(
          target === found.day
            ? { kind: "update", day: found.day, label: task.title }
            : { kind: "move", day: found.day, toDay: target, label: task.title },
        );
      },
    }),
    remove: operation({
      input: z.object({ id: itemId }),
      examples: [{ fields: { id: "<task id>" } }],
      apply(state, input, ctx) {
        const found = find(state, input.id);
        if (!found) return "not_found";
        const [task] = state.days[found.day].splice(found.index, 1);
        ctx.change({ kind: "remove", day: found.day, label: task!.title });
      },
    }),
  },
  records: {
    done: record({
      input: z.object({
        day: DayKeySchema,
        task: z.string().min(1),
        done: z.boolean().default(true),
      }),
      examples: [{ fields: { day: "mon", task: "<task id or title>" } }],
      resolve(state, input, ctx) {
        const task = state.days[input.day].find(
          (item) => item.id === input.task || item.title.toLowerCase() === input.task.toLowerCase(),
        );
        if (!task) return "not_found";
        if (Boolean(ctx.get(input.day, task.id)) === input.done) return "noop";
        ctx.write(
          { day: input.day, key: task.id, value: input.done ? true : null },
          { kind: "update", day: input.day, label: task.title },
        );
      },
    }),
  },
  normalize(state) {
    for (const day of DAY_KEYS)
      state.days[day].sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  },
  describe: (change) => [change.label, change.data?.time].filter(Boolean).join(" · "),
  assistant: {
    about: "tasks: per day, a list of { id, title, time }.",
    rules: ["A task title is short."],
    reference: () => "Task reference text",
    view: (state) =>
      Object.fromEntries(
        DAY_KEYS.filter((day) => state.days[day].length).map((day) => [day, state.days[day]]),
      ),
  },
  week: {
    load: (state, day) => state.days[day].length,
    summary: (state, day, t) => {
      const n = day
        ? state.days[day].length
        : DAY_KEYS.reduce((sum, d) => sum + state.days[d].length, 0);
      return n ? t.count(n) : null;
    },
    timeline: (state, day) => ({
      spans: state.days[day].map(spanOf).filter((span) => span !== null),
    }),
    clearDay(state, day, ctx) {
      for (const task of state.days[day]) ctx.change({ kind: "remove", day, label: task.title });
      state.days[day] = [];
    },
    copyDay(state, from, to, ctx) {
      state.days[to] = state.days[from].map((task) => ({ ...task, id: ctx.newId() }));
      for (const task of state.days[to]) ctx.change({ kind: "add", day: to, label: task.title });
    },
  },
});

/** A second, tiny module: one free note for the week. */
const NoteSchema = z.object({ text: z.string().max(200).optional() }).strict();
type Note = z.infer<typeof NoteSchema>;
const noteParts = parts<Note>();
export const note = defineWeekModule<Note>({
  id: "note",
  version: 2,
  tone: "sand",
  icon: "sticky-note",
  messages: {
    es: { name: "Nota", description: "Una nota para la semana." },
    en: { name: "Note", description: "One note for the week." },
  },
  schema: NoteSchema,
  empty: () => ({}),
  migrate: (data, from) => (from === 1 ? { text: (data as { body?: string }).body } : data),
  operations: {
    set: noteParts.operation({
      input: z.object({ text: z.string().trim().max(200).nullable() }),
      examples: [{ fields: { text: "Buy flowers" } }],
      apply(state, input, ctx) {
        const before = state.text;
        if (input.text) state.text = input.text;
        else delete state.text;
        if (before === state.text) return "noop";
        ctx.change({
          kind: input.text ? (before ? "update" : "add") : "remove",
          scope: "week",
          label: input.text ?? before ?? "",
        });
      },
    }),
  },
  describe: (change) => change.label,
  assistant: { about: "note: { text }, one free note for the whole week." },
});

/** The same module with deliberately broken operations, to test what the kernel does with them. */
export const faulty = defineWeekModule<Tasks, TaskMessages>({
  ...tasks,
  operations: {
    ...tasks.operations,
    corrupt: operation({
      input: z.object({ day: DayKeySchema }),
      examples: [],
      apply(state, input, ctx) {
        (state.days[input.day] as unknown[]).push({ id: "bad", title: "" });
        ctx.change({ kind: "add", day: input.day, label: "bad" });
      },
    }),
    explode: operation({
      input: z.object({}),
      examples: [],
      apply(state) {
        state.days.mon.push({ id: "half", title: "Half done" });
        throw new Error("boom");
      },
    }),
    silent: operation({
      input: z.object({}),
      examples: [],
      apply(state) {
        state.days.mon.push({ id: "quiet", title: "No receipt" });
      },
    }),
  },
});
