/**
 * Scoring for the retrieval evaluation (`scripts/retrieval-eval.mjs`, Stage 22). Pure functions
 * over `graft ask --json` hits and the question set in .eval/retrieval-questions.json.
 *
 * A span hit is a ranked result in the answer's file whose span lies inside the answer span: a
 * result that only encloses or overlaps the answer is too coarse for graft's exact-locator
 * promise (AGENTS.md rule 4). A concept node names files, not lines, so it counts towards the
 * file rate only. Ranks are 1-based positions in the result list.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Normal quantile for a two-sided 95% interval. */
const Z_95 = 1.96;

/** The cut-offs the report states: hit-at-1 and hit-at-3. */
export const CUTOFFS = [1, 3];

/** `file:Lx-Ly` (a symbol or section) or a comma-joined file list (a concept). */
export function parsePointer(pointer) {
  const m = /^(.*):L(\d+)-L(\d+)$/.exec(pointer);
  if (m) return { files: [m[1]], from: Number(m[2]), to: Number(m[3]) };
  return { files: pointer.split(",").map((s) => s.trim()).filter(Boolean) };
}

/** `Lx-Ly` as numbers. */
function parseSpan(span) {
  const m = /^L(\d+)-L(\d+)$/.exec(span);
  return m ? { from: Number(m[1]), to: Number(m[2]) } : null;
}

/**
 * The 1-based rank of the first hit inside an answer span (`span`) and of the first hit that
 * names an answer's file (`file`), or null for none. A file node comes back as its bare path,
 * like a one-source concept, so `kind` tells them apart: the bare path of a non-concept hit is
 * a span hit when the answer is that file node itself.
 */
export function answerRank(hits, answers) {
  const spans = answers.map((a) => ({ file: a.file, wholeFile: a.symbol === a.file, ...parseSpan(a.span) }));
  const files = new Set(answers.map((a) => a.file));
  const inside = (hit, p) =>
    hit.kind !== "concept" &&
    spans.some((a) =>
      a.file === p.files[0] && (p.from === undefined ? p.files.length === 1 && a.wholeFile : p.from >= a.from && p.to <= a.to),
    );
  let span = null;
  let file = null;
  hits.forEach((hit, i) => {
    const p = parsePointer(hit.pointer);
    if (file === null && p.files.some((f) => files.has(f))) file = i + 1;
    if (span === null && inside(hit, p)) span = i + 1;
  });
  return { span, file };
}

/** Wilson score interval for k successes in n trials, as [low, high]. */
export function wilson(k, n, z = Z_95) {
  if (n === 0) return [0, 1];
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [k === 0 ? 0 : Math.max(0, centre - half), k === n ? 1 : Math.min(1, centre + half)];
}

function rateOf(k, n) {
  return { k, rate: n === 0 ? 0 : k / n, interval: wilson(k, n) };
}

/** hit-at-1, hit-at-3 and the file rate at 3 over a list of `answerRank` results. */
export function summarise(ranks) {
  const n = ranks.length;
  const within = (r, cut) => r !== null && r <= cut;
  return {
    n,
    hitAt1: rateOf(ranks.filter((r) => within(r.span, 1)).length, n),
    hitAt3: rateOf(ranks.filter((r) => within(r.span, 3)).length, n),
    fileAt3: rateOf(ranks.filter((r) => within(r.file, 3)).length, n),
  };
}

/**
 * Answers whose node is missing from `graph` or sits at another span there, so a run against a
 * graph built from different code reports the drift instead of scoring it as a miss.
 */
export function checkAnswers(questions, graph) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const problems = [];
  for (const q of questions)
    for (const a of q.answers) {
      const node = byId.get(a.symbol);
      if (!node) problems.push({ id: q.id, symbol: a.symbol, problem: "not in the graph" });
      else if (node.path !== a.file || node.span !== a.span)
        problems.push({ id: q.id, symbol: a.symbol, problem: `now at ${node.span}` });
    }
  return problems;
}

/** A file's lines as graft counts them: a trailing newline leaves one more, empty, line,
 * so a file node for a 72-line file ending in a newline spans L1-L73. */
function linesOf(path) {
  return readFileSync(path, "utf8").split(/\r?\n/);
}

/**
 * Check the question set against the source on disk: ids unique, every answer's file present,
 * its span inside the file, and the span's first line the definition it names (the symbol's
 * name for a code node, a heading for a section, the whole file for a file node).
 * Returns the problems as strings; empty when the set is sound.
 */
export function checkQuestionSet(questions, repoRoot) {
  const problems = [];
  const ids = new Set();
  for (const q of questions) {
    if (ids.has(q.id)) problems.push(`${q.id}: duplicate id`);
    ids.add(q.id);
    if (!q.question?.trim()) problems.push(`${q.id}: no question text`);
    if (!q.answers?.length) problems.push(`${q.id}: no answer`);
    for (const a of q.answers ?? []) {
      const where = `${q.id}: ${a.symbol}`;
      const span = parseSpan(a.span);
      const path = join(repoRoot, a.file);
      if (!span || span.from > span.to) { problems.push(`${where}: bad span ${a.span}`); continue; }
      if (!existsSync(path)) { problems.push(`${where}: no file ${a.file}`); continue; }
      const lines = linesOf(path);
      if (span.to > lines.length) { problems.push(`${where}: span ends past line ${lines.length}`); continue; }
      const [file, name] = a.symbol.split("#");
      const first = lines[span.from - 1];
      if (file !== a.file) problems.push(`${where}: symbol is not in ${a.file}`);
      else if (name === undefined) {
        if (span.from !== 1 || span.to !== lines.length) problems.push(`${where}: a file node spans L1-L${lines.length}`);
      } else if (name.startsWith("section:")) {
        if (!/^#{1,6}\s/.test(first)) problems.push(`${where}: line ${span.from} is not a heading`);
      } else if (!first.includes(name)) problems.push(`${where}: line ${span.from} does not name ${name}`);
    }
  }
  return problems;
}
