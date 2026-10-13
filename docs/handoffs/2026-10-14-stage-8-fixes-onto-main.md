---
stage: "Stage 8: carry the Stage 7 fixes onto main, gate, sync the global install"
model: claude-sonnet-5-5
effort: medium
status: done
created: 2026-10-14
from: "Sonnet 5.5 Stage 7 session (acceptance fixes and stack rebase), 2026-10-14"
---

# Stage 8: the Stage 7 fixes onto main

First confirm your own model and effort match the front matter (session tool,
`self`); if not, stop and say which to pick in the model menu. Load
`ENGINEERING_PERSONA.md` and `ENGINEERING_PERSONA_LANGUAGES/node-ts-js.sonnet.md`.
Set the status to `in-progress` on starting, `done` on finishing, in this file.

## Goal

`main` carries the same structured and documents tiers as the pull-request
branches (its own linear history, not the branches' hashes), so it also carries
the four defects Stage 6 found. Apply the six Stage 7 fix commits to `main`,
gate `main` green, and copy the build into the global install, so every other
repository's `graft` command has the fixes. Nothing pushed.

## Decisions already made

- The fixes are the branch commits, not a rewrite: cherry-pick, in this order,
  `3840921`, `e054a1d`, `82bf96c`, `d716f05` (all on `pr/structured-tier-core`),
  then `efeb238` and `9c6273d` (on `pr/structured-edges`). Resolve conflicts
  toward the fix's intent; `main` may differ in README and CHANGELOG context.
- Work in a worktree of `main`, never in the main tree with a pr/ branch.
- One `npm test` at a time (parallel runs time out the MCP and CLI tests).
- `node scripts/sync-global.mjs` only after the gate on `main` is green.
- The documents converters in the global install were hand-copied on
  2026-10-13 and `sync-global` does not touch them (memory:
  global-install-converters); do not recopy unless the Node version changed.

## Files and links that matter

- `docs/acceptance-2026-10-13.md` section 8 (what each commit fixes, gate table).
- `docs/operator-protocol.md` section 10 (install with `npm ci --ignore-scripts`,
  copy `node_modules/tree-sitter-kotlin/build/Release` from the global install).
- `scripts/sync-global.mjs`.

## Verified facts

- Stage 7 gates, Node 26.7.0, cmd.exe, sequential: core 1,443 tests (1,438 pass,
  5 skipped), markup 1,492, edges 1,520, documents 1,537 (1,532 pass), 0 fail on
  all four. The fixes add 20 tests (18 on core, 2 on edges) to any base.
- `main` has `src/graph/structured/`, `documents/` and the walker changes; its
  last source commit is `1021ff4`. `git diff main pr/documents-tier -- src` is not
  empty, so expect the pr/ branch to differ from `main` beyond the fixes.

## Work completed

The six fixes are on `main` (fast-forwarded from `stage-8/fixes-onto-main`, tip `04f9c44`). Two conflicts resolved toward the fix: `src/graph/structured/markdown.ts` (HTML-block check runs before link recording, as on `pr/structured-edges`) and `README.md` (the `--no-structured` wording kept beside main's two documents lines). Gate on the worktree, Node 26.7.0, PowerShell, sequential: `npm run build` exit 0; `npm test` 1,509 tests, 1,504 pass, 0 fail, 5 skipped, 446 s. `node scripts/sync-global.mjs` ran: 13 changed, 8 stale removed, global `graft --version` 0.21.1. Nothing pushed.

## Unresolved questions

- Operator: whether `main` should instead be reset to the stacked branches.
  Not assumed; this stage cherry-picks.

## Exact next action

`git worktree add ../fork_graft-stage8-main -b stage-8/fixes-onto-main main`,
`npm ci --ignore-scripts`, copy the Kotlin binary, then
`git cherry-pick 3840921 e054a1d 82bf96c d716f05 efeb238 9c6273d`.

## Cost projection

Sonnet 5.5, medium ($2.00 in, $10.00 out, $0.20 cache read per million).
Assumptions: 30 turns, average context 80k, 3k fresh input and 2k output per
turn. Cache 30 x 80k = 2.4M x $0.20 = $0.48. Fresh 30 x 3k = 90k x $2.50 =
$0.23. Output 30 x 2k = 60k x $10 = $0.60. About $1.30; quote $1 to $2. Estimate.

## Time projection

Wall clock 20 to 30 minutes: 10 to 15 minutes of model time and one gate of
about 7 minutes. Operator review of the six cherry-picks: about 10 minutes.
