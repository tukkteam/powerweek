# The assistant

The assistant turns one sentence ("quita la cena del viernes y mueve el pádel al jueves") into a list of typed operations, applies them and saves a new plan version. It lives in [`apps/web/app/api/assistant/route.ts`](../apps/web/app/api/assistant/route.ts) and [`apps/web/lib/assistant`](../apps/web/lib/assistant).

## Contract

The model receives the current plan (with item ids), today's weekday and date, and the user's sentence. It must answer with a JSON object:

```json
{
  "operations": [
    { "op": "meal.remove", "id": "m8q2…" },
    { "op": "agenda.update", "id": "k3f9…", "day": "thu" }
  ],
  "reply": "He quitado la cena del viernes y he movido el pádel al jueves."
}
```

The operation catalogue is defined in [`packages/core/src/operations.ts`](../packages/core/src/operations.ts):

| Operation                                              | Effect                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| `agenda.add` / `agenda.update` / `agenda.remove`       | Timed or untimed items; `update` with `day` moves an item          |
| `workout.set` / `workout.update` / `workout.clear`     | Create or replace a day's workout, rename it, remove it            |
| `exercise.add` / `exercise.update` / `exercise.remove` | Single exercises; `add` creates a workout if the day has none      |
| `meal.set` / `meal.update` / `meal.remove`             | One meal per slot (breakfast, lunch, dinner), any number of snacks |
| `day.clear`                                            | Clear a day, optionally only some categories                       |
| `day.copy`                                             | Copy a day (or some categories) onto other days                    |
| `day.note`                                             | Set or remove a free-text note for a day                           |

## Validation and application

1. `parseAssistantOutput` extracts the JSON (tolerating code fences), normalises harmless mistakes (Spanish or English day names, `agenda_add` spelling, a single target day for `day.copy`) and validates **each operation separately** with zod, so one bad operation never discards the good ones.
2. Schemas are forgiving about _shape_ (`"8:00"` → `"08:00"`, `"4"` sets → `4`, `null` → not given) and strict about _meaning_ (valid days, slots, limits).
3. `applyOperations` (pure, unit-tested) applies them, skips the ones that can't apply (unknown id, full day) and reports them as `rejected`, and returns a `Change` list for the receipt.
4. The new document is saved with `save_plan` and the expected version. On a conflict (another device saved in between) the route reloads the plan and re-applies the same operations once.

Nothing the model writes reaches the database without passing the zod schema, the reducer and the Postgres JSON Schema check.

## Prompt

The system prompt ([`lib/assistant/prompt.ts`](../apps/web/lib/assistant/prompt.ts)) explains the plan, lists every operation with an example and fixes the rules: change only what was asked, never invent data, use exact ids, expand "weekdays"/"weekend"/"every day" to one operation per day, use 24 h times with natural am/pm defaults, map Spanish meal names to slots, keep titles short and in the user's language, and answer questions with no operations. The reply language follows the interface language.

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

- Unit tests: `pnpm --filter @powerweek/web test` (parser and prompt) and `pnpm --filter @powerweek/core test` (reducer).
- Manual: run the app, try the sentences in `dict.dock.examples` plus edge cases (questions, unknown items, "every day", moves between days) and check the receipt.
