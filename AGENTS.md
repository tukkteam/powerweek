# Agent guide

For AI coding agents (and humans in a hurry) working in this repository.

**Before your first edit, read [CONTRIBUTING.md, Part 2: For AI agents](CONTRIBUTING.md#part-2-for-ai-agents)** and the [house rules](CONTRIBUTING.md#house-rules). They say what you may do without asking, the workflow and its scripts, and when a change is done. This file is the map.

## Start

```bash
pnpm checkup --json        # what this machine can run
pnpm issue <n> --json      # the issue, and a branch for it from the latest main
pnpm preflight --json      # house rules on your diff, then everything CI runs
pnpm pr --json             # the pull request draft; --create only after your human agrees
```

## Map

- `apps/web`: Next.js 16 app. Landing at `app/[lang]/page.tsx`, the app shell and the screens that host modules in `components/app`, the assistant route in `app/api/assistant/route.ts`. Exercise illustrations in `public/moves` (generated, CC BY-SA 4.0).
- `apps/web/modules`: the modules, one folder each (`agenda`, `fuel`, `train`, `notes`, `habits`): `module.ts` (data, operations, what the assistant knows), `messages.ts` (strings), `views.tsx` and tests. `index.ts` and `views.tsx` are the registry; `test-kit.ts` has the test helpers. Read [docs/modules.md](docs/modules.md) before writing or changing one.
- `packages/modules` (`@tukkteam/modules`): the module contract and the kernel that binds modules into one document: it routes operations, keeps receipts, composes the assistant prompt. It imports nothing from the app. `src/week` is the weekly layer (days, times, the day timeline); `src/testing.ts` is the conformance check. Changing it changes the contract: ask first.
- `packages/design-tokens`: `tokens.json` → `tokens.css` and `motion.ts` (generated with `pnpm tokens`). The app reads motion through `apps/web/lib/motion.ts`.
- `supabase`: migrations (append-only), pgTAP tests, `config.toml` (auth as code).
- `scripts/contrib`: the contributor scripts above. `scripts/moves.mjs` regenerates the exercise library.
- `docs`: architecture, modules, data model, assistant, design system, development, ADRs. Update them when behaviour changes.

## Rules in one line each

The full text, and why, is in the [house rules](CONTRIBUTING.md#house-rules).

1. The plan changes only through module operations, with examples and tests.
2. Modules never import each other and pass `checkModule`.
3. Database changes are new migrations with pgTAP tests; never edit one on `main`.
4. Every string in Spanish and English (`es.ts` is the reference; modules use `messages.ts`).
5. Colours and motion from tokens; inside a module, `tone`.
6. Accessibility is part of done.
7. Next.js 16: read `apps/web/node_modules/next/dist/docs/` before an unfamiliar API.
8. No secrets in the repository.
9. No dependency without a written reason.
10. Docs move with behaviour.

Before you finish: `pnpm preflight` (add `--e2e` for UI work) and look at the result in a browser when the app can run.
