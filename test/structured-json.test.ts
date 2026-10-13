/**
 * JSON, JSONC and JSONL keys as nodes: exact spans, bounded size, no secrets.
 *
 * Fixtures are arrays of lines so the expected line numbers are the indices + 1.
 * The secret cases matter as much as the spans: a key node's signature and
 * body_text are searchable and `ask` prints the signature, so a value that
 * reaches either leaves the file.
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
import { MAX_KEYS_PER_FILE, MAX_KEY_DEPTH } from "../src/graph/structured/shared.js";
import { buildGraph } from "../src/graph/build.js";
import { checkGraph } from "../src/graph/check.js";
import { readGraph, wiringPath } from "../src/graph/write.js";
import { patchBuildConfig } from "../src/util/state.js";
import type { NodeV1 } from "../src/graph/types.js";

before(async () => {
  await warmStructuredGrammars(["json"]);
});

function doc(lines: string[], eol = "\n"): string {
  return lines.join(eol) + eol;
}

function keys(source: string, rel = "package.json"): NodeV1[] {
  return extractStructured(rel, source, structuredLangOf(rel)!).nodes.filter((n) => n.kind === "key");
}

function byName(nodes: NodeV1[], name: string): NodeV1 {
  const hit = nodes.find((n) => n.name === name);
  assert.ok(hit, `no key ${name} (got: ${nodes.map((n) => n.name).join(", ")})`);
  return hit;
}

const PKG = [
  "{",                                     //  1
  '  "name": "demo",',                     //  2
  '  "version": "1.0.0",',                 //  3
  '  "scripts": {',                        //  4
  '    "build": "tsc",',                   //  5
  '    "test": "node --test"',             //  6
  "  },",                                  //  7
  '  "bewhole": {',                        //  8
  '    "upload": {',                       //  9
  '      "maxBodyBytes": 26214400,',       // 10
  '      "token": "abc"',                  // 11
  "    }",                                 // 12
  "  },",                                  // 13
  '  "files": [',                          // 14
  '    { "name": "a", "size": 1 },',       // 15
  '    { "path": "no-name" }',             // 16
  "  ]",                                   // 17
  "}",                                     // 18
];

test("json: a key spans its own line to the end of its value", () => {
  const nodes = keys(doc(PKG));
  const spans = Object.fromEntries(nodes.map((n) => [n.name, n.span]));
  assert.deepEqual(spans, {
    name: "L2-L2",
    version: "L3-L3",
    scripts: "L4-L7",
    "scripts.build": "L5-L5",
    "scripts.test": "L6-L6",
    bewhole: "L8-L13",
    "bewhole.upload": "L9-L12",
    "bewhole.upload.maxBodyBytes": "L10-L10",
    "bewhole.upload.token": "L11-L11",
    files: "L14-L17",
    "files[0]": "L15-L15",
    "files[0].name": "L15-L15",
    "files[0].size": "L15-L15",
  });
});

test("json: node shape, ids and contains edges", () => {
  const { nodes, rawEdges } = extractStructured("package.json", doc(PKG), structuredLangOf("package.json")!);
  const max = nodes.find((n) => n.name === "bewhole.upload.maxBodyBytes")!;
  assert.equal(max.id, "package.json#key:bewhole.upload.maxBodyBytes");
  assert.equal(max.kind, "key");
  assert.equal(max.origin, "generic");
  assert.equal(max.signature, "bewhole.upload.maxBodyBytes = 26214400");
  assert.equal(max.body_text, "26214400", "a key's scalar value is its searchable text");

  const pairs = rawEdges.map((e) => `${e.source} > ${e.targetId}`);
  assert.ok(pairs.includes("package.json > package.json#key:name"), "top-level keys hang off the file");
  assert.ok(pairs.includes("package.json#key:bewhole > package.json#key:bewhole.upload"));
  assert.ok(pairs.includes("package.json#key:files > package.json#key:files[0]"));
  assert.deepEqual([...new Set(rawEdges.map((e) => e.relation))], ["contains"]);
});

test("json: array elements count only when they carry a name, id or key", () => {
  const nodes = keys(doc(PKG));
  assert.ok(nodes.some((n) => n.name === "files[0]"));
  assert.ok(!nodes.some((n) => n.name === "files[1]"), "an unnamed element adds nothing");
  assert.equal(byName(nodes, "files[0]").signature, "files[0]: a", "the identifying field is shown");

  const ids = keys(doc(['[{"id": "x", "v": 1}, {"key": "y"}, {"nope": 1}, 5]']), "list.json").map((n) => n.name);
  assert.deepEqual(
    ids,
    ["[0]", "[0].id", "[0].v", "[1]", "[1].key"],
    "top-level arrays index the same way; indices are free of the depth cap",
  );
});

test("json: secret-looking names and opaque values never reach signature or body_text", () => {
  const nodes = keys(doc(PKG));
  const token = byName(nodes, "bewhole.upload.token");
  assert.equal(token.body_text, undefined);
  assert.equal(token.signature, "bewhole.upload.token", "no value in the signature either");

  const wide = keys(doc([
    "{",
    '  "api_key": "k1",',
    '  "DB_PASSWORD": "p1",',
    '  "client-secret": "s1",',
    '  "privateKey": "z1",',
    '  "authToken": "t1",',
    '  "opaque32": "' + "a".repeat(32) + '",',
    '  "opaque33": "' + "a".repeat(33) + '",',
    '  "spacey": "' + "word ".repeat(10).trim() + '",',
    '  "secrets": { "inner": "plain" }',
    "}",
  ]));
  for (const n of ["api_key", "DB_PASSWORD", "client-secret", "privateKey", "authToken", "opaque33", "secrets.inner"]) {
    assert.equal(byName(wide, n).body_text, undefined, `${n} must have no body_text`);
    assert.ok(!/=/.test(byName(wide, n).signature ?? ""), `${n} must have no value in its signature`);
  }
  assert.equal(byName(wide, "opaque32").body_text, "a".repeat(32), "32 characters is the boundary, not 33");
  assert.match(byName(wide, "spacey").body_text ?? "", /word word/, "long text with spaces is prose, not a credential");
});

test("json: keys needing quotes use bracket paths, so a dot in a key is never ambiguous", () => {
  const nodes = keys(doc(['{', '  "a.b": 1,', '  "@types/node": "x",', '  "plain_key": 2,', '  "a": { "b": 3 }', '}']));
  assert.deepEqual(nodes.map((n) => n.name), ['["a.b"]', '["@types/node"]', "plain_key", "a", "a.b"]);
});

test("json: depth and size are capped, preferring shallow keys", () => {
  assert.equal(MAX_KEY_DEPTH, 4);
  const deep = keys(doc(['{"a": {"b": {"c": {"d": {"e": 1}}}}}'])).map((n) => n.name);
  assert.deepEqual(deep, ["a", "a.b", "a.b.c", "a.b.c.d"], "the fifth level is not a node");

  const flat: string[] = [];
  for (let i = 0; i < MAX_KEYS_PER_FILE + 100; i++) flat.push(`"k${i}": ${i}`);
  const big = `{ "big": {${flat.join(", ")}}, "late": 1 }`;
  const names = keys(big).map((n) => n.name);
  assert.equal(names.length, MAX_KEYS_PER_FILE);
  assert.ok(names.includes("late") && names.includes("big"), "shallow keys win over a deep flood");
  assert.deepEqual(keys(big).map((n) => n.name), names, "the same input always selects the same keys");
});

test("json: comments and trailing commas (JSONC) still yield exact keys", () => {
  const nodes = keys(doc([
    "{",                       // 1
    "  // compiler options",   // 2
    '  "compilerOptions": {',  // 3
    '    "strict": true, /* on */', // 4
    '    "target": "ES2022",',  // 5
    "  },",                    // 6
    "}",                       // 7
  ]), "tsconfig.json");
  assert.deepEqual(
    nodes.map((n) => [n.name, n.span]),
    [["compilerOptions", "L3-L6"], ["compilerOptions.strict", "L4-L4"], ["compilerOptions.target", "L5-L5"]],
  );
});

test("json: JSONL indexes the first record's keys only", () => {
  const nodes = keys(doc(['{"ts": 1, "event": "start"}', '{"ts": 2, "event": "stop", "extra": true}']), "run.jsonl");
  assert.deepEqual(nodes.map((n) => [n.name, n.span]), [["ts", "L1-L1"], ["event", "L1-L1"]]);
});

test("json: CRLF, a byte order mark and malformed input do not move or break anything", () => {
  const crlf = keys(doc(PKG, "\r\n"));
  assert.equal(byName(crlf, "bewhole.upload.maxBodyBytes").span, "L10-L10");
  const bom = keys("﻿" + doc(PKG));
  assert.equal(byName(bom, "scripts").span, "L4-L7");

  const broken = extractStructured("x.json", '{"a": 1, "b": ', structuredLangOf("x.json")!);
  assert.equal(broken.nodes[0]!.kind, "file");
  const empty = extractStructured("x.json", "", structuredLangOf("x.json")!);
  assert.deepEqual(empty.nodes.map((n) => n.kind), ["file"]);
});

test("json: a package.json goes through a real build and checks as in sync", async () => {
  const dir = tmpRepo("structured-json");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), doc(PKG));
  writeFileSync(join(dir, "package-lock.json"), '{"lockfileVersion": 3}\n');
  patchBuildConfig(dir, { structured: true });

  const outDir = join(dir, "graft");
  await buildGraph(dir, { contextDir: outDir, reuse: false });
  const graph = readGraph(wiringPath(outDir));
  const max = graph.nodes.find((n) => n.id === "package.json#key:bewhole.upload.maxBodyBytes");
  assert.ok(max, "the key node is in the built graph");
  assert.equal(max.span, "L10-L10");
  assert.ok(!graph.nodes.some((n) => n.path === "package-lock.json"), "lockfiles stay out");
  assert.ok(!JSON.stringify(graph).includes('"abc"'), "the token value is nowhere in the graph");

  const check = await checkGraph(dir, { contextDir: outDir });
  assert.equal(check.ok, true, `check must be clean, got ${JSON.stringify(check)}`);
});
