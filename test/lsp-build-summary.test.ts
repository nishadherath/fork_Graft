/**
 * The LSP pass is on by default, so a build says what it did: which server ran and how many
 * edges it added, or that none was found on PATH, or that one was found and never became
 * ready. Before this the only trace was a progress fragment `summarizing 1/0: lsp:none`,
 * left on the terminal by every build, and a server that failed to start was silent.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGraph } from "../src/graph/build.js";
import { runCli } from "./helpers.js";

/** A one-file TypeScript repo, built with `--lsp` while PATH holds no language server. */
function tsRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "graft-lsp-summary-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "a.ts"), "export function a(): number {\n  return b();\n}\nexport function b(): number {\n  return 1;\n}\n");
  return dir;
}

/** A folder with nothing on it, so no server resolves whatever the machine has installed. */
const emptyPath = () => mkdtempSync(join(tmpdir(), "graft-empty-path-"));

test("buildGraph reports the LSP pass: no server found, and nothing when the pass is off", async () => {
  const dir = tsRepo();
  const savedPath = process.env.PATH;
  process.env.PATH = emptyPath();
  try {
    const on = await buildGraph(dir, { contextDir: join(dir, "graft"), lsp: true });
    assert.deepEqual(on.lsp, { server: null, ready: false, added: 0, queried: 0 });
    const off = await buildGraph(dir, { contextDir: join(dir, "graft"), lsp: false });
    assert.equal(off.lsp, undefined, "an LSP-off build has no LSP result to report");
  } finally {
    process.env.PATH = savedPath;
  }
});

test("graft build prints one lsp line and no summarizing N/0 fragment for the LSP pass", () => {
  const dir = tsRepo();
  const r = runCli(["build", dir], { env: { ...process.env, PATH: emptyPath(), GRAFT_LSP: "1", DO_NOT_TRACK: "1" } });
  assert.equal(r.status, 0, r.describe());
  assert.match(r.stdout, /^ {2}lsp: no language server on PATH/m, r.describe());
  assert.doesNotMatch(r.stderr, /summarizing \d+\/0/, "the LSP pass is not progress over summaries");
});
