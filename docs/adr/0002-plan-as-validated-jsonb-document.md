# 0002 · One weekly plan per user as a validated JSONB document with revisions

Date: 2026-11-13 · Status: Accepted

## Context

A plan is a recurring week (seven days of agenda, workout and meals). It is always read whole, changed in small edits, and needs undo and multi-device sync. A normalised schema (tables for items, exercises, meals) would need multi-row transactions for every edit and makes "restore the previous version" expensive.

## Decision

Store the plan as one JSONB document in `plans.doc` with an integer `version`. Validate it in Postgres with `pg_jsonschema` against the JSON Schema generated from the zod schema in `packages/core`. Write only through `save_plan` (optimistic concurrency on `version`) and `undo_plan`, and append every version to `plan_revisions`.

## Consequences

- Undo is a lookup, history is free, and conflicts are explicit (`40001 version_conflict`).
- Cross-user analytics on items would need JSON queries; acceptable for a personal planner.
- Schema changes require a migration that replaces `plan_doc_is_valid`; a test keeps code and database in step.
