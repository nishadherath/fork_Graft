/**
 * Edges between the structured tier and code (Stage 3): the resolver pass that
 * turns a name in one file into a `references` or `imports` edge to a unit in
 * another.
 *
 * Every assertion is by node id, and every fixture line a test depends on is
 * numbered beside it, so a span can be checked against the text it claims. The
 * negative cases matter as much as the positive ones: an ambiguous or absent
 * match must produce no edge at all, because a wrong edge is worse than none.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpRepo } from "./helpers.js";
import { buildGraph } from "../src/graph/build.js";
import { readGraph, wiringPath } from "../src/graph/write.js";
import { patchBuildConfig } from "../src/util/state.js";
import type { EdgeV1, GraphV1 } from "../src/graph/types.js";

const PACKAGE = [
  "{",                                     //  1
  '  "name": "demo",',                     //  2
  '  "app": {',                            //  3
  '    "limits": {',                       //  4
  '      "maxBody": 1024',                 //  5
  "    }",                                 //  6
  "  },",                                  //  7
  '  "demo": {',                           //  8
  '    "upload": {',                       //  9
  '      "maxBodyBytes": 26214400',        // 10
  "    }",                                 // 11
  "  }",                                   // 12
  "}",                                     // 13
];

const LIMITS_TS = [
  'import { config, cfg, x } from "./config.js";',                         //  1
  "export function bodyLimit(): number {",                                 //  2
  "  return config.app.limits.maxBody;",                                   //  3
  "}",                                                                     //  4
  "export function uploadLimit(): number {",                               //  5
  "  return config.upload.maxBodyBytes;",                                  //  6
  "}",                                                                     //  7
  "export function tooLarge(): string {",                                  //  8
  '  return `over the limit (package.json "demo.upload.maxBodyBytes")`;',  //  9
  "}",                                                                     // 10
  "export function retries(): number {",                                   // 11
  "  return cfg.retry.count;",                                             // 12
  "}",                                                                     // 13
  "export function port(): number {",                                      // 14
  "  return config.port;",                                                 // 15
  "}",                                                                     // 16
  "export function tooDeep(): number {",                                   // 17
  "  return x.c.d;",                                                       // 18
  "}",                                                                     // 19
  "export function oneBelowRoot(): number {",                              // 20
  "  return x.b.c.d;",                                                     // 21
  "}",                                                                     // 22
  "export function bodyText(): string {",                                  // 23
  "  return config.app.limits.maxBody.toString();",                        // 24
  "}",                                                                     // 25
  "export function commentOnly(): number {",                               // 26
  "  // config.app.limits.maxBody is documented in the README",            // 27
  "  return 0;",                                                           // 28
  "}",                                                                     // 29
];

const LIMITS_PY = [
  "def body_limit(settings):",                 // 1
  "    return settings.app.limits.maxBody",    // 2
  "",                                          // 3
  "def limit_name():",                         // 4
  '    return "app.limits.maxBody"',           // 5
];

let dir: string;
let graph: GraphV1;

function edgesFrom(source: string, relation = "references"): EdgeV1[] {
  return graph.edges.filter((e) => e.source === source && e.relation === relation);
}

function targetsOf(source: string, relation = "references"): string[] {
  return edgesFrom(source, relation).map((e) => e.target).sort();
}

before(async () => {
  dir = tmpRepo("structured-edges");
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "tools"), { recursive: true });
  mkdirSync(join(dir, "a"), { recursive: true });
  mkdirSync(join(dir, "b"), { recursive: true });
  writeFileSync(join(dir, "package.json"), PACKAGE.join("\n") + "\n");
  writeFileSync(join(dir, "src", "limits.ts"), LIMITS_TS.join("\n") + "\n");
  writeFileSync(join(dir, "src", "config.ts"), "export const config: any = {};\nexport const cfg: any = {};\nexport const x: any = {};\n");
  writeFileSync(join(dir, "tools", "limits.py"), LIMITS_PY.join("\n") + "\n");
  // The same key path in two files: any reference to it is ambiguous.
  writeFileSync(join(dir, "a", "settings.json"), '{\n  "retry": {\n    "count": 3\n  }\n}\n');
  writeFileSync(join(dir, "b", "settings.yml"), "retry:\n  count: 5\n");
  // A four-level path, for the one-below-the-root rule.
  writeFileSync(join(dir, "nested.json"), '{\n  "a": {\n    "b": {\n      "c": {\n        "d": 1\n      }\n    }\n  }\n}\n');
  patchBuildConfig(dir, { structured: true });
  const outDir = join(dir, "graft");
  await buildGraph(dir, { contextDir: outDir, reuse: false });
  graph = readGraph(wiringPath(outDir))!;
});

test("code to key: a member chain equal to a key path references that key, inferred", () => {
  const edges = edgesFrom("src/limits.ts#bodyLimit");
  assert.deepEqual(edges.map((e) => [e.target, e.confidence]), [["package.json#key:app.limits.maxBody", "inferred"]]);
  // The target's span is the key's own line in the fixture.
  const key = graph.nodes.find((n) => n.id === "package.json#key:app.limits.maxBody")!;
  assert.equal(key.span, "L5-L5");
  assert.match(PACKAGE[4]!, /"maxBody"/);
});

test("code to key: a chain may skip the file's root namespace (config = pkg.demo)", () => {
  assert.deepEqual(targetsOf("src/limits.ts#uploadLimit"), ["package.json#key:demo.upload.maxBodyBytes"]);
  assert.deepEqual(targetsOf("src/limits.ts#oneBelowRoot"), ["nested.json#key:a.b.c.d"]);
});

test("code to key: a dotted key path inside a string literal references the key", () => {
  assert.deepEqual(targetsOf("src/limits.ts#tooLarge"), ["package.json#key:demo.upload.maxBodyBytes"]);
});

test("code to key: the object of a method call is read, the method name is not", () => {
  assert.deepEqual(targetsOf("src/limits.ts#bodyText"), ["package.json#key:app.limits.maxBody"]);
});

test("code to key: Python attribute chains and string literals resolve the same way", () => {
  assert.deepEqual(targetsOf("tools/limits.py#body_limit"), ["package.json#key:app.limits.maxBody"]);
  assert.deepEqual(targetsOf("tools/limits.py#limit_name"), ["package.json#key:app.limits.maxBody"]);
});

test("code to key: an ambiguous key path yields no edge", () => {
  // retry.count is in a/settings.json and b/settings.yml; neither may be picked.
  assert.ok(graph.nodes.some((n) => n.id === "a/settings.json#key:retry.count"));
  assert.ok(graph.nodes.some((n) => n.id === "b/settings.yml#key:retry.count"));
  assert.deepEqual(targetsOf("src/limits.ts#retries"), []);
});

test("code to key: one segment, a suffix two below the root, and a comment yield no edge", () => {
  assert.deepEqual(targetsOf("src/limits.ts#port"), []);
  assert.deepEqual(targetsOf("src/limits.ts#tooDeep"), []);
  assert.deepEqual(targetsOf("src/limits.ts#commentOnly"), []);
});

test("code to key: no reference edge ever targets a non-key node or carries a value", () => {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const e of graph.edges) {
    if (e.relation !== "references") continue;
    const target = byId.get(e.target);
    if (target?.kind !== "key") continue;
    assert.equal(e.confidence, "inferred", `${e.source} -> ${e.target}`);
    assert.ok(!e.target.includes("26214400"), e.target);
  }
  // The fixture text itself is unchanged by the build.
  assert.equal(readFileSync(join(dir, "package.json"), "utf8"), PACKAGE.join("\n") + "\n");
});
