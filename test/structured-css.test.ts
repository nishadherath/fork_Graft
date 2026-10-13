/**
 * CSS and SCSS rules, at-rules, custom properties and Sass variables as nodes.
 * Fixtures are arrays of lines, so expected line numbers are the indices + 1.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpRepo } from "./helpers.js";
import { extractStructured, structuredLangOf, warmStructuredGrammars } from "../src/graph/structured/index.js";
import { MAX_UNITS_PER_FILE } from "../src/graph/structured/shared.js";
import { buildGraph } from "../src/graph/build.js";
import { checkGraph } from "../src/graph/check.js";
import { readGraph, wiringPath } from "../src/graph/write.js";
import { patchBuildConfig } from "../src/util/state.js";

before(async () => {
  await warmStructuredGrammars(["css", "scss"]);
});

function doc(lines: string[], eol = "\n"): string {
  return lines.join(eol) + eol;
}

function units(source: string, rel: string) {
  return extractStructured(rel, source, structuredLangOf(rel)!);
}

function spans(source: string, rel: string): Record<string, string> {
  return Object.fromEntries(units(source, rel).nodes.filter((n) => n.kind === "selector").map((n) => [n.name, n.span]));
}

const CSS = [
  ":root {",                     //  1
  "  --gap: 4px;",              //  2
  "}",                           //  3
  ".a,",                         //  4
  ".b > c {",                    //  5
  "  color: red;",              //  6
  "}",                           //  7
  "@media (min-width: 1px) {",  //  8
  "  .m {",                      //  9
  "    x: y;",                   // 10
  "  }",                         // 11
  "}",                           // 12
  "@keyframes spin {",           // 13
  "  from { a: b; }",           // 14
  "}",                           // 15
  "#id[data-x] {",              // 16
  "}",                           // 17
];

test("css: rules, at-rules and custom properties span their own lines", () => {
  assert.deepEqual(spans(doc(CSS), "site.css"), {
    ":root": "L1-L3",
    "--gap": "L2-L2",
    ".a, .b > c": "L4-L7",
    "@media (min-width: 1px)": "L8-L12",
    ".m": "L9-L11",
    "@keyframes spin": "L13-L15",
    "#id[data-x]": "L16-L17",
  });
});

test("css: node shape, ids, body text and contains edges", () => {
  const { nodes, rawEdges } = units(doc(CSS), "site.css");
  const gap = nodes.find((n) => n.name === "--gap")!;
  assert.equal(gap.id, "site.css#selector:--gap");
  assert.equal(gap.kind, "selector");
  assert.equal(gap.origin, "generic");
  assert.equal(gap.signature, "--gap: 4px");
  assert.equal(gap.body_text, "4px");
  assert.match(nodes.find((n) => n.name === ".a, .b > c")!.body_text ?? "", /color: red/);

  const pairs = rawEdges.map((e) => `${e.source} > ${e.targetId}`);
  assert.ok(pairs.includes("site.css > site.css#selector::root"));
  assert.ok(pairs.includes("site.css#selector::root > site.css#selector:--gap"));
  assert.ok(pairs.includes("site.css#selector:@media (min-width: 1px) > site.css#selector:.m"));
});

test("scss: variables, mixins, functions and nested rules", () => {
  const scss = [
    "$v: 1;",                 //  1
    "@mixin m($a) {",         //  2
    "  color: $a;",           //  3
    "}",                      //  4
    ".a {",                   //  5
    "  .b { c: d; }",         //  6
    "  &:hover { e: f; }",    //  7
    "}",                      //  8
    "@function f($x) {",      //  9
    "  @return $x;",          // 10
    "}",                      // 11
  ];
  assert.deepEqual(spans(doc(scss), "theme.scss"), {
    "$v": "L1-L1",
    "@mixin m($a)": "L2-L4",
    ".a": "L5-L8",
    ".b": "L6-L6",
    "&:hover": "L7-L7",
    "@function f($x)": "L9-L11",
  });
  const { rawEdges } = units(doc(scss), "theme.scss");
  assert.ok(rawEdges.some((e) => e.source === "theme.scss#selector:.a" && e.targetId === "theme.scss#selector:.b"));
});

test("css: duplicates get distinct ids; CRLF, a BOM, garbage and an empty file are safe", () => {
  const dup = units(doc([".x { a: b; }", ".x { c: d; }"]), "d.css").nodes.filter((n) => n.kind === "selector");
  assert.deepEqual(dup.map((n) => n.id), ["d.css#selector:.x", "d.css#selector:.x~2"]);
  assert.equal(spans(doc(CSS, "\r\n"), "site.css")["@keyframes spin"], "L13-L15");
  assert.equal(spans("﻿" + doc(CSS), "site.css")[".m"], "L9-L11");
  assert.equal(units("{{{ ;;; }}}", "x.css").nodes[0]!.kind, "file");
  assert.deepEqual(units("", "x.css").nodes.map((n) => n.kind), ["file"]);
});

test("css: a file with thousands of rules contributes at most the named cap", () => {
  const rules: string[] = [];
  for (let i = 0; i < MAX_UNITS_PER_FILE + 50; i++) rules.push(`.r${i} { a: b; }`);
  const nodes = units(doc(rules), "big.css").nodes.filter((n) => n.kind === "selector");
  assert.equal(nodes.length, MAX_UNITS_PER_FILE);
  assert.equal(nodes[0]!.name, ".r0", "document order, first ones kept");
});

test("css: a stylesheet goes through a real build and checks as in sync", async () => {
  const dir = tmpRepo("structured-css");
  mkdirSync(join(dir, "styles"), { recursive: true });
  writeFileSync(join(dir, "styles", "site.css"), doc(CSS));
  writeFileSync(join(dir, "styles", "theme.scss"), doc(["$v: 1;", ".a { b: c; }"]));
  patchBuildConfig(dir, { structured: true });
  const outDir = join(dir, "graft");
  await buildGraph(dir, { contextDir: outDir, reuse: false });
  const graph = readGraph(wiringPath(outDir));
  assert.equal(graph.nodes.find((n) => n.id === "styles/site.css#selector:.m")?.span, "L9-L11");
  assert.ok(graph.nodes.some((n) => n.id === "styles/theme.scss#selector:$v"));
  const check = await checkGraph(dir, { contextDir: outDir });
  assert.equal(check.ok, true, `check must be clean, got ${JSON.stringify(check)}`);
});
