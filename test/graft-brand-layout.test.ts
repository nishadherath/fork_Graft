/**
 * This fork keeps the `graft` command and the `graft/` folder (assessment D9).
 *
 * Upstream 0.23.0 puts the code map in `.trail/cache/` once a repository is on
 * trail, which `trail init` does by creating `.trail/learnings/`. `graft init`
 * under the graft brand must not do that, so a repository wired by this fork
 * keeps its map in `graft/` and has no `.trail/` folder at all.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { runCli, tmpRepo } from "./helpers.js";
import { BRAND_ENV } from "../src/brand.js";
import { mapDirFor } from "../src/context/map-dir.js";

test("graft init and graft build keep the map in graft/ and make no .trail/", () => {
  const repo = tmpRepo("graft-layout");
  spawnSync("git", ["init", "-q"], { cwd: repo });
  mkdirSync(join(repo, "src"), { recursive: true });
  writeFileSync(join(repo, "src", "a.ts"), "export function a(): number {\n  return 1;\n}\n");
  const home = mkdtempSync(join(tmpdir(), "graft-layout-home-"));
  const env = { ...process.env, [BRAND_ENV]: "graft", DO_NOT_TRACK: "1", GRAFT_LSP: "0" };

  const init = runCli(["init", repo, "--agents", "claude", "--yes", "--no-global", "--no-build"], { home, env });
  assert.equal(init.status, 0, init.describe());
  const build = runCli(["build", repo], { home, env });
  assert.equal(build.status, 0, build.describe());

  assert.ok(existsSync(join(repo, "graft", ".graph")), "the map is in graft/");
  assert.equal(existsSync(join(repo, ".trail")), false, "no .trail/ under the graft brand");
  assert.equal(mapDirFor(repo), join(repo, "graft"));
});
