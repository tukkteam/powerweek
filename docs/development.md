# Development

## Prerequisites

- Node.js 24 (`.node-version`)
- pnpm 10: `corepack enable` (the repo pins `pnpm@10.34.9` in `packageManager`)
- [Supabase CLI](https://supabase.com/docs/guides/cli) 3+, and Docker if you want a local database
- An OpenAI-compatible model endpoint for the assistant (optional: everything else works without it)

## Setup

```bash
pnpm install
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
| `pnpm verify`                        | What CI runs: tokens check, lint, typecheck, unit tests and production build  |
| `pnpm test`                          | Unit tests (core reducer and schema, web parser, prompt, i18n and formatting) |
| `pnpm --filter @powerweek/web e2e`   | Playwright smoke tests (build first with `pnpm build`)                        |
| `pnpm tokens`                        | Regenerate `tokens.css` from `tokens.json`                                    |
| `pnpm moves`                         | Re-import the exercise illustrations and catalogue (needs network)            |
| `pnpm --filter @powerweek/web icons` | Regenerate app icons from the mark                                            |
| `pnpm db:types`                      | Regenerate `database.types.ts` from the linked project                        |

## Conventions

- **Next.js 16 is not the Next.js you may remember.** Read the bundled docs in `apps/web/node_modules/next/dist/docs/` before using an API (`proxy.ts` replaces middleware; Cache Components forbid reading cookies or the clock during render).
- Plan changes go through operations (`packages/core`). Don't write `plans.doc` by hand anywhere.
- Copy lives in `apps/web/lib/i18n/dictionaries`. Add a key to `es.ts` first; TypeScript and the parity test make you add it to `en.ts`.
- Colours, radii and spacing come from tokens. Don't hard-code hex values in components.
- Accessibility is part of done: labels on icon buttons, 44 px targets, visible focus, live regions for async results.

## Working with worktrees

Maintainers keep one worktree per task so several changes (or agents) can progress in parallel:

```bash
git worktree add ../worktrees/<task> -b <type>/<task> origin/main
cd ../worktrees/<task> && pnpm install
```

pnpm hard-links packages from its store, so extra worktrees are cheap. Remove a worktree with `git worktree remove` once its pull request is merged.
