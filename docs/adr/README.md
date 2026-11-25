# Architecture decision records

Short records of decisions that shape the codebase: the context, the decision and its consequences. Add one when a choice would surprise a new contributor. Copy the format of an existing record and number it sequentially.

| ADR                                                 | Decision                                                                | Status             |
| --------------------------------------------------- | ----------------------------------------------------------------------- | ------------------ |
| [0001](0001-web-first-native-shells.md)             | Web-first; native apps are shells around the deployed web app           | Accepted           |
| [0002](0002-plan-as-validated-jsonb-document.md)    | One weekly plan per user as a validated JSONB document with revisions   | Accepted           |
| [0003](0003-typed-operations.md)                    | Every plan change is a typed operation applied by one pure reducer      | Accepted           |
| [0004](0004-client-data-with-rls.md)                | Static pages; the browser reads and writes Supabase under RLS           | Accepted           |
| [0005](0005-prefixed-i18n-routes.md)                | Language-prefixed routes and typed dictionaries without an i18n library | Accepted           |
| [0006](0006-design-tokens-single-source.md)         | The design system's tokens.json is the single source for styling        | Accepted           |
| [0007](0007-monorepo-pnpm-workspaces.md)            | pnpm workspaces monorepo: apps and shared packages                      | Accepted           |
| [0008](0008-move-library.md)                        | Exercise illustrations from an open library that the assistant links to | Superseded by 0013 |
| [0009](0009-dictation-listens-to-our-microphone.md) | Dictation listens to a microphone the app opens (picked in Settings)    | Accepted           |
| [0010](0010-modules.md)                             | A plan is a document of modules, bound by a contract and a kernel       | Accepted           |
| [0011](0011-dated-facts.md)                         | Dated facts of every module live in one table                           | Accepted           |
| [0012](0012-modules-ship-with-the-app.md)           | Modules ship with the app; a catalogue comes before a marketplace       | Proposed           |
| [0013](0013-mannequin.md)                           | Exercises are performed by a mannequin laid out from parts              | Accepted           |
