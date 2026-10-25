---
stage: "Stage 19: cards-against-wiring check, refresh-path pruning, structured tier on here"
model: claude-sonnet-5-5
effort: medium
status: done
created: 2026-10-21
from: "Stage 18r session (Sonnet 5.5, high), after startup per-command loading"
---

# Stage 19: cards-against-wiring check

Roadmap Stage 19 in `docs/assessment-2026-10-18.md` section 6; scope is section 5 item 4.

## Goal

`graft check` reports drift between the per-file cards under `graft/` and the wiring
graph; the refresh path prunes cards whose source file is no longer indexed and rewrites
`INDEX.md`; the concept listing ignores a root-level card whose stem is a known source file
whether or not that file is in the current wiring. Then, in this repository,
`graft build --structured` persists the choice in `.graft/config.json`, and `--deep` runs
once so `ask` here has summaries to rank on. Each fix has a test that fails first. The gate
is green with its counts, the global install is synced, the work is committed on `main`.

## Decisions already made

- Deterministic and keyless by default (AGENTS.md rule 5): the check and the pruning use
  no network and no model. Only the single `--deep` pass spends tokens; quote its
  `tokens:` line.
- Patches live in source with a test that fails first; never edit `dist/` by hand.
- One logical change per commit: the check, the pruning and the concept-listing fix are
  three commits; the repository's own `build` runs are not committed (they write `graft/`,
  which is git-ignored here) but their results are quoted.
- Run the gate one at a time (memory note `gates-one-at-a-time`).
- Never run a graft command in this checkout without care: upkeep rewrites agent files
  (protocol section 10). Build and `--deep` in this checkout are the task, so first record
  `git status --short`, and afterwards reset any agent-file changes you did not intend.
  Try each new check in a temporary repository first.
- Keep changes to the modules the check touches so they can be offered upstream later.

## Files and links that matter

- `docs/assessment-2026-10-18.md` section 3 (the stale-card evidence: `graft/AGENTS.md`,
  `graft/Dockerfile.md`, `graft/package.md` dated 2026-10-13 listing `section` and `task`
  units; `INDEX.md` listing `Dockerfile` under Concepts) and section 5 item 4.
- `src/graph/check.ts` (`checkGraph`, `formatGraphCheckReport`), `src/graph/refresh.ts`,
  `src/graph/cards.ts`, `src/graph/write.ts`, `src/graph/fingerprint.ts`,
  `src/context/map-dir.ts`. Find the concept listing with
  `grep -rn "Concepts" src/graph src/context`.
- `docs/architecture/system-reference.md` sections 2 and 3 (what a card is, `check`).
- Commit `24608e3` loads modules per command: keep `cli.ts` imports lazy and rerun
  `test/startup-imports.test.ts`.

## Verified facts (rechecked 2026-10-25 against main at `e3ff66e`, Node 26.7.0)

- The map is in `.trail/cache/`, not `graft/` (D12); the "stale cards" of the assessment
  had been rebuilt, so tests use temporary repositories. Cards are written through
  `writeIfChanged` (upstream #472).
- Root-level cards were never pruned: `listExistingCards` walked subfolders only, because
  root cards share the folder with concept nodes. That, not the refresh path alone, is why
  a tier switched off left `README.md` and `package.md` cards behind. The refresh path is
  `graphOnly`, which writes no cards; it now calls `pruneCards`.
- The `INDEX.md` header is spelled in the brand of the command that wrote it, so `check`
  compares only from the first `## ` section down (`test/trail-name.test.ts` caught this).
- Gate 1 (before the brand fix): 4,227 tests, 4,103 passed, 35 failed, 89 skipped, 1,314 s.
  The one extra failure was mine (`trail-name`); it passed without my change, failed with it,
  and passed after the fix.
- Gate 2 (final tree, byte-identical to the three commits): 4,227 tests, 4,106 passed, 32
  failed, 89 skipped, 1,906 s. By name against `docs/baselines/upstream-4e7d0f5-failures.txt`
  (38 names, plain upstream 4e7d0f5): all 32 are in the baseline and none is outside it, so
  D13 holds. The four that first looked new (`skills-check-readonly`, `trace-repairs-review`,
  `claude-hooks`, `skills-anchors-review`) are baseline names that flake under load; each
  also passed with its file run alone. No rerun was needed for the rest.
- `build --structured` here wrote `.graft/config.json` as `{"structured": true}`
  (git-ignored). The wiring is 9,599 nodes, 997 files, 997 cards; `check` is OK with no card drift.
- `build --deep` here: 833 concept nodes, 9,042 symbols summarised, 557 pending (94% complete).
  `tokens: 2067 calls, 6,104,158 input, 806,912 cached, 1,310,478 output,
  openai:deepseek-flash, reasoning none`. Dollar cost is not computed: the fork keeps no
  vendor price in source, so price it from the provider's list at the time.
- After the pass the context-layer check says STALE for `test/cards-check.test.ts` only,
  because that test was edited while the pass ran; a plain `graft build` clears it.

## Work completed

Three commits on `main`, none pushed, tests with each fix:

1. `92a51fa` the concept listing skips a root card for an extensionless file.
2. `5585de0` the refresh prunes cards for files that left the wiring and rewrites `INDEX.md`
   (`rootFileCardPaths` in `node-file.ts`, `pruneCards` in `cards.ts`).
3. `eacef09` `graft check` reports missing, stale and orphan cards and a differing
   `INDEX.md` (`cardDrift`, `GraphCheckResult.cards`), and exits 1 for any.

`test/cards-check.test.ts` holds the tests. Global install synced (15 changed). The
three agent files graft rewrote are not committed and not mine.

## Follow-up of 2026-10-26 (operator's decisions)

```
D14 Decision:   card or INDEX.md drift in status and the MCP check tool
    Option:     warn, don't mark stale (chosen)
    Result:     `graft check` keeps exiting 1. `GraphCheckResult.inSync` is `ok` without
                card drift; `trail status` shows the code map as in sync and adds a `cards`
                row naming the files, `status --json` gains `codeMap.cardsInSync`, and
                `graft_check_freshness` reports OK with a `warning:` line. A real code
                change still reads stale. Commit `f5827f4`, tests in
                `test/cards-drift-warning.test.ts` (failed first, 4 of 4).
```

- Pending symbols: `build --deep` rerun once: 34 calls, 106,752 input, 108,544 cached,
  94,524 output tokens, `openai:deepseek-flash`, reasoning none; 54 computed, 944 concept
  nodes. The pending count stayed 557 (of 9,607). They are not retries that failed: they sit in
  files the crux pass leaves alone (`docs/architecture/system-diagram.html` 225,
  `viewer/style.css` 155, `CHANGELOG.md` 43, `package.json` 43, and so on; kinds: selector
  310, section 113, key 64, function 45, element 25). Rerunning will not clear them.
- Gate 3 (after D14, deep rerun done, Node 26.7.0): 4,231 tests, 4,100 passed, 42 failed,
  89 skipped, 2,073 s. By name against `docs/baselines/upstream-4e7d0f5-failures.txt`: 33 are
  baseline names; 9 are not (`claude-hook-timeouts`, `claude-journeys-2`,
  `skills-check-readonly`, `skills-prompt-attacks`, `skills-session-start`,
  `skills-ship-credit`: the D137, J13, compaction, SessionStart, dontAsk, ship and prompt-hook
  budget tests). Their six files run alone: 47 tests, 45 pass, and the 2 that fail are
  baseline names. So all 9 are load flakes of the baseline class, none a fault of D14, and D13 holds.
- Global install synced after the build of `f5827f4`.
- Open: none from this stage.

## Exact next action

Stage 22 of the roadmap (retrieval evaluation harness). Next stage: **Opus 5.5, effort high.**

```
Take over Stage 22 of docs/assessment-2026-10-18.md section 6: the retrieval evaluation harness (section 5 item 6). Read AGENTS.md, docs/operator-protocol.md (gate rule: section 10, D13) and docs/handoffs/2026-10-21-stage-19-cards-check.md first. Write your own handoff first and check your model (claude-opus-5-5) and effort (high) against it. Twenty questions about this repository, each with the span that answers it; a script that runs `graft ask` and reports hit-at-1 and hit-at-3; run it on the lexical graph and on the deep-pass graph now in .trail/cache, with the deep pass's tokens line beside the numbers. Test fails first; Australian English, no em-dashes; run gates one at a time; commit on main, do not push.
```

## Cost projection

Projected: Sonnet 5.5, medium, about $1.14 (quote $1 to $2.50) plus the `--deep` pass.
Actual: session API spend was not measured (no usage tool run). The deep pass is
2067 calls, 6,104,158 input (806,912 cached) and 1,310,478 output tokens on
`openai:deepseek-flash`; price it from the provider's list.

## Time projection

Projected: 30 to 60 minutes, two gates of about ten minutes. Actual: roughly three hours of
wall clock for the first pass; the follow-up added a third gate (2,073 s), the deep rerun and
the D14 change, about an hour more. First pass: roughly three hours of wall clock, dominated by two full gates (1,314 s and 1,906 s on this machine, against the
projection's 583 s from 0.23.0) and the deep pass. Operator review about 15 minutes.
