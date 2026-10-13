/**
 * The structured tier's spans.
 *
 * Same discipline as `container-extract.test.ts`: every fixture is an array of
 * lines, so the expected line numbers are the array indices + 1 and can be read
 * off the source rather than counted by hand. A span that is off by one is worse
 * than not indexing the file, because graft's promise is an exact `file:line`
 * and a plausible-but-wrong one sends the reader somewhere else with confidence.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractStructured, structuredLangOf } from "../src/graph/structured/index.js";
import type { NodeV1 } from "../src/graph/types.js";

const MD = structuredLangOf("doc.md")!;

/** Line N of the fixture is `lines[N - 1]`: that is the whole point. */
function doc(lines: string[], eol = "\n"): string {
  return lines.join(eol) + eol;
}

function sections(source: string, rel = "doc.md"): NodeV1[] {
  return extractStructured(rel, source, MD).nodes.filter((n) => n.kind === "section");
}

function spanById(nodes: NodeV1[], id: string): string {
  const hit = nodes.find((n) => n.id === id);
  assert.ok(hit, `no node ${id} (got: ${nodes.map((n) => n.id).join(", ")})`);
  return hit.span;
}

const GUIDE = [
  "---",                                   //  1
  "title: Guide",                          //  2
  "draft: false",                          //  3
  "---",                                   //  4
  "",                                      //  5
  "# Guide",                               //  6
  "",                                      //  7
  "Intro paragraph.",                      //  8
  "",                                      //  9
  "## Install",                            // 10
  "",                                      // 11
  "Run it:",                               // 12
  "",                                      // 13
  "```ts",                                 // 14
  "export function boot(): void {",        // 15
  "  // # not a heading",                  // 16
  "}",                                     // 17
  "```",                                   // 18
  "",                                      // 19
  "Setext Two",                            // 20
  "----------",                            // 21
  "",                                      // 22
  "Body of setext two.",                   // 23
  "",                                      // 24
  "### Deep ###",                          // 25
  "",                                      // 26
  "deep text",                             // 27
  "",                                      // 28
  "Setext One",                            // 29
  "==========",                            // 30
  "",                                      // 31
  "last line",                             // 32
];

test("markdown: ATX and setext headings span heading line to the line before the next peer or parent", () => {
  const nodes = sections(doc(GUIDE));
  assert.equal(spanById(nodes, "doc.md#section:guide"), "L6-L28");
  assert.equal(spanById(nodes, "doc.md#section:install"), "L10-L19");
  assert.equal(spanById(nodes, "doc.md#section:setext-two"), "L20-L28");
  assert.equal(spanById(nodes, "doc.md#section:deep"), "L25-L28");
  assert.equal(spanById(nodes, "doc.md#section:setext-one"), "L29-L32");
  assert.equal(nodes.length, 5, "front matter and the fenced comment add no sections");
});

test("markdown: CRLF and a missing final newline do not move a span", () => {
  const crlf = sections(doc(GUIDE, "\r\n"));
  assert.equal(spanById(crlf, "doc.md#section:install"), "L10-L19");
  assert.equal(spanById(crlf, "doc.md#section:setext-one"), "L29-L32");

  const noFinalNewline = sections(GUIDE.join("\n"));
  assert.equal(spanById(noFinalNewline, "doc.md#section:setext-one"), "L29-L32");
});

test("markdown: a byte order mark does not hide the front matter", () => {
  const nodes = sections("﻿" + doc(GUIDE));
  assert.equal(spanById(nodes, "doc.md#section:guide"), "L6-L28");
});

test("markdown: node shape is truthful (kind, signature, owner file, origin)", () => {
  const nodes = sections(doc(GUIDE));
  const install = nodes.find((n) => n.id === "doc.md#section:install")!;
  assert.equal(install.name, "Install");
  assert.equal(install.kind, "section");
  assert.equal(install.signature, "## Install");
  assert.equal(install.path, "doc.md");
  assert.equal(install.origin, "generic");
  const setext = nodes.find((n) => n.id === "doc.md#section:setext-two")!;
  assert.equal(setext.signature, "## Setext Two", "a setext heading is reported at its level");
  const deep = nodes.find((n) => n.id === "doc.md#section:deep")!;
  assert.equal(deep.signature, "### Deep", "closing hashes are not part of the heading");
});

test("markdown: nested sections are linked by contains edges, top level to the file", () => {
  const { rawEdges } = extractStructured("doc.md", doc(GUIDE), MD);
  const pairs = rawEdges
    .filter((e) => e.relation === "contains" && e.targetId!.includes("#section:"))
    .map((e) => `${e.source} > ${e.targetId}`)
    .sort();
  assert.deepEqual(pairs, [
    "doc.md > doc.md#section:guide",
    "doc.md > doc.md#section:setext-one",
    "doc.md#section:guide > doc.md#section:install",
    "doc.md#section:guide > doc.md#section:setext-two",
    "doc.md#section:setext-two > doc.md#section:deep",
  ]);
});

test("markdown: body_text is the section's own text, capped, whitespace normalised", () => {
  const nodes = sections(doc(GUIDE));
  const guide = nodes.find((n) => n.id === "doc.md#section:guide")!;
  assert.equal(guide.body_text, "# Guide Intro paragraph.", "stops at the first sub-heading");
  const install = nodes.find((n) => n.id === "doc.md#section:install")!;
  assert.match(install.body_text ?? "", /boot\(\)/, "fenced code stays searchable text");

  const long = sections(doc(["# Big", "", "word ".repeat(3000)]));
  assert.ok((long[0]!.body_text ?? "").length <= 5000, "the existing cap applies");
});

test("markdown: ids are slugs, deduplicated like symbols", () => {
  const nodes = sections(doc([
    "# Notes",          // 1
    "## Setup",         // 2
    "## Setup",         // 3
    "## `npm run x`: **go** [docs](http://example.com)", // 4
    "## ???",           // 5
  ]));
  assert.deepEqual(nodes.map((n) => n.id), [
    "doc.md#section:notes",
    "doc.md#section:setup",
    "doc.md#section:setup~2",
    "doc.md#section:npm-run-x-go-docs",
    "doc.md#section:section",
  ]);
  assert.equal(nodes[3]!.name, "npm run x: go docs", "inline markup is stripped from the name");
});

test("markdown: things that look like headings but are not", () => {
  const nodes = sections(doc([
    "# Real",                              //  1
    "",                                    //  2
    "#hashtag is not a heading",           //  3
    "",                                    //  4
    "    # indented code",                 //  5
    "",                                    //  6
    "~~~sh",                               //  7
    "# a comment in a tilde fence",        //  8
    "~~~~~",                               //  9  (longer closer is fine)
    "",                                    // 10
    "1. step one",                         // 11
    "   ```sh",                            // 12  fence inside a list item
    "   # build the thing",                // 13
    "   ```",                              // 14
    "",                                    // 15
    "<!--",                                // 16
    "# commented out",                     // 17
    "-->",                                 // 18
    "",                                    // 19
    "---",                                 // 20  thematic break after a blank line
    "",                                    // 21
    "> # quoted heading",                   // 22
    "",                                    // 23
    "| a | b |",                           // 24
    "|---|---|",                           // 25
    "",                                    // 26
    "- list item",                         // 27
    "---",                                 // 28  thematic break, not a setext underline
    "",                                    // 29
    "# Last",                              // 30
  ]));
  assert.deepEqual(nodes.map((n) => [n.id, n.span]), [
    ["doc.md#section:real", "L1-L29"],
    ["doc.md#section:last", "L30-L30"],
  ]);
});

test("markdown: an unclosed fence swallows the rest of the document, as CommonMark does", () => {
  const nodes = sections(doc(["# A", "```", "# B", "text"]));
  assert.deepEqual(nodes.map((n) => [n.id, n.span]), [["doc.md#section:a", "L1-L4"]]);
});

test("markdown: a multi-line paragraph before an underline is one setext heading", () => {
  const nodes = sections(doc(["intro", "", "first line", "second line", "---", "", "body"]));
  assert.deepEqual(nodes.map((n) => [n.id, n.span, n.name]), [
    ["doc.md#section:first-line-second-line", "L3-L7", "first line second line"],
  ]);
});

test("markdown: an empty heading closes the section above it but adds no node", () => {
  const nodes = sections(doc(["# One", "text", "#", "orphan text", "# Two"]));
  assert.deepEqual(nodes.map((n) => [n.id, n.span]), [
    ["doc.md#section:one", "L1-L2"],
    ["doc.md#section:two", "L5-L5"],
  ]);
});

test("markdown: a document with no headings yields only its file node", () => {
  const { nodes, rawEdges } = extractStructured("doc.md", doc(["just text", "more text"]), MD);
  assert.deepEqual(nodes.map((n) => n.kind), ["file"]);
  assert.equal(nodes[0]!.span, "L1-L2");
  assert.deepEqual(rawEdges, []);
});

test("markdown: the file node carries the text before the first heading", () => {
  const { nodes } = extractStructured("doc.md", doc(GUIDE.slice(4)), MD);
  assert.equal(nodes[0]!.kind, "file");
  assert.equal(nodes[0]!.body_text, undefined, "nothing precedes the first heading here");

  const withPreface = extractStructured("doc.md", doc(["Preface words.", "", "# Title"]), MD).nodes[0]!;
  assert.equal(withPreface.body_text, "Preface words.");
});

test("markdown: a # line inside a raw HTML block is not a heading", () => {
  const nodes = sections(doc([
    "# Real",                              //  1
    "",                                    //  2
    "<div>",                               //  3
    "# text in the block",                 //  4
    "</div>",                              //  5
    "",                                    //  6
    "## After the block",                  //  7
    "",                                    //  8
    "body",                                //  9
  ]));
  assert.deepEqual(nodes.map((n) => [n.id, n.span]), [
    ["doc.md#section:real", "L1-L9"],
    ["doc.md#section:after-the-block", "L7-L9"],
  ]);
});

test("markdown: a block-level tag interrupts a paragraph and holds its lines until a blank line", () => {
  const nodes = sections(doc([
    "# Real",                              //  1
    "",                                    //  2
    "Some text",                           //  3
    "<table>",                             //  4  type 6 can interrupt a paragraph
    "# cell",                              //  5
    "</table>",                            //  6
    "",                                    //  7
    "# Next",                              //  8
  ]));
  assert.deepEqual(nodes.map((n) => [n.id, n.span]), [
    ["doc.md#section:real", "L1-L7"],
    ["doc.md#section:next", "L8-L8"],
  ]);
});

test("markdown: <pre>, <script> and <style> blocks run to their closing tag, blank lines included", () => {
  const nodes = sections(doc([
    "# Real",                              //  1
    "",                                    //  2
    "<pre>",                               //  3
    "first",                               //  4
    "",                                    //  5
    "# inside pre after a blank line",     //  6
    "</pre>",                              //  7
    "",                                    //  8
    "<style>",                             //  9
    "",                                    // 10
    "# inside style",                      // 11
    "</style>",                            // 12
    "",                                    // 13
    "# Next",                              // 14
  ]));
  assert.deepEqual(nodes.map((n) => [n.id, n.span]), [
    ["doc.md#section:real", "L1-L13"],
    ["doc.md#section:next", "L14-L14"],
  ]);
});

test("markdown: a block opened and closed on one line, and a comment-like <?...?> or <!X> block, end where CommonMark ends them", () => {
  const nodes = sections(doc([
    "# Real",                              //  1
    "",                                    //  2
    "<script>run()</script>",              //  3  one-line type 1
    "# Heading right after it",            //  4  a heading again: the block is over
    "",                                    //  5
    "<?php",                               //  6
    "# inside a processing instruction",   //  7
    "?>",                                  //  8
    "# After",                             //  9
    "",                                    // 10
    "<!DOCTYPE html>",                     // 11
    "# After the declaration",             // 12
  ]));
  assert.deepEqual(nodes.map((n) => [n.name, n.span]), [
    ["Real", "L1-L3"],
    ["Heading right after it", "L4-L8"],
    ["After", "L9-L11"],
    ["After the declaration", "L12-L12"],
  ]);
});

test("markdown: a lone inline tag line is an HTML block only when it cannot interrupt a paragraph", () => {
  const nodes = sections(doc([
    "# Real",                              //  1
    "",                                    //  2
    "<custom-element attr=\"x\">",         //  3  type 7 after a blank line: a block
    "# inside",                            //  4
    "",                                    //  5
    "text",                                //  6
    "<span>",                              //  7  type 7 cannot interrupt a paragraph
    "",                                    //  8
    "# Next",                              //  9
  ]));
  assert.deepEqual(nodes.map((n) => [n.name, n.span]), [
    ["Real", "L1-L8"],
    ["Next", "L9-L9"],
  ]);
});
