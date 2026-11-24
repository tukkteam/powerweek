# The assistant

The assistant turns one sentence ("quita la cena del viernes y mueve el pádel al jueves") into a list of typed operations, applies them and saves a new plan version. It lives in [`apps/web/app/api/assistant/route.ts`](../apps/web/app/api/assistant/route.ts) and [`apps/web/lib/assistant`](../apps/web/lib/assistant); the protocol itself (composing the prompt, reading the answer) is part of the kernel in [`packages/modules/src/assistant.ts`](../packages/modules/src/assistant.ts).

## Contract

The model receives what is on screen, the current data of those modules (with item ids), today's weekday and date, and the user's sentence. It must answer with a JSON object:

```json
{
  "operations": [
    { "op": "fuel.meal.remove", "id": "m8q2…" },
    { "op": "agenda.update", "id": "k3f9…", "day": "thu" }
  ],
  "reply": "He quitado la cena del viernes y he movido el pádel al jueves."
}
```

Every operation belongs to a module, or to the screen. Nobody maintains a catalogue by hand: each module declares its operations with an example, and the prompt is composed from them.

| Operation                                                                | Effect                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `agenda.add` / `agenda.update` / `agenda.remove`                         | Timed or untimed items; `update` with `day` moves an item                                   |
| `train.workout.set` / `train.workout.update` / `train.workout.clear`     | Create or replace a day's workout, rename it, set its start time, remove it                 |
| `train.exercise.add` / `train.exercise.update` / `train.exercise.remove` | Single exercises; `add` creates a workout if the day has none; `move` links an illustration |
| `fuel.meal.set` / `fuel.meal.update` / `fuel.meal.remove`                | One meal per slot (breakfast, lunch, dinner), any number of snacks                          |
| `fuel.menu.set` / `fuel.menu.clear`                                      | Options for a meal slot shared by the week (optionally only some days)                      |
| `fuel.options.set`                                                       | Options for one slot on one day; `[]` removes them                                          |
| `fuel.pick` (a record, not a plan operation)                             | Chooses one option for a day of the week on screen; stored in `entries`, no undo            |
| `notes.set`                                                              | Set or remove a free-text note for a day                                                    |
| `habits.add` / `habits.update` / `habits.remove`                         | A habit for some or all days of the week, ticked or counted (`target`, `unit`, `days`)      |
| `habits.log` (a record, not a plan operation)                            | What was done on a date: done, an amount so far (`value`) or some more (`add`); no undo     |
| `layout.add` / `layout.remove` / `layout.move` / `layout.set`            | Put a module on screen, take it off (its data is kept), move it, or set the whole order     |
| `day.clear` / `day.copy`                                                 | Clear a day, or copy it onto other days, in every module on screen or only in some          |

The names from before modules (`workout.set`, `meal.set`, `meal.pick`, `day.note`…) are still understood.

## Validation and application

1. `parseOutput` extracts the JSON (tolerating code fences), normalises harmless mistakes (Spanish or English day names, `agenda_add` spelling, a single target day for `day.copy`) and validates **each operation separately** against the module that owns it, so one bad operation never discards the good ones. Operations that do not validate are counted as `dropped`.
2. Schemas are forgiving about _shape_ (`"8:00"` → `"08:00"`, `"4"` sets → `4`, `null` → not given) and strict about _meaning_ (valid days, slots, limits).
3. `kernel.apply` (pure, unit-tested) routes each operation to its module. Each one applies whole or not at all: one that cannot apply (unknown id, full day, nothing to change), throws, leaves data its module's schema rejects or leaves everything as it was is undone and reported in `rejected`, and the rest still apply. An operation that changes something in a module that is off screen puts that module on screen.
4. The new document is saved with `save_plan` and the expected version. On a conflict (another device saved in between) the route reloads the plan and re-applies the same operations once.
5. Record operations are resolved by their module into dated facts and stored in `entries`. They never change the plan. The route turns the weekday of each fact into a date ([`lib/record-date.ts`](../apps/web/lib/record-date.ts)): the week on screen, except that tomorrow said on a Sunday and yesterday said on a Monday mean what they say. Each change carries its date, a fact that could not be stored is reported like a rejected operation, and when what is stored cannot be read nothing is resolved at all.

Nothing the model writes reaches the database without passing its module's schema, the kernel and the Postgres check on the envelope.

The model writes `reply` before anything is applied, so it can claim a change that was then refused. The response carries `rejected` and `dropped` (which includes whatever went over the limit of operations per answer), and when nothing changed the Change Receipt shows the reason instead of the model's sentence.

The request carries `docVersion`, the document version the caller reads. A caller that does not send the current one is turned away with `bad_request` before the model is asked: a tab left open since before an upgrade would not understand the answer.

## Prompt

The system prompt is composed in three layers:

- **The host** ([`lib/assistant/prompt.ts`](../apps/web/lib/assistant/prompt.ts)): who the assistant is, the vocabulary every operation shares (day keys, 24 h times) and the rules that hold everywhere: change only what was asked, never invent data, use exact ids, what "weekdays"/"weekend"/"every day" mean (one operation per day, or one with all of them when the operation has a `days` field), natural am/pm defaults, short titles in the user's language, answer questions with no operations, how to arrange the screen. The reply language follows the interface language.
- **Each module** (`assistant` in its `module.ts`): what it holds and how its data is laid out, one line per operation with an example, and its own rules. Each module is listed with the name the person sees, so "Comidas" finds its way to `fuel`.
- **Reference texts** of the modules on screen only, such as the move library.

The user message says which modules are on screen and in what order, gives the data of those modules as JSON (days with nothing are left out) and quotes the request.

### Linking exercises to illustrations

While Training is on screen the system prompt ends with the move library: 302 slugs grouped by what they train (about 1,500 tokens). For every exercise the model adds `"move"`, the slug of the same movement with the same equipment, or leaves it out for sports and classes. The model only **links** an existing drawing; it never generates images, so the cost per request stays flat.

Unknown slugs are dropped by the operation schema (the exercise is kept), and the app falls back to a deterministic matcher on the exercise name ([`moves-match.ts`](../apps/web/modules/train/moves-match.ts)): Spanish gym vocabulary is translated to the library's English words ("press de banca" → bench press, "jalón" → lat pulldown, "remo inclinado" → bent-over row) and moves are scored by weighted word overlap. Tests pin both the matcher and the catalogue.

## Model and configuration

Any OpenAI-compatible `chat/completions` endpoint works. Production uses the OmniRoute gateway:

| Variable             | Meaning                                        |
| -------------------- | ---------------------------------------------- |
| `OMNIROUTE_BASE_URL` | Base URL ending in `/v1`                       |
| `OMNIROUTE_API_KEY`  | Server-only key                                |
| `OMNIROUTE_MODEL`    | Model id (for example a small reasoning model) |

Requests use JSON mode (`response_format: { type: "json_object" }`) and `temperature: 0.1`. Some gateways only accept JSON mode when an input message contains the word "json"; the user message always does. Typical latency is 2–4 seconds.

## Limits

| Limit                     | Value                           |
| ------------------------- | ------------------------------- |
| Input length              | 600 characters                  |
| Calls per user per minute | 8                               |
| Calls per user per day    | 400 (120 for anonymous users)   |
| Operations per answer     | 60                              |
| Model timeout             | 45 s (route `maxDuration` 60 s) |

Every call is logged in `assistant_requests` with its status (`ok`, `no_changes`, `invalid_output`, `model_error`, `conflict`), model and latency. The input itself is stored only in `plan_revisions` when it changed the plan.

## Privacy

The user's sentence and their current weekly plan are sent to the configured model provider to produce the answer. No other personal data (email, account id) is included. Self-hosters can point `OMNIROUTE_BASE_URL` at any provider or local model with an OpenAI-compatible API.

## Testing changes to the prompt

- Unit tests: `pnpm --filter @powerweek/web test` (prompt, every module's operations) and `pnpm --filter @tukkteam/modules test` (the kernel, reading model output).
- Manual: run the app, try the sentences in `dict.dock.examples` plus edge cases (questions, unknown items, "every day", moves between days, a module that is off screen, "put training first") and check the receipt.
