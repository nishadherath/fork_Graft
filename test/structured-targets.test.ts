/**
 * Dockerfile stages and CMake targets as tasks, CMake functions and macros as
 * functions, each on its true line. Fixtures are arrays of lines, so expected line
 * numbers are the indices + 1.
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
  await warmStructuredGrammars(["dockerfile", "cmake"]);
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

const DOCKER = [
  "# syntax=docker/dockerfile:1",                          //  1
  "ARG V=20",                                              //  2
  "FROM node:${V} AS build",                               //  3
  "WORKDIR /app",                                          //  4
  "RUN npm ci \\",                                         //  5
  "  && npm run build",                                    //  6
  "",                                                      //  7
  "# runtime",                                             //  8
  "FROM nginx",                                            //  9
  "COPY --from=build /app/dist /usr/share/nginx/html",     // 10
  'CMD ["nginx"]',                                         // 11
];

test("dockerfile: each stage spans its FROM to its last instruction", () => {
  assert.deepEqual(spans(doc(DOCKER), "Dockerfile"), { build: "L3-L6", nginx: "L9-L11" });
  assert.equal(structuredLangOf("docker/api.dockerfile")?.family, "dockerfile");
});

test("dockerfile: kind, signature and searchable text", () => {
  const stage = parse(doc(DOCKER), "Dockerfile").nodes.find((n) => n.name === "build")!;
  assert.equal(stage.kind, "task");
  assert.equal(stage.id, "Dockerfile#task:build");
  assert.equal(stage.signature, "FROM node:${V} AS build");
  assert.match(stage.body_text ?? "", /npm run build/);
});

test("dockerfile: CRLF, garbage, a file with no FROM and an empty file are safe", () => {
  assert.equal(spans(doc(DOCKER, "\r\n"), "Dockerfile")["nginx"], "L9-L11");
  assert.deepEqual(parse(doc(["RUN echo hi"]), "Dockerfile").nodes.map((n) => n.kind), ["file"]);
  assert.equal(parse("FROM\n\u0000\u0000", "Dockerfile").nodes[0]!.kind, "file");
  assert.deepEqual(parse("", "Dockerfile").nodes.map((n) => n.kind), ["file"]);
});

const CMAKE = [
  "cmake_minimum_required(VERSION 3.20)",   //  1
  "project(x)",                             //  2
  "add_executable(app main.c)",             //  3
  "add_library(lib STATIC",                 //  4
  "  a.c",                                  //  5
  "  b.c)",                                 //  6
  "function(helper a)",                     //  7
  "  message(${a})",                        //  8
  "endfunction()",                          //  9
  "macro(m)",                               // 10
  "endmacro()",                             // 11
  "add_custom_target(docs COMMAND echo)",   // 12
  "add_test(NAME unit COMMAND app)",        // 13
];

test("cmake: targets are tasks, functions and macros are functions, all with exact spans", () => {
  assert.deepEqual(spans(doc(CMAKE), "CMakeLists.txt"), {
    app: "L3-L3",
    lib: "L4-L6",
    helper: "L7-L9",
    m: "L10-L11",
    docs: "L12-L12",
    unit: "L13-L13",
  });
  const nodes = parse(doc(CMAKE), "CMakeLists.txt").nodes;
  assert.equal(nodes.find((n) => n.name === "app")!.kind, "task");
  assert.equal(nodes.find((n) => n.name === "helper")!.kind, "function");
  assert.equal(nodes.find((n) => n.name === "helper")!.id, "CMakeLists.txt#helper", "functions keep the depth tier's id shape");
  assert.equal(structuredLangOf("cmake/Find.cmake")?.family, "cmake");
});

test("cmake: targets inside an if() are found; CRLF and garbage are safe", () => {
  const nested = doc(["if(WIN32)", "  add_executable(winonly w.c)", "endif()"]);
  assert.deepEqual(spans(nested, "CMakeLists.txt"), { winonly: "L2-L2" });
  assert.equal(spans(doc(CMAKE, "\r\n"), "CMakeLists.txt")["lib"], "L4-L6");
  assert.equal(parse("add_executable(", "CMakeLists.txt").nodes[0]!.kind, "file");
  assert.deepEqual(parse("", "CMakeLists.txt").nodes.map((n) => n.kind), ["file"]);
});

test("dockerfile and cmake: a build and a check agree", async () => {
  const dir = tmpRepo("structured-targets");
  writeFileSync(join(dir, "Dockerfile"), doc(DOCKER));
  writeFileSync(join(dir, "CMakeLists.txt"), doc(CMAKE));
  patchBuildConfig(dir, { structured: true });
  const outDir = join(dir, "graft");
  await buildGraph(dir, { contextDir: outDir, reuse: false });
  const graph = readGraph(wiringPath(outDir));
  assert.equal(graph.nodes.find((n) => n.id === "Dockerfile#task:build")?.span, "L3-L6");
  assert.equal(graph.nodes.find((n) => n.id === "CMakeLists.txt#task:lib")?.span, "L4-L6");
  const check = await checkGraph(dir, { contextDir: outDir });
  assert.equal(check.ok, true, `check must be clean, got ${JSON.stringify(check)}`);
});
