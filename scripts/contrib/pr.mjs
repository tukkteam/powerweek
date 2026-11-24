#!/usr/bin/env node
// pnpm pr [--create] [--draft] [--title "feat(web): …"] [--test "steps"] [--ai "tool; what you checked"] [--json]
// Drafts the pull request from your branch: title, "Closes #N", the commits, and the checklist
// filled in from your last `pnpm preflight`. Without --create it only prints the draft (and saves it
// to .git/powerweek-pr.md) so you can edit it. With --create it pushes the branch and opens the PR.

import { writeFileSync } from "node:fs";
import {
  args,
  baseRef,
  c,
  currentBranch,
  finish,
  flag,
  gh,
  ghReady,
  issueFromBranch,
  mark,
  readState,
  remoteRepo,
  root,
  run,
  say,
  statePath,
  tryRun,
  UPSTREAM,
} from "./lib.mjs";

const fail = (message, fix) => {
  say(`${mark.fail} ${message}${fix ? c.dim(`\n    → ${fix}`) : ""}`);
  finish({ ok: false, error: message, ...(fix ? { fix } : {}) }, 1);
};
const git = (...a) => run("git", a, { cwd: root });

const branch = currentBranch();
if (!branch || branch === "main")
  fail("You are on main", "Work on a branch: `pnpm issue <number>` creates one");

const base = baseRef();
const mergeBase = tryRun("git", ["merge-base", "HEAD", base], { cwd: root });
if (!mergeBase) fail(`Can't find ${base}`, "Run `pnpm checkup`");
const commits = git("log", "--reverse", "--format=%s%x1f%b%x1e", `${mergeBase}..HEAD`)
  .split("\x1e")
  .map((x) => x.trim())
  .filter(Boolean)
  .map((x) => {
    const [subject, body = ""] = x.split("\x1f");
    return { subject: subject.trim(), body: body.trim() };
  });
if (!commits.length) fail("No commits on this branch yet", "Commit your change first");

// Preflight must be current: same commit, nothing uncommitted.
const head = git("rev-parse", "HEAD");
const pre = readState("preflight.json");
const dirty = git("status", "--porcelain", "--untracked-files=no").length > 0;
const problems = [];
if (!pre) problems.push("`pnpm preflight` has not been run on this branch");
else if (pre.head !== head || pre.dirty)
  problems.push("The last `pnpm preflight` ran on a different state of the branch; run it again");
else if (!pre.ok) problems.push("The last `pnpm preflight` failed");
else if (pre.quick)
  problems.push("The last `pnpm preflight` was --quick; run it in full before opening the PR");
if (dirty) problems.push("You have uncommitted changes");

// Title: --title, else the single commit's subject, else the first commit's.
const option = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : null);
const title = option("title") ?? commits[0].subject;
const conventional =
  /^(feat|fix|docs|chore|refactor|perf|test|build|ci|style|revert)(\([a-z0-9-]+\))?!?: .+/;
if (!conventional.test(title))
  problems.push(
    `The title "${title}" is not a Conventional Commit; pass --title "type(scope): what changed"`,
  );

const issue = issueFromBranch(branch);
const touches = pre?.touches ?? {};
const passed = (id) => pre?.ok && pre.results.some((r) => r.id === id && r.level === "ok");
const box = (done, text) => `- [${done ? "x" : " "}] ${text}`;

const why = commits
  .map((cm) =>
    commits.length > 1
      ? `- **${cm.subject}**${cm.body ? `\n\n  ${cm.body.replace(/\n/g, "\n  ")}` : ""}`
      : cm.body,
  )
  .filter(Boolean)
  .join("\n");

const body = `## What and why

${why || "<!-- What changes, and what problem does it solve? -->"}

${issue ? `Closes #${issue}` : "<!-- Link the issue: Closes #123 -->"}

## How to test

${option("test") ?? "<!-- Steps a reviewer can follow. For assistant changes, the sentences to say. -->"}

${touches.ui ? "## Screenshots\n\n<!-- Mobile and desktop; both themes if colours changed. -->\n\n" : ""}## Checklist

${box(pre?.ok && !pre?.quick && pre?.head === head, "`pnpm preflight` passes (repo rules, formatting, `pnpm verify`)")}
${box(!touches.code || pre?.results?.every((r) => r.id !== "tests.missing"), "Tests cover the change, including what it should reject")}
${box(pre?.ok && !pre?.quick, "Strings in both languages (`es` and `en`; the parity tests in `pnpm verify` check it)")}
${touches.db ? box(pre?.ran?.db && passed("db.pgtap"), "Database changes are new migrations, with pgTAP tests") + "\n" : ""}${touches.ui ? box(pre?.ran?.e2e && passed("e2e"), "End-to-end tests pass (`pnpm preflight --e2e`) and screenshots are attached") + "\n" : ""}${box(touches.docs || !touches.code, "Docs updated where behaviour changed")}

## AI assistance

${option("ai") ?? '<!-- Did an AI agent write part of this? Which one, and what did you check yourself? "None" is a fine answer. -->'}
`;

const draftPath = statePath("pr.md");
writeFileSync(draftPath, body);

if (!flag("create")) {
  say(c.bold(title) + "\n");
  say(body);
  for (const p of problems) say(`${mark.warn} ${p}`);
  say(
    c.dim(`Saved to ${draftPath}. Edit it, then \`pnpm pr --create\` (or paste it into GitHub).`),
  );
  finish({ ok: true, created: false, title, body, draftPath, problems });
}

if (!option("ai"))
  problems.push(
    'Say whether an AI agent helped: --ai "None", or --ai "Claude Code; I read every line and ran the app"',
  );
if (problems.length) fail(`Not opening the PR yet:\n    - ${problems.join("\n    - ")}`);
if (!ghReady())
  fail("This needs the GitHub CLI, logged in", `Or open the PR on GitHub and paste ${draftPath}`);

const origin = remoteRepo("origin");
if (!origin) fail("No `origin` remote on GitHub");
say(c.dim(`Pushing ${branch} to origin (${origin})…`));
git("push", "--quiet", "-u", "origin", `HEAD:refs/heads/${branch}`);

const head_ = origin.toLowerCase() === UPSTREAM ? branch : `${origin.split("/")[0]}:${branch}`;
const createArgs = [
  "pr",
  "create",
  "--repo",
  UPSTREAM,
  "--base",
  "main",
  "--head",
  head_,
  "--title",
  title,
  "--body-file",
  draftPath,
];
if (flag("draft")) createArgs.push("--draft");
const url = gh(createArgs);
if (!url) fail("`gh pr create` failed", "Run it by hand to see why, or open the PR on GitHub");

say(`${mark.ok} Opened ${url}`);
say(
  c.dim(
    "A maintainer will review it. Fill in the sections left as comments (how to test, screenshots, AI assistance).",
  ),
);
finish({ ok: true, created: true, url, title });
