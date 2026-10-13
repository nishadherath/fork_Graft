/**
 * Pieces every structured-tier extractor shares: the file node, the span format
 * and the named limits.
 *
 * What it deliberately does not do: parse anything. The scanners and the
 * wasm-backed extractors own their formats; this module only builds the nodes
 * they all emit, so a section and a key cannot disagree about what a span, an
 * id or a body hash is.
 *
 * The one non-obvious thing: spans are 1-based inclusive lines in the HOST file,
 * never in a rendering of it. graft's promise is an exact locator, so a span that
 * `--source` cannot print verbatim is worse than no node (AGENTS.md rule 4).
 */
import { contentHash } from "../../util/id.js";
import { mintId, type RawEdge } from "../extract.js";
import type { NodeV1 } from "../types.js";

/** Characters of body text kept per section, matching the code tiers' per-symbol
 * cap in extract.ts and generic.ts: large enough that nearly every real section
 * is stored whole, small enough to bound what the committed graph grows by. */
export const MAX_BODY_TEXT_CHARS = 5000;

/** `L<start>-L<end>`, both 1-based and inclusive. Asserts the range, because an
 * inverted span is a scanner bug that would otherwise surface as a wrong line. */
export function spanOf(startLine: number, endLine: number): string {
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine) || startLine < 1 || endLine < startLine) {
    throw new RangeError(`invalid span: start line ${startLine}, end line ${endLine} (need 1 <= start <= end)`);
  }
  return `L${startLine}-L${endLine}`;
}

/** Number of lines in `source`, counting a final line with no trailing newline. A
 * trailing newline does not open a new line, matching how an editor numbers it. */
export function lineCount(source: string): number {
  if (source === "") return 1;
  const parts = source.split("\n");
  return source.endsWith("\n") ? parts.length - 1 : parts.length;
}

/** The file's own node. Describes the whole document: its line count, byte size
 * and hash, so a reader opening the path sees what the node claims. */
export function structuredFileNode(rel: string, source: string, bodyText?: string): NodeV1 {
  return {
    id: rel,
    name: rel.split("/").pop() ?? rel,
    kind: "file",
    path: rel,
    span: spanOf(1, lineCount(source)),
    signature: null,
    exported: true,
    origin: "generic",
    body_hash: contentHash(source),
    chars: Buffer.byteLength(source),
    ...(bodyText ? { body_text: bodyText } : {}),
    summary_state: "pending",
    summary: null,
    crux: null,
  };
}

// ---------------------------------------------------------------------------
// Keys: the unit JSON, YAML, TOML and INI share.
// ---------------------------------------------------------------------------

/** Deepest key path indexed, counting key segments only (an array index is free).
 * Past four levels a path names a leaf of a leaf, which no one searches for by
 * name, and `--source` on an ancestor still prints the text. */
export const MAX_KEY_DEPTH = 4;

/** Most key nodes one file contributes. A generated 10,000-key config would
 * otherwise swamp the graph and the `ask` ranking with entries no query wants;
 * shallow keys are kept first, so the cap trims the deepest tail of a big file. */
export const MAX_KEYS_PER_FILE = 500;

/** Longest scalar value shown in a key's signature, which `ask` prints. */
const MAX_SIGNATURE_VALUE_CHARS = 80;

/** A key whose value must not be searchable or printed: the name says credential. */
const SECRET_NAME = /token|secret|passw(?:or)?d|api[_-]?key|private/i;

/** A value that looks like a credential whatever its key is called: longer than
 * 32 characters with no whitespace (a token, a hash, a base64 blob). */
const OPAQUE_VALUE = /^\S{33,}$/;

/** True when a key's value must stay out of `signature` and `body_text`. The name
 * is tested on the whole path, so everything under `secrets.*` is covered. */
export function isSecret(path: string, value: string | undefined): boolean {
  return SECRET_NAME.test(path) || (value !== undefined && OPAQUE_VALUE.test(value));
}

/** A key found by a format extractor, before ids, signatures and the caps are
 * applied. Rows are 0-based and inclusive. `parent` indexes the drafts array
 * (-1 for a top-level key) and always precedes the child. */
export interface KeyDraft {
  path: string;
  parent: number;
  /** Key segments in `path`; array indices do not count. */
  depth: number;
  startRow: number;
  endRow: number;
  /** The scalar value, decoded; absent for a table, object or sequence. */
  value?: string;
  /** For an array element: the value of its name, id or key field. */
  label?: string;
}

/** `rel#key:<path>` nodes for the drafts that survive the depth and size caps,
 * plus the `contains` edges between them. Document order is kept.
 *
 * Why select before minting: the cap prefers shallow keys (sort by depth, then by
 * position), so a parent is always chosen before its children and no edge can
 * point at a dropped key. Ties and truncation are deterministic. */
export function emitKeys(rel: string, lines: readonly string[], drafts: readonly KeyDraft[]): { nodes: NodeV1[]; rawEdges: RawEdge[] } {
  const chosen = drafts
    .map((d, i) => ({ d, i }))
    .filter((x) => x.d.depth <= MAX_KEY_DEPTH)
    .sort((a, b) => a.d.depth - b.d.depth || a.i - b.i)
    .slice(0, MAX_KEYS_PER_FILE)
    .sort((a, b) => a.i - b.i);

  const minted = new Set<string>([rel]);
  const idOf = new Map<number, string>();
  const nodes: NodeV1[] = [];
  const rawEdges: RawEdge[] = [];

  for (const { d, i } of chosen) {
    const id = mintId(`${rel}#key:${d.path}`, minted);
    idOf.set(i, id);
    const hidden = isSecret(d.path, d.value ?? d.label);
    const shown = (text: string): string => text.replace(/\s+/g, " ").trim();
    let signature = d.path;
    if (!hidden && d.label !== undefined) signature = `${d.path}: ${shown(d.label).slice(0, MAX_SIGNATURE_VALUE_CHARS)}`;
    else if (!hidden && d.value !== undefined) signature = `${d.path} = ${shown(d.value).slice(0, MAX_SIGNATURE_VALUE_CHARS)}`;
    const bodyText = !hidden && d.value !== undefined ? shown(d.value).slice(0, MAX_BODY_TEXT_CHARS) : "";

    nodes.push({
      id,
      name: d.path,
      kind: "key",
      path: rel,
      span: spanOf(d.startRow + 1, d.endRow + 1),
      signature,
      exported: true,
      origin: "generic",
      body_hash: contentHash(lines.slice(d.startRow, d.endRow + 1).join("\n")),
      ...(bodyText ? { body_text: bodyText } : {}),
      summary_state: "pending",
      summary: null,
      crux: null,
    });
    rawEdges.push({ source: d.parent >= 0 ? idOf.get(d.parent) ?? rel : rel, relation: "contains", targetId: id, file: rel });
  }
  return { nodes, rawEdges };
}

/** Last row of a tree-sitter node, inclusive. A node that swallows its trailing
 * newline ends at column 0 of the NEXT row, which is not a line it contains. */
export function endRowOf(node: { startPosition: { row: number }; endPosition: { row: number; column: number } }): number {
  const { row, column } = node.endPosition;
  return column === 0 && row > node.startPosition.row ? row - 1 : row;
}

/** Split into lines on `\n`, dropping a trailing `\r` from each and the empty
 * element a final newline leaves, so `lines.length` is the file's line count. */
export function splitLines(source: string): string[] {
  const lines = source.split("\n").map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}
