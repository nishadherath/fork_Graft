/**
 * EPUB converter: a `chapter` unit per spine item, in reading order.
 *
 * Responsible for: finding the package document through
 * `META-INF/container.xml`, reading its spine, and turning each XHTML content
 * document into blocks: `<h1>` to `<h6>` as headings, each block-level element
 * (paragraph, list item, quotation, table cell, preformatted text) as a
 * paragraph, `<br/>` as a line break, inline markup as plain words.
 *
 * Deliberately does not: follow links between chapters (they point inside the
 * archive, never at a file of the repository), read the navigation document
 * unless the spine lists it, or render images. A chapter is the unit because an
 * EPUB has no pages; the reader's pagination depends on the screen.
 */
import { posix } from "node:path";
import type { Block, DocumentUnit } from "./render.js";
import { scanXml } from "./xml-events.js";
import { openArchive } from "./zip.js";

const CONTAINER = "META-INF/container.xml";

/** Elements whose content a reader never sees as text. */
const SKIPPED: ReadonlySet<string> = new Set(["head", "script", "style", "svg", "math"]);

/** Elements that begin and end a paragraph of their own. */
const BLOCKS: ReadonlySet<string> = new Set([
  "p", "div", "li", "blockquote", "pre", "td", "th", "dt", "dd", "figcaption", "caption",
  "section", "article", "aside", "header", "footer", "table", "tr", "ul", "ol", "dl", "body",
]);

const HEADING = /^h([1-6])$/;

/** The local name of a possibly prefixed element name, lower case. */
function local(name: string): string {
  return name.slice(name.indexOf(":") + 1).toLowerCase();
}

/** One content document's blocks. */
export function chapterBlocks(xhtml: string): Block[] {
  const blocks: Block[] = [];
  let text = "";
  let level: number | undefined;
  let skip = 0;
  let pre = 0;
  const flush = (): void => {
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l !== "");
    if (lines.length) blocks.push(level !== undefined ? { level, text: lines.join(" ") } : { text: lines.join("\n") });
    text = "";
    level = undefined;
  };
  scanXml(xhtml, {
    open(name) {
      const tag = local(name);
      if (SKIPPED.has(tag)) skip++;
      if (skip > 0) return;
      const heading = HEADING.exec(tag);
      if (heading || BLOCKS.has(tag)) flush();
      if (heading) level = Number(heading[1]);
      if (tag === "pre") pre++;
      if (tag === "br") text += "\n";
    },
    close(name) {
      const tag = local(name);
      if (SKIPPED.has(tag)) {
        skip--;
        return;
      }
      if (skip > 0) return;
      if (tag === "pre") pre--;
      if (HEADING.test(tag) || BLOCKS.has(tag)) flush();
    },
    text(chunk) {
      if (skip === 0) text += pre > 0 ? chunk : chunk.replace(/\s+/g, " ");
    },
  });
  flush();
  return blocks;
}

/** Attribute values of every `tag` element in `xml`, in order. */
function elements(xml: string, tag: string): Array<ReadonlyMap<string, string>> {
  const found: Array<ReadonlyMap<string, string>> = [];
  scanXml(xml, {
    open(name, attrs) {
      if (local(name) === tag) found.push(attrs);
    },
    close() {},
    text() {},
  });
  return found;
}

/** A manifest href with its percent-escapes decoded; as written when malformed. */
function decodeHref(href: string): string {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

/** Every chapter of the EPUB in `bytes`, in spine order. */
export async function convertEpub(bytes: Uint8Array): Promise<DocumentUnit[]> {
  const archive = await openArchive(bytes, (name) => name === CONTAINER || /\.(?:opf|xhtml|html|htm|xml)$/i.test(name));
  const container = archive.text(CONTAINER);
  const opfPath = container ? elements(container, "rootfile")[0]?.get("full-path") : undefined;
  const opf = opfPath ? archive.text(opfPath) : null;
  if (!opfPath || opf === null) throw new Error(`not an EPUB: no package document named by ${CONTAINER}`);

  const base = posix.dirname(opfPath);
  const hrefs = new Map<string, string>();
  for (const item of elements(opf, "item")) {
    const id = item.get("id");
    const href = item.get("href");
    if (id && href) hrefs.set(id, href);
  }
  return elements(opf, "itemref").map((ref) => {
    const href = hrefs.get(ref.get("idref") ?? "");
    const path = href ? posix.normalize(posix.join(base, decodeHref(href.split("#")[0]!))) : null;
    const xhtml = path ? archive.text(path) : null;
    return { kind: "chapter", blocks: xhtml === null ? [] : chapterBlocks(xhtml) };
  });
}
