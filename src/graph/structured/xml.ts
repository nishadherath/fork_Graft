/**
 * XML scanner: Android resources and manifests, Maven poms, property lists and
 * Interface Builder files as `element` and `key` nodes with exact line spans.
 *
 * Responsible for: reading well-formed XML into a light element tree (tags,
 * attributes, direct text, first and last row), then applying one of four rules by
 * the document's shape. Generic XML (Android layouts, manifests, `strings.xml`):
 * an `element` per element with an `android:id`, `id` or `name` attribute. Maven
 * (root `<project>`): an `element` per dependency, plugin, parent, module and
 * profile, named by its coordinates. Property list (root `<plist>`): a `key` per
 * `<key>` with its dotted path and scalar value, through the shared key emitter.
 * Storyboards and xibs: an `element` per scene and controller only, never the
 * whole view tree.
 *
 * Deliberately a scanner, not a parser: the grammar bundled for XML crashes on
 * every input on this runtime ("memory access out of bounds"), and XML is regular
 * enough for an exact scanner (decision D2 allows one). It does not validate,
 * expand entities beyond the five predefined, or resolve namespaces; input it
 * cannot read yields fewer units, never a wrong span.
 *
 * The one non-obvious thing: an element's last row is the row of the `>` that
 * closes its end tag (or its self-closing tag), found from the text, so a void-like
 * `<item/>` followed by blank lines never claims them.
 */
import type { ExtractResult } from "../extract.js";
import {
  emitKeys,
  emitUnits,
  splitLines,
  structuredFileNode,
  type KeyDraft,
  type UnitDraft,
} from "./shared.js";

interface Element {
  tag: string;
  attrs: Map<string, string>;
  startRow: number;
  endRow: number;
  /** Concatenated direct text, entities decoded, whitespace collapsed. */
  text: string;
  children: Element[];
}

/** Tags a storyboard or xib contributes. The rest of the view tree names nothing a
 * reader looks up and would be thousands of opaque ids. */
const INTERFACE_UNITS: ReadonlySet<string> = new Set([
  "scene",
  "viewController",
  "navigationController",
  "tabBarController",
  "tableViewController",
  "collectionViewController",
  "placeholder",
]);

/** Maven elements named by coordinates. */
const MAVEN_COORDINATES: ReadonlySet<string> = new Set(["dependency", "plugin", "parent", "extension"]);

/** Longest signature kept for an element's opening tag. */
const MAX_SIGNATURE_CHARS = 120;

const ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ENTITIES[e] ?? "");
}

/** The element tree of `text`, or null when it has no root element. */
function parseXml(text: string): Element | null {
  const lineStarts: number[] = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") lineStarts.push(i + 1);
  const rowOf = (index: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid]! <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const stack: Element[] = [];
  let root: Element | null = null;
  let i = 0;

  while (i < text.length) {
    const lt = text.indexOf("<", i);
    const chunk = text.slice(i, lt < 0 ? text.length : lt);
    if (chunk.trim() !== "" && stack.length > 0) {
      const top = stack[stack.length - 1]!;
      top.text = `${top.text} ${decode(chunk)}`.replace(/\s+/g, " ").trim();
    }
    if (lt < 0) break;

    if (text.startsWith("<!--", lt)) {
      const end = text.indexOf("-->", lt + 4);
      i = end < 0 ? text.length : end + 3;
    } else if (text.startsWith("<![CDATA[", lt)) {
      const end = text.indexOf("]]>", lt + 9);
      const body = text.slice(lt + 9, end < 0 ? text.length : end);
      const top = stack[stack.length - 1];
      if (top) top.text = `${top.text} ${body}`.replace(/\s+/g, " ").trim();
      i = end < 0 ? text.length : end + 3;
    } else if (text.startsWith("<?", lt)) {
      const end = text.indexOf("?>", lt + 2);
      i = end < 0 ? text.length : end + 2;
    } else if (text.startsWith("<!", lt)) {
      // DOCTYPE, possibly with an internal subset in [ ].
      let depth = 0;
      let j = lt + 2;
      for (; j < text.length; j++) {
        const ch = text[j];
        if (ch === "[") depth++;
        else if (ch === "]") depth--;
        else if (ch === ">" && depth <= 0) break;
      }
      i = j + 1;
    } else if (text.startsWith("</", lt)) {
      const end = text.indexOf(">", lt);
      const name = text.slice(lt + 2, end < 0 ? text.length : end).trim();
      const at = stack.map((e) => e.tag).lastIndexOf(name);
      if (at >= 0) {
        const closing = end < 0 ? text.length - 1 : end;
        for (let k = stack.length - 1; k >= at; k--) stack[k]!.endRow = rowOf(closing);
        stack.length = at;
      }
      i = end < 0 ? text.length : end + 1;
    } else {
      const m = /^<([^\s/>]+)/.exec(text.slice(lt, lt + 200));
      if (!m) {
        i = lt + 1;
        continue;
      }
      // Scan the attributes up to the closing '>', honouring quotes.
      let j = lt + m[0].length;
      let quote = "";
      for (; j < text.length; j++) {
        const ch = text[j]!;
        if (quote) {
          if (ch === quote) quote = "";
        } else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === ">") break;
      }
      const raw = text.slice(lt + m[0].length, j);
      const selfClosing = raw.trimEnd().endsWith("/");
      const attrs = new Map<string, string>();
      for (const a of raw.matchAll(/([^\s=/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        attrs.set(a[1]!, decode(a[2] ?? a[3] ?? ""));
      }
      const el: Element = { tag: m[1]!, attrs, startRow: rowOf(lt), endRow: rowOf(Math.min(j, text.length - 1)), text: "", children: [] };
      const parent = stack[stack.length - 1];
      if (parent) parent.children.push(el);
      else if (!root) root = el;
      if (!selfClosing) stack.push(el);
      i = j + 1;
    }
  }
  // Unclosed elements end where the input does.
  for (const el of stack) el.endRow = rowOf(Math.max(0, text.length - 1));
  return root;
}

function openingTag(lines: readonly string[], el: Element): string {
  return (lines[el.startRow] ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_SIGNATURE_CHARS);
}

function idValue(raw: string): string {
  return raw.replace(/^@\+?(?:android:)?id\//, "");
}

/** Generic rule: an `android:id`, `id` or `name` attribute makes an element findable. */
function genericDrafts(root: Element, lines: readonly string[], interfaceBuilder: boolean): UnitDraft[] {
  const out: UnitDraft[] = [];
  const visit = (el: Element, parent: number): void => {
    let idx = parent;
    let label = "";
    if (interfaceBuilder) {
      const id = el.attrs.get("storyboardIdentifier") ?? el.attrs.get("id") ?? el.attrs.get("sceneID");
      if (INTERFACE_UNITS.has(el.tag) && id) label = `${el.tag}#${id}`;
    } else {
      const id = el.attrs.get("android:id") ?? el.attrs.get("id") ?? el.attrs.get("xml:id");
      const name = el.attrs.get("android:name") ?? el.attrs.get("name");
      if (id) label = `${el.tag}#${idValue(id)}`;
      else if (name) label = `${el.tag}[name=${name}]`;
    }
    if (label !== "") {
      idx = out.length;
      out.push({
        kind: "element",
        name: label,
        parent,
        startRow: el.startRow,
        endRow: el.endRow,
        signature: openingTag(lines, el),
        bodyText: el.children.length === 0 ? el.text : undefined,
      });
    }
    for (const c of el.children) visit(c, idx);
  };
  visit(root, -1);
  return out;
}

/** Maven rule: coordinates name dependencies, plugins, the parent, modules, profiles. */
function mavenDrafts(root: Element): UnitDraft[] {
  const out: UnitDraft[] = [];
  const child = (el: Element, tag: string): string => el.children.find((c) => c.tag === tag)?.text ?? "";
  const visit = (el: Element, parent: number): void => {
    let idx = parent;
    let label = "";
    if (MAVEN_COORDINATES.has(el.tag)) {
      const artifact = child(el, "artifactId");
      if (artifact) label = `${el.tag}:${[child(el, "groupId"), artifact].filter(Boolean).join(":")}`;
    } else if (el.tag === "module" && el.text) label = `module:${el.text}`;
    else if (el.tag === "profile" && child(el, "id")) label = `profile:${child(el, "id")}`;
    if (label !== "") {
      idx = out.length;
      const version = child(el, "version");
      out.push({
        kind: "element",
        name: label,
        parent,
        startRow: el.startRow,
        endRow: el.endRow,
        signature: version ? `${label}:${version}` : label,
        bodyText: version || undefined,
      });
    }
    for (const c of el.children) visit(c, idx);
  };
  visit(root, -1);
  return out;
}

/** Property list rule: `<key>` elements, in dotted paths through nested dicts. */
function plistKeys(root: Element): KeyDraft[] {
  const out: KeyDraft[] = [];
  const scalarTags = new Set(["string", "integer", "real", "date", "true", "false"]);
  const visitDict = (dict: Element, parent: number, prefix: string, depth: number): void => {
    for (let i = 0; i < dict.children.length; i++) {
      const key = dict.children[i]!;
      if (key.tag !== "key" || key.text === "") continue;
      const value = dict.children[i + 1];
      if (!value || depth + 1 > 4) continue;
      const path = prefix === "" ? key.text : `${prefix}.${key.text}`;
      const idx = out.length;
      const scalar = scalarTags.has(value.tag) ? (value.tag === "true" || value.tag === "false" ? value.tag : value.text) : undefined;
      out.push({ path, parent, depth: depth + 1, startRow: key.startRow, endRow: value.endRow, value: scalar });
      if (value.tag === "dict") visitDict(value, idx, path, depth + 1);
    }
  };
  const top = root.children.find((c) => c.tag === "dict");
  if (top) visitDict(top, -1, "", 0);
  return out;
}

export function extractXml(rel: string, source: string): ExtractResult {
  const file = structuredFileNode(rel, source);
  const lines = splitLines(source);
  const root = parseXml(source.replace(/^﻿/, ""));
  if (!root) return { nodes: [file], rawEdges: [] };

  if (root.tag === "plist") {
    const { nodes, rawEdges } = emitKeys(rel, lines, plistKeys(root));
    return { nodes: [file, ...nodes], rawEdges };
  }
  const drafts =
    root.tag === "project"
      ? mavenDrafts(root)
      : genericDrafts(root, lines, /\.(?:storyboard|xib)$/i.test(rel));
  const { nodes, rawEdges } = emitUnits(rel, lines, drafts);
  return { nodes: [file, ...nodes], rawEdges };
}
