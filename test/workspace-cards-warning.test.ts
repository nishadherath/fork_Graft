/**
 * D14 in a workspace: card or INDEX.md drift in a child is a warning on an OK line, never
 * `STALE ()`. The federated check is what `graft check` prints at a workspace parent and
 * what the MCP freshness tool returns there; `graft check` still exits 1 on it, as it does
 * in a single repository, so the result's `ok` stays false.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGraph } from "../src/graph/build.js";
import { federateCheck, splitWorkspace } from "../src/graph/workspace.js";

/** A parent with two git children, each built into its own graft/, and the workspace index. */
async function builtWorkspace(): Promise<string> {
  const parent = mkdtempSync(join(tmpdir(), "ws-d14-"));
  for (const child of ["repoA", "repoB"]) {
    mkdirSync(join(parent, child, ".git"), { recursive: true });
    mkdirSync(join(parent, child, "src"), { recursive: true });
    writeFileSync(join(parent, child, "src", "a.ts"), `export function ${child}Fn(): number {\n  return 1;\n}\n`);
  }
  await splitWorkspace(parent, undefined, async (childDir) => {
    await buildGraph(childDir);
  });
  return parent;
}

test("a child whose only drift is a missing card reads OK with a warning that names the card", async () => {
  const p = await builtWorkspace();
  try {
    rmSync(join(p, "repoA", "graft", "src", "a.md"));
    const r = await federateCheck(p);
    assert.equal(r.ok, false, "graft check at the parent keeps exiting 1 on card drift");
    assert.match(r.text, /repoA\/: OK/, "the wiring is in sync, so the child line says OK");
    assert.doesNotMatch(r.text, /STALE \(\)/, "never an empty drift list");
    assert.match(r.text, /warning: .*card.*src\/a\.md/, "the warning names the card");
    assert.match(r.text, /repoB\/: OK/);
  } finally {
    rmSync(p, { recursive: true, force: true });
  }
});

test("a child with a real code change and card drift reads STALE and counts both", async () => {
  const p = await builtWorkspace();
  try {
    rmSync(join(p, "repoA", "graft", "src", "a.md"));
    writeFileSync(join(p, "repoA", "src", "b.ts"), "export function later(): number {\n  return 2;\n}\n");
    const r = await federateCheck(p);
    assert.equal(r.ok, false);
    // The new file adds two nodes (the file and its function); the deleted card is one more.
    assert.match(r.text, /repoA\/: STALE \(2 added, 1 card\)/);
  } finally {
    rmSync(p, { recursive: true, force: true });
  }
});
