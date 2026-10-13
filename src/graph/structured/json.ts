/**
 * JSON, JSONC and JSONL: object keys as `key` nodes, parsed by the bundled grammar.
 *
 * Responsible for: walking the parse tree to dotted key paths with exact line
 * spans (`bewhole.upload.maxBodyBytes`, `files[0].name`) and handing them to the
 * shared emitter, which applies the depth cap, the size cap and the secret rule.
 *
 * Deliberately does not: validate JSON, or index array contents in general. An
 * array contributes an index only when its elements are objects that carry a
 * `name`, `id` or `key` field, because those are the elements a reader looks up
 * by name (a workflow step, a project reference); `[3]` alone names nothing.
 *
 * The one non-obvious thing: the grammar accepts comments and recovers around a
 * trailing comma, so JSONC (tsconfig, VS Code settings) parses with the same
 * grammar and needs no separate path. JSONL is indexed from its first non-blank
 * record only; later records repeat the same keys.
 */
import { parseWasm, type TsNode } from "../generic.js";
import type { ExtractResult } from "../extract.js";
import {
  IDENTIFYING_FIELDS,
  MAX_KEY_DEPTH,
  emitKeys,
  endRowOf,
  joinKey,
  ownerAt,
  splitLines,
  structuredFileNode,
  type KeyDraft,
} from "./shared.js";
import { commandEdges } from "./commands.js";

function childrenOf(node: TsNode): TsNode[] {
  const out: TsNode[] = [];
  for (let i = 0; i < (node.namedChildCount ?? 0); i++) {
    const c = node.namedChild?.(i);
    if (c && c.type !== "comment") out.push(c);
  }
  return out;
}

function decodeString(node: TsNode): string {
  try {
    const v: unknown = JSON.parse(node.text);
    if (typeof v === "string") return v;
  } catch {
    /* fall through to the raw text */
  }
  return node.text.replace(/^"|"$/g, "");
}

/** The decoded scalar of a leaf value node, or undefined for an object or array. */
function scalarOf(node: TsNode | null | undefined): string | undefined {
  if (!node) return undefined;
  if (node.type === "string") return decodeString(node);
  if (node.type === "number" || node.type === "true" || node.type === "false" || node.type === "null") return node.text;
  return undefined;
}

/** The value of an element's `name`, `id` or `key` field, when it has one. */
function identityOf(element: TsNode): string | undefined {
  for (const pair of childrenOf(element)) {
    if (pair.type !== "pair") continue;
    const k = pair.childForFieldName?.("key");
    if (k && IDENTIFYING_FIELDS.has(decodeString(k))) {
      const v = scalarOf(pair.childForFieldName?.("value"));
      if (v !== undefined && v !== "") return v;
    }
  }
  return undefined;
}

function walk(node: TsNode, parent: number, prefix: string, depth: number, rowBase: number, out: KeyDraft[]): void {
  if (node.type === "object") {
    for (const pair of childrenOf(node)) {
      if (pair.type !== "pair" || depth + 1 > MAX_KEY_DEPTH) continue;
      const keyNode = pair.childForFieldName?.("key");
      if (!keyNode) continue;
      const path = joinKey(prefix, decodeString(keyNode));
      const value = pair.childForFieldName?.("value");
      const idx = out.length;
      out.push({
        path,
        parent,
        depth: depth + 1,
        startRow: pair.startPosition.row + rowBase,
        endRow: endRowOf(pair) + rowBase,
        value: scalarOf(value),
      });
      if (value) walk(value, idx, path, depth + 1, rowBase, out);
    }
  } else if (node.type === "array") {
    childrenOf(node).forEach((element, i) => {
      if (element.type !== "object") return;
      const label = identityOf(element);
      if (label === undefined) return;
      const path = `${prefix}[${i}]`;
      const idx = out.length;
      out.push({
        path,
        parent,
        depth,
        startRow: element.startPosition.row + rowBase,
        endRow: endRowOf(element) + rowBase,
        label,
      });
      walk(element, idx, path, depth, rowBase, out);
    });
  }
}

/** Keys for one JSON-family document. `language` is the warmed `json` grammar, or
 * undefined when it is unavailable (the file then yields its file node only). */
export function extractJson(rel: string, source: string, language: unknown | undefined, jsonl: boolean): ExtractResult {
  const lines = splitLines(source);
  const file = structuredFileNode(rel, source);
  if (!language) return { nodes: [file], rawEdges: [] };

  // JSONL: the first non-blank line is the whole document. Rows are shifted back
  // by its index so spans still point at the host file.
  let text = source.replace(/^﻿/, "");
  let rowBase = 0;
  if (jsonl) {
    rowBase = Math.max(0, lines.findIndex((l) => l.trim() !== ""));
    text = lines[rowBase] ?? "";
  }

  const root = parseWasm(language, text);
  const drafts: KeyDraft[] = [];
  if (root) {
    const top = childrenOf(root).find((n) => n.type === "object" || n.type === "array");
    if (top) walk(top, -1, "", 0, rowBase, drafts);
  }
  const { nodes, rawEdges } = emitKeys(rel, lines, drafts);
  // A package.json script is a command line: what it runs is a reference from it.
  if (rel.split("/").pop() === "package.json") {
    for (const d of drafts) {
      if (d.depth !== 2 || d.value === undefined || !/^scripts(?:\.|\[)/.test(d.path)) continue;
      rawEdges.push(...commandEdges(rel, d.value, () => ownerAt(nodes, d.startRow, rel)));
    }
  }
  return { nodes: [file, ...nodes], rawEdges };
}
