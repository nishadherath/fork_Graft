/**
 * Bash and PowerShell: function definitions as `function` nodes, via the bundled
 * grammars.
 *
 * Responsible for: one `function` per Bash `name() { }` / `function name { }` and
 * per PowerShell `function` or `filter`, wherever it is nested, with its exact
 * span, its first line as signature and its text as body_text.
 *
 * Deliberately does not: record calls between functions, follow `source` or dot
 * sourcing, or index top-level commands and variables. Scripts are searched for the
 * function that does the work; the rest of a script is read whole.
 */
import { parseWasm, type TsNode } from "../generic.js";
import type { ExtractResult } from "../extract.js";
import { emitUnits, endRowOf, splitLines, structuredFileNode, type UnitDraft } from "./shared.js";

const FUNCTION_TYPES: Readonly<Record<string, string>> = {
  function_definition: "word", // bash
  function_statement: "function_name", // powershell
};

/** Source for the grammar: no BOM, LF endings (a CR before a line continuation
 * breaks the Dockerfile grammar; the line count is unchanged, so rows still match). */
function parseText(source: string): string {
  return source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}

function kids(node: TsNode): TsNode[] {
  const out: TsNode[] = [];
  for (let i = 0; i < (node.namedChildCount ?? 0); i++) {
    const c = node.namedChild?.(i);
    if (c && c.type !== "comment") out.push(c);
  }
  return out;
}

export function extractShell(rel: string, source: string, language: unknown | undefined): ExtractResult {
  const file = structuredFileNode(rel, source);
  if (!language) return { nodes: [file], rawEdges: [] };
  const root = parseWasm(language, parseText(source));
  const lines = splitLines(source);
  const drafts: UnitDraft[] = [];
  const visit = (node: TsNode): void => {
    for (const c of kids(node)) {
      const nameType = FUNCTION_TYPES[c.type];
      if (nameType) {
        const name = kids(c).find((k) => k.type === nameType)?.text;
        if (name) {
          drafts.push({
            kind: "function",
            name,
            parent: -1,
            startRow: c.startPosition.row,
            endRow: endRowOf(c),
            signature: (lines[c.startPosition.row] ?? "").trim().replace(/\s*\{\s*$/, "").slice(0, 120),
            bodyText: c.text,
          });
        }
      }
      visit(c);
    }
  };
  if (root) visit(root);
  const { nodes, rawEdges } = emitUnits(rel, lines, drafts);
  return { nodes: [file, ...nodes], rawEdges };
}
