/**
 * Reading the zip container of DOCX, PPTX, ODT, ODP and EPUB with `fflate`
 * (an optional dependency, loaded lazily).
 *
 * Responsible for: returning the named text entries of an archive, decoded as
 * UTF-8, and refusing an entry whose declared size is past
 * {@link MAX_ZIP_ENTRY_BYTES}, so a small archive cannot expand into gigabytes.
 *
 * Deliberately does not: read binary entries (images, fonts), which no converter
 * needs.
 */
import { importOptional } from "./load.js";

/** The members of fflate this module calls, narrowed here and nowhere else. */
interface UnzipFileInfo {
  name: string;
  originalSize: number;
}
interface Fflate {
  unzipSync(data: Uint8Array, opts: { filter: (file: UnzipFileInfo) => boolean }): Record<string, Uint8Array>;
  strFromU8(data: Uint8Array): string;
}

/** Largest uncompressed entry read. Document XML is far smaller in practice; the
 * bound exists because the compressed size says nothing about the expanded one. */
export const MAX_ZIP_ENTRY_BYTES = 200_000_000;

/** A zip archive's text entries, read on demand. */
export interface Archive {
  /** Every entry name, in archive order. */
  names: readonly string[];
  /** The entry `name` decoded as UTF-8, or null when there is no such entry. */
  text(name: string): string | null;
}

/** Open `bytes` as a zip archive, keeping only entries `want` accepts. Throws when
 * the archive is unreadable or an accepted entry is past the size bound. */
export async function openArchive(bytes: Uint8Array, want: (name: string) => boolean): Promise<Archive> {
  const fflate = (await importOptional("fflate", "fflate")) as Fflate;
  const names: string[] = [];
  const entries = fflate.unzipSync(bytes, {
    filter: (file) => {
      names.push(file.name);
      if (!want(file.name)) return false;
      if (file.originalSize > MAX_ZIP_ENTRY_BYTES) {
        throw new Error(`zip entry ${file.name} expands to ${file.originalSize} bytes, over the ${MAX_ZIP_ENTRY_BYTES}-byte bound`);
      }
      return true;
    },
  });
  return {
    names,
    text: (name) => (entries[name] ? fflate.strFromU8(entries[name]!) : null),
  };
}
