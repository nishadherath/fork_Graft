/**
 * TOML scanner: tables and keys as `key` nodes with exact line spans.
 *
 * Responsible for: reading `[table]` and `[[array-of-tables]]` headers and
 * `key = value` lines (bare, quoted and dotted keys), following a value across
 * lines when it is a multi-line string, array or inline table, and handing key
 * drafts to the shared emitter, which applies the depth cap, the size cap and the
 * secret rule.
 *
 * Deliberately does not: validate TOML, interpret values (dates, numbers, escapes
 * beyond the common ones), or merge tables the file spells in two places. It is a
 * line scanner, not a parser (decision D2: no TOML grammar ships in the bundled
 * wasm set), so on input it cannot read it indexes fewer keys rather than a wrong
 * span.
 *
 * Non-obvious: a table's span ends at its last entry, not at the next header, so
 * the comment block that introduces the next table is not claimed by this one. An
 * array-of-tables element is indexed only when it has a `name`, `id` or `key`
 * entry, as in JSON and YAML, and an unnamed element's keys are not indexed.
 */
import type { ExtractResult } from "../extract.js";
import {
  IDENTIFYING_FIELDS,
  MAX_KEY_DEPTH,
  emitKeys,
  joinKey,
  splitLines,
  structuredFileNode,
  type KeyDraft,
} from "./shared.js";

/** One `key = value` entry inside a table block. */
interface Entry {
  segments: string[];
  startRow: number;
  endRow: number;
  value?: string;
}

/** A `[table]` or `[[array-of-tables]]` block, or the keys before the first header. */
interface Block {
  /** Header segments; empty for the root block. */
  segments: string[];
  array: boolean;
  headerRow: number;
  entries: Entry[];
}

/** The segments of a dotted TOML key at `text[from..]`, plus where it stopped.
 * Bare keys, basic-quoted and literal-quoted segments are understood; returns
 * null on anything else so the caller skips the line. */
function parseKey(text: string, from: number, stop: (ch: string) => boolean): { segments: string[]; end: number } | null {
  const segments: string[] = [];
  let i = from;
  for (;;) {
    while (text[i] === " " || text[i] === "\t") i++;
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      if (j >= text.length) return null;
      try {
        segments.push(JSON.parse(text.slice(i, j + 1)) as string);
      } catch {
        segments.push(text.slice(i + 1, j));
      }
      i = j + 1;
    } else if (ch === "'") {
      const j = text.indexOf("'", i + 1);
      if (j < 0) return null;
      segments.push(text.slice(i + 1, j));
      i = j + 1;
    } else {
      const m = /^[A-Za-z0-9_-]+/.exec(text.slice(i));
      if (!m) return null;
      segments.push(m[0]);
      i += m[0].length;
    }
    while (text[i] === " " || text[i] === "\t") i++;
    if (text[i] === ".") {
      i++;
      continue;
    }
    if (i >= text.length || stop(text[i]!)) return { segments, end: i };
    return null;
  }
}

/** Where the value that starts at `lines[row][col]` ends, following multi-line
 * strings, arrays and inline tables, and the scalar text when the value is a
 * string or a bare token. */
function scanValue(lines: readonly string[], row: number, col: number): { endRow: number; scalar?: string } {
  const first = lines[row]!.slice(col).trimStart();
  let scalar: string | undefined;
  if (first.startsWith('"""') || first.startsWith("'''")) {
    const quote = first.slice(0, 3);
    const literal = quote === "'''";
    let body = first.slice(3);
    let r = row;
    for (;;) {
      const close = literal ? body.indexOf(quote) : closingTriple(body);
      if (close >= 0) {
        scalar = (r === row ? body.slice(0, close) : collect(lines, row, r, first, body, close)).replace(/^\n/, "");
        return { endRow: r, scalar };
      }
      r++;
      if (r >= lines.length) return { endRow: lines.length - 1 };
      body = lines[r]!;
    }
  }
  if (first.startsWith('"') || first.startsWith("'")) {
    const q = first[0]!;
    let j = 1;
    while (j < first.length && first[j] !== q) j += q === '"' && first[j] === "\\" ? 2 : 1;
    const raw = first.slice(0, j + 1);
    if (q === '"') {
      try {
        scalar = JSON.parse(raw) as string;
      } catch {
        scalar = raw.slice(1, -1);
      }
    } else {
      scalar = raw.slice(1, -1);
    }
    return { endRow: row, scalar };
  }
  if (first.startsWith("[") || first.startsWith("{")) {
    let depth = 0;
    let r = row;
    let text = lines[r]!.slice(col);
    for (;;) {
      let inStr: string | null = null;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i]!;
        if (inStr) {
          if (inStr === '"' && ch === "\\") i++;
          else if (ch === inStr) inStr = null;
        } else if (ch === '"' || ch === "'") inStr = ch;
        else if (ch === "#") break;
        else if (ch === "[" || ch === "{") depth++;
        else if (ch === "]" || ch === "}") depth--;
      }
      if (depth <= 0 || r + 1 >= lines.length) return { endRow: r };
      r++;
      text = lines[r]!;
    }
  }
  const bare = first.replace(/\s+#.*$/, "").trim();
  return { endRow: row, scalar: bare === "" ? undefined : bare };
}

/** Index of an unescaped closing `"""` in `body`, or -1. Up to two extra quotes may
 * precede the closer (`""""`), which belong to the string. */
function closingTriple(body: string): number {
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\\") {
      i++;
      continue;
    }
    if (body.startsWith('"""', i)) {
      let j = i;
      while (body[j + 3] === '"' && j - i < 2) j++;
      return j;
    }
  }
  return -1;
}

/** The text of a multi-line string from its opening line to its closing row. */
function collect(lines: readonly string[], row: number, endRow: number, first: string, lastBody: string, close: number): string {
  const parts = [first.slice(3), ...lines.slice(row + 1, endRow), lastBody.slice(0, close)];
  return parts.join("\n");
}

function scan(lines: readonly string[]): Block[] {
  const blocks: Block[] = [{ segments: [], array: false, headerRow: -1, entries: [] }];
  let current = blocks[0]!;
  for (let row = 0; row < lines.length; row++) {
    const line = lines[row]!.replace(/^﻿/, "");
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("[")) {
      const array = trimmed.startsWith("[[");
      const open = line.indexOf("[") + (array ? 2 : 1);
      const key = parseKey(line, open, (c) => c === "]");
      if (key && key.segments.length > 0) {
        current = { segments: key.segments, array, headerRow: row, entries: [] };
        blocks.push(current);
      }
      continue;
    }

    const key = parseKey(line, 0, (c) => c === "=");
    if (!key || line[key.end] !== "=") continue;
    const value = scanValue(lines, row, key.end + 1);
    current.entries.push({ segments: key.segments, startRow: row, endRow: value.endRow, value: value.scalar });
    row = value.endRow;
  }
  return blocks;
}

function pathOf(segments: readonly string[], from = ""): string {
  let path = from;
  for (const seg of segments) path = joinKey(path, seg);
  return path;
}

/** Last row of a block that holds real content: its last entry, or its header. */
function lastRow(block: Block): number {
  const last = block.entries[block.entries.length - 1];
  return last ? last.endRow : block.headerRow;
}

export function extractToml(rel: string, source: string): ExtractResult {
  const lines = splitLines(source);
  const blocks = scan(lines);
  const drafts: KeyDraft[] = [];

  // Header path (as written) -> the draft emitted for it, so a later header can find
  // its nearest enclosing table. For an array of tables the entry is the LATEST
  // element, which is the one a following `[a.b]` sub-table belongs to.
  const known = new Map<string, { path: string; draft: number }>();
  const arrayCount = new Map<string, number>();
  // Headers of unnamed array elements: their sub-tables belong to nothing indexed.
  const dropped = new Set<string>();

  for (const block of blocks) {
    let base = "";
    let parent = -1;
    let depth = 0;

    if (block.segments.length > 0) {
      const written = pathOf(block.segments);
      // The nearest enclosing header already seen, found by dropping trailing segments.
      let path = written;
      let orphan = false;
      for (let n = block.segments.length - 1; n >= 1; n--) {
        const ancestor = pathOf(block.segments.slice(0, n));
        if (dropped.has(ancestor)) {
          orphan = true;
          break;
        }
        const anc = known.get(ancestor);
        if (anc) {
          parent = anc.draft;
          path = pathOf(block.segments.slice(n), anc.path);
          break;
        }
      }
      if (orphan) continue;
      let label: string | undefined;
      if (block.array) {
        const index = arrayCount.get(written) ?? 0;
        arrayCount.set(written, index + 1);
        const named = block.entries.find(
          (e) => e.segments.length === 1 && IDENTIFYING_FIELDS.has(e.segments[0]!) && e.value !== undefined && e.value !== "",
        );
        if (!named) {
          known.delete(written); // an unnamed element adds nothing, nor do its keys
          dropped.add(written);
          continue;
        }
        dropped.delete(written);
        label = named.value;
        path = `${path}[${index}]`;
      }
      depth = block.segments.length;
      if (depth > MAX_KEY_DEPTH) continue;
      const idx = drafts.length;
      drafts.push({
        path,
        parent,
        depth,
        startRow: block.headerRow,
        endRow: lastRow(block),
        ...(label !== undefined ? { label } : {}),
      });
      known.set(written, { path, draft: idx });
      base = path;
      parent = idx;
    }

    for (const e of block.entries) {
      const keyDepth = depth + e.segments.length;
      if (keyDepth > MAX_KEY_DEPTH) continue;
      drafts.push({ path: pathOf(e.segments, base), parent, depth: keyDepth, startRow: e.startRow, endRow: e.endRow, value: e.value });
    }
  }

  const { nodes, rawEdges } = emitKeys(rel, lines, drafts);
  return { nodes: [structuredFileNode(rel, source), ...nodes], rawEdges };
}
