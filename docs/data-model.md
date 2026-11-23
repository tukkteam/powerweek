# Data model

All data lives in Supabase Postgres (project in `eu-west-3`). The schema is defined in [`supabase/migrations`](../supabase/migrations) and tested with pgTAP in [`supabase/tests`](../supabase/tests).

## The plan document

A user has **one recurring weekly plan**: seven days, Monday first, with no dates. It is stored as one JSONB document because it is read and written as a whole, changes through small operations, and needs atomic versioning.

The document is an envelope of modules ([ADR 0010](adr/0010-modules.md)):

```jsonc
{
  "schemaVersion": 2,
  // The modules on screen, in the person's order.
  "layout": ["agenda", "fuel", "train"],
  // The data of every module the person has used, each with the version of its shape.
  // A module that is taken off the screen keeps its entry.
  "modules": {
    "agenda": {
      "v": 1,
      "data": {
        "days": {
          "mon": [{ "id": "k3f9…", "title": "Work", "time": "09:00", "endTime": "18:00" }],
          "tue": [],
          // … wed, thu, fri, sat, sun
        },
      },
    },
    "train": {
      "v": 1,
      "data": {
        "days": {
          "mon": {
            "title": "Leg day",
            "time": "19:00", // optional start, places the session on the day timeline
            "exercises": [
              {
                "id": "p1x…",
                "name": "Back squat",
                "sets": 5,
                "reps": "5",
                "load": "80 kg",
                "move": "squat",
              },
            ],
          },
          "tue": null,
          // …
        },
      },
    },
    "fuel": {
      "v": 1,
      "data": {
        "days": {
          "mon": {
            "meals": [{ "id": "m8q…", "slot": "breakfast", "title": "Oatmeal with banana" }],
          } /* … */,
        },
        "menu": {
          "lunch": { "options": [{ "id": "o1", "title": "Lentils" }], "days": ["mon", "tue"] },
        },
      },
    },
    "notes": { "v": 1, "data": { "days": { "sat": "Rest day" } } },
  },
}
```

**Who checks what.** The envelope is defined in [`packages/modules/src/doc.ts`](../packages/modules/src/doc.ts) (zod) and exported as JSON Schema ([`packages/modules/schema/doc.schema.json`](../packages/modules/schema/doc.schema.json)). Postgres enforces it with `CHECK (plan_doc_is_valid(doc))` using `pg_jsonschema`, plus a 1 MB limit; `apps/web/modules/schema.test.ts` fails if the zod schema, the committed JSON Schema and the latest migration drift apart. What is inside each `data` is defined by its module (`apps/web/modules/<id>/module.ts`) and checked by the kernel before every save, so a new module needs no migration.

**Plans from before modules** have `schemaVersion: 1` and three fixed categories per day. They stay valid in the database; the app upgrades one when it reads it ([`legacy/plan-v1.ts`](../apps/web/modules/legacy/plan-v1.ts)) and saves it as version 2 with the person's next change. `save_plan` refuses to replace a document with an older `schemaVersion`, so an app from before modules cannot overwrite a version 2 plan. A version 1 plan that does not validate whole is not upgraded piece by piece: the app reports that it cannot read it and saves nothing.

**Agenda.** Up to 40 items per day, titles up to 140 characters; timed items are sorted by time, untimed ones keep their order at the end.

**Training.** At most one workout per day with up to 30 exercises. `move` is a slug from the move library ([`modules/train/moves.ts`](../apps/web/modules/train/moves.ts), 302 exercises). The assistant writes it; when it is missing or unknown, `resolveMove` matches the exercise name (Spanish or English) instead, so older plans and manual edits get illustrations too. Renaming an exercise without restating its `move` drops the old one.

**Meals.** Up to 12 meals per day: one per slot (breakfast, lunch, dinner) and any number of snacks. A slot can offer options instead of one dish: the module's `menu` holds options shared by several days (no `days` = every day) and a day's `menu` holds options for that day only. For each slot a fixed meal wins, then the day's options, then the week's (`mealSlots`). Editing options keeps the id of options whose title is unchanged, so what was chosen survives.

**Notes.** One optional text per day, up to 500 characters.

## Dated facts

The plan says what a week looks like. What happened on a calendar date lives in `entries`, one row per user, date, module and key ([ADR 0011](adr/0011-dated-facts.md)):

| Module | Key           | Value        | Meaning                                     |
| ------ | ------------- | ------------ | ------------------------------------------- |
| agenda | an item id    | `true`       | An untimed item was ticked off that day     |
| train  | `workout`     | `true`       | The day's session was done                  |
| fuel   | `pick:<slot>` | an option id | The option chosen for that slot on that day |

Timed agenda items are not ticked: they show progress from the clock. Any module can store facts under its own id without a migration.

## Tables

| Table                | Purpose                                                                                                                               | Client access (RLS)                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `profiles`           | Display name, locale (`es`/`en`), time zone                                                                                           | Read and update own row            |
| `plans`              | The plan document and its `version`                                                                                                   | Read own row; **no direct writes** |
| `plan_revisions`     | Append-only history: version, doc, source (`seed`, `assistant`, `manual`, `undo`), input, operations, changes. Last 200 kept per user | Read own rows                      |
| `entries`            | `(user_id, on_date, module, key) → value`: what happened on a calendar date, per module. Values up to 2,000 bytes                     | Read, insert, update, delete own   |
| `completions`        | Deprecated: ticks from before `entries`. Copied there; kept until every app has been reloaded                                         | Read, insert and delete own rows   |
| `meal_picks`         | Deprecated: picks from before `entries`. Copied there; kept until every app has been reloaded                                         | Read, insert, update, delete own   |
| `assistant_requests` | One row per assistant call: status, model, latency. Drives rate limits                                                                | Read and insert own rows           |

New users get a profile, an empty plan and a seed revision from the `on_auth_user_created` trigger (`handle_new_user`), using `locale` and `time_zone` from sign-up metadata.

## RPCs

All are `security definer` with `search_path = ''` and check `auth.uid()`.

| Function                                                                              | What it does                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `my_plan()`                                                                           | Returns `{doc, version, updated_at}`, creating the plan if a trigger was ever missed                                                                                                                                                        |
| `save_plan(p_doc, p_expected_version, p_source, p_input?, p_operations?, p_changes?)` | Writes only if `version = p_expected_version` (else SQLSTATE `40001` `version_conflict`) and the document is not of an older `schemaVersion` than the stored one (else `PW001` `client_outdated`); bumps the version and appends a revision |
| `undo_plan(p_version)`                                                                | Restores the revision before `p_version` if the plan is still at `p_version`; the revert is itself a new version                                                                                                                            |
| `delete_my_account()`                                                                 | Deletes the auth user; cascades remove every row                                                                                                                                                                                            |

## Privileges

Defence in depth on top of RLS: `anon` has no table privileges; `authenticated` cannot insert, update or delete `plans` or `plan_revisions` directly, cannot delete `assistant_requests` and cannot update `completions`.

## Realtime

`plans` is in the `supabase_realtime` publication. Clients subscribe to `UPDATE` events filtered by `user_id` and apply any version newer than their own.

## Changing the schema

**A module's data.** Change its zod schema in `apps/web/modules/<id>/module.ts`. No migration is needed. If old data would no longer pass, raise the module's `version` and add a `migrate(data, fromVersion)`; the kernel runs it when it reads a plan, and sets aside data it cannot read instead of overwriting it.

**The envelope or the tables.**

1. Change the zod schema in `packages/modules/src/doc.ts`, then run `UPDATE_SCHEMA=1 pnpm --filter @tukkteam/modules test`.
2. Add a new migration (`supabase migration new <name>`) that replaces `plan_doc_is_valid` with the new schema literal. Never edit an applied migration.
3. If the envelope changes incompatibly, bump `schemaVersion` and keep accepting the previous one until every stored plan has been upgraded.
4. Run `supabase test db` locally (Docker) and `pnpm db:types` to regenerate `apps/web/lib/supabase/database.types.ts`.
