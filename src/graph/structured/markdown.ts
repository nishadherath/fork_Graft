/**
 * Markdown scanner: headings become `section` nodes with exact line spans.
 *
 * Responsible for: finding every ATX and setext heading outside code, comments
 * and front matter, nesting them by level, and emitting one `section` per heading
 * with its span, slug id, signature and own text. It also reports the tagged
 * fenced code blocks it passed (`scanMarkdown().fences`) for the embedded-code
 * pass in `fences.ts`.
 *
 * Deliberately does not: render Markdown, resolve links, or recognise headings
 * inside block quotes and list items (those are content of another block, not a
 * navigable section). It is a line scanner, not a CommonMark parser, so where the
 * two could disagree it errs toward emitting fewer headings (it does track raw
 * HTML blocks, whose lines are never headings): a missed heading
 * only lengthens the section above it, whereas an invented one is a wrong locator.
 *
 * The non-obvious part is what ends a section: the line before the next heading
 * of equal or higher level, so a section's span includes its sub-sections. Its
 * `body_text` is narrower, its own text up to the next heading of ANY level,
 * because the children have nodes of their own and a parent that repeated them
 * would rank for every query about its subtree.
 */
import { contentHash } from "../../util/id.js";
import { extractEmbedded } from "../container.js";
import { languageOf, mintId, type ExtractResult, type Language, type RawEdge } from "../extract.js";
import type { NodeV1 } from "../types.js";
import { MAX_BODY_TEXT_CHARS, emitKeys, spanOf, splitLines, structuredFileNode } from "./shared.js";
import { yamlKeyDrafts } from "./yaml.js";

/** One heading: its 0-based first line (the paragraph's first line for a setext
 * heading), level 1 to 6, and plain text with inline markup removed. */
export interface Heading {
  line: number;
  level: number;
  text: string;
}

/** A fenced code block with an info string. `firstLine` is the 0-based line of
 * the first content line, `endLine` the 0-based line one past the last content
 * line (the closing fence, or the end of the document when it is unclosed). */
export interface Fence {
  lang: string;
  firstLine: number;
  endLine: number;
}

export interface MarkdownScan {
  lines: string[];
  headings: Heading[];
  fences: Fence[];
  /** 0-based line one past the front matter, or 0 when there is none. */
  frontMatterEnd: number;
}

const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/;
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const BACKTICK_FENCE = /^\s*(`{3,})([^`]*)$/;
const TILDE_FENCE = /^\s*(~{3,})(.*)$/;
const COMMENT_OPEN = /^ {0,3}<!--/;
const LIST_MARKER = /^ {0,3}(?:[-+*]|\d{1,9}[.)])(?:[ \t]|$)/;

/** HTML block start conditions 1, 3, 4, 5, 6 and 7 of CommonMark: the opener, and
 * for the first four the pattern that ends the block (6 and 7 end at a blank line;
 * 7, a lone tag, cannot interrupt a paragraph). Type 2, the comment, is handled
 * apart in the scan loop because it predates this table. */
const HTML_BLOCK_TAGS =
  "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|" +
  "fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|" +
  "menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|" +
  "track|ul";
const HTML_BLOCK_STARTS: ReadonlyArray<{ open: RegExp; close: RegExp | null; interrupts: boolean }> = [
  { open: /^ {0,3}<(?:script|pre|style|textarea)(?:[ \t>]|$)/i, close: /<\/(?:script|pre|style|textarea)>/i, interrupts: true },
  { open: /^ {0,3}<\?/, close: /\?>/, interrupts: true },
  { open: /^ {0,3}<![A-Za-z]/, close: />/, interrupts: true },
  { open: /^ {0,3}<!\[CDATA\[/, close: /\]\]>/, interrupts: true },
  { open: new RegExp(`^ {0,3}</?(?:${HTML_BLOCK_TAGS})(?:[ \\t]|/?>|$)`, "i"), close: null, interrupts: true },
  {
    open: /^ {0,3}(?:<[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][\w.:-]*(?:\s*=\s*(?:[^\s"'=<>`]+|'[^']*'|"[^"]*"))?)*\s*\/?>|<\/[A-Za-z][A-Za-z0-9-]*\s*>)[ \t]*$/,
    close: null,
    interrupts: false,
  },
];

/** The HTML block a line opens, or null. `inParagraph` is true while a plain
 * paragraph is in progress, which a lone tag (type 7) cannot interrupt. */
function htmlBlockStart(line: string, inParagraph: boolean): { close: RegExp | null } | null {
  for (const start of HTML_BLOCK_STARTS) {
    if (start.open.test(line) && (start.interrupts || !inParagraph)) return { close: start.close };
  }
  return null;
}

/** A paragraph that could be the text of a setext heading: not indented code, a
 * block quote, a list item, a table row or an HTML block. */
function isPlainParagraphLine(line: string): boolean {
  if (/^(?: {4}|\t)/.test(line)) return false;
  if (/^\s{0,3}>/.test(line) || LIST_MARKER.test(line)) return false;
  return !/^\s{0,3}[|<]/.test(line);
}

/** Info-string spellings that are not a file extension, mapped to the extension
 * the depth tier is keyed by. Anything else is tried as an extension (`ts`, `py`,
 * `go`, `kt`, `jsx`), so a tag the depth tier does not parse stays plain text. */
const FENCE_TAG_EXTENSIONS: Readonly<Record<string, string>> = {
  typescript: "ts",
  javascript: "js",
  python: "py",
  golang: "go",
  kotlin: "kt",
};

function fenceLanguage(tag: string): Language | null {
  const t = tag.toLowerCase();
  return languageOf(`x.${FENCE_TAG_EXTENSIONS[t] ?? t}`);
}

/** Heading text as a reader sees it: links, images, code spans, emphasis, HTML
 * tags and backslash escapes reduced to their words. */
function plainText(raw: string): string {
  return raw
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/!?\[([^\]]*)\]\[[^\]]*\]/g, "$1")
    .replace(/(`+)([^`]+?)\1/g, "$2")
    .replace(/<[^>]+>/g, "")
    .replace(/\*+/g, "")
    .replace(/(?<![\p{L}\p{N}])_{1,3}([^_]+?)_{1,3}(?![\p{L}\p{N}])/gu, "$1")
    .replace(/\\([!-/:-@[-`{-~])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** GitHub-style anchor slug: lower case, punctuation dropped, spaces to hyphens.
 * Never empty: a heading with no letters or digits slugs to `section`. */
export function slugOf(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}_ -]/gu, "")
    .trim()
    .replace(/ /g, "-");
  return slug === "" ? "section" : slug;
}

export function scanMarkdown(source: string): MarkdownScan {
  const lines = splitLines(source);
  const headings: Heading[] = [];
  const fences: Fence[] = [];

  // Front matter: `---` on line 1 (after an optional byte order mark) up to the
  // next `---` or `...`. Without a closer it is an ordinary thematic break.
  let frontMatterEnd = 0;
  if (/^﻿?---[ \t]*$/.test(lines[0] ?? "")) {
    for (let j = 1; j < lines.length; j++) {
      if (/^(?:---|\.\.\.)[ \t]*$/.test(lines[j]!)) {
        frontMatterEnd = j + 1;
        break;
      }
    }
  }

  // Paragraph state: null = between blocks, a number = the first line of a plain
  // paragraph in progress, -1 = inside some other block (so an underline is a
  // thematic break or content, never a setext marker).
  let para: number | null = null;
  let fence: { char: string; length: number; lang: string; firstLine: number } | null = null;
  let inComment = false;
  // Inside a raw HTML block: `close` ends it on a matching line, null ends it at
  // the next blank line. Either way no heading, fence or underline is recognised.
  let html: { close: RegExp | null } | null = null;

  for (let i = frontMatterEnd; i < lines.length; i++) {
    const line = lines[i]!;

    if (html) {
      if (html.close ? html.close.test(line) : /^\s*$/.test(line)) {
        html = null;
        para = null;
      }
      continue;
    }
    if (fence) {
      const close = new RegExp(`^\\s*${fence.char === "`" ? "`" : "~"}{${fence.length},}\\s*$`);
      if (close.test(line)) {
        if (fence.lang) fences.push({ lang: fence.lang, firstLine: fence.firstLine, endLine: i });
        fence = null;
      }
      continue;
    }
    if (inComment) {
      if (line.includes("-->")) inComment = false;
      continue;
    }
    if (/^\s*$/.test(line)) {
      para = null;
      continue;
    }

    const open = BACKTICK_FENCE.exec(line) ?? TILDE_FENCE.exec(line);
    if (open) {
      const info = (open[2] ?? "").trim();
      fence = { char: open[1]![0]!, length: open[1]!.length, lang: info.split(/\s+/)[0] ?? "", firstLine: i + 1 };
      para = null;
      continue;
    }
    if (COMMENT_OPEN.test(line)) {
      inComment = !line.includes("-->");
      para = null;
      continue;
    }

    const htmlStart = htmlBlockStart(line, para !== null && para >= 0);
    if (htmlStart) {
      // A closer on the opening line ends the block there (`<script>x()</script>`).
      if (htmlStart.close?.test(line)) para = null;
      else {
        html = htmlStart;
        para = -1;
      }
      continue;
    }

    const atx = ATX.exec(line);
    if (atx) {
      const text = plainText((atx[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").replace(/^#+[ \t]*$/, ""));
      headings.push({ line: i, level: atx[1]!.length, text });
      para = null;
      continue;
    }

    const underline = SETEXT_UNDERLINE.exec(line);
    if (underline && para !== null && para >= 0) {
      const text = plainText(lines.slice(para, i).join(" "));
      headings.push({ line: para, level: underline[1]![0] === "=" ? 1 : 2, text });
      para = null;
      continue;
    }
    if (THEMATIC_BREAK.test(line)) {
      para = null;
      continue;
    }

    if (para === null) para = isPlainParagraphLine(line) ? i : -1;
    else if (para >= 0 && !isPlainParagraphLine(line)) para = -1;
  }

  // An unclosed fence runs to the end of the document.
  if (fence?.lang) fences.push({ lang: fence.lang, firstLine: fence.firstLine, endLine: lines.length });
  return { lines, headings, fences, frontMatterEnd };
}

/** Sections for one Markdown document: a file node, a `key` per front matter key
 * (when the yaml grammar is available), a `section` per non-empty heading, and
 * `contains` edges from each section's parent (or the file). */
export function extractMarkdown(rel: string, source: string, yaml?: unknown): ExtractResult {
  const { lines, headings, fences, frontMatterEnd } = scanMarkdown(source);
  const minted = new Set<string>([rel]);
  const nodes: NodeV1[] = [];
  const rawEdges: RawEdge[] = [];

  const firstHeading = headings[0]?.line ?? lines.length;
  const preface = lines.slice(frontMatterEnd, firstHeading).join(" ").replace(/\s+/g, " ").trim();
  nodes.push(structuredFileNode(rel, source, preface ? preface.slice(0, MAX_BODY_TEXT_CHARS) : undefined));

  // Front matter is YAML between the first two `---` lines. Its rows are shifted
  // by one so a key reports its line in this file, not in the block.
  if (yaml && frontMatterEnd > 0) {
    const block = lines.slice(1, frontMatterEnd - 1).join("\n");
    const front = emitKeys(rel, lines, yamlKeyDrafts(yaml, block, 1));
    nodes.push(...front.nodes);
    rawEdges.push(...front.rawEdges);
  }

  const open: Array<{ level: number; id: string }> = [];
  const placed: Array<{ id: string; start: number; end: number }> = []; // 0-based lines
  headings.forEach((h, k) => {
    // A section ends before the next heading of equal or higher level. Empty
    // headings still count as boundaries; they just get no node.
    let end = lines.length - 1;
    for (let n = k + 1; n < headings.length; n++) {
      if (headings[n]!.level <= h.level) {
        end = headings[n]!.line - 1;
        break;
      }
    }
    const nextAny = k + 1 < headings.length ? headings[k + 1]!.line : lines.length;
    while (open.length > 0 && open[open.length - 1]!.level >= h.level) open.pop();
    if (h.text === "") return;

    const id = mintId(`${rel}#section:${slugOf(h.text)}`, minted);
    const whole = lines.slice(h.line, end + 1).join("\n");
    nodes.push({
      id,
      name: h.text,
      kind: "section",
      path: rel,
      span: spanOf(h.line + 1, end + 1),
      signature: `${"#".repeat(h.level)} ${h.text}`,
      exported: true,
      origin: "generic",
      body_hash: contentHash(whole),
      body_text: lines.slice(h.line, nextAny).join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_BODY_TEXT_CHARS),
      summary_state: "pending",
      summary: null,
      crux: null,
    });
    rawEdges.push({ source: open.length > 0 ? open[open.length - 1]!.id : rel, relation: "contains", targetId: id, file: rel });
    open.push({ level: h.level, id });
    placed.push({ id, start: h.line, end });
  });

  // Tagged fences the depth tier can parse. Only `contains` edges are kept: a
  // documentation sample that calls `greet()` or imports a module is not a
  // dependency of the real code, and an edge from README into src/ would claim
  // one. Top-level symbols hang off the innermost section containing the fence.
  for (const fence of fences) {
    const inner = fenceLanguage(fence.lang);
    if (!inner) continue;
    const script = lines.slice(fence.firstLine, fence.endLine).join("\n");
    const embedded = extractEmbedded(rel, script, inner, fence.firstLine, minted);
    if (!embedded) continue;
    let owner = rel;
    for (const s of placed) if (s.start <= fence.firstLine && fence.firstLine <= s.end) owner = s.id;
    nodes.push(...embedded.nodes);
    for (const e of embedded.rawEdges) {
      if (e.relation !== "contains") continue;
      rawEdges.push(e.source === rel ? { ...e, source: owner } : e);
    }
  }
  return { nodes, rawEdges };
}
