// Case 8: the concept pass's default file list with the tier on and off and with
// an explicit extension list, and the per-node pass's summary calls over the real
// graph with a counting stand-in for the model. Keyless: nothing leaves the machine.
// Usage: node deep-count.mjs <dist-dir> <fixture-root>
import { readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const [dist, root] = process.argv.slice(2);
const imp = (p) => import(pathToFileURL(join(dist, p)).href);
const { listContextFiles } = await imp("context/build.js");
const { enrichGraph, MAX_DEEP_UNITS_PER_STRUCTURED_FILE } = await imp("graph/enrich.js");
const { patchBuildConfig, readStructured } = await imp("util/state.js");

const outDir = join(root, "graft");
const rel = (f) => relative(root, f).split("\\").join("/");
const list = (exts) => listContextFiles(root, outDir, exts).map(rel).sort();

const wasOn = readStructured(root);
patchBuildConfig(root, { structured: false });
const off = list(undefined);
patchBuildConfig(root, { structured: true });
const on = list(undefined);
const md = list([".md"]);
patchBuildConfig(root, { structured: wasOn });
console.log(`concept pass, tier off: ${off.length} files: ${off.join(" ")}`);
console.log(`concept pass, tier on: ${on.length} files (one summary call each in phase 1):`);
for (const f of on) console.log(`   ${f}`);
console.log(`concept pass, --extensions .md: ${md.length} files: ${md.join(" ")}`);
const indexed = JSON.parse(readFileSync(join(outDir, ".graph", "wiring.json"), "utf8")).nodes.filter((n) => n.kind === "file").map((n) => n.path).sort();
console.log(`built graph has ${indexed.length} file nodes; in the graph but not in the concept list: ${indexed.filter((p) => !on.includes(p)).join(" ") || "none"}`);

// Per-node pass: count describeFile calls and units sent, with and without documents.
const g = JSON.parse(readFileSync(join(outDir, ".graph", "wiring.json"), "utf8"));
// A document's source, as build.ts supplies it, is its cached rendering: the file
// node's signature names the rendering path.
const sources = new Map();
for (const n of g.nodes.filter((x) => x.kind === "file")) {
  const rendering = /-> (graft\/\.graph\/docs\/[0-9a-f]{64}\.txt)/.exec(n.signature ?? "")?.[1];
  const abs = join(root, rendering ?? n.path);
  if (existsSync(abs)) sources.set(n.path, readFileSync(abs, "utf8"));
}
for (const deepDocuments of [false, true]) {
  const nodes = structuredClone(g.nodes);
  const calls = [];
  const summarizer = {
    async describeFile(input) {
      calls.push({ path: input.path, units: input.nodes.length });
      return input.nodes.map((n) => ({ id: n.id, summary: `about ${n.id}`, crux_start: 0, crux_end: 0 }));
    },
  };
  const stats = await enrichGraph(nodes, new Map(), sources, { summarizer, deepDocuments });
  const big = calls.find((c) => c.path === "big/keys.json");
  const pdf = calls.filter((c) => /\.pdf$/.test(c.path));
  console.log(`per-node pass, deepDocuments=${deepDocuments}: ${calls.length} summary calls (one per file), ${calls.reduce((s, c) => s + c.units, 0)} units sent; big/keys.json sent ${big?.units ?? 0} units (bound ${MAX_DEEP_UNITS_PER_STRUCTURED_FILE}); pdf calls: ${pdf.map((c) => `${c.path}:${c.units}`).join(" ") || "none"}; pending after: ${stats.pending}; errors: ${stats.errors.length}`);
}
