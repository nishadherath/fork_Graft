/**
 * The rendering cache: `graft/.graph/docs/<sha256 of the binary>.txt`.
 *
 * Responsible for: converting each document whose rendering is missing or whose
 * extraction is not cached, writing the rendering atomically, reading it back for
 * a reader that prints spans, and deleting renderings no current binary hashes to.
 *
 * Deliberately does not: decide which files are documents (source-files.ts does)
 * or extract nodes (extract.ts does). It never reads a binary as text.
 *
 * The non-obvious thing: the rendering and the extraction cache share one key, the
 * binary's content hash, so a replayed extraction always has its rendering. A
 * rendering is rewritten whenever the extraction is not replayed, so a converter
 * change (which moves the extractor stamp and empties the extraction cache) also
 * refreshes every rendering it produced.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contentHash } from "../../../util/id.js";
import { relPosix } from "../../../util/paths.js";
import type { ExtractCache } from "../../extract-cache.js";
import { GRAPH_DIR } from "../../write.js";
import { convertDocument, documentFormatOf, type DocumentFormat } from "./index.js";
import { MissingConverterError } from "./load.js";
import { renderText } from "./render.js";

/** Directory under `.graph/` holding the renderings. */
const DOCS_DIR = "docs";

const RENDERING_NAME = /^[0-9a-f]{64}\.txt$/;

/** Absolute path of the rendering for a binary whose content hash is `hash`. */
export function renderingPath(outDir: string, hash: string): string {
  return join(outDir, GRAPH_DIR, DOCS_DIR, `${hash}.txt`);
}

/** A document ready to extract, or the reason it cannot be. */
export type PreparedDocument =
  | { status: "ready"; format: DocumentFormat; hash: string; text: string; renderingRel: string }
  | { status: "failed"; format: DocumentFormat; hash: string; error: string }
  | { status: "missing"; format: DocumentFormat; packageName: string };

/** Convert and cache every document in `files` (absolute and repo-relative
 * paths). Sequential: the converters are CPU-bound in this process. */
export async function prepareDocuments(
  root: string,
  outDir: string,
  files: readonly { abs: string; rel: string }[],
  prior: ExtractCache,
): Promise<Map<string, PreparedDocument>> {
  const out = new Map<string, PreparedDocument>();
  for (const { abs, rel } of files) {
    const format = documentFormatOf(rel);
    if (!format) continue;
    let bytes: Uint8Array;
    try {
      bytes = readFileSync(abs);
    } catch (err) {
      out.set(rel, { status: "failed", format, hash: "", error: `${rel}: ${err instanceof Error ? err.message : String(err)}` });
      continue;
    }
    const hash = contentHash(bytes);
    const target = renderingPath(outDir, hash);
    const renderingRel = relPosix(root, target);
    const cached = prior.files[rel];
    if (cached && cached.hash === hash && cached.error) {
      out.set(rel, { status: "failed", format, hash, error: cached.error }); // failed last time on these bytes
      continue;
    }
    if (cached && cached.hash === hash && existsSync(target)) {
      out.set(rel, { status: "ready", format, hash, text: readFileSync(target, "utf8"), renderingRel });
      continue;
    }
    try {
      const text = renderText(await convertDocument(bytes, format));
      writeAtomic(target, text);
      out.set(rel, { status: "ready", format, hash, text, renderingRel });
    } catch (err) {
      if (err instanceof MissingConverterError) {
        out.set(rel, { status: "missing", format, packageName: err.packageName });
      } else {
        const reason = err instanceof Error ? err.message : String(err);
        out.set(rel, { status: "failed", format, hash, error: `${rel}: ${format} conversion failed: ${reason}` });
      }
    }
  }
  return out;
}

/** The rendering of the document at `abs` as it is on disk now, or null when the
 * file cannot be read or has changed since the last build (no rendering for its
 * current bytes). Never returns a stale rendering. */
export function readRendering(outDir: string, abs: string): { text: string; hash: string } | null {
  try {
    const hash = contentHash(readFileSync(abs));
    return { text: readFileSync(renderingPath(outDir, hash), "utf8"), hash };
  } catch {
    return null;
  }
}

/** Delete every rendering whose hash is not in `keep`. Returns how many went. */
export function pruneRenderings(outDir: string, keep: ReadonlySet<string>): number {
  const dir = join(outDir, GRAPH_DIR, DOCS_DIR);
  if (!existsSync(dir)) return 0;
  let pruned = 0;
  for (const name of readdirSync(dir)) {
    if (RENDERING_NAME.test(name) && keep.has(name.slice(0, -4))) continue;
    rmSync(join(dir, name), { force: true });
    pruned++;
  }
  return pruned;
}

/** Write via a temporary file and a rename, so a reader never sees half a rendering. */
function writeAtomic(path: string, text: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, text);
  renameSync(temp, path);
}
