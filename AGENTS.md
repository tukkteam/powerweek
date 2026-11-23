# Agent guide

Instructions for AI coding agents (and humans in a hurry) working in this repository.

## Map

- `apps/web`: Next.js 16 app. Landing at `app/[lang]/page.tsx`, the app shell and the screens that host modules in `components/app`, the assistant route in `app/api/assistant/route.ts`. Exercise illustrations in `public/moves` (generated, CC BY-SA 4.0).
- `apps/web/modules`: the modules, one folder each (`agenda`, `fuel`, `train`, `notes`, `habits`): `module.ts` (data, operations, what the assistant knows), `messages.ts` (strings), `views.tsx` and tests. `index.ts` and `views.tsx` are the registry. Read [docs/modules.md](docs/modules.md) before writing or changing one.
- `packages/modules` (`@tukkteam/modules`): the module contract and the kernel that binds modules into one document: it routes operations, keeps receipts, composes the assistant prompt. It imports nothing from the app. `src/week` is the weekly layer (days, times, the day timeline); `src/testing.ts` is the conformance check.
- `packages/design-tokens`: `tokens.json` → `tokens.css`. Do not edit `tokens.css` by hand.
- `supabase`: migrations (never edit an applied one), pgTAP tests, `config.toml` (auth as code).
- `docs`: architecture, data model, assistant, native strategy, ADRs. Update them when behaviour changes.

## Rules

1. Next.js 16 differs from older versions: `proxy.ts` instead of middleware, Cache Components (no cookies, headers or `new Date()` during render), async `params`. Read `apps/web/node_modules/next/dist/docs/` before using an unfamiliar API.
2. The plan changes only through operations, and every operation belongs to a module. Add new behaviour as a new operation in that module, with an example and tests. Modules never import each other.
3. A module's strings go in its `messages.ts`, in both languages; the app's own strings go in both dictionaries (`es.ts` is the reference). Styling uses token-backed Tailwind classes; inside a module, colour is always `tone`, never a colour name.
4. Never commit secrets. `.env.local` is ignored; production values live in Vercel and Supabase.
5. Before you finish: `pnpm verify`. For UI work also run the e2e tests and look at the result in a browser.
