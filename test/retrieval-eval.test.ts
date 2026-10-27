/**
 * The retrieval evaluation (Stage 22): scoring `graft ask` results against the checked-in
 * question set in .eval/retrieval-questions.json. A hit is a ranked result in the answer's
 * file whose span lies inside the answer span; a concept node names files, not lines, so it
 * counts towards the file rate only. The question set itself is checked against the source on
 * disk, so a moved answer is caught here rather than scored as a miss.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildGraph } from "../src/graph/build.js";
import {
  answerRank,
  checkQuestionSet,
  parsePointer,
  resolveAnswers,
  runPlace,
  summarise,
  wilson,
} from "../scripts/retrieval-eval-score.mjs";

const repoRoot = join(import.meta.dirname, "..");
const answer = { symbol: "src/a.ts#f", file: "src/a.ts", span: "L10-L20" };

test("parsePointer reads a span pointer and a concept's file list", () => {
  assert.deepEqual(parsePointer("src/a.ts:L10-L20"), { files: ["src/a.ts"], from: 10, to: 20 });
  assert.deepEqual(parsePointer("src/a.ts, docs/b.md"), { files: ["src/a.ts", "docs/b.md"] });
});

test("a hit counts only inside the answer span, in the same file", () => {
  const hits = [
    { kind: "symbol", pointer: "src/a.ts:L1-L40" }, // encloses the answer: too coarse
    { kind: "symbol", pointer: "src/a.ts:L15-L25" }, // overlaps, not inside
    { kind: "symbol", pointer: "src/b.ts:L10-L20" }, // other file
    { kind: "symbol", pointer: "src/a.ts:L12-L18" }, // inside
  ];
  assert.equal(answerRank(hits, [answer]).span, 4);
  assert.equal(answerRank(hits, [answer]).file, 1);
  assert.deepEqual(answerRank([], [answer]), { span: null, file: null });
});

test("a concept hit counts for the file rate, never for a span", () => {
  const hits = [{ kind: "concept", pointer: "docs/x.md, src/a.ts" }, { kind: "symbol", pointer: "src/a.ts:L10-L20" }];
  assert.deepEqual(answerRank(hits, [answer]), { span: 2, file: 1 });
});

test("a file node's bare path is a span hit only when the answer is that file node", () => {
  const fileAnswer = { symbol: "scripts/r.mjs", file: "scripts/r.mjs", span: "L1-L73" };
  assert.deepEqual(answerRank([{ kind: "symbol", pointer: "scripts/r.mjs" }], [fileAnswer]), { span: 1, file: 1 });
  assert.deepEqual(answerRank([{ kind: "concept", pointer: "scripts/r.mjs" }], [fileAnswer]), { span: null, file: 1 });
  assert.deepEqual(answerRank([{ kind: "symbol", pointer: "src/a.ts" }], [answer]), { span: null, file: 1 });
});

test("any one of several answers is enough", () => {
  const other = { symbol: "src/c.ts#g", file: "src/c.ts", span: "L1-L5" };
  assert.equal(answerRank([{ kind: "symbol", pointer: "src/c.ts:L2-L3" }], [answer, other]).span, 1);
});

test("wilson gives the 95% score interval", () => {
  const [lo, hi] = wilson(10, 20);
  assert.equal(lo.toFixed(3), "0.299");
  assert.equal(hi.toFixed(3), "0.701");
  assert.deepEqual(wilson(0, 0), [0, 1]);
  assert.equal(wilson(20, 20)[1], 1);
});

test("summarise counts hit-at-1, hit-at-3 and the file rate at 3", () => {
  const ranks = [
    { span: 1, file: 1 },
    { span: 3, file: 1 },
    { span: 5, file: 2 },
    { span: null, file: null },
  ];
  const s = summarise(ranks);
  assert.equal(s.n, 4);
  assert.equal(s.hitAt1.k, 1);
  assert.equal(s.hitAt3.k, 2);
  assert.equal(s.fileAt3.k, 3);
  assert.equal(s.hitAt3.rate, 0.5);
});

test("resolveAnswers takes each span from the graph and names what moved or is gone", () => {
  const graph = {
    nodes: [
      { id: "src/a.ts#f", path: "src/a.ts", span: "L10-L20" },
      { id: "src/c.ts#g", path: "src/c.ts", span: "L2-L6" },
    ],
  };
  const questions = [
    { id: "ok", answers: [answer] },
    { id: "moved", answers: [{ symbol: "src/c.ts#g", file: "src/c.ts", span: "L1-L5" }] },
    { id: "gone", answers: [{ symbol: "src/d.ts#h", file: "src/d.ts", span: "L1-L2" }] },
  ];
  const r = resolveAnswers(questions, graph);
  assert.deepEqual(r.moved, [{ id: "moved", symbol: "src/c.ts#g", recorded: "L1-L5", now: "L2-L6" }]);
  assert.deepEqual(r.missing, [{ id: "gone", symbol: "src/d.ts#h", problem: "not in the graph" }]);
  assert.equal(r.questions[1].answers[0].span, "L2-L6");
  assert.equal(r.questions[2].answers[0].span, "L1-L2", "a missing node keeps its recorded span");
  assert.equal(questions[1].answers[0].span, "L1-L5", "the input is not changed");
});

test("checkQuestionSet names a span that no longer starts at its definition", () => {
  const questions = [
    { id: "moved", question: "q", answers: [{ symbol: "src/util/paths.ts#relPosix", file: "src/util/paths.ts", span: "L41-L42" }] },
    { id: "moved", question: "q", answers: [{ symbol: "src/nope.ts#x", file: "src/nope.ts", span: "L1-L2" }] },
  ];
  assert.deepEqual(checkQuestionSet(questions, repoRoot), [
    "moved: src/util/paths.ts#relPosix: line 41 does not name relPosix",
    "moved: duplicate id",
    "moved: src/nope.ts#x: no file src/nope.ts",
  ]);
});

test("runPlace runs ask in the --root copy, never in this checkout, when one is given", () => {
  const mapDir = (root: string) => join(root, "map");
  const copy = join(tmpdir(), "copy");
  // --root alone: the copy's own map, ask run inside the copy, the set checked against the copy
  assert.deepEqual(runPlace({ root: copy }, repoRoot, mapDir), { root: copy, cwd: copy, contextDir: join(copy, "map") });
  // --dir names the graph; --root still decides where ask runs and what the set is checked against
  assert.deepEqual(runPlace({ root: copy, dir: join(tmpdir(), "g") }, repoRoot, mapDir), {
    root: copy,
    cwd: copy,
    contextDir: join(tmpdir(), "g"),
  });
  // neither: this repository and its map, as before
  assert.deepEqual(runPlace({}, repoRoot, mapDir), { root: repoRoot, cwd: repoRoot, contextDir: join(repoRoot, "map") });
  assert.throws(() => runPlace({ root: "relative/copy" }, repoRoot, mapDir), /--root .*relative\/copy.* absolute/);
});

/** The graph of just the files the answers name, copied to a scratch folder: a symbol's span
 * depends on its file alone, so this resolves the same spans as the whole repository's map. */
async function graphOfAnswerFiles(questions: { answers: { file: string }[] }[], root: string) {
  const dir = mkdtempSync(join(tmpdir(), "graft-eval-set-"));
  try {
    for (const f of new Set(questions.flatMap((q) => q.answers.map((a) => a.file)))) {
      mkdirSync(dirname(join(dir, f)), { recursive: true });
      cpSync(join(root, f), join(dir, f));
    }
    const outDir = join(dir, "graft");
    await buildGraph(dir, { contextDir: outDir, reuse: false });
    return JSON.parse(readFileSync(join(outDir, ".graph", "wiring.json"), "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("an edit above a pinned symbol moves its lines without failing the set", async () => {
  const root = mkdtempSync(join(tmpdir(), "graft-eval-moved-"));
  try {
    mkdirSync(join(root, "src"), { recursive: true });
    // two lines above `util` that the recorded span (L1-L3) predates
    writeFileSync(
      join(root, "src", "util.ts"),
      'import { a } from "./a.js";\nimport { b } from "./b.js";\nexport function util(): number {\n  return 1;\n}\n',
    );
    const questions = [{ id: "u", question: "q", answers: [{ symbol: "src/util.ts#util", file: "src/util.ts", span: "L1-L3" }] }];
    assert.notDeepEqual(checkQuestionSet(questions, root), [], "the recorded span no longer starts at the definition");
    const r = resolveAnswers(questions, await graphOfAnswerFiles(questions, root));
    assert.deepEqual(r.missing, []);
    assert.deepEqual(r.moved, [{ id: "u", symbol: "src/util.ts#util", recorded: "L1-L3", now: "L3-L5" }]);
    assert.deepEqual(checkQuestionSet(r.questions, root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// The Stage 22 set and the blind set of Stage 31 (written without seeing ask's rankings).
for (const name of ["retrieval-questions.json", "retrieval-questions-blind.json"]) {
  test(`the checked-in question set ${name} is twenty questions whose symbols all resolve in the source`, async (t) => {
    const set = JSON.parse(readFileSync(join(repoRoot, ".eval", name), "utf8"));
    assert.equal(set.questions.length, 20);
    const r = resolveAnswers(set.questions, await graphOfAnswerFiles(set.questions, repoRoot));
    assert.deepEqual(r.missing, []);
    assert.deepEqual(checkQuestionSet(r.questions, repoRoot), []);
    // an edit above a pinned symbol is reported, not failed: the recorded span stays as it was
    for (const m of r.moved) t.diagnostic(`${m.id}: ${m.symbol} recorded ${m.recorded}, now ${m.now}`);
  });
}
