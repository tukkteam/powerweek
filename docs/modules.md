# Modules

PowerWeek is a screen of modules. Agenda, Training, Meals and Notes are modules; so is whatever comes next. A person decides which ones are on their screen and in what order, by hand or by voice, and a module they take off the screen keeps its data for when it comes back.

This page is the module contract (version 1) and a guide to writing a module. The contract and the kernel that enforces it live in [`packages/modules`](../packages/modules) (`@tukkteam/modules`), which knows nothing about PowerWeek. The modules themselves live in [`apps/web/modules`](../apps/web/modules), one folder each.

## What a module is

A module owns one part of a person's week. It declares:

| Part                   | What it is                                                                                         | Where         |
| ---------------------- | -------------------------------------------------------------------------------------------------- | ------------- |
| **Data**               | A strict zod schema and the data of someone who has not used the module yet                        | `module.ts`   |
| **Operations**         | The only way its data changes: named, typed, each with an example                                  | `module.ts`   |
| **Records** (optional) | Operations that note what happened on a date (a tick, a choice, a count) without changing the plan | `module.ts`   |
| **Assistant**          | A few sentences about its data, its rules, and what the model sees of it                           | `module.ts`   |
| **Week hooks**         | How busy a day is, a short count, what goes on the day's timeline, how to clear and copy a day     | `module.ts`   |
| **Strings**            | Its name, its description and every word it shows, in Spanish and English                          | `messages.ts` |
| **Views**              | Its card on Today, its box and its detail on the week board                                        | `views.tsx`   |
| **Look**               | One tone and one icon, by name                                                                     | `module.ts`   |

## What the kernel does with it

You write the parts above. The kernel does the rest, the same way for every module:

- **Voice.** The assistant prompt is composed from every module's description, operations and rules. A model answers with operations; nothing else can change data. Write an operation with an example and it can be spoken.
- **Receipts and undo.** Every operation reports what it changed. The app shows those lines in the Change Receipt and saves the plan as a new version, so one tap undoes it.
- **Validation at every step.** Operations are validated one by one, so a bad one never discards the good ones. An operation that fails, throws or reports nothing is undone and listed as rejected. After the last operation the module's own schema checks the result: data the module would not accept is never saved.
- **The screen.** Which modules are on screen and in what order is part of the plan (`layout`), changed by operations like any other data: `layout.add`, `layout.remove`, `layout.move`, `layout.set`. Using an operation of a module that is off screen puts it on screen.
- **Isolation.** Modules never see each other. A module whose stored data this version cannot read is set aside: it shows a notice, its operations are refused and its data is left untouched. A card that throws while drawing shows a notice in its place. In both cases the rest of the screen keeps working.
- **Sync and storage.** The plan is one JSON document per person, saved with optimistic concurrency and mirrored to other devices. The database checks the envelope, not what modules store, so a new module needs no migration.

## The contract (version 1)

1. **A module never imports another module.** What modules share goes through the kernel or the host.
2. **Data changes only through operations.** `apply` changes the data it is given in place and reports every change with `ctx.change`. A change with no line in the receipt is refused.
3. **Operation fields forgive shape and are strict about meaning.** A model writes them: accept `"8:00"`, `"4"`, `null` for "not given"; reject a day that does not exist. Parsing must be idempotent: parsing its own output changes nothing.
4. **Data is JSON and stays small.** A whole plan is limited to 512 KB.
5. **Leaving the screen deletes nothing.** Do not clean up when your module is removed from `layout`.
6. **A new data shape is a new `version`** with a `migrate` that brings old data forward.
7. **Every language has the same strings.** `name` and `description` are required.
8. **Views take everything from props** and use no colour names: the host sets the module's tone and classes such as `text-tone` and `bg-tone/15` pick it up.
9. **What happened on a date is a record**, not plan data. The plan says what a week looks like; records say what a date was like.
10. **Everything works without the assistant.** Whatever can be said can be done by hand with the same operations.

`checkModule` from `@tukkteam/modules/testing` runs a module the way the kernel will and returns every breach it finds as a sentence. Every module in this repository passes it in CI:

```ts
it.each(MODULES.map((module) => [module.id, module] as const))("%s", (_id, module) => {
  expect(checkModule(module, { locales })).toEqual([]);
});
```

## A whole module: Notes

Notes is the smallest useful module: one piece of data, one operation, no records. Read [`apps/web/modules/notes`](../apps/web/modules/notes) next to this section.

**Data.** One optional text per day.

```ts
export const NotesSchema = z.object({ days: dayRecord(optionalText(NOTE_LIMIT)) }).strict();
export type Notes = z.infer<typeof NotesSchema>;
```

**The module.** `defineWeekModule` only checks types; the object is the module.

```ts
const { operation } = parts<Notes, NotesMessages>();

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
});
```

That is enough for this to work, with a receipt and undo:

> "apunta el sábado: día de descanso"

The model reads `notes: free text…` and the line `{"op":"notes.set","day":"sat","note":"Rest day"}   note null removes it`, and answers with `{"op":"notes.set","day":"sat","note":"Día de descanso"}`. The module was off screen, so the receipt has two lines: Notes is now on screen, and Saturday has a note.

**Strings** are a typed object per language ([`messages.ts`](../apps/web/modules/notes/messages.ts)); functions are fine for plurals.

**Views** are React components that receive the data and send operations ([`views.tsx`](../apps/web/modules/notes/views.tsx)):

```tsx
function NotesCard({ data, t, day, dispatch }: CardProps<Notes, NotesMessages>) {
  const note = data.days[day];
  // …draw the note; to save: dispatch([{ op: "notes.set", day, note: "…" }])
}

export const views: ModuleViews<Notes, NotesMessages> = {
  Card: NotesCard,
  WeekCell: NotesCell,
  weekWeight: 2,
  hasDay: (data, day) => Boolean(data.days[day]),
  Peek: NotesPeek,
};
```

**Registering it** is two lines: add the module to `MODULES` in [`apps/web/modules/index.ts`](../apps/web/modules/index.ts) and its views to `VIEWS` in [`apps/web/modules/views.tsx`](../apps/web/modules/views.tsx).

## Operations

```ts
add: operation({
  input: z.object({ day: DayKeySchema, title: text(140), time: opt(looseTime) }),
  examples: [{ fields: { day: "mon", title: "Yoga", time: "07:30" }, hint: "…" }],
  apply(state, input, ctx) {
    if (state.days[input.day].length >= 40) return "limit";
    const item = compact({ id: ctx.newId(), title: input.title, time: input.time });
    state.days[input.day].push(item);
    ctx.change({ kind: "add", day: input.day, label: item.title });
  },
}),
```

- **Names.** The full name is `<module id>.<name>`: `agenda.add`, `train.exercise.add`.
- **Fields.** `@tukkteam/modules` has the building blocks: `text`, `opt` (null and "" mean "not given"), `clearable` (leave out to keep, null to clear), `looseInt`, `looseNumber`, `itemId`. `@tukkteam/modules/week` has `DayKeySchema` and `looseTime` (`"8"`, `"8h"`, `"8.30"` → `"08:00"`, `"08:30"`).
- **Examples** become lines of the assistant prompt, so they are documentation the model reads. Use placeholders such as `"<agenda id>"` for ids.
- **Rejecting.** Return `"not_found"`, `"limit"` or `"noop"` and the kernel puts the data back as it was. You do not need to undo anything yourself.
- **Reporting.** `ctx.change({ kind, day, label, data })`: `label` is what the person wrote, `data` holds the facts `describe` needs (a time, a slot, a count). `describe(change, t)` turns a change into one line in the person's language; the host adds where a moved item went.
- **Ids and defaults.** `ctx.newId()` gives a short id; `ctx.t` is your strings in the person's language, for default titles.
- **After the operations.** `normalize(state)` runs once: keep lists sorted, drop empty containers.

## Records

A record is a fact about a calendar date: this item was done, this option was chosen, three glasses so far. Records live outside the plan (table `entries`: date, module, key, value), so they have no versions and no undo.

Views read and write them directly, for the week on screen:

```tsx
const done = Boolean(records.get(day, item.id));
<button onClick={() => records.set(day, item.id, done ? null : true)} />;
```

To let the assistant write them, declare a record operation. It resolves what was said into writes; the kernel never lets it touch the plan:

```ts
records: {
  pick: record({
    input: z.object({ day: DayKeySchema, slot: MealSlotSchema, option: z.string().nullable() }),
    examples: [{ fields: { day: "fri", slot: "lunch", option: "Chicken stir-fry" } }],
    resolve(state, input, ctx) {
      const option = findOption(state, input);
      if (!option) return "not_found";
      ctx.write(
        { day: input.day, key: `pick:${input.slot}`, value: option.id },
        { kind: "update", day: input.day, label: option.title },
      );
    },
  }),
},
```

`ctx.get(day, key)` returns what is stored, including what an earlier operation in the same request wrote, which is what "one more glass" needs.

## Week hooks

All optional. A module that leaves one out takes no part in that piece of the interface.

| Hook                             | Feeds                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `load(state, day)`               | The Week Pulse and the stacked week bars: how many things are planned that day |
| `summary(state, day \| null, t)` | The short counts under the day and the week titles ("3 activities")            |
| `timeline(state, day, facts)`    | The Day Bar: `spans` for things that last, `markers` for things at a moment    |
| `clearDay(state, day, ctx)`      | `day.clear`: empty one day, reporting what was removed                         |
| `copyDay(state, from, to, ctx)`  | `day.copy`: copy one day onto another, with new ids                            |

`facts` gives the timeline your strings, the language and `record(key)` for that day, so a marker can show what was chosen.

## Views

Views live in the app, so they can use its components. They receive everything through props ([`host.ts`](../apps/web/modules/host.ts)):

| Prop                       | What it is                                                               |
| -------------------------- | ------------------------------------------------------------------------ |
| `data`, `t`, `lang`, `day` | Your data, your strings, the language, the day on screen                 |
| `records`                  | The dated facts of your module for the visible week                      |
| `relation`, `now`          | Whether the day is past, today or ahead, and the minute of the day       |
| `dispatch(operations)`     | Send operations; resolves `true` once saved. The receipt is not your job |
| `focus`                    | What was tapped on the day's timeline; read it with `useTapped`          |

Helpers you can use: `ModuleCard` and `CellHeader` (the shared chrome), `EditorDialog` with `Field` (a form that sends one operation), `ModuleIcon`, and `useTapped`.

Colour: write `text-tone`, `bg-tone`, `bg-tone/15`, `border-tone/40`. Never a colour name. The tone is one of `blue`, `volt`, `orange`, `sand`, `violet`, `rose`, `teal`; each is a pair of colours (Night and Day) in [`tokens.json`](../packages/design-tokens/tokens.json), checked on every build for contrast and for staying apart from the other tones with colour blindness. Colour is never the only cue: your module also has an icon and a name.

The house style: prefer a bar to a number, and a number to a sentence.

## Checklist for a pull request

- [ ] A folder `apps/web/modules/<id>` with `module.ts`, `messages.ts`, `views.tsx` and a test file.
- [ ] `checkModule` passes (it does once the module is in `MODULES`).
- [ ] Tests for what your operations do, including what they reject.
- [ ] Every operation has an example the model can copy.
- [ ] Strings in `es` and `en`.
- [ ] Looked at in a browser, in both themes, on a phone width.
- [ ] No import from another module's folder.

## What is not there yet

Said plainly, so nobody builds on something that does not exist:

- **Modules ship with the app.** A new module arrives through a pull request to this repository and is reviewed like any other code. There is no way to install one at run time.
- **No marketplace and no sandbox.** Module code runs with the same trust as the app, which is why it is reviewed. Both are described as proposals in [ADR 0012](adr/0012-modules-ship-with-the-app.md).
- **The contract is version 1 and young.** Three modules were ported to it and one was written for it. It will change as more are written; `CONTRACT_VERSION` in `packages/modules` says which one a module was written for.
