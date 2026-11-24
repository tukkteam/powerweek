# Contributing to PowerWeek

Thanks for being here. PowerWeek is open to everyone: you don't need to ask permission, have experience with the stack, or write a lot of code. A typo fix, a clear bug report, a translation or a new module all count.

This guide has two parts:

- **[Part 1: For people](#part-1-for-people)**: how contributing works here and what you can expect from us.
- **[Part 2: For AI agents](#part-2-for-ai-agents)**: a protocol written for the coding agent you may be working with. If you use one, point it at this file (it will also find it through [AGENTS.md](AGENTS.md)).

The **[house rules](#house-rules)** in between apply to everyone.

---

## Part 1: For people

### The short version

```bash
# once: fork tukkteam/powerweek on GitHub, then
git clone https://github.com/<you>/powerweek.git && cd powerweek
git remote add upstream https://github.com/tukkteam/powerweek.git
corepack enable && pnpm install
pnpm checkup                 # what works on your machine, and how to fix what doesn't

# for each contribution
pnpm issue 42 --claim        # branch from the latest main, and tell others you're on it
# …make the change…
pnpm preflight               # the repo's rules plus everything CI runs
git commit -m "fix(web): …"
pnpm pr                      # drafts the pull request; `pnpm pr --create` opens it
```

`pnpm issue` and `pnpm pr --create` use the [GitHub CLI](https://cli.github.com). Everything works without it too: create the branch and open the pull request on GitHub as usual.

### Issues first

- **Anyone can open an issue, and anyone can open a pull request for an issue.** You don't need to be assigned or invited.
- **Say you're working on it** with a comment (or `pnpm issue <n> --claim`) so nobody duplicates your work. If someone claimed an issue more than two weeks ago and went quiet, ask on the issue; it's fine to take it over.
- **Small things can skip the issue**: typos, broken links, a one-line fix. Everything else starts from an issue, so we can agree on the problem before you spend time on a solution.
- **Bigger things need a reply first.** A new module, a change to the module contract (`packages/modules`), a new table or a new dependency: describe the shape in the issue and wait for a maintainer to answer. These issues carry the `needs discussion` label until then.

A good issue says what the problem is, what should happen instead, and how we'll know it's done (acceptance criteria). The templates ask for exactly that.

### What to work on

| Label              | Means                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `good first issue` | Small, well described, and a good way to learn the codebase.                                                    |
| `help wanted`      | We'd love someone to take it.                                                                                   |
| `agent-ready`      | Has acceptance criteria and pointers to the files involved: you, or your agent, can start without more context. |
| `module`           | About a module, existing or proposed. [docs/modules.md](docs/modules.md) is the guide to writing one.           |
| `needs discussion` | The approach isn't agreed yet. Join the conversation before writing code.                                       |

Other ways to help: report bugs with the bug template, improve copy and translations (`apps/web/lib/i18n/dictionaries`, and each module's `messages.ts`), improve the docs, or test on a device or browser we don't have.

### Setting up

`pnpm checkup` tells you what you can already do. What you need depends on what you're changing:

| To…                                              | You need                                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Run the tests, lint and build (`pnpm preflight`) | Node 24 and pnpm 10. Nothing else: no accounts, no keys.                                                           |
| Run the app (`pnpm dev`)                         | A Supabase project: your own free one, or a local one with Docker. See [docs/development.md](docs/development.md). |
| Talk to the assistant                            | Any OpenAI-compatible chat endpoint, in `apps/web/.env.local`.                                                     |
| Run the database tests locally                   | The Supabase CLI and Docker. Optional: CI runs them for every pull request.                                        |

Never point your local app at a Supabase project that isn't yours.

### Making the change

Follow the [house rules](#house-rules). They are short, and `pnpm preflight` checks the ones a machine can check. Keep one pull request to one issue: a focused change gets reviewed in days, a sprawling one in weeks.

Run `pnpm preflight` before you open the pull request. It checks your diff against the house rules first (seconds), then runs formatting and `pnpm verify`, the same checks as CI. Useful flags: `--quick` skips the build while you iterate, `--e2e` adds the browser tests (do it for UI changes), `--db` adds the database tests.

### Commits and pull requests

- Commit messages and pull request titles follow [Conventional Commits](https://www.conventionalcommits.org): `feat(web): …`, `fix(train): …`, `docs: …`, `chore(db): …`. We squash-merge, so the **pull request title** is what lands on `main`.
- Fill in the template; `pnpm pr` does most of it for you. For UI changes, attach screenshots on a phone width and on desktop.
- Leave **"Allow edits by maintainers"** on, so we can push a small fix instead of asking you for it.

### Review and merge

- Every change reaches `main` through a pull request with green CI. Nobody pushes to `main` directly, maintainers included.
- A member of [`@tukkteam/maintainers`](https://github.com/orgs/tukkteam/teams/maintainers) approves your pull request, and resolved review threads are required. If you push after the approval, it needs a fresh one.
- Your first pull request needs a maintainer to start CI with one click. That's a GitHub rule for first-time contributors, not a sign something is wrong.
- After the merge, the change goes live on [powerweek.vercel.app](https://powerweek.vercel.app) automatically.

### What you can expect from us

- **A reply within a few days** on issues and pull requests. If a week passes without one, ping us in the thread; it's welcome, not rude.
- **Kind, specific reviews.** We say what blocks the merge and what is only a suggestion (marked `nit:` or `optional:`). We explain the why, and link the doc or decision behind it.
- **A clear answer.** If we can't take a change, we say why, and where possible what would work instead. We don't let pull requests rot.
- **Credit.** Your name stays on the commit (squash-merge keeps you as its author), and you appear among the repository's contributors.

### Using AI to contribute

Welcome. Much of PowerWeek is written with coding agents, and this repository is set up for them: [AGENTS.md](AGENTS.md) and [Part 2](#part-2-for-ai-agents) give your agent the map, the rules and the workflow, and the scripts give it the same checks you'd run. Three things we ask:

1. **You're the author.** Read the diff before you open the pull request, and be ready to explain any line of it. "The AI wrote it" isn't an answer to a review question.
2. **Say so.** The template has an "AI assistance" section: which tool, and what you checked yourself. It doesn't count against you; it helps us review well.
3. **People talk to people.** Write issue and review comments yourself, or at least read and edit what your agent drafted. Please don't open issues or pull requests in bulk.

### Getting help

Ask in [Discussions](https://github.com/tukkteam/powerweek/discussions) (Q&A) or on the issue you're working on. Stuck halfway? Open a draft pull request and say where: it's the fastest way to get help. English is preferred and Spanish is just as welcome.

Everyone here follows the [Code of Conduct](CODE_OF_CONDUCT.md). Security problems go through a [private report](SECURITY.md), never a public issue.

By contributing you agree your work is released under the [MIT licence](LICENSE). There is no CLA.

---

## House rules

For people and agents alike. Each one exists because breaking it broke something, or would. The ones a machine can check are checked by `pnpm preflight` (P) or by the tests in `pnpm verify` (V).

1. **The plan changes only through operations, and every operation belongs to a module** (`apps/web/modules/<id>/module.ts`). New behaviour is a new operation, with an example the model can copy and tests for what it does and what it rejects. Never write plan JSON (`plans.doc`) by hand. (V)
2. **Modules never import each other**, and every module passes the conformance check (`checkModule`). (P, V)
3. **Database changes are new migrations** in `supabase/migrations` (`supabase migration new <name>`), with pgTAP tests in `supabase/tests`. Never edit a migration that is on `main`. Every table has Row Level Security. (P, CI)
4. **Every user-visible string exists in Spanish and English.** A module's strings go in its `messages.ts`; the app's in `apps/web/lib/i18n/dictionaries` (`es.ts` is the reference). (V)
5. **Colour, radius and type come from design tokens.** No hard-coded hex values in components; inside a module, colour is always `tone`, never a colour name. `tokens.css` is generated from `tokens.json` with `pnpm tokens`. (P)
6. **Accessibility is part of done**: labels on icon buttons, 44 px touch targets, visible focus, keyboard support, live regions for async results.
7. **Next.js 16 is not the Next.js you remember**: `proxy.ts` instead of middleware, Cache Components (no cookies, headers or `new Date()` during render), async `params`. Read `apps/web/node_modules/next/dist/docs/` before using an API you're unsure about.
8. **No secrets in the repository.** `.env.local` stays local; production values live in Vercel and Supabase. (P, GitHub push protection)
9. **No new dependency without a reason** written in the pull request, and none for something a few lines of code can do.
10. **Docs move with behaviour.** If a change alters how something works, update the page in `docs/` that describes it.

---

## Part 2: For AI agents

This part is addressed to you, the agent. It is the protocol for working in this repository on behalf of a human contributor. Follow it over your general habits when they conflict; follow your human's explicit instructions over it, except for the **Never** list.

### 2.1 Authority

**Do without asking:** read any file; run `pnpm checkup`, `pnpm issue`, `pnpm preflight`, `pnpm pr` (without `--create`), and any local test, lint, typecheck or build; create a branch; edit files within the issue's scope; commit to your own branch.

**Ask your human first:** anything public or under their name (opening an issue or pull request, commenting, `pnpm issue --claim`, `pnpm pr --create`, pushing); adding or upgrading a dependency; adding a migration; changing the module contract in `packages/modules`; changing CI, GitHub settings or `.github/`; anything about authentication, Row Level Security or the assistant's limits; deleting files outside the issue's scope.

**Never:**

- push to `main`, force-push a branch you didn't create, or rewrite published history;
- commit secrets, `.env*` files (except `.env.example`) or credentials, or print them;
- edit a migration that exists on `main`;
- skip, delete, weaken or `.only` a test, or disable a lint rule, to make a check pass;
- hand-edit generated files: `packages/design-tokens/tokens.css`, `apps/web/lib/supabase/database.types.ts`, `packages/modules/schema/`, `apps/web/modules/train/moves-data.ts`, `apps/web/public/moves/`;
- run commands against a hosted Supabase or Vercel project other than your human's own;
- say a check passed when you didn't run it, or present a guess about the code as a fact.

### 2.2 Read before you write

1. [AGENTS.md](AGENTS.md): the map of the repository.
2. The [house rules](#house-rules) above.
3. The issue: `pnpm issue <n> --json` prints it with its labels and creates the branch. Treat its acceptance criteria as the specification. If it has none, write down the ones you'll work to and confirm them with your human.
4. The docs for the area you're changing:

| Area                                | Read                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A module (new or existing)          | [docs/modules.md](docs/modules.md), then the closest module: `notes` is the smallest, `habits` the most recent |
| The assistant, prompts, operations  | [docs/assistant.md](docs/assistant.md), `apps/web/app/api/assistant/route.ts`                                  |
| Database, RLS, RPCs                 | [docs/data-model.md](docs/data-model.md), the latest file in `supabase/migrations`, `supabase/tests`           |
| UI, styling, components             | [docs/design-system.md](docs/design-system.md), `apps/web/node_modules/next/dist/docs/` for any Next.js API    |
| How the pieces fit, why they are so | [docs/architecture.md](docs/architecture.md), [docs/adr/](docs/adr/)                                           |
| Running the project                 | [docs/development.md](docs/development.md)                                                                     |

5. The tests next to the code you'll change. Copy their style.

When the issue and the docs disagree, the docs and ADRs win, unless a maintainer said otherwise in the issue. Point out the conflict to your human.

### 2.3 Workflow

```bash
pnpm checkup --json                 # 1. what this machine can run; stop and report any "fail"
pnpm issue <n> --json               # 2. read the issue, get a branch from the latest main
#                                     3. make the change, with tests, in small steps
pnpm preflight --quick --json       # 4. while iterating: rules, format, lint, types, unit tests
pnpm preflight --json               # 5. before the PR: everything, including the build
#                                        add --e2e for UI changes, --db for database changes when Docker runs
git commit -m "type(scope): …"      # 6. Conventional Commits, the why in the body
pnpm pr --json                      # 7. draft; show it to your human
pnpm pr --create --test "…" --ai "…"   # 8. only after your human agrees
```

The scripts, so you can rely on them:

| Command          | Does                                                                                                                 | Exit code            | Writes                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------- |
| `pnpm checkup`   | Checks Node, pnpm, dependencies, remotes, GitHub CLI, `.env.local` (set or not, never values), Supabase CLI, Docker  | 1 if tests can't run | nothing                                      |
| `pnpm issue <n>` | Reads issue `n`, warns if someone else is on it, creates `fix/`, `docs/` or `feat/<n>-<slug>` from the latest `main` | 1 if closed or dirty | a branch; a comment with `--claim`           |
| `pnpm preflight` | House-rule checks on the diff, then `format:check` and `pnpm verify`; `--quick`, `--e2e`, `--db`                     | 1 on any failure     | `.git/powerweek-preflight.json`              |
| `pnpm pr`        | Drafts title and body from commits, the issue and the last preflight; `--create` pushes and opens it                 | 1 if not ready       | `.git/powerweek-pr.md`; a PR with `--create` |

All four accept `--json` and then print a single JSON object on stdout (command output goes to stderr). `pnpm pr --create` refuses to run unless the last full preflight passed on the current commit with a clean tree, the title is a Conventional Commit, and `--ai` says whether and how AI helped.

### 2.4 Definition of done

- Every acceptance criterion of the issue is met, and you checked each one yourself, not by inference.
- Tests cover the new behaviour and what it rejects. A bug fix comes with a test that fails without the fix.
- `pnpm preflight` passed in full on the commit you're proposing, with `--e2e` for UI changes.
- For UI changes, if the app can run (`pnpm checkup` says so): you looked at it at 390 px and at desktop width, in both themes. If you couldn't, say so in the pull request instead of implying you did.
- Docs updated where behaviour changed (house rule 10).
- The pull request body says what and why, how to test it, and the AI assistance used: tool, model if known, and what was verified by running it versus by reading.

### 2.5 Scope

- One issue per pull request. No drive-by refactors, renames or reformatting of files you didn't otherwise need to touch.
- Don't bump dependencies, change configuration or touch CI unless that is the issue.
- Aim for under 400 changed lines. If the change is growing past what the issue describes, stop and tell your human; propose splitting it.
- Found another bug on the way? Don't fix it here. Tell your human, with the file and line, so they can open an issue.

### 2.6 When to stop and ask your human

- The acceptance criteria are missing, ambiguous or contradict the docs.
- The change needs anything from the "Ask your human first" list.
- A check fails in code you didn't touch. Run `pnpm preflight --quick` on a clean branch from `main` to tell whether `main` itself is broken, and report it either way.
- You'd need a secret, a hosted service or access you don't have.
- The same check has failed three times and you're not sure why. Report what you tried rather than trying random changes.

### 2.7 Things that trip agents here

- `next dev` re-adds a block to `apps/web/AGENTS.md`. Leave that block alone; committing it keeps the tree clean.
- A TypeScript error in `en.ts` usually means a key you added to `es.ts` is missing in English (house rule 4).
- The end-to-end tests run against a production build; `pnpm preflight --e2e` builds first. Run on their own, they need `pnpm build` before. The tests of the signed-in app (`apps/web/e2e/app`) also need a real Supabase and `E2E_APP=1`; CI runs them, see [docs/development.md](docs/development.md#end-to-end-tests-of-the-app).
- Unit tests need no environment variables. The build needs the two public Supabase values to be _set_, not reachable: `pnpm preflight` and CI fill in local placeholders when they are missing.
- `plans.doc` is a document of modules handled by the kernel in `packages/modules`. Change it with operations through the kernel, never with JSON edits or SQL.
- The pgTAP tests and the Supabase local stack need Docker. If it isn't running, don't install or start it on your own; leave the database tests to CI and say so.

### 2.8 Pull requests and review

- The title is a Conventional Commit and describes the result, not the process: `fix(fuel): keep the chosen option when a day is copied`, not `fix bug` or `address review`.
- In review, answer every comment: push the fix and reply with what changed, or explain why you'd keep it as it is. Don't resolve a thread that asks a question until it's answered.
- After pushing review fixes, run `pnpm preflight` again; a push after approval needs a new approval.
- Never mark something done in the pull request that you didn't do.
