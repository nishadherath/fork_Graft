/**
 * YAML keys as nodes, and the front matter of Markdown files, which is YAML.
 *
 * Same discipline as the other structured tests: fixtures are arrays of lines so
 * the expected line numbers are the indices + 1, and the secret cases are pinned
 * because a key's signature is printed by `ask`.
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
  // Markdown needs the yaml grammar for its front matter: warming only markdown
  // must be enough, because that is all a build of a docs folder asks for.
  await warmStructuredGrammars(["markdown"]);
});

function doc(lines: string[], eol = "\n"): string {
  return lines.join(eol) + eol;
}

function keys(source: string, rel = "ci.yml"): NodeV1[] {
  return extractStructured(rel, source, structuredLangOf(rel)!).nodes.filter((n) => n.kind === "key");
}

function byName(nodes: NodeV1[], name: string): NodeV1 {
  const hit = nodes.find((n) => n.name === name);
  assert.ok(hit, `no key ${name} (got: ${nodes.map((n) => n.name).join(", ")})`);
  return hit;
}

const CI = [
  "# CI",                                  //  1
  "name: ci",                              //  2
  "on:",                                   //  3
  "  push:",                               //  4
  "    branches: [main, dev]",             //  5
  "jobs:",                                 //  6
  "  verify:",                             //  7
  "    runs-on: ubuntu",                   //  8
  "    steps:",                            //  9
  "      - uses: actions/checkout@v4",     // 10
  "      - name: Build",                   // 11
  "        run: npm run build",            // 12
  "      - name: Test",                    // 13
  "        run: npm test",                 // 14
  "---",                                   // 15
  "second: 1",                             // 16
  "token: hunter2hunter2",                 // 17
  "anchors: &a",                           // 18
  "  x: 1",                                // 19
  "merge:",                                // 20
  "  <<: *a",                              // 21
  "block: |",                              // 22
  "  line one",                            // 23
  "  line two",                            // 24
  '"quoted key": v',                       // 25
];

test("yaml: a key spans its own line to the end of its value", () => {
  const spans = Object.fromEntries(keys(doc(CI)).map((n) => [n.name, n.span]));
  assert.deepEqual(spans, {
    name: "L2-L2",
    on: "L3-L5",
    "on.push": "L4-L5",
    "on.push.branches": "L5-L5",
    jobs: "L6-L14",
    "jobs.verify": "L7-L14",
    "jobs.verify.runs-on": "L8-L8",
    "jobs.verify.steps": "L9-L14",
    "jobs.verify.steps[1]": "L11-L12",
    "jobs.verify.steps[1].name": "L11-L11",
    "jobs.verify.steps[1].run": "L12-L12",
    "jobs.verify.steps[2]": "L13-L14",
    "jobs.verify.steps[2].name": "L13-L13",
    "jobs.verify.steps[2].run": "L14-L14",
    "doc2.second": "L16-L16",
    "doc2.token": "L17-L17",
    "doc2.anchors": "L18-L19",
    "doc2.anchors.x": "L19-L19",
    "doc2.merge": "L20-L21",
    "doc2.block": "L22-L24",
    'doc2["quoted key"]': "L25-L25",
  });
});

test("yaml: only named sequence elements are indexed, and merge keys add nothing", () => {
  const nodes = keys(doc(CI));
  assert.ok(!nodes.some((n) => n.name === "jobs.verify.steps[0]"), "the uses-only step has no name, id or key");
  assert.ok(!nodes.some((n) => n.name.includes("<<")), "a merge key is not a name");
  assert.equal(byName(nodes, "jobs.verify.steps[1]").signature, "jobs.verify.steps[1]: Build");
});

test("yaml: scalars carry their value; blocks and quoted keys decode", () => {
  const nodes = keys(doc(CI));
  assert.equal(byName(nodes, "jobs.verify.steps[1].run").body_text, "npm run build");
  assert.equal(byName(nodes, "jobs.verify.steps[1].run").signature, "jobs.verify.steps[1].run = npm run build");
  assert.equal(byName(nodes, "doc2.block").body_text, "line one line two", "a block scalar loses its header, not its text");
  assert.equal(byName(nodes, "on.push.branches").body_text, undefined, "a flow sequence is not a scalar");
});

test("yaml: secret-looking keys and opaque values stay out of signature and body_text", () => {
  const nodes = keys(doc(CI));
  const token = byName(nodes, "doc2.token");
  assert.equal(token.body_text, undefined);
  assert.equal(token.signature, "doc2.token");

  const opaque = keys(doc(["blob: " + "x".repeat(40), "note: short"]));
  assert.equal(byName(opaque, "blob").body_text, undefined);
  assert.equal(byName(opaque, "note").body_text, "short");
});

test("yaml: depth is capped at four key levels and ids are unique", () => {
  const nodes = keys(doc(["a:", "  b:", "    c:", "      d:", "        e: 1", "a2: 1", "a2: 2"]));
  assert.deepEqual(nodes.map((n) => n.name), ["a", "a.b", "a.b.c", "a.b.c.d", "a2", "a2"]);
  assert.deepEqual(nodes.map((n) => n.id).slice(-2), ["ci.yml#key:a2", "ci.yml#key:a2~2"]);
});

test("yaml: CRLF, a byte order mark and malformed input do not move or break anything", () => {
  assert.equal(byName(keys(doc(CI, "\r\n")), "jobs.verify.runs-on").span, "L8-L8");
  assert.equal(byName(keys("﻿" + doc(CI)), "jobs.verify.runs-on").span, "L8-L8");
  const broken = extractStructured("x.yml", "a: [unclosed\nb: 1\n  : :\n", structuredLangOf("x.yml")!);
  assert.equal(broken.nodes[0]!.kind, "file");
  assert.deepEqual(extractStructured("x.yml", "", structuredLangOf("x.yml")!).nodes.map((n) => n.kind), ["file"]);
});

test("yaml: contains edges nest keys under their parent, top level under the file", () => {
  const { rawEdges } = extractStructured("ci.yml", doc(CI), structuredLangOf("ci.yml")!);
  const pairs = rawEdges.map((e) => `${e.source} > ${e.targetId}`);
  assert.ok(pairs.includes("ci.yml > ci.yml#key:jobs"));
  assert.ok(pairs.includes("ci.yml#key:jobs.verify > ci.yml#key:jobs.verify.steps"));
  assert.ok(pairs.includes("ci.yml#key:jobs.verify.steps > ci.yml#key:jobs.verify.steps[1]"));
  assert.ok(pairs.includes("ci.yml#key:jobs.verify.steps[1] > ci.yml#key:jobs.verify.steps[1].run"));
});

test("markdown front matter: its keys are nodes with spans in the Markdown file", () => {
  const source = doc([
    "---",            // 1
    "title: Guide",   // 2
    "tags:",          // 3
    "  - a",          // 4
    "  - b",          // 5
    "draft: false",   // 6
    "---",            // 7
    "# Heading",      // 8
  ]);
  const out = extractStructured("docs/guide.md", source, structuredLangOf("docs/guide.md")!);
  const spans = Object.fromEntries(out.nodes.filter((n) => n.kind === "key").map((n) => [n.name, n.span]));
  assert.deepEqual(spans, { title: "L2-L2", tags: "L3-L5", draft: "L6-L6" });
  assert.equal(out.nodes.find((n) => n.name === "title")!.id, "docs/guide.md#key:title");
  assert.equal(out.nodes.find((n) => n.kind === "section")!.span, "L8-L8", "the heading is unaffected");
});

test("yaml: a workflow goes through a real build and checks as in sync", async () => {
  const dir = tmpRepo("structured-yaml");
  // Not .github/workflows: graft never walks dot-directories (ingest/fs.ts).
  mkdirSync(join(dir, "deploy", "workflows"), { recursive: true });
  writeFileSync(join(dir, "deploy", "workflows", "ci.yml"), doc(CI));
  writeFileSync(join(dir, "NOTES.md"), doc(["---", "title: Notes", "---", "# Notes"]));
  patchBuildConfig(dir, { structured: true });

  const outDir = join(dir, "graft");
  await buildGraph(dir, { contextDir: outDir, reuse: false });
  const graph = readGraph(wiringPath(outDir));
  const run = graph.nodes.find((n) => n.id === "deploy/workflows/ci.yml#key:jobs.verify.steps[1].run");
  assert.ok(run, "the workflow key is in the built graph");
  assert.equal(run.span, "L12-L12");
  assert.ok(graph.nodes.some((n) => n.id === "NOTES.md#key:title"), "front matter keys are in the built graph");
  assert.ok(!JSON.stringify(graph).includes("hunter2"), "the token value is nowhere in the graph");

  const check = await checkGraph(dir, { contextDir: outDir });
  assert.equal(check.ok, true, `check must be clean, got ${JSON.stringify(check)}`);
});

test("yaml: a mapping's span stops at its last line, not at the comment that introduces the next key", () => {
  const source = doc([
    "name: demo",           //  1
    "a: 1",                 //  2
    "",                     //  3
    "# about b",            //  4
    "b:",                   //  5
    "  x: 1",               //  6
    "  y:",                 //  7
    "    z: 2",             //  8
    "",                     //  9
    "# gap comment",        // 10
    "c: 3",                 // 11
    "# trailing comment",   // 12
  ]);
  const nodes = keys(source, "probe.yaml");
  const spans = Object.fromEntries(nodes.map((n) => [n.name, n.span]));
  assert.equal(spans["b"], "L5-L8", "b ends at z, not at the comment line before c");
  assert.equal(spans["b.y"], "L7-L8");
  assert.equal(spans["c"], "L11-L11", "a last key does not claim a trailing comment");
});

test("yaml: a comment-like line inside a block scalar stays inside the span", () => {
  const source = doc([
    "script: |",            // 1
    "  echo one",           // 2
    "  # not a comment",    // 3
    "",                     // 4
    "# real comment",       // 5
    "next: 1",              // 6
  ]);
  const spans = Object.fromEntries(keys(source, "probe.yaml").map((n) => [n.name, n.span]));
  assert.equal(spans["script"], "L1-L3", "the # line is scalar text and the span includes it");
  assert.equal(spans["next"], "L6-L6");
});

test("yaml: a sequence item with a name stops before the comment that follows it", () => {
  const source = doc([
    "steps:",               // 1
    "  - name: one",        // 2
    "    run: a",           // 3
    "",                     // 4
    "  # second step",      // 5
    "  - name: two",        // 6
    "    run: b",           // 7
  ]);
  const spans = Object.fromEntries(keys(source, "probe.yaml").map((n) => [n.name, n.span]));
  assert.equal(spans["steps[0]"], "L2-L3");
  assert.equal(spans["steps"], "L1-L7");
});
