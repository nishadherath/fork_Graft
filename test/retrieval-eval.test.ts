/**
 * The retrieval evaluation (Stage 22): scoring `graft ask` results against the checked-in
 * question set in .eval/retrieval-questions.json. A hit is a ranked result in the answer's
 * file whose span lies inside the answer span; a concept node names files, not lines, so it
 * counts towards the file rate only. The question set itself is checked against the source on
 * disk, so a moved answer is caught here rather than scored as a miss.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  answerRank,
  checkAnswers,
  checkQuestionSet,
  parsePointer,
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

test("checkAnswers names an answer whose node is gone or has moved", () => {
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
  assert.deepEqual(checkAnswers(questions, graph), [
    { id: "moved", symbol: "src/c.ts#g", problem: "now at L2-L6" },
    { id: "gone", symbol: "src/d.ts#h", problem: "not in the graph" },
  ]);
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

test("the checked-in question set is twenty questions whose spans match the source", () => {
  const set = JSON.parse(readFileSync(join(repoRoot, ".eval", "retrieval-questions.json"), "utf8"));
  assert.equal(set.questions.length, 20);
  assert.deepEqual(checkQuestionSet(set.questions, repoRoot), []);
});
