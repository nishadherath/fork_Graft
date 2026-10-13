// Prints the nodes of a graft build, one per line: kind, span, id, signature.
// Usage: node dump-nodes.mjs <repo-root> [path-prefix]
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = process.argv[2];
const prefix = process.argv[3] ?? "";
const g = JSON.parse(readFileSync(join(root, "graft", ".graph", "wiring.json"), "utf8"));
const nodes = (g.nodes ?? g).filter((n) => n.path.startsWith(prefix));
nodes.sort((a, b) => a.path.localeCompare(b.path) || Number(/L(\d+)/.exec(a.span)?.[1]) - Number(/L(\d+)/.exec(b.span)?.[1]) || a.id.localeCompare(b.id));
for (const n of nodes) console.log(`${n.kind.padEnd(9)} ${n.span.padEnd(10)} ${n.id}${n.signature && n.signature !== n.id ? `   sig=${JSON.stringify(n.signature)}` : ""}`);
console.error(`${nodes.length} nodes under "${prefix}"; graph keys: ${Object.keys(g).join(",")}`);
