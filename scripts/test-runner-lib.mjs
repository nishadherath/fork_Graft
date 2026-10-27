/**
 * What `scripts/run-tests.mjs` runs on: the test list for the fork-only quick run, the split of a
 * long list into command lines the platform accepts, and the merge of the chunks' counts.
 *
 * Why chunks: every test path on one command line passes 32,767 characters (the Windows limit)
 * once the suite is a few hundred files long. Node 22 and later takes the glob itself, so a full
 * run is one process there; below that, and for the fork-only list, the files go in chunks, one
 * `node --test` each, and the counts of the chunks are added.
 */
import { execFileSync, spawn } from "node:child_process";
import { join } from "node:path";

/** Well under the Windows command-line limit, which counts the node binary and its flags too. */
export const MAX_COMMAND_CHARS = 24_000;
/** `--test` takes a glob from this Node major on; below it the shell has to expand one. */
export const NODE_GLOB_MAJOR = 22;
/** The upstream branch the fork's added tests are measured from. */
const UPSTREAM_REF = "upstream/main";
const COUNT_NAMES = ["tests", "pass", "fail", "cancelled", "skipped", "todo"];
const SUMMARY_LINE = /^(?:ℹ|#) (?:tests|pass|fail|cancelled|skipped|todo) \d+\s*$/;

/** Split a path list into runs of at most `maxChars` joined characters, in order. */
export function chunkByLength(files, maxChars = MAX_COMMAND_CHARS) {
  const chunks = [];
  let current = [];
  let length = 0;
  for (const file of files) {
    const added = file.length + (current.length ? 1 : 0);
    if (current.length && length + added > maxChars) {
      chunks.push(current);
      current = [];
      length = 0;
    }
    length += file.length + (current.length ? 1 : 0);
    current.push(file);
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/** The summary counts of one `node --test` run, from either the spec (`ℹ`) or the tap (`#`) reporter. */
export function parseCounts(output) {
  const counts = Object.fromEntries(COUNT_NAMES.map((n) => [n, 0]));
  for (const m of output.matchAll(/^(?:ℹ|#) (tests|pass|fail|cancelled|skipped|todo) (\d+)\s*$/gm)) {
    counts[m[1]] = Number(m[2]);
  }
  return counts;
}

export function mergeCounts(all) {
  const total = Object.fromEntries(COUNT_NAMES.map((n) => [n, 0]));
  for (const counts of all) for (const n of COUNT_NAMES) total[n] += counts[n];
  return total;
}

/** The commit the fork's own tests are measured from: where its history left upstream's. */
export function forkMergeBase(root) {
  return execFileSync("git", ["merge-base", "HEAD", UPSTREAM_REF], { cwd: root, encoding: "utf8" }).trim();
}

/** Test files added or changed under `test/` since `base`, as absolute paths in sorted order. */
export function forkTestFiles(root, base = forkMergeBase(root)) {
  const out = execFileSync("git", ["diff", "--name-status", base, "--", "test"], { cwd: root, encoding: "utf8" });
  const files = out
    .split("\n")
    .map((line) => line.trim().split("\t"))
    .filter(([status, path]) => status && path && /^[AMRC]/.test(status))
    .map(([, ...paths]) => paths[paths.length - 1])
    .filter((path) => /^test\/[^/]+\.test\.ts$/.test(path))
    .sort()
    .map((path) => join(root, path));
  if (files.length === 0) throw new Error(`no test files differ from ${base} under test/`);
  return files;
}

function runOne(args, { cwd, env, out }) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, args, { cwd, env, stdio: ["inherit", "pipe", "inherit"] });
    // The summary precedes the list of failures, so keep only its lines, not the output's tail.
    let pending = "";
    let summary = "";
    const keep = (line) => {
      if (SUMMARY_LINE.test(line)) summary += `${line}\n`;
    };
    child.stdout.on("data", (buf) => {
      const text = buf.toString("utf8");
      out(text);
      const lines = (pending + text).split("\n");
      pending = lines.pop() ?? "";
      lines.forEach(keep);
    });
    child.on("error", (error) => resolveRun({ status: 1, tail: summary, error }));
    child.on("close", (status) => {
      keep(pending);
      resolveRun({ status: status ?? 1, tail: summary });
    });
  });
}

/**
 * Run the tests. With `glob` on Node 22 or later that is one `node --test <glob>`; otherwise the
 * `files` run in chunks, one after another. The result holds the worst exit status, the number of
 * runs and the counts added up across them.
 */
export async function runSuite({
  files = [],
  glob,
  cwd = process.cwd(),
  env = process.env,
  nodeArgs = ["--import", "tsx", "--test"],
  nodeMajor = Number(process.versions.node.split(".")[0]),
  maxChars = MAX_COMMAND_CHARS,
  out = (text) => process.stdout.write(text),
} = {}) {
  const runs = glob && nodeMajor >= NODE_GLOB_MAJOR ? [[glob]] : chunkByLength(files, maxChars);
  const counts = [];
  let status = 0;
  for (const [i, paths] of runs.entries()) {
    if (runs.length > 1) out(`\n--- test run ${i + 1} of ${runs.length}: ${paths.length} file(s) ---\n`);
    const run = await runOne([...nodeArgs, ...paths], { cwd, env, out });
    if (run.error) throw run.error;
    counts.push(parseCounts(run.tail));
    if (run.status !== 0 && status === 0) status = run.status;
  }
  const merged = mergeCounts(counts);
  if (runs.length > 1) {
    out(`\n--- all ${runs.length} runs: ${COUNT_NAMES.map((n) => `${n} ${merged[n]}`).join(", ")} ---\n`);
  }
  return { status, chunks: runs.length, counts: merged };
}
