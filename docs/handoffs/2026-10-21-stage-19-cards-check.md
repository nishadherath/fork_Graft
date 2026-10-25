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
  failed, 89 skipped, 1,906 s. The failures are the Trail hook, probe and wall-clock tests
  of the Stage 20 baseline class. Four names appear only in gate 2 (`skills-check-readonly`,
  `trace-repairs-review`, `claude-hooks`, `skills-anchors-review`); each passes with its
  file run alone, so they are load flakes under D13. A same-name comparison against a fresh
  plain-upstream run was not made; the Stage 20 handoff holds only part of the baseline list.
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

## Unresolved questions

- `status` and the MCP `check` tool treat card drift as not fresh, so after a query-path
  refresh that added files (cards not rewritten until the Stop hook builds) they read stale.
  Left as is; say if it should be softened.
- The deep pass left 557 symbols pending; whether to rerun for them is the operator's call.

## Exact next action

Stage 22 of the roadmap (retrieval evaluation harness), or Stage 23 acceptance of 17 to 19.

## Cost projection

Sonnet 5.5, medium ($2.00 in, $10.00 out, $0.10 cache read per million). 40 turns, average
context 60k, 3k fresh and 1.5k output per turn: cache 2.4M x $0.10 = $0.24; fresh 120k x
$2.50 = $0.30; output 60k x $10.00 = $0.60. About $1.14; quote $1 to $2.50, plus the
`--deep` pass's own spend from its `tokens:` line.

## Time projection

Wall clock 30 to 60 minutes including two gates of about ten minutes each, run one at a
time. Operator review about 15 minutes.
