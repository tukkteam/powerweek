# 0003 · Every plan change is a typed operation applied by one pure reducer

Date: 2026-11-13 · Status: Accepted

## Context

The prototype asked the language model to return the whole week. Any omission silently deleted data, and there was no way to show the user what changed.

## Decision

The model (and the manual editor) produce `Operation[]` from a closed catalogue (`agenda.add`, `meal.set`, `day.copy`, …) defined with zod in `packages/core`. `applyOperations(plan, ops)` is pure: it returns the new plan, the list of `Change`s and the operations it had to reject. The same reducer runs in the browser and in the assistant route.

## Consequences

- The Change Receipt is exact by construction, and undo is reliable.
- Model mistakes are contained: invalid operations are dropped one by one, and impossible ones are reported, not applied.
- New capabilities mean new operations, with tests, in one place.
- Operations are replayable, which is the foundation for offline queues later.
