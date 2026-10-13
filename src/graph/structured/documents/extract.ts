/**
 * Sections of a document, read from its rendering.
 *
 * Responsible for: running the Markdown scanner over a rendering (render.ts) and
 * shaping the result into the document's nodes. When the document has headings,
 * a section per heading, nested as in Markdown. When it has none (a PDF, a deck),
 * a section per page, slide or chapter that holds text. Every section's signature
 * is its locator: `report.pdf (page 3) -> graft/.graph/docs/<hash>.txt:L40-L52`.
 *
 * Deliberately does not: read the binary or the cache (cache.ts does), or add any
 * edge kind of its own; the Markdown scanner's `contains` edges are kept as they are.
 *
 * The non-obvious thing: every node keeps the BINARY's path, so ids, cards and
 * `--only-dir` key on the file the user knows, while the span is a line range of
 * the rendering the signature names. Readers that print a span (`ask --source`)
 * look the rendering up by the binary's content hash (cache.ts).
 */
import { posix } from "node:path";
import { contentHash } from "../../../util/id.js";
import { mintId, type ExtractResult, type RawEdge } from "../../extract.js";
import type { NodeV1 } from "../../types.js";
import { extractMarkdown, slugOf } from "../markdown.js";
import { MAX_BODY_TEXT_CHARS, MAX_UNITS_PER_FILE, spanOf, splitLines } from "../shared.js";
import { parseMarker, type UnitKind } from "./render.js";

interface Marker {
  row: number;
  kind: UnitKind;
  n: number;
  title?: string;
}

const MARKER_TEXT = /<!-- (?:page|slide|chapter) \d+(?:: .*?)? -->/g;

/** Search text without the marker comments, which name no content. */
function plain(lines: readonly string[]): string {
  return lines.join(" ").replace(MARKER_TEXT, " ").replace(/\s+/g, " ").trim().slice(0, MAX_BODY_TEXT_CHARS);
}

const PLURAL: Readonly<Record<UnitKind, string>> = { page: "pages", slide: "slides", chapter: "chapters" };

/** Nodes for the document at `rel` whose rendering is `rendering`, stored at the
 * repository-relative `renderingRel`. */
export function extractDocument(rel: string, rendering: string, renderingRel: string): ExtractResult {
  const lines = splitLines(rendering);
  const name = posix.basename(rel);
  const markers: Marker[] = [];
  lines.forEach((line, row) => {
    const m = parseMarker(line);
    if (m) markers.push({ row, ...m });
  });

  const markdown = extractMarkdown(rel, rendering);
  const file = markdown.nodes.find((n) => n.kind === "file")!;
  let nodes: NodeV1[];
  let rawEdges: RawEdge[];
  if (markdown.nodes.some((n) => n.kind === "section")) {
    nodes = markdown.nodes;
    rawEdges = markdown.rawEdges;
    const firstHeading = Math.min(...nodes.filter((n) => n.kind === "section").map((n) => startRow(n.span)));
    const preface = plain(lines.slice(0, firstHeading));
    if (preface) file.body_text = preface;
    else delete file.body_text;
    for (const n of nodes) {
      if (n.kind !== "section") continue;
      if (n.body_text) n.body_text = plain([n.body_text]);
      // A section ends before the blank lines and the marker of the page its
      // successor opens: that marker locates the next heading, not this one.
      const start = startRow(n.span);
      const last = endRow(n.span);
      let end = last;
      while (end > start && (lines[end]!.trim() === "" || parseMarker(lines[end]!))) end--;
      if (end !== last) {
        n.span = spanOf(start + 1, end + 1);
        n.body_hash = contentHash(lines.slice(start, end + 1).join("\n"));
      }
    }
  } else {
    delete file.body_text;
    nodes = [file];
    rawEdges = [];
    const minted = new Set<string>([rel]);
    for (let k = 0; k < markers.length && nodes.length <= MAX_UNITS_PER_FILE; k++) {
      const m = markers[k]!;
      let end = (markers[k + 1]?.row ?? lines.length) - 1;
      while (end > m.row && lines[end]!.trim() === "") end--;
      if (end === m.row) continue; // a page with no text: its marker locates nothing
      const label = `${m.kind} ${m.n}`;
      const id = mintId(`${rel}#section:${slugOf(label)}`, minted);
      const body = lines.slice(m.row + 1, end + 1);
      nodes.push({
        id,
        name: m.title ? `${label}: ${m.title}` : label,
        kind: "section",
        path: rel,
        span: spanOf(m.row + 1, end + 1),
        signature: null,
        exported: true,
        origin: "generic",
        body_hash: contentHash(lines.slice(m.row, end + 1).join("\n")),
        body_text: plain(body),
        summary_state: "pending",
        summary: null,
        crux: null,
      });
      rawEdges.push({ source: rel, relation: "contains", targetId: id, file: rel });
    }
  }

  // Locators. A section's unit is the last marker at or above its first line.
  for (const n of nodes) {
    if (n.kind !== "section") continue;
    const row = startRow(n.span);
    let unit: Marker | undefined;
    for (const m of markers) if (m.row <= row) unit = m;
    const where = unit ? `${name} (${unit.kind} ${unit.n})` : name;
    n.signature = `${where} -> ${renderingRel}:${n.span}`;
  }
  const counts = new Map<UnitKind, number>();
  for (const m of markers) counts.set(m.kind, (counts.get(m.kind) ?? 0) + 1);
  const tally = [...counts].map(([kind, c]) => `${c} ${c === 1 ? kind : PLURAL[kind]}`).join(", ");
  file.signature = `${name} -> ${renderingRel}${tally ? ` (${tally})` : ""}`;
  return { nodes, rawEdges };
}

/** 0-based first row of an `L<a>-L<b>` span. */
function startRow(span: string): number {
  return Number(/^L(\d+)/.exec(span)![1]) - 1;
}

/** 0-based last row of an `L<a>-L<b>` span. */
function endRow(span: string): number {
  return Number(/-L(\d+)$/.exec(span)![1]) - 1;
}
