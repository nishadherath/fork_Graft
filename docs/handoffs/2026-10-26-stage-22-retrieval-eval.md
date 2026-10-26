---
stage: "Stage 22: retrieval evaluation harness"
model: claude-opus-5-5
effort: high
status: done
created: 2026-10-26
from: "Stage 19 handoff's next action, started by the roadmap session (local_2a1bae05)"
---

# Stage 22: retrieval evaluation harness

Roadmap Stage 22 in `docs/assessment-2026-10-18.md` section 6; scope is section 5 item 6.
Done: gate 4,244 tests, 4,122 passed, 33 failed (all baseline names), 89 skipped.

## Goal

Twenty questions about this repository, each with the file and line span that answers it,
in a checked-in question set. A script runs `graft ask` for each question and reports
hit-at-1 and hit-at-3 with the sample size and an interval, on a lexical graph and on the
deep-pass graph in `.trail/cache`, with the deep pass's `tokens:` line beside the numbers.

## Decisions already made

- Keyless: the harness spends no tokens. The deep graph is the one Stage 19 paid for; its
  tokens line is quoted, not rerun. The 557 pending symbols sit in files the crux pass leaves
  alone (Stage 19 follow-up), so no rerun was made.
- A span hit is a result in the answer's file whose span lies inside the answer span; a file
  node's bare path counts only when the answer is that file. A concept names files, not lines,
  so it counts for the file rate only (AGENTS.md rule 4).
- The question set and results live in `.eval/`: graft never indexes a dot-folder, and under
  `docs/` the questions' own lines ranked first for 12 of the 20.
- The script spawns `node dist/cli.js ... --json --no-refresh`, never the `.cmd` shim. The
  lexical graph is built with the global `--dir` into a scratch folder.

## Files and links that matter

- `scripts/retrieval-eval.mjs` (runner: `--dir`, `--label`, `--limit`, `--questions`, `--json`,
  `--save`) and `scripts/retrieval-eval-score.mjs` (pure scoring), `test/retrieval-eval.test.ts`.
- `.eval/retrieval-questions.json` (20 questions; each answer is a wiring node id, file, span).
- `.eval/retrieval-2026-10-26.md`: results, per-question ranks, limits, rerun commands.

## Verified facts (2026-10-26, Node 26.7.0, tree at `84b92b8`)

- Session configuration (session tool): `claude-opus-5-5`, `high`; matches.
- `test/retrieval-eval.test.ts` failed first with the module missing; a second failure-first
  test caught the file-node case. Now 10 of 10 pass, alone and inside the gate.
- Lexical (`graft --dir <scratch>/lexical build`, 9,700 nodes, no summaries, no concepts):
  hit@1 1/20 (95% CI 1% to 24%), hit@3 4/20 (8% to 42%), file@3 13/20 (43% to 82%).
- Deep (`.trail/cache`, 9,700 nodes, 9,032 summaries ready, 651 pending, 17 stale, 944 concepts):
  hit@1 6/20 (15% to 52%), hit@3 9/20 (26% to 66%), file@3 13/20 (43% to 82%). Full deep pass:
  `tokens: 2067 calls, 6,104,158 input, 806,912 cached, 1,310,478 output · openai:deepseek-flash, reasoning none`.
- Paired, deep wins 5 questions at hit@3 and at hit@1 and loses none: exact sign test p = 0.0625.
  The lexical graph leads with a whole-file node for 8 of 20; file@3 is equal.
- Gate (`npm run build && npm test`, 1,509 s, run alone between Stage 21's gates): 4,244 tests,
  4,122 passed, 33 failed, 89 skipped. All 33 failing names are in
  `docs/baselines/upstream-4e7d0f5-failures.txt`; none is outside it, so D13 holds.
- graft changed no agent files here. The lexical build appended its out-of-repo `--dir` path to
  `.gitignore` and `.ignore`; both were restored with `git checkout`.

## Work completed

- `84b92b8` feat(eval): the harness, the question set, the first run and the changelog entry.
- This handoff, committed after it.

## Unresolved questions

- The questions are not blind: written after reading several deep summaries, so wording overlap
  favours the deep graph. A set written by a session that has not seen them (operator or a later
  stage) would correct it; `--questions` takes any set.
- D11 needs one deep pass per reasoning level, each measured here; with n = 20 a difference must
  run 6 to 0 in discordant questions to pass p < 0.05 (operator decides whether to spend it).
- Bug for a later stage: `graft --dir <path outside the repo> build` on Windows writes that
  absolute path into `.gitignore` and `.ignore`, though `src/context/node-file.ts` says it no-ops
  for a dir outside the root.

## Exact next action

Stage 23, which the operator starts: **Fable 5.1 (`claude-fable-5-1`), effort high.**

```
Take over Stage 23 of docs/assessment-2026-10-18.md section 6: adversarial acceptance, one tier above the authors, of Stages 17 to 19 and also the upstream 0.25.0 merge (e3ff66e), D14 card drift as a warning (f5827f4) and Stage 20r sync-global checks (b96f716). Read AGENTS.md, docs/operator-protocol.md (gate rule: section 10, D13), and the handoffs for stages 17, 18, 18r, 19, 20 and 20r in docs/handoffs/ first. Write your own handoff first (docs/handoffs/YYYY-MM-DD-stage-23-acceptance.md) and check your model (claude-fable-5-1) and effort (high) against it. Cover: merge correctness on fixtures (fork features survive 0.25.0: structured and documents tiers, LSP edges, GRAFT_REASONING and the tokens line, per-command loading); the startup budget on this machine; the card drift check on a repository switched on and off, and D14's status, status --json and graft_check_freshness behaviour; sync-global's converter and Kotlin reports against a fake global root; and the upstream patch offered for 18. Use .eval/ and scripts/retrieval-eval.mjs as a ranking regression check if a finding touches ask. Report findings by severity with the command that shows each. Test fails first for any fix; Australian English, no em-dashes; one gate at a time (check for a gate.lock in the shared notes folder and for a running test before starting); judge failures by name against docs/baselines/upstream-4e7d0f5-failures.txt; commit on main, do not push.
```

## Cost projection

Projected: Opus 5.5, 50 turns, 80k average context: about $3.05 (quote $3 to $5).
Actual, estimated (no per-call meter): about 75 turns over two sessions (the stage was handed to a
fork when the first session moved to Stage 21), context 236k at the end, average about 150k.
Cache reads 75 x 150k = 11.25M x $0.20 = $2.25; fresh input 75 x 3k = 225k x $5.00 = $1.13;
output 75 x 1.5k = 112k x $20 = $2.25. About $5.60, over the quote because the context was
carried across the hand-off. The harness itself spent no API tokens.

## Time projection

Projected: 45 to 90 minutes plus a 30-minute gate. Actual: 11:57 to about 13:40 local, about
1 h 45 min, of which 38 min waiting for Stage 21's gate 1 and 25 min for this stage's gate.
Operator review: about 15 minutes, mostly `.eval/retrieval-2026-10-26.md`.
