/**
 * Documents tier: PDF, DOCX, ODT, EPUB, PPTX and ODP as `section` nodes over a
 * cached text rendering (decision D3 A).
 *
 * A binary has no lines, so graft cannot point into it. Instead each document is
 * converted once to a deterministic rendering stored at
 * `graft/.graph/docs/<sha256 of the binary>.txt` (cache.ts), and the Markdown
 * scanner indexes the rendering (extract.ts). Every span is a line range of that
 * rendering, so `--source` prints it verbatim; the node keeps the binary's path,
 * and its signature names the binary, the page or slide, and the rendering.
 *
 * Opt-in twice: the structured tier must be on, and `--documents` (or
 * `GRAFT_DOCUMENTS=1`). The converters are optional dependencies loaded lazily
 * (decision D4 A): `pdfjs-dist` for PDF, `fflate` for the zip-based formats,
 * whose XML is read by a hand-written scanner. No network, no model.
 */
import { convertDocx } from "./docx.js";
import { convertEpub } from "./epub.js";
import { convertOdp, convertOdt } from "./odf.js";
import { convertPdf } from "./pdf.js";
import { convertPptx } from "./pptx.js";
import type { DocumentUnit } from "./render.js";

export type DocumentFormat = "pdf" | "docx" | "odt" | "epub" | "pptx" | "odp";

/** Extension to format. Matched case-insensitively on the path's end. */
const FORMAT_BY_EXTENSION: ReadonlyMap<string, DocumentFormat> = new Map([
  [".pdf", "pdf"],
  [".docx", "docx"],
  [".odt", "odt"],
  [".epub", "epub"],
  [".pptx", "pptx"],
  [".odp", "odp"],
]);

/** The document format of `path`, or null when the documents tier does not claim it. */
export function documentFormatOf(path: string): DocumentFormat | null {
  const lower = path.toLowerCase();
  const dot = lower.lastIndexOf(".");
  return dot < 0 ? null : FORMAT_BY_EXTENSION.get(lower.slice(dot)) ?? null;
}

/** Every extension the documents tier claims. */
export function documentExtensions(): string[] {
  return [...FORMAT_BY_EXTENSION.keys()];
}

/** Convert one document to its units. Throws `MissingConverterError` when the
 * format's package is not installed, and any converter error otherwise. */
export async function convertDocument(bytes: Uint8Array, format: DocumentFormat): Promise<DocumentUnit[]> {
  switch (format) {
    case "pdf":
      return convertPdf(bytes);
    case "docx":
      return convertDocx(bytes);
    case "odt":
      return convertOdt(bytes);
    case "epub":
      return convertEpub(bytes);
    case "pptx":
      return convertPptx(bytes);
    case "odp":
      return convertOdp(bytes);
  }
}
