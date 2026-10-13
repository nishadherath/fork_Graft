/**
 * TOML (a hand-written scanner) and INI (the bundled grammar) keys as nodes.
 *
 * Fixtures are arrays of lines so the expected line numbers are the indices + 1.
 * TOML is where a scanner can quietly go wrong, so the awkward value shapes
 * (multi-line strings, arrays and inline tables) are pinned by span.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpRepo } from "./helpers.js";
import {
  extractStructured,
  structuredLangOf,
  warmStructuredGrammars,
} from "../src/graph/structured/index.js";
import { buildGraph } from "../src/graph/build.js";
import { checkGraph } from "../src/graph/check.js";
import { readGraph, wiringPath } from "../src/graph/write.js";
import { patchBuildConfig } from "../src/util/state.js";
import type { NodeV1 } from "../src/graph/types.js";

before(async () => {
  await warmStructuredGrammars(["ini"]);
});

function doc(lines: string[], eol = "\n"): string {
  return lines.join(eol) + eol;
}

function keys(source: string, rel: string): NodeV1[] {
  return extractStructured(rel, source, structuredLangOf(rel)!).nodes.filter((n) => n.kind === "key");
}

function spans(source: string, rel: string): Record<string, string> {
  return Object.fromEntries(keys(source, rel).map((n) => [n.name, n.span]));
}

function byName(nodes: NodeV1[], name: string): NodeV1 {
  const hit = nodes.find((n) => n.name === name);
  assert.ok(hit, `no key ${name} (got: ${nodes.map((n) => n.name).join(", ")})`);
  return hit;
}

const CARGO = [
  "# Cargo",                                              //  1
  "[package]",                                            //  2
  'name = "demo"',                                        //  3
  'version = "0.1.0"',                                    //  4
  'token = "abc"',                                        //  5
  "",                                                     //  6
  "[dependencies]",                                       //  7
  'serde = { version = "1", features = ["derive"] }',     //  8
  'tokio = "1"',                                          //  9
  "",                                                     // 10
  "[[bin]]",                                              // 11
  'name = "a"',                                           // 12
  'path = "src/a.rs"',                                    // 13
  "",                                                     // 14
  "[[bin]]",                                              // 15
  'path = "src/b.rs"',                                    // 16
  "",                                                     // 17
  "# release profile",                                    // 18
  "[profile.release]",                                    // 19
  "opt-level = 3",                                        // 20
  'desc = """',                                           // 21
  "multi",                                                // 22
  'line"""',                                              // 23
  "list = [",                                             // 24
  '  "x", # first',                                       // 25
  '  "y",',                                               // 26
  "]",                                                    // 27
  '"quoted key" = 1',                                     // 28
  "dotted.key = 2",                                       // 29
];

test("toml: tables span header to last entry, keys span to the end of their value", () => {
  assert.deepEqual(spans(doc(CARGO), "Cargo.toml"), {
    package: "L2-L5",
    "package.name": "L3-L3",
    "package.version": "L4-L4",
    "package.token": "L5-L5",
    dependencies: "L7-L9",
    "dependencies.serde": "L8-L8",
    "dependencies.tokio": "L9-L9",
    "bin[0]": "L11-L13",
    "bin[0].name": "L12-L12",
    "bin[0].path": "L13-L13",
    "profile.release": "L19-L29",
    "profile.release.opt-level": "L20-L20",
    "profile.release.desc": "L21-L23",
    "profile.release.list": "L24-L27",
    'profile.release["quoted key"]': "L28-L28",
    "profile.release.dotted.key": "L29-L29",
  });
});

test("toml: values, signatures and the secret rule", () => {
  const nodes = keys(doc(CARGO), "Cargo.toml");
  assert.equal(byName(nodes, "package.name").body_text, "demo");
  assert.equal(byName(nodes, "package.name").signature, "package.name = demo");
  assert.equal(byName(nodes, "dependencies.tokio").body_text, "1");
  assert.equal(byName(nodes, "profile.release.opt-level").body_text, "3");
  assert.equal(byName(nodes, "profile.release.desc").body_text, "multi line", "a multi-line string is one value");
  assert.equal(byName(nodes, "dependencies.serde").body_text, undefined, "an inline table is not a scalar");
  assert.equal(byName(nodes, "profile.release.list").body_text, undefined, "an array is not a scalar");
  const token = byName(nodes, "package.token");
  assert.equal(token.body_text, undefined);
  assert.equal(token.signature, "package.token");
});

test("toml: only named array-of-tables elements are indexed", () => {
  const nodes = keys(doc(CARGO), "Cargo.toml");
  assert.ok(nodes.some((n) => n.name === "bin[0]"));
  assert.ok(!nodes.some((n) => n.name === "bin[1]" || n.name === "bin[1].path"), "the unnamed second [[bin]] adds nothing");
  assert.equal(byName(nodes, "bin[0]").signature, "bin[0]: a");

  const second = keys(doc(["[[bin]]", 'path = "x"', "", "[[bin]]", 'name = "b"', 'path = "y"', "[bin.env]", 'K = "v"']), "x.toml");
  assert.deepEqual(second.map((n) => n.name), ["bin[1]", "bin[1].name", "bin[1].path", "bin[1].env", "bin[1].env.K"],
    "the index counts every [[bin]], and a sub-table nests under the latest element");
});

test("toml: sub-tables nest under their parent table, and contains edges follow", () => {
  const { rawEdges } = extractStructured("a.toml", doc(["[a]", "x = 1", "[a.b]", "y = 2", "[c.d]", "z = 3"]), structuredLangOf("a.toml")!);
  const pairs = rawEdges.map((e) => `${e.source} > ${e.targetId}`);
  assert.deepEqual(pairs, [
    "a.toml > a.toml#key:a",
    "a.toml#key:a > a.toml#key:a.x",
    "a.toml#key:a > a.toml#key:a.b",
    "a.toml#key:a.b > a.toml#key:a.b.y",
    "a.toml > a.toml#key:c.d",
    "a.toml#key:c.d > a.toml#key:c.d.z",
  ]);
});

test("toml: keys before any header sit at the root; comments and blank lines claim nothing", () => {
  assert.deepEqual(spans(doc(["# lead", "", 'title = "T" # trailing', "", "# about a", "[a]", "k = 1", "", "# about b", "[b]", "k = 2"]), "r.toml"), {
    title: "L3-L3",
    a: "L6-L7",
    "a.k": "L7-L7",
    b: "L10-L11",
    "b.k": "L11-L11",
  });
});

test("toml: tricky values do not derail the scanner", () => {
  const nodes = spans(doc([
    'a = "has # hash and \\" quote"',   // 1
    "b = 'literal # not a comment'",    // 2
    "c = [[1, 2], [3]]  # nested",      // 3
    "d = { e = [",                      // 4
    "  1,",                             // 5
    "] }",                              // 6
    "f = '''",                          // 7
    "[not a table]",                    // 8
    "'''",                              // 9
    "g = 7",                            // 10
  ]), "t.toml");
  assert.deepEqual(nodes, { a: "L1-L1", b: "L2-L2", c: "L3-L3", d: "L4-L6", f: "L7-L9", g: "L10-L10" });
});

test("toml: CRLF, a byte order mark, depth and size bounds, and garbage", () => {
  assert.equal(byName(keys(doc(CARGO, "\r\n"), "Cargo.toml"), "profile.release.list").span, "L24-L27");
  assert.equal(byName(keys("﻿" + doc(CARGO), "Cargo.toml"), "package.name").span, "L3-L3");
  assert.deepEqual(keys(doc(["[a.b.c.d.e]", "k = 1"]), "d.toml").map((n) => n.name), [], "five levels is past the cap");
  assert.deepEqual(keys(doc(["[a.b.c]", "k = 1", "k.m = 2"]), "d.toml").map((n) => n.name), ["a.b.c", "a.b.c.k"]);

  const junk = extractStructured("x.toml", "[[[[\n= = =\n\"unterminated\n", structuredLangOf("x.toml")!);
  assert.equal(junk.nodes[0]!.kind, "file");
  assert.deepEqual(extractStructured("x.toml", "", structuredLangOf("x.toml")!).nodes.map((n) => n.kind), ["file"]);
});

const INI = [
  "; top comment",           // 1
  "root = 1",                // 2
  "[core]",                  // 3
  "name = graft",            // 4
  "token = abc",             // 5
  "",                        // 6
  '[section "sub"]',         // 7
  "key=val",                 // 8
  "path: not parsed",        // 9
];

test("ini: sections and settings with exact spans", () => {
  assert.deepEqual(spans(doc(INI), "setup.cfg"), {
    root: "L2-L2",
    core: "L3-L5",
    "core.name": "L4-L4",
    "core.token": "L5-L5",
    '["section \\"sub\\""]': "L7-L8",
    '["section \\"sub\\""].key': "L8-L8",
  });
});

test("ini: values, the secret rule and the `key: value` limit", () => {
  const nodes = keys(doc(INI), "setup.cfg");
  assert.equal(byName(nodes, "core.name").body_text, "graft");
  assert.equal(byName(nodes, "core.name").signature, "core.name = graft");
  assert.equal(byName(nodes, "core.token").body_text, undefined);
  assert.equal(byName(nodes, "core.token").signature, "core.token");
  assert.ok(!nodes.some((n) => n.name.includes("path")), "the grammar reads `=` only; a colon line is skipped, never misplaced");
});

test("ini: CRLF and malformed input do not move or break anything", () => {
  assert.equal(byName(keys(doc(INI, "\r\n"), "setup.cfg"), "core.name").span, "L4-L4");
  const out = extractStructured("x.ini", "[unclosed\nk = v\n", structuredLangOf("x.ini")!);
  assert.equal(out.nodes[0]!.kind, "file");
});

test("toml and ini: a pyproject and a setup.cfg go through a real build and check as in sync", async () => {
  const dir = tmpRepo("structured-toml-ini");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "Cargo.toml"), doc(CARGO));
  writeFileSync(join(dir, "setup.cfg"), doc(INI));
  patchBuildConfig(dir, { structured: true });

  const outDir = join(dir, "graft");
  await buildGraph(dir, { contextDir: outDir, reuse: false });
  const graph = readGraph(wiringPath(outDir));
  assert.equal(graph.nodes.find((n) => n.id === "Cargo.toml#key:profile.release.list")?.span, "L24-L27");
  assert.equal(graph.nodes.find((n) => n.id === "setup.cfg#key:core.name")?.span, "L4-L4");
  assert.ok(!JSON.stringify(graph).includes('"abc"'), "no token value anywhere in the graph");

  const check = await checkGraph(dir, { contextDir: outDir });
  assert.equal(check.ok, true, `check must be clean, got ${JSON.stringify(check)}`);
});
