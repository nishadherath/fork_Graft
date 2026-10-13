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
import { pdf, zip } from "./document-fixtures.js";
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

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const para = (inner: string, style?: string): string =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}${inner}</w:p>`;
const run = (t: string): string => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;
const cell = (t: string): string => `<w:tc><w:tcPr/>${para(run(t))}</w:tc>`;

test("documents: a DOCX renders Word's pages, heading styles, tables, and no deleted text", async () => {
  const styles =
    `<w:styles ${W}>` +
    `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Sub"><w:name w:val="Subsection"/><w:basedOn w:val="Heading2"/></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style>` +
    `</w:styles>`;
  const body = [
    para(run("Field notes"), "Title"),
    para(run("Introduction"), "Heading1"),
    para(run("Intro text &amp; more.")),
    // Word laid page 2 out from the middle of this paragraph.
    para(run("Start of a long paragraph") + `<w:r><w:lastRenderedPageBreak/><w:t xml:space="preserve"> that ends on page two.</w:t></w:r>`),
    para(run("Details"), "Sub"),
    `<w:tbl><w:tblPr/><w:tr>${cell("Name")}${cell("Value")}</w:tr><w:tr>${cell("alpha")}${cell("1")}</w:tr></w:tbl>`,
    para(run("Kept ") + `<w:del w:id="1"><w:r><w:delText>gone</w:delText></w:r></w:del><w:ins w:id="2">${run("added")}</w:ins>`),
    para(run("# not a heading")),
    para(`<w:r><w:lastRenderedPageBreak/><w:t>Results</w:t></w:r>`, "Heading1"),
    para(`${run("Final")}<w:r><w:tab/><w:t>words</w:t></w:r>`),
  ].join("");
  const bytes = zip({
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${W}><w:body>${body}<w:sectPr/></w:body></w:document>`,
    "word/styles.xml": styles,
  });
  const { graph, rendering, renderingRel } = await build("docx", { "notes.docx": bytes });

  const expected = [
    "<!-- page 1 -->",            //  1
    "Field notes",                //  2
    "",                           //  3
    "# Introduction",             //  4
    "",                           //  5
    "Intro text & more.",         //  6
    "",                           //  7
    "Start of a long paragraph",  //  8
    "",                           //  9
    "<!-- page 2 -->",            // 10
    "that ends on page two.",     // 11
    "",                           // 12
    "## Details",                 // 13
    "",                           // 14
    "Name | Value",               // 15
    "alpha | 1",                  // 16
    "",                           // 17
    "Kept added",                 // 18
    "",                           // 19
    "\\# not a heading",          // 20
    "",                           // 21
    "<!-- page 3 -->",            // 22
    "# Results",                  // 23
    "",                           // 24
    "Final\twords",               // 25
  ];
  assert.equal(rendering(bytes), text(expected));

  const at = (id: string, span: string, page: number): void => {
    const n = nodeById(graph, id);
    assert.equal(n.span, span, id);
    assert.equal(n.signature, `notes.docx (page ${page}) -> ${renderingRel(bytes)}:${span}`);
  };
  // A section stops before the marker of the page its successor opens.
  at("notes.docx#section:introduction", "L4-L20", 1);
  at("notes.docx#section:details", "L13-L20", 2);
  at("notes.docx#section:results", "L23-L25", 3);
  assert.equal(graph.nodes.filter((n) => n.kind === "section").length, 3);
  assert.equal(nodeById(graph, "notes.docx").signature, `notes.docx -> ${renderingRel(bytes)} (3 pages)`);
});

test("documents: a DOCX no editor laid out gets no page markers, and its locator names no page", async () => {
  const bytes = zip({
    "word/document.xml": `<w:document ${W}><w:body>${para(run("Only"), "Heading1")}${para(run("Body"))}</w:body></w:document>`,
  });
  const { graph, rendering, renderingRel } = await build("docx-unpaged", { "plain.docx": bytes });
  assert.equal(rendering(bytes), text(["# Only", "", "Body"]));
  assert.equal(nodeById(graph, "plain.docx#section:only").signature, `plain.docx -> ${renderingRel(bytes)}:L1-L3`);
  assert.equal(nodeById(graph, "plain.docx").signature, `plain.docx -> ${renderingRel(bytes)}`);
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
