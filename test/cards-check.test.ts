/**
 * The query-path refresh prunes the cards whose source left the wiring, and the concept
 * listing never mistakes a leftover root card for a concept node.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGraph } from "../src/graph/build.js";
import { readNodes } from "../src/context/node-file.js";
import { patchBuildConfig } from "../src/util/state.js";

function repo(tag: string): { dir: string; outDir: string } {
  const dir = mkdtempSync(join(tmpdir(), `graft-${tag}-`));
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "util.ts"), "export function util(): number {\n  return 1;\n}\n");
  writeFileSync(join(dir, "README.md"), "# Title\n\nBody.\n");
  writeFileSync(join(dir, "Dockerfile"), "FROM node:22\nRUN echo hi\n");
  return { dir, outDir: join(dir, "graft") };
}

test("refresh: switching the structured tier off prunes its cards and rewrites INDEX.md", async () => {
  const { dir, outDir } = repo("cards-prune");
  try {
    patchBuildConfig(dir, { structured: true });
    await buildGraph(dir, { contextDir: outDir, reuse: false });
    assert.ok(existsSync(join(outDir, "README.md")));
    assert.ok(existsSync(join(outDir, "Dockerfile.md")));

    patchBuildConfig(dir, { structured: false });
    await buildGraph(dir, { contextDir: outDir, reuse: false, graphOnly: true });

    assert.equal(existsSync(join(outDir, "README.md")), false, "the README card went with its nodes");
    assert.equal(existsSync(join(outDir, "Dockerfile.md")), false, "the Dockerfile card went with its nodes");
    assert.ok(existsSync(join(outDir, "src", "util.md")), "a card whose file is still indexed stays");
    const index = readFileSync(join(outDir, "INDEX.md"), "utf8");
    assert.doesNotMatch(index, /Dockerfile/);
    assert.match(index, /1 per-file wiring cards/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("concepts: a root card for a file that left the wiring is not listed as a concept", () => {
  const out = mkdtempSync(join(tmpdir(), "graft-cards-concepts-"));
  try {
    // A card for a file without an extension, left behind by a tier that was switched off.
    writeFileSync(join(out, "Dockerfile.md"), "# Dockerfile\n\n- build · task · L23-L38 — FROM node:22 AS build\n");
    writeFileSync(join(out, "tsconfig.md"), "# tsconfig.json\n\n- strict · key · L3-L3 — strict = true\n");
    writeFileSync(join(out, "empty.md"), "# Makefile\n\n_No extracted symbols in this file._\n");
    writeFileSync(join(out, "notes.md"), "# Notes\n\nHand-written prose.\n");
    assert.deepEqual(readNodes(out).map((n) => n.slug), ["notes"]);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
