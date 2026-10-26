# Retrieval evaluation, 2026-10-26 (Stage 22)

The first measurement of `graft ask` on this repository, run with `scripts/retrieval-eval.mjs`
over the twenty questions in `.eval/retrieval-questions.json`. It is the baseline for D11 (the
deep pass's reasoning level) and for any ranking change. Both folders are dot-folders on purpose:
graft never indexes one, and with the question set under `docs/` the questions' own lines ranked
first for 12 of the 20.

## Result

| Graph | hit@1 | hit@3 | file@3 |
|---|---|---|---|
| Lexical (plain build, no deep pass) | 1/20, 5% (1% to 24%) | 4/20, 20% (8% to 42%) | 13/20, 65% (43% to 82%) |
| Deep (`.trail/cache`, Stage 19's pass) | 6/20, 30% (15% to 52%) | 9/20, 45% (26% to 66%) | 13/20, 65% (43% to 82%) |

Intervals are 95% Wilson intervals; n = 20, so they are wide. A span hit is a result in the
answer's file whose span lies inside the answer span; a file node's bare path counts only when the
answer is that file. file@3 counts any of the top three that names the answer's file, concepts
included.

Deep pass beside the numbers: the full pass of 2026-10-25 (Stage 19) printed
`tokens: 2067 calls, 6,104,158 input, 806,912 cached, 1,310,478 output · openai:deepseek-flash, reasoning none`;
the one rerun after it (the manifest's `deepUsage`, which keeps only the last run) printed
`tokens: 34 calls, 106,752 input, 108,544 cached, 94,524 output · openai:deepseek-flash, reasoning none`.
Price them from the provider's list; the fork keeps no price in source.

## What it says

- **The deep pass changes where in a file ask points, not which file it finds.** file@3 is 13 of
  20 on both graphs. The lexical graph leads with the whole-file node for 8 of the 20 (a bare path,
  too coarse to be a span hit); the summaries let the answering symbol outrank its own file.
- **Paired, the deep graph wins 5 questions at hit@3 and loses none** (`prune-cards`,
  `ask-index-corrupt`, `extraction-tier`, `repo-relative-posix`, `supported-languages`); at hit@1
  also 5 to 0. An exact sign test on 5 to 0 gives p = 0.0625 two-sided: suggestive, not settled.
- **Three questions fail on both graphs even at file level within eight results**:
  `test-path-derank` (test files outrank `isTestPath`), `stage-cost-projection` (an older handoff's
  cost section outranks the protocol's) and `test-runner-windows` (`scripts/run-tests.mjs` has only
  a file node, with no symbol to match). These are the ranking cases to study first.

## Limits of this run

- **The questions are not blind.** They were written by the session that built the harness, which
  had read the deep summaries of several answers while picking them; wording borrowed from a
  summary favours the deep graph. A set written by someone who has not seen the summaries is the
  correction, and the harness takes any set with `--questions`.
- **One deep graph, so D11 is not settled here.** The reasoning-level question needs one deep pass
  per level, each measured with this harness. With n = 20, discordant questions must run at
  least 6 to 0 (p = 0.031) before a difference passes p < 0.05.
- **The deep graph is not fully summarised.** It holds 9,032 ready, 651 pending and 17 stale of
  9,700 nodes. 557 of the pending sit in files the crux pass leaves alone
  (`docs/architecture/system-diagram.html`, `viewer/style.css`, `CHANGELOG.md`, `package.json`
  and others; Stage 19), so a rerun would not clear them and none was made. The rest are files
  added or changed since the pass, these scripts among them.
- Both graphs were measured at the same tree (9,700 nodes each, `--no-refresh`); the lexical one
  was built with `graft --dir <scratch> build`, so `.trail/cache` kept the deep pass.

## Per question

Rank of the first span hit and of the first file hit in the top eight; `-` is none.

| Question | Lexical span | Lexical file | Deep span | Deep file |
|---|---|---|---|---|
| crux-echoed-id | - | 1 | - | 1 |
| card-drift | - | 3 | - | 4 |
| prune-cards | - | 1 | 1 | 1 |
| ask-index-corrupt | - | 2 | 1 | 1 |
| test-path-derank | - | 6 | - | - |
| path-probe-no-spawn | - | - | 5 | 5 |
| file-first-round-robin | - | 2 | - | 3 |
| learning-signals | - | - | - | 7 |
| extraction-tier | - | 2 | 1 | 1 |
| repo-relative-posix | - | 1 | 1 | 1 |
| map-dir | - | 1 | - | 1 |
| supported-languages | 5 | 5 | 3 | 3 |
| tokens-line | 6 | 6 | 7 | 7 |
| pdf-pages | 2 | 2 | 2 | 2 |
| optional-converter-import | - | 1 | - | 1 |
| deep-unit-bound | 3 | 3 | 3 | 2 |
| refresh-before-query | 2 | 2 | 1 | 1 |
| sync-global-report | 1 | 1 | 1 | 1 |
| stage-cost-projection | - | - | - | - |
| test-runner-windows | - | - | - | - |

## Rerun

```
npm run build
node scripts/retrieval-eval.mjs --label deep
node dist/cli.js --dir <scratch>/lexical build
node scripts/retrieval-eval.mjs --dir <scratch>/lexical --label lexical
```

Each run takes about 2.5 minutes here (20 queries, about 8 s each). A build with an out-of-repo
`--dir` appends that path to `.gitignore` and `.ignore`; restore both afterwards.
