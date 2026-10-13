/**
 * CSS and SCSS: rules, at-rules, custom properties and Sass variables as
 * `selector` nodes, parsed by the bundled grammars.
 *
 * Responsible for: walking a stylesheet's parse tree to one unit per rule set
 * (named by its selector list), per block at-rule (`@media (min-width: 1px)`,
 * `@mixin m($a)`, `@function f($x)`, `@keyframes spin`), and per custom property
 * (`--gap`) or Sass variable (`$v`) declaration, with exact line spans. Nested
 * rules and rules inside an at-rule hang off their container.
 *
 * Deliberately does not: resolve cascade or specificity, expand Sass nesting
 * (`&:hover` is named as written), or index ordinary declarations. The same
 * walker serves a `<style>` block in HTML (`cssUnitDrafts` with a row offset).
 *
 * The one non-obvious thing: an at-rule is named by its text up to the `{`, so
 * `@media` blocks stay distinguishable from one another.
 */
import { parseWasm, type TsNode } from "../generic.js";
import type { ExtractResult } from "../extract.js";
import { emitUnits, endRowOf, splitLines, structuredFileNode, type UnitDraft } from "./shared.js";

/** Longest unit name kept; a selector list can run to hundreds of characters. */
const MAX_NAME_CHARS = 120;

function children(node: TsNode): TsNode[] {
  const out: TsNode[] = [];
  for (let i = 0; i < (node.namedChildCount ?? 0); i++) {
    const c = node.namedChild?.(i);
    if (c && c.type !== "comment") out.push(c);
  }
  return out;
}

function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_CHARS);
}

function walk(node: TsNode, parent: number, rowBase: number, out: UnitDraft[]): void {
  for (const child of children(node)) {
    const rows = { startRow: child.startPosition.row + rowBase, endRow: endRowOf(child) + rowBase };
    if (child.type === "rule_set") {
      const selectors = children(child).find((c) => c.type === "selectors");
      if (!selectors) continue;
      const name = tidy(selectors.text);
      if (name === "") continue;
      const idx = out.length;
      const block = children(child).find((c) => c.type === "block");
      out.push({ kind: "selector", name, parent, ...rows, bodyText: block?.text });
      if (block) walk(block, idx, rowBase, out);
    } else if (child.type === "declaration") {
      const prop = children(child).find((c) => c.type === "property_name")?.text ?? "";
      if (!prop.startsWith("--") && !prop.startsWith("$")) continue;
      const value = child.text.slice(child.text.indexOf(":") + 1).replace(/;\s*$/, "").trim();
      out.push({ kind: "selector", name: prop, parent, ...rows, signature: tidy(`${prop}: ${value}`), bodyText: value });
    } else if (child.type === "keyframes_statement") {
      const list = children(child).find((c) => c.type === "keyframe_block_list");
      const head = list ? child.text.slice(0, list.startIndex - child.startIndex) : child.text;
      out.push({ kind: "selector", name: tidy(head), parent, ...rows });
    } else if (child.type === "at_rule" || child.type.endsWith("_statement")) {
      const block = children(child).find((c) => c.type === "block");
      if (!block) continue; // @import, @include and friends carry no unit
      const name = tidy(child.text.slice(0, block.startIndex - child.startIndex));
      if (name === "") continue;
      const idx = out.length;
      out.push({ kind: "selector", name, parent, ...rows });
      walk(block, idx, rowBase, out);
    }
  }
}

/** Unit drafts for a stylesheet text. `rowBase` is the number of host rows above
 * its first line, so a `<style>` block reports rows in the HTML file. */
export function cssUnitDrafts(language: unknown, text: string, rowBase = 0): UnitDraft[] {
  const root = parseWasm(language, text.replace(/^﻿/, ""));
  const drafts: UnitDraft[] = [];
  if (root) walk(root, -1, rowBase, drafts);
  return drafts;
}

/** Units for one CSS or SCSS file. `language` is the warmed grammar, or undefined
 * when it is unavailable (the file then yields its file node only). */
export function extractCss(rel: string, source: string, language: unknown | undefined): ExtractResult {
  const file = structuredFileNode(rel, source);
  if (!language) return { nodes: [file], rawEdges: [] };
  const { nodes, rawEdges } = emitUnits(rel, splitLines(source), cssUnitDrafts(language, source));
  return { nodes: [file, ...nodes], rawEdges };
}
