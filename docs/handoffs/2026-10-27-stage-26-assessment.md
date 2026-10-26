---
stage: "Stage 26: project assessment at v0.25.0-nishadherath.2 and the next staged roadmap"
model: claude-fable-5-1
effort: high
status: done
created: 2026-10-27
from: "Stage 25 handoff's closing line, started by the operator's coordinating session (local_60e06b5a)"
---

# Stage 26: assessment and roadmap

## Goal

`docs/assessment-2026-10-27.md` answers the operator's six-question brief (protocol section
1.1) for the fork as it stands at `v0.25.0-nishadherath.2`, with every number measured in this
session and the command beside it, and proposes the next staged roadmap by model class, priced
by protocol sections 6 and 7. New decisions start at D24 in the five-part format. The gate is
green under D13, everything is committed on `main` and pushed to `origin`, and this handoff is
at status `done` with the counts.

## Decisions already made (not to reopen)

- D8 B and D17, D18 (2026-10-26): the fork is the operator's own build; upstream is merged by a
  recorded stage, never rebased onto, and only when the operator names a release.
- D13 A: the gate passes when it fails no test plain upstream `4e7d0f5` does not fail here.
- D21: `npm test` takes its own machine-wide lock; no process-list poll.
- Never run a `graft` command inside this checkout; smoke tests go in the session scratchpad.

## Files and links that matter

- `docs/assessment-2026-10-18.md` (the previous assessment; its section 9 records the pivot).
- `docs/handoffs/2026-10-26-stage-23-acceptance.md`, `-stage-24-own-build-release.md`,
  `-stage-25-own-build-close-out.md`.
- `.eval/retrieval-2026-10-26.md` and `.eval/retrieval-questions.json` (the retrieval baseline).
- `docs/baselines/upstream-4e7d0f5-failures.txt` (38 names for D13).

## Verified facts (2026-10-27, Node 26.7.0, `main` at `82a9713` = `origin/main`)

- Session configuration (`get_session self`): `claude-fable-5-1`, `high`; matches.
- `git fetch upstream`: `upstream/main` is `d878681` (release 0.26.0, 2026-10-26), 9 commits
  `main` lacks; `git diff --stat main...upstream/main` 109 files, 3,315 insertions, 809
  deletions; `git merge-tree --write-tree --name-only main upstream/main` exits 1 naming
  `CHANGELOG.md`, `package-lock.json`, `package.json`, `src/cli.ts`.
- `npm view @nanonets/graft version` and `@trailhq/trail-code` both `0.26.0` (2026-10-26).
- GitHub API: 10,785 stars, 250 open issues and pull requests, 115 open pull requests.
- Fork against the merge base: `git diff --shortstat 4e7d0f5 main` 216 files, 24,973
  insertions, 482 deletions; 134 fork commits; 37 test files added carrying 242 `test(` calls.
- Tree: `src/` 82,820 lines; `test/` 86,906 lines in 495 files with 4,073 static `test(` calls.
- This repository's graph (`.trail/cache/.graph/wiring.json`): 9,779 nodes, 31,013 edges,
  9,048 summaries, 4,269 crux; kinds include 524 `key`, 754 `section`, 388 `selector`.
- Startup from a temporary folder, three rounds: `node -e 0` 633, 500, 513 ms; `graft.cmd
  --version` 3,931, 4,189, 4,026 ms; fork `dist/cli.js --version` 1,875, 1,893, 2,012 ms.
- Global install `0.25.0-nishadherath.2`, Node root `C:\nvm4w\nodejs\node_modules`.

## Work completed

- `docs/assessment-2026-10-27.md`: the six answers, the roadmap for Stages 27 to 32 and
  decisions D24 to D27. `AGENTS.md` rule 8 and protocol section 1 point at it as the newest.
- Smoke of the released build in the session scratchpad (five-file fixture: 21 nodes, 19
  edges, 5 cards; `ask --source` exact; secret value absent; `check` exit 0). The fork's 34
  test files alone: 248 of 248 in 143 s.
- Gate (`npm run build && npm test`, build exit 0, 2,207 s under the lock): 4,261 tests,
  4,131 passed, 41 failed, 89 skipped. By name, 34 of the 41 are in
  `docs/baselines/upstream-4e7d0f5-failures.txt`; the other 7 sit in six files
  (`claude-journeys-2`, `mcp-server`, `claude-codex-journeys`, `claude-hooks-1b`,
  `claude-hooks-perf`, `claude-hook-timeouts`), each rerun alone and passing (8, 5, 3, 8, 1,
  8 of their tests). D13 holds. No source file changed in this stage.
- Committed on `main` and pushed to `origin` (hash in the commit log; nothing else to merge).

## Unresolved questions

- Operator: D24 (fork-aware `upgrade` and nudge), D25 (closed texts and the unsent advisory),
  D26 (merge 0.26.0 now or wait), D27 (what the fork-only quick run may stand in for), all in
  the assessment's section 7 with recommendations A, A, A, A. D10 and D11 stay open from
  2026-10-18.

## Exact next action

Stage 27 (Sonnet 5.5, high) once the operator answers D24: the fork marker, `upgrade` refusing
on a fork build, the informational nudge, tests that fail first, release `0.25.0-nishadherath.3`,
tarball, sync. Its kickoff prompt is at the end of the Stage 26 report.

## Cost projection

Fable 5.1, high: about 50 turns, context 40k to 160k (average 100k). Cache reads 50 x 100k x
$0.25 = $1.25; fresh 50 x 3k x 1.25 x $10 = $1.88; output 50 x 2k x $50 = $5.00. About $8.10
(quote $8 to $16).

## Time projection

About 90 minutes of reading, measuring and writing, one gate of 25 to 41 minutes, 10 minutes
of commit and push. Operator review about 30 minutes for the assessment and its decisions.
