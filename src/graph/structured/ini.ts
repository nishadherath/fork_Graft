/**
 * INI: sections and settings as `key` nodes, parsed by the bundled grammar.
 *
 * Responsible for: mapping `[section]` and `name = value` to dotted key paths
 * (`core.name`) with exact line spans, via the shared emitter (depth cap, size
 * cap, secret rule). Covers .ini and .cfg files such as setup.cfg and php.ini.
 *
 * Deliberately does not: read `name: value` lines (the bundled grammar accepts
 * `=` only, and a colon line comes back as an error node that is skipped, never
 * guessed at), join continuation lines, or strip inline comments from a value.
 *
 * The one non-obvious thing: INI dialects differ on inline comments and
 * continuations, so the value stored is the raw text after `=`. That keeps the
 * span exact, and means a value with a trailing `; note` carries the note too.
 */
import { parseWasm, type TsNode } from "../generic.js";
import type { ExtractResult } from "../extract.js";
import { emitKeys, endRowOf, joinKey, splitLines, structuredFileNode, type KeyDraft } from "./shared.js";

function childrenOf(node: TsNode): TsNode[] {
  const out: TsNode[] = [];
  for (let i = 0; i < (node.namedChildCount ?? 0); i++) {
    const c = node.namedChild?.(i);
    if (c) out.push(c);
  }
  return out;
}

/** `name` and `value` of a setting node, or null when it has no name. */
function settingOf(setting: TsNode): { name: string; value: string | undefined } | null {
  let name: string | undefined;
  let value: string | undefined;
  for (const c of childrenOf(setting)) {
    if (c.type === "setting_name") name = c.text.trim();
    else if (c.type === "setting_value") value = c.text.trim();
  }
  return name ? { name, value } : null;
}

function sectionName(section: TsNode): string | null {
  const header = childrenOf(section).find((c) => c.type === "section_name");
  if (!header) return null;
  const text = childrenOf(header).find((c) => c.type === "text")?.text ?? header.text.replace(/^\s*\[|\]\s*$/g, "");
  return text.trim() === "" ? null : text.trim();
}

/** Keys for one INI file. `language` is the warmed `ini` grammar, or undefined when
 * it is unavailable (the file then yields its file node only). */
export function extractIni(rel: string, source: string, language: unknown | undefined): ExtractResult {
  const file = structuredFileNode(rel, source);
  if (!language) return { nodes: [file], rawEdges: [] };

  const root = parseWasm(language, source.replace(/^﻿/, ""));
  const drafts: KeyDraft[] = [];
  if (root) {
    for (const top of childrenOf(root)) {
      if (top.type === "setting") {
        const s = settingOf(top);
        if (s) {
          drafts.push({ path: joinKey("", s.name), parent: -1, depth: 1, startRow: top.startPosition.row, endRow: endRowOf(top), value: s.value });
        }
      } else if (top.type === "section") {
        const name = sectionName(top);
        if (!name) continue;
        const path = joinKey("", name);
        const idx = drafts.length;
        drafts.push({ path, parent: -1, depth: 1, startRow: top.startPosition.row, endRow: endRowOf(top) });
        for (const child of childrenOf(top)) {
          if (child.type !== "setting") continue;
          const s = settingOf(child);
          if (!s) continue;
          drafts.push({
            path: joinKey(path, s.name),
            parent: idx,
            depth: 2,
            startRow: child.startPosition.row,
            endRow: endRowOf(child),
            value: s.value,
          });
        }
      }
    }
  }
  const { nodes, rawEdges } = emitKeys(rel, splitLines(source), drafts);
  return { nodes: [file, ...nodes], rawEdges };
}
