---
stage: "Stage 24: the fork becomes its own build; release 0.25.0-nishadherath.1, push, clean up"
model: claude-sonnet-5-5
effort: high
status: done
created: 2026-10-26
from: "Stage 23 session (Fable 5.1, local_60e06b5a) on the operator's decisions of 2026-10-26; supersedes the open items of docs/handoffs/2026-10-26-stage-21-rebase-pr-branches.md"
---

# Stage 24: own build, release, push, clean up

The operator decided on 2026-10-26, closing Stage 21's D15 and D16 and settling the
assessment's D8 in practice: SCSS stays through the vendoring (Stage 21 D15, option B); no
pull requests are opened against upstream (Stage 21 D16, neither option); the fork is the
operator's own build (assessment D8, option B). The work is to commit, merge to `main`, tag,
push to `origin`, and once the push is confirmed delete the branches and worktrees no longer
in use. Nothing is pushed anywhere but `origin`.

## Goal

`main` carries every unmerged fix, is tagged `v0.25.0-nishadherath.1` at a release commit
whose `package.json` says the same, passes the gate under D13, and is pushed to `origin` with
the tag. The global install runs that release. Every branch, backup ref and worktree without
unique content is deleted, locally and on `origin`. This handoff records what was deleted.

## Decisions already made

- Operator, 2026-10-26: option B for SCSS; no upstream PRs; commit, merge to main, tag, push
  to origin; then delete unused branches and worktrees. Pushing to `origin` and deleting
  branches on `origin` are authorised by that instruction. The `upstream` remote is read-only.
- Release convention (precedent `v0.21.1-nishadherath.1` at `cdd4806`): a `chore(release)`
  commit bumps `package.json` (and the two version fields of `package-lock.json`) to the new
  string and turns the CHANGELOG's Unreleased section into a dated release; the annotated tag
  `v<version>` points at that commit. `v0.25.0-nishadherath` already exists at `93c8668`, the
  current `origin/main`, so the new version is `0.25.0-nishadherath.1`.
- One gate at a time: before `npm test`, poll the process list for a running
  `scripts/run-tests.mjs` (no `gate.lock` convention exists). Judge failures by name against
  `docs/baselines/upstream-4e7d0f5-failures.txt`; rerun a non-baseline failure's file alone.
- Never run a `graft` command inside this checkout as a smoke test (it rewires the agent files).
- `AGENTS.md` still says the fork exists to upstream fixes by pull request (purpose paragraph
  and non-negotiable 3). Do not rewrite it in this stage; list the wording change as an open
  item for the operator.

## Branch and worktree triage (verified 2026-10-26, `main` at `582fb48`, 20 commits ahead of `origin/main` `93c8668`)

| Ref | Where | Unique content | Action |
|---|---|---|---|
| `pr/structured-tier-core` `d225674`, `pr/structured-tier-markup-build` `8763eea`, `pr/structured-edges` `d34f5b3`, `pr/documents-tier` `4edaf05` | local; old tips on `origin` | upstream-PR stack cut from `upstream/main`; `git diff main <branch> -- src test` shows only what `main` has and they lack, plus a comment reword in `src/ingest/fs.ts` that drops the "operator decision D7" citation (keep `main`'s wording; D7 resolves in `docs/` here) | nothing to merge; delete local and `origin` heads after the push |
| `pr/crux-id-echo` `4748b34` | local and `origin` | superseded by upstream's `resolveTargetId` (Stage 21 handoff) | delete local and `origin` heads |
| `refs/s21-backup/pr/*` (5 refs) | local | pre-rebase tips, equal to the `origin` heads | delete after the `origin` heads are gone |
| `claude/sad-mirzakhani-86d519` `84917ea` (2026-10-26 14:02) | local, worktree `.claude/worktrees/sad-mirzakhani-86d519` | one real commit: `fix: a --dir on another Windows drive no longer writes the repo's .gitignore and .ignore` (`CHANGELOG.md`, `src/context/node-file.ts`, `test/ignore-outside-root.test.ts`) | if no session is working in that worktree and it has no uncommitted changes, cherry-pick onto `main`, run its test file and `tsc --noEmit`, then remove the worktree and the branch; otherwise leave both and report |
| `D:\Code\Claude\s23` | registered worktree, detached at `84917ea` | none expected; check `git status` there | `git worktree remove` (remove any `node_modules` junction with `cmd /c rmdir` first), then `git worktree prune` |
| `fix/windows-mcp-launcher` `30ee5cf` | `origin` only | `fix(mcp): find graft on PATH without a spawn so Windows shims resolve`; `main` gained `commandOnPath` in Stage 17 for the same fault | compare by content; if `main` covers it, delete the `origin` head; if not, cherry-pick onto `main` first and say so |

## Exact next action, in order

1. Check model (`claude-sonnet-5-5`) and effort (`high`) against this front matter; stop on a
   mismatch. Read `AGENTS.md`, `docs/operator-protocol.md` section 10, this file, and the Stage 21
   and 23 handoffs in `docs/handoffs/`.
2. `git status` clean on `main`; no running gate in the process list.
3. Triage per the table: cherry-pick what has unique content, verify each cherry-pick with its
   test file and `tsc --noEmit`.
4. Release commit: `package.json` and `package-lock.json` to `0.25.0-nishadherath.1`; CHANGELOG
   Unreleased becomes `## 0.25.0-nishadherath.1 (2026-10-26)` in the file's existing style;
   commit `chore(release): version 0.25.0-nishadherath.1`.
5. Gate: `npm run build && npm test`; D13 by name; rerun non-baseline failures alone; quote the
   counts. A real failure is fixed in source with a test that fails first, and the gate reruns.
6. `git tag -a v0.25.0-nishadherath.1 -m "0.25.0-nishadherath.1"` at the release commit;
   `git push origin main` (a fast-forward: `93c8668` is an ancestor) and
   `git push origin v0.25.0-nishadherath.1`; confirm both with `git ls-remote origin`.
7. Only after that confirmation: `git push origin --delete` for the five `pr/*` heads (and
   `fix/windows-mcp-launcher` if superseded); delete the local `pr/*` branches, the
   `refs/s21-backup/*` refs (`git update-ref -d`), the merged `claude/sad-mirzakhani-86d519`;
   remove the two worktrees; `git worktree prune`. Record every deleted ref and path here.
8. `node scripts/sync-global.mjs`; quote its changed, stale-removed and unchanged counts and
   `graft --version` from a temporary folder outside any wired repository.
9. Update this file (status `done`, counts, deletions, open items), set the Stage 21 handoff's
   front matter `status` to `superseded` with one line pointing here, commit, `git push origin main`.

## Result (Sonnet 5.5, high, 2026-10-26)

- **Cherry-picked:** `84917ea` onto `main` as `50122fb` (the worktree's session was idle and both
  worktrees were clean). The CHANGELOG conflicted with the Unreleased section and was merged by
  adding its bullet to the existing Fixed list. `test/ignore-outside-root.test.ts`: 3 of 3 pass;
  `npx tsc --noEmit` clean.
- **Not cherry-picked:** `fix/windows-mcp-launcher` `30ee5cf`. `main`'s `src/hosts/mcp-config.ts`
  has no PATH probe at all (the entry is the same on every machine), so the fault it fixed cannot
  occur; superseded, `origin` head deleted.
- **Release:** `2ae5e31` `chore(release): version 0.25.0-nishadherath.1` (`package.json`, both
  `package-lock.json` version fields, CHANGELOG heading `## 0.25.0-nishadherath.1 (2026-10-26)`).
  The earlier release heading carries no date; the dated form follows the stage brief.
- **Gate** (Node 26.7.0, `npm run build && npm test`, one gate on the machine): tests 4251, pass
  4131, fail 31, skipped 89, cancelled 0, 1411 seconds. All 31 failures are named in
  `docs/baselines/upstream-4e7d0f5-failures.txt` (D13); no non-baseline failure, so nothing was
  rerun alone. Seven baseline entries passed this run (timing-sensitive ones).
- **Pushed to `origin`:** `main` `93c8668..2ae5e31` (fast-forward) and the annotated tag
  `v0.25.0-nishadherath.1` (tag object `9731b26`, peeled `2ae5e31`); both confirmed by
  `git ls-remote origin`. `upstream` was not written.
- **Deleted on `origin`:** `pr/crux-id-echo` `4748b34`, `pr/documents-tier` `9cd4e9b`,
  `pr/structured-edges` `9c6273d`, `pr/structured-tier-core` `d716f05`,
  `pr/structured-tier-markup-build` `aa5fe4e`, `fix/windows-mcp-launcher` `30ee5cf`. `origin` now
  has `main` as its only branch.
- **Deleted locally:** branches `pr/crux-id-echo` `4748b34`, `pr/documents-tier` `4edaf05`,
  `pr/structured-edges` `d34f5b3`, `pr/structured-tier-core` `d225674`,
  `pr/structured-tier-markup-build` `8763eea`, `claude/sad-mirzakhani-86d519` `84917ea` (merged as
  `50122fb`); the five `refs/s21-backup/pr/*` refs (tips equal to the old `origin` heads above);
  worktrees `.claude/worktrees/sad-mirzakhani-86d519` and `D:\Code\Claude\s23` (the
  `node_modules` junctions went first with `cmd /c rmdir`; main's `node_modules` intact, 72
  entries), then `git worktree prune`. `git worktree list` shows `main` only.
- **Left behind:** an empty folder `.claude/worktrees/sad-mirzakhani-86d519` that Windows reports
  "Device or resource busy" (some process holds it as its working directory). It is untracked and
  empty; remove it once that process exits.
- **Global install:** `node scripts/sync-global.mjs`: 3 changed, 0 stale removed, 1627 unchanged;
  both converters present; Kotlin binary present; `graft --version` from a temporary folder
  prints `0.25.0-nishadherath.1`.

## Open items for the operator (not this stage's to change)

- `AGENTS.md` purpose paragraph and non-negotiable 3 describe an upstreaming fork; the roadmap
  in `docs/assessment-2026-10-18.md` section 6 ended at Stage 23. Both want a short rewrite
  recording the own-build decision.
- Stage 23 findings 4 (the 18r patch on `upstream/main`) and 7 (`status` under the graft brand)
  are moot or minor under the own-build decision; finding 6 (symbol-resolved question pins)
  still stands as a small follow-up.

## Cost projection

Sonnet 5.5, high: about 60 turns at 90k average context. Cache reads 60 x 90k x $0.10 = $0.54;
fresh 60 x 3k x 1.25 x $2.00 = $0.45; output 60 x 1.5k x $10 = $0.90. About $1.90 (quote $2 to $4).

## Time projection

About 90 minutes wall clock: 30 minutes of triage, release commit and cherry-picks; one gate of
about 41 minutes; 15 minutes of push, deletion, sync and handoff. Operator review 15 minutes.
