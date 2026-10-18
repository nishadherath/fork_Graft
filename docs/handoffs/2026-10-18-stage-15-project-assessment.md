---
stage: "Stage 15: project assessment, and the analysis brief recorded"
model: claude-fable-5-1
effort: high
status: done
created: 2026-10-18
from: "the operator's analysis brief of 2026-10-18"
---

# Stage 15: project assessment, and the analysis brief recorded

## Goal

Answer the operator's six analysis questions for the whole project directory in
a dated document, record the brief so every session loads it, and leave the
next stages specified. Done when `docs/assessment-2026-10-18.md` exists with
measured facts and a priced roadmap, the brief is in the protocol and pointed
at from `AGENTS.md`, the gate is green, everything is committed and the next
stage has a handoff.

## Decisions already made

- The analysis target is the project directory (operator's answer, 2026-10-18;
  there is no `seed/` here).
- The brief is recorded verbatim as protocol section 1.1, with `AGENTS.md`
  rule 8 pointing at it; assessments are dated `docs/assessment-YYYY-MM-DD.md`.
- The roadmap and its model tiering are the assessment's section 6; the open
  operator decisions D8 to D11 are its section 7. Stage 17 (merge upstream
  0.23.0, Opus 5.5 high) is the next stage; Stage 16 (Haiku, the upstream text
  refresh) ran inside this session as a subagent and is done.

## Files and links that matter

- `docs/assessment-2026-10-18.md`: the deliverable; section 8 holds every
  measurement with its command.
- `docs/operator-protocol.md` section 1.1 and `AGENTS.md` rule 8: the brief.
- `docs/handoffs/2026-10-18-stage-17-merge-upstream-0.23.0.md`: next stage.
- `docs/handoffs/2026-10-18-stage-16-upstream-texts-refresh.md`: done by the
  subagent; its outputs are `docs/upstream/design-issue.md` and
  `docs/security/2026-10-15-graft-mcp-npx-launcher-advisory.txt`.

## Verified facts (2026-10-18)

- Gate on `main` at `0cd3be6` plus the uncommitted docs: `npm run build && npm test`
  on Node 26.7.0, 1,553 tests, 1,548 passed, 0 failed, 5 skipped, 419.9 s.
- `node scripts/sync-global.mjs` after the gate: 88 files changed, 0 stale
  removed, 743 unchanged; the global `graft --version` answers
  `0.21.1-nishadherath.1`. The 88 differences mean the global `dist/` before
  today was not byte-identical to this tree's build (Stage 14 built in a
  worktree); it is now.
- `git show d45a801:src/hosts/mcp-config.ts` (0.22.0) and `0a79092` (0.22.1)
  both have `spawnSync('graft', ['--version'], ...)` at line 57, as does
  `upstream/main` (0.23.0).
- Every other fact is in the assessment's section 8.

## Work completed

- `050b036` docs(protocol): the price correction found uncommitted at session
  start, committed on its own.
- `0cd3be6` docs(protocol): the brief recorded as section 1.1, `AGENTS.md`
  rule 8, the dead 2026-10-11 pointer replaced.
- Committed with this file: `docs/assessment-2026-10-18.md`, this handoff and
  the Stage 16 and 17 handoffs.
- Committed after it: the Stage 16 outputs (advisory header and section 2,
  design issue name split and rebase note), produced by a Haiku 5.5 medium
  subagent from the Stage 16 handoff and checked against `git diff` here.
- Memory note `upstream-moved-to-trailhq` updated with the 0.23.0 facts.

## Unresolved questions

- Operator: D8 (what the fork is for), D9 (keep the `graft` name), D10 (send
  the advisory), D11 (`GRAFT_REASONING` unset); assessment section 7.
- Operator: the advisory's section 8 patch is written against `fe30ead`;
  upstream's `mcp-config.ts` at 0.23.0 added the trail launcher entries, so the
  patch may need re-basing before sending. Stage 17 can produce it.
- Operator: post the design issue (plan D5 A) after reading the refreshed text.

## Exact next action

Stage 17, in a new session on Opus 5.5 at high effort:
`git worktree add ../fork_graft-stage17-main -b stage-17/merge-upstream main`,
then its handoff's steps.

## Cost projection

Actual, this stage: Fable 5.1 high, about 31 turns, context grown from 80k to
330k (the usage tool read 270k at turn 20). Cache reads about 5.3M x $0.25 =
$1.32; cache writes about 330k x $10.00 x 1.25 = $4.13; output about 110k x
$50.00 = $5.50. About $11 at list price; the Haiku subagent about $0.05 (97k
tokens, 12 tool uses, 103 s).

## Time projection

Actual: about two hours of wall clock, including one gate of seven minutes
and the subagent's two minutes. Operator reading time for the assessment:
about 25 minutes.
