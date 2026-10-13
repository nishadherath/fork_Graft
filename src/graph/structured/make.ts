/**
 * Makefile scanner: rules as `task` nodes with exact line spans.
 *
 * Responsible for: reading `target: prerequisites` lines and the recipe lines
 * (tab-indented, or after a `;`) beneath them, one `task` per target name with
 * the rule's span from the target line to its last recipe line. Pattern rules
 * (`%.o: %.c`) are named as written; special targets (`.PHONY`, `.DEFAULT`, ...)
 * and variable assignments, conditionals and includes are not tasks.
 *
 * Deliberately a scanner, not the bundled make grammar: recipes depend on a literal
 * tab, and the grammar's recovery on recipe lines is the thing that decides the
 * span, which has to be exact. Where it cannot tell (a `define` block, a computed
 * target name) it indexes less rather than a wrong span.
 *
 * The one non-obvious thing: blank and comment lines inside a recipe belong to it
 * only when another recipe line follows, so the comment block that introduces the
 * next rule is never claimed by this one.
 */
import type { ExtractResult } from "../extract.js";
import { emitUnits, splitLines, structuredFileNode, type UnitDraft } from "./shared.js";

const DIRECTIVE = /^(?:-?include|sinclude|ifeq|ifneq|ifdef|ifndef|else|endif|export|unexport|define|endef|override|vpath|undefine)\b/;
/** `targets: prerequisites`, but not `VAR := x`, `VAR ::= x` or `VAR : = x`. */
const RULE = /^([^\s#:=][^:=#]*?)\s*::?(?![=:])\s*(.*)$/;
/** Special built-in targets, which configure make rather than name work. */
const SPECIAL = /^\.[A-Z_]+$/;

export function extractMake(rel: string, source: string): ExtractResult {
  const file = structuredFileNode(rel, source);
  const lines = splitLines(source);
  const tasks: UnitDraft[] = [];

  for (let row = 0; row < lines.length; row++) {
    const line = lines[row]!;
    if (line === "" || line.startsWith("\t") || line.startsWith("#") || /^\s/.test(line) || DIRECTIVE.test(line)) continue;
    const m = RULE.exec(line);
    if (!m) continue;

    // The rule runs through its recipe lines; blank and comment lines count only
    // when another recipe line follows them.
    let end = row;
    let r = row + 1;
    for (; r < lines.length; r++) {
      const l = lines[r]!;
      const continued = (lines[r - 1] ?? "").endsWith("\\");
      if (l.startsWith("\t") || continued) end = r;
      else if (l.trim() === "" || l.trimStart().startsWith("#")) continue;
      else break;
    }

    const prerequisites = m[2]!.replace(/\s*;.*$/, "");
    const body = [prerequisites, ...lines.slice(row + 1, end + 1).map((l) => l.trim())].join(" ");
    for (const target of m[1]!.split(/\s+/)) {
      if (target === "" || SPECIAL.test(target)) continue;
      tasks.push({ kind: "task", name: target, parent: -1, startRow: row, endRow: end, signature: line.trim().slice(0, 120), bodyText: body });
    }
    row = end;
  }

  const { nodes, rawEdges } = emitUnits(rel, lines, tasks);
  return { nodes: [file, ...nodes], rawEdges };
}
