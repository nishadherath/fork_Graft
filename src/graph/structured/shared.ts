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
