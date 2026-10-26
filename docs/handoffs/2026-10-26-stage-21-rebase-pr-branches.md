---
stage: "Stage 21: rebase the five PR branches onto upstream 0.25.0, gate each, open the pull requests"
model: claude-sonnet-5-5
effort: high
status: ready
created: 2026-10-26
from: "Roadmap session (Haiku 5.5, local_2a1bae05) after Stage 20r (b96f716). Scope from assessment section 6 stage 21 and section 5 item 5; the 0.23.0 base there is now 0.25.0."
---

# Stage 21: rebase the five PR branches onto upstream, gate each, open the pull requests

Roadmap Stage 21 in `docs/assessment-2026-10-18.md` section 6; scope is section 5 item 5.
The base release moved: the assessment names upstream 0.23.0, but `main` merged upstream
0.25.0 (`trailhq/Trail-Code` `4e7d0f5`) on 2026-10-25 (Stage 20). Rebase onto that.

## Goal

Each of the five `pr/*` branches carries only its feature's `src/`, `test/`, `CHANGELOG.md`,
`CREDITS.md` and `README.md` commits on top of `upstream/main` (protocol and AGENTS rule 3),
passes the gate on this machine, and has a pull request open against `trailhq/Trail-Code`.
Done means: five branches rebased, five gate results quoted by name against the baseline,
path audits clean, and the operator has approved each push before it happens.

## Decisions already made

- Branches are cut from `upstream/main`, never from `main` (AGENTS.md rule 3).
- Gate per branch is `npm run build && npm test`, one at a time (memory `gates-one-at-a-time`).
  Judge by name against the baseline (D13, protocol section 10). A test that fails on one side
  only is rerun alone before it is called a fault.
- Baseline for D13 is `docs/baselines/upstream-4e7d0f5-failures.txt` (38 names, plain upstream
  `4e7d0f5`). A branch has its own baseline run only if upstream moved since.
- Windows paths and `relPosix` as AGENTS.md rule 7 says; no vendor facts in source.

## Decision for the operator (not yet made)

Pushing and opening pull requests is outward-facing. The stage prepares everything, then stops
before any `git push` and asks the operator, per branch or for all five at once.
- Options: (a) push and open all five after one approval; (b) one approval per branch.
- Pros of (a): one step. Cons: a wrong branch reaches upstream in one go.
- Blast radius: five public branches and five pull requests on `trailhq/Trail-Code`.
- Recommendation: (b), because each branch is independent and upstream may ask for changes.

## Files and links that matter

- The five branches: `pr/crux-id-echo`, `pr/documents-tier`, `pr/structured-edges`,
  `pr/structured-tier-core`, `pr/structured-tier-markup-build` (`git branch --list`).
- `docs/assessment-2026-10-18.md` section 5 item 5, section 6 stage 21, section 7 (open decisions).
- `docs/operator-protocol.md` section 10 (upstream and PR mechanics, D13).
- `docs/handoffs/2026-10-25-stage-20-merge-upstream-0.25.0.md` (the 0.25.0 merge and its gate).
- `docs/baselines/upstream-4e7d0f5-failures.txt`.
- Memory notes: `gh-cli-absent-use-gcm-token` (no `gh` CLI; open PRs via REST with the
  credential-manager token, never print it), `upstream-moved-to-trailhq`.

## Verified facts

- `upstream/main` is at `4e7d0f5` (`git log -3 upstream/main`, 2026-10-26).
- `main` is at `b96f716` (Stage 20r) and contains the 0.25.0 merge.
- Local branches exist for all five `pr/*` names (`git branch --list`, 2026-10-26).
- Stage 22 (`docs/handoffs/2026-10-26-stage-22-retrieval-eval.md`) is in progress in another
  session. Do not touch its files. `docs/handoffs/README.md` says the newest file by name is
  the active handoff; this file sorts before stage 22's, so stage 22 stays the announced one.

## Unresolved questions

- The answer to the upstream issue from Stage 16 (the design issue about the 0.23.0 text, and
  the upstream question). Operator decides. Without it, pull requests may not be wanted.
- Whether to push all five at once or one by one (decision above).

## Exact next action

`git log --oneline upstream/main..pr/crux-id-echo --stat` to confirm each branch's current
feature commits, then rebase the first branch onto `upstream/main` in a worktree and run its gate.

## Cost projection

Roadmap estimate (assessment stage 21): 80 turns, 90k context, Sonnet 5.5 at list price:
$2.52 (range $2.50 to $5). Arithmetic per assessment section 6 method; not re-measured.

## Time projection

Measured on this machine today: the full gate took 2,015 s (33.6 min, Stage 20r). Five
sequential gates are therefore about 168 min (5 × 33.6), plus rebases and path audits, so about
3 to 3.5 hours of agent wall clock. The roadmap's 60 to 120 minutes assumed an 8-minute gate and
is superseded. Operator review: 30 to 45 minutes.
