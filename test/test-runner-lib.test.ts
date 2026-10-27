/**
 * `scripts/test-runner-lib.mjs` is what `scripts/run-tests.mjs` runs on: the test list for the
 * fork-only quick run, the split of a long list into command lines the platform accepts, and the
 * merge of the chunks' counts. A 600-file list is the proof that the full suite no longer depends
 * on one command line holding every path.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { chunkByLength, forkTestFiles, mergeCounts, parseCounts, runSuite } from "../scripts/test-runner-lib.mjs";

/** This test runs inside `node --test`; a child that inherits its context refuses to run files. */
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== "NODE_TEST_CONTEXT"));

function git(dir: string, ...args: string[]): string {
  const r = spawnSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@example.test", "-c", "commit.gpgsign=false", ...args],
    { cwd: dir, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

/** A folder of `count` passing test files, each in a deliberately long path. */
function manyTests(count: number): { dir: string; files: string[] } {
  const dir = join(mkdtempSync(join(tmpdir(), "runner-lib-")), "a-deliberately-long-folder-name-to-fill-the-command-line");
  mkdirSync(dir, { recursive: true });
  const files: string[] = [];
  for (let i = 0; i < count; i++) {
    const file = join(dir, `a-fairly-long-test-file-name-number-${String(i).padStart(4, "0")}.test.mjs`);
    writeFileSync(file, `import { test } from "node:test";\ntest("t${i}", () => {});\n`);
    files.push(file);
  }
  return { dir, files };
}

test("a list is split so no chunk's paths exceed the limit, and nothing is lost or reordered", () => {
  const files = Array.from({ length: 50 }, (_, i) => `/p/${"x".repeat(40)}${i}.test.ts`);
  const chunks = chunkByLength(files, 500);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) assert.ok(chunk.join(" ").length <= 500);
  assert.deepEqual(chunks.flat(), files);
});

test("one path longer than the limit still gets a chunk of its own", () => {
  const chunks = chunkByLength(["a", "b".repeat(100), "c"], 10);
  assert.deepEqual(chunks, [["a"], ["b".repeat(100)], ["c"]]);
});

test("counts are read from the spec and the tap summaries and added together", () => {
  const spec = "ℹ tests 5\nℹ suites 0\nℹ pass 4\nℹ fail 1\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\n";
  const tap = "# tests 3\n# suites 0\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 2\n# todo 0\n";
  assert.deepEqual(parseCounts(spec), { tests: 5, pass: 4, fail: 1, cancelled: 0, skipped: 0, todo: 0 });
  assert.deepEqual(parseCounts(tap), { tests: 3, pass: 3, fail: 0, cancelled: 0, skipped: 2, todo: 0 });
  assert.deepEqual(mergeCounts([parseCounts(spec), parseCounts(tap)]), {
    tests: 8, pass: 7, fail: 1, cancelled: 0, skipped: 2, todo: 0,
  });
});

test("the fork-only list is the test files added or changed since the merge base, not the deleted ones", () => {
  const dir = mkdtempSync(join(tmpdir(), "runner-fork-"));
  mkdirSync(join(dir, "test"));
  git(dir, "init", "-q");
  writeFileSync(join(dir, "test", "kept.test.ts"), "// 1\n");
  writeFileSync(join(dir, "test", "changed.test.ts"), "// 1\n");
  writeFileSync(join(dir, "test", "gone.test.ts"), "// 1\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  const base = git(dir, "rev-parse", "HEAD");
  writeFileSync(join(dir, "test", "changed.test.ts"), "// 2\n");
  writeFileSync(join(dir, "test", "added.test.ts"), "// 1\n");
  writeFileSync(join(dir, "test", "helper.ts"), "// not a test\n");
  git(dir, "rm", "-q", "test/gone.test.ts");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "fork");
  assert.deepEqual(
    forkTestFiles(dir, base),
    ["added.test.ts", "changed.test.ts"].map((f) => join(dir, "test", f)),
  );
});

test("a fork-only list of nothing is an error, not a silent pass", () => {
  const dir = mkdtempSync(join(tmpdir(), "runner-fork-none-"));
  mkdirSync(join(dir, "test"));
  git(dir, "init", "-q");
  writeFileSync(join(dir, "test", "a.test.ts"), "// 1\n");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  assert.throws(() => forkTestFiles(dir, git(dir, "rev-parse", "HEAD")), /no test files/i);
});

test("a 600-file list runs, in more than one command line, and the counts add up", async () => {
  const { files } = manyTests(600);
  assert.ok(files.join(" ").length > 32_767, "the list must be longer than Windows allows on one command line");
  const result = await runSuite({ files, nodeArgs: ["--test"], nodeMajor: 20, env: childEnv, out: () => {} });
  assert.equal(result.status, 0);
  assert.ok(result.chunks > 1, `ran in ${result.chunks} chunk(s)`);
  assert.equal(result.counts.tests, 600);
  assert.equal(result.counts.pass, 600);
  assert.equal(result.counts.fail, 0);
});

test("on Node 22 and later the glob goes to --test in one run", async () => {
  const { dir } = manyTests(5);
  const result = await runSuite({
    glob: "*.test.mjs",
    files: [join(dir, "unused.test.mjs")],
    cwd: dir,
    nodeArgs: ["--test"],
    nodeMajor: 22,
    env: childEnv,
    out: () => {},
  });
  assert.equal(result.chunks, 1);
  assert.equal(result.counts.tests, 5);
  assert.equal(result.status, 0);
});

test("a failing chunk fails the run and its failures are counted", async () => {
  const { dir, files } = manyTests(3);
  const failing = join(dir, "zz-failing.test.mjs");
  writeFileSync(failing, `import { test } from "node:test";\ntest("bad", () => { throw new Error("no"); });\n`);
  const result = await runSuite({ files: [...files, failing], nodeArgs: ["--test"], nodeMajor: 20, maxChars: 200, env: childEnv, out: () => {} });
  assert.notEqual(result.status, 0);
  assert.ok(result.chunks > 1);
  assert.equal(result.counts.fail, 1);
  assert.equal(result.counts.pass, 3);
});
