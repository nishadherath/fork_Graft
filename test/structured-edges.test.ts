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

// ---------------------------------------------------------------------------
// Markdown links, and code strings that name a Markdown anchor.
// ---------------------------------------------------------------------------

let linksDir: string;
let links: GraphV1;

const GUIDE_MD = [
  "# Guide",                                                         //  1
  "",                                                                //  2
  "See [the setup](setup.md#install-steps).",                        //  3
  "Also [setup](./setup.md) and [up](../README.md#overview).",       //  4
  "[External](https://example.com/x.md#a) and [mail](mailto:a@b.c).",//  5
  "",                                                                //  6
  "## Local",                                                        //  7
  "",                                                                //  8
  "Jump to [the top](#guide) or the [second](setup.md#install-steps-1).", //  9
  "A `[span](setup.md#setup)` is code, and so is the fence below.",  // 10
  "",                                                                // 11
  "```md",                                                           // 12
  "[fenced](../README.md)",                                          // 13
  "```",                                                             // 14
  "",                                                                // 15
  "[gone]: setup.md#no-such-heading",                                // 16
  "[nowhere](missing.md)",                                           // 17
];

const SETUP_MD = [
  "# Setup",          // 1
  "",                 // 2
  "## Install steps", // 3
  "",                 // 4
  "## Install steps", // 5
];

const HELP_TS = [
  "export function helpLink(): string {",      // 1
  '  return "docs/setup.md#install-steps";',   // 2
  "}",                                          // 3
  "export function missingLink(): string {",   // 4
  '  return "docs/missing.md#install-steps";', // 5
  "}",                                          // 6
];

before(async () => {
  linksDir = tmpRepo("structured-links");
  mkdirSync(join(linksDir, "docs"), { recursive: true });
  mkdirSync(join(linksDir, "src"), { recursive: true });
  writeFileSync(join(linksDir, "docs", "guide.md"), GUIDE_MD.join("\n") + "\n");
  writeFileSync(join(linksDir, "docs", "setup.md"), SETUP_MD.join("\n") + "\n");
  writeFileSync(join(linksDir, "README.md"), "# Overview\n\nWords.\n");
  writeFileSync(join(linksDir, "src", "help.ts"), HELP_TS.join("\n") + "\n");
  patchBuildConfig(linksDir, { structured: true });
  const outDir = join(linksDir, "graft");
  await buildGraph(linksDir, { contextDir: outDir, reuse: false });
  links = readGraph(wiringPath(outDir))!;
});

function linkTargets(source: string): Array<[string, string]> {
  return links.edges
    .filter((e) => e.source === source && e.relation === "references")
    .map((e): [string, string] => [e.target, e.confidence])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

test("markdown links: a link to a heading references that section, to a file the file", () => {
  // Lines 3 to 5 sit in "Guide" (L1-L17 holds "Local" too, so Local's own links
  // hang off Local). External and mailto targets yield nothing.
  assert.deepEqual(linkTargets("docs/guide.md#section:guide"), [
    ["README.md#section:overview", "extracted"],
    ["docs/setup.md", "extracted"],
    ["docs/setup.md#section:install-steps", "extracted"],
  ]);
});

test("markdown links: same-file anchors, duplicate-heading anchors and reference definitions", () => {
  // `#install-steps-1` is GitHub's anchor for the second "Install steps", which
  // this tier ids `~2`. A definition whose anchor is missing still names the file.
  assert.deepEqual(linkTargets("docs/guide.md#section:local"), [
    ["docs/guide.md#section:guide", "extracted"],
    ["docs/setup.md", "extracted"],
    ["docs/setup.md#section:install-steps~2", "extracted"],
  ]);
  const second = links.nodes.find((n) => n.id === "docs/setup.md#section:install-steps~2")!;
  assert.equal(second.span, "L5-L5");
  assert.equal(SETUP_MD[4], "## Install steps");
});

test("markdown links: code spans, fences and missing files yield no edge", () => {
  const all = links.edges.filter((e) => e.source.startsWith("docs/guide.md") && e.relation === "references");
  assert.ok(!all.some((e) => e.target === "docs/setup.md#section:setup"), "a code span is not a link");
  assert.ok(!all.some((e) => e.target === "README.md"), "a fenced link is not a link");
  assert.ok(!all.some((e) => e.target.includes("missing")), "a missing file is not a target");
});

test("code to anchor: a string naming a Markdown heading references that section", () => {
  assert.deepEqual(linkTargets("src/help.ts#helpLink"), [["docs/setup.md#section:install-steps", "inferred"]]);
  assert.deepEqual(linkTargets("src/help.ts#missingLink"), []);
});

// ---------------------------------------------------------------------------
// HTML: src and stylesheet href import the file, a link references it, and a
// class attribute references the stylesheet rule for that class.
// ---------------------------------------------------------------------------

const INDEX_HTML = [
  "<!doctype html>",                                   //  1
  "<html>",                                            //  2
  "<head>",                                            //  3
  '  <link rel="stylesheet" href="styles/site.css">',  //  4
  '  <script src="app.js"></script>',                  //  5
  "  <style>",                                         //  6
  "    .local { color: red; }",                        //  7
  "  </style>",                                        //  8
  "</head>",                                           //  9
  "<body>",                                            // 10
  '  <main id="main" class="card local shared">',      // 11
  '    <a href="about.html">About</a>',                // 12
  '    <img src="https://cdn.example.com/x.png">',     // 13
  '    <a href="missing.html">Gone</a>',               // 14
  "  </main>",                                         // 15
  "</body>",                                           // 16
  "</html>",                                           // 17
];

const SITE_CSS = [
  ".card {",           // 1
  "  padding: 1rem;",  // 2
  "}",                 // 3
  ".shared {",         // 4
  "  margin: 0;",      // 5
  "}",                 // 6
];

let htmlDir: string;
let page: GraphV1;

before(async () => {
  htmlDir = tmpRepo("structured-html-edges");
  mkdirSync(join(htmlDir, "site", "styles"), { recursive: true });
  writeFileSync(join(htmlDir, "site", "index.html"), INDEX_HTML.join("\n") + "\n");
  writeFileSync(join(htmlDir, "site", "styles", "site.css"), SITE_CSS.join("\n") + "\n");
  // `.shared` is defined twice, so a class="shared" names no single rule.
  writeFileSync(join(htmlDir, "site", "styles", "other.css"), ".shared {\n  margin: 1px;\n}\n");
  writeFileSync(join(htmlDir, "site", "app.js"), "export function boot() {}\n");
  writeFileSync(join(htmlDir, "site", "about.html"), "<p>About</p>\n");
  patchBuildConfig(htmlDir, { structured: true });
  const outDir = join(htmlDir, "graft");
  await buildGraph(htmlDir, { contextDir: outDir, reuse: false });
  page = readGraph(wiringPath(outDir))!;
});

function pageEdges(source: string, relation: string): Array<[string, string]> {
  return page.edges
    .filter((e) => e.source === source && e.relation === relation)
    .map((e): [string, string] => [e.target, e.confidence])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

test("html: a script src and a stylesheet link import the file they name", () => {
  assert.deepEqual(pageEdges("site/index.html", "imports"), [
    ["site/app.js", "extracted"],
    ["site/styles/site.css", "extracted"],
  ]);
});

test("html: a class references its rule, same-file first; an ambiguous class yields nothing", () => {
  assert.deepEqual(pageEdges("site/index.html#element:main#main", "references"), [
    ["site/about.html", "extracted"],
    ["site/index.html#selector:.local", "extracted"],
    ["site/styles/site.css#selector:.card", "inferred"],
  ]);
  const card = page.nodes.find((n) => n.id === "site/styles/site.css#selector:.card")!;
  assert.equal(card.span, "L1-L3");
  assert.equal(SITE_CSS[0], ".card {");
});

test("html: external, missing and non-indexed targets yield no edge", () => {
  const all = page.edges.filter((e) => e.source.startsWith("site/index.html") && e.relation !== "contains");
  assert.ok(!all.some((e) => /missing|example\.com|x\.png|shared/.test(e.target)), JSON.stringify(all));
});
