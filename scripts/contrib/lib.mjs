// Shared helpers for the contributor scripts (`pnpm checkup`, `pnpm issue`, `pnpm preflight`, `pnpm pr`).
// Node built-ins only, so they work right after `pnpm install` and on any OS.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const UPSTREAM = "tukkteam/powerweek";

export const args = process.argv.slice(2);
export const flag = (name) => args.includes(`--${name}`);
export const positional = () => args.filter((a) => !a.startsWith("--"));
export const JSON_MODE = flag("json");

const tty = process.stdout.isTTY && !process.env.NO_COLOR && !JSON_MODE;
const paint = (code) => (text) => (tty ? `\x1b[${code}m${text}\x1b[0m` : String(text));
export const c = {
  bold: paint(1),
  dim: paint(2),
  red: paint(31),
  green: paint(32),
  yellow: paint(33),
  cyan: paint(36),
};

export const mark = { ok: c.green("✓"), warn: c.yellow("!"), fail: c.red("✗"), info: c.cyan("·") };

/** Print for people; silent in --json mode, where the script prints one JSON object at the end. */
export const say = (...lines) => {
  if (!JSON_MODE) console.log(...lines);
};

/** Run a command and return trimmed stdout, or throw. */
export function run(cmd, cmdArgs = [], options = {}) {
  return execFileSync(cmd, cmdArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

/** Run a command and return stdout, or null if it fails or doesn't exist. */
export function tryRun(cmd, cmdArgs = [], options = {}) {
  try {
    return run(cmd, cmdArgs, options);
  } catch {
    return null;
  }
}

/** Run a command with its output streamed to the terminal (stderr in --json mode). Returns true on success. */
export function stream(cmd, cmdArgs = [], env = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    stdio: ["ignore", JSON_MODE ? process.stderr : "inherit", "inherit"],
    shell: process.platform === "win32",
    env: { ...process.env, ...env },
  });
  return result.status === 0;
}

export const root = resolve(tryRun("git", ["rev-parse", "--show-toplevel"]) ?? process.cwd());
export const gitDir = resolve(
  root,
  tryRun("git", ["rev-parse", "--git-dir"], { cwd: root }) ?? ".git",
);
export const inRoot = (...parts) => join(root, ...parts);
export const readText = (path) => (existsSync(path) ? readFileSync(path, "utf8") : null);

/** State files live in the git dir (per worktree), so they are never committed. */
export const statePath = (name) => join(gitDir, `powerweek-${name}`);
export const writeState = (name, data) =>
  writeFileSync(statePath(name), JSON.stringify(data, null, 2));
export const readState = (name) => {
  const text = readText(statePath(name));
  return text ? JSON.parse(text) : null;
};

/** `owner/repo` from a git remote URL, or null. */
export function remoteRepo(remote) {
  const url = tryRun("git", ["remote", "get-url", remote], { cwd: root });
  const match = url?.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/);
  return match ? match[1] : null;
}

/**
 * The remote that points at tukkteam/powerweek. Maintainers clone it directly (`origin`);
 * contributors clone their fork as `origin` and add `upstream`.
 */
export function upstreamRemote() {
  for (const remote of (tryRun("git", ["remote"], { cwd: root }) ?? "")
    .split("\n")
    .filter(Boolean)) {
    if (remoteRepo(remote)?.toLowerCase() === UPSTREAM) return remote;
  }
  return null;
}

/** The ref new work branches from and is compared against: `<upstream remote>/main`, else local `main`. */
export function baseRef() {
  const remote = upstreamRemote();
  return remote ? `${remote}/main` : "main";
}

export const gh = (ghArgs) => tryRun("gh", ghArgs);
export const ghReady = () => tryRun("gh", ["auth", "status"]) !== null;

export function currentBranch() {
  return tryRun("git", ["branch", "--show-current"], { cwd: root }) ?? "";
}

/** `feat/42-short-title` → 42 */
export function issueFromBranch(branch = currentBranch()) {
  const match = branch.match(/^[a-z]+\/(\d+)-/);
  return match ? Number(match[1]) : null;
}

export function finish(result, exitCode = 0) {
  if (JSON_MODE) console.log(JSON.stringify(result, null, 2));
  process.exit(exitCode);
}
