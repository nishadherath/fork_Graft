/**
 * The structured tier, the documents tier and LSP enrichment are ON by default.
 *
 * Each is switched off explicitly: `--no-structured`, `--no-documents`, `--no-lsp`
 * (or the env twins GRAFT_STRUCTURED=0, GRAFT_DOCUMENTS=0, GRAFT_LSP=0), and the
 * choice is saved in `.graft/config.json` so later builds and the automatic
 * refresh agree with it. A persisted `false` is an explicit off; an absent value
 * means on. The risk in a default is disagreement between consumers of the file
 * set, so these tests drive the real CLI as well as the state readers.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCli, tmpRepo } from "./helpers.js";
import { patchBuildConfig, readDocuments, readLsp, readStructured } from "../src/util/state.js";
import { readGraph, wiringPath } from "../src/graph/write.js";

const ENV_KEYS = ["GRAFT_STRUCTURED", "GRAFT_DOCUMENTS", "GRAFT_LSP"] as const;

/** Run `body` with the three env twins unset, restoring them after. */
async function withCleanEnv(body: () => void | Promise<void>): Promise<void> {
  const saved = ENV_KEYS.map((k) => process.env[k]);
  for (const k of ENV_KEYS) delete process.env[k];
  try {
    await body();
  } finally {
    ENV_KEYS.forEach((k, i) => {
      if (saved[i] === undefined) delete process.env[k];
      else process.env[k] = saved[i];
    });
  }
}

function repoWithDocs(tag: string): string {
  const dir = tmpRepo(tag);
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "util.ts"), "export function util(): number {\n  return 1;\n}\n");
  writeFileSync(join(dir, "README.md"), "# Title\n\nBody.\n");
  writeFileSync(join(dir, "config.json"), '{\n  "port": 8080\n}\n');
  return dir;
}

/** Build through the CLI with a throwaway git repo and the three env twins unset. */
function build(dir: string, ...flags: string[]) {
  const env = { ...process.env };
  for (const k of ENV_KEYS) delete env[k];
  return runCli(["build", dir, ...flags], { env });
}

function paths(dir: string): string[] {
  return readGraph(wiringPath(join(dir, "graft")))
    .nodes.filter((n) => n.kind === "file")
    .map((n) => n.path)
    .sort();
}

function config(dir: string): Record<string, unknown> {
  const p = join(dir, ".graft", "config.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {};
}

test("defaults: structured, documents and lsp read as on when nothing was chosen", async () => {
  await withCleanEnv(() => {
    const dir = repoWithDocs("defaults-state");
    assert.equal(readStructured(dir), true, "structured is on by default");
    assert.equal(readDocuments(dir), true, "documents is on by default");
    assert.equal(readLsp(dir), true, "lsp is on by default");
  });
});

test("defaults: a persisted false is an explicit off, and documents follow structured", async () => {
  await withCleanEnv(() => {
    const dir = repoWithDocs("defaults-persisted");
    patchBuildConfig(dir, { structured: false });
    assert.equal(readStructured(dir), false);
    assert.equal(readDocuments(dir), false, "documents cannot run without the structured tier");
    patchBuildConfig(dir, { structured: true, documents: false, lsp: false });
    assert.equal(readStructured(dir), true);
    assert.equal(readDocuments(dir), false, "--no-documents survives");
    assert.equal(readLsp(dir), false, "--no-lsp survives");
  });
});

test("defaults: the env twins decide both ways and an empty value is unset", async () => {
  await withCleanEnv(() => {
    const dir = repoWithDocs("defaults-env");
    process.env.GRAFT_STRUCTURED = "0";
    process.env.GRAFT_LSP = "false";
    assert.equal(readStructured(dir), false, "GRAFT_STRUCTURED=0 turns the tier off");
    assert.equal(readLsp(dir), false, "GRAFT_LSP=false turns LSP off");
    patchBuildConfig(dir, { structured: false, lsp: false });
    process.env.GRAFT_STRUCTURED = "1";
    process.env.GRAFT_LSP = "1";
    process.env.GRAFT_DOCUMENTS = "1";
    assert.equal(readStructured(dir), true, "GRAFT_STRUCTURED=1 beats a persisted false");
    assert.equal(readLsp(dir), true, "GRAFT_LSP=1 beats a persisted false");
    assert.equal(readDocuments(dir), true);
    process.env.GRAFT_DOCUMENTS = "0";
    assert.equal(readDocuments(dir), false, "GRAFT_DOCUMENTS=0 turns documents off");
    process.env.GRAFT_STRUCTURED = "";
    process.env.GRAFT_LSP = "";
    patchBuildConfig(dir, { structured: true, lsp: true });
    assert.equal(readStructured(dir), true, "an empty value defers to the saved choice");
    assert.equal(readLsp(dir), true);
  });
});

test("cli: a plain build indexes Markdown and JSON, and saves nothing", async () => {
  const dir = repoWithDocs("defaults-cli-plain");
  const r = build(dir);
  assert.equal(r.status, 0, r.describe());
  assert.deepEqual(paths(dir), ["README.md", "config.json", "src/util.ts"]);
  assert.deepEqual(config(dir), {}, "a default is not persisted");
});

test("cli: --no-structured leaves them out and remembers it for the next build", async () => {
  const dir = repoWithDocs("defaults-cli-no-structured");
  const off = build(dir, "--no-structured");
  assert.equal(off.status, 0, off.describe());
  assert.deepEqual(paths(dir), ["src/util.ts"]);
  assert.equal(config(dir).structured, false);
  const again = build(dir);
  assert.equal(again.status, 0, again.describe());
  assert.deepEqual(paths(dir), ["src/util.ts"], "a later plain build keeps the choice");
  const on = build(dir, "--structured");
  assert.equal(on.status, 0, on.describe());
  assert.deepEqual(paths(dir), ["README.md", "config.json", "src/util.ts"], "--structured turns it back on");
});

test("cli: --no-documents and --no-lsp are saved, and each help line names its off switch", async () => {
  const dir = repoWithDocs("defaults-cli-no-others");
  const r = build(dir, "--no-documents", "--no-lsp");
  assert.equal(r.status, 0, r.describe());
  const saved = config(dir);
  assert.equal(saved.documents, false);
  assert.equal(saved.lsp, false);
  assert.equal(saved.structured, undefined, "an unrelated switch is not touched");
  const help = runCli(["build", "--help"]);
  assert.equal(help.status, 0, help.describe());
  for (const flag of ["--no-structured", "--no-documents", "--no-lsp"]) {
    assert.match(help.stdout, new RegExp(flag), `${flag} is listed in build --help`);
  }
  assert.doesNotMatch(help.stdout, /--lsp[^-]*opt-in/, "--lsp is no longer described as opt-in");
});
