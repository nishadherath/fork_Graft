/**
 * A streaming XML scanner for the zip-based document formats: start tags, end
 * tags and text, in document order.
 *
 * Responsible for: walking the XML of a DOCX, PPTX, ODT, ODP or EPUB part and
 * reporting each element and each run of text to a visitor, with the five
 * predefined entities, numeric references and the common HTML named entities
 * decoded.
 *
 * Deliberately does not: build a tree, validate, or resolve namespaces. Names are
 * reported as written (`w:p`, `text:h`). `xml.ts` keeps its own tree builder
 * because it needs rows and collapsed element text; a document needs the order in
 * which text and markup interleave (a page break between two runs), which a tree
 * of collapsed text loses.
 */

export interface XmlVisitor {
  open(name: string, attrs: ReadonlyMap<string, string>, selfClosing: boolean): void;
  close(name: string): void;
  text(text: string): void;
}

/** Named references decoded beyond XML's five: the ones EPUB 2 content uses
 * through the XHTML DTD. Anything else is left as written. */
const NAMED: Readonly<Record<string, string>> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  copy: "©", reg: "®", trade: "™", shy: "­",
};

/** Decode character and entity references. */
export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[A-Za-z]+);/g, (whole, ref: string) => {
    if (ref[0] === "#") {
      const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED[ref] ?? whole;
  });
}

const ATTRIBUTE = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Visit every start tag, end tag and text run of `xml` in order. Malformed input
 * ends the scan early; it never throws. */
export function scanXml(xml: string, visitor: XmlVisitor): void {
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf("<", i);
    const end = lt < 0 ? xml.length : lt;
    if (end > i) visitor.text(decodeXml(xml.slice(i, end)));
    if (lt < 0) return;
    if (xml.startsWith("<!--", lt)) {
      const close = xml.indexOf("-->", lt + 4);
      if (close < 0) return;
      i = close + 3;
    } else if (xml.startsWith("<![CDATA[", lt)) {
      const close = xml.indexOf("]]>", lt + 9);
      if (close < 0) return;
      visitor.text(xml.slice(lt + 9, close));
      i = close + 3;
    } else if (xml.startsWith("<?", lt)) {
      const close = xml.indexOf("?>", lt + 2);
      if (close < 0) return;
      i = close + 2;
    } else if (xml.startsWith("<!", lt)) {
      let depth = 0;
      let j = lt + 2;
      for (; j < xml.length; j++) {
        const ch = xml[j];
        if (ch === "[") depth++;
        else if (ch === "]") depth--;
        else if (ch === ">" && depth <= 0) break;
      }
      i = j + 1;
    } else if (xml[lt + 1] === "/") {
      const close = xml.indexOf(">", lt + 2);
      if (close < 0) return;
      visitor.close(xml.slice(lt + 2, close).trim());
      i = close + 1;
    } else {
      // A start tag ends at the first `>` outside a quoted attribute value.
      let j = lt + 1;
      let quote = "";
      for (; j < xml.length; j++) {
        const ch = xml[j]!;
        if (quote) {
          if (ch === quote) quote = "";
        } else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === ">") break;
      }
      if (j >= xml.length) return;
      const body = xml.slice(lt + 1, j);
      const selfClosing = body.endsWith("/");
      const inner = selfClosing ? body.slice(0, -1) : body;
      const nameEnd = inner.search(/[\s]/);
      const name = nameEnd < 0 ? inner : inner.slice(0, nameEnd);
      const attrs = new Map<string, string>();
      if (nameEnd >= 0) {
        for (const m of inner.slice(nameEnd).matchAll(ATTRIBUTE)) attrs.set(m[1]!, decodeXml(m[2] ?? m[3] ?? ""));
      }
      visitor.open(name, attrs, selfClosing);
      if (selfClosing) visitor.close(name);
      i = j + 1;
    }
  }
}
