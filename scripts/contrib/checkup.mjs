#!/usr/bin/env node
// pnpm checkup [--json]
// Checks your machine and tells you what you can already do: run the tests, run the app, talk to the assistant.
// Never prints the value of an environment variable, only whether it is set.

import { existsSync } from "node:fs";
import {
  c,
  finish,
  inRoot,
  mark,
  readText,
  remoteRepo,
  say,
  tryRun,
  UPSTREAM,
  upstreamRemote,
} from "./lib.mjs";

const checks = [];
const add = (id, level, message, fix) =>
  checks.push({ id, level, message, ...(fix ? { fix } : {}) });

// Node and pnpm
const wantedNode = Number((readText(inRoot(".node-version")) ?? "24").trim().split(".")[0]);
const node = Number(process.versions.node.split(".")[0]);
if (node < 22)
  add(
    "node",
    "fail",
    `Node ${process.versions.node} is too old`,
    `Install Node ${wantedNode} (see .node-version)`,
  );
else if (node !== wantedNode)
  add(
    "node",
    "warn",
    `Node ${process.versions.node}; CI uses Node ${wantedNode}`,
    `Switch to Node ${wantedNode} if something behaves differently from CI`,
  );
else add("node", "ok", `Node ${process.versions.node}`);

const pnpm = tryRun("pnpm", ["--version"]);
if (!pnpm) add("pnpm", "fail", "pnpm not found", "Run `corepack enable`");
else if (!pnpm.startsWith("10."))
  add(
    "pnpm",
    "warn",
    `pnpm ${pnpm}; the repo pins pnpm 10`,
    "Run `corepack enable` so the pinned version is used",
  );
else add("pnpm", "ok", `pnpm ${pnpm}`);

if (!existsSync(inRoot("node_modules")) || !existsSync(inRoot("apps/web/node_modules/next"))) {
  add("deps", "fail", "Dependencies are not installed", "Run `pnpm install`");
} else add("deps", "ok", "Dependencies installed");

// Git remotes: maintainers clone tukkteam/powerweek; everyone else works from a fork.
const origin = remoteRepo("origin");
const upstream = upstreamRemote();
if (!upstream) {
  add(
    "remotes",
    "warn",
    `No remote points at ${UPSTREAM}`,
    `git remote add upstream https://github.com/${UPSTREAM}.git`,
  );
} else if (origin?.toLowerCase() === UPSTREAM) {
  add(
    "remotes",
    "ok",
    `origin is ${UPSTREAM} (push needs write access; otherwise fork and push there)`,
  );
} else add("remotes", "ok", `Fork setup: origin is ${origin ?? "?"}, ${upstream} is ${UPSTREAM}`);

// GitHub CLI: optional, but `pnpm issue` and `pnpm pr --create` use it.
if (!tryRun("gh", ["--version"]))
  add(
    "gh",
    "warn",
    "GitHub CLI not found (optional)",
    "Install https://cli.github.com to use `pnpm issue` and `pnpm pr --create`",
  );
else if (tryRun("gh", ["auth", "status"]) === null)
  add("gh", "warn", "GitHub CLI is not logged in", "Run `gh auth login`");
else add("gh", "ok", "GitHub CLI logged in");

// Environment for running the app (not needed for tests or the build).
const env = readText(inRoot("apps/web/.env.local"));
const value = (name) => env?.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() ?? "";
const real = (v) => v !== "" && !/<project-ref>|example\.com|\.\.\.$/.test(v);
const supabase =
  real(value("NEXT_PUBLIC_SUPABASE_URL")) && real(value("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
const model = ["OMNIROUTE_BASE_URL", "OMNIROUTE_API_KEY", "OMNIROUTE_MODEL"].every((n) =>
  real(value(n)),
);
if (!env)
  add(
    "env",
    "warn",
    "No apps/web/.env.local",
    "cp apps/web/.env.example apps/web/.env.local (only needed to run the app)",
  );
else {
  add(
    "env.supabase",
    supabase ? "ok" : "warn",
    supabase ? "Supabase values set" : "Supabase values missing in .env.local",
    supabase ? undefined : "See docs/development.md: your own Supabase project or `supabase start`",
  );
  add(
    "env.model",
    model ? "ok" : "warn",
    model ? "Assistant model values set" : "Assistant model values missing (optional)",
    model ? undefined : "Any OpenAI-compatible endpoint; everything else works without it",
  );
}

// Database tooling: optional, CI runs the pgTAP tests for you.
const supabaseCli = tryRun("supabase", ["--version"]);
const docker = tryRun("docker", ["info", "--format", "{{.ServerVersion}}"]);
add(
  "supabase-cli",
  supabaseCli ? "ok" : "warn",
  supabaseCli ? `Supabase CLI ${supabaseCli}` : "Supabase CLI not found (optional)",
  supabaseCli ? undefined : "Only needed for database work: https://supabase.com/docs/guides/cli",
);
add(
  "docker",
  docker ? "ok" : "warn",
  docker ? "Docker running" : "Docker not running (optional)",
  docker ? undefined : "Only needed for a local database (`supabase start`)",
);

const can = {
  tests: checks.every((x) => !["node", "pnpm", "deps"].includes(x.id) || x.level !== "fail"),
  app: false,
  assistant: false,
  database_tests: Boolean(supabaseCli && docker),
};
can.app = can.tests && supabase;
can.assistant = can.app && model;

say(c.bold("PowerWeek checkup\n"));
for (const x of checks) {
  say(`${mark[x.level]} ${x.message}${x.fix ? c.dim(`\n    → ${x.fix}`) : ""}`);
}
const line = (yes, text) => say(`  ${yes ? mark.ok : mark.fail} ${text}`);
say(c.bold("\nWhat you can do now"));
line(can.tests, "lint, typecheck, unit tests and build (`pnpm verify`, `pnpm preflight`)");
line(can.app, "run the app (`pnpm dev`)");
line(can.assistant, "talk to the assistant");
line(can.database_tests, "run the database tests locally (CI runs them anyway)");

finish({ checks, can }, can.tests ? 0 : 1);
