/**
 * Fenced code in Markdown goes through the container mechanism: the depth-tier
 * extractor parses the block, and its symbols are put back on the host file's
 * lines. As in `container-extract.test.ts`, the assertion that matters is the
 * span, written as a fixture whose true line numbers are readable off the array.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpRepo } from "./helpers.js";
import { extractStructured, structuredLangOf } from "../src/graph/structured/index.js";
import { fenceLanguagesOf } from "../src/graph/structured/markdown.js";
import { buildGraph } from "../src/graph/build.js";
import { checkGraph } from "../src/graph/check.js";
import { DEPTH_WASM, setDepthParsersForTest, warmDepthGrammars } from "../src/graph/depth-parser.js";
import type { Language } from "../src/graph/extract.js";
import { readGraph, wiringPath } from "../src/graph/write.js";
import { patchBuildConfig } from "../src/util/state.js";

const MD = structuredLangOf("README.md")!;

// Depth grammars are WASM and load asynchronously; extraction is synchronous.
const DEPTH_LANGS = Object.keys(DEPTH_WASM) as Language[];
await warmDepthGrammars(DEPTH_LANGS);

function doc(lines: string[], eol = "\n"): string {
  return lines.join(eol) + eol;
}

const README = [
  "# Usage",                                       //  1
  "",                                              //  2
  "Call it:",                                      //  3
  "",                                              //  4
  "```ts",                                         //  5
  'import { greet } from "./helper";',             //  6
  "",                                              //  7
  "export function boot(name: string): string {",  //  8
  "  return greet(name);",                         //  9
  "}",                                             // 10
  "```",                                           // 11
  "",                                              // 12
  "## Python",                                     // 13
  "",                                              // 14
  "```python",                                     // 15
  "def run():",                                    // 16
  "    return 1",                                  // 17
  "```",                                           // 18
  "",                                              // 19
  "```text",                                       // 20
  "function notIndexed() {}",                      // 21
  "```",                                           // 22
  "",                                              // 23
  "```",                                           // 24
  "function alsoNot() {}",                         // 25
  "```",                                           // 26
];

function symbols(source: string) {
  const { nodes, rawEdges } = extractStructured("README.md", source, MD);
  return { nodes: nodes.filter((n) => n.kind !== "file" && n.kind !== "section"), rawEdges, all: nodes };
}

test("fences: a tagged block's symbols land on the README line, not the block line", () => {
  const { nodes } = symbols(doc(README));
  const spans = Object.fromEntries(nodes.map((n) => [n.id, n.span]));
  assert.deepEqual(spans, {
    "README.md#boot": "L8-L10", // line 3 inside the block; getting L3-L5 is the failure this guards
    "README.md#run": "L16-L17",
  });
});

test("fences: untagged blocks and unsupported tags stay text", () => {
  const { nodes, all } = symbols(doc(README));
  assert.ok(!nodes.some((n) => n.name === "notIndexed" || n.name === "alsoNot"));
  const python = all.find((n) => n.id === "README.md#section:python")!;
  assert.match(python.body_text ?? "", /notIndexed/, "the text is still searchable under its section");
});

test("fences: embedded nodes are the depth tier's own, with its kinds and origin", () => {
  const { nodes } = symbols(doc(README));
  const boot = nodes.find((n) => n.name === "boot")!;
  assert.equal(boot.kind, "function");
  assert.equal(boot.origin, "ast");
  assert.equal(boot.path, "README.md");
  assert.match(boot.signature ?? "", /boot\(name: string\)/);
});

test("fences: only contains edges survive, re-parented to the enclosing section", () => {
  const { rawEdges } = symbols(doc(README));
  assert.deepEqual(
    [...new Set(rawEdges.map((e) => e.relation))].sort(),
    ["contains"],
    "a documentation sample must not create calls or imports edges into the real code",
  );
  const parentOf = (id: string) => rawEdges.find((e) => e.targetId === id)?.source;
  assert.equal(parentOf("README.md#boot"), "README.md#section:usage");
  assert.equal(parentOf("README.md#run"), "README.md#section:python");
});

test("fences: tag spellings map to the depth-tier language", () => {
  const cases: Array<[string, string]> = [
    ["typescript", "function a() {}"],
    ["TS", "function a() {}"],
    ["tsx", "function a() { return 1; }"],
    ["js", "function a() {}"],
    ["javascript", "function a() {}"],
    ["jsx", "function a() { return 1; }"],
    ["py", "def a():\n    pass"],
    ["go", "package p\n\nfunc a() {}"],
  ];
  for (const [tag, code] of cases) {
    const lines = ["# T", "", "```" + tag + " title=\"x.txt\"", ...code.split("\n"), "```"];
    const named = symbols(doc(lines)).nodes.map((n) => n.name);
    assert.ok(named.includes("a"), `tag ${tag} should extract symbol a, got [${named.join(", ")}]`);
  }
});

test("fences: two blocks defining the same name get distinct ids and their own spans", () => {
  const { nodes } = symbols(doc([
    "```ts",             // 1
    "function dup() {}", // 2
    "```",               // 3
    "",                  // 4
    "~~~ts",             // 5
    "function dup() {}", // 6
    "~~~",               // 7
  ]));
  assert.deepEqual(nodes.map((n) => [n.id, n.span]), [
    ["README.md#dup", "L2-L2"],
    ["README.md#dup~2", "L6-L6"],
  ]);
});

test("fences: spans survive CRLF, indentation inside a list item, and an unclosed block", () => {
  assert.equal(symbols(doc(README, "\r\n")).nodes.find((n) => n.name === "boot")?.span, "L8-L10");

  const indented = symbols(doc([
    "1. Install",                // 1
    "",                          // 2
    "   ```ts",                  // 3
    "   export function a() {",  // 4
    "     return 1;",            // 5
    "   }",                      // 6
    "   ```",                    // 7
  ]));
  assert.equal(indented.nodes.find((n) => n.name === "a")?.span, "L4-L6");

  const unclosed = symbols(doc(["text", "```ts", "function tail() {", "}"]));
  assert.equal(unclosed.nodes.find((n) => n.name === "tail")?.span, "L3-L4");
});

test("fences: a block that does not parse as its language never fails the build", () => {
  const out = extractStructured("README.md", doc(["# T", "```ts", "}}} not code {{{", "```"]), MD);
  assert.equal(out.nodes[0]!.kind, "file");
  assert.ok(out.nodes.some((n) => n.kind === "section"));
});

test("fences: a README goes through a real build and checks as in sync", async () => {
  const dir = tmpRepo("structured-fences");
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "helper.ts"), "export function greet(n: string) {\n  return n;\n}\n");
  writeFileSync(join(dir, "README.md"), doc(README));
  patchBuildConfig(dir, { structured: true });

  const outDir = join(dir, "graft");
  await buildGraph(dir, { contextDir: outDir, reuse: false });
  const graph = readGraph(wiringPath(outDir));
  const boot = graph.nodes.find((n) => n.id === "README.md#boot");
  assert.ok(boot, "the fenced function is in the built graph");
  assert.equal(boot.span, "L8-L10");
  assert.ok(
    !graph.edges.some((e) => e.source === "README.md#boot" && e.relation === "calls"),
    "the sample's call to greet is not an edge into src/helper.ts",
  );

  const check = await checkGraph(dir, { contextDir: outDir });
  assert.equal(check.ok, true, `check must be clean, got ${JSON.stringify(check)}`);
});

test("fences: the languages a README's fences name, each once, inside an HTML block too", () => {
  const source = doc([
    "```ts",            //  1
    "```",              //  2
    "~~~ Python title", //  3
    "~~~",              //  4
    "```text",          //  5
    "```",              //  6
    "<div>",            //  7
    "```golang",        //  8
    "</div>",           //  9
    "```typescript",    // 10
  ]);
  assert.deepEqual(fenceLanguagesOf(source).sort(), ["go", "python", "typescript"]);
  assert.deepEqual(fenceLanguagesOf(doc(["# No code", "", "Plain text."])), []);
});

test("fences: a build warms the languages a README's fences name when no source file is in them", async () => {
  // Forget every grammar warmed above: the build alone has to load python's and kotlin's.
  setDepthParsersForTest({});
  try {
    const dir = tmpRepo("structured-fences-warm");
    writeFileSync(
      join(dir, "README.md"),
      doc([
        "# Python",         //  1
        "",                 //  2
        "```python",        //  3
        "def run():",       //  4
        "    return 1",     //  5
        "```",              //  6
        "",                 //  7
        "~~~kotlin",        //  8
        "fun greet() = 1",  //  9
        "~~~",              // 10
      ]),
    );
    patchBuildConfig(dir, { structured: true });

    const outDir = join(dir, "graft");
    await buildGraph(dir, { contextDir: outDir, reuse: false });
    const spans = Object.fromEntries(readGraph(wiringPath(outDir)).nodes.map((n) => [n.id, n.span]));
    assert.equal(spans["README.md#run"], "L4-L5");
    assert.equal(spans["README.md#greet"], "L9-L9");

    const check = await checkGraph(dir, { contextDir: outDir });
    assert.equal(check.ok, true, `check must be clean, got ${JSON.stringify(check)}`);
  } finally {
    await warmDepthGrammars(DEPTH_LANGS);
  }
});

const SHOUT = "class Greeter {\n    fun shout() {\n        greet()\n    }\n}\n";
const FENCE_GREET = doc(["# Usage", "", "~~~kotlin", "fun greet() = 1", "~~~"]);

async function builtGraph(tag: string, files: Record<string, string>) {
  const dir = tmpRepo(tag);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  patchBuildConfig(dir, { structured: true });
  const outDir = join(dir, "graft");
  await buildGraph(dir, { contextDir: outDir, reuse: false });
  return readGraph(wiringPath(outDir));
}

test("fences: a code call with no code candidate never resolves into a README fence symbol", async () => {
  const graph = await builtGraph("structured-fences-target", { "src/Main.kt": SHOUT, "README.md": FENCE_GREET });
  assert.ok(graph.nodes.some((n) => n.id === "README.md#greet"), "the fence symbol is in the graph");
  assert.ok(
    !graph.edges.some((e) => e.relation === "calls" && e.source === "src/Main.kt#Greeter.shout" && e.target === "README.md#greet"),
    "documentation is not a call target",
  );
});

test("fences: a code call still resolves to a real function of the same name as a fence symbol", async () => {
  const graph = await builtGraph("structured-fences-real", {
    "src/Main.kt": SHOUT,
    "src/Util.kt": "fun greet() = 2\n",
    "README.md": FENCE_GREET,
  });
  const targets = graph.edges
    .filter((e) => e.relation === "calls" && e.source === "src/Main.kt#Greeter.shout")
    .map((e) => e.target);
  assert.deepEqual(targets, ["src/Util.kt#greet"]);
});
