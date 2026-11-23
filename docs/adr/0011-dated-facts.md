# 0011 · Dated facts of every module live in one table

Date: 2026-11-23 · Status: Accepted

## Context

The plan is a recurring week: it says what Mondays look like, not what happened last Monday. What happened on a date was stored in two tables made for two cases: `completions` (an item ticked off) and `meal_picks` (the option chosen for a meal). Every module that wants to remember a date would have needed a table of its own and a migration, and nothing could draw a history across modules.

## Decision

- One table, `entries (user_id, on_date, module, key, value jsonb)`, with row level security by owner. A fact is whatever a module wants to remember about a date: `true` for a tick, an option id, a count.
- Views read and write the facts of their own module for the week on screen through `records.get(day, key)` and `records.set(day, key, value)`.
- The assistant writes facts through **record operations** that a module declares next to its plan operations (`fuel.pick`). The kernel keeps the two apart: a record operation can never change the plan, and it has no undo because it is not a plan version.
- A record names a weekday, and the host decides which date that is. By default it is the date of that day in the week on screen. A record declared `upcoming` looks ahead: the day is the next time it comes, so "tomorrow I'll have the lentils", said on a Sunday, is stored for the Monday that follows. Yesterday is still read as yesterday.
- Existing ticks and picks are copied into `entries` by the migration. The two old tables stay until every app has been reloaded and are then dropped.

## Consequences

- A module that tracks something (a habit, a glass of water, a mood) needs no migration.
- All dated facts have one shape, which is what a history or a chart across modules needs.
- A fact's value is free-form JSON, bounded at 2,000 bytes. The module that wrote it is the only one that knows what it means.
- Ticks made in an app from before this change, between the migration and that app being reloaded, stay in the old tables and are lost when the cleanup migration drops them. That migration must not copy the old tables a second time: by then people have removed ticks and picks in `entries`, and a second copy would bring them back.
- A weekday is ambiguous across weeks and no rule reads every sentence right: "on Sunday I'll have paella", said on a Monday, is read as yesterday. Asking the model for a date instead would trade this for date arithmetic by the model.
