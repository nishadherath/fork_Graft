---
stage: "Stage 9: merge upstream/main into main, gate, sync the global install"
model: claude-sonnet-5-5
effort: medium
status: in-progress
created: 2026-10-14
from: "Sonnet 5.5 Stage 8 session, operator decision: option C"
---

# Stage 9: merge upstream/main into main

## Goal

`main` keeps its linear history and gains the 13 upstream commits it lacks
(`graft trail watch`, the session-start trail check, dependency bumps, the
trailhq/Graft metadata). Done when `git diff main pr/documents-tier -- src test`
shows only known differences, `npm run build && npm test` is green with counts
quoted, and the global install is synced. Nothing pushed.

## Decisions already made

- Option C: merge, not reset and not rebase. Reason: keeps the hashes the
  handoffs and acceptance docs cite; `main` is unpushed but history rewrite buys nothing.
- Work in a worktree of `main`; one `npm test` at a time.
- `package-lock.json` is regenerated, not hand-merged:
  `npm install --package-lock-only --ignore-scripts`.
- Sync only after a green gate.

## Files and links that matter

- `docs/operator-protocol.md` section 10 (Kotlin binary copy after `npm ci --ignore-scripts`).
- `scripts/sync-global.mjs`.
- `git merge-tree --write-tree --name-only main upstream/main` predicted a
  conflict in `package-lock.json` only.

## Verified facts

- `git rev-list --count main..upstream/main` = 13; `upstream/main` = `fe30ead`; merge base `375a37e` (2026-10-14).
- `main` is 83 commits ahead of `origin/main` (`f9e6539`), unpushed.
- Stage 8 gate on `main` before this stage: 1,509 tests, 1,504 pass, 0 fail, 5 skipped.
- The pr/ branches are rebased on `fe30ead`.

## Work completed

Nothing yet in Stage 9.

## Unresolved questions

- Operator: pushing `main` publishes the persona, handoffs and acceptance docs to the public `nishadherath/fork_graft`. Not this stage.

## Exact next action

`git worktree add ../fork_graft-stage9-main -b stage-9/merge-upstream main`, then `git merge upstream/main`.

## Cost projection

Sonnet 5.5, medium ($2.00 in, $10.00 out, $0.20 cache read per million).
Assumptions: 20 turns, average context 70k, 3k fresh input and 1.5k output per
turn. Cache 20 x 70k = 1.4M x $0.20 = $0.28. Fresh 20 x 3k = 60k x $2.50 = $0.15.
Output 20 x 1.5k = 30k x $10 = $0.30. About $0.73; quote $0.50 to $1.50. Estimate.

## Time projection

Wall clock 15 to 20 minutes: about 8 minutes of model time and one gate of
about 7 minutes. Operator review: about 5 minutes.
