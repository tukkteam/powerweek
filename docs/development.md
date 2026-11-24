# Development

## Prerequisites

- Node.js 24 (`.node-version`)
- pnpm 10: `corepack enable` (the repo pins `pnpm@10.34.9` in `packageManager`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) 3+, and Docker if you want a local database
- An OpenAI-compatible model endpoint for the assistant (optional: everything else works without it)

## Setup

Fork the repository on GitHub, then:

```bash
git clone https://github.com/<you>/powerweek.git && cd powerweek
git remote add upstream https://github.com/tukkteam/powerweek.git
corepack enable
pnpm install
pnpm checkup                 # what works on this machine, and how to fix what doesn't
```

That is enough for `pnpm preflight`: the unit tests need no environment variables, and for the build it fills in local placeholders when no Supabase values are set (`pnpm verify` on its own needs them in `.env.local`). To run the app, copy the example environment:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Fill `apps/web/.env.local`:

| Variable                                                           | Where to get it                                                               |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase project (Settings → API) or `supabase status` for a local stack |
| `NEXT_PUBLIC_SITE_URL`                                             | `http://localhost:3000`                                                       |
| `OMNIROUTE_BASE_URL`, `OMNIROUTE_API_KEY`, `OMNIROUTE_MODEL`       | Any OpenAI-compatible provider                                                |

### Option A: your own Supabase project

```bash
supabase login
supabase link --project-ref <your-ref>
pnpm db:push                 # applies supabase/migrations
supabase config push         # auth settings from supabase/config.toml (review the diff it shows)
```

Enable anonymous sign-ins in Authentication → Providers if you skip `config push`.

### Option B: local stack (Docker)

```bash
supabase start               # Postgres, Auth, Realtime on localhost
supabase status              # copy API URL and publishable key into .env.local
supabase test db             # run the pgTAP tests
```

## Everyday commands

| Command                              | Purpose                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `pnpm dev`                           | Next.js dev server on http://localhost:3000                                   |
| `pnpm checkup`                       | Checks your machine and says what you can run                                 |
| `pnpm issue <n>`                     | Reads issue `n` and creates a branch for it from the latest `main`            |
| `pnpm preflight`                     | House rules on your diff, then formatting and `pnpm verify`                   |
| `pnpm pr`                            | Drafts the pull request; `--create` pushes and opens it                       |
| `pnpm verify`                        | What CI runs: tokens check, lint, typecheck, unit tests and production build  |
| `pnpm test`                          | Unit tests (the kernel, every module, parity with old plans, prompt, i18n)    |
| `pnpm --filter @powerweek/web e2e`   | Playwright tests of the public pages (build first with `pnpm build`)          |
| `pnpm tokens`                        | Regenerate `tokens.css` and `motion.ts` from `tokens.json`                    |
| `pnpm moves`                         | Re-import and redraw the exercise illustrations and catalogue (needs network) |
| `pnpm --filter @powerweek/web icons` | Regenerate app icons from the mark                                            |
| `pnpm db:types`                      | Regenerate `database.types.ts` from the linked project                        |

## End-to-end tests of the app

The tests in `apps/web/e2e/app` use the app signed in: each one starts a new anonymous account, as anyone trying PowerWeek does, and deletes it at the end. They need the build to point at a real Supabase with the migrations applied, so they only run with `E2E_APP=1`. CI runs them for every pull request against a local stack (the "App e2e" job). On your machine, with Docker:

```bash
supabase start                       # then put its API URL and publishable key in apps/web/.env.local
pnpm build
E2E_APP=1 pnpm --filter @powerweek/web e2e e2e/app
```

Anonymous sign-ins are limited to 30 an hour per IP (`supabase/config.toml`), and each test uses one per browser project. Run them against your own project only, never against the production one.

## Conventions

- **Next.js 16 is not the Next.js you may remember.** Read the bundled docs in `apps/web/node_modules/next/dist/docs/` before using an API (`proxy.ts` replaces middleware; Cache Components forbid reading cookies or the clock during render).
- Plan changes go through operations, and each operation belongs to a module (`apps/web/modules`). Don't write `plans.doc` by hand anywhere. To add or change a module, read [modules.md](modules.md).
- A module's strings live in its own `messages.ts`.
- The app's own copy lives in `apps/web/lib/i18n/dictionaries`. Add a key to `es.ts` first; TypeScript and the parity test make you add it to `en.ts`.
- Colours, radii and spacing come from tokens. Don't hard-code hex values in components; inside a module write `text-tone`, `bg-tone`, never a colour name.
- Accessibility is part of done: labels on icon buttons, 44 px targets, visible focus, live regions for async results.

## Working with worktrees

Maintainers keep one worktree per task so several changes (or agents) can progress in parallel:

```bash
git worktree add ../worktrees/<task> -b <type>/<task> origin/main
cd ../worktrees/<task> && pnpm install
```

pnpm hard-links packages from its store, so extra worktrees are cheap. Remove a worktree with `git worktree remove` once its pull request is merged.
