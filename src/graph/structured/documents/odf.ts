/**
 * OpenDocument converters, read from `content.xml`.
 *
 * Responsible for: translating an ODT body into {@link Flow} calls: `text:h` with
 * its outline level, a `text:p` whose style is a heading style (one with a
 * default outline level, or Heading N by name, followed through its parents, as
 * LibreOffice writes a heading that opens a page), paragraphs, list items, tables, and a page at each
 * `text:soft-page-break`, the mark LibreOffice writes where a page began when it
 * last laid the document out; and an ODP's slides (`draw:page`), each titled
 * by its title frame, with a block per other text frame.
 *
 * Deliberately does not: guess pages for a file no editor laid out (no soft page
 * breaks, no page markers), or read notes, annotations, tracked deletions or the
 * generated table of contents, none of which is the document's text as it reads.
 */
import { Flow } from "./flow.js";
import type { DocumentUnit } from "./render.js";
import { scanXml } from "./xml-events.js";
import { openArchive } from "./zip.js";

const CONTENT = "content.xml";
const STYLES = "styles.xml";

/** Heading levels in ODF run 1 to 10; Markdown and the rendering stop at 6. */
const MAX_HEADING_LEVEL = 6;

/** Heading level by paragraph style name, from the automatic styles in
 * `content.xml` and the named styles in `styles.xml`: a style's own
 * `style:default-outline-level`, else a name of the form Heading N, else its
 * parent's level. */
export function odtHeadingLevels(...parts: Array<string | null>): (styleName: string | undefined) => number | undefined {
  const own = new Map<string, number>();
  const parent = new Map<string, string>();
  for (const xml of parts) {
    if (!xml) continue;
    scanXml(xml, {
      open(name, attrs) {
        if (name !== "style:style" || attrs.get("style:family") !== "paragraph") return;
        const id = attrs.get("style:name");
        if (!id) return;
        const outline = Number(attrs.get("style:default-outline-level"));
        const named = /^Heading[ _](?:20_)?([1-9])$/i.exec(attrs.get("style:display-name") ?? id);
        const level = Number.isInteger(outline) && outline >= 1 ? outline : named ? Number(named[1]) : undefined;
        if (level !== undefined) own.set(id, Math.min(MAX_HEADING_LEVEL, level));
        const up = attrs.get("style:parent-style-name");
        if (up) parent.set(id, up);
      },
      close() {},
      text() {},
    });
  }
  return (styleName) => {
    const seen = new Set<string>();
    for (let s = styleName; s !== undefined && !seen.has(s); s = parent.get(s)) {
      seen.add(s);
      const level = own.get(s);
      if (level !== undefined) return level;
    }
    return undefined;
  };
}

/** Subtrees that are not body text as it reads. */
const SKIPPED: ReadonlySet<string> = new Set([
  "text:note",
  "office:annotation",
  "text:tracked-changes",
  "text:table-of-content",
]);

/** The characters an inline mark stands for, or null when it is not one. */
function inlineText(name: string, attrs: ReadonlyMap<string, string>): string | null {
  if (name === "text:s") return " ".repeat(Math.max(1, Number(attrs.get("text:c")) || 1));
  if (name === "text:tab") return "\t";
  if (name === "text:line-break") return "\n";
  return null;
}

/** The units of an ODT's `content.xml`. */
export function odtUnits(
  xml: string,
  levelOf: (styleName: string | undefined) => number | undefined = odtHeadingLevels(xml),
): DocumentUnit[] {
  const flow = new Flow(xml.includes("<text:soft-page-break"));
  let skip = 0;
  scanXml(xml, {
    open(name, attrs) {
      if (SKIPPED.has(name)) skip++;
      if (skip > 0) return;
      const inline = inlineText(name, attrs);
      if (inline !== null) {
        flow.text(inline);
        return;
      }
      switch (name) {
        case "text:h":
          flow.openParagraph(Number(attrs.get("text:outline-level")) || 1);
          break;
        case "text:p":
          flow.openParagraph(levelOf(attrs.get("text:style-name")));
          break;
        case "text:soft-page-break":
          flow.pageBreak();
          break;
        case "table:table":
          flow.openTable();
          break;
        case "table:table-row":
          flow.openRow();
          break;
        case "table:table-cell":
          flow.openCell();
          break;
      }
    },
    close(name) {
      if (SKIPPED.has(name)) {
        skip--;
        return;
      }
      if (skip > 0) return;
      switch (name) {
        case "text:h":
        case "text:p":
          flow.closeParagraph();
          break;
        case "table:table-cell":
          flow.closeCell();
          break;
        case "table:table-row":
          flow.closeRow();
          break;
        case "table:table":
          flow.closeTable();
          break;
      }
    },
    text(text) {
      if (skip === 0) flow.text(text);
    },
  });
  return flow.units;
}

/** Every unit of the ODT in `bytes`. */
export async function convertOdt(bytes: Uint8Array): Promise<DocumentUnit[]> {
  const archive = await openArchive(bytes, (name) => name === CONTENT || name === STYLES);
  const xml = archive.text(CONTENT);
  if (xml === null) throw new Error(`not an ODT: the archive has no ${CONTENT}`);
  return odtUnits(xml, odtHeadingLevels(xml, archive.text(STYLES)));
}

/** The slides of an ODP's `content.xml`: a unit per `draw:page`, titled by its
 * title frame, with a block per other text frame and a line per paragraph.
 * Speaker notes (`presentation:notes`) are not the deck's text and are skipped. */
export function odpUnits(xml: string): DocumentUnit[] {
  const units: DocumentUnit[] = [];
  let slide: DocumentUnit | null = null;
  let frame: { title: boolean; depth: number; lines: string[] } | null = null;
  let depth = 0;
  let line: string | null = null;
  let skip = 0;

  scanXml(xml, {
    open(name, attrs) {
      if (SKIPPED.has(name) || name === "presentation:notes") skip++;
      if (skip > 0) return;
      depth++;
      const inline = inlineText(name, attrs);
      if (inline !== null) {
        if (line !== null) line += inline;
      } else if (name === "draw:page") {
        slide = { kind: "slide", blocks: [] };
        units.push(slide);
      } else if (name === "draw:frame" && slide && !frame) {
        frame = { title: attrs.get("presentation:class") === "title", depth, lines: [] };
      } else if ((name === "text:p" || name === "text:h") && frame) {
        line = "";
      }
    },
    close(name) {
      if (SKIPPED.has(name) || name === "presentation:notes") {
        skip--;
        return;
      }
      if (skip > 0) return;
      if ((name === "text:p" || name === "text:h") && frame && line !== null) {
        frame.lines.push(line);
        line = null;
      } else if (name === "draw:frame" && frame && frame.depth === depth && slide) {
        const text = frame.lines.map((l) => l.trim()).filter((l) => l !== "").join("\n");
        if (frame.title && !slide.title) slide.title = text;
        else if (text) slide.blocks.push({ text });
        frame = null;
      } else if (name === "draw:page") {
        slide = null;
      }
      depth--;
    },
    text(text) {
      if (skip === 0 && line !== null) line += text;
    },
  });
  return units;
}

/** Every slide of the ODP in `bytes`. */
export async function convertOdp(bytes: Uint8Array): Promise<DocumentUnit[]> {
  const archive = await openArchive(bytes, (name) => name === CONTENT);
  const xml = archive.text(CONTENT);
  if (xml === null) throw new Error(`not an ODP: the archive has no ${CONTENT}`);
  return odpUnits(xml);
}
