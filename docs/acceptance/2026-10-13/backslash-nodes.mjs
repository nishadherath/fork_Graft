// Lists every node and edge of a build whose id, path, span or JSON carries a backslash.
import { readFileSync } from "node:fs";
import { join } from "node:path";
const g = JSON.parse(readFileSync(join(process.argv[2], "graft", ".graph", "wiring.json"), "utf8"));
for (const n of g.nodes) if (/\\/.test(n.id) || /\\/.test(n.path) || /\\/.test(n.span)) console.log("node", n.kind, n.span, n.id);
for (const e of g.edges) if (/\\/.test(JSON.stringify(e))) console.log("edge", JSON.stringify(e));
