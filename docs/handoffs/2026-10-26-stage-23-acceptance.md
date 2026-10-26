---
stage: "Stage 23: adversarial acceptance of Stages 17 to 20r"
model: claude-fable-5-1
effort: high
status: done
created: 2026-10-26
from: "Stage 22 handoff's next action, started by the operator (local_60e06b5a)"
---

# Stage 23: adversarial acceptance of Stages 17 to 20r

Roadmap Stage 23 in `docs/assessment-2026-10-18.md` section 6, widened by the operator to the
upstream 0.25.0 merge (`e3ff66e`), D14 (`f5827f4`) and Stage 20r (`b96f716`).
Done: gate 4,248 tests, 4,117 passed, 42 failed (32 baseline names, 10 load flakes that pass alone), 89 skipped.

## Goal

Each claim the Stage 17, 18, 18r, 19, 20 and 20r handoffs make is reproduced by a command run
in this session or recorded as a finding with the command that shows it. Fixes land in source
with a test that fails first, pass the gate under D13 (by name against
`docs/baselines/upstream-4e7d0f5-failures.txt`), and are committed on `main`. Nothing pushed.

## Decisions already made

- Acceptance runs one tier above the authors (Sonnet, Opus and Haiku wrote the stages).
- Smoke runs use temporary repositories in the session scratchpad, never this checkout.
- One gate at a time. No `gate.lock` convention exists anywhere under `D:\Code\Claude`; the
  check that works is the process list (a `node scripts/run-tests.mjs` process). Stage 21's gate
  was running in `D:\Code\Claude\s21` when this stage was ready, so this gate waited for it.
- The "upstream patch offered for 18" is commit `24608e3`; the test was a cherry-pick onto
  `upstream/main` at `4e7d0f5` in a throwaway worktree, aborted and removed afterwards.
- Two findings were fixed here (both small, both fork-visible); the rest are reported only.

## Findings, by severity (command that shows each)

1. **Medium, fixed.** Card drift in a workspace child read `STALE ()`: `federateCheck` judged by
   `ok`, not `inSync`, and listed only structural counts. Shows with a two-child workspace built
   by `node dist/cli.js build .` at the parent, `rm alpha/graft/src/alpha.md`, then
   `node dist/cli.js check .` or the MCP `graft_check_freshness` there. Now `alpha/: OK` plus the
   D14 `warning:` line; with structural drift too, `STALE (2 added, 1 card)`. `graft check` still
   exits 1. Test `test/workspace-cards-warning.test.ts` (failed first, 2 of 2).
2. **Medium, fixed.** The default-on LSP pass reported nothing: a server found on PATH that never
   started (here `C:\Users\Bob\.cargo\bin\rust-analyzer.exe`, a rustup shim whose component is
   not installed; `rust-analyzer --version` prints `Unknown binary`) left no line, and every build
   ended its progress with `summarizing 1/0: lsp:none` (`node dist/cli.js build .` in any repo,
   stderr). `GraphBuildResult.lsp` now carries `{ server, ready, added, queried }` and the CLI
   prints one `lsp:` line. Test `test/lsp-build-summary.test.ts` (failed first, 2 of 2).
3. **Low, closed by the operator (transient machine load, no action).** The startup budget was
   not met on the day and the global copy ran at twice the fork's identical bytes. Three
   interleaved rounds, bash wall clock:
   `node -e 0` 0.71, 0.93, 1.34 s; fork `dist/cli.js --version` 2.77, 2.32, 2.51 s; global
   `dist/cli.js --version` 4.55, 4.91, 5.64 s; `graft.cmd --version` 6.31, 4.73, 5.58 s;
   `ask --no-refresh -n 1` fork 2.35 to 2.86 s, shim 5.85 to 6.73 s. `cmp` shows the two
   `dist/` trees identical and both resolve 283 distinct modules for `--version`. Reading the
   29.7 MB `dist/` with `cat` takes 0.46 to 0.59 s on `D:` and 1.77 to 2.08 s on `C:` (two
   NVMe disks of the same model). The 0.21 to 1.4 s claims of Stage 18r were made with
   `node -e 0` at 0.38 to 0.65 s; the per-command loading itself holds (startup test passes).
   The operator read the numbers as transient load on the machine and withdrew the decision
   this finding had raised (it was numbered D15 here; the Stage 21 handoff's D15, the SCSS
   question, and its D16 keep their numbers).
4. **Low, reported.** The Stage 18r patch does not apply upstream as it stands:
   `git cherry-pick --no-commit 24608e3` onto `4e7d0f5` conflicts in `CHANGELOG.md` (1 hunk),
   `src/engine.ts` (4) and `src/cli.ts` (9). The engine hunks carry the fork's metered usage and
   `GRAFT_REASONING`; the cli hunks carry the structured and documents arguments and upstream's
   later hosts/init and codex changes. A pull request needs the change re-derived on
   `upstream/main`, not a cherry-pick (Stage 21 scope).
5. **Low, by design (D14).** Switching a tier on by hand (`.graft/config.json` edited, then
   `ask`) refreshes the wiring (`refreshed the graph (7 files changed)`) but writes no cards for
   the files that entered, so `check` exits 1 until `graft build` or the Stop hook. Switching off
   prunes correctly (Stage 19 fix verified).
6. **Low, reported.** Stage 22's question set pins absolute spans, so any edit above a pinned
   symbol fails `test/retrieval-eval.test.ts` in the gate (this stage's two-line import did). The
   check is right to exist; resolving the span from the symbol at test time would end the churn.
7. **Informational.** `status` exists under the trail brand only (`graft status` is `unknown
   command`); D14's status row and `status --json` are untestable from the global `graft`.
   `graft check`, the MCP tool and the hooks (`checkStaleCount` counts structural drift only) are
   consistent with D14.

## Verified facts (2026-10-26, Node 26.7.0, tree at `377a107` plus this stage's edits)

- Session configuration (session tool, `self`): `claude-fable-5-1`, `high`; matches.
- Fixture (TS, Kotlin, SCSS, Markdown, JSON, YAML, Dockerfile, TOML, a generated DOCX), built
  with `node dist/cli.js build .`: 30 nodes, 9 files, 22 edges, 9 cards, languages
  `dockerfile, docx, json, kotlin, markdown, scss, toml, typescript, yaml`. Kotlin `greet` is a
  `method` (native binary present); `@mixin rounded($r)` spans `L2-L4`; the DOCX sections cite
  `graft/.graph/docs/<hash>.txt:L5-L7` in the card and in `ask --source` (AGENTS rule 4).
- `--no-structured`: 7 nodes, 2 files, 2 cards, `{"structured": false}` saved, `check` exit 0;
  a later plain build keeps it; `--structured` restores 30; `--no-documents` drops the DOCX
  (27 nodes), saved beside `structured: true`; `GRAFT_STRUCTURED=0` beats a saved `true`.
- D14 single repo: `check` exits 1 naming `src/util.md (no card)` and `INDEX.md`; the MCP
  `graft_check_freshness` answers `graph check: OK` plus the `warning:` line.
- `scripts/sync-global.mjs --dry-run` against the real install: `0 would change, 1630
  unchanged`, `all 2 optional converters present`, `tree-sitter-kotlin binary present`, `dry run,
  nothing written`. Probes of `checkGlobalInstall` with a fake root: a scoped converter name, a
  package folder without `package.json` (reported missing), a `Release` folder holding only
  `.obj`/`.exp` (reported missing), no `optionalDependencies` field (no converter lines).
- `test/startup-imports.test.ts` 3 of 3, `test/reasoning-usage.test.ts` 13 of 13,
  `test/cards-drift-warning.test.ts` 4 of 4, `test/lsp-enrich.test.ts` and
  `test/lsp-windows.test.ts` 19 of 19 with the `ready` field added; `tsc --noEmit` clean.
- Gate (`npm run build && npm test`, started after Stage 21's gate ended, 2,447 s): 4,248 tests, 4,117 passed,
  42 failed, 89 skipped. 32 failing names are in `docs/baselines/upstream-4e7d0f5-failures.txt`.
  The 10 others, rerun by file alone: `trail-learnings-committed`, `init-trust-review`, `ignored-code`,
  `claude-hook-timeouts`, `skills-check-readonly`, `claude-journeys-3` all pass; `skills-session-start`
  fails only `compact: the cut block's failed ready probes...` and `skills-prompt` only `ready probes...`
  and `credit in the prompt hook (D57)...`, all three baseline names. So D13 holds.
- `test/retrieval-eval.test.ts` failed in the gate because the type import in `build.ts` moved `tierOf`
  two lines; the pin in `.eval/retrieval-questions.json` is now `L79-L91` and the file passes 10 of 10.
- `node scripts/sync-global.mjs` after the commits: 19 changed, 0 stale removed, 1,611 unchanged;
  `--version` `0.25.0-nishadherath`; all 2 converters and the Kotlin binary present.

## Work completed

- `test/workspace-cards-warning.test.ts`, `src/graph/workspace.ts`, `src/graph/check.ts`
  (`formatCardDriftWarning` shared by the report, the MCP tool and the workspace check).
- `test/lsp-build-summary.test.ts`, `src/graph/lsp/enrich.ts` (`ready`), `src/graph/build.ts`
  (`lsp` on the result, the progress event removed), `src/cli.ts` (the `lsp:` line).
- `CHANGELOG.md` Unreleased: one Added, one Fixed. This handoff. Commits: `3ddb53c` (workspace), `a4a04ca` (lsp line, question pin), then this handoff.

## Unresolved questions

- Operator: name the shared notes folder for `gate.lock`, or drop that clause from the kickoff
  prompts; the process-list check is what works today.
- Later stage (21): re-derive the per-command loading on `upstream/main` (finding 4).
- A small follow-up stage for finding 6 (symbol-resolved question pins); kickoff in the Stage 23
  report of 2026-10-26.
- Finding 7: whether `status` should exist under the graft brand so D14's status row can be
  read from the global install, or whether D14's text should drop the status claim.

## Exact next action

Stage 21 continues as its handoff says (Sonnet 5.5, high) once the operator answers its D15
(SCSS) and D16 (push). Stage 23 is the roadmap's last stage; nothing else in section 6 is open.

## Cost projection

Projected $8.25. Actual estimate: about 55 turns, context to 150k (average 95k) on Fable 5.1:
cache 5.2M x $0.25 = $1.30; fresh 165k x $12.50 = $2.06; output 85k x $50 = $4.25. About $7.60.

## Time projection

Projected 60 to 120 minutes plus a gate. Actual: 14:07 to 16:20 local, of which 19 min
waiting for Stage 21's gate and 41 min for this one. Operator review about 20 minutes.
