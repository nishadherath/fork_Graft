/**
 * An init for one repository never removes machine-wide wiring (decision D33 A, Stage 38).
 *
 * `init` converges the repository it is run in: it retracts the wiring of every host
 * not named in `--agents`. That sweep used to carry the machine-wide scope as well, so
 * `trail init B --agents agents antigravity hermes` deleted the user-level Claude hooks,
 * the helper shim and the trail skill that every other repository on the machine relies
 * on (found by Stage 37 on 2026-10-28). Machine-wide files belong to the machine, not to
 * the repository being initialised; only an explicit `uninstall` may remove them.
 * Temp homes and temp repositories only; nothing here runs inside a wired checkout.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tmpRepo } from "./helpers.js";

interface Run {
  status: number | null;
  output: string;
  describe(): string;
}

/** One `trail` run through its own entry point, with a scratch home and every network and model path off. */
function trail(args: string[], home: string): Run {
  const res = spawnSync(process.execPath, ["--import", "tsx", join(process.cwd(), "src", "bin", "trail.ts"), ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 120_000,
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      TRAIL_HOME: join(home, ".trail"),
      DO_NOT_TRACK: "1",
      GRAFT_LSP: "0",
      GRAFT_NO_REFRESH: "1",
      GRAFT_NO_TRAIL_SWITCH: "1",
      TRAIL_NO_FETCH: "1",
      TRAIL_NO_LOOK_BACK: "1",
      CLAUDECODE: undefined,
      TRAIL_INVOKED_AS: undefined,
      TRAIL_CLOUD: undefined,
    },
  });
  return {
    status: res.status,
    output: `${res.stdout}\n${res.stderr}`,
    describe: () => `trail ${args.join(" ")}\n  status: ${res.status}\n  stdout: ${JSON.stringify(res.stdout)}\n  stderr: ${JSON.stringify(res.stderr)}`,
  };
}

/** A git repository holding one TypeScript function. */
function repoWithSource(tag: string): string {
  const repo = tmpRepo(tag);
  spawnSync("git", ["init", "-q"], { cwd: repo });
  mkdirSync(join(repo, "src"), { recursive: true });
  writeFileSync(join(repo, "src", "a.ts"), "export function a(): number {\n  return 1;\n}\n");
  return repo;
}

/** The hook events a Claude Code settings file declares. */
function hookEvents(file: string): string[] {
  const settings = JSON.parse(readFileSync(file, "utf8")) as { hooks?: Record<string, unknown> };
  return Object.keys(settings.hooks ?? {}).sort();
}

const INIT = ["--yes", "--no-build", "--plain"];

/** The machine-wide Claude files a claude init writes under the home folder. */
function globalFiles(home: string): { settings: string; shim: string; skill: string } {
  return {
    settings: join(home, ".claude", "settings.json"),
    shim: join(home, ".claude", "helpers", "graft-hooks.cjs"),
    skill: join(home, ".claude", "skills", "trail", "SKILL.md"),
  };
}

test("a trail init for hosts without claude leaves the user-level Claude hooks, shim and skill in place", () => {
  const a = repoWithSource("keeps-global-a");
  const b = repoWithSource("keeps-global-b");
  const home = mkdtempSync(join(tmpdir(), "keeps-global-home-"));
  try {
    const first = trail(["init", a, "--agents", "claude", ...INIT], home);
    assert.equal(first.status, 0, first.describe());
    const files = globalFiles(home);
    const events = hookEvents(files.settings);
    assert.ok(events.includes("SessionStart"), `a claude init wires the user-level hooks\n${first.describe()}`);
    assert.ok(existsSync(files.shim), "the user-level hooks shim");
    assert.ok(existsSync(files.skill), "the user-level trail skill");

    const second = trail(["init", b, "--agents", "agents", "antigravity", "hermes", ...INIT], home);
    assert.equal(second.status, 0, second.describe());
    assert.doesNotMatch(second.output, /removed claude/, second.describe());
    assert.deepEqual(hookEvents(files.settings), events, "the user-level hook events are untouched");
    assert.ok(existsSync(files.shim), "the user-level hooks shim survives");
    assert.ok(existsSync(files.skill), "the user-level trail skill survives");
  } finally {
    for (const dir of [a, b, home]) rmSync(dir, { recursive: true, force: true });
  }
});

test("an explicit uninstall still removes the machine-wide Claude wiring", () => {
  const repo = repoWithSource("uninstall-global");
  const home = mkdtempSync(join(tmpdir(), "uninstall-global-home-"));
  try {
    const init = trail(["init", repo, "--agents", "claude", ...INIT], home);
    assert.equal(init.status, 0, init.describe());
    const files = globalFiles(home);
    assert.ok(existsSync(files.skill), "wired first");

    const gone = trail(["uninstall", repo, "--yes"], home);
    assert.equal(gone.status, 0, gone.describe());
    assert.equal(existsSync(files.skill), false, "the user-level trail skill is removed");
    assert.equal(existsSync(files.shim), false, "the user-level hooks shim is removed");
    assert.deepEqual(existsSync(files.settings) ? hookEvents(files.settings) : [], [], "the user-level hook events are removed");
  } finally {
    for (const dir of [repo, home]) rmSync(dir, { recursive: true, force: true });
  }
});
