# 0010 · A plan is a document of modules, bound by a contract and a kernel

Date: 2026-11-23 · Status: Accepted

## Context

A plan had three fixed categories: agenda, training and meals. They were written into the plan schema, the reducer, the assistant prompt, every screen, the design tokens and the JSON Schema that Postgres enforces. A fourth category meant touching all of them, and a person who does not train still got a training box. The three suit one kind of person; the product is meant for anyone who wants to organise a week.

## Decision

- **A module contract.** A module declares its data (a strict zod schema), its operations (the only way data changes, each with an example), optional records of dated facts, what the assistant needs to know, optional hooks for the weekly screens, its strings and its look. The contract is version 1 and is written down in [docs/modules.md](../modules.md).
- **A kernel.** `packages/modules` (`@tukkteam/modules`) binds a list of modules into one document. It reads and upgrades stored JSON, routes each operation to its module, keeps the receipt, composes the assistant prompt and reads the model's answer. It has no knowledge of PowerWeek; the weekly vocabulary (days, times, the day timeline, `day.clear`, `day.copy`) is a layer on top of it in the same package.
- **The document.** `{ schemaVersion: 2, layout, modules }`. `layout` is the modules on screen, in order; `modules[id]` is `{ v, data }`, where `v` is the version of that module's data. The screen is data, so it is changed by operations (`layout.add`, `layout.remove`, `layout.move`, `layout.set`), spoken and undone like anything else. A module that leaves the screen keeps its entry.
- **Who checks what.** Postgres checks the envelope and a size limit (512 KB). The kernel checks what modules store: every operation is validated on its own, an operation that fails or throws is undone, an operation that reports no change is refused, and after the last one the module's own schema must accept the result or all of that module's work is undone.
- **Isolation.** Modules never import each other. Data a module cannot read (written by a newer version, or damaged) is set aside: the module shows a notice, its operations are refused, the data is kept as it is. A card that throws while drawing is replaced by a notice. Hooks that throw contribute nothing.
- **One folder per module** in `apps/web/modules/<id>`: `module.ts`, `messages.ts`, `views.tsx` and tests. The four built-in modules are Agenda, Meals, Training and Notes. Notes holds what used to be the day note.
- **Colour is not written in views.** A module names a tone; the host sets it on the element that wraps the module and views use `text-tone`, `bg-tone`. The three category colours became a palette of nine tones, each checked for contrast in both themes.

### Moving stored plans

- Nothing stored is rewritten. A plan at version 1 is upgraded in memory when it is read and saved as version 2 with the person's next change.
- Postgres accepts both versions, and `save_plan` refuses to replace a document with an older `schemaVersion` (SQLSTATE `PW001`). An app from before modules, left open in a tab, fails safely instead of overwriting a version 2 plan with what it could read of it.
- The version 1 reducer is kept in the repository as a test oracle. A parity test applies thousands of random version 1 operations there and, under their old names, through the modules, and requires the same data and the same receipt.
- New accounts still start from a version 1 blank plan until every app has been reloaded; the app reads it as a blank document and asks which modules the person wants. A later migration switches that default and drops the version 1 schema.

## Consequences

- A new module is a folder and two lines in the registry. It can be used by voice, has receipts and undo, and appears in the gallery, the Day Bar and the week board without any change to those screens.
- A person chooses their modules. Nobody starts with three boxes they did not ask for.
- The database no longer knows what a meal or a workout looks like. That check moved from one JSON Schema to the kernel, which is stricter (it runs per operation) but lives in the app.
- Operation names gained their module: `workout.set` is `train.workout.set`. The old names are kept as aliases.
- One more level of indirection: screens ask the kernel what modules contribute instead of reading plan fields.
- The contract is young. Four modules have been written against it; it will change as more are, and `CONTRACT_VERSION` records which version a module was written for.
