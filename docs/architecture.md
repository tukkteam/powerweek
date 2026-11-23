# Architecture

PowerWeek is a **web-first** product. The web app is the only implementation of the product; native apps are thin shells around it (see [native-strategy.md](native-strategy.md)). This keeps one codebase, one release train and instant updates on every platform.

## The big picture

```
                         ┌──────────────────────────── Vercel (cdg1) ───────────────────────────┐
 Browser / PWA /         │  proxy.ts            language redirect, session refresh, auth gate    │
 native WebView  ───────►│  /[lang]             static landing (prerendered per language)        │
                         │  /[lang]/login       static page + client sign-in                     │
                         │  /[lang]/app/*       static app shell; data loads in the browser      │
                         │  /api/assistant      the only server logic: sentence → operations     │
                         │  /auth/*             email link callbacks                             │
                         └───────────────┬───────────────────────────────┬──────────────────────┘
                                         │ user JWT                      │ server key (never public)
                ┌────────────────────────▼──────────────┐       ┌────────▼────────────────────┐
  browser ─────►│ Supabase (eu-west-3)                   │       │ OpenAI-compatible LLM      │
  (user JWT)    │  Postgres + RLS, RPCs, pg_jsonschema   │       │ (OmniRoute gateway)        │
                │  Auth: anonymous + email OTP           │       └────────────────────────────┘
                │  Realtime: plans table                 │
                └────────────────────────────────────────┘
```

### Four rules that shape the code

1. **A plan is a document of modules.** Agenda, Meals, Training and Notes are modules; each owns its data, its operations and its views in one folder under `apps/web/modules`. Which modules are on screen, and in what order, is part of the plan. The contract a module honours is in [modules.md](modules.md).
2. **Plans only change through operations.** Manual edits and the assistant both produce `Operation[]`. The kernel (`packages/modules`) routes each one to its module, undoes any that fail, and returns the new document plus a list of `Change`s for the receipt. The result is saved with optimistic concurrency, and every version is kept in `plan_revisions`.
3. **Each module is the source of truth for its own shape.** Its zod schema validates what the assistant writes, types its views and has the last word before anything is saved. Postgres checks the envelope around the modules with `pg_jsonschema`; a drift test fails CI if the envelope's schema and the migration diverge.
4. **The server holds no user data logic it doesn't need.** Pages are static shells. The browser talks to Supabase directly with the user's JWT, and Row Level Security plus security-definer RPCs enforce access. The only server-side code is the assistant route, which exists to keep the model key secret.

## How the pieces fit

```
 apps/web/modules/<id>      one module: data, operations, strings, views
        │  registered in modules/index.ts (data side) and modules/views.tsx (views)
        ▼
 packages/modules           the kernel: read · apply · receipts · prompt · parse
        │
        ├── components/app   screens that host modules: Today, the week board, the Day Bar, the desk
        ├── api/assistant    sentence → operations → kernel → save
        └── lib/plan-api     my_plan · save_plan · undo_plan · entries
```

Screens never read a module's data directly. They ask [`modules/board.ts`](../apps/web/modules/board.ts) what the modules on screen contribute (a count, a load, spans for the timeline), and they render a module's card through a slot that gives it its colour and contains its failures. A module that throws contributes nothing; the rest of the screen keeps working.

## Request flows

### Opening the app

1. `proxy.ts` sees `/es/app`, refreshes the Supabase session cookie and redirects to `/es/login` if there is no session (an optimistic check; Postgres is the real gate).
2. The static shell renders a skeleton; `AppProvider` (client) calls `auth.getUser()`, the `my_plan()` RPC and reads `profiles`. The kernel reads the stored document: it upgrades a plan from before modules and migrates module data written by an older version.
3. It subscribes to Realtime changes on `plans` filtered to the user, so other devices' saves appear live.
4. The dated facts of the visible week (ticks, picks) load from `entries`.
5. A document with nothing on screen shows the module desk, where the person chooses what they want to organise.

### A manual edit

```
a module's editor → Operation → kernel.apply (optimistic UI) → rpc save_plan(doc, expected_version, 'manual', ops, changes)
                                                             ↳ 40001 version_conflict → reload + notice
                                                             ↳ PW001 client_outdated → "reload the page"
```

Edits are queued on the client so two saves never race each other's version. Rearranging the screen is the same flow: the desk sends one `layout.set`.

### An assistant command

```
VoiceDock → POST /api/assistant {input, lang, today}
  → getUser (JWT) → rate limit (assistant_requests)
  → my_plan() → kernel.read → buildMessages(doc, today, lang) → LLM in JSON mode
  → parseOutput (each operation validated on its own by its module)
  → kernel.apply → save_plan(..., 'assistant', input, ops, changes)
      ↳ on version conflict: reload, re-apply the same operations once
  → record operations → kernel.resolveRecords → entries
  → {doc, version, changes, rejected, dropped, reply}
```

Dictation turns speech into that `input` in the browser (`lib/voice/speech.ts`); on desktop Chromium it listens to the microphone picked in Settings ([ADR 0009](adr/0009-dictation-listens-to-our-microphone.md)). The client replaces its plan with the returned one and shows the Change Receipt. The model writes its sentence before anything is applied, so when nothing could be done the receipt says why instead of repeating it. **Undo** calls `undo_plan(version)`, which restores the previous revision only if nothing changed since, and records the revert as a new version.

## Rendering model

Next.js 16 runs with **Cache Components**. Every page is prerendered per language at build time (`generateStaticParams` in `app/[lang]/layout.tsx`). Nothing in a page reads cookies, headers or the clock during render: the clock is read in effects, and session data is read in the browser or in Route Handlers. This gives instant navigations and makes the same build usable inside native shells.

## Internationalisation

Routes are prefixed (`/es`, `/en`). `proxy.ts` sends un-prefixed paths to the language from the `pw-locale` cookie or `Accept-Language`. Dictionaries are typed TypeScript modules (`lib/i18n/dictionaries`); Spanish is the reference shape and a test fails if English drifts from it. They contain small formatting functions (plurals), so client components import them directly and only the language code crosses the server/client boundary.

## Security model

| Concern                              | Control                                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Who can read or write a plan         | RLS: owner-only `select`; writes only through `save_plan` / `undo_plan` (security definer, `auth.uid()` checks) |
| Plan integrity                       | `CHECK (plan_doc_is_valid(doc))` on the envelope and a 1 MB limit; each module's schema after every operation   |
| An old app overwriting newer data    | `save_plan` refuses a document with an older `schemaVersion` (`PW001`); the assistant asks for `docVersion`     |
| Showing a plan the app cannot read   | `kernel.read` returns nothing for it; the app reports it and never shows or saves an empty plan in its place    |
| Model key                            | Server-only env var; the browser never sees it                                                                  |
| Abuse of the assistant               | Per-user limits per minute and per day (lower for anonymous users), input ≤ 600 characters                      |
| Cross-site requests to the assistant | JSON body only and an `Origin` host check                                                                       |
| Account deletion                     | `delete_my_account()` cascades every user table                                                                 |
| Open redirects after email links     | `safeNextPath` only allows `/es/app…` and `/en/app…`                                                            |

## Why not …

- **…a JSON blob in `localStorage`?** The prototype did that. No sync, no history, no multi-device. Postgres plus revisions gives all three.
- **…let the LLM return the whole week?** Rewriting the whole document invites silent data loss. Operations are small, reviewable, auditable and reversible.
- **…server components that fetch the plan?** With Cache Components that would push every app page behind request-time rendering. Client fetching with RLS keeps pages static, works offline-ready and is exactly what a native shell needs.

Decisions are recorded in [docs/adr](adr/).
