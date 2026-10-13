/**
 * Dockerfile and CMake: build stages and targets as `task` nodes, via the bundled
 * grammars.
 *
 * Responsible for: one `task` per Dockerfile stage (`FROM image AS name`, named by
 * its alias or else its image, spanning the FROM line to the stage's last
 * instruction), and per CMake target (`add_executable`, `add_library`,
 * `add_custom_target`, `add_test`), with `function()` and `macro()` definitions as
 * `function` nodes. Spans are exact lines of the file.
 *
 * Deliberately does not: expand variables, follow `include()` or `COPY --from`, or
 * index single instructions. A stage's text is its body_text, so a search for the
 * package it installs finds the stage.
 *
 * The one non-obvious thing: a stage ends at its last instruction, not at the next
 * FROM, so the comment block that introduces the next stage is not claimed.
 */
import { parseWasm, type TsNode } from "../generic.js";
import type { ExtractResult } from "../extract.js";
import { emitUnits, endRowOf, splitLines, structuredFileNode, type UnitDraft } from "./shared.js";

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

export function extractDockerfile(rel: string, source: string, language: unknown | undefined): ExtractResult {
  const file = structuredFileNode(rel, source);
  if (!language) return { nodes: [file], rawEdges: [] };
  const root = parseWasm(language, parseText(source));
  const lines = splitLines(source);
  const drafts: UnitDraft[] = [];
  if (root) {
    const items = kids(root);
    items.forEach((node, i) => {
      if (node.type !== "from_instruction") return;
      const alias = kids(node).find((c) => c.type === "image_alias")?.text;
      const image = kids(node).find((c) => c.type === "image_spec")?.text ?? "scratch";
      let last = node;
      for (let j = i + 1; j < items.length && items[j]!.type !== "from_instruction"; j++) last = items[j]!;
      drafts.push({
        kind: "task",
        name: alias ?? image,
        parent: -1,
        startRow: node.startPosition.row,
        endRow: endRowOf(last),
        signature: (lines[node.startPosition.row] ?? "").trim().slice(0, 120),
        bodyText: lines.slice(node.startPosition.row, endRowOf(last) + 1).join(" "),
      });
    });
  }
  const { nodes, rawEdges } = emitUnits(rel, lines, drafts);
  return { nodes: [file, ...nodes], rawEdges };
}

const CMAKE_TARGETS: ReadonlySet<string> = new Set(["add_executable", "add_library", "add_custom_target", "add_test"]);

function firstArguments(list: TsNode | undefined): string[] {
  return list ? kids(list).filter((c) => c.type === "argument").map((c) => c.text.replace(/^"|"$/g, "")) : [];
}

export function extractCmake(rel: string, source: string, language: unknown | undefined): ExtractResult {
  const file = structuredFileNode(rel, source);
  if (!language) return { nodes: [file], rawEdges: [] };
  const root = parseWasm(language, parseText(source));
  const lines = splitLines(source);
  const drafts: UnitDraft[] = [];
  const visit = (node: TsNode): void => {
    for (const c of kids(node)) {
      if (c.type === "normal_command") {
        const id = kids(c).find((k) => k.type === "identifier")?.text.toLowerCase() ?? "";
        if (!CMAKE_TARGETS.has(id)) continue;
        const args = firstArguments(kids(c).find((k) => k.type === "argument_list"));
        // add_test(NAME x ...) names the test after NAME; the old form names it first.
        const name = id === "add_test" && args[0]?.toUpperCase() === "NAME" ? args[1] : args[0];
        if (!name) continue;
        drafts.push({ kind: "task", name, parent: -1, startRow: c.startPosition.row, endRow: endRowOf(c), signature: `${id}(${args.slice(0, 3).join(" ")})`, bodyText: c.text });
      } else if (c.type === "function_def" || c.type === "macro_def") {
        const head = kids(c).find((k) => k.type === "function_command" || k.type === "macro_command");
        const name = firstArguments(head ? kids(head).find((k) => k.type === "argument_list") : undefined)[0];
        if (name) drafts.push({ kind: "function", name, parent: -1, startRow: c.startPosition.row, endRow: endRowOf(c), signature: (lines[c.startPosition.row] ?? "").trim().slice(0, 120), bodyText: c.text });
      } else if (c.type === "if_condition" || c.type === "if_command" || c.type === "body") {
        visit(c);
      }
    }
  };
  if (root) visit(root);
  const { nodes, rawEdges } = emitUnits(rel, lines, drafts);
  return { nodes: [file, ...nodes], rawEdges };
}
