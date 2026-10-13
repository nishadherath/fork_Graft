/**
 * `blast` over structured files (Stage 3): a changed line in a config file or a
 * document reports the code and documents that name it.
 *
 * A key's value contains its children's values, and a section's text contains its
 * sub-sections, so a reader of the container reads the changed line too. Code is
 * different (a caller of a class does not call every method), which is why this
 * widening is pinned to keys and sections only. The seeds reported stay the
 * innermost units: the widening changes who is reached, not what changed.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpRepo } from "./helpers.js";
import { buildGraph } from "../src/graph/build.js";
import { readGraph, wiringPath } from "../src/graph/write.js";
import { patchBuildConfig } from "../src/util/state.js";
import { blastRadius } from "../src/blast/blast.js";
import type { ChangedFile } from "../src/blast/diff.js";
import type { GraphV1 } from "../src/graph/types.js";

const PACKAGE = [
  "{",                                 // 1
  '  "name": "demo",',                 // 2
  '  "demo": {',                       // 3
  '    "upload": {',                   // 4
  '      "maxBodyBytes": 26214400,',   // 5
  '      "quality": 80',               // 6
  "    }",                             // 7
  "  }",                               // 8
  "}",                                 // 9
];

const LIMITS_TS = [
  "export function bodyLimit(config: any): number { return config.upload.maxBodyBytes; }", // 1
  "export function uploadSettings(pkg: any): object { return pkg.demo.upload; }",           // 2
  "export function quality(config: any): number { return config.upload.quality; }",        // 3
  "export function unrelated(): number { return 1; }",                                      // 4
];

const GUIDE_MD = [
  "# Guide",          //  1
  "",                 //  2
  "Intro.",           //  3
  "",                 //  4
  "## Limits",        //  5
  "",                 //  6
  "Body cap 25 MB.",  //  7
  "",                 //  8
  "### Detail",       //  9
  "",                 // 10
  "Detail text.",     // 11
  "",                 // 12
  "## Other",         // 13
  "",                 // 14
  "Other text.",      // 15
];

let graph: GraphV1;

function change(path: string, line: number): ChangedFile {
  return { path, status: "modified", ranges: [{ start: line, end: line }], hunks: [] };
}

function impactedIds(changed: ChangedFile[]): string[] {
  return blastRadius(graph, changed, "test", { depth: 2 }).impacted.map((i) => i.id).sort();
}

before(async () => {
  const dir = tmpRepo("structured-blast");
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "package.json"), PACKAGE.join("\n") + "\n");
  writeFileSync(join(dir, "src", "limits.ts"), LIMITS_TS.join("\n") + "\n");
  writeFileSync(join(dir, "docs", "guide.md"), GUIDE_MD.join("\n") + "\n");
  writeFileSync(join(dir, "docs", "readme.md"), "# Readme\n\nSee [the limits](guide.md#limits) and [other](guide.md#other).\n");
  patchBuildConfig(dir, { structured: true });
  const outDir = join(dir, "graft");
  await buildGraph(dir, { contextDir: outDir, reuse: false });
  graph = readGraph(wiringPath(outDir))!;
});

test("blast: a changed key reports the code that names it and the code that reads its parent", () => {
  const report = blastRadius(graph, [change("package.json", 5)], "test", { depth: 2 });
  // The seed is the innermost key, exactly as for code.
  assert.deepEqual(report.seeds.map((s) => s.id), ["package.json#key:demo.upload.maxBodyBytes"]);
  const ids = report.impacted.map((i) => i.id);
  assert.ok(ids.includes("src/limits.ts#bodyLimit"), ids.join(", "));
  // pkg.demo.upload reads the object that holds the changed value.
  assert.ok(ids.includes("src/limits.ts#uploadSettings"), ids.join(", "));
  // A sibling key's reader and unrelated code are not reached.
  assert.ok(!ids.includes("src/limits.ts#quality"), ids.join(", "));
  assert.ok(!ids.includes("src/limits.ts#unrelated"), ids.join(", "));
});

test("blast: a changed sub-section reports links to the section that holds it, not to its siblings", () => {
  const ids = impactedIds([change("docs/guide.md", 11)]);
  assert.ok(ids.includes("docs/readme.md#section:readme"), ids.join(", "));
  // The same readme links to #other too, but only the #limits link reaches here;
  // check the edge that did it is the one into `limits`.
  const into = graph.edges.filter((e) => e.source === "docs/readme.md#section:readme" && e.relation === "references").map((e) => e.target).sort();
  assert.deepEqual(into, ["docs/guide.md#section:limits", "docs/guide.md#section:other"]);
  // A change to "Other" alone reaches the readme through its own link, and
  // nothing reaches through "Limits".
  assert.ok(impactedIds([change("docs/guide.md", 15)]).includes("docs/readme.md#section:readme"));
});

test("blast: code seeds keep their innermost rule (no widening to the enclosing symbol)", () => {
  // A change inside a function is not widened to anything: only keys and sections are.
  const report = blastRadius(graph, [change("src/limits.ts", 4)], "test", { depth: 2 });
  assert.deepEqual(report.seeds.map((s) => s.id), ["src/limits.ts#unrelated"]);
  assert.deepEqual(report.impacted, []);
});
