---
stage: "Stage 28: release script, test:fork, the test runner off the command-line limit, release 0.25.0-nishadherath.4"
model: claude-sonnet-5-5
effort: medium (not verifiable from inside the session; the brief named medium)
status: done
created: 2026-10-27
from: "Stage 27 session; roadmap items 2 and 3 of docs/assessment-2026-10-27.md"
---

# Stage 28: release script and gate tooling

## Goal

`scripts/release.mjs <version>` cuts a fork release; `npm run test:fork` is the inner loop; the
test runner no longer puts every path on one command line. Each has a test that failed first.
Gate judged under D13, release `0.25.0-nishadherath.4` tagged, pushed, packed and synced.

## Decisions made

- The runner logic lives in `scripts/test-runner-lib.mjs` (chunking, count parsing and merging,
  the fork list) so a test can drive it; `run-tests.mjs` keeps the lock and temp-folder work.
- `test:fork` is `run-tests.mjs --fork`: files with status A, M, R or C under `test/*.test.ts`
  since `git merge-base HEAD upstream/main`. It takes the gate lock like the full run.
- Full run: Node 22+ passes the glob `test/*.test.ts`; Node 20 and the fork list run in chunks
  of at most 24,000 path characters, counts parsed from the spec or tap summary and added.
- `release.mjs` edits text in place (CRLF kept), checks everything before the first write, keeps an
  existing `fork` marker or writes one (`releases` is `<repo folder>_releases`), and leaves the
  CHANGELOG with an empty `## Unreleased` above the dated heading. It runs no git write.

## Verified facts

- Tests first: `release-script.test.ts` and `test-runner-lib.test.ts` failed on the missing module.
  Final: 11 and 8 tests pass; the 600-file run took 170 s on this loaded machine and used more than
  one chunk. A child of `node --test` must drop `NODE_TEST_CONTEXT` (the test does).
- Gate (Node 26.7.0, glob path, on `de8259c`): 4,300 tests, 4,171 pass, 40 fail, 89 skipped, 2,709 s.
  D13: 32 failing names are in the baseline; 8 are not. Rerun by file: 7 passed; the eighth
  ("the prompt hook ends inside its total budget...", `test/claude-hook-timeouts.test.ts`) failed in
  the combined rerun and passed 8 of 8 alone twice. Green under D13.
- Release commit `09c52f5`, annotated tag `v0.25.0-nishadherath.4` (object `29c3265`) pushed to
  `origin`. Tarball `D:\Code\Claude\fork_graft_releases\nanonets-graft-0.25.0-nishadherath.4.tgz`
  (4,416,070 bytes) lists `package/dist/bin/graft.js` and the two new scripts. `sync-global`: 0
  changed (dist unchanged), global package.json now `.4` with the marker; from a scratch folder
  `graft --version` prints `.4` and `graft upgrade` refuses and exits 1.
- The first release run was made by the new script itself; its diff touched only the four files.

## Open questions

- Git is slow here (a scratch repo costs seconds); the release tests copy a template per shape.
- `test:fork` has not been timed alone; the handoff of Stage 26 estimated 2.5 minutes.

## Cost and time

Sonnet 5.5, about 45 turns. At the Stage 27 per-turn figures ($2.32 per 50) about $2.1; wall clock
about 2 hours, 45 minutes of it the gate.

## Next

Stage 29: Haiku 5.5, medium, documentation hygiene (D25).
