---
stage: "Stage 31: retrieval, second round (blind set, the three failures, D11)"
model: claude-opus-5-5
effort: high (confirmed by get_session self)
status: done
created: 2026-10-27
from: "Stage 29 handoff's roadmap; roadmap item 6 of docs/assessment-2026-10-27.md, dispatched by local_60e06b5a"
---

# Stage 31: retrieval, second round

## Goal

A blind twenty-question set; the three questions that failed at file level on both graphs
diagnosed, with any ranking change measured before and after on both sets; D11 settled by one deep
pass per reasoning level, each measured and quoted by its `tokens:` line. No upstream merge, no
push, no release.

## Decisions made

- Every graph was built and every measurement run in `git clone`s of `main` at `1d93158` under
  `%TEMP%\s31`, never in this checkout. `scripts/retrieval-eval.mjs --root <copy>` (new) runs `ask`
  inside the copy. The deep passes and the "before" runs used a frozen copy of `dist/` at
  `1d93158` (`%TEMP%\s31\cli-head`, `node_modules` junctioned), so rebuilding `dist/` mid-stage
  changed nothing they ran.
- Blindness: Stage 31a (`docs/handoffs/2026-10-27-stage-31-a-blind-question-set.md`), a Sonnet 5.5
  subagent at medium, worked in a clone with `.eval/`, `docs/handoffs/`, `docs/archive/` and
  `docs/assessment-*.md` deleted; its brief named no earlier question or result; it built its own
  lexical graph, read only source, used `wiring.json` only to look up ids of answers already chosen,
  and ran no `ask`, `find` or MCP graft tool. Leaks that remained: `test/retrieval-eval.test.ts`
  names `relPosix` in a fixture and `AGENTS.md` names it as the path rule; one blind answer is
  `relPosix`. `split-long-file-list` sits near the old runner question's topic. Recorded in
  `.eval/retrieval-2026-10-27.md`.
- Levels measured: `none`, unset (provider default) and `high`, the D11 options plus the upper end.
- One ranking change only (`wantsTests`), because it was the shared cause of two failures and a
  small, query-time change. The other two failures are recorded, not changed (below).

## Files that matter

- `.eval/retrieval-2026-10-27.md`: all numbers, per-question findings, the tokens lines, rerun.
- `.eval/retrieval-questions-blind.json`: the blind set. `test/retrieval-eval.test.ts` checks both sets.
- `src/ask/ask.ts` (`wantsTests` in `lexical`), `test/ask-test-intent.test.ts`.
- `scripts/retrieval-eval.mjs`, `scripts/retrieval-eval-score.mjs` (`runPlace`).

## Verified facts

- Session: `claude-opus-5-5`, effort `high` (`get_session self`, at start).
- Old set reproduced on the new lexical clone before any change: hit@3 4/20, file@3 13/20.
- Harness, after the fix (hit@3 / file@3 of 20). Stage 22 set: lexical 4 / 14 (file@3 was 13), none
  7 / 15, default 8 / 16, high 9 / 16 (file@3 was 15). Blind set: lexical 2 / 12, none 3 / 13,
  default 3 / 13, high 3 / 12, each unchanged by the fix. No question got worse on any graph.
- Tokens lines: none `2133 calls, 1,057,174 input, 6,067,491 cached, 1,342,512 output`; default
  `2137 calls, 3,416,116 input, 3,799,343 cached, 1,857,147 output (405,778 reasoning)`; high
  `2137 calls, 900,106 input, 6,321,116 cached, 1,891,562 output (435,865 reasoning)`; the two
  reasoning passes each report 1,108 forced-tool calls run with reasoning off. Wall clock 29:37,
  36:46, 37:07, run at the same time.
- Paired hit@3 between levels: at most 0 : 2 (p = 0.50) on the Stage 22 set, 0 : 0 on the blind set.
- `test/ask-test-intent.test.ts` failed first on the machinery query and passes after;
  `test/ask.test.ts`, `ask-fusion`, `ask-scope-comparability` with it: 65 of 65.
  `test/retrieval-eval.test.ts` 13 of 13 (`runPlace` failed first, missing export).
- Gate, `npm run build && npm test`, Node 26.7.0, started 20:04:40 on `41c689d` (all of this
  stage's code; every later commit is docs only): 4,304 tests, 4,176 pass, 39 fail,
  89 skipped, 2,078.6 s. Exit 1. By name against `docs/baselines/upstream-4e7d0f5-failures.txt`:
  33 baseline names, 6 not, in `trace-multiturn`, `trace-perf`, `skills-prompt`,
  `claude-hook-timeouts`, `claude-prompt-private`, `claude-journeys-learnings`. Each file rerun alone
  (`node --import tsx --test`, `NODE_TEST_CONTEXT` unset): 11/11, 1 pass 1 skipped, 16 of 18 (the 2
  failures are baseline names), 8/8, 6/6, 4/4. Green under D13.

## Work completed

- `28b9194` Stage 31a brief; `479f565` `--root`; `36a78e3` blind set; `012328e` the `wantsTests`
  fix; `ce99677` results record; this handoff.

## Decision for the operator

```
D11 Decision:      GRAFT_REASONING for the deep pass on this machine
    Facts:         one tree, three passes, both sets: hit@3 none 7, default 8, high 9 on the
                   Stage 22 set (best pair 0 : 2, p = 0.50) and 3, 3, 3 on the blind set;
                   output 1.34M, 1.86M, 1.89M tokens; 30, 37, 37 minutes; 1,108 of 2,137
                   calls cannot take reasoning on this provider at any level; two passes at
                   level none (Stage 22 and today) differ by 2 at hit@3. The user environment
                   today has GRAFT_REASONING unset, so the next pass runs at provider default.
    Options:       A leave unset (provider default)
                   B set GRAFT_REASONING=none in the user environment
                   C set GRAFT_REASONING=high
    Pros and cons: A costs nothing to do and pays about 38% more output and 7 more minutes
                     per pass for no measured gain.
                   B is the cheapest and fastest pass at the same measured quality; gives up a
                     gain this sample cannot see (the Stage 22 set leans 2 questions to high,
                     the blind set none).
                   C bets on that lean: 41% more output for a difference at noise level.
    Blast radius:  one user environment variable; every later `build --deep` on this machine,
                   in any repository. No code, no release. Reversible by unsetting it.
    Recommended:   B, because the quality is equal within noise on both sets and output tokens
                   are the expensive ones; revisit only with a set large enough to see a
                   two-question difference (about 6 : 0 discordant is needed at n = 20).
```

## Open questions

- Blind-set span misses (file found, span not) are the next ranking question; a stage that
  takes it needs a larger blind set first. Operator or the Stage 32 assessment.
- `test-runner-windows` lexically: a symbol-less script's header is buried by BM25 length
  normalisation; a fix changes the `ask` index format. Not proposed until the blind set shows
  the case matters. Its recorded answer is partly stale since Stage 28.
- `ask.ts` is upstream's file: the `wantsTests` change is a merge seam for Stage 30.

## Next

Stage 32: Fable 5.1 (`claude-fable-5-1`), effort high. Kickoff prompt in the stage report.

## Cost and time

This session, Opus 5.5 at high, estimated (no per-call meter): about 110 turns; context 279k at
the end (usage tool), average about 180k. Cache reads 110 x 180k = 19.8M x $0.20 = $3.96; fresh
input 110 x 3k = 330k x $5.00 = $1.65; output 110 x 1.5k = 165k x $20 = $3.30. About $8.90, over
the roadmap's $3.78 ($4 to $8) because the turns ran near double and the context grew early.
Stage 31a, Sonnet 5.5 at medium: 101,665 tokens in all; even if every one were output at $10 per
million it is $1.02, so under that. The three deep passes are the provider's charge for the
tokens lines above; the fork keeps no price for them.
Wall clock: 19:01 to about 20:50, 1 h 50 min, of which the passes 38 min (concurrent) and the gate
35 min (20:04:40 to 20:40:50). Operator review: about 30 minutes, mostly
`.eval/retrieval-2026-10-27.md` and D11.
