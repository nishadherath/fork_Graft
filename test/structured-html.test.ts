/**
 * HTML, Svelte and Astro: identified elements, embedded script symbols and style
 * rules, every one on its true line of the host file. Fixtures are arrays of
 * lines, so expected line numbers are the indices + 1.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpRepo } from "./helpers.js";
import { extractStructured, structuredLangOf, warmStructuredGrammars } from "../src/graph/structured/index.js";
import { buildGraph } from "../src/graph/build.js";
import { checkGraph } from "../src/graph/check.js";
import { readGraph, wiringPath } from "../src/graph/write.js";
import { patchBuildConfig } from "../src/util/state.js";

before(async () => {
  // Warming only the page languages must be enough: css rides along for <style>.
  await warmStructuredGrammars(["html", "svelte", "astro"]);
});

function doc(lines: string[], eol = "\n"): string {
  return lines.join(eol) + eol;
}

function parse(source: string, rel: string) {
  return extractStructured(rel, source, structuredLangOf(rel)!);
}

function spans(source: string, rel: string): Record<string, string> {
  return Object.fromEntries(parse(source, rel).nodes.filter((n) => n.kind !== "file").map((n) => [n.id.slice(rel.length + 1), n.span]));
}

const PAGE = [
  "<!doctype html>",                       //  1
  "<html>",                                //  2
  "<body>",                                //  3
  '  <div id="app" class="x">',            //  4
  '    <input name="email">',              //  5
  "    <p>hi</p>",                         //  6
  "  </div>",                              //  7
  "  <script>",                            //  8
  "    function boot() {",                 //  9
  "      return 1;",                       // 10
  "    }",                                 // 11
  "  </script>",                           // 12
  "  <style>",                             // 13
  "    .a { color: red; }",               // 14
  "    #app > .b {",                       // 15
  "      x: y;",                           // 16
  "    }",                                 // 17
  "  </style>",                            // 18
  '  <template id="t"><b>x</b></template>',// 19
  "</body>",                               // 20
  "</html>",                               // 21
];

test("html: identified elements, script symbols and style rules land on the page's lines", () => {
  assert.deepEqual(spans(doc(PAGE), "page.html"), {
    "element:div#app": "L4-L7",
    "element:input[name=email]": "L5-L5",
    "element:template#t": "L19-L19",
    "selector:.a": "L14-L14",
    "selector:#app > .b": "L15-L17",
    boot: "L9-L11",
  });
});

test("html: node shape, signatures and nesting", () => {
  const { nodes, rawEdges } = parse(doc(PAGE), "page.html");
  const app = nodes.find((n) => n.name === "div#app")!;
  assert.equal(app.kind, "element");
  assert.equal(app.signature, '<div id="app" class="x">');
  assert.equal(app.origin, "generic");
  assert.match(app.body_text ?? "", /hi/);
  assert.equal(nodes.find((n) => n.name === "boot")!.kind, "function");

  const pairs = rawEdges.map((e) => `${e.source} > ${e.targetId}`);
  assert.ok(pairs.includes("page.html > page.html#element:div#app"));
  assert.ok(pairs.includes("page.html#element:div#app > page.html#element:input[name=email]"));
  assert.ok(pairs.includes("page.html > page.html#boot"));
  // Attribute references (class, src, href) carry `ref` and are resolved later;
  // everything the script itself yields is structure only.
  assert.deepEqual([...new Set(rawEdges.filter((e) => e.ref === undefined).map((e) => e.relation))], ["contains"], "a page's script adds no calls or imports");
  assert.deepEqual(rawEdges.filter((e) => e.ref !== undefined).map((e) => [e.source, e.ref, e.name]), [["page.html#element:div#app", "class", "x"]]);
});

test("html: a script inside an identified element hangs off it; non-JavaScript scripts stay text", () => {
  const src = doc([
    '<section id="s">',                               // 1
    "<script>function inner() {}</script>",           // 2
    "</section>",                                     // 3
    '<script type="application/json">{"a": 1}</script>', // 4
    '<script type="module">export function mod() {}</script>', // 5
  ]);
  const { nodes, rawEdges } = parse(src, "p.html");
  assert.deepEqual(nodes.filter((n) => n.kind === "function").map((n) => [n.name, n.span]), [["inner", "L2-L2"], ["mod", "L5-L5"]]);
  assert.ok(rawEdges.some((e) => e.source === "p.html#element:section#s" && e.targetId === "p.html#inner"));
});

test("html: CRLF, a BOM, malformed markup and an empty file are safe", () => {
  assert.equal(spans(doc(PAGE, "\r\n"), "page.html")["boot"], "L9-L11");
  assert.equal(spans("﻿" + doc(PAGE), "page.html")["selector:.a"], "L14-L14");
  assert.equal(parse("<div id='x'><p></div", "bad.html").nodes[0]!.kind, "file");
  assert.deepEqual(parse("", "e.html").nodes.map((n) => n.kind), ["file"]);
});

test("svelte: script symbols, elements and styles", () => {
  const svelte = [
    '<script lang="ts">',            //  1
    "  let n = 1;",                  //  2
    "  function inc() { n++; }",     //  3
    "</script>",                     //  4
    "",                              //  5
    '<div id="box" class="x">',      //  6
    "  <button on:click={inc}>go</button>", // 7
    "</div>",                        //  8
    "",                              //  9
    "<style>",                       // 10
    "  .x { color: red; }",          // 11
    "</style>",                      // 12
  ];
  const s = spans(doc(svelte), "Box.svelte");
  assert.equal(s["inc"], "L3-L3");
  assert.equal(s["element:div#box"], "L6-L8");
  assert.equal(s["selector:.x"], "L11-L11");
});

test("astro: frontmatter symbols, elements, script and style", () => {
  const astro = [
    "---",                 //  1
    "const a = 1;",        //  2
    "function f() {}",     //  3
    "---",                 //  4
    '<div id="box">',      //  5
    "  <p>{a}</p>",        //  6
    "</div>",              //  7
    "<script>",            //  8
    "  function g() {}",   //  9
    "</script>",           // 10
    "<style>",             // 11
    "  .x { color: red; }",// 12
    "</style>",            // 13
  ];
  const s = spans(doc(astro), "Page.astro");
  assert.equal(s["f"], "L3-L3");
  assert.equal(s["g"], "L9-L9");
  assert.equal(s["element:div#box"], "L5-L7");
  assert.equal(s["selector:.x"], "L12-L12");
});

test("html: a page goes through a real build and checks as in sync", async () => {
  const dir = tmpRepo("structured-html");
  mkdirSync(join(dir, "web"), { recursive: true });
  writeFileSync(join(dir, "web", "page.html"), doc(PAGE));
  patchBuildConfig(dir, { structured: true });
  const outDir = join(dir, "graft");
  await buildGraph(dir, { contextDir: outDir, reuse: false });
  const graph = readGraph(wiringPath(outDir));
  assert.equal(graph.nodes.find((n) => n.id === "web/page.html#element:div#app")?.span, "L4-L7");
  assert.equal(graph.nodes.find((n) => n.id === "web/page.html#boot")?.span, "L9-L11");
  assert.ok(graph.meta.languages.includes("html"));
  const check = await checkGraph(dir, { contextDir: outDir });
  assert.equal(check.ok, true, `check must be clean, got ${JSON.stringify(check)}`);
});
