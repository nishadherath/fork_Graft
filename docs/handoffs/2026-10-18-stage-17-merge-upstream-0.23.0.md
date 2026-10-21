---
stage: "Stage 17: merge upstream 0.23.0 (trailhq/Trail-Code) into main"
model: claude-opus-5-5
effort: high
status: in-progress
created: 2026-10-18
from: "Fable 5.1 assessment session, 2026-10-18 (docs/assessment-2026-10-18.md, section 6)"
---

# Stage 17: merge upstream 0.23.0 into main

## Goal

`main` carries upstream `ead585b` (Trail-code 0.23.0, 2026-10-15) with every fork
feature intact: the structured and documents tiers, `GRAFT_REASONING` and the
deep-pass `tokens:` line, the crux id fix, and the constant `graft mcp` launcher.
The twelve conflicting files are resolved, the fork's `findOnPath` is replaced by
upstream's `commandOnPath`, the upstream name is recorded in `AGENTS.md` and
`docs/operator-protocol.md` section 10, the gate is green with its counts quoted,
the global install is synced, and two measurements are recorded in the handoff:
`graft --version` wall time before and after (three runs each), and whether a
clean `npm ci --ignore-scripts` now loads Kotlin through upstream's WASM fallback
without the hand-copied binary.

## Decisions already made

- Keep the `graft` command, the `@nanonets/graft` package and the `graft/` layout
  (assessment D9, option A). Upstream's `.trail/cache/` layout applies only under
  the `trail` brand; verify the graft brand still writes `graft/` and keep it so.
- A merge never drops a fork feature. Where upstream and the fork both changed a
  seam, the fork's behaviour wins and upstream's new code is adapted around it,
  as Stage 9 did (`955e73d`).
- `serverEntry()` stays the constant `{ command: 'graft', args: ['mcp'] }`
  (operator decision of 2026-10-15, option C). Upstream's `NPX_LAUNCH`,
  `TRAIL_NPX_LAUNCH`, `GRAFT_MCP_NPX` and `graftOnPath` do not come in. The
  warning path in `init` uses upstream's `commandOnPath` from `src/brand.ts`;
  `findOnPath` and its tests go.
- Upstream removed the brain client and its tests (`b92c22e`); take the deletions.
- A merge commit, not a rebase, in a worktree off `main`, then `main` fast-forwards
  to it (the Stage 9 pattern). No fork-only file (`AGENTS.md`, the persona, the
  protocol, `docs/`, `patch/`) is touched by conflict resolution except the two
  named name updates.
- Prose conventions of `AGENTS.md` rule 7 in every line this stage writes.

## Files and links that matter

- Conflicts (from `git merge-tree --write-tree --name-only main upstream/main`,
  2026-10-18): `CHANGELOG.md`, `README.md`, `package-lock.json`, `package.json`,
  `src/cli.ts`, `src/graph/build.ts`, `src/graph/check.ts`, `src/graph/container.ts`,
  `src/graph/extract.ts`, `src/graph/workspace-cli.ts`, `src/hosts/mcp-config.ts`,
  `src/util/state.ts`.
- Upstream's new dispatch: `src/graph/native.ts` (lazy native grammars, WASM
  stand-ins), `tierOf` and `warmGrammarsFor` shared by build and check
  (`c4411a6`). The fork's structured branch in `build.ts:285-347` and the
  documents preparation at `build.ts:233` must join that dispatch, and
  `check.ts` must enumerate the same set.
- `src/brand.ts` upstream: `commandOnPath(name, env)`; `src/hosts/mcp-config.ts`
  fork: constant `serverEntry`, `findOnPath`; `test/hosts-mcp-config.test.ts`.
- `scripts/sync-global.mjs`: the target stays `@nanonets/graft` (upstream's
  `package.json` keeps that name at 0.23.0); the version guard compares base
  releases, so the fork version becomes `0.23.0-nishadherath`.
- `docs/handoffs/2026-10-14-stage-9-merge-upstream-into-main.md`: the previous
  merge's method and its gate counts.
- `docs/assessment-2026-10-18.md` section 8: the startup timings to compare with.
- Memory note `upstream-moved-to-trailhq`: pull requests target
  `trailhq/Trail-Code`; the `upstream` remote follows the redirect.

## Verified facts (2026-10-18)

- `git log main..upstream/main --oneline | wc -l` printed 14 after
  `git fetch upstream --tags`; `git diff main...upstream/main --stat | tail -1`
  printed 182 files, 15,137 insertions, 9,532 deletions.
- `npm view @nanonets/graft version` printed 0.23.0 (modified 2026-10-15), as did
  `@trailhq/trail-code`.
- `git show upstream/main:src/hosts/mcp-config.ts` still spawns `graft --version`
  at line 57; the Windows probe bug is live upstream.
- Startup before: `node <global>/dist/cli.js --version` 6.50, 6.35, 6.33 s;
  `node -e 0` 0.35 s.
- Last gate on `main` (Stage 14, 2026-10-15): 1,553 tests, 1,548 passed, 0 failed,
  5 skipped. The assessment session's own gate is quoted in the Stage 15 handoff.

## Work completed

None.

## Unresolved questions

- Whether `tree-sitter-kotlin` still needs the hand-copied binary: upstream's fix
  acts at load time, not install time; a clean install without the copy answers it.
- Whether upstream's `.trail/` session-start hooks fire under the graft brand in a
  repo wired by this fork (they should not; a test in `test/trail-*.test.ts` may
  say). Operator, if the merge changes any wired repo's behaviour.

## Exact next action

`git worktree add ../fork_graft-stage17-main -b stage-17/merge-upstream main`, then
in it `npm ci --ignore-scripts`, copy `node_modules/tree-sitter-kotlin/build/Release`
from the global install, `npm run build`, record three timings of
`node dist/cli.js --version`, then `git merge upstream/main`.

## Cost projection

Opus 5.5, high ($4.00 in, $20.00 out, $0.20 cache read per million). 100 turns,
average context 100k, 3k fresh input and 1.5k output per turn. Cache 10.0M x $0.20
= $2.00; fresh 300k x $4.00 x 1.25 = $1.50; output 150k x $20.00 = $3.00. About
$6.50; quote $5 to $10 (a third gate or a conflict in the lockfile adds turns).

## Time projection

Wall clock 90 to 150 minutes, including two gates of about eight minutes each run
one at a time. Operator review about 30 minutes, plus one Claude Code restart in a
wired repository to confirm the MCP server still starts.
