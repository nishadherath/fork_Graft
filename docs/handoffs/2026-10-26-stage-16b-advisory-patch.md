---
stage: "Stage 16b: rebase the advisory patch onto upstream 0.25.0"
model: claude-sonnet-5-5
effort: medium
status: done
created: 2026-10-26
from: "Stage 16 follow-up, delegated by the operator's coordinating session (local_2a1bae05)"
---

# Stage 16b: rebase the advisory patch onto upstream 0.25.0

## Goal
Section 8 of `docs/security/2026-10-15-graft-mcp-npx-launcher-advisory.txt`
holds a patch that applies to upstream `4e7d0f5` (`git apply --check` passes),
with its test failing before the fix and passing after, and the full gate run
on that tree. The `Versions:` line reflects which older tags carry the same
probe and fallback.

## Decisions already made
- The operator chose to rebase the patch (Stage 16 open question).
- Keep the patch's intent: never fall back to an unpinned `npx` launcher on a
  failed PATH probe. Keep its test.
- Placeholders in the advisory (reporter, contact, notification) stay.
- Commit only the advisory and this handoff; push and send nothing.
- One test run at a time on this machine (memory: gates-one-at-a-time).

## Files and links that matter
- `docs/security/2026-10-15-graft-mcp-npx-launcher-advisory.txt`, section 8.
- `docs/baselines/upstream-4e7d0f5-failures.txt` (D13, protocol section 10).
- `docs/handoffs/2026-10-18-stage-16-upstream-texts-refresh.md`.
- Worktree `D:\Code\Claude\ub` of `upstream/main`, removed at the end.

## Verified facts
- Upstream `4e7d0f5` already has `commandOnPath()` in `src/brand.ts` (a stat
  walk of PATH, no spawn); the rebased fix reuses it for graft (2026-10-26).
- Rebased patch: 7 files, 76 insertions, 32 deletions. `git apply --cached
  --check` against a temporary index of `4e7d0f5` passes.
- Fails first: with only the tests changed, 5 of 10 tests in
  `test/hosts-mcp-config.test.ts` fail; with the fix, that file and
  `test/hosts-trail.test.ts` pass (19 of 19).
- Gate in the worktree (Node 26.7.0): `npm run build` exit 0; `npm test`
  4013 tests, 3875 pass, 49 fail, 89 skipped. By name against
  `upstream-4e7d0f5-failures.txt`: 35 on the list, 14 not. The 14 were
  rerun alone (14 files, 108 tests, 103 pass, 3 fail); all 3 are on the
  list. No failure is in a patched file.
- Tags v0.19.0, v0.20.0, v0.21.0 (and v0.21.1) carry both `spawnSync('graft',
  ['--version'], ...)` and the unpinned `NPX_LAUNCH`, read with
  `git show <tag>:src/hosts/mcp-config.ts`. `Versions:` is now 0.19.0 through
  0.25.0, with the method stated. Not run, only read.
- Prose checks: banned-word grep prints nothing; the em-dash grep prints only
  the quoted upstream test line in the patch (was `advisory.txt:434`).

## Work completed
- Advisory: `Versions:` line, section 8 (new patch, tested-on text) and
  section 9 (counts). Placeholders untouched.
- Worktree `D:/Code/Claude/ub` removed. Nothing pushed or sent.
- Commit: see `git log -1` (advisory and this handoff only).

## Unresolved questions
- Operator: the POSIX path was not run on Linux or macOS; the advisory says so.
- Operator: send the advisory (fill placeholders); upstream may prefer the
  stricter policy named in section 8.
- Not a fault of this stage: 14 tests outside the baseline list failed in the
  full run on a busy machine and passed alone (D13 timing sensitivity).

## Exact next action
Operator: read section 8 of the advisory, fill the placeholders, send. Then
the roadmap continues at Stage 21 (waits for the upstream answer to the issue).

## Cost projection
Sonnet 5.5, medium. 40 turns, average context 60k, 3k fresh input and 1.5k
output per turn. Cache reads 2.4M at the cache-read rate, fresh 120k, output
60k. Quote $0.50 to $1.50 at API list price; the full test run costs wall
clock, not tokens.

## Time projection
Wall clock: about 40 minutes (the test run is about 7 minutes, install and
build about 5). Operator review: about 10 minutes.

## Actuals
- Model and effort: claude-sonnet-5-5 matched; effort not readable from inside
  the session, `medium` taken from the front matter.
- About 45 tool-call turns; test run about 25 minutes wall clock (machine busy).
- Cost: about $1 by the method above (estimated, not metered).

## Next stage
- Next stage: Stage 21, rebase the five pull-request branches onto upstream
  0.25.0. Model: claude-sonnet-5-5, effort: high. Waits for the operator to
  post the design issue and for the upstream answer.
- Kickoff prompt:

```text
Take over Stage 21 of docs/assessment-2026-10-18.md (section 6, item 5): rebase the five pull-request branches onto upstream/main at release 0.25.0. First check that you are claude-sonnet-5-5 at high effort and stop on a mismatch. Read docs/handoffs/2026-10-25-stage-20-merge-upstream-0.25.0.md and docs/handoffs/2026-10-26-stage-16b-advisory-patch.md. Do not start until the operator has posted the design issue and given you the upstream answer; if they have not, stop and say so. Use upstream/main as the base, never main; commit only the feature paths; run the gate on each branch in turn; push nothing unless the operator says so.
```
