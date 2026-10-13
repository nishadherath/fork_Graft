/**
 * Document fixtures built in memory, so every documents-tier test states its own
 * bytes and its true lines instead of trusting a binary checked into the tree.
 *
 * `pdf` writes a minimal PDF by hand (one text object per line, a correct xref
 * table); the zip-based formats are assembled with `fflate`, the same optional
 * dependency the tier reads them with.
 */
import { strToU8, zipSync } from "fflate";

/** A PDF with one page per entry, each line drawn as its own text object 20
 * points below the last. Only printable ASCII without `(`, `)` or `\`. */
export function pdf(pages: readonly (readonly string[])[]): Uint8Array {
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  const fontId = 3 + pages.length * 2;
  pages.forEach((lines, i) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${4 + i * 2} 0 R ` +
        `/Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
    const ops = lines.map((l, k) => `BT /F1 12 Tf 72 ${720 - k * 20} Td (${l}) Tj ET`).join("\n");
    objects.push(`<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`);
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  // The second line is the binary marker real producers write: bytes that are not
  // valid UTF-8, so a reader that decodes a PDF as text cannot pass by accident.
  let out = "%PDF-1.4\n%âãÏÓ\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}

/** A zip archive of UTF-8 text entries, in the order given. */
export function zip(entries: Readonly<Record<string, string>>): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const [name, text] of Object.entries(entries)) files[name] = strToU8(text);
  return zipSync(files, { level: 6, mtime: new Date("2026-01-01T00:00:00Z") });
}
