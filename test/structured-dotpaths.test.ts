/**
 * D7: with the structured tier on, the walker admits YAML under
 * `.github/workflows/`, and nothing else behind a dot.
 *
 * The risk is breadth, not the feature: a rule that lets one dot-directory in must
 * not let `.github/` as a whole, `.editorconfig`, or `.git` in, and with the tier
 * off the file set must be exactly today's. Build, probe and check must agree.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpRepo } from "./helpers.js";
import { walkDir } from "../src/ingest/fs.js";
import { listSourceFiles } from "../src/graph/source-files.js";
import { buildGraph } from "../src/graph/build.js";
import { checkGraph } from "../src/graph/check.js";
import { probeDrift } from "../src/graph/fingerprint.js";
import { readGraph, wiringPath } from "../src/graph/write.js";
import { patchBuildConfig } from "../src/util/state.js";

const WORKFLOW = ["name: ci", "on:", "  push:", "    branches: [main]", "jobs:", "  verify:", "    runs-on: ubuntu"];

function repo(tag: string, git: boolean): string {
  const dir = tmpRepo(tag);
  mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
  mkdirSync(join(dir, ".github", "actions", "x"), { recursive: true });
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, ".github", "workflows", "ci.yml"), WORKFLOW.join("\n") + "\n");
  writeFileSync(join(dir, ".github", "workflows", "release.yaml"), "name: release\n");
  writeFileSync(join(dir, ".github", "workflows", "notes.md"), "# not yaml\n");
  writeFileSync(join(dir, ".github", "workflows", "tool.py"), "def f():\n    pass\n");
  writeFileSync(join(dir, ".github", "dependabot.yml"), "version: 2\n");
  writeFileSync(join(dir, ".github", "actions", "x", "action.yml"), "name: x\n");
  writeFileSync(join(dir, ".editorconfig"), "root = true\n");
  writeFileSync(join(dir, "src", "util.ts"), "export function util(): number {\n  return 1;\n}\n");
  if (git) {
    const run = (...args: string[]) => spawnSync("git", args, { cwd: dir, stdio: "ignore" });
    run("init", "-q");
    run("add", "-A");
  }
  return dir;
}

function listed(dir: string): string[] {
  return listSourceFiles(dir, join(dir, "graft"))
    .map((f) => f.slice(dir.length + 1).replaceAll("\\", "/"))
    .sort();
}

for (const git of [true, false]) {
  const mode = git ? "git worktree" : "plain directory";

  test(`dotpaths (${mode}): tier off, the file set is exactly today's`, () => {
    const dir = repo(`dotpaths-off-${git}`, git);
    patchBuildConfig(dir, { structured: false });
    assert.deepEqual(listed(dir), ["src/util.ts"]);
  });

  test(`dotpaths (${mode}): tier on, only YAML under .github/workflows is admitted`, () => {
    const dir = repo(`dotpaths-on-${git}`, git);
    patchBuildConfig(dir, { structured: true });
    assert.deepEqual(listed(dir), [
      ".github/workflows/ci.yml",
      ".github/workflows/release.yaml",
      "src/util.ts",
    ]);
  });
}

test("dotpaths: walkDir admits nothing unless asked", () => {
  const dir = repo("dotpaths-walk", true);
  const rel = (files: string[]) => files.map((f) => f.slice(dir.length + 1).replaceAll("\\", "/")).sort();
  assert.ok(!rel(walkDir(dir)).some((f) => f.startsWith(".")));
  assert.deepEqual(
    rel(walkDir(dir, undefined, { admitDotPaths: [".github/workflows"] })).filter((f) => f.startsWith(".")),
    [".github/workflows/ci.yml", ".github/workflows/release.yaml"],
    "YAML only: a script or note beside a workflow stays out",
  );
});

test("dotpaths: build, the freshness probe and check agree", async () => {
  const dir = repo("dotpaths-agree", true);
  patchBuildConfig(dir, { structured: true });
  const outDir = join(dir, "graft");
  await buildGraph(dir, { contextDir: outDir, reuse: false });

  const graph = readGraph(wiringPath(outDir));
  const run = graph.nodes.find((n) => n.id === ".github/workflows/ci.yml#key:jobs.verify.runs-on");
  assert.ok(run, "a workflow key is in the graph");
  assert.equal(run.span, "L7-L7");

  assert.deepEqual(probeDrift(dir, outDir), { changed: [], added: [], removed: [] });
  const check = await checkGraph(dir, { contextDir: outDir });
  assert.equal(check.ok, true, `check must be clean, got ${JSON.stringify(check)}`);

  writeFileSync(join(dir, ".github", "workflows", "ci.yml"), WORKFLOW.join("\n") + "\nenv:\n  A: 1\n");
  assert.deepEqual(probeDrift(dir, outDir)?.changed, [".github/workflows/ci.yml"]);
});
