// Compares two graft builds: backslashes anywhere in node paths, ids, spans or
// signatures, and whether the (id, kind, span) sets agree outside `skip` prefixes.
// Usage: node compare-builds.mjs <rootA> <rootB> [skipPrefix,...]
import { readFileSync } from "node:fs";
import { join } from "node:path";
const [a, b, skipArg = ""] = process.argv.slice(2);
const skip = skipArg.split(",").filter(Boolean);
const load = (root) => JSON.parse(readFileSync(join(root, "graft", ".graph", "wiring.json"), "utf8"));
const key = (n) => `${n.id}|${n.kind}|${n.span}|${n.signature ?? ""}`;
for (const [label, root] of [["A", a], ["B", b]]) {
  const g = load(root);
  const bs = g.nodes.filter((n) => /\\/.test(n.path) || /\\/.test(n.id) || /\\/.test(n.span));
  const sigBs = g.nodes.filter((n) => typeof n.signature === "string" && /\\/.test(n.signature) && n.kind !== "key");
  console.log(`${label} ${root}: ${g.nodes.length} nodes, ${g.edges.length} edges; backslash in path/id/span: ${bs.length}; non-key signatures with a backslash: ${sigBs.length}`);
  if (sigBs.length) console.log("  ", sigBs.slice(0, 3).map((n) => n.signature));
  const edgeBs = g.edges.filter((e) => /\\/.test(JSON.stringify(e)));
  console.log(`   edges with a backslash: ${edgeBs.length}; meta: ${JSON.stringify(g.meta).slice(0, 200)}`);
}
const keep = (n) => !skip.some((p) => n.path.startsWith(p));
const A = new Set(load(a).nodes.filter(keep).map(key));
const B = new Set(load(b).nodes.filter(keep).map(key));
const onlyA = [...A].filter((k) => !B.has(k));
const onlyB = [...B].filter((k) => !A.has(k));
console.log(`node sets (skipping ${JSON.stringify(skip)}): ${A.size} vs ${B.size}; only in A: ${onlyA.length}; only in B: ${onlyB.length}`);
for (const k of [...onlyA, ...onlyB].slice(0, 10)) console.log("  ", k);
