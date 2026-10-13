---
stage: "Stage 5: upstream texts and branch audits for the five pull-request branches"
model: claude-haiku-5-5
effort: medium
status: done
created: 2026-10-13
from: "Opus 5.5 Stage 4 session (documents tier), 2026-10-13; taken over by Haiku 5.5 medium (model and effort checked against this front matter)"
---

# Stage 5: upstream texts and audits

## Goal

Done: six texts in `docs/upstream/` (one design-issue body, five pull-request
descriptions), the branch audits recorded below, committed on `main`. Nothing
pushed; no edits to `src/` or `test/`; no branch changed.

## Decisions already made

- D1 to D7 stand (plan section 6). D5 A: the design issue is opened first, by the
  operator, then the pull requests.
- D4 (converter installation): option A, chosen by the operator on 2026-10-13. The
  original approval of A assumed the converters would add nothing to installs; Stage 4
  measured about 79 MB, so the operator re-decided with that cost known. A keeps
  `optionalDependencies` as built.
- Stacking, corrected by the audit: `pr/crux-id-echo` is independent (based on
  `upstream/main`, not in the structured stack). The structured stack is
  `pr/structured-tier-core` (on `upstream/main`), then `pr/structured-tier-markup-build`,
  `pr/structured-edges`, `pr/documents-tier`, each based on the one before. The
  Stage 4 handoff's "stacked in this order" applied only to the last four.

## Files that matter

- `docs/upstream/design-issue.md`, `pr-crux-id-echo.md`,
  `pr-structured-tier-core.md`, `pr-structured-tier-markup-build.md`,
  `pr-structured-edges.md`, `pr-documents-tier.md`. Each opens with an operator
  note above a rule; the note is not part of the paste text.
- `docs/plan-file-type-indexing-2026-10-13.md` sections 5 and 6.

## Verified facts

Audit: `git log upstream/main..<branch> --name-only` (2026-10-13). Base `fe30ead`.

| Branch | Base | Commits (own / cumulative) | Tip | Paths changed (cumulative, against upstream/main) | Tip gate (from commit message) |
|---|---|---|---|---|---|
| `pr/crux-id-echo` | `upstream/main` | 1 / 1 | `4748b34` | `src/ai/crux.ts`, `test/crux-id-echo.test.ts` | 1,329 tests, 1,324 pass, 0 fail, 5 skipped |
| `pr/structured-tier-core` | `upstream/main` | 7 / 7 | `4298acb` | `CHANGELOG.md`, `README.md`, 11 under `src/` (cli, graph build, cards, check, container, extract-cache, invariants, source-files, types, workspace-cli, util/state), `src/graph/structured/` (7 files), 7 tests | 1,397 tests, 1,392 pass, 0 fail, 5 skipped |
| `pr/structured-tier-markup-build` | core | 8 / 15 | `77eb591` | 43 files: core's set plus `src/graph/structured/` (css, gradle, html, make, shell, targets, xml), `src/ingest/fs.ts` (D7 workflow admit), 15 tests | 1,446 tests, 1,441 pass, 0 fail, 5 skipped |
| `pr/structured-edges` | markup | 8 / 23 | `e6f30cc` | 55 files: adds `src/blast/blast.ts`, `src/context/*`, `src/graph/resolve*.ts`, `src/graph/code-refs.ts`, `src/graph/enrich.ts`, `commands.ts`, `test/structured-blast`, `structured-deep`, `structured-edges` | 1,472 tests, 1,467 pass, 0 fail, 5 skipped |
| `pr/documents-tier` | edges | 12 / 35 | `3aa52c1` | 77 files: adds `src/graph/structured/documents/` (13 files), `src/ask/ask.ts`, `src/search/grep.ts`, `src/engine.ts`, `src/graph/fingerprint.ts`, `src/util/id.ts`, `test/structured-documents.test.ts`, `test/document-fixtures.ts`, `package.json`, `package-lock.json` | 1,489 tests, 1,484 pass, 0 fail, 5 skipped |

- Every branch touches only `src/`, `test/`, `CHANGELOG.md` and `README.md`, except
  `pr/documents-tier`, which also touches `package.json` and `package-lock.json`.
- `package.json` on `pr/documents-tier` adds `optionalDependencies`: `fflate` 0.8.3
  and `pdfjs-dist` 5.6.205. Nothing else in the file changes.
- Each PR text takes its CHANGELOG bullets from the diff between its own tip and the
  tip below it (core: the Unreleased section; markup: the "Markup and build files" and
  "Workflow YAML" bullets; edges: the "Edges", "blast" and "--deep" bullets; documents:
  the PDF bullet). Checked with `git diff <lower tip> <tip> -- CHANGELOG.md`.

## Findings for the operator (not fixed in this stage)

1. **README error on the core branch.** `README.md` line 415 of the core and later
   branches reads `graft build --no-structured   # ... persist that choice (the default)`.
   The tier is off by default, so "(the default)" is wrong. The fix is a commit on
   `pr/structured-tier-core`, then a rebase of the three branches above it. Needs a
   Sonnet-class session or the operator; it is a text edit, but it rewrites the stack.
2. **AGENTS.md rule 3 conflict on `pr/documents-tier`.** The rule allows only `src/`,
   `test/`, `CHANGELOG.md`, `CREDITS.md`, `README.md`. The branch also changes
   `package.json` and `package-lock.json`. Operator to accept the exception, or move the
   dependency declaration out of the branch (see decision below).
3. **Gate figure on `pr/documents-tier`.** The tip commit records 1,489 tests, 1,484
   pass. The Stage 4 handoff records 1,517 and 1,512 for the rebased branch, but no
   commit carries that figure. The documents text quotes the commit figure. A gate run on
   the branch (about 7 minutes, in a worktree) settles it.
4. **Crux is not in the structured stack** (see Decisions). The crux pull request can
   open first, on its own.

## Work completed

- Six texts in `docs/upstream/`, each with an operator note above the paste text.
- Audit table above; findings 1 to 4.
- The Haiku prose check (persona section 14.1) passed on all six: no em-dashes,
  no banned words, no filler adverbs, Australian spelling. The check was a grep; the
  persona's "check before returning" rule is met for those patterns, not for every
  sentence's sense.
- Commit on `main`: see `git log -1` on `main` after this stage.

## Unresolved questions

- **D4 (install footprint): decided, option A.** `optionalDependencies` stay (about
  79 MB on Windows, installed by default). `docs/upstream/pr-documents-tier.md` describes
  A and needs no change for D4. The rule 3 exception below is separate and still open.
- **Operator.** Accept the `package.json` exception to AGENTS.md rule 3, or move it
  (finding 2).
- **Operator.** Approve the README fix and the rebase of the stack (finding 1).
- **Operator.** Quote which documents gate figure (finding 3); a gate run on the branch
  settles it.
- **Operator.** Open the design issue first (D5 A), then the crux pull request, then the
  core pull request after finding 1 is fixed.

## Exact next action

Operator decides findings 1 to 3 (D4 is now A). Stage 6 can start now on the branch tips,
recorded above, and re-checks each tip before testing.

## Cost projection

Haiku 5.5, medium, about 35 turns at about 60k average context. Estimated at the
protocol's Haiku prices: cache about 2.1M reads, fresh about 0.1M, output about 0.07M.
About $0.07 in total, within the $0.10 to $0.50 range in the plan. Estimate, not
measured by the session.

## Time projection

About 30 to 40 minutes of wall clock for this stage (estimate). Operator review of the
six texts: about 30 minutes, plus the decisions above.
