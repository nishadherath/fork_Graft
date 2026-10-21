---
stage: "Stage 17: merge upstream 0.23.0 (trailhq/Trail-Code) into main"
model: claude-opus-5-5
effort: high
status: done
created: 2026-10-18
from: "Fable 5.1 assessment session, 2026-10-18 (docs/assessment-2026-10-18.md, section 6)"
---

# Stage 17: merge upstream 0.23.0 into main

## Goal

`main` carries upstream 0.23.0 with every fork feature intact, the conflicts
resolved, the upstream name recorded, the gate green with its counts quoted, the
global install synced, and the `--version` timings and the Kotlin fallback measured.
Done on 2026-10-21: gate 1,665 tests, 1,653 passed, 0 failed, 12 skipped.

## Decisions already made

- Keep the `graft` command, the `@nanonets/graft` package and the `graft/` layout
  (assessment D9, option A). Held by `test/graft-brand-layout.test.ts`.
- A merge never drops a fork feature; where both sides changed a seam, the fork's
  behaviour wins and upstream's code is adapted around it.
- `serverEntry()` is a constant per brand: `graft mcp`, or `trail mcp` under the
  trail brand. Never npx, no PATH probe, no `GRAFT_MCP_NPX` (operator decision of
  2026-10-15, option C, extended to upstream's new brand).
- `findOnPath` moved to `src/graph/lsp/registry.ts` instead of being deleted:
  Stage 18 made the LSP lookup depend on it (PATHEXT, a returned path), which
  `commandOnPath` does not give. `graft init` warns through `commandOnPath`.
- Merged `upstream/main` at `0c750cc` (0.23.0 plus two later fixes), not `ead585b`:
  the handoff's next action said `upstream/main`, and both fixes are small.
- The global install is a `--ignore-scripts` install of the fork's own tarball:
  `sync-global` refuses across base releases, and `openai` moved from 6 to 7.

## Files and links that matter

- Merge commit `a1e3f50` on `main`. Seams: `src/graph/build.ts` (`FileTier`,
  `tierOf`, `warmGrammarsFor` now carry the structured tier), `src/graph/check.ts`,
  `src/graph/container.ts` (`extractEmbedded` takes the WASM fallback),
  `src/hosts/mcp-config.ts`, `src/graph/lsp/registry.ts`, `src/cli.ts`.
- Tests changed: `test/hosts-mcp-config.test.ts`, `test/hosts-trail.test.ts`
  (installed-binary entries), new `test/graft-brand-layout.test.ts`.
- Protocol section 10 (upstream name, reinstall, Kotlin fallback, smoke-test trap);
  `docs/architecture/system-reference.md` sections 1 to 5 and 9 re-verified.

## Verified facts (2026-10-21, Node 26.7.0)

- `git fetch upstream --tags`: `upstream/main` was `0c750cc`, 16 commits ahead of
  `main`. `git merge` conflicted in the same 12 files the dry run named.
- Gate after the merge: 1,665 tests, 1,653 passed, 0 failed, 12 skipped, 531 s.
  The skips are Windows platform skips and tests upstream marks skip.
- `--version`, three runs each, bash wall clock. Before, fork `dist/` 1.44, 1.37,
  1.63 s; global (0.21.1-nishadherath.1) 3.08, 3.03, 3.16 s. After, fork `dist/`
  1.53, 1.52, 1.46 s; global through node 2.15, 2.07, 2.06 s; through `graft.cmd`
  2.52, 3.03, 2.35 s. `node -e 0` 0.38 s. `ask --no-refresh -n 1` through the shim
  2.38, 2.61, 2.24 s. The assessment's 6.3 s of 2026-10-18 did not reproduce.
- Kotlin with `node_modules/tree-sitter-kotlin/build` moved aside:
  `nativeReady("kotlin")` false, the build succeeds through the WASM stand-in and
  prints one fix line. Same spans as native on a fixture; `open` is a `function`
  not a `method`, 1 edge instead of 4. The binary copy is still made.
- `sync-global` after the reinstall: 0 changed, 0 stale removed, 859 unchanged;
  `graft --version` printed `0.23.0-nishadherath`; the global `pdfjs-dist` loads.
- The global `graft mcp` answered `initialize` in 2.2 s as `serverInfo.name: graft`.
- Under the graft brand `graft init` creates no `.trail/` and the map is `graft/`.

## Work completed

- Merge `a1e3f50` (twelve conflicts resolved as above; brain fields and imports
  dropped with upstream's deletion; version `0.23.0-nishadherath`; README and
  CHANGELOG carry both histories; AGENTS.md and protocol section 10 updated).
- Global install backed up to the session scratchpad, reinstalled from the fork's
  tarball, Kotlin binary restored, synced. The main checkout reinstalled and rebuilt;
  its `dist/` matches the global install byte for byte.
- Worktree `fork_graft-stage17-main` and branch `stage-17/merge-upstream` removed.
- Incident: a smoke test ran `graft mcp` here and upkeep rewrote the agent files,
  and the user-level `~/.claude/helpers/graft-hooks.cjs` (that one any first graft
  command after the upgrade would rewrite). Undone here: tracked files from git,
  `.mcp.json` and the stamp removed, `.claude/settings.json` reset to the
  operator-protocol hook alone (this session's start ran only that hook).
  Not pushed to `origin`.

## Unresolved questions

- Operator decision D12, this checkout's map folder. Upstream `0c750cc` tracks two
  files in `.trail/learnings/`, so upstream's `mapDirFor` treats this repository as
  on trail: a graft command moved `graft/` to `.trail/cache/` and wrote an untracked
  `.trail/.gitignore` (19:11). Repositories this build wires are not affected
  (`test/graft-brand-layout.test.ts`). A: keep it so (no code, no divergence). B:
  delete upstream's learnings on `main` (re-added by every merge). C: `mapDirFor`
  ignores `.trail/learnings/` under graft (a new seam against upstream's design).
  Blast radius: this checkout's cache path for A and B; every repository with
  upstream-style learnings for C. Recommended: A; the cache is regenerable and the
  layout D9 protects is tested. Nothing waits on it.
- Operator: was `.claude/settings.json` in this checkout only the operator-protocol
  hook before 2026-10-21? The reset assumed so.
- Upstream: `hooks.ts` line 170 runs `check . --json`, which is the team check under
  the trail brand, so the stale count reads 0 there (system reference section 9).
- Later stage: `docs/architecture/system-diagram.html` and reference sections 6 to 8
  were not re-checked against the merge.

## Exact next action

Roadmap Stage 18 (startup by per-command loading), as Stage 18r:
`docs/handoffs/2026-10-21-stage-18r-startup.md`.

## Cost projection

Projected $6.50 ($5 to $10). Actual: about 90 turns, context to 290k (average
180k): cache 16.2M x $0.20 = $3.24; fresh 270k x $5.00 = $1.35; output 135k x $20.00
= $2.70; plus about $1 of Sonnet subagent work. About $8.30.

## Time projection

Projected 90 to 150 minutes. Actual about 50 minutes of session wall clock plus the
531 s gate and a two-minute global install inside it. Operator review about 30
minutes, plus one Claude Code restart in a wired repository to see the MCP server
start under 0.23.0.
