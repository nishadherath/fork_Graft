---
stage: "Stage 31a: a blind retrieval question set (subagent of Stage 31)"
model: claude-sonnet-5-5
effort: medium
status: ready
created: 2026-10-27
from: "Stage 31 session (claude-opus-5-5, high), roadmap item 6 of docs/assessment-2026-10-27.md"
---

# Stage 31a: a blind retrieval question set

## Goal

Twenty questions about this repository, each with the graph node whose span answers it, written
without seeing how `graft ask` ranks anything and without seeing any earlier question set. Done is
one file, `C:\Users\Bob\AppData\Local\Temp\s31\blind-out\retrieval-questions-blind.json`, that the
validation command below accepts with no problems printed.

## Decisions already made

- Blindness is the point. Work only in the scratch clone `C:\Users\Bob\AppData\Local\Temp\s31\blind`
  (a `git clone` of `main` at `1d93158` with `.eval/`, `docs/handoffs/`, `docs/archive/` and
  `docs/assessment-*.md` deleted, because those name an earlier set and its results).
- Never open `D:\Code\Claude\fork_graft` or any `.trail/cache/` other than the graph file named
  below, and never run `graft ask`, `graft find`, the MCP graft tools, or `scripts/retrieval-eval.mjs`.
  Find answers by reading source with Read, Grep and Glob, as a newcomer to the code would.
- Build the graph yourself, keyless and lexical (no `--deep`), with the frozen CLI:
  `cd C:\Users\Bob\AppData\Local\Temp\s31\blind && node C:\Users\Bob\AppData\Local\Temp\s31\cli-head\dist\cli.js build`
  (about three minutes). Use its `.trail/cache/.graph/wiring.json` only to look up the node id
  (`id`), `path` and `span` of an answer you have already chosen from the source.
- Spread: at least 12 questions answered in `src/` across at least six different subfolders, 2 to 3
  in `scripts/`, 2 to 3 answered by a Markdown section (`docs/` or a root `.md`), the rest free.
  No two answers in the same file.
- Each question is what a developer new to the repository would type: a behaviour or a purpose
  in plain words. Do not put the answer's symbol name, its file name or its heading text in the
  question. Each question has one best answer: the smallest node (function, method, section,
  key) whose span holds it. Add a second answer only when two nodes answer equally.

## Files and links that matter

- Format to copy: the shape below, with an `about` string saying the set is blind and how.
  `{ "about": "...", "questions": [ { "id": "kebab-slug", "question": "...",
  "answers": [ { "symbol": "<node id>", "file": "<repo-relative posix path>", "span": "Lx-Ly" } ] } ] }`
- `scripts/retrieval-eval-score.mjs` in the clone: `checkQuestionSet` and `resolveAnswers`.

## Exact next action

Build the graph, then write the twenty, then run this validation from the clone (it prints
`[]` twice and `20` when the set is sound) and fix anything it names:

```
node --input-type=module -e "const s=await import('./scripts/retrieval-eval-score.mjs');const fs=await import('node:fs');const q=JSON.parse(fs.readFileSync(process.argv[1],'utf8')).questions;const g=JSON.parse(fs.readFileSync('.trail/cache/.graph/wiring.json','utf8'));const r=s.resolveAnswers(q,g);console.log(JSON.stringify(r.missing),JSON.stringify(s.checkQuestionSet(r.questions,'.')),q.length)" C:\Users\Bob\AppData\Local\Temp\s31\blind-out\retrieval-questions-blind.json
```

Report: the path of the file, the validation output verbatim, and two lines on how you picked
questions. Australian English, no em-dashes. Do not commit anything anywhere.

## Cost projection

Sonnet 5.5, medium, about 40 turns at 60k average context: cache reads 40 x 60k = 2.4M x $0.10 =
$0.24; fresh input 40 x 3k = 120k x $2.50 = $0.30; output 40 x 1.5k = 60k x $10 = $0.60. About
$1.15 (quote $1 to $2).

## Time projection

20 to 40 minutes of agent time including the three-minute build. No operator review of its own;
the Stage 31 session reads the set before using it.
