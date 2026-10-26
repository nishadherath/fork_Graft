/**
 * `checkGraph` — is the committed `graph.json` still in sync with the code?
 *
 * Deterministic and fast (tree-sitter only, no LLM, no network): it re-runs
 * Tier-1 extraction and diffs the fresh node set against the committed graph by
 * `id` and `body_hash`. Meant for CI — exit non-zero when a PR changed code but
 * didn't rebuild the graph.
 *
 * Drift categories:
 *   added    a definition exists in code but not in graph.json (run `graph`)
 *   removed  a node in graph.json no longer exists in code       (run `graph`)
 *   changed  a node's body_hash differs from the committed one   (run `graph`)
 *   cards    the per-file cards or INDEX.md no longer match the wiring
 *            (a card missing, edited, or left for a file the wiring dropped)
 *                                                                  (run `graft build`)
 *   stale    a committed node's summary is flagged stale — its body changed
 *            since it was last summarized                         (run `graft build --deep`)
 *
 * `added`/`removed`/`changed` are structural: the graph no longer describes the
 * code. `stale` is a meaning-layer signal the last build already recorded.
 * `pending` (never summarized) is not drift — it's a deliberate Tier-1-only build.
 */
import { resolve } from "node:path";
import { relPosix } from "../util/paths.js";
import { contextDirFor } from "../context/node-file.js";
import { extractFile } from "./extract.js";
import { extractGeneric } from "./generic.js";
import { extractContainer } from "./container.js";
import { extractStructured } from "./structured/index.js";
import { readRendering, renderingPath } from "./structured/documents/cache.js";
import { extractDocument } from "./structured/documents/extract.js";
import { documentFormatOf } from "./structured/documents/index.js";
import { listSourceFiles, tierOf, warmGrammarsFor } from "./build.js";
import { readGraph, wiringPath } from "./write.js";
import { cardDrift, type CardDrift } from "./cards.js";
import { readFingerprint } from "./fingerprint.js";
import { readSourceFile } from "../util/source.js";
import { cmd } from "../brand.js";

export interface GraphCheckResult {
  ok: boolean;
  /** `ok` without the card drift: the nodes agree with the code and no summary is stale.
   * `graft status` and the MCP check tool judge freshness by this and report cards as a
   * warning, because the Stop hook rewrites the cards at the end of every turn (D14);
   * `graft check` still exits on `ok`. */
  inSync: boolean;
  /** True when there is no graph.json (a graph has never been built). */
  missing: boolean;
  added: string[];
  removed: string[];
  changed: string[];
  stale: string[];
  /** Nodes never summarized (reported for context; not counted as drift). */
  pending: number;
  /** Ids of pending nodes (capped when formatting) — so a stuck meaning pass
   * names the files instead of only saying "run --deep" (#172). */
  pendingIds: string[];
  /** Committed nodes in total — the denominator that turns `pending` into a
   * coverage figure. A deep build that lost most of its LLM calls (#127) is only
   * distinguishable from a deliberate Tier-1 build by the SHARE that is missing. */
  nodes: number;
  /** Where the card tree and `INDEX.md` disagree with the wiring. Absent only on a
   * result built before this field existed (the graph is `missing`). */
  cards?: CardDrift;
}

export interface GraphCheckOptions {
  contextDir?: string;
}

// async: the breadth tier's WASM grammars load asynchronously and must be warmed
// before the (synchronous) re-extraction below, exactly as buildGraph does — else
// breadth-tier files (.rs, …) would re-extract as empty here and read as `removed`
// against a graph that built them, so `graft check` would never report OK.
export async function checkGraph(
  dir: string,
  opts: GraphCheckOptions = {},
): Promise<GraphCheckResult> {
  const root = resolve(dir);
  const outDir = contextDirFor(root, opts.contextDir);

  const result: GraphCheckResult = {
    ok: false,
    inSync: false,
    missing: false,
    added: [],
    removed: [],
    changed: [],
    stale: [],
    pending: 0,
    pendingIds: [],
    nodes: 0,
  };

  const committed = readGraph(wiringPath(outDir));
  if (!committed) {
    result.missing = true;
    return result;
  }

  // Freshly extract Tier-1 nodes from the code on disk (same file set as build).
  // A `--only-dir` build records its whitelist in the fingerprint; read it back
  // so `check` diffs the same limited set instead of flagging every excluded
  // file as "added".
  const fpOnlyDirs = readFingerprint(outDir)?.onlyDirs;
  const onlyDirs = fpOnlyDirs && fpOnlyDirs.length > 0 ? new Set(fpOnlyDirs) : undefined;
  const sourceFiles = listSourceFiles(root, outDir, undefined, onlyDirs);
  // Container-tier grammars need the same warmup as the generic ones, for the same
  // reason: extraction below is synchronous. Missing that is what made `graft
  // check` report every `.vue` node as `removed` right after a clean build (#236)
  // — the tier extracted fine, and then the check had no branch that could see it.
  // The same call warms the structured tier's grammars, and the WASM stand-in for a
  // depth language whose native grammar didn't load, exactly as the build does.
  await warmGrammarsFor(sourceFiles);
  const current = new Map<string, string>(); // id → body_hash
  for (const file of sourceFiles) {
    // The same dispatch `buildGraph` uses (`tierOf`). The two must stay in step: a
    // tier the build extracts and the check cannot see reports as `removed`
    // forever, and the `graft build` the check tells you to run can never repair it.
    const { lang, container, generic, structured } = tierOf(file);
    if (documentFormatOf(file)) {
      // A document is checked through its rendering for the bytes on disk now. No
      // rendering means the binary changed since the build: its nodes go `removed`.
      const rendering = readRendering(outDir, file);
      if (!rendering) continue;
      const renderingRel = relPosix(root, renderingPath(outDir, rendering.hash));
      for (const n of extractDocument(relPosix(root, file), rendering.text, renderingRel).nodes) current.set(n.id, n.body_hash);
      continue;
    }
    let source: string | null;
    try {
      source = readSourceFile(file);
    } catch {
      continue; // unreadable now → its nodes show up as `removed` below
    }
    if (source === null) continue; // unsupported encoding (e.g. UTF-16BE)
    const rel = relPosix(root, file);
    try {
      const extracted = lang
        ? extractFile(rel, source, lang)
        : container
          ? extractContainer(rel, source, container)
          : generic
            ? extractGeneric(rel, source, generic.name)
            : structured
              ? extractStructured(rel, source, structured)
              : null;
      // No tier claims this file. Spelled out rather than asserted away: the
      // `generic!` that used to stand in this position threw a TypeError on a
      // container-tier file, the catch below swallowed it as a parse failure, and
      // a missing branch became a silent permanent `removed` (#236). Returning
      // null here means the next tier graft gains fails loudly in the type
      // checker instead.
      if (extracted === null) continue;
      for (const n of extracted.nodes) current.set(n.id, n.body_hash);
    } catch {
      // parse failure → skip; the committed nodes for this file become `removed`.
    }
  }

  const committedById = new Map(committed.nodes.map((n) => [n.id, n]));
  result.nodes = committedById.size;
  for (const [id, node] of committedById) {
    const now = current.get(id);
    if (now === undefined) result.removed.push(id);
    else if (now !== node.body_hash) result.changed.push(id);
    if (node.summary_state === "stale") result.stale.push(id);
    if (node.summary_state === "pending") {
      result.pending++;
      result.pendingIds.push(id);
    }
  }
  for (const id of current.keys()) {
    if (!committedById.has(id)) result.added.push(id);
  }

  for (const arr of [result.added, result.removed, result.changed, result.stale, result.pendingIds]) {
    arr.sort();
  }

  result.cards = cardDrift(committed, outDir);
  const cards = result.cards;
  const cardsOk = cards.missing.length + cards.stale.length + cards.orphan.length === 0 && !cards.index;

  result.inSync =
    result.added.length === 0 &&
    result.removed.length === 0 &&
    result.changed.length === 0 &&
    result.stale.length === 0;
  result.ok = cardsOk && result.inSync;
  return result;
}

/** The cards the wiring disagrees with, one entry per path, spelled for a warning line. */
export function cardDriftPaths(c: CardDrift | undefined): string[] {
  if (!c) return [];
  return [...c.missing, ...c.stale, ...c.orphan, ...(c.index ? ["INDEX.md"] : [])];
}

/** The D14 warning line for card drift, or null when the cards agree with the wiring. One
 * spelling for the single-repo report, the workspace check and the MCP freshness tool. */
export function formatCardDriftWarning(c: CardDrift | undefined): string | null {
  const paths = cardDriftPaths(c);
  if (paths.length === 0) return null;
  const shown = paths.slice(0, PENDING_SAMPLE).join(", ") + (paths.length > PENDING_SAMPLE ? `, … +${paths.length - PENDING_SAMPLE} more` : "");
  return `warning: ${paths.length} card file(s) out of step with the wiring (${shown}). The Stop hook rewrites them at the end of the turn; or run \`${cmd("graft build")}\`.`;
}

export interface GraphCheckFormatOptions {
  /** Report card drift as a warning line under an OK verdict when the wiring is in sync
   * (D14). Without it, card drift reads STALE, as `graft check` prints it. */
  cardsAsWarning?: boolean;
}

/** Render a graph-check result as a human-readable report. */
export function formatGraphCheckReport(r: GraphCheckResult, opts: GraphCheckFormatOptions = {}): string {
  if (opts.cardsAsWarning && r.inSync && !r.ok) {
    return `${formatGraphCheckReport({ ...r, ok: true })}\n${formatCardDriftWarning(r.cards)}`;
  }
  if (r.missing) {
    return `graph check: NO GRAPH\n\nNo graft/.graph/wiring.json found. Run \`${cmd("graft build")}\` first.`;
  }
  if (r.ok) {
    // A share, not a bare count: "1203 not yet summarized" reads the same whether
    // the repo was never deep-built or a deep build failed most of its calls.
    const pct = r.nodes > 0 ? Math.round(((r.nodes - r.pending) / r.nodes) * 100) : 0;
    const note = r.pending ? ` (${formatPendingNote(r, pct)})` : "";
    return `graph check: OK — the wiring graph is in sync with the code.${note}`;
  }

  const lines: string[] = ["graph check: STALE", ""];
  const structural = r.added.length + r.removed.length + r.changed.length;
  if (r.changed.length) {
    lines.push(`changed (${r.changed.length}):`);
    for (const id of r.changed) lines.push(`  ~ ${id}`);
  }
  if (r.added.length) {
    lines.push(`added (${r.added.length}):`);
    for (const id of r.added) lines.push(`  + ${id}`);
  }
  if (r.removed.length) {
    lines.push(`removed (${r.removed.length}):`);
    for (const id of r.removed) lines.push(`  - ${id}`);
  }
  if (r.stale.length) {
    lines.push(`stale summaries (${r.stale.length}):`);
    for (const id of r.stale) lines.push(`  ! ${id}`);
  }
  const c = r.cards;
  if (c && (c.missing.length || c.stale.length || c.orphan.length || c.index)) {
    lines.push("cards out of step with the wiring:");
    for (const p of c.missing) lines.push(`  + ${p} (no card)`);
    for (const p of c.stale) lines.push(`  ~ ${p} (card text differs)`);
    for (const p of c.orphan) lines.push(`  - ${p} (file no longer indexed)`);
    if (c.index) lines.push("  ~ INDEX.md (differs from the wiring)");
  }
  lines.push("");
  if (c && (c.missing.length || c.stale.length || c.orphan.length || c.index) && !structural) {
    lines.push(`Run \`${cmd("graft build")}\` to rewrite the cards and INDEX.md.`);
  }
  if (structural) lines.push(`Run \`${cmd("graft build")}\` to rebuild the structure, then commit graft/.`);
  if (r.stale.length) lines.push(`Run \`${cmd("graft build --deep")}\` to refresh stale summaries.`);
  return lines.join("\n");
}

/** Cap how many pending ids the OK-note lists so a large Tier-1 graph stays readable. */
const PENDING_SAMPLE = 8;

function formatPendingNote(r: GraphCheckResult, pct: number): string {
  const ids = r.pendingIds ?? [];
  const sample = ids.slice(0, PENDING_SAMPLE);
  const more = ids.length > PENDING_SAMPLE ? `, … +${ids.length - PENDING_SAMPLE} more` : "";
  const named = sample.length ? `: ${sample.join(", ")}${more}` : "";
  // Tier-1-only builds are supposed to leave everything pending — "run --deep"
  // is the right next step. A deep build that still left them pending used to
  // dead-end here (#172): re-running the same command never cleared empty/failed
  // meaning replies, so name the nodes and point at the last build's errors.
  return (
    `meaning tier ${pct}% complete — ${r.pending} of ${r.nodes} node(s) pending${named}. ` +
    `Run \`${cmd("graft build --deep")}\` to summarize them; if a deep build already left these pending, ` +
    `that meaning pass failed — see that build's errors (re-running alone will not clear them)`
  );
}
