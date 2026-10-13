/**
 * HTML, Svelte and Astro: elements worth finding by id or name, plus the code and
 * styles embedded in the page.
 *
 * Responsible for: one `element` node per HTML element that carries an `id` (or,
 * failing that, a `name`) attribute, nested by ancestry; the symbols of each
 * `<script>` block (and an Astro frontmatter block) through the depth tier via
 * `extractEmbedded`; and the rules of each `<style>` block through the CSS walker.
 * All spans are lines of the host file.
 *
 * Deliberately does not: index elements without an identifier (a page's `<div>`s
 * name nothing), run inline event-handler attributes, or follow `src`/`href` to
 * other files (that is a later stage's edge pass). A script that is not
 * JavaScript (`type="application/json"`, a `text/template`) is left as text.
 *
 * The one non-obvious thing: an element's tree-sitter node swallows the
 * whitespace after a void or unclosed tag (`<input>` ends a line later than it
 * reads), so an element's last row is taken from its closing tag, or else its
 * last child, never from the node's own end.
 */
import { parseWasm, type TsNode } from "../generic.js";
import { extractEmbedded } from "../container.js";
import type { ExtractResult } from "../extract.js";
import type { NodeV1 } from "../types.js";
import { cssUnitDrafts } from "./css.js";
import { emitUnits, splitLines, structuredFileNode, type UnitDraft } from "./shared.js";
import type { RawEdge } from "../extract.js";

/** Longest signature kept for an element's opening tag. */
const MAX_SIGNATURE_CHARS = 120;

/** A `<script>` whose `type` says it is code the depth tier can parse. */
const SCRIPT_TYPE = /^(?:module|text\/javascript|application\/javascript|text\/typescript|application\/typescript|text\/jsx|text\/tsx)$/i;

function kids(node: TsNode): TsNode[] {
  const out: TsNode[] = [];
  for (let i = 0; i < (node.namedChildCount ?? 0); i++) {
    const c = node.namedChild?.(i);
    if (c && c.type !== "comment") out.push(c);
  }
  return out;
}

/** The attribute `name` of a start tag, its unquoted value, or undefined. */
function attribute(startTag: TsNode, name: string): string | undefined {
  for (const a of kids(startTag)) {
    if (a.type !== "attribute") continue;
    const parts = kids(a);
    const key = parts.find((p) => p.type === "attribute_name");
    if (key?.text.toLowerCase() !== name) continue;
    const value = parts.find((p) => p.type === "quoted_attribute_value" || p.type === "attribute_value");
    return value ? value.text.replace(/^["']|["']$/g, "") : "";
  }
  return undefined;
}

/** Last row of an element: its end tag, else its last child, else its start tag. */
function lastRow(el: TsNode): number {
  const children = kids(el);
  const end = children.find((c) => c.type === "end_tag");
  if (end) return end.endPosition.row;
  const tail = [...children].reverse().find((c) => c.type !== "start_tag");
  if (!tail) return (children.find((c) => c.type === "start_tag") ?? el).endPosition.row;
  return tail.type === "element" ? lastRow(tail) : tail.endPosition.row;
}

interface Context {
  rel: string;
  lines: string[];
  css: unknown | undefined;
  minted: Set<string>;
  drafts: UnitDraft[];
  embedded: NodeV1[];
  embeddedEdges: RawEdge[];
}

function embed(ctx: Context, body: TsNode, owner: number): void {
  const script = body.text;
  const block = extractEmbedded(ctx.rel, script, "typescript", body.startPosition.row, ctx.minted);
  if (!block) return;
  ctx.embedded.push(...block.nodes);
  // Only structure survives: a page's inline script calling a function is not a
  // dependency of the real module of the same name.
  for (const e of block.rawEdges) if (e.relation === "contains") ctx.embeddedEdges.push({ ...e, source: e.source === ctx.rel ? `owner:${owner}` : e.source });
}

function walk(node: TsNode, parent: number, ctx: Context): void {
  for (const child of kids(node)) {
    if (child.type === "script_element") {
      const start = kids(child).find((c) => c.type === "start_tag");
      const body = kids(child).find((c) => c.type === "raw_text");
      const type = start ? attribute(start, "type") : undefined;
      if (body && (type === undefined || type === "" || SCRIPT_TYPE.test(type))) embed(ctx, body, parent);
    } else if (child.type === "style_element") {
      const body = kids(child).find((c) => c.type === "raw_text");
      if (body && ctx.css) {
        const base = ctx.drafts.length;
        for (const d of cssUnitDrafts(ctx.css, body.text, body.startPosition.row)) {
          ctx.drafts.push({ ...d, parent: d.parent >= 0 ? d.parent + base : parent });
        }
      }
    } else if (child.type === "frontmatter") {
      const body = kids(child).find((c) => c.type === "frontmatter_js_block");
      if (body) embed(ctx, body, parent);
    } else if (child.type === "element") {
      const start = kids(child).find((c) => c.type === "start_tag");
      const tag = start ? kids(start).find((c) => c.type === "tag_name")?.text.toLowerCase() : undefined;
      let idx = parent;
      if (start && tag) {
        const id = attribute(start, "id");
        const nameAttr = attribute(start, "name");
        const label = id ? `${tag}#${id}` : nameAttr ? `${tag}[name=${nameAttr}]` : "";
        if (label !== "") {
          idx = ctx.drafts.length;
          ctx.drafts.push({
            kind: "element",
            name: label,
            parent,
            startRow: child.startPosition.row,
            endRow: lastRow(child),
            signature: start.text.replace(/\s+/g, " ").trim().slice(0, MAX_SIGNATURE_CHARS),
            bodyText: child.text,
          });
        }
      }
      walk(child, idx, ctx);
    }
  }
}

/** Elements, embedded symbols and style rules for one HTML-family file. `grammar`
 * is the warmed grammar for the file's own language, `css` the stylesheet one. */
export function extractHtml(rel: string, source: string, grammar: unknown | undefined, css: unknown | undefined): ExtractResult {
  const file = structuredFileNode(rel, source);
  if (!grammar) return { nodes: [file], rawEdges: [] };
  const text = source.replace(/^﻿/, "");
  const root = parseWasm(grammar, text);
  if (!root) return { nodes: [file], rawEdges: [] };

  const lines = splitLines(source);
  const ctx: Context = { rel, lines, css, minted: new Set([rel]), drafts: [], embedded: [], embeddedEdges: [] };
  walk(root, -1, ctx);

  const units = emitUnits(rel, lines, ctx.drafts);
  // `emitUnits` ids are `rel#<kind>:<name>`; resolve the owner placeholders now
  // that every draft has its id (the i-th draft is the i-th node while under the cap).
  const idOfDraft = (i: number): string => units.nodes[i]?.id ?? rel;
  const embeddedEdges = ctx.embeddedEdges.map((e) => {
    const m = /^owner:(-?\d+)$/.exec(e.source);
    return m ? { ...e, source: Number(m[1]) >= 0 ? idOfDraft(Number(m[1])) : rel } : e;
  });
  return { nodes: [file, ...units.nodes, ...ctx.embedded], rawEdges: [...units.rawEdges, ...embeddedEdges] };
}
