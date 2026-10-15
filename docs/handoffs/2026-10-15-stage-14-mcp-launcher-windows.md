---
stage: "Stage 14: the MCP launcher is always the installed graft"
model: claude-sonnet-5-5
effort: medium
status: in-progress
created: 2026-10-15
from: "Fable 5.1 assessment session, 2026-10-15; option C chosen by the operator the same day"
---

# Stage 14: the MCP launcher is always the installed graft

## Goal

`graft init`, and the wiring refresh that upkeep runs at session start, write
`{ "command": "graft", "args": ["mcp"] }` into `.mcp.json`, `~/.claude.json` and
every other host's MCP config, on every platform, whether or not graft is on PATH.
The `npx -y @nanonets/graft mcp` form is never written by this fork. When no graft
executable is on PATH, `graft init` says so in one warning line naming the install
command. Gate green, global install synced, every wired repo on this machine
converges on the next session.

## Decisions already made

- **Operator decision, 2026-10-15: option C.** Never write npx. Write `graft mcp` and
  warn when graft is not on PATH. Options A (unpinned npx) and B (pinned npx) are closed.
- Root cause of the npx form on this machine is `graftOnPath()` in
  `src/hosts/mcp-config.ts:49`: `spawnSync('graft', ...)` without a shell. On Windows the
  global `graft` is a `graft.cmd` shim, which a shell-less spawn reports as ENOENT (and
  `graft.cmd` by name as EINVAL since Node's CVE-2024-27980 change), so the probe always
  failed and the npx fallback was written on every init and refresh. Verified below.
- `serverEntry()` becomes a constant `{ command: 'graft', args: ['mcp'] }`. `NPX_LAUNCH`,
  the `GRAFT_MCP_NPX` override and the `onPath` option are removed; the five test files
  that set `GRAFT_MCP_NPX=1` drop that line and assert the bare form.
- PATH detection survives only for the warning: `findOnPath(name, env = process.env,
  platform = process.platform)`, a filesystem lookup honouring `PATHEXT` on win32 (default
  `.COM;.EXE;.BAT;.CMD`) and the executable bit on POSIX. No spawn, no shell, no timeout
  (`graft --version` takes 2.5 s here; a `shell: true` probe timed out at 5 s). Exported
  from `mcp-config.ts`, tested with a temp dir on an injected PATH.
- The warning is printed once by the `init` command in `src/cli.ts`, after the MCP writes,
  when `findOnPath('graft')` is null: graft is not on PATH, the MCP server will not start
  until it is installed, `npm install -g @nanonets/graft`. Not printed by the silent
  session-start refresh.
- Keep a bare command, never an absolute path: `.mcp.json` is committed and shared, and
  upstream's comment at `mcp-config.ts:40-44` records the scar of the alternative.
- Bump the fork version to `0.21.1-nishadherath.1` (package.json and package-lock.json),
  so `reconcileWiring` sees a stamp mismatch and rewrites every wired repo's `.mcp.json`
  on its next session; `scripts/sync-global.mjs` accepts it (same base release).
- Upstream gets the bug fix only, not the policy: branch `fix/windows-mcp-launcher` from
  `upstream/main` replaces the spawn probe with `findOnPath` and keeps upstream's npx
  fallback, with `CHANGELOG.md`; `git log upstream/main..fix/windows-mcp-launcher --stat`
  shows nothing else. The fork's `main` carries option C on top; the next upstream merge
  will conflict in `serverEntry` and is resolved in favour of the fork.
- `README.md:400` shows the `graft mcp` form; the fork's "This build" section gains one
  line saying this build never writes an npx launcher, so `npx @nanonets/graft init` on a
  machine without a global install needs `npm install -g` before the server starts.
- Leave `src/claude/session-metrics.ts:82` (recognises `npx graft` in transcripts) and
  `src/claude/settings-merge.ts:16` (`Bash(npx graft:*)` permission) as they are.

## Files and links that matter

- `src/hosts/mcp-config.ts:46-66`: `NPX_LAUNCH`, `BIN_LAUNCH`, `graftOnPath`, `serverEntry`.
  The only place the launcher is built; `src/claude/init.ts:95`,
  `src/hosts/claude-global.ts:119` and `mcp-config.ts:172` all call `serverEntry()`.
- `src/upkeep.ts:298` `reconcileWiring`, `src/upkeep-run.ts` `rewriteWiring`, `runInit`:
  the per-session rewrite that overwrites a hand-edited `.mcp.json` entry whenever the
  stamp version differs from the running version.
- `src/cli.ts:1340-1350`: the init epilogue where the warning goes.
- `test/hosts-mcp-config.test.ts:93-112` (launcher tests to rewrite); `GRAFT_MCP_NPX=1`
  also set at the top of `test/claude-init.test.ts`, `test/hosts-claude-global.test.ts`,
  `test/hosts-init.test.ts`, `test/hosts-retract.test.ts`.
- Repos on this machine with the npx form: `D:\Code\OpenAI\Tensegrity\.mcp.json`,
  `D:\Code\GLM\bewhole-accept\.mcp.json`. Hand-edited to absolute paths, rewritten to
  `graft mcp` by the next refresh: `D:\Code\Claude\Orchestrator\.mcp.json` (also drops its
  `${CLAUDE_PROJECT_DIR:-.}` argument; the default is the cwd), `D:\Code\GLM\BeWhole\.mcp.json`.

## Verified facts (2026-10-15, Node 26.7.0, Windows 11)

- `node_modules/.bin/tsx -e "import {serverEntry} from './src/hosts/mcp-config.ts'; console.log(JSON.stringify(serverEntry()))"`
  printed `{"command":"npx","args":["-y","@nanonets/graft","mcp"]}` with graft installed and on PATH.
- `spawnSync('graft',['--version'])` gives `{status:null, error:'ENOENT'}`;
  `spawnSync('graft.cmd', ...)` gives EINVAL; with `shell:true` ETIMEDOUT at 5 s.
  `time graft --version` is 2.47 s.
- Global shims `C:\nvm4w\nodejs\graft`, `graft.cmd`, `graft.ps1` run
  `node_modules/@nanonets/graft/dist/cli.js`; `graft --version` answers `0.21.1-nishadherath`.
- `~/.claude.json` has no top-level `mcpServers`, so the npx form is not registered machine-wide.
- `upstream/main` has the same `graftOnPath` (git grep); the detection bug is upstream's.
- Last gate (2026-10-14): `npm test` 1,552 tests, 1,547 pass, 0 fail, 5 skipped.

## Work completed

- Assessment; handoff `ff21675` (option B assumed), superseded by this revision.

## Unresolved questions

- Whether Claude Code on Windows launches `command: "graft"` (a `.cmd` shim). It launches
  `npx` (also a `.cmd`) today, and the MCP SDK's stdio transport resolves shims through
  cross-spawn, so it should. Operator verifies by restarting Claude Code in Tensegrity
  after the sync and checking that the `mcp__graft__*` tools appear.

## Exact next action

In `test/hosts-mcp-config.test.ts`, replace the two launcher tests: `serverEntry()` is
`{ command: 'graft', args: ['mcp'] }` with no environment variable set; `findOnPath('graft',
{ PATH: dir, PATHEXT: '.CMD' }, 'win32')` finds a `graft.cmd` written into a temp dir and
returns null for an empty dir (POSIX branch with an executable `graft`). Then make
`serverEntry` constant and add `findOnPath` in `src/hosts/mcp-config.ts`.

## Cost projection

Sonnet 5.5, medium ($2.00 in, $10.00 out, $0.20 cache read per million). 40 turns,
average context 60k, 3k fresh input, 1.2k output per turn. Cache 2.4M x $0.20 = $0.48;
fresh 120k x $2.50 = $0.30; output 48k x $10 = $0.48. About $1.26. Estimate.

## Time projection

Wall clock about 45 minutes, including two gates of about 7 minutes. Operator review
about 10 minutes, plus one Claude Code restart in a re-wired repo.
