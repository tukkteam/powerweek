# Contributing to PowerWeek

Thanks for helping. PowerWeek is small on purpose: one web app made of modules, a package with the module contract, and a Postgres schema. This guide gets you from clone to merged pull request.

## Ways to help

- **Report a bug** with the bug template: what you did, what you expected, what happened, browser and device.
- **Suggest a feature** with the feature template. Explain the problem before the solution.
- **Improve copy or translations** in `apps/web/lib/i18n/dictionaries`.
- **Write a module.** A module is one folder: what it stores, which changes it accepts and how it draws itself. [docs/modules.md](docs/modules.md) is the contract and the guide. Open an issue with the idea first, so we can agree on its shape before you build it.
- **Pick an issue** labelled `good first issue` or `help wanted`, and comment before you start so work isn't duplicated.

## Set up

Follow [docs/development.md](docs/development.md). In short: Node 24, `corepack enable`, `pnpm install`, copy `apps/web/.env.example` to `.env.local`, and run `pnpm dev`.

## Make a change

1. Branch from `main`: `feat/…`, `fix/…`, `docs/…` or `chore/…`.
2. Keep pull requests focused: one problem per PR.
3. Follow the rules that keep the codebase coherent:
   - Plan changes are **operations** of a module (`apps/web/modules/<id>/module.ts`), with an example and tests. Never write plan JSON by hand, and never import one module from another.
   - A module must pass the conformance check (`checkModule`); it runs for every module in `pnpm test`.
   - Database changes are **new migrations** in `supabase/migrations`. Never edit one that has been applied. Update pgTAP tests in `supabase/tests`.
   - Every user-visible string goes in **both** languages: a module's in its `messages.ts`, the app's in the dictionaries (`es.ts` first; tests enforce parity).
   - Colours, radii and type come from **design tokens**; no hard-coded hex values in components. Inside a module, use `tone` classes, never a colour name.
   - Accessibility is part of done: labels for icon buttons, 44 px touch targets, visible focus, keyboard support.
   - Next.js 16 has new APIs. Read `apps/web/node_modules/next/dist/docs/` before using one you're unsure about.
4. Run `pnpm verify` (tokens, lint, typecheck, tests, build). For UI changes, also run `pnpm --filter @powerweek/web e2e` and include screenshots in the PR.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org): `feat(web): …`, `fix(core): …`, `docs: …`, `chore(db): …`. Write the _why_ in the body when it isn't obvious.

## Pull requests

Fill in the template. CI must be green. A maintainer reviews within a few days; we squash-merge. By contributing you agree your work is released under the [MIT licence](LICENSE).

## Questions

Open a discussion or an issue. Be kind: everyone here follows the [Code of Conduct](CODE_OF_CONDUCT.md).
