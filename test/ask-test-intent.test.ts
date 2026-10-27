/**
 * When a query asks FOR tests (Stage 31). `ask` lifts its test-file de-rank for a query that
 * wants tests; it used to lift it for any query holding the word "test", so a question about
 * test machinery ("how are test files recognised", "the test runner") ranked test files first
 * and lost the source that answers it (.eval/retrieval-2026-10-26.md, `test-path-derank` and
 * `test-runner-windows`). A singular "test" or "spec" now lifts it only when it heads a request
 * ("the test for X", "a spec that covers Y"); plurals and the other test words still do.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGraph } from "../src/graph/build.js";
import { ask } from "../src/ask/ask.js";

async function withFixture(run: (dir: string) => void | Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "graft-ask-test-intent-"));
  try {
    writeFileSync(
      join(dir, "classify.ts"),
      `// recognise test files by their path so ranking can put them lower\n` +
        `export function classifyPath(path: string): boolean {\n` +
        `  return /\\.test\\./.test(path);\n` +
        `}\n`,
    );
    writeFileSync(
      join(dir, "classify.test.ts"),
      `import { classifyPath } from "./classify";\n` +
        `// test files are recognised by path and ranked lower: test the test path classifier\n` +
        `export function testClassifyPathRecognisesTestFiles(): void { classifyPath("a.test.ts"); }\n`,
    );
    await buildGraph(dir);
    await run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const rankOf = (hits: { pointer: string }[], re: RegExp) => hits.findIndex((h) => re.test(h.pointer));
const SOURCE = /(^|\/)classify\.ts(:|$)/;
const TEST = /classify\.test\.ts/;

test("a question about test machinery ranks the source above its test file", async () => {
  await withFixture((dir) => {
    for (const query of ["how are test files recognised so ranking can put them lower", "test path classifier"]) {
      const hits = ask(dir, query).hits;
      const src = rankOf(hits, SOURCE);
      const tst = rankOf(hits, TEST);
      assert.ok(src >= 0, `source hit present for "${query}"`);
      assert.ok(tst === -1 || src < tst, `source ranks above its test for "${query}"`);
    }
  });
});

test("a query that asks for a test still lifts the de-rank, singular or plural", async () => {
  await withFixture((dir) => {
    for (const query of [
      "where is the test for classifyPath recognising test files",
      "tests for classifyPath recognising test files",
      "a spec that covers classifyPath recognising test files",
    ]) {
      const hits = ask(dir, query).hits;
      const src = rankOf(hits, SOURCE);
      const tst = rankOf(hits, TEST);
      assert.ok(tst >= 0 && (src === -1 || tst < src), `test file ranks first for "${query}"`);
    }
  });
});
