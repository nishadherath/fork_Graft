---
stage: "Stage 20: merge upstream 0.25.0 (trailhq/Trail-Code) into main, global install and release tarball"
model: claude-opus-5-5
effort: high
status: done
created: 2026-10-25
from: "Opus 5.5 session of 2026-10-25, on the operator's request to merge the latest upstream"
---

# Stage 20: merge upstream 0.25.0 into main

## Goal

`main` carries upstream 0.25.0 with every fork feature intact, the global `graft` runs
`0.25.0-nishadherath` from the fork's own tarball, and the tarball sits in
`D:\Code\Claude\fork_graft_releases\` beside the earlier releases. Done on 2026-10-25,
under the gate rule of decision D13 (option A) below.

## Decisions already made

- Merged `upstream/main` at `4e7d0f5` (0.25.0 plus one later fix, 152 commits), the same
  rule as Stage 17: the newest `upstream/main`, not the release commit.
- The OpenAI adapter takes upstream's structured-output ladder; `GRAFT_REASONING` goes on
  every attempt and a reasoning-off attempt is reported through a per-call `CallNotes`.
- Upstream's `resolveTargetId` (crux) and `findOnWindowsPath` and `spawnSpec` (LSP) replace
  the fork's own fixes. They cover the same cases, and the Windows lookup refuses
  relative `PATH` folders. The fork's `findOnPath` and its two tests are removed.
- A `.cmd` or `.bat` language server that is not an npm shim still starts through a shell.
- SCSS: the build vendors `tree-sitter-scss.wasm` from `tree-sitter-wasm@1.1.8` (dev
  dependency `tree-sitter-wasm-v1`) into `dist/vendor/wasm/`. The CSS grammar is not a
  stand-in: on SCSS it gives `@mixin` the span L2-L3 instead of L2-L4.
- `cleanSubject` moved to `src/notes/flatten.ts` so `--version` stays off the builder.
- Upstream's brains entry test expects the installed `trail` binary, as the fork's
  `serverEntry` is a constant (operator decision of 2026-10-15).
- D13, operator decision of 2026-10-25, option A: from 0.25.0 on, a change passes the gate
  when it fails no test that plain upstream does not fail in a full run on this machine,
  compared by test name (protocol section 10). The fork does not fix or skip upstream's
  machine-speed tests.

## Files and links that matter

- Merge commit `e3ff66e` on `main`. Seams: `src/ai/llm/openai.ts`, `src/cli.ts` (`wiring`),
  `src/graph/lsp/registry.ts`, `src/graph/lsp/client.ts`, `src/graph/cards.ts`,
  `src/graph/generic.ts` (`LEGACY_WASM`), `scripts/vendor-grammars.mjs`,
  `src/notes/flatten.ts`, `test/trail-connect-cli.test.ts`, `test/hosts-mcp-config.test.ts`.
- `CHANGELOG.md` section `0.25.0-nishadherath`; README "This build" section; protocol
  section 10 (three new facts: the gate, the command-line limit, SCSS).
- Tarball `D:\Code\Claude\fork_graft_releases\nanonets-graft-0.25.0-nishadherath.tgz`,
  4,391,970 bytes, sha256 `a00fc5756c9a780fef9ca2eb462e38b788ad20beeadeb613cbe6e991fc15e909`.
- Backup of the 0.23.0 global install (folder and shims): session scratchpad
  `global-backup/`, deleted when the session's temp folder is cleared.

## Verified facts (2026-10-25, Node 26.7.0)

- `npm view @nanonets/graft version` and `@trailhq/trail-code`: both 0.25.0.
- `git merge upstream/main` conflicted in 13 files; `merge-tree` named the same 13.
- Gate on the merge: 4,222 tests, 4,099 passed, 34 failed, 89 skipped, 1,619 s.
- Plain `upstream/main` (worktree at `D:\Code\Claude\ub`, same Node): 4,012 tests,
  3,885 passed, 38 failed, 89 skipped, 1,635 s.
- By test name, 31 of the merge's 34 failures also fail on plain upstream. The other 3
  (`claude-journeys-recall`, `claude-hooks-perf`, `claude-hook-timeouts`) pass with their
  file run alone. Upstream's own causes here: skills probes give git 300 ms, and
  `git --version` took 460 to 1,030 ms during the run; wall-clock bars in hook tests.
- `node scripts/sync-global.mjs` after the reinstall: 0 changed, 0 stale removed,
  1,630 unchanged; `graft --version` prints `0.25.0-nishadherath`; `pdfjs-dist` and the
  native Kotlin binary load from the global install.
- Smoke build with the global `graft` in a temp repo and temp home: `kotlin, scss,
  typescript`, 10 nodes; `graft grep mixin` names `styles/theme.scss:L2-L4`.
- `scripts/run-tests.mjs` command line: 28,371 of 32,767 characters here (486 files); a
  longer worktree path failed with `ENAMETOOLONG`.

## Work completed

- Merge `e3ff66e` (conflicts as above, version `0.25.0-nishadherath`, lockfile regenerated).
- Main checkout reinstalled (`npm ci --ignore-scripts`, Kotlin build copied) and rebuilt.
- Global install backed up, reinstalled from the tarball with `--ignore-scripts`, Kotlin
  `build/` restored from the backup, `sync-global` run. Nothing pushed to `origin`; no tag made.

## Unresolved questions

- D13 is decided (option A, see Decisions). Still open: an upstream issue on the skills
  probe budget and the wall-clock bars in hook tests.
- Operator: tag `v0.25.0-nishadherath` and push `main` and the tag to `origin`? Not done.
- Later stage: `run-tests.mjs` passes absolute paths; relative paths (the runner's `cwd`
  is the repository) would halve the line. A small upstream pull request.
- Stage 19's handoff was written against 0.23.0; its facts on cards and refresh need a
  recheck against upstream's `writeIfChanged` (#472) before it starts.

## Exact next action

Operator: decide the tag and push. Then Stage 19, `docs/handoffs/2026-10-21-stage-19-cards-check.md`
(Sonnet 5.5, medium), with a recheck of its facts against `e3ff66e` first.

## Cost projection

Projected $6 to $10 (a Stage 17-sized merge). Actual estimate: about 100 turns at an
average context of 110k on Opus 5.5: cache 11.0M x $0.20 = $2.20; fresh 300k x $5.00 =
$1.50; output 180k x $20.00 = $3.60. About $7.30.

## Time projection

Projected 90 to 150 minutes. Actual about 2 hours 40 minutes of wall clock, of which about
115 minutes were four test runs (two full gates, one full baseline, subsets). Operator
review about 30 minutes, plus a Claude Code restart in a wired repository to see the MCP
server start under 0.25.0.
