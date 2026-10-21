/**
 * The notices the documents tier prints: at most one line per cause, never one
 * line per file.
 *
 * Responsible for: turning the documents a build skipped (over the size cap, no
 * text layer, converter package not installed) into the lines `graft build`
 * prints. With the tier on by default, a repository holding hundreds of scanned
 * PDFs must not bury the build's own output, so each cause is one line that
 * counts the files and names the first few.
 *
 * Deliberately does not: decide what to skip (build.ts and cache.ts do) or print
 * anything. A single affected file keeps the older per-file wording, which names
 * exactly one path.
 *
 * The non-obvious thing: a missing converter is a warning, not an error. It is
 * a capability the user may never have asked for, and the line names the way out
 * in both directions: install the package, or `--no-documents`.
 */
import { MissingConverterError } from "./load.js";

/** Names listed in a notice before the rest are counted. */
export const MAX_LISTED_DOCUMENTS = 5;

export interface DocumentNoticeInput {
  /** The documents tier's size cap in bytes, for the over-cap line. */
  capBytes: number;
  oversize: readonly { rel: string; size: number }[];
  /** Documents whose rendering holds markers and no text, with their unit kind and count label. */
  textless: readonly { rel: string; kind: string; label: string; scanned: boolean }[];
  /** Converter package name to the number of documents it would have converted. */
  missing: ReadonlyMap<string, number>;
}

/** `a.pdf, b.pdf and 3 more`: the first {@link MAX_LISTED_DOCUMENTS} names, then a count. */
export function listNames(names: readonly string[]): string {
  const shown = names.slice(0, MAX_LISTED_DOCUMENTS).join(", ");
  const rest = names.length - MAX_LISTED_DOCUMENTS;
  return rest > 0 ? `${shown} and ${rest} more` : shown;
}

const plural = (n: number): string => `${n} document${n === 1 ? "" : "s"}`;

/** The lines to print, in a fixed order: over the cap, no text, converter missing. */
export function documentNotices(input: DocumentNoticeInput): string[] {
  const lines: string[] = [];
  const { capBytes, oversize, textless, missing } = input;

  if (oversize.length === 1) {
    const only = oversize[0]!;
    lines.push(`${only.rel}: skipped, ${only.size} bytes is over the documents tier's cap of ${capBytes} bytes (GRAFT_DOCUMENT_MAX_BYTES)`);
  } else if (oversize.length > 1) {
    lines.push(
      `${oversize.length} documents skipped, each over the documents tier's cap of ${capBytes} bytes (GRAFT_DOCUMENT_MAX_BYTES): ` +
        listNames(oversize.map((d) => d.rel)),
    );
  }

  if (textless.length === 1) {
    const only = textless[0]!;
    const scanned = only.scanned ? " (a scanned PDF has no text layer)" : "";
    lines.push(`${only.rel}: no text in its ${only.label}${scanned}; only its ${only.kind} markers are indexed`);
  } else if (textless.length > 1) {
    const scanned = textless.some((d) => d.scanned) ? " (a scanned PDF has no text layer)" : "";
    const kinds = [...new Set(textless.map((d) => d.kind))].join(" or ");
    lines.push(
      `${textless.length} documents have no text${scanned}; only their ${kinds} markers are indexed: ` +
        listNames(textless.map((d) => d.rel)),
    );
  }

  for (const [packageName, count] of missing) {
    lines.push(
      `${plural(count)} skipped: ${new MissingConverterError(packageName).message}; ` +
        "`graft build --no-documents` stops indexing documents",
    );
  }
  return lines;
}
