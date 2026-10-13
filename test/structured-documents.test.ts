/**
 * The documents tier (Stage 4): a PDF, DOCX, ODT, EPUB, PPTX or ODP file becomes a
 * deterministic text rendering at `graft/.graph/docs/<sha256>.txt`, and its units
 * are `section` nodes whose spans are lines of that rendering.
 *
 * Every fixture is built in the test and every expected rendering is written out
 * line by line, so a span can be checked against the line it must hold. The node's
 * own path stays the binary's (cards, ids and `--only-dir` key on it); the
 * signature names the binary, its page or slide, and the rendering's exact lines.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpRepo } from "./helpers.js";
import { pdf } from "./document-fixtures.js";
import { buildGraph } from "../src/graph/build.js";
import { checkGraph } from "../src/graph/check.js";
import { probeDrift } from "../src/graph/fingerprint.js";
import { readGraph, wiringPath } from "../src/graph/write.js";
import { patchBuildConfig } from "../src/util/state.js";
import type { GraphV1, NodeV1 } from "../src/graph/types.js";

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** Line N of the expected rendering is `lines[N - 1]`. */
const text = (lines: readonly string[]): string => lines.join("\n") + "\n";

interface Built {
  root: string;
  graph: GraphV1;
  rendering: (bytes: Uint8Array) => string;
  renderingRel: (bytes: Uint8Array) => string;
}

/** A repository holding `files`, built with the structured and documents tiers on. */
async function build(tag: string, files: Readonly<Record<string, Uint8Array | string>>): Promise<Built> {
  const root = tmpRepo(`documents-${tag}`);
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  patchBuildConfig(root, { structured: true, documents: true });
  await buildGraph(root, { reuse: false });
  const graph = readGraph(wiringPath(join(root, "graft")))!;
  const renderingRel = (bytes: Uint8Array): string => `graft/.graph/docs/${sha256(bytes)}.txt`;
  return { root, graph, renderingRel, rendering: (bytes) => readFileSync(join(root, renderingRel(bytes)), "utf8") };
}

function nodeById(graph: GraphV1, id: string): NodeV1 {
  const hit = graph.nodes.find((n) => n.id === id);
  assert.ok(hit, `no node ${id} (got: ${graph.nodes.map((n) => n.id).join(", ")})`);
  return hit;
}

/** The rendering's lines a span names, 1-based inclusive. */
function linesOf(rendering: string, span: string): string[] {
  const m = /^L(\d+)-L(\d+)$/.exec(span);
  assert.ok(m, `not a span: ${span}`);
  return rendering.split("\n").slice(Number(m[1]) - 1, Number(m[2]));
}

test("documents: a two-page PDF renders one marker per page and a section per page", async () => {
  const bytes = pdf([["Alpha first page", "second line"], ["Beta page two"]]);
  const { graph, rendering, renderingRel } = await build("pdf", { "docs/report.pdf": bytes });

  const expected = [
    "<!-- page 1 -->",   // 1
    "Alpha first page",  // 2
    "second line",       // 3
    "",                  // 4
    "<!-- page 2 -->",   // 5
    "Beta page two",     // 6
  ];
  assert.equal(rendering(bytes), text(expected));

  const page1 = nodeById(graph, "docs/report.pdf#section:page-1");
  const page2 = nodeById(graph, "docs/report.pdf#section:page-2");
  assert.equal(page1.kind, "section");
  assert.equal(page1.path, "docs/report.pdf");
  assert.equal(page1.span, "L1-L3");
  assert.equal(page2.span, "L5-L6");
  assert.deepEqual(linesOf(rendering(bytes), page1.span), expected.slice(0, 3));
  assert.deepEqual(linesOf(rendering(bytes), page2.span), expected.slice(4, 6));
  assert.equal(page1.signature, `report.pdf (page 1) -> ${renderingRel(bytes)}:L1-L3`);
  assert.equal(page2.signature, `report.pdf (page 2) -> ${renderingRel(bytes)}:L5-L6`);

  const file = nodeById(graph, "docs/report.pdf");
  assert.equal(file.kind, "file");
  assert.equal(file.span, "L1-L6");
  assert.equal(file.signature, `report.pdf -> ${renderingRel(bytes)} (2 pages)`);
});

test("documents: a rebuild replays the rendering, an edit replaces it, and the probe and check stay clean", async () => {
  const first = pdf([["Version one"]]);
  const second = pdf([["Version two"], ["Appendix"]]);
  const { root, renderingRel } = await build("cache", { "spec.pdf": first });
  const outDir = join(root, "graft");
  assert.ok(existsSync(join(root, renderingRel(first))));
  assert.deepEqual(probeDrift(root, outDir), { changed: [], added: [], removed: [] });
  assert.equal((await checkGraph(root)).ok, true);
  // A touch moves the mtime, not the bytes: the probe must hash the bytes, not a
  // text decoding of them, or every touched PDF reads as changed.
  utimesSync(join(root, "spec.pdf"), new Date("2030-01-01"), new Date("2030-01-01"));
  assert.deepEqual(probeDrift(root, outDir), { changed: [], added: [], removed: [] });

  const replay = await buildGraph(root);
  assert.equal(replay.reused, 1);
  assert.equal(replay.parsed, 0);

  writeFileSync(join(root, "spec.pdf"), second);
  assert.deepEqual(probeDrift(root, outDir)?.changed, ["spec.pdf"]);
  assert.equal((await checkGraph(root)).ok, false);
  await buildGraph(root);
  assert.ok(existsSync(join(root, renderingRel(second))));
  assert.equal(existsSync(join(root, renderingRel(first))), false, "the stale rendering is deleted");
  assert.deepEqual(probeDrift(root, outDir), { changed: [], added: [], removed: [] });
  assert.equal((await checkGraph(root)).ok, true);
  const graph = readGraph(wiringPath(outDir))!;
  assert.deepEqual(
    graph.nodes.filter((n) => n.kind === "section").map((n) => n.id),
    ["spec.pdf#section:page-1", "spec.pdf#section:page-2"],
  );

  // With the tier off, the documents leave the graph and their renderings go too.
  patchBuildConfig(root, { documents: false });
  await buildGraph(root);
  assert.equal(existsSync(join(root, renderingRel(second))), false);
  assert.equal(readGraph(wiringPath(outDir))!.nodes.some((n) => n.path === "spec.pdf"), false);
});
