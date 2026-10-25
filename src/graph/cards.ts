/**
 * Tier-2 "wiring cards" — the passive-channel surface of the wiring graph.
 *
 * The wiring graph itself lives as machine-only JSON in `graft/.graph/wiring.json`
 * (nodes + edges), which an agent never greps or reads. This module projects its
 * NODES up into markdown: one small card per source file, mirroring the source
 * tree under `graft/` (e.g. `graft/src/ai/providers.md`). Each card lists the
 * file's symbols with their `L<start>-L<end>` spans and a one-line description, so
 * a `grep <symbol>` / `find <name>` / `cat` lands on the card and the agent reads
 * ~150 tokens instead of the whole source file. Edges stay in the JSON — you can't
 * grep a traversal — and are reached through `graft ask`.
 *
 * Cards are a pure projection: no LLM work here. The one-liner is the node's LLM
 * `summary` when present (after `graft build --deep`), else its deterministic
 * `signature`, so cards are useful even in a $0 structure-only build.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { relPosix } from "../util/paths.js";
import { matter } from "../util/front-matter.js";
import type { GraphV1, NodeV1 } from "./types.js";
import { CACHE_DIR, readNodes, rootFileCardPaths } from "../context/node-file.js";
import { GRAPH_DIR } from "./write.js";
import { inBrand } from "../brand.js";

const INDEX_FILE = "INDEX.md";
/** Where a root-level file card goes when `graft/<stem>.md` is already a concept
 * node (same stem as a slug — Laravel `server.php` vs a "Server" concept). */
const ROOT_CARD_DIR = "_root";

function writeIfChanged(path: string, content: string): void {
  if (existsSync(path) && readFileSync(path, "utf8") === content) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export interface CardFileInfo {
  /** Card path relative to the context dir, e.g. "src/ai/providers.md". */
  card: string;
  /** Source path the card mirrors, e.g. "src/ai/providers.ts". */
  path: string;
  symbols: number;
}

export interface CardStats {
  written: number;
  pruned: number;
  files: CardFileInfo[];
}

/** True when `path` is an existing concept node (frontmatter carries `slug`). */
function isConceptNodeFile(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    const fm = matter(readFileSync(path, "utf8")).data as Record<string, unknown>;
    return fm.slug != null && String(fm.slug).length > 0;
  } catch {
    return false;
  }
}

/** The card path for a source path: mirror the tree, swap the extension for .md.
 * Root-level sources share `graft/` with concept nodes. If that filename is
 * already a concept, park the file card under `_root/` instead of clobbering it. */
function cardPathFor(outDir: string, sourcePath: string, keepExtension = false): string {
  const md = keepExtension ? sourcePath + ".md" : sourcePath.replace(/\.[^./]+$/, "") + ".md";
  const primary = join(outDir, md);
  if (sourcePath.includes("/")) return primary;
  if (isConceptNodeFile(primary)) return join(outDir, ROOT_CARD_DIR, md);
  return primary;
}

/** Starting line of an "L43-L55" span, for stable ordering (0 if unparseable). */
function spanStart(span: string): number {
  const m = /^L(\d+)/.exec(span);
  return m ? Number(m[1]) : 0;
}

/** First line of a node's meaning: LLM summary if ready, else its signature. */
function oneLiner(node: NodeV1): string {
  const s = node.summary?.trim();
  if (s) return s.split("\n")[0].trim();
  return node.signature?.trim() ?? "";
}

/** path → concept-node slugs that cite it as a source (for the up-links). */
function conceptsByPath(outDir: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const node of readNodes(outDir)) {
    for (const src of node.sources) {
      const list = map.get(src.path) ?? [];
      list.push(node.slug);
      map.set(src.path, list);
    }
  }
  return map;
}

/** Render one file's card. `fileNode` may be absent for parse-only fragments. */
function renderCard(
  sourcePath: string,
  fileNode: NodeV1 | undefined,
  symbols: NodeV1[],
  conceptSlugs: string[],
): string {
  const uplinks = conceptSlugs
    .sort()
    .map((s) => `[[${s}]]`)
    .join(" ");
  const head = uplinks ? `# ${sourcePath} · ${uplinks}` : `# ${sourcePath}`;
  const lines: string[] = [head, ""];

  const fileSummary = fileNode ? oneLiner(fileNode) : "";
  if (fileSummary) lines.push(fileSummary, "");

  const sorted = [...symbols].sort(
    (a, b) => spanStart(a.span) - spanStart(b.span) || a.name.localeCompare(b.name),
  );
  for (const n of sorted) {
    const desc = oneLiner(n);
    const tail = desc ? ` — ${desc}` : "";
    lines.push(`- ${n.name} · ${n.kind} · ${n.span}${tail}`);
  }
  if (sorted.length === 0) lines.push("_No extracted symbols in this file._");
  return lines.join("\n") + "\n";
}

/** Every existing card file: `.md` inside subdirs of outDir, and the root-level cards
 * that share the dir with concept nodes (never a concept node itself). */
function listExistingCards(outDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (dir === outDir && (e.name === CACHE_DIR || e.name === GRAPH_DIR)) continue;
        walk(join(dir, e.name));
      } else if (e.isFile() && e.name.endsWith(".md")) {
        out.push(join(dir, e.name));
      }
    }
  };
  for (const e of readdirSync(outDir, { withFileTypes: true })) {
    // Top-level files are walked separately below: concept nodes, INDEX.md and root
    // cards share them. Cards live in subdirs (`src/…`, and `_root/` when a root card
    // would collide with a concept).
    if (e.isDirectory() && e.name !== CACHE_DIR && e.name !== GRAPH_DIR) {
      walk(join(outDir, e.name));
    }
  }
  out.push(...rootFileCardPaths(outDir));
  return out;
}

/** Remove now-empty directories under outDir (bottom-up), skipping .cache/.graph. */
function pruneEmptyDirs(outDir: string): void {
  const visit = (dir: string): boolean => {
    // returns true if dir is empty after visiting children
    let empty = true;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (dir === outDir && (e.name === CACHE_DIR || e.name === GRAPH_DIR)) {
        empty = false;
        continue;
      }
      const child = join(dir, e.name);
      if (e.isDirectory()) {
        if (visit(child)) rmSync(child, { recursive: true, force: true });
        else empty = false;
      } else {
        empty = false;
      }
    }
    return empty;
  };
  if (existsSync(outDir)) visit(outDir);
}

/** Nodes grouped by the source path they belong to. */
function groupByPath(graph: GraphV1): Map<string, NodeV1[]> {
  const byPath = new Map<string, NodeV1[]>();
  for (const n of graph.nodes) {
    const list = byPath.get(n.path) ?? [];
    list.push(n);
    byPath.set(n.path, list);
  }
  return byPath;
}

/**
 * The card path for every indexed source file.
 *
 * Two sources can swap to the same card name (`config.json` and `config.yml`,
 * `guide.md` and `guide.json`): the second would overwrite the first and the
 * INDEX would point two files at one card. The first claimant keeps the short
 * name and each later one keeps its extension (`config.yml.md`), so the result
 * depends only on which files exist. A `.md` source claims first: its card name
 * is its own path, and it should never become `guide.md.md`.
 */
function planCards(byPath: Map<string, NodeV1[]>, outDir: string): Map<string, string> {
  const claimed = new Set<string>();
  const cardOf = new Map<string, string>();
  const isMarkdown = (p: string): number => (p.endsWith(".md") ? 0 : 1);
  const claimOrder = [...byPath.keys()].sort((a, b) => isMarkdown(a) - isMarkdown(b) || (a < b ? -1 : a > b ? 1 : 0));
  for (const sourcePath of claimOrder) {
    let cardPath = cardPathFor(outDir, sourcePath);
    if (claimed.has(cardPath)) cardPath = cardPathFor(outDir, sourcePath, true);
    for (let n = 2; claimed.has(cardPath); n++) cardPath = cardPathFor(outDir, sourcePath, true).replace(/\.md$/, `~${n}.md`);
    claimed.add(cardPath);
    cardOf.set(sourcePath, cardPath);
  }
  return cardOf;
}

/** The card roster for a graph, as `writeCards` would report it. */
function cardFiles(byPath: Map<string, NodeV1[]>, cardOf: Map<string, string>, outDir: string): CardFileInfo[] {
  const files: CardFileInfo[] = [];
  for (const [sourcePath, group] of byPath) {
    const symbols = group.filter((n) => n.kind !== "file").length;
    files.push({ card: relPosix(outDir, cardOf.get(sourcePath)!), path: sourcePath, symbols });
  }
  return files.sort((a, b) => a.card.localeCompare(b.card));
}

/**
 * Remove the cards whose source file the wiring no longer indexes, and rewrite
 * `INDEX.md` when any went. This is the part of the markdown surface the query-path
 * refresh may touch: a card for a file that has left the graph points at nodes that no
 * longer exist, so leaving it is worse than the one deletion. It never writes or
 * rewrites a card for a file that is still indexed, and does nothing in a context dir
 * whose cards were never built. Returns how many cards it removed.
 */
export function pruneCards(graph: GraphV1, outDir: string): number {
  if (!existsSync(outDir)) return 0;
  const existing = listExistingCards(outDir);
  if (existing.length === 0) return 0;
  const byPath = groupByPath(graph);
  const cardOf = planCards(byPath, outDir);
  const expected = new Set(cardOf.values());
  let pruned = 0;
  for (const card of existing) {
    if (expected.has(card)) continue;
    rmSync(card);
    pruned++;
  }
  if (pruned === 0) return 0;
  pruneEmptyDirs(outDir);
  writeIndex(outDir, cardFiles(byPath, cardOf, outDir));
  return pruned;
}

/**
 * Write one wiring card per source file into `outDir`, mirroring the source tree,
 * and prune cards whose source no longer exists. Returns what changed.
 */
export function writeCards(graph: GraphV1, outDir: string): CardStats {
  const byPath = groupByPath(graph);

  const concepts = conceptsByPath(outDir);
  const written = new Set<string>();
  const files: CardFileInfo[] = [];
  const cardOf = planCards(byPath, outDir);

  for (const [sourcePath, group] of byPath) {
    const fileNode = group.find((n) => n.kind === "file");
    const symbols = group.filter((n) => n.kind !== "file");
    const cardPath = cardOf.get(sourcePath)!;
    writeIfChanged(cardPath, renderCard(sourcePath, fileNode, symbols, concepts.get(sourcePath) ?? []));
    written.add(cardPath);
    files.push({ card: relPosix(outDir, cardPath), path: sourcePath, symbols: symbols.length });
  }

  let pruned = 0;
  for (const existing of listExistingCards(outDir)) {
    if (!written.has(existing)) {
      rmSync(existing);
      pruned++;
    }
  }
  pruneEmptyDirs(outDir);

  files.sort((a, b) => a.card.localeCompare(b.card));
  return { written: written.size, pruned, files };
}

/**
 * Write `graft/INDEX.md` — the roster an agent `cat`s to orient. Lists the concept
 * nodes on disk and the per-file cards. Deterministic order; no timestamps.
 */
export function writeIndex(outDir: string, files: CardFileInfo[]): void {
  writeIfChanged(join(outDir, INDEX_FILE), renderIndex(outDir, files));
}

/** The text `writeIndex` writes, so `check` can compare it with what is on disk. */
function renderIndex(outDir: string, files: CardFileInfo[]): string {
  // Spelled by the name that built it: a trail-only machine has no `graft` to run.
  const lines: string[] = [
    "# graft — repo map",
    "",
    "Small markdown nodes summarising this repo. `grep` any term, symbol, or",
    'filename here, or run `graft ask "<task>"`. Each node carries prose plus exact',
    "`file:line`; open a source file only to edit the named span.",
    "",
    // Whoever reads this file has already decided to look at graft, so this is the
    // one place a pointer to the richer surface is welcome rather than noise. Stated
    // as what exists, not as an instruction — see `mcp/instructions.ts` for why.
    "The same graph is queryable as MCP tools (`graft_find_code`, `graft_find_all`,",
    "`graft_trace_calls`, `graft_file_api`, `graft_repo_map`) where a host exposes them, and",
    "as the `graft` CLI everywhere else. Edges — who calls what — live only in the",
    "graph, not in these files: `graft callers <symbol>` is the only way to read them.",
    "",
  ].map((l) => inBrand(l));

  const concepts = readNodes(outDir).sort((a, b) => a.slug.localeCompare(b.slug));
  if (concepts.length) {
    lines.push("## Concepts", "");
    for (const c of concepts) {
      const srcs = c.sources.map((s) => s.path).join(", ");
      const tail = srcs ? ` · ${srcs}` : "";
      lines.push(`- [${c.slug}](${c.slug}.md) — ${c.name || c.slug}${tail}`);
    }
    lines.push("");
  }

  if (files.length) {
    const withSymbols = files.filter((f) => f.symbols > 0).length;
    lines.push("## Files", "");
    lines.push(
      `${files.length} per-file wiring cards mirror the source tree under \`graft/\` ` +
        `(${withSymbols} carry extracted symbols). They are deliberately not enumerated here —`,
      "`grep` a symbol or `find`/`ls` a filename under `graft/` to land on the card for that file.",
      "",
    );
  }

  return lines.join("\n");
}

/** One symbol a concept node covers: its name, kind, and `path:span` pointer. */
export interface CoverRef {
  symbol: string;
  kind: string;
  /** `src/ai/providers.ts:L28-L35` — same vocabulary `graft ask` returns. */
  at: string;
}

/**
 * Backfill each concept node's frontmatter with a `covers:` list — the symbols
 * (and their exact `file:line`) it spans, read from the wiring graph. This is the
 * explicit OKF↔Wiring link: it doubles as grep bait (a `grep <symbol>` lands on
 * the prose node, not just its card) and lets an agent read the span straight
 * from the node without ever opening `wiring.json`.
 *
 * A surgical frontmatter patch: the generated body and every other key are
 * preserved verbatim; only `covers` is added/replaced. Concept nodes are the
 * top-level `.md` files that carry a `slug` (cards live in subdirs, or at the
 * top level without a slug when they mirror a root source; INDEX.md is skipped).
 * On a $0 structure-only build there are no concept nodes, so this is a no-op.
 * Returns the number of nodes enriched.
 */
export function writeCovers(graph: GraphV1, outDir: string): number {
  if (!existsSync(outDir)) return 0;

  const symbolsByPath = new Map<string, NodeV1[]>();
  for (const n of graph.nodes) {
    if (n.kind === "file") continue;
    const list = symbolsByPath.get(n.path) ?? [];
    list.push(n);
    symbolsByPath.set(n.path, list);
  }
  for (const list of symbolsByPath.values()) {
    list.sort((a, b) => spanStart(a.span) - spanStart(b.span) || a.name.localeCompare(b.name));
  }

  let enriched = 0;
  for (const entry of readdirSync(outDir)) {
    if (!entry.endsWith(".md") || entry === INDEX_FILE) continue;
    const full = join(outDir, entry);
    const parsed = matter(readFileSync(full, "utf8"));
    // Root-level file cards have no concept slug; stamping `covers: []` onto
    // them made readNodes treat them as concept nodes (#261).
    if (parsed.data.slug == null || String(parsed.data.slug).length === 0) continue;
    const sources = Array.isArray(parsed.data.sources)
      ? (parsed.data.sources as Array<{ path?: string }>)
      : [];

    const covers: CoverRef[] = [];
    for (const path of [...new Set(sources.map((s) => s.path ?? ""))].sort()) {
      for (const n of symbolsByPath.get(path) ?? []) {
        covers.push({ symbol: n.name, kind: n.kind, at: `${n.path}:${n.span}` });
      }
    }

    // Re-stringify with covers appended last, so re-runs produce a stable diff.
    const { covers: _prev, ...rest } = parsed.data as Record<string, unknown>;
    writeIfChanged(full, matter.stringify(parsed.content, { ...rest, covers }));
    enriched++;
  }
  return enriched;
}
