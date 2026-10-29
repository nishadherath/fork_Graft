---
stage: "Stage 45: release 0.28.0-nishadherath.1 (the sign-in fork changes of Stages 43 and 44), push, pack, sync the global install"
model: claude-sonnet-5-5
effort: high
status: ready
created: 2026-10-29
from: "the sign-in analysis session (Claude Fable 5.1), after accepting Stage 44 (7afdc64); starts when the operator decides to release"
---

# Stage 45: release 0.28.0-nishadherath.1

## Goal

`main` carries `chore(release): version 0.28.0-nishadherath.1` and the annotated tag `v0.28.0-nishadherath.1`; the
tests that read the version, the CHANGELOG or the README pass on the release commit; then, each after the operator's
yes in this session: `main` and the tag pushed to `origin`, the tarball packed into `D:\Code\Claude\fork_graft_releases`,
the global install synced, and `trail --version` from an empty folder outside any repository printing
`0.28.0-nishadherath.1`. Handoff updated to `status: done`.

## Decisions already made

- The version is `0.28.0-nishadherath.1`: the fork numbers its releases on one upstream base as `.N` (see the
  `0.25.0-nishadherath.1` to `.6` headings in `CHANGELOG.md`). The base stays 0.28.0, so `sync-global` does not
  refuse and no reinstall of the global package is needed (protocol section 10, second bullet, applies only when
  the base changes).
- Method of Stages 24, 28, 41 and the `.6` release: `node scripts/release.mjs 0.28.0-nishadherath.1` edits
  `package.json`, both lockfile version fields, the CHANGELOG (Unreleased becomes a dated heading with a fresh empty
  Unreleased above) and the README "This build" section, and prints the commands that finish the release. Match the
  paths of the last release commit (`git show --stat a498f6f`); if `GRAFT_init.md` names the version there, update it
  the same way.
- No full gate: the tree is Stage 44's accepted tree (`7afdc64`, gate 4479 tests, 4339 pass, 38 fail, 102 skipped,
  D13 held) plus version and prose edits. As Stage 41 did, rerun alone, under a fresh scratch `HOME`, every test file
  that reads the version, the CHANGELOG or the README (`grep -l -E "package.json|CHANGELOG|README" test/*.test.ts`),
  and quote their counts.
- Approval steps (protocol section 8; dispatch guardrail 3): stop and ask the operator, in this session, before
  `git push` and again before `node scripts/sync-global.mjs`. Quote their yes in the handoff.
- Never run the `graft` or `trail` CLI in this checkout or in `D:\Code\Claude\ub`; the version check runs from an
  empty folder under `%TEMP%` that is not a git repository, removed afterwards.
- Prose: Australian English, no em-dashes, none of the persona's banned words.

## Files that matter

- `scripts/release.mjs` (contract in its header), `test/release-script.test.ts`.
- `CHANGELOG.md` Unreleased: one Changed and two Fixed entries from Stages 43 and 44; read them once for sense
  before they become the release heading.
- `README.md` "This build" section; `GRAFT_init.md` if it names the version; `scripts/sync-global.mjs`,
  `scripts/sync-global-checks.mjs`.
- Precedents: `docs/handoffs/2026-10-29-stage-41-release-0.28.0-nishadherath.md` (the push, pack and sync steps and
  the checks they printed), `docs/handoffs/2026-10-28-release-0.25.0-nishadherath.6.md` (a same-base release).
- The stages released: `docs/handoffs/2026-10-29-stage-43-sign-in-fork-fixes.md`, `docs/handoffs/2026-10-29-stage-44-codex-table-owner.md`.

## Verified facts (2026-10-29)

- `origin/main` is at `9c7eea6` (the Stage 44 brief), moved there by a push from this checkout at 21:07:53 on
  2026-10-29 while Stage 44's author ran; so the Stage 43 feature `88d59b3` and the documents up to the Stage 44 brief
  are on `origin` already. Not pushed: `7afdc64` (Stage 44), `6f6ff9b`, `3eba296` and later documentation commits.
  `git log origin/main..main --oneline` lists them.
- The global install is `0.28.0-nishadherath` with the `trail` command linked (Stage 41's sync report), so the base
  release is unchanged.
- Stage 44's gate and D13 verdict: its handoff, Work completed and Acceptance.

## Work completed

- None yet.

## Unresolved questions

- None. `trace-guard-fast` "a guard call takes under 2 ms" fails on this machine on plain upstream too; it is not
  in the baseline file and is not a reason to hold the release.

## Exact next action

`git status --porcelain` empty; `node scripts/release.mjs 0.28.0-nishadherath.1`; read the diff; rerun the
version-reading test files alone under a fresh scratch `HOME`; commit `chore(release): version 0.28.0-nishadherath.1`
with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; `git tag -a v0.28.0-nishadherath.1 -m "0.28.0-nishadherath.1"`;
ask the operator; push `main` and the tag; pack; ask the operator; `npm run build` then `node scripts/sync-global.mjs`
and quote its report; `trail --version` from an empty scratch folder; set this file to `status: done` with the facts
and commit it. Blocked: stop and report in five lines.

## Session dispatch

Not run in full: about 15 turns at Sonnet (about $0.55 at the table of 2026-10-18: 15 turns at an average context of
about 140,000 tokens, F 3,000, O 1,500), below the cost of a full record. A fresh session rather than a subagent,
because the operator approves the push and the install inline; the class and effort follow Stage 41's precedent for
the same work.

## Cost projection

About $0.55 for the stage and $0.10 for its handoff update: about $0.65.

## Time projection

20 to 30 minutes of wall clock, the partial test run included; the operator's two approvals and 10 minutes of review.
