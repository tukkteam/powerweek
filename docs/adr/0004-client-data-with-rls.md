# 0004 · Static pages; the browser reads and writes Supabase under RLS

Date: 2026-11-13 · Status: Accepted

## Context

Next.js 16 with Cache Components prerenders pages unless they read request data, and reading cookies outside `<Suspense>` is a build error. The app is highly interactive (voice, optimistic edits, realtime) and must also run inside native WebViews.

## Decision

All pages are static shells prerendered per language. The signed-in client uses `@supabase/ssr`'s browser client to call RPCs and tables with the user's JWT; Row Level Security and security-definer functions are the authorisation layer. `proxy.ts` refreshes the session cookie and performs an optimistic redirect for `/[lang]/app`. Server code is limited to the assistant route (to keep the model key secret) and the auth callbacks.

## Consequences

- Instant navigations and cheap hosting; the same bundle works in native shells.
- A brief skeleton on first load while data arrives.
- Database policies must be right: they are tested with pgTAP (`supabase/tests`).
