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
import { runCli, tmpRepo } from "./helpers.js";
import { pdf, zip } from "./document-fixtures.js";
import { ask } from "../src/ask/ask.js";
import { buildGraph, type GraphBuildResult } from "../src/graph/build.js";
import { checkGraph } from "../src/graph/check.js";
import { emptyExtractCache } from "../src/graph/extract-cache.js";
import { probeDrift } from "../src/graph/fingerprint.js";
import { prepareDocuments } from "../src/graph/structured/documents/cache.js";
import { importOptional, MissingConverterError } from "../src/graph/structured/documents/load.js";
import { readGraph, wiringPath } from "../src/graph/write.js";
import { grepGraph } from "../src/search/grep.js";
import { patchBuildConfig, readBuildConfig, readDocuments } from "../src/util/state.js";
import { listContextFiles } from "../src/context/build.js";
import { enrichGraph, MAX_DEEP_UNITS_PER_STRUCTURED_FILE } from "../src/graph/enrich.js";
import { supportedExtensions } from "../src/graph/source-files.js";
import { relPosix } from "../src/util/paths.js";
import type { CruxSummarizer, FileCruxInput } from "../src/ai/crux.js";
import type { GraphV1, NodeV1 } from "../src/graph/types.js";

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** Line N of the expected rendering is `lines[N - 1]`. */
const text = (lines: readonly string[]): string => lines.join("\n") + "\n";

interface Built {
  root: string;
  graph: GraphV1;
  result: GraphBuildResult;
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
  const result = await buildGraph(root, { reuse: false });
  const graph = readGraph(wiringPath(join(root, "graft")))!;
  const renderingRel = (bytes: Uint8Array): string => `graft/.graph/docs/${sha256(bytes)}.txt`;
  return { root, graph, result, renderingRel, rendering: (bytes) => readFileSync(join(root, renderingRel(bytes)), "utf8") };
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

const ODF_NS =
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" ' +
  'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" ' +
  'xmlns:presentation="urn:oasis:names:tc:opendocument:xmlns:presentation:1.0"';

test("documents: an ODT renders LibreOffice's pages, outline headings, lists and tables, and no notes", async () => {
  const body = [
    "<text:sequence-decls/>",
    '<text:h text:outline-level="1">Overview</text:h>',
    '<text:p>First<text:s text:c="2"/>para<text:tab/>tabbed.</text:p>',
    "<text:list><text:list-item><text:p>Bullet one</text:p></text:list-item></text:list>",
    // LibreOffice laid page 2 out from the middle of this paragraph.
    "<text:p>Before break<text:soft-page-break/> after break</text:p>",
    '<text:h text:outline-level="2">Data</text:h>',
    "<table:table><table:table-row><table:table-cell><text:p>k</text:p></table:table-cell>" +
      "<table:table-cell><text:p>v</text:p></table:table-cell></table:table-row></table:table>",
    "<text:p>Cited<text:note><text:note-citation>1</text:note-citation>" +
      "<text:note-body><text:p>Footnote</text:p></text:note-body></text:note> text.</text:p>",
  ].join("");
  const bytes = zip({
    mimetype: "application/vnd.oasis.opendocument.text",
    "content.xml": `<office:document-content ${ODF_NS}><office:body><office:text>${body}</office:text></office:body></office:document-content>`,
  });
  const { graph, rendering, renderingRel } = await build("odt", { "spec.odt": bytes });

  const expected = [
    "<!-- page 1 -->",       //  1
    "# Overview",            //  2
    "",                      //  3
    "First  para\ttabbed.",  //  4
    "",                      //  5
    "Bullet one",            //  6
    "",                      //  7
    "Before break",          //  8
    "",                      //  9
    "<!-- page 2 -->",       // 10
    "after break",           // 11
    "",                      // 12
    "## Data",               // 13
    "",                      // 14
    "k | v",                 // 15
    "",                      // 16
    "Cited text.",           // 17
  ];
  assert.equal(rendering(bytes), text(expected));
  const overview = nodeById(graph, "spec.odt#section:overview");
  const data = nodeById(graph, "spec.odt#section:data");
  assert.equal(overview.signature, `spec.odt (page 1) -> ${renderingRel(bytes)}:L2-L17`);
  assert.equal(data.signature, `spec.odt (page 2) -> ${renderingRel(bytes)}:L13-L17`);
  assert.equal(nodeById(graph, "spec.odt").signature, `spec.odt -> ${renderingRel(bytes)} (2 pages)`);
});

test("documents: an ODT paragraph styled as a heading is one, as LibreOffice writes a heading that opens a page", async () => {
  // LibreOffice writes a heading that starts a new page style as text:p with an
  // automatic style whose parent is "Heading 1"; levels also come from a style's
  // default outline level, followed through its parents.
  const automatic =
    '<office:automatic-styles><style:style style:name="P1" style:family="paragraph" style:parent-style-name="Heading_20_1"/>' +
    '<style:style style:name="P2" style:family="paragraph" style:parent-style-name="Deep"/></office:automatic-styles>';
  const styles =
    `<office:document-styles ${ODF_NS} xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"><office:styles>` +
    '<style:style style:name="Heading_20_1" style:display-name="Heading 1" style:family="paragraph" style:parent-style-name="Heading"/>' +
    '<style:style style:name="Outlined" style:family="paragraph" style:default-outline-level="3"/>' +
    '<style:style style:name="Deep" style:family="paragraph" style:parent-style-name="Outlined"/>' +
    "</office:styles></office:document-styles>";
  const body = '<text:p text:style-name="P1">Overview</text:p><text:p>Body.</text:p><text:p text:style-name="P2">Fine print</text:p>';
  const bytes = zip({
    "content.xml": `<office:document-content ${ODF_NS} xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0">${automatic}<office:body><office:text>${body}</office:text></office:body></office:document-content>`,
    "styles.xml": styles,
  });
  const { graph, rendering } = await build("odt-styled", { "styled.odt": bytes });
  assert.equal(rendering(bytes), text(["# Overview", "", "Body.", "", "### Fine print"]));
  assert.ok(nodeById(graph, "styled.odt#section:overview"));
  assert.ok(nodeById(graph, "styled.odt#section:fine-print"));
});

test("documents: an EPUB renders its spine in order, a chapter marker each, headings from h1 to h6", async () => {
  const xhtml = (body: string, head = ""): string =>
    `<?xml version="1.0" encoding="utf-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml"><head>${head}</head><body>${body}</body></html>`;
  const bytes = zip({
    mimetype: "application/epub+zip",
    "META-INF/container.xml":
      '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles>' +
      '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    // The manifest lists chapter two first; the spine decides the reading order.
    "OEBPS/content.opf":
      '<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><manifest>' +
      '<item id="ch2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>' +
      '<item id="ch1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>' +
      '<item id="css" href="style.css" media-type="text/css"/>' +
      '</manifest><spine><itemref idref="ch1"/><itemref idref="ch2"/></spine></package>',
    "OEBPS/text/ch1.xhtml": xhtml(
      "<h1>Chapter One</h1><p>It was a <em>dark</em>\n  night.</p><p>Line<br/>break</p>",
      "<title>One</title><style>p { margin: 0 }</style>",
    ),
    "OEBPS/text/ch2.xhtml": xhtml(
      "<section><h2>Second &amp; last</h2><ul><li>first item</li><li>second item</li></ul>" +
        "<pre>code  line 1\ncode line 2</pre></section>",
    ),
  });
  const { graph, rendering, renderingRel } = await build("epub", { "book.epub": bytes });

  const expected = [
    "<!-- chapter 1 -->",   //  1
    "# Chapter One",        //  2
    "",                     //  3
    "It was a dark night.", //  4
    "",                     //  5
    "Line",                 //  6
    "break",                //  7
    "",                     //  8
    "<!-- chapter 2 -->",   //  9
    "## Second & last",     // 10
    "",                     // 11
    "first item",           // 12
    "",                     // 13
    "second item",          // 14
    "",                     // 15
    "code  line 1",         // 16
    "code line 2",          // 17
  ];
  assert.equal(rendering(bytes), text(expected));
  // An h2 nests under the h1 before it, as in Markdown, whichever chapter it is in.
  assert.equal(nodeById(graph, "book.epub#section:chapter-one").signature, `book.epub (chapter 1) -> ${renderingRel(bytes)}:L2-L17`);
  assert.equal(nodeById(graph, "book.epub#section:second--last").signature, `book.epub (chapter 2) -> ${renderingRel(bytes)}:L10-L17`);
  assert.equal(nodeById(graph, "book.epub").signature, `book.epub -> ${renderingRel(bytes)} (2 chapters)`);
});

test("documents: a PPTX renders slides in presentation order, titled by the title placeholder", async () => {
  const P = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const shape = (paragraphs: string[], placeholder?: string): string =>
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="s"/><p:cNvSpPr/><p:nvPr>${placeholder ? `<p:ph type="${placeholder}"/>` : ""}</p:nvPr></p:nvSpPr>` +
    `<p:txBody><a:bodyPr/>${paragraphs.map((t) => `<a:p><a:r><a:rPr lang="en-AU"/><a:t>${t}</a:t></a:r></a:p>`).join("")}</p:txBody></p:sp>`;
  const slide = (shapes: string): string => `<p:sld ${P}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:sld>`;
  const table =
    '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="t"/></p:nvGraphicFramePr><a:graphic><a:graphicData><a:tbl>' +
    "<a:tr><a:tc><a:txBody><a:p><a:r><a:t>Cost</a:t></a:r></a:p></a:txBody></a:tc>" +
    "<a:tc><a:txBody><a:p><a:r><a:t>Low</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>";
  const bytes = zip({
    // slide2.xml is listed first, so it is slide 1.
    "ppt/presentation.xml": `<p:presentation ${P}><p:sldIdLst><p:sldId id="257" r:id="rId3"/><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>`,
    "ppt/_rels/presentation.xml.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>' +
      "</Relationships>",
    "ppt/slides/slide1.xml": slide(shape(["Closing remarks"]) + table),
    "ppt/slides/slide2.xml": slide(shape(["Agenda"], "title") + shape(["Goals", "Risks"], "body")),
  });
  const { graph, rendering, renderingRel } = await build("pptx", { "deck.pptx": bytes });

  const expected = [
    "<!-- slide 1: Agenda -->", // 1
    "Goals",                    // 2
    "Risks",                    // 3
    "",                         // 4
    "<!-- slide 2 -->",         // 5
    "Closing remarks",          // 6
    "",                         // 7
    "Cost",                     // 8
    "Low",                      // 9
  ];
  assert.equal(rendering(bytes), text(expected));
  const first = nodeById(graph, "deck.pptx#section:slide-1");
  assert.equal(first.name, "slide 1: Agenda");
  assert.equal(first.signature, `deck.pptx (slide 1) -> ${renderingRel(bytes)}:L1-L3`);
  assert.equal(nodeById(graph, "deck.pptx#section:slide-2").signature, `deck.pptx (slide 2) -> ${renderingRel(bytes)}:L5-L9`);
  assert.equal(nodeById(graph, "deck.pptx").signature, `deck.pptx -> ${renderingRel(bytes)} (2 slides)`);
});

test("documents: an ODP renders a slide per draw:page, titled by its title frame, without speaker notes", async () => {
  const pages =
    '<draw:page draw:name="page1">' +
    '<draw:frame presentation:class="title"><draw:text-box><text:p>Roadmap</text:p></draw:text-box></draw:frame>' +
    '<draw:frame presentation:class="outline"><draw:text-box><text:list>' +
    "<text:list-item><text:p>Q1 launch</text:p></text:list-item><text:list-item><text:p>Q2 scale</text:p></text:list-item>" +
    "</text:list></draw:text-box></draw:frame>" +
    "<presentation:notes><draw:frame><draw:text-box><text:p>Speaker only</text:p></draw:text-box></draw:frame></presentation:notes>" +
    "</draw:page>" +
    '<draw:page draw:name="page2"><draw:frame><draw:text-box><text:p>Thanks</text:p></draw:text-box></draw:frame></draw:page>';
  const bytes = zip({
    mimetype: "application/vnd.oasis.opendocument.presentation",
    "content.xml": `<office:document-content ${ODF_NS}><office:body><office:presentation>${pages}</office:presentation></office:body></office:document-content>`,
  });
  const { graph, rendering, renderingRel } = await build("odp", { "talk.odp": bytes });

  assert.equal(rendering(bytes), text([
    "<!-- slide 1: Roadmap -->", // 1
    "Q1 launch",                 // 2
    "Q2 scale",                  // 3
    "",                          // 4
    "<!-- slide 2 -->",          // 5
    "Thanks",                    // 6
  ]));
  assert.equal(nodeById(graph, "talk.odp#section:slide-1").signature, `talk.odp (slide 1) -> ${renderingRel(bytes)}:L1-L3`);
  assert.equal(nodeById(graph, "talk.odp#section:slide-2").signature, `talk.odp (slide 2) -> ${renderingRel(bytes)}:L5-L6`);
});

test("documents: a PDF past 1 MB is read, one past GRAFT_DOCUMENT_MAX_BYTES is skipped with a warning", async () => {
  const big = pdf([["Large but allowed"]], 1_100_000);
  const huge = pdf([["Too large"]], 1_300_000);
  process.env.GRAFT_DOCUMENT_MAX_BYTES = "1200000";
  try {
    const { root, graph, result } = await build("cap", { "big.pdf": big, "huge.pdf": huge });
    assert.ok(nodeById(graph, "big.pdf#section:page-1"));
    assert.equal(graph.nodes.some((n) => n.path === "huge.pdf"), false);
    assert.deepEqual(result.warnings, [
      `huge.pdf: skipped, ${huge.length} bytes is over the documents tier's cap of 1200000 bytes (GRAFT_DOCUMENT_MAX_BYTES)`,
    ]);
    // The probe walks with the same cap, so the skipped file never reads as new.
    assert.deepEqual(probeDrift(root, join(root, "graft")), { changed: [], added: [], removed: [] });
  } finally {
    delete process.env.GRAFT_DOCUMENT_MAX_BYTES;
  }
});

test("documents: a PDF with no text layer keeps its page markers and says so once", async () => {
  const bytes = pdf([[], []]);
  const { graph, rendering, result } = await build("scanned", { "scan.pdf": bytes });
  assert.equal(rendering(bytes), text(["<!-- page 1 -->", "", "<!-- page 2 -->"]));
  assert.equal(graph.nodes.filter((n) => n.path === "scan.pdf" && n.kind === "section").length, 0);
  assert.deepEqual(result.warnings, ["scan.pdf: no text in its 2 pages (a scanned PDF has no text layer); only its page markers are indexed"]);
});

test("documents: a converter package that is not installed is refused by name, and not cached", async () => {
  await assert.rejects(importOptional("graft-no-such-package", "graft-no-such-package/x.mjs"), (err: unknown) => {
    assert.ok(err instanceof MissingConverterError);
    assert.equal(err.packageName, "graft-no-such-package");
    assert.match(err.message, /graft-no-such-package is not installed/);
    assert.match(err.message, /npm install graft-no-such-package/);
    return true;
  });
  const root = tmpRepo("documents-missing");
  writeFileSync(join(root, "a.pdf"), pdf([["x"]]));
  const missing = async (): Promise<never> => {
    throw new MissingConverterError("pdfjs-dist");
  };
  const prepared = await prepareDocuments(root, join(root, "graft"), [{ abs: join(root, "a.pdf"), rel: "a.pdf" }], emptyExtractCache(), missing);
  assert.deepEqual(prepared.get("a.pdf"), { status: "missing", format: "pdf", packageName: "pdfjs-dist" });
});

test("documents: ask --source prints the rendering's lines, and its pointer and grep's name the rendering", async () => {
  const bytes = pdf([["Alpha first page"], ["Quokka habitat survey", "Rottnest Island counts"]]);
  const { root, graph, renderingRel } = await build("ask", { "docs/survey.pdf": bytes });

  const result = ask(root, "quokka habitat survey", { source: true });
  const hit = result.hits.find((h) => h.title === "page 2 · section");
  assert.ok(hit, `no page 2 hit (got: ${result.hits.map((h) => h.title).join(", ")})`);
  // The pointer opens with any tool; the snippet names the binary and its page.
  assert.equal(hit.pointer, `${renderingRel(bytes)}:L4-L6`);
  assert.equal(hit.snippet, `survey.pdf (page 2) -> ${renderingRel(bytes)}:L4-L6`);
  assert.equal(hit.code, ["<!-- page 2 -->", "Quokka habitat survey", "Rottnest Island counts"].join("\n"));

  const found = grepGraph(graph, root, "Rottnest");
  assert.equal(found.totalHits, 1);
  const group = found.groups[0]!;
  assert.equal(group.path, renderingRel(bytes));
  assert.equal(group.symbol?.id, "docs/survey.pdf#section:page-2");
  assert.equal(group.symbol?.path, renderingRel(bytes));
  assert.equal(group.symbol?.span, "L4-L6");
  assert.deepEqual(group.hits, [{ line: 6, text: "Rottnest Island counts" }]);
});

test("documents: --documents is persisted, needs the structured tier, and has an env twin", () => {
  const root = tmpRepo("documents-cli");
  writeFileSync(join(root, "a.pdf"), pdf([["Cli page"]]));
  const saved = { s: process.env.GRAFT_STRUCTURED, d: process.env.GRAFT_DOCUMENTS };
  try {
    delete process.env.GRAFT_STRUCTURED;
    delete process.env.GRAFT_DOCUMENTS;
    const on = runCli(["build", root, "--structured", "--documents"]);
    assert.equal(on.status, 0, on.describe());
    assert.equal(readBuildConfig(root)?.documents, true);
    assert.ok(readGraph(wiringPath(join(root, "graft")))!.nodes.some((n) => n.id === "a.pdf#section:page-1"));
    assert.ok(supportedExtensions(true, true).includes(".pdf"));
    assert.ok(!supportedExtensions(true, false).includes(".pdf"), ".pdf must not read as supported while the tier is off");

    // Without the structured tier the documents tier is off, whatever was chosen.
    patchBuildConfig(root, { structured: false });
    assert.equal(readDocuments(root), false);
    patchBuildConfig(root, { structured: true });
    process.env.GRAFT_DOCUMENTS = "0";
    assert.equal(readDocuments(root), false, "GRAFT_DOCUMENTS=0 is an explicit off");
    delete process.env.GRAFT_DOCUMENTS;

    const off = runCli(["build", root, "--no-documents"]);
    assert.equal(off.status, 0, off.describe());
    assert.equal(readBuildConfig(root)?.documents, false);
    assert.equal(readGraph(wiringPath(join(root, "graft")))!.nodes.some((n) => n.path === "a.pdf"), false);

    const lonely = runCli(["build", root, "--no-structured", "--documents"]);
    assert.equal(lonely.status, 0, lonely.describe());
    assert.match(lonely.stderr, /--documents needs the structured tier/);
  } finally {
    for (const [key, value] of [["GRAFT_STRUCTURED", saved.s], ["GRAFT_DOCUMENTS", saved.d]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("documents: --deep sends no document unit unless --deep-documents asks, and then only the first units", async () => {
  const unit = (id: string, line: number): NodeV1 => ({
    id, name: id, kind: id.includes("#") ? "section" : "file", path: "manual.pdf", span: `L${line}-L${line}`,
    signature: id, exported: true, origin: "generic", body_hash: `h-${id}`, summary_state: "pending", summary: null, crux: null,
  });
  const nodes = (): NodeV1[] => [
    unit("manual.pdf", 1),
    ...Array.from({ length: MAX_DEEP_UNITS_PER_STRUCTURED_FILE + 5 }, (_, i) => unit(`manual.pdf#section:page-${i + 1}`, i + 2)),
  ];
  const sent: string[] = [];
  const summarizer: CruxSummarizer = {
    async describeFile(input: FileCruxInput) {
      sent.push(...input.nodes.map((n) => n.id));
      return input.nodes.map((n) => ({ id: n.id, summary: `about ${n.id}`, crux_start: 0, crux_end: 0 }));
    },
  };
  const sources = new Map([["manual.pdf", "rendering text"]]);

  await enrichGraph(nodes(), new Map(), sources, { summarizer });
  assert.deepEqual(sent, [], "a document costs nothing by default");

  await enrichGraph(nodes(), new Map(), sources, { summarizer, deepDocuments: true });
  assert.equal(sent.filter((id) => id.includes("#section:")).length, MAX_DEEP_UNITS_PER_STRUCTURED_FILE);

  // The concept pass never reads a document, even with the tier on.
  const root = tmpRepo("documents-concepts");
  writeFileSync(join(root, "manual.pdf"), pdf([["x"]]));
  writeFileSync(join(root, "a.ts"), "export const a = 1;\n");
  patchBuildConfig(root, { structured: true, documents: true });
  assert.deepEqual(listContextFiles(root, join(root, "graft"), undefined).map((f) => relPosix(root, f)), ["a.ts"]);
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
