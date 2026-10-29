---
stage: "Stage 39: merge upstream 0.28.0 (19865ff) into main, gate under D13, no push"
model: claude-opus-5-5
effort: xhigh
status: ready
created: 2026-10-29
from: "Stage 39 dispatch, docs/handoffs/2026-10-29-stage-39-dispatch.md (claude-fable-5-1, xhigh, local_802088bb), on the operator's request of 2026-10-29"
---

# Stage 39: merge upstream 0.28.0 into main

First action: read your own configuration with the session tool (`self`). If the model is not
`claude-opus-5-5` or the effort is not `xhigh`, stop and name the value to pick in the model menu.

## Goal

`main` carries one merge commit of `upstream/main` at `19865ff` (upstream release 0.28.0 plus one
commit) on top of `1e85917`, conflicts resolved in favour of the fork's own files, the lockfile
regenerated, `npm run build` exit 0, and `npm test` judged green under D13 against a fresh baseline
of plain upstream `19865ff` committed as `docs/baselines/upstream-19865ff-failures.txt`. Nothing is
pushed, no tag is made, the version string stays `0.25.0-nishadherath.6`, the global install is not
touched. The stage ends with this file set to `done` (counts quoted), the Stage 40 brief written and
its chip created.

## Decisions already made

- Model and effort: Opus 5.5, xhigh (dispatch record, step 3.1 raise for a merge). Merge, never
  rebase (D8, D17); on `main` directly, as Stage 20 did; the push belongs to Stage 41.
- Conflicts go the fork's way: keep every fork addition, take upstream's change where the fork did
  not touch the lines, leave fork-only files alone. The fork's touched set is
  `git diff --stat 4e7d0f5 main`; check each conflicting file against it before editing.
- `package.json`: upstream's dependency blocks (the native `tree-sitter-*` grammars are now
  `optionalDependencies`; `web-tree-sitter-depth` is new) plus the fork's own additions from
  `git diff 4e7d0f5 main -- package.json`; the fork's `name`, `version`, `bin`, `scripts` stay.
  Then `npm install --package-lock-only --ignore-scripts` regenerates `package-lock.json`; never
  hand-merge the lock. Then `npm ci --ignore-scripts`.
- `CHANGELOG.md`: keep every entry from both sides, newest first, the fork's `Unreleased` at the top
  with one new line: merged upstream 0.28.0 (`19865ff`), naming what it brings in a sentence.
- D13 (option A, 2026-10-25): the merge passes when it fails no test that plain upstream `19865ff`
  does not fail in a full run on this machine. Compare by test name; rerun a one-sided failure alone
  before calling it a fault; the fork neither fixes nor skips upstream's machine-speed tests.
- The baseline runs in a detached worktree at `D:\Code\Claude\ub` (a longer path hits
  `ENAMETOOLONG` in `scripts/run-tests.mjs`). Its dependencies differ from `main`'s, so it gets its
  own `npm ci --ignore-scripts`, no junction. Start its gate in the background first, resolve
  conflicts while it runs; the lock of D21 serialises the fork's gate behind it on its own.
- Gate environment, as the .6 release: Git Bash, Node 26.7.0, `HOME` and `USERPROFILE` at a scratch
  folder holding a copy of `.gitconfig`, `DO_NOT_TRACK=1`, `GRAFT_NO_TRAIL_SWITCH=1`, one gate at a
  time, every gate in the background (27 minutes each). The two known PATH strays
  (`test/graft-to-trail.test.ts`, `test/hosts-trail.test.ts`) rerun with every PATH entry containing
  `nvm` or `nodejs` removed, a copy of `node.exe` in a scratch folder first on PATH,
  `--test-concurrency=1`.
- Kotlin: copy `node_modules/tree-sitter-kotlin/build/Release` from the global install only if the
  merged tree still loads the native grammar; 0.28.0 says installing compiles nothing (#707). Record
  which it was as one bullet in protocol section 10.
- Never run the `graft` or `trail` CLI in this checkout or in `D:\Code\Claude\ub`; a mismatch with
  the wiring stamp rewrites agent files. The graft MCP tools and Grep are fine for navigation.
- Prose: Australian English, no em-dashes, none of persona section 14.1's banned words, in every file
  touched. Upstream's own prose stays as it is unless the merge touches the line.
- Blocked: write the five lines of persona section 3.4 (Task, Tried, Evidence, Hypothesis, Decision)
  into this file and stop. Two failed hypotheses on one failure count as blocked.

## Files and links that matter

- Conflicts from `git merge-tree --write-tree --name-only main upstream/main` (8): `CHANGELOG.md`,
  `package-lock.json`, `package.json`, `scripts/vendor-grammars.mjs`, `src/cli.ts`,
  `src/graph/build.ts`, `src/graph/container.ts`, `src/graph/extract.ts`.
- Auto-merged files that carry fork patches, to re-read after the merge: `src/upkeep-run.ts`
  (`shouldMoveToTrail`, D33), `src/hosts/mcp-config.ts`, `src/claude/hooks.ts`, `src/util/state.ts`,
  `src/graph/generic.ts` (SCSS from `tree-sitter-wasm-v1`), `src/brand.ts`, `test/hosts-trail.test.ts`,
  `test/trail-connect-cli.test.ts`. The fork's PATH probe stats where upstream spawns; keep the stat.
- `docs/baselines/upstream-4e7d0f5-failures.txt`: the format to copy for the new baseline.
- `docs/handoffs/2026-10-25-stage-20-merge-upstream-0.25.0.md`: the precedent (same shape, 0.25.0).
- `docs/handoffs/2026-10-28-release-0.25.0-nishadherath.6.md`: gate environment and stray rerun.
- `docs/operator-protocol.md` section 10; `scripts/run-tests.mjs`; `scripts/gate-lock.mjs`.
- Upstream's own account: `git log --stat 4e7d0f5..19865ff` (16 commits, 197 files).

## Verified facts (2026-10-29, local_802088bb)

- `git fetch upstream --tags`: `upstream/main` is `19865ff` "Parse the depth tier on WASM, so
  installing compiles nothing (#707)", one past `25ea4c7` "Release 0.28.0"; `package.json` there
  reads `0.28.0`. Upstream has tagged nothing since `v0.21.1`.
- `git merge-base main upstream/main` is `4e7d0f5`; 16 upstream commits, 197 files, +8,300/-1,682;
  the fork is 200 commits ahead, 264 files, +30,995/-892.
- `package.json` 4e7d0f5 to 19865ff: `tree-sitter`, `-go`, `-java`, `-kotlin`, `-php`, `-python`,
  `-r`, `-typescript` moved from `dependencies` to `optionalDependencies`; `web-tree-sitter-depth`
  (`npm:web-tree-sitter@0.22.2`) added to `dependencies`.
- `git status` clean at `1e85917`; `git fetch origin` brought nothing; `git worktree list` shows this
  checkout only; `git branch` shows `main` only. There is no `D:\Code\Claude\ub`.
- Global install is `0.25.0-nishadherath.6` (session-start hook); `D:\Code\Claude\fork_graft_releases`
  exists and holds the `.6` tarball.
- Last full gate on this tree (the .6 release, Git Bash): 4,327 tests, 4,206 pass, 32 fail,
  89 skipped, 722 s, exit 1; 30 of the 32 in the baseline, 2 PATH strays green alone.
- No graft or trail CLI command was run in this checkout by the dispatch session.

## Work completed

- None yet. The dispatch record and this brief are the commit before this one.

## Unresolved questions

- D36 (operator): acceptance before the push, option A, or push on the gate, option B. Under A, end
  by writing `docs/handoffs/2026-10-29-stage-40-acceptance.md` (claude-fable-5-1, xhigh, fresh
  session: adversarial acceptance of this merge, its own gate, verdict in writing) and its chip.
  Under B, write the Stage 41 release brief instead (claude-sonnet-5-5, high: `release.mjs
  0.28.0-nishadherath`, gate, commit, annotated tag, push main and tag, `npm pack --ignore-scripts
  --pack-destination D:\Code\Claude\fork_graft_releases`, CHANGELOG copy beside it, global reinstall
  by the section 10 recipe since the base release changed, `sync-global`, `trail --version` from an
  unwired folder, remove `D:\Code\Claude\ub`, `git worktree prune`, `git remote prune origin upstream`).
- Protocol section 10 says merge stages run at `high`; the dispatch chose `xhigh`. Operator.

## Exact next action

```
git -C D:\Code\Claude\fork_graft worktree add --detach D:\Code\Claude\ub 19865ff
```

Then in `D:\Code\Claude\ub`: `npm ci --ignore-scripts`, `npm run build`, `npm test` in the background
with the gate environment above; while it runs, `git merge upstream/main` on `main` and resolve the
eight files.

## Cost projection

Opus 5.5, xhigh, list prices (cache read 0.20, cache write 5.00, output 20.00 per million): about
100 turns, average context 266k, fresh 3k, output 1.5k. First read 116k x 5.00 = $0.58; cache reads
100 x 266k = 26.6M x 0.20 = $5.33; fresh 300k x 5.00 = $1.50; output 150k x 20 = $3.00. About
$10.40; $8 to $14 across 80 to 140 turns; add $3 if xhigh doubles the output. Gates cost no tokens.

## Time projection

150 to 200 minutes wall clock: baseline install and build 10, baseline gate 27 (overlapping 30 to
45 of conflict work), fork install and build 10, fork gate 27, strays 5, comparison 5, handoff and
commit 15, the rest slack. Operator review 30 minutes, plus one click for the next stage's chip.
