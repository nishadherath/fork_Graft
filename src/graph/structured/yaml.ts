/**
 * YAML: mapping keys as `key` nodes, parsed by the bundled grammar.
 *
 * Responsible for: walking the parse tree to dotted key paths with exact line
 * spans (`jobs.verify.runs-on`, `steps[1].run`) and handing them to the shared
 * emitter, which applies the depth cap, the size cap and the secret rule. The
 * same walker reads the front matter of a Markdown file (`yamlKeyDrafts`).
 *
 * Deliberately does not: resolve anchors, aliases or merge keys (`<<: *base`
 * adds no key), interpret tags, or index sequences in general. As in JSON, a
 * sequence contributes an index only for mapping elements that carry a `name`,
 * `id` or `key` field, so a workflow's named steps are addressable and a list of
 * bare strings is not.
 *
 * The one non-obvious thing: a multi-document file (`---` separators) indexes the
 * first document at the root and prefixes the rest `doc2.`, `doc3.`, so a key in
 * the second document cannot be mistaken for one in the first.
 */
import { parseWasm, type TsNode } from "../generic.js";
import type { ExtractResult } from "../extract.js";
import { commandEdges } from "./commands.js";
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

const SCALAR_TYPES = new Set(["plain_scalar", "double_quote_scalar", "single_quote_scalar"]);
const PAIR_TYPES = new Set(["block_mapping_pair", "flow_pair"]);

function namedChildren(node: TsNode): TsNode[] {
  const out: TsNode[] = [];
  for (let i = 0; i < (node.namedChildCount ?? 0); i++) {
    const c = node.namedChild?.(i);
    if (c && c.type !== "comment") out.push(c);
  }
  return out;
}

function decodeQuoted(node: TsNode): string {
  if (node.type === "double_quote_scalar") {
    try {
      const v: unknown = JSON.parse(node.text);
      if (typeof v === "string") return v;
    } catch {
      /* YAML escapes JSON does not know: fall through to the raw text */
    }
    return node.text.replace(/^"|"$/g, "");
  }
  if (node.type === "single_quote_scalar") return node.text.replace(/^'|'$/g, "").replace(/''/g, "'");
  return node.text;
}

/** The decoded scalar of a value node, or undefined for a mapping, sequence or alias. */
function scalarOf(node: TsNode | null | undefined): string | undefined {
  if (!node) return undefined;
  if (SCALAR_TYPES.has(node.type)) return decodeQuoted(node);
  if (node.type === "block_scalar") {
    const nl = node.text.indexOf("\n");
    return nl < 0 ? "" : node.text.slice(nl + 1);
  }
  if (node.type === "flow_node" || node.type === "block_node") {
    for (const c of namedChildren(node)) {
      if (c.type === "alias" || c.type === "anchor" || c.type === "tag") continue;
      const v = scalarOf(c);
      if (v !== undefined) return v;
    }
  }
  return undefined;
}

/** The mapping inside a sequence item or a value, looking through the wrapper nodes. */
function mappingOf(node: TsNode): TsNode | null {
  if (node.type === "block_mapping" || node.type === "flow_mapping") return node;
  if (node.type === "block_node" || node.type === "flow_node" || node.type === "block_sequence_item") {
    for (const c of namedChildren(node)) {
      const m = mappingOf(c);
      if (m) return m;
    }
  }
  return null;
}

function identityOf(mapping: TsNode): string | undefined {
  for (const pair of namedChildren(mapping)) {
    if (!PAIR_TYPES.has(pair.type)) continue;
    const key = scalarOf(pair.childForFieldName?.("key"));
    if (key !== undefined && IDENTIFYING_FIELDS.has(key)) {
      const v = scalarOf(pair.childForFieldName?.("value"))?.trim();
      if (v) return v;
    }
  }
  return undefined;
}

function descend(node: TsNode, parent: number, prefix: string, depth: number, rowBase: number, out: KeyDraft[]): void {
  switch (node.type) {
    case "block_mapping":
    case "flow_mapping":
      for (const pair of namedChildren(node)) {
        if (!PAIR_TYPES.has(pair.type) || depth + 1 > MAX_KEY_DEPTH) continue;
        const key = scalarOf(pair.childForFieldName?.("key"));
        // `<<` is a merge, not a name; a missing key is a complex `? key` entry.
        if (key === undefined || key === "" || key === "<<") continue;
        const path = joinKey(prefix, key);
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
        if (value) descend(value, idx, path, depth + 1, rowBase, out);
      }
      break;
    case "block_sequence":
    case "flow_sequence":
      namedChildren(node).forEach((item, i) => {
        const mapping = mappingOf(item);
        const label = mapping ? identityOf(mapping) : undefined;
        if (!mapping || label === undefined) return;
        const path = `${prefix}[${i}]`;
        const idx = out.length;
        out.push({
          path,
          parent,
          depth,
          startRow: item.startPosition.row + rowBase,
          endRow: endRowOf(item) + rowBase,
          label,
        });
        descend(mapping, idx, path, depth, rowBase, out);
      });
      break;
    case "block_node":
    case "flow_node":
    case "document":
      for (const c of namedChildren(node)) descend(c, parent, prefix, depth, rowBase, out);
      break;
    default:
      break;
  }
}

/** Key drafts for a YAML text. `rowBase` is the number of host rows above its first
 * line, so a Markdown front matter block reports rows in the Markdown file. */
export function yamlKeyDrafts(language: unknown, text: string, rowBase = 0): KeyDraft[] {
  const root = parseWasm(language, text.replace(/^﻿/, ""));
  const drafts: KeyDraft[] = [];
  if (!root) return drafts;
  let docNumber = 0;
  for (const doc of namedChildren(root)) {
    if (doc.type !== "document") continue;
    docNumber++;
    descend(doc, -1, docNumber === 1 ? "" : `doc${docNumber}`, 0, rowBase, drafts);
  }
  return drafts;
}

/** Every scalar `run:` in a YAML text (a CI step's commands), with the 0-based row
 * of its key. Unnamed steps count too, though the key emitter skips them. A step
 * with its own `working-directory` is left out, and a `defaults.run` with one
 * empties the list, because the commands then run somewhere the text does not
 * resolve against. */
export function yamlRunCommands(language: unknown, text: string): Array<{ row: number; value: string }> {
  const root = parseWasm(language, text.replace(/^﻿/, ""));
  if (!root) return [];
  const out: Array<{ row: number; value: string }> = [];
  let elsewhere = false;
  const keyOf = (pair: TsNode): string | undefined => scalarOf(pair.childForFieldName?.("key"));
  const visit = (node: TsNode): void => {
    if (node.type === "block_mapping" || node.type === "flow_mapping") {
      const pairs = namedChildren(node).filter((p) => PAIR_TYPES.has(p.type));
      const ownDirectory = pairs.some((p) => keyOf(p) === "working-directory");
      for (const pair of pairs) {
        if (keyOf(pair) !== "run") continue;
        const value = pair.childForFieldName?.("value");
        const command = scalarOf(value);
        if (command !== undefined) {
          if (!ownDirectory) out.push({ row: pair.startPosition.row, value: command });
        } else if (value && mappingOf(value) && namedChildren(mappingOf(value)!).some((p) => PAIR_TYPES.has(p.type) && keyOf(p) === "working-directory")) {
          elsewhere = true; // defaults: run: working-directory: x
        }
      }
    }
    for (const c of namedChildren(node)) visit(c);
  };
  visit(root);
  return elsewhere ? [] : out;
}

/** Keys for one YAML file. `language` is the warmed `yaml` grammar, or undefined
 * when it is unavailable (the file then yields its file node only). Each `run:`
 * also yields the script and file references its commands make. */
export function extractYaml(rel: string, source: string, language: unknown | undefined): ExtractResult {
  const file = structuredFileNode(rel, source);
  if (!language) return { nodes: [file], rawEdges: [] };
  const { nodes, rawEdges } = emitKeys(rel, splitLines(source), yamlKeyDrafts(language, source));
  for (const run of yamlRunCommands(language, source)) {
    rawEdges.push(...commandEdges(rel, run.value, () => ownerAt(nodes, run.row, rel)));
  }
  return { nodes: [file, ...nodes], rawEdges };
}
