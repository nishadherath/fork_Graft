/**
 * Cards against wiring: `graft check` reports a card tree that no longer agrees with
 * `wiring.json`, the query-path refresh prunes the cards whose source left the graph,
 * and the concept listing never mistakes a leftover root card for a concept node.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGraph } from "../src/graph/build.js";
import { checkGraph, formatGraphCheckReport } from "../src/graph/check.js";
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

test("check: a card tree built with the wiring reports no card drift", async () => {
  const { dir, outDir } = repo("cards-clean");
  try {
    patchBuildConfig(dir, { structured: true });
    await buildGraph(dir, { contextDir: outDir, reuse: false });
    const r = await checkGraph(dir, { contextDir: outDir });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.cards, { missing: [], stale: [], orphan: [], index: false });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check: an orphan, a missing and an edited card are each named", async () => {
  const { dir, outDir } = repo("cards-drift");
  try {
    patchBuildConfig(dir, { structured: true });
    await buildGraph(dir, { contextDir: outDir, reuse: false });
    rmSync(join(outDir, "README.md"));
    writeFileSync(join(outDir, "src", "util.md"), "# src/util.ts\n\n- ghost · function · L1-L2 — ghost()\n");
    mkdirSync(join(outDir, "old"), { recursive: true });
    writeFileSync(join(outDir, "old", "gone.md"), "# old/gone.ts\n\n_No extracted symbols in this file._\n");

    const r = await checkGraph(dir, { contextDir: outDir });
    assert.equal(r.ok, false);
    assert.deepEqual(r.cards?.missing, ["README.md"]);
    assert.deepEqual(r.cards?.stale, ["src/util.md"]);
    assert.deepEqual(r.cards?.orphan, ["old/gone.md"]);
    const text = formatGraphCheckReport(r);
    assert.match(text, /STALE/);
    assert.match(text, /cards/i);
    assert.match(text, /old\/gone\.md/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check: a graph with no cards at all is not card drift", async () => {
  const { dir, outDir } = repo("cards-none");
  try {
    await buildGraph(dir, { contextDir: outDir, reuse: false, graphOnly: true });
    const r = await checkGraph(dir, { contextDir: outDir });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.cards?.missing.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

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
    const r = await checkGraph(dir, { contextDir: outDir });
    assert.deepEqual(r.cards, { missing: [], stale: [], orphan: [], index: false });
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
