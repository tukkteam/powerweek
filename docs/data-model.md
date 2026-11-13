# Data model

All data lives in Supabase Postgres (project in `eu-west-3`). The schema is defined in [`supabase/migrations`](../supabase/migrations) and tested with pgTAP in [`supabase/tests`](../supabase/tests).

## The plan document

A user has **one recurring weekly plan**: seven days, Monday first, with no dates. It is stored as one JSONB document because it is read and written as a whole, changes through small operations, and needs atomic versioning.

```jsonc
{
  "schemaVersion": 1,
  "days": {
    "mon": {
      "agenda": [{ "id": "k3f9…", "title": "Work", "time": "09:00", "endTime": "18:00" }],
      "workout": {
        "title": "Leg day",
        "exercises": [
          { "id": "p1x…", "name": "Back squat", "sets": 5, "reps": "5", "load": "80 kg" },
        ],
      },
      "meals": [{ "id": "m8q…", "slot": "breakfast", "title": "Oatmeal with banana" }],
      "note": "optional",
    },
    "tue": { "agenda": [], "workout": null, "meals": [] },
    // … wed, thu, fri, sat, sun
  },
}
```

The shape is defined once in [`packages/core/src/plan.ts`](../packages/core/src/plan.ts) (zod) and exported as JSON Schema ([`packages/core/schema/plan.schema.json`](../packages/core/schema/plan.schema.json)). Postgres enforces it with `CHECK (plan_doc_is_valid(doc))` using `pg_jsonschema`. `plan-schema.test.ts` fails if the zod schema, the committed JSON Schema and the latest migration drift apart.

Limits (also in the schema): 40 agenda items, one workout of up to 30 exercises and 12 meals per day; titles up to 140 characters.

## Tables

| Table                | Purpose                                                                                                                               | Client access (RLS)                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `profiles`           | Display name, locale (`es`/`en`), time zone                                                                                           | Read and update own row            |
| `plans`              | The plan document and its `version`                                                                                                   | Read own row; **no direct writes** |
| `plan_revisions`     | Append-only history: version, doc, source (`seed`, `assistant`, `manual`, `undo`), input, operations, changes. Last 200 kept per user | Read own rows                      |
| `completions`        | `(user_id, on_date, item_id)`: an item ticked off on a calendar date                                                                  | Read, insert and delete own rows   |
| `assistant_requests` | One row per assistant call: status, model, latency. Drives rate limits                                                                | Read and insert own rows           |

New users get a profile, an empty plan and a seed revision from the `on_auth_user_created` trigger (`handle_new_user`), using `locale` and `time_zone` from sign-up metadata.

## RPCs

All are `security definer` with `search_path = ''` and check `auth.uid()`.

| Function                                                                              | What it does                                                                                                                       |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `my_plan()`                                                                           | Returns `{doc, version, updated_at}`, creating the plan if a trigger was ever missed                                               |
| `save_plan(p_doc, p_expected_version, p_source, p_input?, p_operations?, p_changes?)` | Writes only if `version = p_expected_version` (else SQLSTATE `40001` `version_conflict`), bumps the version and appends a revision |
| `undo_plan(p_version)`                                                                | Restores the revision before `p_version` if the plan is still at `p_version`; the revert is itself a new version                   |
| `delete_my_account()`                                                                 | Deletes the auth user; cascades remove every row                                                                                   |

## Privileges

Defence in depth on top of RLS: `anon` has no table privileges; `authenticated` cannot insert, update or delete `plans` or `plan_revisions` directly, cannot delete `assistant_requests` and cannot update `completions`.

## Realtime

`plans` is in the `supabase_realtime` publication. Clients subscribe to `UPDATE` events filtered by `user_id` and apply any version newer than their own.

## Changing the schema

1. Change the zod schema in `packages/core`, then run `UPDATE_SCHEMA=1 pnpm --filter @powerweek/core test`.
2. Add a new migration (`supabase migration new <name>`) that replaces `plan_doc_is_valid` with the new schema literal. Never edit an applied migration.
3. If the document shape changes incompatibly, bump `schemaVersion` and migrate existing rows in the same migration.
4. Run `supabase test db` locally (Docker) and `pnpm db:types` to regenerate `apps/web/lib/supabase/database.types.ts`.
