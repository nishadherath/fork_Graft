/**
 * Bash and PowerShell functions as nodes on their true lines. Fixtures are arrays
 * of lines, so expected line numbers are the indices + 1.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpRepo } from "./helpers.js";
import { extractStructured, structuredLangOf, warmStructuredGrammars } from "../src/graph/structured/index.js";
import { buildGraph } from "../src/graph/build.js";
import { checkGraph } from "../src/graph/check.js";
import { readGraph, wiringPath } from "../src/graph/write.js";
import { patchBuildConfig } from "../src/util/state.js";

before(async () => {
  await warmStructuredGrammars(["bash", "powershell"]);
});

function doc(lines: string[], eol = "\n"): string {
  return lines.join(eol) + eol;
}

function parse(source: string, rel: string) {
  return extractStructured(rel, source, structuredLangOf(rel)!);
}

function spans(source: string, rel: string): Record<string, string> {
  return Object.fromEntries(parse(source, rel).nodes.filter((n) => n.kind !== "file").map((n) => [n.name, n.span]));
}

const BASH = [
  "#!/bin/bash",        //  1
  "foo() {",            //  2
  "  echo hi",          //  3
  "}",                  //  4
  "function bar {",     //  5
  "  :",                //  6
  "}",                  //  7
  "if true; then",      //  8
  "  nested() { :; }",  //  9
  "fi",                 // 10
  "X=1",                // 11
];

test("bash: functions, however declared or nested, span their own lines", () => {
  assert.deepEqual(spans(doc(BASH), "deploy.sh"), { foo: "L2-L4", bar: "L5-L7", nested: "L9-L9" });
  assert.equal(structuredLangOf("ci/run.bash")?.family, "shell");
});

test("bash: kind, id shape, signature and text", () => {
  const foo = parse(doc(BASH), "deploy.sh").nodes.find((n) => n.name === "foo")!;
  assert.equal(foo.kind, "function");
  assert.equal(foo.id, "deploy.sh#foo", "functions keep the depth tier's id shape");
  assert.equal(foo.signature, "foo()");
  assert.match(foo.body_text ?? "", /echo hi/);
  assert.equal(foo.origin, "generic");
});

const PS = [
  "function Get-Foo {",   // 1
  "  param($a)",          // 2
  "  1",                  // 3
  "}",                    // 4
  "filter F { $_ }",      // 5
];

test("powershell: functions and filters", () => {
  assert.deepEqual(spans(doc(PS), "tools.ps1"), { "Get-Foo": "L1-L4", F: "L5-L5" });
  assert.equal(structuredLangOf("Mod.psm1")?.family, "shell");
});

test("shell: CRLF, a BOM, garbage and an empty file are safe; duplicates get distinct ids", () => {
  assert.equal(spans(doc(BASH, "\r\n"), "deploy.sh")["bar"], "L5-L7");
  assert.equal(spans("﻿" + doc(PS), "tools.ps1")["F"], "L5-L5");
  assert.equal(parse("((( {{{ ``` function\n", "x.sh").nodes[0]!.kind, "file");
  assert.deepEqual(parse("", "x.ps1").nodes.map((n) => n.kind), ["file"]);
  const dup = parse(doc(["f() { :; }", "f() { :; }"]), "d.sh").nodes.filter((n) => n.kind === "function");
  assert.deepEqual(dup.map((n) => n.id), ["d.sh#f", "d.sh#f~2"]);
});

test("shell: a build and a check agree", async () => {
  const dir = tmpRepo("structured-shell");
  writeFileSync(join(dir, "deploy.sh"), doc(BASH));
  writeFileSync(join(dir, "tools.ps1"), doc(PS));
  patchBuildConfig(dir, { structured: true });
  const outDir = join(dir, "graft");
  await buildGraph(dir, { contextDir: outDir, reuse: false });
  const graph = readGraph(wiringPath(outDir));
  assert.equal(graph.nodes.find((n) => n.id === "deploy.sh#bar")?.span, "L5-L7");
  assert.equal(graph.nodes.find((n) => n.id === "tools.ps1#Get-Foo")?.span, "L1-L4");
  const check = await checkGraph(dir, { contextDir: outDir });
  assert.equal(check.ok, true, `check must be clean, got ${JSON.stringify(check)}`);
});
