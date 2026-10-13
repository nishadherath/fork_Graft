/**
 * Gradle (Groovy DSL) and Makefile scanners: tasks, plugins, dependencies and
 * rules on their true lines. Fixtures are arrays of lines, so expected line
 * numbers are the indices + 1. Both are scanners rather than grammar walks, so
 * these tests are the evidence the spans are exact.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpRepo } from "./helpers.js";
import { extractStructured, structuredLangOf } from "../src/graph/structured/index.js";
import { buildGraph } from "../src/graph/build.js";
import { checkGraph } from "../src/graph/check.js";
import { readGraph, wiringPath } from "../src/graph/write.js";
import { patchBuildConfig } from "../src/util/state.js";

function doc(lines: string[], eol = "\n"): string {
  return lines.join(eol) + eol;
}

function parse(source: string, rel: string) {
  return extractStructured(rel, source, structuredLangOf(rel)!);
}

function spans(source: string, rel: string): Record<string, string> {
  return Object.fromEntries(parse(source, rel).nodes.filter((n) => n.kind !== "file").map((n) => [n.name, n.span]));
}

const GRADLE = [
  "// a comment with a } brace",                 //  1
  "plugins {",                                    //  2
  "  id 'java'",                                  //  3
  "  id 'org.x' version '1'",                     //  4
  '  kotlin("jvm")',                              //  5
  "}",                                            //  6
  "dependencies {",                               //  7
  "  implementation 'a:b:1'",                     //  8
  '  testImplementation("c:d:2")',               //  9
  "  implementation project(':core')",           // 10
  "}",                                            // 11
  "task hello {",                                 // 12
  "  doLast { println 'x } y' }",                 // 13
  "}",                                            // 14
  "tasks.register('build2') {",                  // 15
  "}",                                            // 16
  "task(oneLine) { }",                            // 17
];

test("gradle: tasks, plugin and dependency entries span their own lines", () => {
  assert.deepEqual(spans(doc(GRADLE), "build.gradle"), {
    hello: "L12-L14",
    build2: "L15-L16",
    oneLine: "L17-L17",
    plugins: "L2-L6",
    "plugins.java": "L3-L3",
    'plugins["org.x"]': "L4-L4",
    "plugins.jvm": "L5-L5",
    dependencies: "L7-L11",
    'dependencies["implementation a:b"]': "L8-L8",
    'dependencies["testImplementation c:d"]': "L9-L9",
  });
});

test("gradle: kinds, values and ids", () => {
  const { nodes } = parse(doc(GRADLE), "app/build.gradle");
  const hello = nodes.find((n) => n.name === "hello")!;
  assert.equal(hello.kind, "task");
  assert.equal(hello.id, "app/build.gradle#task:hello");
  const dep = nodes.find((n) => n.name === 'dependencies["implementation a:b"]')!;
  assert.equal(dep.kind, "key");
  assert.equal(dep.body_text, "a:b:1", "the version stays searchable");
});

test("gradle: braces inside strings and comments do not end a block early; CRLF is safe", () => {
  assert.equal(spans(doc(GRADLE, "\r\n"), "build.gradle")["hello"], "L12-L14");
  assert.deepEqual(spans(doc(["task a {", "  def s = '}'", "  // }", "}", "task b { }"]), "x.gradle"), { a: "L1-L4", b: "L5-L5" });
  assert.deepEqual(parse("", "x.gradle").nodes.map((n) => n.kind), ["file"]);
  assert.equal(parse("}}} {{{ task", "x.gradle").nodes[0]!.kind, "file");
});

test("gradle: .gradle.kts is not claimed here (the Kotlin tier owns it)", () => {
  assert.equal(structuredLangOf("build.gradle.kts"), null);
  assert.equal(structuredLangOf("settings.gradle")?.family, "gradle");
});

const MAKE = [
  "CC = gcc",                    //  1
  ".PHONY: all clean",           //  2
  "all: build test",             //  3
  "\tcc x",                      //  4
  "",                            //  5
  "# build it",                  //  6
  "build: main.o",               //  7
  "\tcc -o app main.o",          //  8
  "",                            //  9
  "\t# comment in recipe",       // 10
  "\techo done",                 // 11
  "",                            // 12
  "%.o: %.c",                    // 13
  "\tcc -c $<",                  // 14
  "",                            // 15
  "clean:",                      // 16
  "\trm -f *.o",                 // 17
  "",                            // 18
  "ifeq ($(X),1)",               // 19
  "FOO := 1",                    // 20
  "endif",                       // 21
];

test("make: rules span the target line to the last recipe line", () => {
  assert.deepEqual(spans(doc(MAKE), "Makefile"), {
    all: "L3-L4",
    build: "L7-L11",
    "%.o": "L13-L14",
    clean: "L16-L17",
  });
});

test("make: multiple targets, continuation lines, and what is not a task", () => {
  const src = doc([
    "a b: c",            // 1
    "\techo \\",         // 2
    "\t  more",          // 3
    "x := 1",            // 4
    "y ::= 2",           // 5
    "-include other.mk", // 6
    "z: ; echo inline",  // 7
  ]);
  assert.deepEqual(spans(src, "GNUmakefile"), { a: "L1-L3", b: "L1-L3", z: "L7-L7" });
  const nodes = parse(doc(MAKE), "Makefile").nodes;
  const build = nodes.find((n) => n.name === "build")!;
  assert.equal(build.kind, "task");
  assert.equal(build.signature, "build: main.o");
  assert.match(build.body_text ?? "", /cc -o app main\.o/);
});

test("make: CRLF, garbage and an empty file are safe", () => {
  assert.equal(spans(doc(MAKE, "\r\n"), "Makefile")["build"], "L7-L11");
  assert.equal(parse(":::\n\t\t\n= =\n", "Makefile").nodes[0]!.kind, "file");
  assert.deepEqual(parse("", "rules.mk").nodes.map((n) => n.kind), ["file"]);
});

test("gradle and make: a build and a check agree", async () => {
  const dir = tmpRepo("structured-build-scripts");
  mkdirSync(join(dir, "app"), { recursive: true });
  writeFileSync(join(dir, "app", "build.gradle"), doc(GRADLE));
  writeFileSync(join(dir, "Makefile"), doc(MAKE));
  patchBuildConfig(dir, { structured: true });
  const outDir = join(dir, "graft");
  await buildGraph(dir, { contextDir: outDir, reuse: false });
  const graph = readGraph(wiringPath(outDir));
  assert.equal(graph.nodes.find((n) => n.id === "app/build.gradle#task:hello")?.span, "L12-L14");
  assert.equal(graph.nodes.find((n) => n.id === "Makefile#task:build")?.span, "L7-L11");
  const check = await checkGraph(dir, { contextDir: outDir });
  assert.equal(check.ok, true, `check must be clean, got ${JSON.stringify(check)}`);
});
