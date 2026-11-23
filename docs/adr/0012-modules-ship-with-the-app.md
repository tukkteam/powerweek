# 0012 · Modules ship with the app; a catalogue comes before a marketplace

Date: 2026-11-23 · Status: Proposed

## Context

The aim is that people outside the team write modules, and that a person can browse and add them. That needs three things that do not exist yet: a way to add a module without redeploying the app, a way to run code nobody on the team wrote, and a reason for outsiders to bother. Building a marketplace first would mean building all three before the contract has been tried by anyone else.

## Decision

Accepted now:

- **Modules ship with the app.** A module is added by a pull request to this repository and is reviewed like any other code. Its code runs with the same trust as the app, which is why it is reviewed.
- **The contract stays free of PowerWeek.** `packages/modules` imports nothing from the app, so it can be published on its own when there is a second consumer or a first outside contributor.

Proposed, in this order, each step only once the one before it has been used:

1. **A catalogue.** A page generated from the manifests of the modules in the repository (`manifestOf`): name, description, author, operations. It costs nothing to keep true and it is the first thing a contributor looks for.
2. **Modules as data.** Most ways of organising a week are one of a few shapes: a list of things at a time, a routine of steps, a set of slots with options, a tracker of something counted each day. A module of one of those shapes can be a definition (JSON: its name, its fields, its shape) drawn by views the app already has. A definition runs no code, so it can be added at run time, shared, and written by the assistant from a sentence ("I want to track the pages I read, 20 a day").
3. **Code from outside, in a sandbox.** Modules that need their own drawing or logic run isolated (a frame or a worker speaking the same contract through messages), signed and reviewed, with what they may reach declared in the manifest.
4. **A marketplace**, when there is real demand from third parties.

## Consequences

- The first outside contribution is a pull request, which is slow but safe, and it tests whether the contract and its guide are good enough.
- Step 2 is the one that matters most for people who will never write code: it turns "add a module" into something that can be said.
- Three decisions belong to the owners and are open: the name and npm scope under which the contract is published (only `@tukkteam/*` exists today), its licence and trademark terms, and whether modules or the marketplace are ever paid.
