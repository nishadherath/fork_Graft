/**
 * PPTX converter: a `slide` unit per slide, in presentation order.
 *
 * Responsible for: finding the slides in the order `ppt/presentation.xml` lists
 * them (`p:sldIdLst`, resolved through its relationships), titling each by its
 * title placeholder, and writing every other shape's text (and table cells) as a
 * block with a line per paragraph.
 *
 * Deliberately does not: read speaker notes, layouts or masters (template text,
 * not the deck's), or order shapes by position; shapes are read in the order the
 * slide stores them, which is the order PowerPoint's own outline uses.
 */
import { posix } from "node:path";
import type { DocumentUnit } from "./render.js";
import { scanXml } from "./xml-events.js";
import { openArchive, type Archive } from "./zip.js";

const PRESENTATION = "ppt/presentation.xml";
const PRESENTATION_RELS = "ppt/_rels/presentation.xml.rels";

/** Placeholder types that title a slide. */
const TITLE_PLACEHOLDERS: ReadonlySet<string> = new Set(["title", "ctrTitle"]);

/** Placeholders whose text the template fills in, not the author: slide number and date. */
const GENERATED_PLACEHOLDERS: ReadonlySet<string> = new Set(["sldNum", "dt"]);

/** Slide part names in presentation order. */
function slideOrder(archive: Archive): string[] {
  const presentation = archive.text(PRESENTATION);
  const rels = archive.text(PRESENTATION_RELS);
  if (presentation === null || rels === null) throw new Error(`not a PPTX: the archive has no ${PRESENTATION}`);
  const targets = new Map<string, string>();
  scanXml(rels, {
    open(name, attrs) {
      if (name === "Relationship" && attrs.get("Id") && attrs.get("Target")) targets.set(attrs.get("Id")!, attrs.get("Target")!);
    },
    close() {},
    text() {},
  });
  const order: string[] = [];
  scanXml(presentation, {
    open(name, attrs) {
      const target = name === "p:sldId" ? targets.get(attrs.get("r:id") ?? "") : undefined;
      if (target) order.push(target.startsWith("/") ? target.slice(1) : posix.normalize(posix.join("ppt", target)));
    },
    close() {},
    text() {},
  });
  return order;
}

/** One slide's title and blocks. */
export function slideUnit(xml: string): DocumentUnit {
  const unit: DocumentUnit = { kind: "slide", blocks: [] };
  let shape: { title: boolean; generated: boolean; lines: string[] } | null = null;
  let shapeDepth = 0;
  let depth = 0;
  let line: string | null = null;
  let inText = 0;

  scanXml(xml, {
    open(name, attrs) {
      depth++;
      if ((name === "p:sp" || name === "p:graphicFrame") && !shape) {
        shape = { title: false, generated: false, lines: [] };
        shapeDepth = depth;
      } else if (name === "p:ph" && shape) {
        shape.title = TITLE_PLACEHOLDERS.has(attrs.get("type") ?? "");
        shape.generated = GENERATED_PLACEHOLDERS.has(attrs.get("type") ?? "");
      } else if (name === "a:p" && shape) {
        line = "";
      } else if (name === "a:t") {
        inText++;
      } else if (name === "a:br" && line !== null) {
        line += "\n";
      }
    },
    close(name) {
      if (name === "a:t") inText--;
      else if (name === "a:p" && shape && line !== null) {
        shape.lines.push(...line.split("\n"));
        line = null;
      } else if (depth === shapeDepth && shape) {
        const text = shape.lines.map((l) => l.trim()).filter((l) => l !== "").join("\n");
        if (!shape.generated) {
          if (shape.title && !unit.title) unit.title = text;
          else if (text) unit.blocks.push({ text });
        }
        shape = null;
      }
      depth--;
    },
    text(text) {
      if (inText > 0 && line !== null) line += text;
    },
  });
  return unit;
}

/** Every slide of the PPTX in `bytes`. */
export async function convertPptx(bytes: Uint8Array): Promise<DocumentUnit[]> {
  const archive = await openArchive(
    bytes,
    (name) => name === PRESENTATION || name === PRESENTATION_RELS || /^ppt\/slides\/[^/]+\.xml$/.test(name),
  );
  return slideOrder(archive).map((part) => {
    const xml = archive.text(part);
    return xml === null ? { kind: "slide", blocks: [] } : slideUnit(xml);
  });
}
