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

### Three rules that shape the code

1. **One source of truth for the plan's shape.** `packages/core` defines the plan with zod. The same schema validates assistant output, types the UI and generates the JSON Schema that Postgres enforces with `pg_jsonschema`. A drift test fails CI if they diverge.
2. **Plans only change through operations.** Manual edits and the assistant both produce `Operation[]` and run the same pure `applyOperations` reducer. The result (a new document plus a list of `Change`s for the receipt) is saved with optimistic concurrency, and every version is kept in `plan_revisions`.
3. **The server holds no user data logic it doesn't need.** Pages are static shells. The browser talks to Supabase directly with the user's JWT, and Row Level Security plus security-definer RPCs enforce access. The only server-side code is the assistant route, which exists to keep the model key secret.

## Request flows

### Opening the app

1. `proxy.ts` sees `/es/app`, refreshes the Supabase session cookie and redirects to `/es/login` if there is no session (an optimistic check; Postgres is the real gate).
2. The static shell renders a skeleton; `AppProvider` (client) calls `auth.getUser()`, the `my_plan()` RPC and reads `profiles`.
3. It subscribes to Realtime changes on `plans` filtered to the user, so other devices' saves appear live.
4. Completions for the visible week load from `completions`.

### A manual edit

```
ItemEditor → Operation → applyOperations (optimistic UI) → rpc save_plan(doc, expected_version, 'manual', ops, changes)
                                                          ↳ 40001 version_conflict → reload + notice
```

Edits are queued on the client so two saves never race each other's version.

### An assistant command

```
VoiceDock → POST /api/assistant {input, lang, today}
  → getUser (JWT) → rate limit (assistant_requests)
  → my_plan() → buildMessages(plan, today, lang) → LLM in JSON mode
  → parseAssistantOutput (forgiving per-operation zod validation)
  → applyOperations → save_plan(..., 'assistant', input, ops, changes)
      ↳ on version conflict: reload, re-apply the same operations once
  → {plan, version, changes, rejected, reply}
```

The client replaces its plan with the returned one and shows the Change Receipt. **Undo** calls `undo_plan(version)`, which restores the previous revision only if nothing changed since, and records the revert as a new version.

## Rendering model

Next.js 16 runs with **Cache Components**. Every page is prerendered per language at build time (`generateStaticParams` in `app/[lang]/layout.tsx`). Nothing in a page reads cookies, headers or the clock during render: the clock is read in effects, and session data is read in the browser or in Route Handlers. This gives instant navigations and makes the same build usable inside native shells.

## Internationalisation

Routes are prefixed (`/es`, `/en`). `proxy.ts` sends un-prefixed paths to the language from the `pw-locale` cookie or `Accept-Language`. Dictionaries are typed TypeScript modules (`lib/i18n/dictionaries`); Spanish is the reference shape and a test fails if English drifts from it. They contain small formatting functions (plurals), so client components import them directly and only the language code crosses the server/client boundary.

## Security model

| Concern                              | Control                                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Who can read or write a plan         | RLS: owner-only `select`; writes only through `save_plan` / `undo_plan` (security definer, `auth.uid()` checks) |
| Plan integrity                       | `CHECK (plan_doc_is_valid(doc))` with the generated JSON Schema                                                 |
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
