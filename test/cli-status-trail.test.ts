/**
 * `status` and `--version` under the trail brand (Stage 33, D28 A): the twin of
 * `cli-status-graft.test.ts`, spawning `src/bin/trail.ts` so the command the fork's second `bin`
 * entry starts is the one under test. Temp homes and a temp repository only; nothing here runs
 * inside a wired checkout.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function trail(args: string[], home: string): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, ["--import", "tsx", join(process.cwd(), "src", "bin", "trail.ts"), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      TRAIL_HOME: join(home, "trail"),
      DO_NOT_TRACK: "1",
      GRAFT_NO_REFRESH: "1",
      GRAFT_NO_TRAIL_SWITCH: "1",
      CLAUDECODE: undefined,
      TRAIL_INVOKED_AS: undefined,
      TRAIL_CLOUD: undefined,
    },
  });
}

test("trail status runs under the trail brand, as a table and as JSON", () => {
  const root = mkdtempSync(join(tmpdir(), "trail-status-"));
  try {
    const home = join(root, "home");
    const repo = join(root, "repo");
    mkdirSync(home);
    mkdirSync(repo);
    spawnSync("git", ["init", "-q"], { cwd: repo });

    const table = trail(["status", repo], home);
    assert.equal(table.status, 0, String(table.stderr));
    assert.match(String(table.stdout), /code map\s+✗ not built/);
    assert.match(String(table.stdout), /this week\s/);

    const json = trail(["status", repo, "--json"], home);
    assert.equal(json.status, 0, String(json.stderr));
    const parsed = JSON.parse(String(json.stdout));
    assert.equal(parsed.codeMap, null);
    assert.equal(typeof parsed.week.savedTokens, "number");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("trail --help lists status and the learnings check, and hides the graft-only stats", () => {
  const root = mkdtempSync(join(tmpdir(), "trail-status-help-"));
  try {
    mkdirSync(join(root, "home"));
    const help = trail(["--help"], join(root, "home"));
    assert.equal(help.status, 0, String(help.stderr));
    assert.match(String(help.stdout), /^\s+status\b/m);
    assert.match(String(help.stdout), /^\s+check\b/m);
    assert.doesNotMatch(String(help.stdout), /^\s+stats\b/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("trail --version answers the package's own version, the same one graft answers", () => {
  const root = mkdtempSync(join(tmpdir(), "trail-version-"));
  try {
    mkdirSync(join(root, "home"));
    const expected = (JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { version: string }).version;
    const res = trail(["--version"], join(root, "home"));
    assert.equal(res.status, 0, String(res.stderr));
    assert.equal(String(res.stdout).trim(), expected);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
