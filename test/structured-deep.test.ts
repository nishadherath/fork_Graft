/**
 * The deep pass over structured files (Stage 3): `--deep` may summarise them, but
 * only their first units, and the concept pass reads exactly the files the
 * structured tier claims.
 *
 * Both halves cost money per file, so both are pinned: the per-node pass sends no
 * unit past the bound, a code file is untouched by it, and the concept pass never
 * picks up a lockfile just because `.json` is now a claimed extension.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpRepo } from "./helpers.js";
import { enrichGraph, MAX_DEEP_UNITS_PER_STRUCTURED_FILE } from "../src/graph/enrich.js";
import { listContextFiles } from "../src/context/build.js";
import { patchBuildConfig } from "../src/util/state.js";
import { relPosix } from "../src/util/paths.js";
import type { CruxSummarizer, FileCruxInput } from "../src/ai/crux.js";
import type { Kind, NodeV1 } from "../src/graph/types.js";

function node(id: string, path: string, kind: Kind, line: number, endLine = line): NodeV1 {
  return {
    id, name: id.split(/[#:]/).pop() ?? id, kind, path, span: `L${line}-L${endLine}`, signature: id,
    exported: true, origin: kind === "function" && path.endsWith(".ts") ? "ast" : "generic",
    body_hash: `h-${id}`, summary_state: "pending", summary: null, crux: null,
  };
}

test("deep: a structured file sends only its first units to the model; code is unbounded", async () => {
  const units = MAX_DEEP_UNITS_PER_STRUCTURED_FILE + 20;
  const json = ["{", ...Array.from({ length: units }, (_, i) => `  "k${i}": ${i},`), "}"].join("\n");
  const code = Array.from({ length: units }, (_, i) => `export function f${i}() {}`).join("\n");
  // Keys listed last-first, so the bound must order by line, not by array position.
  const keys = Array.from({ length: units }, (_, i) => node(`big.json#key:k${i}`, "big.json", "key", i + 2)).reverse();
  const nodes: NodeV1[] = [
    node("big.json", "big.json", "file", 1, units + 2),
    ...keys,
    node("a.ts", "a.ts", "file", 1, units),
    ...Array.from({ length: units }, (_, i) => node(`a.ts#f${i}`, "a.ts", "function", i + 1)),
  ];
  const sent = new Map<string, string[]>();
  const summarizer: CruxSummarizer = {
    async describeFile(input: FileCruxInput) {
      sent.set(input.path, [...(sent.get(input.path) ?? []), ...input.nodes.map((n) => n.id)]);
      return input.nodes.map((n) => ({ id: n.id, summary: `about ${n.id}`, crux_start: 0, crux_end: 0 }));
    },
  };
  const stats = await enrichGraph(nodes, new Map(), new Map([["big.json", json], ["a.ts", code]]), { summarizer });

  const sentKeys = (sent.get("big.json") ?? []).filter((id) => id.includes("#key:"));
  const expected = Array.from({ length: MAX_DEEP_UNITS_PER_STRUCTURED_FILE }, (_, i) => `big.json#key:k${i}`);
  assert.deepEqual([...sentKeys].sort(), [...expected].sort());
  assert.equal((sent.get("a.ts") ?? []).filter((id) => id.includes("#f")).length, units);
  // The units past the bound stay pending: never summarised, never an error.
  assert.equal(stats.pending, 20);
  assert.equal(stats.errors.length, 0);
  assert.equal(nodes.find((n) => n.id === `big.json#key:k${units - 1}`)!.summary_state, "pending");
});

test("deep: the concept pass reads structured files only when the tier is on, never a lockfile", () => {
  const root = tmpRepo("structured-deep");
  mkdirSync(join(root, "docs"), { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "docs", "guide.md"), "# Guide\n");
  writeFileSync(join(root, "settings.yml"), "a: 1\n");
  writeFileSync(join(root, "package.json"), "{}\n");
  writeFileSync(join(root, "package-lock.json"), "{}\n");
  writeFileSync(join(root, "site.min.css"), ".a{}\n");
  writeFileSync(join(root, "src", "a.ts"), "export const a = 1;\n");
  const outDir = join(root, "graft");
  const listed = (): string[] => listContextFiles(root, outDir, undefined).map((f) => relPosix(root, f)).sort();

  assert.deepEqual(listed(), ["src/a.ts"]);
  patchBuildConfig(root, { structured: true });
  assert.deepEqual(listed(), ["docs/guide.md", "package.json", "settings.yml", "src/a.ts"]);
  // An explicit extension list still means exactly that list.
  assert.deepEqual(listContextFiles(root, outDir, [".md"]).map((f) => relPosix(root, f)), ["docs/guide.md"]);
});

test("deep: the concept pass admits workflow YAML under .github/workflows, as the build does", () => {
  const root = tmpRepo("structured-deep-workflows");
  mkdirSync(join(root, ".github", "workflows"), { recursive: true });
  writeFileSync(join(root, ".github", "workflows", "ci.yml"), "name: ci\n");
  writeFileSync(join(root, ".github", "dependabot.yml"), "version: 2\n");
  writeFileSync(join(root, "settings.yml"), "a: 1\n");
  const outDir = join(root, "graft");
  const listed = (): string[] => listContextFiles(root, outDir, undefined).map((f) => relPosix(root, f)).sort();

  assert.deepEqual(listed(), [], "tier off: no structured file, and nothing behind a dot");
  patchBuildConfig(root, { structured: true });
  assert.deepEqual(
    listed(),
    [".github/workflows/ci.yml", "settings.yml"],
    "the workflow is admitted, the rest of .github is still not walked",
  );
});
