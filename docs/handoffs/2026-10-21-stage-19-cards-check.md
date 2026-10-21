---
stage: "Stage 19: cards-against-wiring check, refresh-path pruning, structured tier on here"
model: claude-sonnet-5-5
effort: medium
status: ready
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

## Verified facts

- Gate on `24608e3`: 1,668 tests, 1,656 passed, 0 failed, 12 skipped, 583 s.
- This repository's graph on 2026-10-18 had no structured nodes and no summaries, and
  `.graft/config.json` did not exist (assessment section 8). Not re-checked since the merge
  and the defaults-on change; re-check with `git status --short` and a read of the files.
- `.trail/cache/` is where upstream's `mapDirFor` puts this checkout's map (operator
  decision D12, decided A on 2026-10-21: keep it there); the cards the assessment names
  are under `graft/`.
  Confirm which folder holds the stale cards before writing the test.

## Work completed

None.

## Unresolved questions

- Whether the stale cards still exist after the move to `.trail/cache/` (D12). If they do
  not, build the fixture in a temporary repository instead.
- Whether pruning belongs in `refresh.ts` or `write.ts`; pick the place the cards are
  already written and say why in the commit.

## Exact next action

Read assessment section 3 and section 5 item 4, then in a temporary repository reproduce
a stale card (build with a file, delete the file, build again) and write the failing test
for `graft check` reporting it. Escalate on the persona's section 3.3 triggers (a change
to the card format or `graph.json` shape is one).

## Cost projection

Sonnet 5.5, medium ($2.00 in, $10.00 out, $0.10 cache read per million). 40 turns, average
context 60k, 3k fresh and 1.5k output per turn: cache 2.4M x $0.10 = $0.24; fresh 120k x
$2.50 = $0.30; output 60k x $10.00 = $0.60. About $1.14; quote $1 to $2.50, plus the
`--deep` pass's own spend from its `tokens:` line.

## Time projection

Wall clock 30 to 60 minutes including two gates of about ten minutes each, run one at a
time. Operator review about 15 minutes.
