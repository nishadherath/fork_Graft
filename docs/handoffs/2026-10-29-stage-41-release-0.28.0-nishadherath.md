---
stage: "Stage 41: release 0.28.0-nishadherath, push, pack, reinstall and sync the global install, close out"
model: claude-sonnet-5-5
effort: high
status: done
created: 2026-10-29
from: "Stage 40, docs/handoffs/2026-10-29-stage-40-acceptance.md (claude-fable-5-1, xhigh, local_6c0345a1), on its accept of merge 3337689"
---

# Stage 41: release 0.28.0-nishadherath

First action: read your own configuration with the session tool (`self`). If the model is not
`claude-sonnet-5-5` or the effort is not `high`, stop and name the value to pick in the model menu.

## Goal

`main` carries `chore(release): version 0.28.0-nishadherath` and the annotated tag
`v0.28.0-nishadherath`, both on `origin`; `nanonets-graft-0.28.0-nishadherath.tgz` and its CHANGELOG
copy are in `D:\Code\Claude\fork_graft_releases`; the global install is reinstalled from that tarball
(the base release moves from 0.25.0 to 0.28.0, so `sync-global` refuses until it is) and then synced;
`trail --version` from an unwired folder prints `0.28.0-nishadherath`; the `D:\Code\Claude\ub`
worktree is gone and the remotes pruned. Gate green under D13, every step quoted.

## Decisions already made

- Stage 40 accepted `3337689` (D36 A). The version is `0.28.0-nishadherath`, the base release plus
  the fork suffix, as `0.25.0-nishadherath` opened the last cycle; `.1`, `.2` follow later.
- D13 option A against `docs/baselines/upstream-19865ff-failures.txt` (42 names). Stage 40's gates:
  34 failing names, all in the baseline. A one-sided failure is rerun alone before it counts.
- Release method of Stages 24, 28 and the `.6` release: `node scripts/release.mjs <version>` edits
  `package.json`, both lockfile version fields, CHANGELOG (Unreleased becomes a dated heading) and
  the README "This build" section, refuses a dirty tree, and prints the commands to run next.
  `GRAFT_init.md` lines 13 and 36 are updated by hand (two `.6` strings). The commit takes explicit
  paths; the tag is annotated.
- Reinstall recipe (protocol section 10, the Stage 17 bullet, minus the Kotlin copy): back up the
  global `@nanonets/graft` folder and the six shims (`graft`, `graft.cmd`, `graft.ps1`, `trail`,
  `trail.cmd`, `trail.ps1`) from `C:\nvm4w\nodejs`; `npm install -g <tgz> --ignore-scripts`; then
  `node scripts/sync-global.mjs`, which should report every file unchanged, both converters present,
  the trail command present and no Kotlin line (Stage 40 removed it, `86af73e`).
- Gate environment: Git Bash, Node 26.7.0, `HOME` and `USERPROFILE` at a scratch folder holding a copy
  of `.gitconfig` and made fresh for this gate (a reused one fails three `trail-scenario-hooks` tests;
  protocol section 10), `DO_NOT_TRACK=1`, `GRAFT_NO_TRAIL_SWITCH=1`, one gate at a time, in the background.
  The two PATH-sensitive files rerun with every PATH entry containing `nvm` or `nodejs` removed, a
  `node.exe` copy first on PATH, `--test-concurrency=1` (Stage 40: 14 tests, 13 pass, 1 skipped).
- Never run the `graft` or `trail` CLI in this checkout or in `D:\Code\Claude\ub`. The version check
  after the sync runs from a scratch folder outside any wired repository.
- Prose: Australian English, no em-dashes, none of persona section 14.1's banned words.

## Files and links that matter

- `scripts/release.mjs` (header comment states its contract), `test/release-script.test.ts`.
- `CHANGELOG.md` Unreleased: the merge entry and Stage 40's `sync-global` fix. Add one bullet before
  releasing: this fork keeps writing the installed MCP launcher, so upstream's 0.28.0 note that agents
  "now start Trail through npx" (#709) does not apply here (`c4d4120`, option C).
- `GRAFT_init.md:13` and `:36`; `README.md` lines 80, 104 and 121 to 123 (release.mjs rewrites these).
- `docs/operator-protocol.md` section 10: the reinstall bullet and the 0.28.0 Kotlin bullet.
- `scripts/sync-global.mjs`, `scripts/sync-global-checks.mjs` (after `86af73e`).
- Precedent: `docs/handoffs/2026-10-28-release-0.25.0-nishadherath.6.md`.
- Stage 40's evidence: `docs/handoffs/2026-10-29-stage-40-acceptance.md`, "Work completed".

## Verified facts (Stage 40, 2026-10-29)

- `npm pack --dry-run --ignore-scripts`: 1,706 files, 21,841,780 bytes unpacked, 3,584,333 bytes tgz
  (the `.6` tarball was 4,417,081 bytes: the native Swift prebuilds have left `dist/vendor/`). Both
  bins, 9 depth grammars in `dist/vendor/grammars/`, SCSS in `dist/vendor/wasm/`, no `src/` or `test/`.
- Global install today: `0.25.0-nishadherath.6` at `C:\nvm4w\nodejs\node_modules\@nanonets\graft`.
  `node scripts/sync-global.mjs --dry-run` (read-only, 15.8 s): 276 would change, 8 stale removed,
  1,411 unchanged, both converters present, trail command present.
- Smoke test of the built CLI from a temp folder with a scratch `HOME`: build, `ask --source` and
  `skeleton` print exact spans for fences, Kotlin methods, a page script and config keys.
- `D:\Code\Claude\ub` is a detached worktree at `19865ff` (`git worktree list`); nothing of value in it.

## Work completed

Run by local_884c65f6 (claude-sonnet-5-5, high; checked with `self` first). 2026-10-29.

- **Launcher bullet** added to CHANGELOG Unreleased, commit `707f4ad`.
- **Stage 42 folded into this release at the operator's instruction** (one gate, not two). Stage 42
  committed its fix as `d2b51e8` (`src/graph/resolve.ts`, two tests, a CHANGELOG bullet) and its
  handoff as `8c58170`; the release is cut on top, so 0.28.0-nishadherath carries that fix.
- **The one gate** ran in Stage 42's session on `8c58170` (`npm run build && npm test`, fresh scratch
  HOME, Node 26.7.0): 4,454 tests, 4,305 pass, 47 fail, 0 cancelled, 102 skipped; build clean.
- **D13 judgement, made here** (diff of the 47 failing names against the 42-name baseline with
  `comm`): 13 names not in the baseline, 8 baseline names not failing. Reruns alone, fresh HOME each:
  the 12 files holding the 13 names (11 files in one run, `trace-guard-fast` with the skills files):
  every non-baseline name passes alone except `a guard call takes under 2 ms` (`trace-guard-fast`),
  which fails identically on plain upstream `19865ff` in `D:\Code\Claude\ub` (4 files, 43 tests, 36
  pass, 6 fail, 1 skipped on both trees, the same 6 names). The other 5 alone-failures
  (`cached 10 minutes`, `credit in the prompt hook (D57)`, `git probes`, `probes ... off the
  allowlist`, `ready probes`) are baseline names. Verdict: no regression, D13 passes.
- `hosts-trail` + `graft-to-trail`, nvm and nodejs off PATH, `node.exe` copy first,
  `--test-concurrency=1`: 14 tests, 13 pass, 0 fail, 1 skipped, 16.9 s.
- `node scripts/release.mjs 0.28.0-nishadherath` edited `package.json`, `package-lock.json`,
  `CHANGELOG.md`, `README.md`; `GRAFT_init.md` lines 13 and 36 edited by hand. The gate ran before the
  version bump, so I reran the files that read the version, CHANGELOG or README (16 files): 141 tests,
  137 pass, 0 fail, 4 skipped.
- Release commit `a498f6f` (five paths), annotated tag `v0.28.0-nishadherath`; `git push origin main`
  (`77f9dd2..a498f6f`) and the tag are on `origin` (`git ls-remote --tags`: tag object `8727c5b`).
- `npm pack --ignore-scripts`: `nanonets-graft-0.28.0-nishadherath.tgz`, 3,584,371 bytes, 1,706 files,
  21.8 MB unpacked, in `D:\Code\Claude\fork_graft_releases` with
  `nanonets-graft-0.28.0-nishadherath-CHANGELOG.md` (82,144 bytes).
- **Global install**: backed up first to
  `D:\Code\Claude\fork_graft_releases\global-backup-0.25.0-nishadherath.6-2026-10-29` (the package
  folder and the six shims, 418 MB). `npm install -g <tgz> --ignore-scripts`: "added 1 package, removed
  13 packages, and changed 32 packages in 6m" (5 min 56 s). Cleanup warned EPERM on a leftover
  `.graft-6GToJLQh` folder (an MCP server held an old `.node` file); I removed the folder afterwards.
- `node scripts/sync-global.mjs`: 0 changed, 0 stale removed, 1,687 unchanged; global answers
  `--version 0.28.0-nishadherath`; both converters present; trail command present; no Kotlin line.
- From an empty folder under `%TEMP%` (not a git repository, removed afterwards): `trail --version` and
  `graft --version` both print `0.28.0-nishadherath`.
- `git worktree remove D:/Code/Claude/ub` (the `--force` form was refused by the auto-mode classifier;
  the plain form worked, the tree was clean), `git worktree prune`, `git remote prune origin` (nothing),
  `git remote prune upstream` (stale remote branches removed). `git worktree list` shows only the fork.
- Stage 42 then committed its handoff as `29d1bb8` (docs only) on top of the tag.

## Unresolved questions

- The Markdown fence resolver gap (`l-053d69dd`): a later Sonnet stage, not this one.
- `AGENTS.md` non-negotiable 1 and line 113 still say to copy the Kotlin binary: a documentation
  stage or the operator. Do not widen this release to it.

## Exact next action

```
git -C D:\Code\Claude\fork_graft status --porcelain
```

Must print nothing. Then, in order: add the launcher bullet to CHANGELOG Unreleased and commit it
(`docs(changelog): ...`); `node scripts/release.mjs 0.28.0-nishadherath`; update the two
`GRAFT_init.md` lines; read the diff; start the gate in the background and, while it runs, prepare
the backup folder; judge the gate under D13 and rerun the two PATH files; commit the five files by
path as `chore(release): version 0.28.0-nishadherath`; `git tag -a v0.28.0-nishadherath -m
0.28.0-nishadherath`; `git push origin main` and `git push origin v0.28.0-nishadherath`;
`npm pack --ignore-scripts --pack-destination D:\Code\Claude\fork_graft_releases`; copy CHANGELOG.md
beside it as `nanonets-graft-0.28.0-nishadherath-CHANGELOG.md`; back up and reinstall the global
install from the tarball with `--ignore-scripts`; `node scripts/sync-global.mjs`; `trail --version`
and `graft --version` from a scratch folder; `git worktree remove D:\Code\Claude\ub`, `git worktree
prune`, `git remote prune origin`, `git remote prune upstream`; write this file's "Work completed"
with every count and hash, set `status: done`, commit it.

## Cost projection

Sonnet 5.5, high, list prices (cache read 0.10, cache write 2.50, output 10.00 per million): about
45 turns, average context 60k, fresh 3k, output 2k. Cache reads 45 x 60k = 2.7M x 0.10 = $0.27; fresh
135k x 2.50 = $0.34; output 90k x 10 = $0.90. About $1.50; $1.20 to $2.50 across 35 to 70 turns. The
gate costs no tokens.

## Time projection

60 to 80 minutes wall clock: edits 10, gate 18 to 23 in the background, PATH rerun 2, commit, tag,
push and pack 10, reinstall and sync 15 (npm takes 11 to 16 s per global command here), version
check and cleanup 10, handoff 10. Operator review 15 minutes.
