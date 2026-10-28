/**
 * The trail twin of `graft-brand-layout.test.ts` (assessment D31 A, Stage 35).
 *
 * The fork ships a second `bin`, `trail` (D28 A), and moves its repositories to
 * trail's layout (D29 B). These pin what `trail init` lays down, through
 * `src/bin/trail.ts`, the entry the `trail` shim starts: `.trail/` with the
 * committed hook script, the map in `.trail/cache/`, one SessionStart entry in
 * `.claude/settings.json`, and no MCP server, no repository skill and no `graft/`.
 * The second case is the move this checkout made on 2026-10-28: a repository
 * wired by `graft init` loses the graft shims, skill and `.mcp.json` server.
 * Temp homes and temp repositories only; nothing here runs inside a wired checkout.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tmpRepo } from "./helpers.js";
import { mapDirFor } from "../src/context/map-dir.js";

interface Run {
  status: number | null;
  describe(): string;
}

/** One CLI run under the named brand's own entry point, with a scratch home and every network and model path off. */
function cli(brand: "graft" | "trail", args: string[], home: string): Run {
  const res = spawnSync(process.execPath, ["--import", "tsx", join(process.cwd(), "src", "bin", `${brand}.ts`), ...args], {
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
    describe: () => `${brand} ${args.join(" ")}\n  status: ${res.status}\n  stdout: ${JSON.stringify(res.stdout)}\n  stderr: ${JSON.stringify(res.stderr)}`,
  };
}

/** A git repository holding one TypeScript function, and a scratch home beside it. */
function scratch(tag: string): { repo: string; home: string } {
  const repo = tmpRepo(tag);
  spawnSync("git", ["init", "-q"], { cwd: repo });
  mkdirSync(join(repo, "src"), { recursive: true });
  writeFileSync(join(repo, "src", "a.ts"), "export function a(): number {\n  return 1;\n}\n");
  return { repo, home: mkdtempSync(join(tmpdir(), `${tag}-home-`)) };
}

function json(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
}

/** Every hook command in a Claude Code settings file, flattened. */
function hookCommands(settings: Record<string, unknown>): string[] {
  const hooks = (settings.hooks ?? {}) as Record<string, Array<{ hooks?: Array<{ command?: string }> }>>;
  return Object.values(hooks).flatMap((groups) => groups.flatMap((g) => (g.hooks ?? []).map((h) => h.command ?? "")));
}

/** The MCP server names a repository's `.mcp.json` declares; none when the file is absent. */
function mcpServers(repo: string): string[] {
  const file = join(repo, ".mcp.json");
  if (!existsSync(file)) return [];
  return Object.keys((json(file).mcpServers ?? {}) as Record<string, unknown>);
}

const INIT = ["--agents", "claude", "--yes", "--no-global", "--plain"];

test("trail init and trail build put the map in .trail/cache/ and wire one hook, with no MCP server and no graft/", () => {
  const { repo, home } = scratch("trail-layout");
  try {
    const init = cli("trail", ["init", repo, ...INIT, "--no-build"], home);
    assert.equal(init.status, 0, init.describe());
    const build = cli("trail", ["build", repo], home);
    assert.equal(build.status, 0, build.describe());

    assert.ok(existsSync(join(repo, ".trail", "hook.cjs")), "the committed hook script");
    assert.ok(existsSync(join(repo, ".trail", "README.md")), "the folder explains itself");
    const ignored = readFileSync(join(repo, ".trail", ".gitignore"), "utf8").split(/\r?\n/);
    assert.ok(ignored.includes("cache/") && ignored.includes("statusline.cjs"), "the map and the statusline stay on the machine");

    assert.ok(existsSync(join(repo, ".trail", "cache", ".graph")), "the map is in .trail/cache/");
    assert.equal(mapDirFor(repo), join(repo, ".trail", "cache"));
    assert.equal(existsSync(join(repo, "graft")), false, "no graft/ under the trail brand");

    const commands = hookCommands(json(join(repo, ".claude", "settings.json")));
    assert.deepEqual(commands, ['node "${CLAUDE_PROJECT_DIR:-.}/.trail/hook.cjs" session-start || exit 0']);
    assert.deepEqual(mcpServers(repo), [], "no repository MCP server");
    assert.equal(existsSync(join(repo, ".claude", "skills")), false, "no skill in the repository");
    assert.equal(existsSync(join(repo, ".claude", "helpers")), false, "no graft shims in the repository");
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("trail init moves a graft-wired repository: the shims, the skill and the .mcp.json server go, the hook and statusline move", () => {
  const { repo, home } = scratch("trail-move");
  try {
    const graft = cli("graft", ["init", repo, ...INIT.filter((a) => a !== "--plain"), "--no-build"], home);
    assert.equal(graft.status, 0, graft.describe());
    assert.ok(existsSync(join(repo, ".claude", "helpers", "graft-hooks.cjs")), "wired as graft first");
    assert.ok(existsSync(join(repo, ".claude", "skills", "graft", "SKILL.md")));
    assert.ok(mcpServers(repo).length > 0, "graft registers its MCP server");

    const trail = cli("trail", ["init", repo, ...INIT, "--no-build"], home);
    assert.equal(trail.status, 0, trail.describe());

    for (const gone of [
      [".claude", "helpers", "graft-hooks.cjs"],
      [".claude", "helpers", "graft-statusline.cjs"],
      [".claude", "skills", "graft", "SKILL.md"],
    ])
      assert.equal(existsSync(join(repo, ...gone)), false, `${gone.join("/")} is removed`);
    assert.deepEqual(mcpServers(repo), [], "the .mcp.json server is removed");
    assert.ok(existsSync(join(repo, ".trail", "hook.cjs")));
    assert.deepEqual(hookCommands(json(join(repo, ".claude", "settings.json"))), [
      'node "${CLAUDE_PROJECT_DIR:-.}/.trail/hook.cjs" session-start || exit 0',
    ]);
    const local = json(join(repo, ".claude", "settings.local.json"));
    assert.equal((local.statusLine as { command?: string } | undefined)?.command, 'node "${CLAUDE_PROJECT_DIR:-.}/.trail/statusline.cjs"');
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
