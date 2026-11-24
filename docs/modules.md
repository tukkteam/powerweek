# Modules

PowerWeek is a screen of modules. Agenda, Training, Meals, Notes and Habits are modules; so is whatever comes next. A person decides which ones are on their screen and in what order, by hand or by voice, and a module they take off the screen keeps its data for when it comes back.

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
| **Strings**            | Its name, its description, something to say to it and every word it shows, in Spanish and English  | `messages.ts` |
| **Views**              | Its card on Today, its box and its detail on the week board                                        | `views.tsx`   |
| **Look**               | One tone and one icon, by name                                                                     | `module.ts`   |

## What the kernel does with it

You write the parts above. The kernel does the rest, the same way for every module:

- **Voice.** The assistant prompt is composed from every module's description, operations and rules. A model answers with operations; nothing else can change data. Write an operation with an example and it can be spoken.
- **Receipts and undo.** Every operation reports what it changed. The app shows those lines in the Change Receipt and saves the plan as a new version, so one tap undoes it.
- **Whole or not at all.** Operations are validated and applied one by one. One that fails, throws, reports nothing or leaves data your schema rejects is undone and listed as rejected; the ones around it still apply. Data a module would not accept is never saved, and an operation that leaves everything exactly as it was is not a change: saving an untouched form does not make a new version of the plan.
- **Data nobody can change by accident.** Outside `apply`, the data you are handed is frozen: a hook, a view or a record operation that tries to change it throws, and that failure stays inside your module.
- **The screen.** Which modules are on screen and in what order is part of the plan (`layout`), changed by operations like any other data: `layout.add`, `layout.remove`, `layout.move`, `layout.set`. An operation that changes something in a module that is off screen puts it on screen.
- **Isolation.** Modules never see each other. A module whose stored data this version cannot read is set aside: it shows a notice, its operations are refused and its data is left untouched. A card, a week box or a detail that throws while drawing shows a notice (or nothing) in its place. In every case the rest of the screen keeps working.
- **Sync and storage.** The plan is one JSON document per person, saved with optimistic concurrency and mirrored to other devices. The database checks the envelope, not what modules store, so a new module needs no migration.

## The contract (version 1)

1. **A module never imports another module.** What modules share goes through the kernel or the host.
2. **Data changes only through operations.** `apply` changes the data it is given in place and reports every change with `ctx.change`. A change with no line in the receipt is refused, and so is a line with no change behind it.
3. **Operation fields forgive shape and are strict about meaning.** A model writes them: accept `"8:00"`, `"4"`, `null` for "not given"; reject a day that does not exist. Parsing must be idempotent: parsing its own output changes nothing.
4. **Data is JSON and stays small.** A whole plan is limited to 1 MB, and `empty()` returns new data on every call.
5. **Leaving the screen deletes nothing.** Do not clean up when your module is removed from `layout`.
6. **A new data shape is a new `version`** with a `migrate` that brings old data forward. What `migrate` returns must pass your schema, or the old data is kept as it was and the module is set aside.
7. **Every language has the same strings.** `name`, `description` and `example` (something a person can say to it) are required.
8. **Views get the module's data through props** and use no colour names: the host sets the module's tone and classes such as `text-tone` and `bg-tone/15` pick it up. They may use the host's components and words listed under [Views](#views).
9. **What happened on a date is a record**, not plan data. The plan says what a week looks like; records say what a date was like.
10. **Everything works without the assistant.** Whatever can be said can be done by hand: plan changes with the same operations, records with `records.set`.

`checkModule` from `@tukkteam/modules/testing` runs a module the way the kernel will and returns every breach it finds as a sentence. Every module in this repository passes it in CI, with the kernel set up the way PowerWeek sets it up:

```ts
it.each(MODULES.map((module) => [module.id, module] as const))("%s", (_id, module) => {
  expect(checkModule(module, { locales, kernel: createAppKernel })).toEqual([]);
});
```

It applies each example to an empty plan and to one filled by the examples before it, so an example that needs an id (`"<habit id>"`) ends as `not_found` and proves little. It also knows nothing about views. Both are what your own tests are for.

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

**Strings** are a typed object per language ([`messages.ts`](../apps/web/modules/notes/messages.ts)); functions are fine for plurals. `example` is what the landing page and the module gallery show under your module's name, so write it the way a person would say it.

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

**Registering it** takes two files. In [`apps/web/modules/index.ts`](../apps/web/modules/index.ts), import the module and add it to `MODULES`; its place there is its place in the assistant prompt and in the gallery. In [`apps/web/modules/views.tsx`](../apps/web/modules/views.tsx), import its views and add them to `VIEWS`. Nothing else in the app names a module.

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
- **Fields.** `@tukkteam/modules` has the building blocks: `text`, `optionalText`, `itemId`, `opt` (null and "" mean "not given"), `clearable` (leave out to keep, null to clear), `looseInt`, `looseNumber`, `compact` (drops empty keys) and `sameText` (the same title, ignoring case and accents). `@tukkteam/modules/week` has `DayKeySchema`, `DAY_KEYS`, `isDayKey`, `dayRecord`, `eachDay` and `looseTime` (`"8"`, `"8h"`, `"8.30"` → `"08:00"`, `"08:30"`).
- **Days.** In a field named `day`, `from`, `to` or `days`, a day name in Spanish or English ("lunes", "Friday") becomes its day key before your schema sees it. Keep those four names for days: under any other name "lunes" is not understood, and a `to` that means something else may be rewritten.
- **Examples** become lines of the assistant prompt, so they are documentation the model reads. Use placeholders such as `"<agenda id>"` for ids.
- **Rejecting.** Return a reason and the kernel puts the data back as it was; you do not need to undo anything yourself. `"not_found"`: it names something that does not exist. `"limit"`: a list is full. `"noop"`: nothing would change. You do not have to detect every case: the kernel compares your data before and after, and an operation that left it exactly as it was is a `noop` whatever it reported. `"conflict"`: it clashes with something already there, such as a second item with the same name. The kernel adds two of its own: `"invalid"` when the fields do not validate, the operation throws or the result fails your schema, and `"unavailable"` when your stored data cannot be read.
- **Reporting.** `ctx.change({ kind, label, day?, toDay?, scope?, data? })`: `label` is what the person wrote; `day` is where it happened, or leave it out and set `scope: "week"` for a change that belongs to no single day; `data` holds the facts `describe` needs (a time, a slot, a count). `describe(change, t)` turns a change into one line in the person's language; the host adds the day and where a moved item went.
- **Ids and defaults.** `ctx.newId()` gives a short id; `ctx.t` is your strings in the person's language, for default titles.
- **After each operation.** `normalize(state)` runs before your schema checks the result: keep lists sorted, drop empty containers. Every operation therefore starts from data that is valid and tidy, whether it came alone or with fifty others.

## Records

A record is a fact about a calendar date: this item was done, this option was chosen, three glasses so far. Records live outside the plan (table `entries`: date, module, key, value), so they have no versions and no undo. A key is 1 to 96 characters and a value is any JSON up to 2000 bytes; there is no schema for values, so read them defensively.

**By hand**, views read and write them directly for the week on screen, any of its seven days:

```tsx
const done = Boolean(records.get(day, item.id));
<button onClick={() => records.set(day, item.id, done ? null : true)} />;
```

`records.set` shows the fact at once and saves it behind, with no receipt and no validation: it does not go through `resolve`. Writes to the same key go out in the order of the calls, and one that cannot be saved puts the fact back as it was.

**By voice**, declare a record operation (`record` comes from `parts()`, like `operation`). It resolves what was said into writes; its `state` is frozen, so it cannot touch the plan:

```ts
records: {
  pick: record({
    upcoming: true,
    input: z.object({ day: DayKeySchema, slot: MealSlotSchema, option: z.string().nullable() }),
    examples: [{ fields: { day: "fri", slot: "lunch", option: "Chicken stir-fry" } }],
    resolve(state, input, ctx) {
      const option = findOption(state, input);
      if (!option) return "not_found";
      ctx.write(
        { day: input.day, key: `pick:${input.slot}`, value: option.id },
        { kind: "update", day: input.day, label: option.title, data: { picked: true } },
      );
    },
  }),
},
```

- `ctx.get(day, key)` returns what is stored, including what an earlier operation in the same request wrote, which is what "one more glass" needs.
- **Which date a weekday means.** The date of that day in the week on screen, the same one a tap on that day writes. A day name alone does not say which week, so tell the host which way your record looks: leave `upcoming` out for what was done ("I meditated"), set it for what will be ("tomorrow I'll have the lentils"). PowerWeek uses it in the two sentences where the week on screen is plainly wrong: looking ahead on a Sunday, Monday is tomorrow; looking back on a Monday, Sunday is yesterday. The receipt then shows the date.
- **One logic for both doors.** A view cannot send a record operation, so when by hand and by voice must agree (a counter that never passes its target, say), write that rule as a plain function and call it from `resolve` and from the view.
- **Telling them apart in `describe`.** A record change and a plan change both reach `describe`. Put a fact in `data` (`picked: true`, `amount: 3`) and branch on it.
- **Nothing cleans up for you.** Records of an item that was removed stay behind. Key them by the item's id so they cannot be mistaken for another's.

## The assistant

What the model is told about your module, and when:

| Part                                | Sent                               |
| ----------------------------------- | ---------------------------------- |
| `assistant.about`, every example    | Always, on screen or not           |
| `assistant.rules`                   | Always                             |
| `assistant.view(state)` (your data) | Only while the module is on screen |
| `assistant.reference()`             | Only while the module is on screen |

So a module that is off screen can still be reached by a sentence that clearly belongs to it ("los lunes hago pierna" brings Training back), but the model has no ids of its items then. Everything in the first two rows costs prompt space in every request, whoever uses the module: keep `about` to what the data looks like, and rules to what a model gets wrong without them.

The host tells the model that an operation with a `days` field takes a group of days at once ("weekdays", "every day") and one with a single `day` is written once per day. If your operation applies to several days, name the field `days`.

## Week hooks

All optional. A module that leaves one out takes no part in that piece of the interface.

| Hook                             | Feeds                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `load(state, day)`               | The Week Pulse and the stacked week bars: how many things are planned that day |
| `summary(state, day \| null, t)` | The short counts under the day and the week titles ("3 activities")            |
| `timeline(state, day, facts)`    | The Day Bar: `spans` for things that last, `markers` for things at a moment    |
| `clearDay(state, day, ctx)`      | `day.clear`: empty one day, reporting what was removed                         |
| `copyDay(state, from, to, ctx)`  | `day.copy`: copy one day onto another, with new ids                            |

`facts` gives the timeline your strings, the language and `record(key)` for that day, so a marker can show what was chosen. The other hooks see the plan and not the records: a summary can say "5 habits", not "2 of 5 done". Whole-day operations reach the modules on screen and no others.

## Views

Views live in the app. They receive the module's data through props ([`host.ts`](../apps/web/modules/host.ts)):

| Prop                       | What it is                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `data`, `t`, `lang`, `day` | Your data (frozen), your strings, the language, the day on screen                          |
| `today`                    | Today's weekday, for a view that draws the whole week                                      |
| `records`                  | The dated facts of your module for the visible week                                        |
| `relation`, `now`          | Card only. Whether the day is past, today or ahead, and the minute of the day              |
| `dispatch(operations)`     | Card only. Send operations; resolves `true` once saved or when there was nothing to change |
| `focus`                    | Card only. What was tapped on the day's timeline; read it with `useTapped`                 |

What a module may draw:

| View       | Where                                    | Notes                                                                                                                |
| ---------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `Card`     | Today, one per module                    | `span: 2` takes two columns on wide screens                                                                          |
| `WeekCell` | The week board, one box per day          | Drawn inside a button that opens the day: text and spans, nothing to press. `weekWeight` sets how wide the column is |
| `Peek`     | The week board, on hover or long press   | Everything the module holds that day                                                                                 |
| `hasDay`   | Whether a day counts as having something | Defaults to "its `load` is above zero"; say otherwise when your content is not load                                  |

From the host you may use:

- **Components.** `ModuleCard` and `CellHeader` (the shared chrome), `EditorDialog` with `Field` and `fieldClass` (a form that sends one operation and starts in its first field; `form.text`, `form.orNull`, `form.orUndefined`, `form.raw` and `form.all` read it), `ModuleIcon`, `Button`, and `useTapped`.
- **Words.** `useLocale().dict` for what every module says the same way: `dict.app` (add, edit, mark as done), `dict.editor` (field labels), `dict.common` and `dict.days`. Everything that is yours goes in your own `messages.ts`.

Colour: write `text-tone`, `bg-tone`, `bg-tone/15`, `border-tone/40`. Never a colour name. The tone is one of `blue`, `volt`, `orange`, `sand`, `violet`, `rose`, `teal`; each is a pair of colours (Night and Day) in [`tokens.json`](../packages/design-tokens/tokens.json), checked on every build for contrast and for staying apart from the other tones with colour blindness. Colour is never the only cue: your module also has an icon and a name. The rest of the look is in [`design-system.md`](design-system.md), and the accessibility rules every screen follows are in [`development.md`](development.md).

The house style: prefer a bar to a number, and a number to a sentence.

## Testing a module

[`apps/web/modules/test-kit.ts`](../apps/web/modules/test-kit.ts) has what the tests of the built-in modules use, and [`agenda.test.ts`](../apps/web/modules/agenda/agenda.test.ts) and [`fuel.test.ts`](../apps/web/modules/fuel/fuel.test.ts) are the ones to copy.

```ts
import { sequentialIds } from "@tukkteam/modules";
import { kernel } from "../index";
import { habits } from "./module";

// Operations: apply them with ids you can predict, then read your module's data.
const { doc, changes, rejected } = kernel.apply(
  kernel.empty(),
  [{ op: "habits.add", title: "Leer", days: ["mon", "wed"] }],
  { newId: sequentialIds("h"), lang: "es" },
);
expect(kernel.state(doc, habits).items).toEqual([
  { id: "h1", title: "Leer", days: ["mon", "wed"] },
]);

// Records: resolve them against facts you make up.
const stored = new Map<string, Json>();
const noted = kernel.resolveRecords(doc, [{ op: "habits.log", day: "mon", habit: "Leer" }], {
  lang: "es",
  get: (_module, day, key) => stored.get(`${day}|${key}`),
});
expect(noted.writes).toEqual([
  { module: "habits", day: "mon", key: "h1", value: 1, upcoming: false, index: 0 },
]);
```

Test what your operations reject as well as what they do, and what `describe` says for each kind of change.

## Checklist for a pull request

- [ ] A folder `apps/web/modules/<id>` with `module.ts`, `messages.ts`, `views.tsx` and a test file.
- [ ] `checkModule` passes (it runs for every module in `MODULES`).
- [ ] Tests for what your operations do, including what they reject.
- [ ] Every operation has an example the model can copy.
- [ ] Strings in `es` and `en`, with an `example` of what to say.
- [ ] Looked at in a browser, in both themes, on a phone width. This needs the app running against a Supabase project ([`development.md`](development.md)).
- [ ] Tried by voice with a few real sentences, including one the module should refuse.
- [ ] No import from another module's folder.

## What is not there yet

Said plainly, so nobody builds on something that does not exist:

- **Modules ship with the app.** A new module arrives through a pull request to this repository and is reviewed like any other code. There is no way to install one at run time.
- **No marketplace and no sandbox.** Module code runs with the same trust as the app, which is why it is reviewed. Both are described as proposals in [ADR 0012](adr/0012-modules-ship-with-the-app.md).
- **Records are out of reach for most hooks.** `summary`, `load` and `assistant.view` see the plan and not what was done, so the model cannot answer "how many so far?" and a view reads the visible week and nothing before it. Streaks and charts over time need this.
- **A view cannot send a record operation.** By hand, records go through `records.set`.
- **No way to see a module without a backend.** Looking at a card means running the whole app.
- **The contract is version 1 and young.** Three modules were ported to it and two were written for it. Habits was written from this page alone, by someone who had not seen the kernel, and what they ran into changed both the page and the contract. It will change as more are written; `CONTRACT_VERSION` in `packages/modules` says which one a module was written for.
