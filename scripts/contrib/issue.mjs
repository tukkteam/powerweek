#!/usr/bin/env node
// pnpm issue <number> [--claim] [--json]
// Reads an issue, checks nobody else is on it, and creates a branch for it from the latest main:
// `fix/42-short-title` for bugs, `docs/…` for documentation, `feat/…` otherwise.
// --claim also comments on the issue so others know you are working on it.

import {
  baseRef,
  c,
  finish,
  gh,
  ghReady,
  mark,
  positional,
  run,
  say,
  flag,
  tryRun,
  UPSTREAM,
  upstreamRemote,
  root,
} from "./lib.mjs";

const fail = (message, fix) => {
  say(`${mark.fail} ${message}${fix ? c.dim(`\n    → ${fix}`) : ""}`);
  finish({ ok: false, error: message, ...(fix ? { fix } : {}) }, 1);
};

const number = Number(positional()[0]);
if (!Number.isInteger(number) || number <= 0) fail("Usage: pnpm issue <number> [--claim]");
if (!ghReady())
  fail(
    "This needs the GitHub CLI, logged in",
    "Install https://cli.github.com and run `gh auth login`, or create the branch by hand (CONTRIBUTING.md)",
  );

const raw = gh([
  "issue",
  "view",
  String(number),
  "--repo",
  UPSTREAM,
  "--json",
  "number,title,state,labels,assignees,body,url,comments",
]);
if (!raw) fail(`Issue #${number} not found in ${UPSTREAM}`);
const issue = JSON.parse(raw);
const labels = issue.labels.map((l) => l.name);
if (issue.state !== "OPEN")
  fail(`Issue #${number} is ${issue.state.toLowerCase()}`, "Pick an open issue, or open a new one");

const me = gh(["api", "user", "--jq", ".login"]);
const others = issue.assignees.map((a) => a.login).filter((login) => login !== me);
const claims = issue.comments.filter(
  (cm) =>
    cm.author?.login !== me &&
    /\b(working on|i'?ll take|on it|me lo quedo|trabajando en)\b/i.test(cm.body),
);
const warnings = [];
if (others.length)
  warnings.push(`Assigned to ${others.join(", ")}. Ask on the issue before starting.`);
if (claims.length)
  warnings.push(
    `${claims.map((cm) => cm.author.login).join(", ")} said they are working on it. Ask on the issue before starting.`,
  );
if (labels.includes("needs discussion"))
  warnings.push(
    "Labelled `needs discussion`: agree on the approach in the issue before writing code.",
  );

const dirty = tryRun("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: root });
if (dirty)
  fail(
    "You have uncommitted changes",
    "Commit or stash them first, or use a new worktree (docs/development.md)",
  );

const type = labels.includes("bug")
  ? "fix"
  : labels.includes("documentation")
    ? "docs"
    : labels.includes("dependencies")
      ? "chore"
      : "feat";
const slug = issue.title
  .normalize("NFKD")
  .replace(/[̀-ͯ]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .split(" ")
  .slice(0, 5)
  .join("-");
const branch = `${type}/${number}-${slug || "work"}`;

const remote = upstreamRemote();
if (remote) run("git", ["fetch", "--quiet", remote, "main"], { cwd: root });
const base = baseRef();
const exists =
  tryRun("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { cwd: root }) !==
  null;
run("git", exists ? ["switch", branch] : ["switch", "--quiet", "--no-track", "-c", branch, base], {
  cwd: root,
});

let claimed = false;
if (flag("claim") && !others.length && !claims.length) {
  claimed =
    gh([
      "issue",
      "comment",
      String(number),
      "--repo",
      UPSTREAM,
      "--body",
      "I'm working on this. I'll link the pull request here.",
    ]) !== null;
}

say(
  `${mark.ok} ${exists ? "Switched to" : "Created"} ${c.bold(branch)} ${exists ? "" : `from ${base}`}`,
);
for (const w of warnings) say(`${mark.warn} ${w}`);
if (claimed) say(`${mark.ok} Commented on the issue that you're on it`);
say(`\n${c.bold(`#${issue.number} ${issue.title}`)}  ${c.dim(issue.url)}`);
say(labels.length ? c.dim(`labels: ${labels.join(", ")}\n`) : "");
say(issue.body?.trim() || c.dim("(no description)"));
say(c.dim(`\nNext: make the change, then \`pnpm preflight\`, then \`pnpm pr\`.`));

finish({
  ok: true,
  branch,
  created: !exists,
  base,
  claimed,
  warnings,
  issue: { number: issue.number, title: issue.title, url: issue.url, labels, body: issue.body },
});
