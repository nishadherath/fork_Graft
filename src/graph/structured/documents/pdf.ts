/**
 * PDF converter: one `page` unit per page, its text layer as lines.
 *
 * Responsible for: reading a PDF's text layer with `pdfjs-dist` (pure JavaScript,
 * loaded lazily) and turning each page's text items into lines in reading order
 * as the file stores them.
 *
 * Deliberately does not: render, OCR, or reflow. A scanned page with no text layer
 * yields an empty page (its marker only); a multi-column page reads in the order
 * the producer wrote its text, which is what `pdftotext -raw` would print too.
 *
 * The non-obvious thing: pdfjs marks most line ends (`hasEOL`) but not all, so a
 * change of baseline larger than half the glyph height also ends a line; a
 * superscript shifts the baseline by less and stays on its line.
 */
import { importOptional } from "./load.js";
import type { DocumentUnit } from "./render.js";

/** The members of pdfjs-dist this converter calls, narrowed here and nowhere else. */
interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
  height?: number;
  transform?: number[];
}
interface PdfPage {
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
  cleanup(): void;
}
interface PdfDocument {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}
interface PdfJs {
  getDocument(src: Record<string, unknown>): { promise: Promise<PdfDocument> };
}

/** pdfjs's Node build; the default build expects browser globals. */
const PDFJS_SPECIFIER = "pdfjs-dist/legacy/build/pdf.mjs";

/** A baseline shift, as a fraction of the glyph height, that starts a new line. */
const NEW_LINE_BASELINE_FRACTION = 0.5;

/** The text lines of one page's items. */
export function pageLines(items: readonly PdfTextItem[]): string[] {
  const lines: string[] = [];
  let line = "";
  let lastY: number | undefined;
  for (const item of items) {
    if (typeof item.str !== "string") continue; // marked-content boundaries carry no text
    const y = item.transform?.[5];
    const threshold = Math.max(1, (item.height ?? 0) * NEW_LINE_BASELINE_FRACTION);
    if (line !== "" && lastY !== undefined && y !== undefined && Math.abs(y - lastY) > threshold) {
      lines.push(line);
      line = "";
    }
    line += item.str;
    if (item.hasEOL) {
      lines.push(line);
      line = "";
    }
    if (y !== undefined) lastY = y;
  }
  if (line !== "") lines.push(line);
  return lines.map((l) => l.trim()).filter((l) => l !== "");
}

/** Every page of `bytes` as a `page` unit holding one paragraph of its lines. */
export async function convertPdf(bytes: Uint8Array): Promise<DocumentUnit[]> {
  const pdfjs = (await importOptional("pdfjs-dist", PDFJS_SPECIFIER)) as PdfJs;
  // pdfjs takes ownership of the buffer it is given, and refuses a Node Buffer, so
  // it gets a plain Uint8Array copy.
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    verbosity: 0,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
  }).promise;
  try {
    const units: DocumentUnit[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const { items } = await page.getTextContent();
      units.push({ kind: "page", blocks: [{ text: pageLines(items).join("\n") }] });
      page.cleanup();
    }
    return units;
  } finally {
    await doc.destroy();
  }
}
