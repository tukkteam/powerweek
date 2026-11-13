# 0007 · pnpm workspaces monorepo: apps and shared packages

Date: 2026-11-13 · Status: Accepted

## Context

The web app, the domain model and the design tokens evolve together, and native shells will join them. Contributors should be able to clone once and run everything.

## Decision

One repository with pnpm workspaces: `apps/*` (today `web`; later `mobile` and `desktop`) and `packages/*` (`core`, `design-tokens`). Packages export TypeScript sources and are transpiled by the consuming app. Root scripts (`pnpm verify`) run every package's checks. pnpm 10 is pinned with `packageManager`.

## Consequences

- One pull request can change the schema, the reducer, the UI and the migration together.
- No build step for internal packages; `transpilePackages` handles them in Next.js.
- A task runner (Turborepo) can be added later if build times grow.
