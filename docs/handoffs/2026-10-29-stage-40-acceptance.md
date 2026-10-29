---
stage: "Stage 40: adversarial acceptance of the upstream 0.28.0 merge (3337689), its own gate, verdict in writing"
model: claude-fable-5-1
effort: xhigh
status: ready
created: 2026-10-29
from: "Stage 39, docs/handoffs/2026-10-29-stage-39-merge-upstream-0.28.0.md (claude-opus-5-5, xhigh, local_80852083), under D36 option A"
---

# Stage 40: accept or reject the upstream 0.28.0 merge

First action: read your own configuration with the session tool (`self`). If the model is not
`claude-fable-5-1` or the effort is not `xhigh`, stop and name the value to pick in the model menu.

## Goal

A written verdict, accept or reject, on merge commit `3337689` (upstream `19865ff` into `main`),
reached by trying to break it rather than by re-reading Stage 39's account. The verdict and its
evidence go into this file's "Work completed", with your own gate judged under D13 against
`docs/baselines/upstream-19865ff-failures.txt`. Accept: write the Stage 41 release brief (below).
Reject: name each defect with its failing test or reproduction; a defect you fix yourself follows
non-negotiable 2 (a test that fails first) and is its own commit. Nothing is pushed or tagged here.

## Decisions already made

- D36 option A (operator, 2026-10-29 13:10): Fable acceptance before the push. Stage 41 (Sonnet 5.5,
  high) releases only after an accept.
- D13 option A: a change passes when it fails no test that plain upstream `19865ff` does not fail in
  a full run on this machine; compare by name, rerun a one-sided failure alone before calling it a
  fault. The baseline is Stage 39's run: 4,135 tests, 42 distinct failing names.
- Gate environment, as Stage 39 and the .6 release: Git Bash, Node 26.7.0, `HOME` and `USERPROFILE`
  at a scratch folder holding a copy of `.gitconfig`, `DO_NOT_TRACK=1`, `GRAFT_NO_TRAIL_SWITCH=1`,
  `npm ci --ignore-scripts` (no Kotlin copy; protocol section 10), one gate at a time, in the
  background. The two PATH strays rerun with every PATH entry containing `nvm` or `nodejs` removed,
  a copy of `node.exe` first on PATH, `--test-concurrency=1`.
- Never run the `graft` or `trail` CLI in this checkout or in `D:\Code\Claude\ub`. A smoke test of
  the built CLI runs in a temporary folder with a scratch `HOME`: `node <fork>\dist\bin\graft.js`.
- Prose: Australian English, no em-dashes, none of persona section 14.1's banned words.

## Files and links that matter

- The eight conflicts and how each was resolved: the merge commit message (`git log -1 3337689`).
- The semantic fix the merge needed, the first thing to attack: upstream #707 made depth grammars
  WASM, loaded asynchronously, so the fork's embedded code stopped parsing unless warmed.
  `src/graph/build.ts` `warmGrammarsFor` (Markdown fences, via `embeddedDepthLanguages` in
  `src/graph/structured/index.ts` and `fenceLanguagesOf` in `src/graph/structured/markdown.ts`);
  `warmStructuredGrammars` (page scripts, `PAGE_SCRIPT_LANGUAGE` in `structured/html.ts`).
  Test: `test/structured-fences.test.ts`, the last two tests; the build one fails without the fix.
- `src/graph/code-refs.ts`: now typed on depth-parser's `SyntaxNode`; WASM nodes are compared by
  `tree` and `id`, never `===`, and a tree is freed when `parseDepth`'s callback returns.
- `scripts/vendor-grammars.mjs`: the fork's SCSS copy sits inside upstream's main guard and writes
  `dist/vendor/wasm/` (generic.ts reads it), not upstream's `dist/vendor/grammars/`.
- `src/cli.ts`: the fork's lazy `wiring` seam kept; upstream's static `refresh.js` and
  `build-progress.js` imports dropped; `laptopOnly` and `claudeGlobal` routed through `wiring`.
- `package.json`, `package-lock.json`: upstream's lock plus the fork's additions, regenerated.
- Stage 39's brief (verified facts, counts): `docs/handoffs/2026-10-29-stage-39-merge-upstream-0.28.0.md`.
- Precedent: `docs/handoffs/2026-10-25-stage-20-merge-upstream-0.25.0.md` and the stage after it.

## Verified facts (Stage 39, 2026-10-29)

- Merge `3337689` (parents `d27fb4e`, `19865ff`), baseline `afa99d2`. Nothing pushed or tagged;
  version `0.25.0-nishadherath.6`; global install untouched.
- Fork gate: 4,452 tests, 4,313 pass, 37 fail, 102 skipped, 0 cancelled, 1,345.6 s. Plain
  upstream: 4,135 tests, 3,991 pass, 42 fail, 102 skipped, 1,272.7 s. 34 of the fork's 37 names
  are in the baseline. `skills-anchors-wide-journeys` (6 of 6) and `trace-guard-fast` (8 of 8)
  pass alone. The third, upstream's #709 npx case in `test/hosts-trail.test.ts`, now asserts the
  fork's installed-launcher rule (`c4d4120`, option C); upstream writes npx there instead. Check
  that this still matches the operator's intent; it is a behaviour choice, not a test fix.
- `hosts-trail` and `graft-to-trail` with nvm and nodejs off PATH: 14 tests, 13 pass, 1 skipped.
  The full gate ran before the hosts-trail edit, so your own full gate is the first on `3337689`.
- The new fence build test fails without the `warmGrammarsFor` change and passes with it.
- Warming all nine depth grammars costs 107 to 255 ms in a cold process; hence per-file fences.
- `D:\Code\Claude\ub` is a detached worktree at `19865ff`, installed and built; reuse it to rerun
  a single upstream test file if a one-sided failure needs a comparison.

## Work completed

- None yet.

## Unresolved questions

- `scripts/sync-global-checks.mjs` (lines 13 to 14, 70 to 76) reports a missing Kotlin binary and a
  copy step; after #707 a fresh global install has no `tree-sitter-kotlin` at all. Fix (a test that
  fails first) or leave for Stage 41 to ignore: your call, recorded here.
- `AGENTS.md` non-negotiable 1 and the protocol's older Kotlin bullet still tell sessions to copy
  the Kotlin binary. Stage 39 added the superseding bullet to protocol section 10 only. Operator or
  a documentation stage.
- `src/notes/edit-overlap.ts` `symbolsIn` calls `warmGrammarsFor([rel])`, which now reads a Markdown
  file to warm fence grammars that `symbolsIn` never uses. Reached only when a teammate's open
  branch changes the same file. Judge whether it matters.

## Exact next action

```
git -C D:\Code\Claude\fork_graft show --stat 3337689
```

Then read the merge diff against both parents for the files above, try to break each resolution,
run the smoke test in a temporary folder, start your own gate in the background, and judge it.
If you accept, write `docs/handoffs/2026-10-29-stage-41-release-0.28.0-nishadherath.md`
(claude-sonnet-5-5, high): `node scripts/release.mjs 0.28.0-nishadherath`, gate, commit, annotated
tag, push `main` and the tag, `npm pack --ignore-scripts --pack-destination
D:\Code\Claude\fork_graft_releases`, the CHANGELOG copy beside it, the global reinstall by the
section 10 recipe (the base release changes), `node scripts/sync-global.mjs`, `trail --version`
from an unwired folder, remove `D:\Code\Claude\ub` (`git worktree remove`), `git worktree prune`,
`git remote prune origin`, `git remote prune upstream`.

## Cost projection

Fable 5.1, xhigh, list prices (cache read 0.25, cache write 12.50, output 50.00 per million): about
80 turns, average context 200k, fresh 3k, output 2k. First read 110k x 12.50 = $1.38; cache reads
80 x 200k = 16M x 0.25 = $4.00; fresh 240k x 12.50 = $3.00; output 160k x 50 = $8.00. About $16.40;
$12 to $24 across 60 to 110 turns. Gates cost no tokens.

## Time projection

90 to 150 minutes wall clock: reading and attacking the resolutions 40 to 60, smoke test 10, gate
22 to 27 in the background, strays 5, comparison 5, verdict and commit 15. Operator review 20
minutes, plus one click for the Stage 41 chip.
