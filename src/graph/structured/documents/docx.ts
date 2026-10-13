/**
 * DOCX converter: the body of `word/document.xml` in reading order, in pages where
 * Word recorded them.
 *
 * Responsible for: translating WordprocessingML into {@link Flow} calls. A
 * paragraph's heading level comes from its own outline level or its style
 * (`styles.xml`: a style named "heading N" or carrying an outline level, inherited
 * through `basedOn`). A page begins at each `<w:lastRenderedPageBreak/>`, the mark
 * Word writes where a page began when it last laid the document out.
 *
 * Deliberately does not: count explicit page breaks or estimate pages. A file no
 * editor laid out (one written by a library) records no page boundaries, so it
 * gets no page markers and its locator names the heading: a guessed page number
 * would be a plausible-but-wrong locator. Headers, footers, footnotes, comments,
 * field codes and deleted (tracked) text are left out.
 */
import { Flow } from "./flow.js";
import type { DocumentUnit } from "./render.js";
import { scanXml } from "./xml-events.js";
import { openArchive } from "./zip.js";

const DOCUMENT = "word/document.xml";
const STYLES = "word/styles.xml";

/** Content that is not the document's text as it reads now: deleted and
 * moved-away revisions, field codes, and the VML duplicate of a text box. */
const SKIPPED: ReadonlySet<string> = new Set(["w:del", "w:moveFrom", "w:delText", "w:instrText", "mc:Fallback"]);

/** Word's outline levels 0 to 5 are headings 1 to 6; 9 is body text. */
const HEADING_OUTLINE_LEVELS = 6;

function outlineHeading(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n < HEADING_OUTLINE_LEVELS ? n + 1 : undefined;
}

/** Heading level by paragraph style id. Word's built-in ids (`Heading1` to
 * `Heading6`) count even when `styles.xml` does not define them. */
export function headingLevels(styles: string | null): (styleId: string) => number | undefined {
  const own = new Map<string, number>();
  const basedOn = new Map<string, string>();
  let id: string | null = null;
  if (styles) {
    scanXml(styles, {
      open(name, attrs) {
        if (name === "w:style") id = attrs.get("w:type") === "paragraph" ? attrs.get("w:styleId") ?? null : null;
        if (!id) return;
        const val = attrs.get("w:val") ?? "";
        const named = name === "w:name" ? /^heading ([1-6])$/i.exec(val) : null;
        if (named) own.set(id, Number(named[1]));
        else if (name === "w:outlineLvl" && !own.has(id)) {
          const level = outlineHeading(val);
          if (level !== undefined) own.set(id, level);
        } else if (name === "w:basedOn") basedOn.set(id, val);
      },
      close(name) {
        if (name === "w:style") id = null;
      },
      text() {},
    });
  }
  return (styleId) => {
    const seen = new Set<string>();
    for (let s: string | undefined = styleId; s !== undefined && !seen.has(s); s = basedOn.get(s)) {
      seen.add(s);
      const level = own.get(s);
      if (level !== undefined) return level;
    }
    const builtIn = /^Heading([1-6])$/i.exec(styleId);
    return builtIn ? Number(builtIn[1]) : undefined;
  };
}

/** The units of a DOCX body. */
export function docxUnits(xml: string, levelOf: (styleId: string) => number | undefined): DocumentUnit[] {
  const flow = new Flow(xml.includes("<w:lastRenderedPageBreak"));
  let skip = 0;
  let inText = 0;
  let inProperties = 0;

  scanXml(xml, {
    open(name, attrs) {
      if (SKIPPED.has(name)) skip++;
      if (skip > 0) return;
      switch (name) {
        case "w:p":
          flow.openParagraph();
          break;
        case "w:pPr":
        case "w:rPr":
          inProperties++;
          break;
        case "w:pStyle":
          flow.setLevel(levelOf(attrs.get("w:val") ?? ""));
          break;
        case "w:outlineLvl":
          // Direct formatting wins over the style, and level 9 says "body text".
          if (inProperties) flow.setLevel(outlineHeading(attrs.get("w:val")));
          break;
        case "w:t":
          inText++;
          break;
        case "w:tab":
          if (!inProperties) flow.text("\t"); // inside w:pPr it is a tab stop, not a tab
          break;
        case "w:br":
        case "w:cr":
          flow.text("\n");
          break;
        case "w:noBreakHyphen":
          flow.text("-");
          break;
        case "w:lastRenderedPageBreak":
          flow.pageBreak();
          break;
        case "w:tbl":
          flow.openTable();
          break;
        case "w:tr":
          flow.openRow();
          break;
        case "w:tc":
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
        case "w:p":
          flow.closeParagraph();
          break;
        case "w:pPr":
        case "w:rPr":
          inProperties--;
          break;
        case "w:t":
          inText--;
          break;
        case "w:tc":
          flow.closeCell();
          break;
        case "w:tr":
          flow.closeRow();
          break;
        case "w:tbl":
          flow.closeTable();
          break;
      }
    },
    text(text) {
      if (skip === 0 && inText > 0) flow.text(text);
    },
  });
  return flow.units;
}

/** Every unit of the DOCX in `bytes`. */
export async function convertDocx(bytes: Uint8Array): Promise<DocumentUnit[]> {
  const archive = await openArchive(bytes, (name) => name === DOCUMENT || name === STYLES);
  const xml = archive.text(DOCUMENT);
  if (xml === null) throw new Error(`not a DOCX: the archive has no ${DOCUMENT}`);
  return docxUnits(xml, headingLevels(archive.text(STYLES)));
}
