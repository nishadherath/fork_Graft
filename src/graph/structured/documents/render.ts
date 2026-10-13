/**
 * The text rendering every document converter produces, and the one place its
 * line format is written and read.
 *
 * Responsible for: turning a converter's units (pages, slides, chapters) and
 * blocks (headings, paragraphs) into the deterministic text stored at
 * `graft/.graph/docs/<sha256>.txt`, and parsing that text's marker lines back.
 * A unit opens with a marker line (`<!-- page 12 -->`), a heading is an ATX line
 * (`## Methods`), and blocks are separated by one blank line.
 *
 * Deliberately does not: read any binary format (the converters do), or decide
 * what a section is (extract.ts does, with the Markdown scanner).
 *
 * The non-obvious thing: a body line that the Markdown scanner would read as
 * structure (a `#` heading, a fence, a comment, a setext underline, a link
 * definition) is prefixed with a backslash, so text from a document can never
 * open an invented section or swallow the rest of the rendering into a fence.
 */

/** How a document is divided for locating: a page of a PDF or a laid-out word
 * processor file, a slide of a deck, a chapter (spine item) of an EPUB. */
export type UnitKind = "page" | "slide" | "chapter";

/** A heading (`level` 1 to 6) or a paragraph. A paragraph may hold several lines. */
export interface Block {
  level?: number;
  text: string;
}

/** One page, slide or chapter. `kind` null means the format records no division
 * (a DOCX saved without layout information): no marker is written for it. */
export interface DocumentUnit {
  kind: UnitKind | null;
  title?: string;
  blocks: Block[];
}

/** Longest title kept on a marker line. */
const MAX_MARKER_TITLE_CHARS = 120;

const MARKER = /^<!-- (page|slide|chapter) (\d+)(?:: (.*))? -->$/;

/** A body line the Markdown scanner would read as structure rather than prose. */
const STRUCTURAL_LINE = /^(?:#|`{3}|~{3}|<!--|=+$|-+$|\[[^\]]+\]:)/;

/** Control characters other than tab: never meaningful in extracted text, and a
 * stray form feed or NUL would make the rendering awkward to read and grep. */
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

/** One line as it is written: control characters dropped, ends trimmed, and a
 * leading backslash when the scanner would otherwise read it as structure. */
function bodyLine(raw: string): string {
  const line = raw.replace(CONTROL, "").trim();
  return STRUCTURAL_LINE.test(line) ? `\\${line}` : line;
}

/** Collapse to one line of plain words. */
function oneLine(raw: string): string {
  return raw.replace(CONTROL, " ").replace(/\s+/g, " ").trim();
}

/** The marker line opening the `n`th unit of `kind`. */
export function markerLine(kind: UnitKind, n: number, title?: string): string {
  const shown = title ? oneLine(title).replace(/-->/g, "->").slice(0, MAX_MARKER_TITLE_CHARS).trim() : "";
  return shown ? `<!-- ${kind} ${n}: ${shown} -->` : `<!-- ${kind} ${n} -->`;
}

/** A parsed marker line, or null when `line` is not one. */
export function parseMarker(line: string): { kind: UnitKind; n: number; title?: string } | null {
  const m = MARKER.exec(line);
  if (!m) return null;
  return { kind: m[1] as UnitKind, n: Number(m[2]), ...(m[3] ? { title: m[3] } : {}) };
}

/** The rendering's text. Units of each kind are numbered from 1 in order; empty
 * blocks are dropped, an empty unit keeps its marker so later numbers stay true.
 * Ends with a newline. */
export function renderText(units: readonly DocumentUnit[]): string {
  const out: string[] = [];
  const counts = new Map<UnitKind, number>();
  units.forEach((unit, i) => {
    if (i > 0) out.push("");
    if (unit.kind) {
      const n = (counts.get(unit.kind) ?? 0) + 1;
      counts.set(unit.kind, n);
      out.push(markerLine(unit.kind, n, unit.title));
    }
    let first = true;
    for (const block of unit.blocks) {
      const lines = block.level
        ? [oneLine(block.text)].filter((t) => t !== "").map((t) => `${"#".repeat(Math.min(6, Math.max(1, block.level!)))} ${t}`)
        : block.text.split("\n").map(bodyLine).filter((l) => l !== "");
      if (lines.length === 0) continue;
      if (!first) out.push("");
      out.push(...lines);
      first = false;
    }
  });
  // A document with no text at all still renders to one (empty) line.
  return out.join("\n") + "\n";
}
