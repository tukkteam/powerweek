# 0006 · The design system's tokens.json is the single source for styling

Date: 2026-11-13 · Status: Accepted

## Context

The visual design was created as a Claude Design System (tokens, brand book, component specs) and a screens canvas. Design and code drift when values are copied by hand.

## Decision

`packages/design-tokens/tokens.json` is byte-for-byte the design system's `tokens.json`. A small script compiles it to `tokens.css` (one block per theme plus scales); CI fails if the generated file is stale. Tailwind maps utilities to the CSS variables, so components never hard-code colours.

## Consequences

- Changing a colour in the design system is a copy of one file plus `pnpm tokens`.
- Themes (Night, Day, System) come for free from the token blocks.
- The Tailwind radius scale follows the tokens (`rounded-sm` 8 px, `rounded-md` 14 px, `rounded-lg` 24 px), which differs from Tailwind's defaults.
