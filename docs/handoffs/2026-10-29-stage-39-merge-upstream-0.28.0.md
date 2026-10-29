---
stage: "Stage 39: merge upstream 0.28.0 (19865ff) into main, gate under D13, no push"
model: claude-opus-5-5
effort: xhigh
status: done
created: 2026-10-29
from: "Stage 39 dispatch, docs/handoffs/2026-10-29-stage-39-dispatch.md (claude-fable-5-1, xhigh, local_802088bb), on the operator's request of 2026-10-29"
---

# Stage 39: merge upstream 0.28.0 into main

Done: merge `3337689`, baseline `afa99d2`. Fork gate 4,452 tests, 4,313 pass, 37 fail, 102 skipped,
0 cancelled, 1,345.6 s; plain upstream 4,135 tests, 3,991 pass, 42 fail, 102 skipped, 1,272.7 s.
Green under D13. Nothing pushed or tagged; version `0.25.0-nishadherath.6`; global install untouched.

## Goal

`main` carries one merge commit of `upstream/main` at `19865ff` (upstream release 0.28.0 plus #707),
conflicts resolved in favour of the fork's own files, the lockfile regenerated, `npm run build`
exit 0, and `npm test` judged green under D13 against a fresh baseline of plain upstream `19865ff`
committed as `docs/baselines/upstream-19865ff-failures.txt`. Ends with the Stage 40 brief (D36 A).

## Decisions already made

- Opus 5.5, xhigh; merge, never rebase (D8, D17), on `main`; the push belongs to Stage 41.
- Conflicts the fork's way; fixes the merge needed go in the merge commit, as at `e3ff66e` (0.25.0).
- D13 (option A, 2026-10-25): pass when no test fails that plain upstream `19865ff` does not fail;
  compare by name; rerun a one-sided failure alone before calling it a fault.
- D36 (operator, 2026-10-29 13:10): option A, Fable acceptance (Stage 40) before Stage 41 pushes.
- The fork keeps always writing the installed MCP launcher, never npx (`c4d4120`, option C), so
  upstream's #709 npx case is held to that rule in `test/hosts-trail.test.ts`.
- Kotlin: no binary copy. #707 parses every depth grammar on WASM; both gates ran without it.

## Files and links that matter

- `git show 3337689` (message lists each of the eight resolutions and the fixes).
- Fix for #707's async depth grammars: `src/graph/build.ts` `warmGrammarsFor`,
  `src/graph/structured/index.ts` (`embeddedDepthLanguages`, `warmStructuredGrammars`),
  `src/graph/structured/markdown.ts` (`fenceLanguagesOf`, `fenceTag`), `structured/html.ts`
  (`PAGE_SCRIPT_LANGUAGE`); tests at the end of `test/structured-fences.test.ts`.
- `src/graph/code-refs.ts` (now on depth-parser's `SyntaxNode`), `scripts/vendor-grammars.mjs`
  (SCSS copy inside the main guard, still `dist/vendor/wasm/`), `src/cli.ts` (lazy `wiring` kept).
- `docs/operator-protocol.md` section 10, new Kotlin bullet.
- Stage 40 brief: `docs/handoffs/2026-10-29-stage-40-acceptance.md`.

## Verified facts (2026-10-29, local_80852083)

- Session tool `self`: model `claude-opus-5-5`, effort `xhigh`.
- `upstream/main` moved the native `tree-sitter-*` grammars to `devDependencies` (not
  `optionalDependencies`, as the dispatch read it) and added `web-tree-sitter-depth`.
- `package-lock.json` after `npm install --package-lock-only --ignore-scripts` differs from
  upstream's only by the fork's version, `trail` bin, `tree-sitter-wasm-v1`, `fflate`, `pdfjs-dist`
  and their dependencies. `npm ci --ignore-scripts` exit 0; `tsc --noEmit` exit 0; build exit 0
  (9 depth grammars in `dist/vendor/grammars/`, SCSS in `dist/vendor/wasm/`).
- Warming all nine depth grammars costs 107 to 255 ms in a cold process (three runs, CPU loaded by
  the baseline gate), so fences warm only the languages a file names.
- The new build test fails without the `warmGrammarsFor` change (`actual: undefined, expected:
  'L4-L5'`) and passes with it; `structured-fences` 11 of 11. Merge-exposed files (container,
  depth-grammars, native-fallback, startup-imports, structured edges and HTML, generic): 87 of 87.
- Baseline gate, `D:\Code\Claude\ub` at `19865ff`, own `npm ci --ignore-scripts`, Git Bash, Node
  26.7.0, scratch `HOME` and `USERPROFILE` with `.gitconfig`, `DO_NOT_TRACK=1`,
  `GRAFT_NO_TRAIL_SWITCH=1`: counts above; 42 distinct names, 33 also in the 4e7d0f5 baseline.
- Fork gate, same environment: counts above; 37 distinct names, 34 in the new baseline. One-sided:
  `test/skills-anchors-wide-journeys.test.ts` alone 6 of 6, `test/trace-guard-fast.test.ts` alone
  8 of 8 (machine speed); the #709 npx case in `test/hosts-trail.test.ts`, adapted (decision above).
  `hosts-trail` and `graft-to-trail` rerun with nvm and nodejs off PATH, `node.exe` copy first,
  `--test-concurrency=1`: 14 tests, 13 pass, 0 fail, 1 skipped. The full gate ran before that
  test edit; the rerun covers it.
- `d27fb4e` (D36's answer, docs only) landed before the merge began; the merge's parents are
  `d27fb4e` and `19865ff`. No graft or trail CLI command ran in this checkout or in `ub`.

## Work completed

- `3337689` Merge upstream 0.28.0 (trailhq/Trail-Code 19865ff) into main.
- `afa99d2` docs: keep plain upstream 19865ff's 42 failing test names for D13 comparisons.
- This file closed and the Stage 40 brief written, in the commit after `afa99d2`.

## Unresolved questions

- `scripts/sync-global-checks.mjs` (lines 13 to 14, 70 to 76) still reports a missing Kotlin
  binary with a copy step; a 0.28 global install has no `tree-sitter-kotlin`. Stage 40 decides.
- `AGENTS.md` non-negotiable 1 and the older protocol bullet still say to copy the Kotlin binary;
  only the new section 10 bullet supersedes them. Operator or a documentation stage.
- `src/notes/edit-overlap.ts` `symbolsIn` warms through `warmGrammarsFor([rel])`, which now reads a
  Markdown file for fence grammars it never uses; only when a teammate's branch changes that file.
- Protocol section 10 says merge stages run at `high`; the dispatch chose `xhigh`. Operator.
- `D:\Code\Claude\ub` stays for Stage 40 to reuse; Stage 41 removes it.

## Exact next action

Stage 40, in a fresh session on Fable 5.1 at xhigh: read
`docs/handoffs/2026-10-29-stage-40-acceptance.md` and do its first action.

## Cost projection

Projected $8 to $14 (Opus 5.5, xhigh). Measured: context 338k at the end (session usage tool),
about 100 turns, average context about 220k. Cache reads 100 x 220k = 22M x 0.20 = $4.40; fresh
300k x 5.00 = $1.50; output 200k x 20 = $4.00. About $9.90.

## Time projection

Projected 150 to 200 minutes; took about 70 (13:06 to 14:15): baseline gate 22 minutes and fork gate
23 minutes, both in the background, conflict work overlapping the first. Operator review 30 minutes.
