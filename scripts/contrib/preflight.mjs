#!/usr/bin/env node
// pnpm preflight [--quick] [--e2e] [--db] [--json]
// Everything a pull request needs before review, in one command:
//   1. The repo's own rules, checked against your diff (fast, runs first).
//   2. Formatting and `pnpm verify` (tokens, lint, typecheck, unit tests, build). --quick skips the build.
//   3. --e2e runs the Playwright tests (recommended for UI changes); --db runs the pgTAP tests (needs Docker).
// The result is saved for `pnpm pr`, which uses it to fill in the checklist.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import {
  baseRef,
  c,
  currentBranch,
  finish,
  flag,
  inRoot,
  mark,
  readText,
  root,
  run,
  say,
  stream,
  tryRun,
  writeState,
} from "./lib.mjs";

const results = [];
const add = (id, level, message, detail) =>
  results.push({ id, level, message, ...(detail ? { detail } : {}) });
const git = (...a) => run("git", a, { cwd: root, maxBuffer: 64 * 1024 * 1024 });

// ── What changed ────────────────────────────────────────────────────────────────────────────
const base = baseRef();
const mergeBase = tryRun("git", ["merge-base", "HEAD", base], { cwd: root });
if (!mergeBase) {
  say(`${mark.fail} Can't find ${base}. Run \`pnpm checkup\` to check your remotes.`);
  finish({ ok: false, error: `no merge base with ${base}` }, 1);
}

const changes = git("diff", "--name-status", "--find-renames", mergeBase)
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [status, ...paths] = line.split("\t");
    return { status: status[0], path: paths.at(-1), from: paths.length > 1 ? paths[0] : undefined };
  });
for (const path of git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean)) {
  changes.push({ status: "A", path, untracked: true });
}
const paths = changes.map((ch) => ch.path);
const dirty = git("status", "--porcelain").length > 0;

/** Lines your change adds, per file (tracked diff plus untracked files). */
const added = new Map();
let file = null;
for (const line of git("diff", "-U0", "--no-color", mergeBase).split("\n")) {
  if (line.startsWith("+++ ")) file = line.startsWith("+++ b/") ? line.slice(6) : null;
  else if (file && line.startsWith("+") && !line.startsWith("+++"))
    added.set(file, [...(added.get(file) ?? []), line.slice(1)]);
}
for (const ch of changes.filter((x) => x.untracked)) {
  const full = inRoot(ch.path);
  if (existsSync(full) && statSync(full).size < 1_000_000)
    added.set(ch.path, readFileSync(full, "utf8").split("\n"));
}
const stat = git("diff", "--numstat", mergeBase)
  .split("\n")
  .filter(Boolean)
  .map((l) => l.split("\t"))
  .filter(([, , p]) => p !== "pnpm-lock.yaml")
  .reduce((sum, [a, d]) => sum + (Number(a) || 0) + (Number(d) || 0), 0);

say(
  c.bold(`PowerWeek preflight`) +
    c.dim(`  ${currentBranch() || "HEAD"} vs ${base}, ${paths.length} files changed\n`),
);
if (!paths.length) {
  say(`${mark.warn} Nothing changed compared with ${base}.`);
  finish({ ok: true, changed: [], results }, 0);
}

// ── 1. Repo rules ───────────────────────────────────────────────────────────────────────────
const isTest = (p) => /\.test\.tsx?$|(^|\/)e2e\/|(^|\/)supabase\/tests\//.test(p);
const isCode = (p) =>
  /^(apps\/web\/(app|components|lib|modules)|packages\/[^/]+\/src)\/.*\.(ts|tsx)$/.test(p) &&
  !isTest(p);
const moduleIds = readdirSync(inRoot("apps/web/modules"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(inRoot("apps/web/modules", d.name, "module.ts")))
  .map((d) => d.name);

// Secrets and env files
const envFiles = paths.filter(
  (p) => /(^|\/)\.env(\.[^/]+)?$/.test(p) && !p.endsWith(".env.example"),
);
if (envFiles.length) add("secrets.env-file", "fail", "An env file is part of the change", envFiles);
const secretPattern =
  /(sk-[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
const leaks = [...added]
  .filter(([p, lines]) => !p.endsWith(".env.example") && lines.some((l) => secretPattern.test(l)))
  .map(([p]) => p);
if (leaks.length)
  add("secrets.value", "fail", "Something that looks like a key or token was added", leaks);
if (!envFiles.length && !leaks.length) add("secrets", "ok", "No secrets or env files");

// Migrations: append-only, ordered, with tests
const migrations = changes.filter(
  (ch) => ch.path.startsWith("supabase/migrations/") || ch.from?.startsWith("supabase/migrations/"),
);
const edited = migrations.filter((ch) => ch.status !== "A");
if (edited.length)
  add(
    "db.migration-edited",
    "fail",
    "An existing migration was changed. Applied migrations are never edited: add a new one instead.",
    edited.map((ch) => ch.from ?? ch.path),
  );
const newMigrations = migrations.filter((ch) => ch.status === "A").map((ch) => basename(ch.path));
if (newMigrations.length) {
  const onBase = git("ls-tree", "--name-only", `${mergeBase}:supabase/migrations`)
    .split("\n")
    .filter(Boolean)
    .sort();
  const badName = newMigrations.filter((n) => !/^\d{14}_[a-z0-9_]+\.sql$/.test(n));
  const tooOld = newMigrations.filter((n) => n < (onBase.at(-1) ?? ""));
  if (badName.length)
    add(
      "db.migration-name",
      "fail",
      "Migration names are `YYYYMMDDHHMMSS_snake_case.sql` (use `supabase migration new <name>`)",
      badName,
    );
  if (tooOld.length)
    add(
      "db.migration-order",
      "fail",
      `A new migration sorts before the latest one on main (${onBase.at(-1)}); give it a newer timestamp`,
      tooOld,
    );
  if (!paths.some((p) => p.startsWith("supabase/tests/")))
    add("db.tests", "warn", "New migration without a pgTAP test change in supabase/tests");
  if (!badName.length && !tooOld.length)
    add(
      "db.migration",
      "ok",
      `New migration${newMigrations.length > 1 ? "s" : ""}: ${newMigrations.join(", ")}`,
    );
}

// Modules never import each other
const crossImports = [];
for (const [p, lines] of added) {
  const own = p.match(/^apps\/web\/modules\/([^/]+)\//)?.[1];
  if (!own || !moduleIds.includes(own)) continue;
  for (const l of lines) {
    const target = l.match(/from\s+["'](?:\.\.\/|@\/modules\/)([^/"']+)\//)?.[1];
    if (target && target !== own && moduleIds.includes(target))
      crossImports.push(`${p} imports ${target}`);
  }
}
if (crossImports.length)
  add(
    "modules.cross-import",
    "fail",
    "A module imports another module. Modules never import each other (docs/modules.md).",
    crossImports,
  );

const newModules = moduleIds.filter((id) =>
  changes.some((ch) => ch.status === "A" && ch.path === `apps/web/modules/${id}/module.ts`),
);
if (newModules.length)
  add(
    "modules.new",
    "info",
    `New module: ${newModules.join(", ")}. Go through the checklist in docs/modules.md#checklist-for-a-pull-request.`,
  );

// Colour comes from tokens
const hexPattern = /["'`(\s:]#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const hex = [...added]
  .filter(([p]) => /^apps\/web\/.*\.(tsx?|css)$/.test(p) && !isTest(p))
  .filter(([, lines]) => lines.some((l) => hexPattern.test(l) && !/^\s*(\/\/|\*)/.test(l)))
  .map(([p]) => p);
if (hex.length)
  add(
    "design.hex",
    "warn",
    "Hard-coded hex colours added. Use token classes (inside a module, `tone`).",
    hex,
  );
if (
  paths.includes("packages/design-tokens/tokens.css") &&
  !paths.includes("packages/design-tokens/tokens.json")
) {
  add(
    "design.tokens-css",
    "fail",
    "tokens.css is generated: edit tokens.json and run `pnpm tokens`",
  );
}

// Tests and docs travel with behaviour
const code = paths.filter(isCode);
if (code.length && !paths.some(isTest))
  add(
    "tests.missing",
    "warn",
    "Code changed but no test changed. Add or update a test unless the change is purely visual.",
  );
const docsChanged = paths.some((p) => /^docs\/|README\.md$|AGENTS\.md$|CONTRIBUTING\.md$/.test(p));
if (code.length && !docsChanged)
  add(
    "docs.check",
    "info",
    "No docs changed. If behaviour changed, update the matching page in docs/.",
  );

// Size and commit style
if (stat > 800)
  add(
    "size",
    "warn",
    `${stat} lines changed. Big pull requests take much longer to review; consider splitting it.`,
  );
const subjects = git("log", "--format=%s", `${mergeBase}..HEAD`).split("\n").filter(Boolean);
const conventional =
  /^(feat|fix|docs|chore|refactor|perf|test|build|ci|style|revert)(\([a-z0-9-]+\))?!?: .+/;
const offStyle = subjects.filter((s) => !conventional.test(s));
if (offStyle.length)
  add(
    "commits",
    "warn",
    "Commits not in Conventional Commits style. Only the PR title must be (we squash), but please follow it.",
    offStyle,
  );

const ui =
  paths.some((p) => /^apps\/web\/(app|components|modules)\/.*\.tsx$/.test(p) && !isTest(p)) ||
  paths.some((p) => p.endsWith(".css"));
const db = paths.some((p) => p.startsWith("supabase/"));

const ruleFailures = results.filter((r) => r.level === "fail");

// ── 2 and 3. Commands ───────────────────────────────────────────────────────────────────────
// The build prerenders the app shell, which needs the two public Supabase values to be set (not reachable).
// Without them, use local placeholders so contributors with no Supabase project can still build.
const localEnv = readText(inRoot("apps/web/.env.local")) ?? "";
const hasValue = (name) =>
  Boolean(process.env[name]) || new RegExp(`^${name}=\\S+`, "m").test(localEnv);
const buildEnv = {};
if (!hasValue("NEXT_PUBLIC_SUPABASE_URL") || !hasValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")) {
  buildEnv.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  buildEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_placeholder_for_build";
  add(
    "env.placeholder",
    "info",
    "No Supabase values set: the build used local placeholders (fine for checks; to run the app see docs/development.md).",
  );
}

const step = (id, label, cmd, cmdArgs) => {
  say(c.bold(`\n▸ ${label}`) + c.dim(`  ${cmd} ${cmdArgs.join(" ")}`));
  const ok = stream(cmd, cmdArgs, buildEnv);
  add(id, ok ? "ok" : "fail", ok ? label : `${label} failed`);
  return ok;
};

if (ruleFailures.length) {
  say(c.dim("\nRepo rules failed; skipping the slow checks until they are fixed."));
} else {
  const formatted = step("format", "Formatting", "pnpm", ["format:check"]);
  if (!formatted) results.at(-1).detail = ["Run `pnpm format` to fix it"];
  const verified = flag("quick")
    ? ["tokens:check", "lint", "typecheck", "test"].every((s, i) =>
        step(`verify.${s}`, ["Tokens", "Lint", "Types", "Unit tests"][i], "pnpm", [s]),
      )
    : step("verify", "pnpm verify (tokens, lint, types, tests, build)", "pnpm", ["verify"]);
  if (flag("quick"))
    add(
      "build",
      "info",
      "Build skipped (--quick). Run `pnpm preflight` without it before opening the PR.",
    );

  if (ui && verified) {
    if (flag("e2e")) step("e2e", "End-to-end tests", "pnpm", ["--filter", "@powerweek/web", "e2e"]);
    else
      add(
        "e2e",
        "info",
        "UI changed: run `pnpm preflight --e2e` (or let CI do it) and attach screenshots, mobile and desktop.",
      );
  }
  if (db) {
    if (flag("db")) step("db.pgtap", "Database tests", "supabase", ["test", "db"]);
    else
      add(
        "db.pgtap",
        "info",
        "Database changed: CI runs the pgTAP tests. Locally: `supabase start`, then `pnpm preflight --db`.",
      );
  }
}

// ── Summary ─────────────────────────────────────────────────────────────────────────────────
const failed = results.filter((r) => r.level === "fail");
say(c.bold("\nSummary"));
for (const r of results) {
  say(`${mark[r.level]} ${r.message}`);
  for (const d of r.detail ?? []) say(c.dim(`    ${d}`));
}
if (dirty)
  say(
    `${mark.warn} You have uncommitted changes. They were checked, but they are not in the PR until you commit them.`,
  );
say(
  failed.length
    ? `\n${mark.fail} ${failed.length} problem${failed.length > 1 ? "s" : ""} to fix before opening a PR.`
    : `\n${mark.ok} Ready for a pull request: \`pnpm pr\`.`,
);

const result = {
  ok: failed.length === 0,
  head: git("rev-parse", "HEAD"),
  dirty,
  base,
  quick: flag("quick"),
  ran: { e2e: flag("e2e") && ui, db: flag("db") && db },
  touches: { ui, db, code: code.length > 0, docs: docsChanged, newModules },
  changed: paths,
  results,
  at: new Date().toISOString(),
};
writeState("preflight.json", result);
finish(result, failed.length ? 1 : 0);
