/**
 * The structured tier's plumbing: which files it claims, when it is on, and
 * that every consumer of the file set agrees about it.
 *
 * The tier is opt-in (`--structured`, or `GRAFT_STRUCTURED=1`). The risk in an
 * opt-in tier is not the parse, it is disagreement: if `build` enumerates `.md`
 * files and the freshness probe or `check` does not (or the reverse), every
 * query reports phantom drift and the rebuild it triggers can never clear it.
 * The same class of bug as #236 for the container tier. These tests pin the
 * agreement; `structured-spans.test.ts` pins the spans.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpRepo } from "./helpers.js";
import {
  STRUCTURED_LANGS,
  structuredExtensions,
  structuredLangOf,
} from "../src/graph/structured/index.js";
import { languageOf } from "../src/graph/extract.js";
import { genericLangOf } from "../src/graph/generic.js";
import { containerLangOf } from "../src/graph/container.js";
import { supportedExtensions, listSourceFiles } from "../src/graph/source-files.js";
import { buildGraph } from "../src/graph/build.js";
import { checkGraph } from "../src/graph/check.js";
import { probeDrift } from "../src/graph/fingerprint.js";
import { patchBuildConfig, readStructured } from "../src/util/state.js";
import { checkGraphInvariants } from "../src/graph/invariants.js";
import { stampDir } from "../src/graph/extract-cache.js";
import { readGraph, wiringPath } from "../src/graph/write.js";

function repoWithDocs(tag: string): { dir: string; outDir: string } {
  const dir = tmpRepo(tag);
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "util.ts"), "export function util(): number {\n  return 1;\n}\n");
  writeFileSync(join(dir, "README.md"), "# Title\n\nBody.\n");
  writeFileSync(join(dir, "config.json"), '{\n  "port": 8080\n}\n');
  return { dir, outDir: join(dir, "graft") };
}

function files(dir: string, outDir: string): string[] {
  return listSourceFiles(dir, outDir)
    .map((f) => f.slice(dir.length + 1).replaceAll("\\", "/"))
    .sort();
}

test("structured: the registry claims the five families and nothing a deeper tier owns", () => {
  assert.equal(structuredLangOf("docs/AGENTS.md")?.family, "markdown");
  assert.equal(structuredLangOf("docs/guide.MDX")?.family, "markdown", "extension match is case-insensitive");
  assert.equal(structuredLangOf("package.json")?.family, "json");
  assert.equal(structuredLangOf("tsconfig.jsonc")?.family, "json");
  assert.equal(structuredLangOf("log.jsonl")?.family, "json");
  assert.equal(structuredLangOf(".github/workflows/ci.yml")?.family, "yaml");
  assert.equal(structuredLangOf("pyproject.toml")?.family, "toml");
  assert.equal(structuredLangOf("setup.cfg")?.family, "ini");
  assert.equal(structuredLangOf("php.INI")?.family, "ini");
  assert.equal(structuredLangOf("src/util.ts"), null);

  const seen = new Set<string>();
  for (const lang of STRUCTURED_LANGS) {
    for (const ext of lang.exts) {
      assert.ok(!seen.has(ext), `extension ${ext} is claimed twice`);
      seen.add(ext);
    }
  }
  assert.deepEqual([...seen].sort(), structuredExtensions().slice().sort());

  // A tier below this one must win a shared extension, so the registry may not
  // contain one: that would make the dispatch order matter silently.
  for (const ext of seen) {
    const probe = `x${ext}`;
    assert.equal(languageOf(probe), null, `${ext} is claimed by the depth tier`);
    assert.equal(genericLangOf(probe), null, `${ext} is claimed by the breadth tier`);
    assert.equal(containerLangOf(probe), null, `${ext} is claimed by the container tier`);
  }
});

test("structured: lockfiles are never indexed, whatever their extension", () => {
  assert.equal(structuredLangOf("package-lock.json"), null);
  assert.equal(structuredLangOf("sub/dir/package-lock.json"), null);
  assert.equal(structuredLangOf("npm-shrinkwrap.json"), null);
  assert.equal(structuredLangOf("pnpm-lock.yaml"), null);
});

test("structured: -e support set grows only when the tier is on", () => {
  assert.ok(!supportedExtensions().includes(".md"), ".md must not read as supported while the tier is off");
  assert.ok(supportedExtensions(true).includes(".md"));
  assert.ok(supportedExtensions(true).includes(".toml"));
});

test("structured: file selection follows the persisted choice", () => {
  const { dir, outDir } = repoWithDocs("structured-select");
  assert.deepEqual(files(dir, outDir), ["src/util.ts"]);
  patchBuildConfig(dir, { structured: true });
  assert.deepEqual(files(dir, outDir), ["README.md", "config.json", "src/util.ts"]);
  patchBuildConfig(dir, { structured: false });
  assert.deepEqual(files(dir, outDir), ["src/util.ts"]);
});

test("structured: the env twin overrides the persisted choice both ways", () => {
  const { dir } = repoWithDocs("structured-env");
  const saved = process.env.GRAFT_STRUCTURED;
  try {
    delete process.env.GRAFT_STRUCTURED;
    assert.equal(readStructured(dir), false, "off by default (decision D1)");
    patchBuildConfig(dir, { structured: true });
    assert.equal(readStructured(dir), true);
    process.env.GRAFT_STRUCTURED = "0";
    assert.equal(readStructured(dir), false, "GRAFT_STRUCTURED=0 is an explicit off");
    process.env.GRAFT_STRUCTURED = "false";
    assert.equal(readStructured(dir), false);
    patchBuildConfig(dir, { structured: false });
    process.env.GRAFT_STRUCTURED = "1";
    assert.equal(readStructured(dir), true, "GRAFT_STRUCTURED=1 is the env twin of --structured");
    process.env.GRAFT_STRUCTURED = "";
    assert.equal(readStructured(dir), false, "an empty value is unset");
  } finally {
    if (saved === undefined) delete process.env.GRAFT_STRUCTURED;
    else process.env.GRAFT_STRUCTURED = saved;
  }
});

test("structured: a build without the tier leaves documents out, with it they get file nodes", async () => {
  const { dir, outDir } = repoWithDocs("structured-build");
  await buildGraph(dir, { contextDir: outDir, reuse: false });
  let graph = readGraph(wiringPath(outDir));
  assert.deepEqual(graph.nodes.filter((n) => n.kind === "file").map((n) => n.path), ["src/util.ts"]);

  patchBuildConfig(dir, { structured: true });
  await buildGraph(dir, { contextDir: outDir, reuse: false });
  graph = readGraph(wiringPath(outDir));
  assert.deepEqual(
    graph.nodes.filter((n) => n.kind === "file").map((n) => n.path).sort(),
    ["README.md", "config.json", "src/util.ts"],
  );
  assert.ok(graph.meta.languages.includes("markdown"));
  assert.ok(graph.meta.languages.includes("json"));
  assert.deepEqual(checkGraphInvariants(graph).problems, []);
});

test("structured: the freshness probe and check agree with the build", async () => {
  const { dir, outDir } = repoWithDocs("structured-agree");
  patchBuildConfig(dir, { structured: true });
  await buildGraph(dir, { contextDir: outDir, reuse: false });

  const drift = probeDrift(dir, outDir);
  assert.deepEqual(drift, { changed: [], added: [], removed: [] }, "no phantom drift right after the build");

  const check = await checkGraph(dir, { contextDir: outDir });
  assert.equal(check.ok, true, `check must be clean, got ${JSON.stringify(check)}`);

  writeFileSync(join(dir, "README.md"), "# Title\n\nBody changed.\n");
  assert.deepEqual(probeDrift(dir, outDir)?.changed, ["README.md"], "an edited document is drift");
});

test("structured: the Kind union accepts section and key nodes", () => {
  const node = (id: string, kind: "section" | "key") => ({
    id, name: id, kind, path: "a.md", span: "L1-L2", signature: null, exported: true,
    origin: "generic" as const, body_hash: "h", summary_state: "pending" as const, summary: null, crux: null,
  });
  const graph = {
    meta: { version: 1 as const, nodeCount: 2, edgeCount: 0, languages: [] },
    nodes: [node("a.md#section:intro", "section"), node("a.md#key:port", "key")],
    edges: [],
  };
  assert.deepEqual(checkGraphInvariants(graph).problems, []);
});

test("structured: the extractor stamp covers the structured/ subdirectory", () => {
  // `extractorStamp` hashes the modules beside extract-cache.ts. Scanners live one
  // level down, so without naming that directory an edit to a scanner would leave
  // the stamp unchanged and replay stale parses from the extraction cache.
  const dir = tmpRepo("structured-stamp");
  mkdirSync(join(dir, "structured"));
  writeFileSync(join(dir, "a.js"), "a");
  writeFileSync(join(dir, "structured", "b.js"), "b");

  const without = stampDir(dir, ".js", "1");
  const withSub = stampDir(dir, ".js", "1", ["structured"]);
  assert.notEqual(withSub, without, "naming the subdirectory changes what is hashed");

  writeFileSync(join(dir, "structured", "b.js"), "b2");
  assert.equal(stampDir(dir, ".js", "1"), without, "a subdirectory edit is invisible when it is not named");
  assert.notEqual(stampDir(dir, ".js", "1", ["structured"]), withSub, "and moves the stamp when it is");

  assert.equal(stampDir(dir, ".js", "1", ["absent"]), without, "a missing subdirectory is skipped, not fatal");

  // The real thing: the shipped scanners are inside the hashed set.
  const here = dirname(fileURLToPath(import.meta.url));
  const graphDir = join(here, "..", "src", "graph");
  assert.notEqual(
    stampDir(graphDir, ".ts", "x", ["structured"]),
    stampDir(graphDir, ".ts", "x"),
    "src/graph/structured/ holds modules",
  );
});
