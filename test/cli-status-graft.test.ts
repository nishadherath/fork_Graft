/**
 * `status` under the graft brand (Stage 25, D20). It was registered only under trail, so the
 * global `graft` install answered "unknown command" and D14's code-map and cards rows, and
 * `status --json`, could not be reached. Temp homes and a temp repository only; nothing here
 * runs inside a wired checkout.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function graft(args: string[], home: string): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, ["--import", "tsx", join(process.cwd(), "src", "bin", "graft.ts"), ...args], {
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

test("graft status runs under the graft brand, as a table and as JSON", () => {
  const root = mkdtempSync(join(tmpdir(), "graft-status-"));
  try {
    const home = join(root, "home");
    const repo = join(root, "repo");
    mkdirSync(home);
    mkdirSync(repo);
    spawnSync("git", ["init", "-q"], { cwd: repo });

    const table = graft(["status", repo], home);
    assert.equal(table.status, 0, String(table.stderr));
    assert.match(String(table.stdout), /code map\s+✗ not built/);
    assert.match(String(table.stdout), /this week\s/);

    const json = graft(["status", repo, "--json"], home);
    assert.equal(json.status, 0, String(json.stderr));
    const parsed = JSON.parse(String(json.stdout));
    assert.equal(parsed.codeMap, null);
    assert.equal(typeof parsed.week.savedTokens, "number");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("graft --help lists status", () => {
  const root = mkdtempSync(join(tmpdir(), "graft-status-help-"));
  try {
    mkdirSync(join(root, "home"));
    const help = graft(["--help"], join(root, "home"));
    assert.equal(help.status, 0, String(help.stderr));
    assert.match(String(help.stdout), /^\s+status\b/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
