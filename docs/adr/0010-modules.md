# 0010 · A plan is a document of modules, bound by a contract and a kernel

Date: 2026-11-23 · Status: Accepted

## Context

A plan had three fixed categories: agenda, training and meals. They were written into the plan schema, the reducer, the assistant prompt, every screen, the design tokens and the JSON Schema that Postgres enforces. A fourth category meant touching all of them, and a person who does not train still got a training box. The three suit one kind of person; the product is meant for anyone who wants to organise a week.

## Decision

- **A module contract.** A module declares its data (a strict zod schema), its operations (the only way data changes, each with an example), optional records of dated facts, what the assistant needs to know, optional hooks for the weekly screens, its strings and its look. The contract is version 1 and is written down in [docs/modules.md](../modules.md).
- **A kernel.** `packages/modules` (`@tukkteam/modules`) binds a list of modules into one document. It reads and upgrades stored JSON, routes each operation to its module, keeps the receipt, composes the assistant prompt and reads the model's answer. It has no knowledge of PowerWeek; the weekly vocabulary (days, times, the day timeline, `day.clear`, `day.copy`) is a layer on top of it in the same package.
- **The document.** `{ schemaVersion: 2, layout, modules }`. `layout` is the modules on screen, in order; `modules[id]` is `{ v, data }`, where `v` is the version of that module's data. The screen is data, so it is changed by operations (`layout.add`, `layout.remove`, `layout.move`, `layout.set`), spoken and undone like anything else. A module that leaves the screen keeps its entry.
- **Who checks what.** Postgres checks the envelope and a size limit (1 MB). The kernel checks what modules store, one operation at a time: an operation applies whole or not at all. One that fails, throws, reports no change or leaves data its module's schema rejects is undone and reported, and the operations around it still apply. Each one therefore starts from valid, tidy data, whether it came alone or with fifty others.
- **Documents are values.** The kernel freezes every document it reads or produces. A view, a hook or a record operation that tries to change one throws inside its own boundary, instead of slipping a change in with no receipt. Something that is not a document is never read as an empty one: `read` returns nothing and the app reports it, because an empty plan on screen is one save away from replacing the real one.
- **Isolation.** Modules never import each other. Data a module cannot read (written by a newer version, damaged, or left by a migration that failed) is set aside: the module shows a notice, its operations are refused, the data is kept as it is. A card, a week box or a detail that throws while drawing is replaced by a notice or left empty. Hooks that throw contribute nothing, and a module whose prompt text throws is left out of the prompt.
- **One folder per module** in `apps/web/modules/<id>`: `module.ts`, `messages.ts`, `views.tsx` and tests. The four built-in modules are Agenda, Meals, Training and Notes. Notes holds what used to be the day note.
- **Colour is not written in views.** A module names a tone; the host sets it on the element that wraps the module and views use `text-tone`, `bg-tone`. The three category colours became a palette of seven tones; a script checks on every build that each one reads as text and as a fill in both themes and that every pair stays apart with red-green colour blindness.

### Moving stored plans

- Nothing stored is rewritten. A plan at version 1 is upgraded in memory when it is read and saved as version 2 with the person's next change.
- A version 1 plan is upgraded whole or not at all. One that does not validate is reported as unreadable instead of being upgraded day by day, which would drop the days that fail and make the loss permanent with the next save.
- Postgres accepts both versions, and `save_plan` refuses to replace a document with an older `schemaVersion` (SQLSTATE `PW001`). An app from before modules, left open in a tab, fails safely instead of overwriting a version 2 plan with what it could read of it.
- The assistant endpoint asks callers which document version they read (`docVersion`). An app from before modules does not say, and is turned away before anything is saved: its plan stays on screen and in the database as version 1 until the tab reloads. In the other direction, an app that receives an answer it cannot read fetches the stored plan again and asks for a reload; it never shows a plan it did not read.
- What an old tab cannot be helped with: once another device has saved the plan as version 2, the old tab shows it as empty until it reloads. Its saves are refused, so nothing is lost.
- The version 1 reducer is kept in the repository as a test oracle. A parity test applies thousands of random version 1 operations there, one at a time, and under their old names through the modules, and requires the same data and the same receipt. One at a time because version 1 tidied a plan once per request and modules tidy after every operation; the two differ only in which new id a copied item gets when the same request added something to that day first.
- New accounts still start from a version 1 blank plan until every app has been reloaded; the app reads it as a blank document and asks which modules the person wants. A later migration switches that default and drops the version 1 schema.

## Consequences

- A new module is a folder and its entry in the two registry files. It can be used by voice, has receipts and undo, and appears in the gallery, the Day Bar and the week board without any change to those screens.
- A person chooses their modules. Nobody starts with three boxes they did not ask for.
- The database no longer knows what a meal or a workout looks like. That check moved from one JSON Schema to the kernel, which is stricter (it runs per operation) but lives in the app.
- Operation names gained their module: `workout.set` is `train.workout.set`. The old names are kept as aliases.
- One more level of indirection: screens ask the kernel what modules contribute instead of reading plan fields.
- The contract is young. Four modules have been written against it; it will change as more are, and `CONTRACT_VERSION` records which version a module was written for.
