# Contributing to PowerWeek

Thanks for helping. PowerWeek is small on purpose: one web app, a shared domain package and a Postgres schema. This guide gets you from clone to merged pull request.

## Ways to help

- **Report a bug** with the bug template: what you did, what you expected, what happened, browser and device.
- **Suggest a feature** with the feature template. Explain the problem before the solution.
- **Improve copy or translations** in `apps/web/lib/i18n/dictionaries`.
- **Pick an issue** labelled `good first issue` or `help wanted`, and comment before you start so work isn't duplicated.

## Set up

Follow [docs/development.md](docs/development.md). In short: Node 24, `corepack enable`, `pnpm install`, copy `apps/web/.env.example` to `.env.local`, and run `pnpm dev`.

## Make a change

1. Branch from `main`: `feat/…`, `fix/…`, `docs/…` or `chore/…`.
2. Keep pull requests focused: one problem per PR.
3. Follow the rules that keep the codebase coherent:
   - Plan changes are **operations** in `packages/core`, with tests. Never write plan JSON by hand.
   - Database changes are **new migrations** in `supabase/migrations`. Never edit one that has been applied. Update pgTAP tests in `supabase/tests`.
   - Every user-visible string goes in **both** dictionaries (`es.ts` first; the parity test enforces English).
   - Colours, radii and type come from **design tokens**; no hard-coded hex values in components.
   - Accessibility is part of done: labels for icon buttons, 44 px touch targets, visible focus, keyboard support.
   - Next.js 16 has new APIs. Read `apps/web/node_modules/next/dist/docs/` before using one you're unsure about.
4. Run `pnpm verify` (tokens, lint, typecheck, tests, build). For UI changes, also run `pnpm --filter @powerweek/web e2e` and include screenshots in the PR.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org): `feat(web): …`, `fix(core): …`, `docs: …`, `chore(db): …`. Write the _why_ in the body when it isn't obvious.

## Pull requests

Fill in the template. CI must be green. A maintainer reviews within a few days; we squash-merge. By contributing you agree your work is released under the [MIT licence](LICENSE).

## Questions

Open a discussion or an issue. Be kind: everyone here follows the [Code of Conduct](CODE_OF_CONDUCT.md).
