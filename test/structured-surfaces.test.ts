/**
 * The surfaces an agent reads: skeleton, ask (with --source), grep and the cards.
 *
 * The extractors are pinned elsewhere; this file pins the claim that matters to a
 * user, that the section and key nodes appear in every surface, print their own
 * kind, and that the text `--source` prints is the exact span. Each assertion
 * compares against lines read straight from the fixture file, never against the
 * span string alone.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpRepo } from "./helpers.js";
import { buildGraph } from "../src/graph/build.js";
import { readGraph, wiringPath } from "../src/graph/write.js";
import { patchBuildConfig } from "../src/util/state.js";
import { ask, skeleton, formatSkeleton } from "../src/ask/ask.js";
import { grepGraph } from "../src/search/grep.js";

const GUIDE = [
  "# Operations guide",                    //  1
  "",                                      //  2
  "Intro words.",                          //  3
  "",                                      //  4
  "## Rotating credentials",               //  5
  "",                                      //  6
  "Rotate the signing keys every quarter,",//  7
  "then redeploy the gateway.",            //  8
  "",                                      //  9
  "## Backups",                            // 10
  "",                                      // 11
  "Snapshots run nightly.",                // 12
];

const PACKAGE = [
  "{",                                     //  1
  '  "name": "demo",',                     //  2
  '  "bewhole": {',                        //  3
  '    "upload": {',                       //  4
  '      "maxEdgePixels": 2000,',          //  5
  '      "maxBodyBytes": 26214400',        //  6
  "    }",                                 //  7
  "  }",                                   //  8
  "}",                                     //  9
];

let dir: string;
let outDir: string;

function read(rel: string): string[] {
  return readFileSync(join(dir, rel), "utf8").split("\n");
}

before(async () => {
  dir = tmpRepo("structured-surfaces");
  mkdirSync(join(dir, "docs"), { recursive: true });
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "docs", "guide.md"), GUIDE.join("\n") + "\n");
  writeFileSync(join(dir, "package.json"), PACKAGE.join("\n") + "\n");
  // Same stem, three formats: their cards must not overwrite one another.
  writeFileSync(join(dir, "docs", "guide.json"), '{\n  "title": "Guide data"\n}\n');
  writeFileSync(join(dir, "settings.yml"), "retention:\n  days: 30\n");
  writeFileSync(join(dir, "settings.toml"), "[retention]\ndays = 30\n");
  writeFileSync(join(dir, "src", "gateway.ts"), "export function gateway(): number {\n  return 1;\n}\n");
  patchBuildConfig(dir, { structured: true });
  outDir = join(dir, "graft");
  await buildGraph(dir, { contextDir: outDir, reuse: false });
});

test("skeleton: lists every heading with its true span and the kind 'section'", () => {
  const sk = skeleton(dir, "docs/guide.md", { contextDir: outDir });
  assert.deepEqual(
    sk.entries.map((e) => [e.name, e.kind, e.span]),
    [
      ["Operations guide", "section", "L1-L12"],
      ["Rotating credentials", "section", "L5-L9"],
      ["Backups", "section", "L10-L12"],
    ],
  );
  const text = formatSkeleton(sk);
  assert.match(text, /Rotating credentials/);
  assert.match(text, /section/);
});

test("skeleton: a JSON file lists its keys as kind 'key'", () => {
  const sk = skeleton(dir, "package.json", { contextDir: outDir });
  const byName = Object.fromEntries(sk.entries.map((e) => [e.name, [e.kind, e.span]]));
  assert.deepEqual(byName["bewhole.upload.maxBodyBytes"], ["key", "L6-L6"]);
  assert.deepEqual(byName["bewhole.upload"], ["key", "L4-L7"]);
});

test("ask --source: a section is found by its words and printed verbatim from the file", () => {
  const result = ask(dir, "how do I rotate the signing keys", { contextDir: outDir, source: true });
  const hit = result.hits.find((h) => h.pointer === "docs/guide.md:L5-L9");
  assert.ok(hit, `expected the Rotating credentials section, got: ${result.hits.map((h) => h.pointer).join(", ")}`);
  assert.equal(hit.code?.trim(), read("docs/guide.md").slice(4, 9).join("\n").trim(), "--source prints exactly lines 5-9");
});

test("ask --source: a config key is found by its words and printed verbatim from the file", () => {
  const result = ask(dir, "upload body limit", { contextDir: outDir, source: true });
  const hit = result.hits.find((h) => h.pointer === "package.json:L6-L6");
  assert.ok(hit, `expected bewhole.upload.maxBodyBytes, got: ${result.hits.map((h) => h.pointer).join(", ")}`);
  assert.match(hit.title, /bewhole\.upload\.maxBodyBytes · key/, "the hit says it is a key, not a variable");
  assert.equal(hit.code?.trim(), read("package.json")[5]!.trim());
});

test("grep: a hit inside a config file is grouped under its enclosing key", () => {
  const graph = readGraph(wiringPath(outDir));
  const result = grepGraph(graph, dir, "maxBodyBytes", { fixed: true });
  const group = result.groups.find((g) => g.path === "package.json");
  assert.ok(group, "package.json has a group");
  assert.equal(group.symbol?.id, "package.json#key:bewhole.upload.maxBodyBytes");
  assert.equal(group.symbol?.kind, "key");
});

test("cards: files that share a stem each keep their own card, with the kind printed", () => {
  const card = (rel: string) => readFileSync(join(outDir, rel), "utf8");
  const guide = card("docs/guide.md");
  assert.match(guide, /^# docs\/guide\.md/m);
  assert.match(guide, /- Rotating credentials · section · L5-L9/);

  // docs/guide.json would map to docs/guide.md too; it must get a distinct card.
  const data = card("docs/guide.json.md");
  assert.match(data, /^# docs\/guide\.json/m);
  assert.match(data, /- title · key · L2-L2/);

  // Two sources, settings.toml and settings.yml, would both map to settings.md.
  const cards = ["settings.md", "settings.yml.md"].filter((c) => existsSync(join(outDir, c)));
  assert.equal(cards.length, 2, `two formats, two cards, got ${cards.join(", ")}`);
  const heads = cards.map((c) => /^# (\S+)/m.exec(card(c))![1]);
  assert.deepEqual([...heads].sort(), ["settings.toml", "settings.yml"], "each card describes a different source file");
});

test("a file with only a stem collision with code still gets a card of its own", () => {
  assert.ok(existsSync(join(outDir, "src", "gateway.md")));
});
