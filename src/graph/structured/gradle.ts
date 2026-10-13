/**
 * Gradle (Groovy DSL) scanner: tasks, plugins and dependencies with exact spans.
 *
 * Responsible for: finding the tasks a `build.gradle` declares (`task name { }`,
 * `task(name)`, `tasks.register('name')`, `tasks.create`, `tasks.named`) as `task`
 * nodes, and the `plugins { }` and `dependencies { }` blocks with one `key` per
 * entry (`plugins.java`, `dependencies["implementation org.x:y"]`, value the full
 * coordinates). Only top-level statements are read.
 *
 * Deliberately does not: evaluate Groovy, follow `apply from:`, or index the rest
 * of the DSL (`android { }`, `ext { }` assignments). It is a scanner rather than
 * the bundled groovy grammar because that grammar parses `task hello { }` as a
 * call plus a detached closure, which gives a task span that stops at the name.
 * `.gradle.kts` files are Kotlin and already handled by the depth tier.
 *
 * The one non-obvious thing: comments and string contents are blanked in a
 * same-length copy before brackets are counted, so a `}` inside a string or a
 * comment cannot end a block early; captures are then read from the original text.
 */
import type { ExtractResult } from "../extract.js";
import {
  emitKeys,
  emitUnits,
  joinKey,
  splitLines,
  structuredFileNode,
  type KeyDraft,
  type UnitDraft,
} from "./shared.js";

/** `source` with comments and string contents replaced by spaces, newlines kept. */
function mask(source: string): string {
  const out = source.split("");
  let i = 0;
  const blank = (from: number, to: number): void => {
    for (let k = from; k < to && k < out.length; k++) if (out[k] !== "\n") out[k] = " ";
  };
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    const three = source.slice(i, i + 3);
    if (two === "//") {
      const end = source.indexOf("\n", i);
      const stop = end < 0 ? source.length : end;
      blank(i, stop);
      i = stop;
    } else if (two === "/*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end < 0 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (three === '"""' || three === "'''") {
      const end = source.indexOf(three, i + 3);
      const stop = end < 0 ? source.length : end + 3;
      blank(i + 3, stop - 3);
      i = stop;
    } else if (source[i] === '"' || source[i] === "'") {
      const q = source[i]!;
      let j = i + 1;
      while (j < source.length && source[j] !== q && source[j] !== "\n") j += source[j] === "\\" ? 2 : 1;
      blank(i + 1, j);
      i = j + 1;
    } else i++;
  }
  return out.join("");
}

/** Bracket depth at the start of each line of `masked`. */
function depthAtLineStarts(masked: string): number[] {
  const depths: number[] = [0];
  let depth = 0;
  for (const ch of masked) {
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    else if (ch === "}" || ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    else if (ch === "\n") depths.push(depth);
  }
  return depths;
}

/** Last row of the statement that starts on `row`: the line before the next line
 * that begins at or above its depth (trailing blank lines are not claimed). */
function statementEnd(lines: readonly string[], masked: readonly string[], depths: readonly number[], row: number): number {
  let end = row;
  for (let r = row + 1; r < lines.length; r++) {
    if ((depths[r] ?? 0) <= (depths[row] ?? 0)) break;
    if ((masked[r] ?? "").trim() !== "") end = r;
  }
  return end;
}

const TASK_DECLARATION = /^\s*task\b\s*\(?\s*['"]?([\w:.-]+)['"]?/;
const TASK_FACTORY = /^\s*tasks\.(?:register|create|named)\s*\(\s*['"]([\w:.-]+)['"]/;
const PLUGIN_ENTRY = /^\s*(?:id|kotlin|alias)\s*\(?\s*['"]([^'"]+)['"]/;
const DEPENDENCY_ENTRY = /^\s*(\w+)\s*\(?\s*['"]([^'"]+)['"]/;

export function extractGradle(rel: string, source: string): ExtractResult {
  const file = structuredFileNode(rel, source);
  const lines = splitLines(source);
  const masked = mask(source).split("\n").map((l) => l.replace(/\r$/, ""));
  const depths = depthAtLineStarts(mask(source));
  const tasks: UnitDraft[] = [];
  const keys: KeyDraft[] = [];

  for (let row = 0; row < lines.length; row++) {
    if ((depths[row] ?? 0) !== 0) continue;
    const m = masked[row] ?? "";
    if (m.trim() === "") continue; // blank, or inside a comment
    // Names sit inside quotes, which the masked copy blanks, so read the original.
    const original = lines[row] ?? "";
    const taskName = TASK_DECLARATION.exec(original)?.[1] ?? TASK_FACTORY.exec(original)?.[1];
    if (taskName) {
      tasks.push({ kind: "task", name: taskName, parent: -1, startRow: row, endRow: statementEnd(lines, masked, depths, row), signature: (lines[row] ?? "").trim() });
      continue;
    }
    const block = /^\s*(plugins|dependencies)\s*\{/.exec(m)?.[1];
    if (!block) continue;
    const blockEnd = statementEnd(lines, masked, depths, row);
    const parent = keys.length;
    keys.push({ path: block, parent: -1, depth: 1, startRow: row, endRow: blockEnd });
    for (let r = row + 1; r <= blockEnd; r++) {
      if ((depths[r] ?? 0) !== 1 || (masked[r] ?? "").trim() === "") continue;
      const original = lines[r] ?? "";
      if (block === "plugins") {
        const id = PLUGIN_ENTRY.exec(original)?.[1];
        if (id) keys.push({ path: joinKey(block, id), parent, depth: 2, startRow: r, endRow: statementEnd(lines, masked, depths, r), value: id });
      } else {
        const dep = DEPENDENCY_ENTRY.exec(original);
        if (!dep || dep[1] === "project") continue;
        const coords = dep[2]!;
        const unversioned = coords.split(":").slice(0, 2).join(":");
        keys.push({ path: joinKey(block, `${dep[1]} ${unversioned}`), parent, depth: 2, startRow: r, endRow: statementEnd(lines, masked, depths, r), value: coords });
      }
    }
  }

  const units = emitUnits(rel, lines, tasks);
  const kv = emitKeys(rel, lines, keys);
  return { nodes: [file, ...units.nodes, ...kv.nodes], rawEdges: [...units.rawEdges, ...kv.rawEdges] };
}
