# 0005 · Language-prefixed routes and typed dictionaries without an i18n library

Date: 2026-11-13 · Status: Accepted

## Context

The interface ships in Spanish and English. Next.js 16 documents locale-prefixed routing with `proxy.ts` and `generateStaticParams`, which fits Cache Components. Libraries such as next-intl add middleware and runtime the app does not need for two languages.

## Decision

Routes live under `app/[lang]` (`es`, `en`), prerendered for both. `proxy.ts` redirects un-prefixed paths using the `pw-locale` cookie, then `Accept-Language`. Copy lives in typed TypeScript dictionaries; `es.ts` is the reference type and a test checks that `en.ts` has the same shape. Dictionaries may contain small functions (plurals), so client components import them directly and only the language code crosses the server/client boundary.

## Consequences

- Missing or extra keys are compile errors.
- Adding a third language means a new dictionary, a new entry in `locales` and nothing else.
- Translators edit TypeScript; acceptable for an open-source project with code-literate contributors.
