/**
 * Retrieval evaluation: runs `graft ask` for every question in .eval/retrieval-questions.json
 * and reports hit-at-1, hit-at-3 and the file rate at 3, each with the sample size and a 95%
 * Wilson interval (Stage 22, docs/assessment-2026-10-18.md section 5 item 6).
 *
 *   node scripts/retrieval-eval.mjs [--dir <context dir>] [--label <name>] [--limit <n>]
 *                                   [--questions <path>] [--json] [--save <file.json>]
 *
 * `--dir` is graft's global option, so a graph built elsewhere (`graft --dir <d> build`) is
 * measured without touching the repository's own map; without it the repository's map folder
 * is used. Every query runs with `--no-refresh`, so the run measures the graph as it is. It
 * spawns `node dist/cli.js` (run `npm run build` first), never the `.cmd` shim, which Windows
 * cannot spawn without a shell. No network and no model: the deep pass's token line is read
 * from the manifest it wrote, not spent again.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { answerRank, checkAnswers, checkQuestionSet, summarise } from "./retrieval-eval-score.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repoRoot, "dist", "cli.js");

function option(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}
const json = process.argv.includes("--json");
/** Also write the JSON report here, so one run gives both forms. */
const saveTo = option("--save");
const dirArg = option("--dir");
const limit = option("--limit", "8");
const questionsPath = resolve(option("--questions", join(repoRoot, ".eval", "retrieval-questions.json")));

if (!existsSync(cli)) {
  console.error(`no build at ${cli}: run \`npm run build\` first`);
  process.exit(2);
}
const dist = (rel) => import(pathToFileURL(join(repoRoot, "dist", rel)).href);
const [{ mapDirFor }, { formatUsageLine }] = await Promise.all([dist("context/map-dir.js"), dist("ai/llm/metered.js")]);
const contextDir = dirArg ? resolve(dirArg) : mapDirFor(repoRoot);
const label = option("--label", dirArg ? contextDir : "this repository's map");

const wiringPath = join(contextDir, ".graph", "wiring.json");
if (!existsSync(wiringPath)) {
  console.error(`no graph at ${wiringPath}: build one first`);
  process.exit(2);
}
const graph = JSON.parse(readFileSync(wiringPath, "utf8"));
const manifestPath = join(contextDir, "manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
const { questions } = JSON.parse(readFileSync(questionsPath, "utf8"));

// The set must still match the source, and the graph must hold each answer where the set says;
// either kind of drift is reported, so a miss is never a stale answer in disguise.
const setProblems = checkQuestionSet(questions, repoRoot);
const answerProblems = checkAnswers(questions, graph);

const summaryStates = {};
for (const n of graph.nodes) if (n.summary_state) summaryStates[n.summary_state] = (summaryStates[n.summary_state] ?? 0) + 1;
const facts = {
  nodes: graph.nodes.length,
  summaries: summaryStates,
  conceptNodes: manifest?.nodes?.length ?? 0,
  deepUsage: manifest?.deepUsage ? formatUsageLine(manifest.deepUsage).trim() : null,
};

const results = questions.map((q) => {
  const args = [cli, ...(dirArg ? ["--dir", contextDir] : []), "ask", q.question, "--json", "--no-refresh", "-n", limit];
  const run = spawnSync(process.execPath, args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) {
    console.error(`ask failed for ${q.id} (exit ${run.status}):\n${run.stderr}`);
    process.exit(1);
  }
  const hits = JSON.parse(run.stdout).hits ?? [];
  return { id: q.id, question: q.question, ...answerRank(hits, q.answers), top: hits[0]?.pointer ?? null };
});
const summary = summarise(results);

const report = { label, contextDir, limit: Number(limit), facts, setProblems, answerProblems, summary, results };
if (saveTo) writeFileSync(saveTo, JSON.stringify(report, null, 2) + "\n");
if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  const line = (name, r) =>
    `${name.padEnd(7)} ${String(r.k).padStart(2)}/${summary.n}  ${pct(r.rate).padStart(4)}  95% CI ${pct(r.interval[0])} to ${pct(r.interval[1])}`;
  const states = Object.entries(facts.summaries).map(([s, c]) => `${c} ${s}`).join(", ") || "none";
  const out = [
    `retrieval eval: ${label}`,
    `  graph: ${facts.nodes} nodes; summaries: ${states}; ${facts.conceptNodes} concept nodes`,
    `  deep pass (last run in the manifest): ${facts.deepUsage ?? "none"}`,
    `  questions: ${questions.length}, ask limit ${limit}, --no-refresh`,
    ...setProblems.map((p) => `  ! question set: ${p}`),
    ...answerProblems.map((p) => `  ! answer ${p.id}: ${p.symbol} ${p.problem}`),
    "",
    "  span  file  question",
    ...results.map((r) => `  ${String(r.span ?? "-").padStart(4)}  ${String(r.file ?? "-").padStart(4)}  ${r.id}`),
    "",
    line("hit@1", summary.hitAt1),
    line("hit@3", summary.hitAt3),
    line("file@3", summary.fileAt3),
  ];
  console.log(out.join("\n"));
}
