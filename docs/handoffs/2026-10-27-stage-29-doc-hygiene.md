---
stage: "Stage 29: documentation hygiene (D25 option A)"
model: claude-haiku-5-5
effort: medium (confirmed by get_session self; brief named medium)
status: done
created: 2026-10-27
from: "Stage 28 handoff, roadmap item 4 of docs/assessment-2026-10-27.md, decision D25 answered A"
---

# Stage 29: documentation hygiene

## Goal

Archive the closed upstream texts and the astra assessment under `docs/archive/`, with a note that
the plan closed on 2026-10-26; keep the security advisory in `docs/security/` for the operator to
send; fix every path that pointed at a moved file. Documentation only, no release, no tag, no push.

## Decisions made

- Moved with `git mv` so history follows: `docs/upstream/` to `docs/archive/upstream/` (six files),
  and `docs/graft-assessment-6.0-astra.md` to `docs/archive/graft-assessment-6.0-astra.md`.
- The note is one paragraph in `docs/archive/README.md`, covering both moves and the closed plan.
- `docs/graft-decisions-6.0-astra.md` moved to `docs/archive/graft-decisions-6.0-astra.md` in commit
  `18fac1c`, on the operator's word after this handoff was first written.
- Path references are changed in place; the words of dated records (assessments, acceptance notes,
  handoffs) are not. Two passages keep the old paths on purpose: roadmap item 4 in
  `docs/assessment-2026-10-27.md` (the instruction as written) and the D25 "Facts" line in the same
  file (the decision record as taken).
- The advisory `docs/security/2026-10-15-graft-mcp-npx-launcher-advisory.txt` is untouched, reporter
  and status lines still blank, for the operator to fill when they send it.

## Files that matter

- `docs/archive/README.md`: the note.
- `docs/archive/upstream/*.md`, `docs/archive/graft-assessment-6.0-astra.md`: moved, history kept.
- `docs/acceptance-2026-10-13.md`, `docs/assessment-2026-10-18.md`, `docs/assessment-2026-10-27.md`:
  path fixes.
- Nine handoffs under `docs/handoffs/` (2026-10-13 stages 5, 6 and 7; 2026-10-18 stages 15 and 16;
  2026-10-21 stage 18): path fixes only.
- `scripts/test-runner-lib.mjs` holds `UPSTREAM_REF = "upstream/main"`: a branch name, not a path,
  so it is unchanged.

## Verified facts

- Commits on `main`, in order: `c7860f8` (move upstream texts), `1f8aadb` (move astra assessment),
  `31fc509` (archive note), `e0e88d7` (path fixes), `4551492` (heading fix in the Stage 5 acceptance
  notes). Each carries the Haiku co-author line.
- `git grep 'docs/upstream'` after the fixes: 2 hits, both the deliberate two above.
- Gate, `npm run build && npm test`, Node 26.7.0, on `4551492` plus this handoff's parent:
  4,300 tests, 4,167 pass, 44 fail, 89 skipped, 2,014.8 s (about 34 min). Exit 1.
- D13 judgement by name against `docs/baselines/upstream-4e7d0f5-failures.txt` (38 lines, 32 names
  in the failing run): 32 of 44 failures are in the baseline; 12 are not, all in hook and journey
  tests with wall-clock bars that this machine runs slowly under load.
- Each of the 12 non-baseline failures was rerun alone by file (`node --import tsx --test`,
  `NODE_TEST_CONTEXT` unset): `skills-credit-1b-review` 4/4, `claude-journeys-2` 8/8,
  `claude-journeys-save` 2/2, `claude-journeys-3` 3/3, `claude-init-workspace` 5/5,
  `skills-ship-credit` 6/6, `claude-hooks-perf` 1 pass 1 skipped, `claude-hook-timeouts` 8/8,
  `claude-journeys-recall` 5/5, `skills-probes` 4 pass with 2 failures that are both baseline names
  ("git probes: clean tree..." and "cached 10 minutes by checkout and probe..."). Green under D13.
- The run is the same count band as Stage 28 (4,300 tests, 32 baseline names): no new failure
  that the rerun did not clear.

## Work completed

- Moves, archive note, path fixes as above; gate run and D13 judgement; this handoff.

## Open questions

- The non-baseline hook failures are timing bars on a loaded machine. They passed alone; whether
  the bars should widen is a separate decision, not taken here.

## Cost and time

Model: `claude-haiku-5-5`, medium. Context at the time of the usage read: 130,757 tokens (13 percent of
the 1,000,000 window). The roadmap assumed 40k average, so the cache-read term is larger than the
roadmap's $0.04: about 30 turns at 130k gives 30 times 130,000 is 3.9 million cache-read tokens,
which at the Haiku cache-read rate of $0.01 per million (roadmap section 6) is about $0.04. Fresh
input and output were not recomputed. Wall clock: the gate took 34 minutes, the per-file reruns a
few minutes, plus the stage's own work. Operator review: about 10 minutes.

## Next

Stage 30 (Opus 5.5, high) is not started. Decision D26 was answered A (wait), so Stage 30 needs the
operator to name an upstream release first. See the roadmap, section 6, item 5.
