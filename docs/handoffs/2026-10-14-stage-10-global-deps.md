---
stage: "Stage 10: bring openai and @anthropic-ai/sdk in the global install to the fork's ranges"
model: claude-sonnet-5-5
effort: medium
status: in-progress
created: 2026-10-14
from: "Sonnet 5.5 Stage 9 session, operator decision: dependency copy"
---

# Stage 10: global install dependencies

## Goal

The global install's `openai` and `@anthropic-ai/sdk` satisfy the fork's
`package.json` ranges (^7.8.0 and ^0.122.0), the old folders are backed up, and
the global `graft` still answers `--version` and a keyless `ask`. Nothing pushed.

## Decisions already made

- Copy the two packages from a fresh `npm ci --ignore-scripts` in a throwaway
  worktree; no global reinstall (Kotlin does not compile here, protocol section 10).
- Back up the two old folders before overwriting, outside the global tree.
- Copy only these two; other differences are out of scope.

## Files and links that matter

- `docs/operator-protocol.md` section 10; `docs/handoffs/2026-10-14-stage-9-merge-upstream-into-main.md`.
- Global install: `npm root -g` / `@nanonets/graft/node_modules`.

## Verified facts

- Global before: openai 6.49.0, @anthropic-ai/sdk 0.117.1 (`node -e` on their package.json, 2026-10-14).
- Fork wants ^7.8.0 and ^0.122.0 (`package.json` on `main`, `8cd322c`).

## Work completed

Nothing yet in Stage 10.

## Unresolved questions

- Operator: pushing `main`. Not this stage.

## Exact next action

`git worktree add ../fork_graft-stage10-main -b stage-10/global-deps main`, then `npm ci --ignore-scripts`.

## Cost projection

Sonnet 5.5, medium ($2.00 in, $10.00 out, $0.20 cache read per million).
Assumptions: 12 turns, average context 60k, 2k fresh input and 1k output per
turn. Cache 12 x 60k = 0.72M x $0.20 = $0.14. Fresh 12 x 2k = 24k x $2.50 = $0.06.
Output 12 x 1k = 12k x $10 = $0.12. About $0.32; quote $0.25 to $0.75. Estimate.

## Time projection

Wall clock 8 to 12 minutes; no full test gate (no source change). Operator review: about 3 minutes.
