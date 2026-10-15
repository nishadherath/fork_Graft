---
stage: "Stage 14: the MCP launcher resolves the installed graft on Windows"
model: claude-sonnet-5-5
effort: medium
status: ready
created: 2026-10-15
from: "Fable 5.1 assessment session, 2026-10-15, on the operator's question about the npx launcher in .mcp.json"
---

# Stage 14: the MCP launcher resolves the installed graft on Windows

## Goal

`graft init`, and the wiring refresh that upkeep runs at session start, write
`{ "command": "graft", "args": ["mcp"] }` into `.mcp.json`, `~/.claude.json` and
every other host's MCP config whenever a `graft` executable is on PATH, on Windows
as well as POSIX. The `npx` form is written only when no installed graft can be
found, and then pinned to the running version. Gate green, global install synced,
the repos on this machine that carry the npx form re-wired.

## Decisions already made

- Root cause is `graftOnPath()` in `src/hosts/mcp-config.ts:49`: `spawnSync('graft', ...)`
  without a shell. On Windows the global `graft` is a `graft.cmd` shim, which a
  shell-less spawn reports as ENOENT (and `graft.cmd` by name as EINVAL since Node's
  CVE-2024-27980 change). The probe always fails on Windows, so the npx launcher is
  written on every init and every refresh. Verified below.
- Replace the probe with a filesystem PATH lookup, not `shell: true`: a lookup costs a
  few `stat` calls, needs no timeout, and is not fooled by a slow Node start
  (`graft --version` takes 2.5 s here; with `shell: true` the 5 s probe timed out).
  Honour `PATHEXT` on win32 (default `.COM;.EXE;.BAT;.CMD`) and the executable bit on
  POSIX. Take `env` and `platform` as parameters so the test does not depend on the
  machine.
- Keep a bare command, never an absolute path, in repo-level files: upstream's reasoning
  at `mcp-config.ts:40-44` stands (`.mcp.json` is committed and shared).
- Assumption taken for the fallback (the operator may overrule, see Unresolved): when no
  graft is on PATH, write `npx -y @nanonets/graft@<running version> mcp`, the version from
  `runningVersion()` in `src/upkeep.ts`. npm never lets a published version be replaced,
  so the pin removes "whatever the registry serves at that moment". A fork build that is
  not on npm then fails visibly at session start, which beats silently running upstream's
  code. Check for an import cycle before importing `upkeep.ts` from `mcp-config.ts`
  (`upkeep.ts` imports `hosts/registry.js` and `hosts/sections.js`); if there is one,
  move `runningVersion` into `src/cli-meta.ts`.
- `GRAFT_MCP_NPX=1` keeps forcing the npx form; five test files set it.
- The `graft init` epilogue names the launcher it wrote (`src/cli.ts:1347`), so the
  choice is visible: `launcher: graft mcp` or `launcher: npx -y @nanonets/graft@x.y.z mcp`.
- Bump the fork version to `0.21.1-nishadherath.1` (package.json and package-lock.json),
  so `reconcileWiring` sees a stamp mismatch and rewrites every wired repo's `.mcp.json`
  on its next session; `scripts/sync-global.mjs` accepts it (same base release).
- Upstream branch `fix/windows-mcp-launcher` cut from `upstream/main`, carrying only
  `src/`, `test/` and `CHANGELOG.md`; `git log upstream/main..fix/windows-mcp-launcher --stat`
  checked before handing it over. The version bump stays on `main` only.

## Files and links that matter

- `src/hosts/mcp-config.ts:46-66`: `NPX_LAUNCH`, `BIN_LAUNCH`, `graftOnPath`, `serverEntry`.
  The only place the launcher is built; `src/claude/init.ts:95`,
  `src/hosts/claude-global.ts:119` and `mcp-config.ts:172` all call `serverEntry()`.
- `src/upkeep.ts:298` `reconcileWiring`, `src/upkeep-run.ts` `rewriteWiring` and `runInit`:
  the per-session rewrite that overwrites a hand-edited `.mcp.json` entry whenever the
  stamp version differs from the running version.
- `src/cli-meta.ts:81` `globalRoot()` already uses `shell: process.platform === "win32"`;
  the pattern this bug missed.
- `test/hosts-mcp-config.test.ts:93-112`: the existing launcher tests to extend.
- `README.md:400` documents the npx form; `CHANGELOG.md` gets the entry under Fixed.
- Repos on this machine with the npx form: `D:\Code\OpenAI\Tensegrity\.mcp.json`,
  `D:\Code\GLM\bewhole-accept\.mcp.json`. Hand-edited to absolute paths, and rewritten
  to `graft mcp` by the next refresh: `D:\Code\Claude\Orchestrator\.mcp.json`
  (also drops its `${CLAUDE_PROJECT_DIR:-.}` argument; the default is the cwd),
  `D:\Code\GLM\BeWhole\.mcp.json` (points at the fork tree's `dist/cli.js`).

## Verified facts (2026-10-15, Node 26.7.0, Windows 11)

- `node_modules/.bin/tsx -e "import {serverEntry} from './src/hosts/mcp-config.ts'; console.log(JSON.stringify(serverEntry()))"`
  prints `{"command":"npx","args":["-y","@nanonets/graft","mcp"]}` with graft installed and on PATH.
- `spawnSync('graft',['--version'])` gives `{status:null, error:'ENOENT'}`;
  `spawnSync('graft.cmd', ...)` gives EINVAL; with `shell:true` ETIMEDOUT at 5 s.
  `time graft --version` is 2.47 s.
- Global shims `C:\nvm4w\nodejs\graft`, `graft.cmd`, `graft.ps1` run
  `node_modules/@nanonets/graft/dist/cli.js`; `graft --version` answers `0.21.1-nishadherath`.
- `~/.claude.json` has no top-level `mcpServers` (checked with node), so the npx form is
  not registered machine-wide.
- `upstream/main` has the same `graftOnPath` (git grep, 2026-10-15); the bug is upstream's.
- Last gate (2026-10-14): `npm test` 1,552 tests, 1,547 pass, 0 fail, 5 skipped.

## Work completed

- Assessment only; no source changed. This handoff.

## Unresolved questions

- Operator: fallback when graft is not on PATH. A: unpinned npx (upstream today).
  B: pinned npx (assumed). C: never npx, write `graft mcp` and warn. Recommendation B;
  C as a fork-only rule diverges from upstream in a file upstream edits on every merge.
- Whether Claude Code on Windows launches `command: "graft"` (a `.cmd` shim). It launches
  `npx` (also a `.cmd`) today, and the MCP SDK's stdio transport resolves shims through
  cross-spawn, so it should. Verify by restarting Claude Code in Tensegrity after the
  re-wire and checking that the `mcp__graft__*` tools appear.

## Exact next action

In `test/hosts-mcp-config.test.ts`, add the failing test: a temp dir holding `graft.cmd`
(win32) or an executable `graft` (POSIX) passed as `PATH` makes `serverEntry()` return
`{ command: 'graft', args: ['mcp'] }`; an empty dir makes it return the npx form. Then
implement `findOnPath(name, env = process.env, platform = process.platform)` in
`src/hosts/mcp-config.ts` and make `graftOnPath()` use it.

## Cost projection

Sonnet 5.5, medium ($2.00 in, $10.00 out, $0.20 cache read per million). 40 turns,
average context 60k, 3k fresh input, 1.2k output per turn. Cache 2.4M x $0.20 = $0.48;
fresh 120k x $2.50 = $0.30; output 48k x $10 = $0.48. About $1.26. Estimate.

## Time projection

Wall clock about 45 minutes, including two gates of about 7 minutes. Operator review
about 10 minutes, plus one Claude Code restart in a re-wired repo.
