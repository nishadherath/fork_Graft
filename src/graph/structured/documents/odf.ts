/**
 * OpenDocument converters, read from `content.xml`.
 *
 * Responsible for: translating an ODT body into {@link Flow} calls: `text:h` with
 * its outline level, paragraphs, list items, tables, and a page at each
 * `text:soft-page-break`, the mark LibreOffice writes where a page began when it
 * last laid the document out.
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
export function odtUnits(xml: string): DocumentUnit[] {
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
          flow.openParagraph();
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
  const archive = await openArchive(bytes, (name) => name === CONTENT);
  const xml = archive.text(CONTENT);
  if (xml === null) throw new Error(`not an ODT: the archive has no ${CONTENT}`);
  return odtUnits(xml);
}
