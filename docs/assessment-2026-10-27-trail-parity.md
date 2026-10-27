# Trail parity: what upstream's `trail` command means for the fork, and the blast radius of invoking `trail` everywhere

Written 2026-10-27 by the trail parity analysis session (Claude Fable 5.1,
high), on the operator's request of the same day, recorded in
`docs/handoffs/2026-10-27-trail-parity-analysis.md`. Evidence is the fork at
`main` (`b91165f`, plus the Stage 31 session's uncommitted files, which this
document does not cite) and upstream at `release/0.26.0` (`cc48a9d`, untagged),
compared against their merge base `4e7d0f5` (upstream 0.25.0) with `git show`
and `git diff`. No `graft` or `trail` command was run in this checkout.
Decisions continue from D28; the numbering of the 2026-10-27 assessment stops
at D27.

## 0. Conclusion

1. **The rename is a brand switch inside one program, decided per process by
   one environment variable, and a second on-disk layout that the brand
   selects.** Since upstream 0.22.0 (commit `d45a801`, 2026-10-14) every
   release ships as two npm packages built from the same tree:
   `@trailhq/trail-code` (`bin: trail`) and `@nanonets/graft` (`bin: graft`).
   `dist/bin/trail.js` and `dist/bin/graft.js` set `TRAIL_INVOKED_AS` and load
   the same `dist/cli.js` (`src/bin/trail.ts:5-8`, `src/bin/graft.ts:5-8`,
   `src/brand.ts:27-41`). Under `graft` nothing is removed and the output is
   kept byte for byte (`src/brand.ts:2-9`). Under `trail` three commands change
   name or meaning, the output prefix is `[trail]`, the repository's agent
   wiring takes a different shape, and the code map moves to `.trail/cache/`.
   The fork already carries all of this code: it ships `dist/bin/trail.js` and
   its tests run the trail paths under `TRAIL_INVOKED_AS=trail` (52 test files
   set the brand). What the fork lacks is a `trail` executable and any
   repository or harness wired for trail.
2. **The two commands are the same engine but not interchangeable
   command for command.** `graft check` is the freshness check and
   `trail check` is the learnings check of the branch's diff; `graft stats` is
   `trail status`; `graft init` writes the graft layout and `trail init` writes
   trail's and reads past Claude sessions once; `graft mcp` serves `graft_*`
   tools and `trail mcp` serves the same tools as `trail_*`. Section 2 has the
   full table. The map, the learnings and the savings accounting are shared:
   the footer parser already accepts both prefixes
   (`src/context/savings.ts:146`) and the command classifier already accepts
   both names (`src/claude/session-metrics.ts:78-86`).
3. **Parity of the fork's additions is nearly free, because the fork wrote
   them brand-neutrally.** Of the fork's changes since `4e7d0f5`, the
   `status` registration under graft, the fork marker and its refusals, the
   stats saving fix, the bare MCP launcher, the structured and documents
   tiers and the LSP default all run under `trail` today without change
   (section 3.1). The work is elsewhere: a `trail` executable in the global
   install, the wiring of ten repositories on this machine, the docs that
   spell `graft`, and the tests that pin the graft layout.
4. **The blast radius of "invoke `trail` everywhere" is the machine, not the
   source.** Installing a `trail` command makes every graft-wired repository
   move itself to trail's layout the first time a Claude Code session opens
   in it (`src/upkeep-run.ts:71-81`, via the session-start hook at
   `src/claude/hooks.ts:530`), unless `GRAFT_NO_TRAIL_SWITCH=1` is set. Ten
   distinct repositories on this machine are wired for graft today, including
   this checkout with its committed shims. The move removes the repository's
   MCP server for Claude Code, replaces the committed skill with a personal
   one under `~/.claude`, and runs a one-time read of past sessions. These are
   changes in how sessions work, and they are the operator's to accept
   (D29).
5. **Parity is cheaper on the current base than after merging 0.26.0.** The
   parity changes touch `package.json`'s `bin` (which 0.26.0 leaves at
   `graft` alone), scripts, docs and fork-only tests; none of those lines
   conflict with 0.26.0. Merging first would spend Stage 30 ($3.90 and three
   gates) for `init --pair` and `--agents auto`, features of Trail's hosted
   setup that this operator does not use. D26 stays A.

Recommended path: D28 A (the fork's one package gains a second `bin`,
`trail`, installed once from a tarball), D29 B staged (set
`GRAFT_NO_TRAIL_SWITCH=1` first, then move this checkout and a scratch
repository deliberately, then the other nine, one commit each), D30 A (on
the current base), D31 A (keep the graft layout test, add its trail twin).
Section 5 prices the stages: about $14 at list price and 4.5 to 9 hours of
wall clock, with about 1.5 hours of operator review and a handful of
operator-run steps (the tarball reinstall, one environment variable, ten
commits in ten repositories).

## 1. What the rename means

### 1.1 When and why

| Date | Upstream commit | What changed |
|---|---|---|
| 2026-10-13 | `8dc7a63` (#585) | `src/brand.ts` first appears: `trail init` learns from past Claude sessions; the brand is introduced so `trail` and `graft` can differ |
| 2026-10-14 | `b92c22e` | the old `graft trail push/pull` group and the brain client are removed |
| 2026-10-14 | `d45a801` (#595), release 0.22.0 | the repository becomes `trailhq/Trail-Code`; the build is published as `@trailhq/trail-code` as well as `@nanonets/graft`; `graft upgrade` installs both; hook shims find either package; the once-a-day notice and the weekly handover line are added; the README is rewritten around "the graft map" and learnings |
| 2026-10-15 | `f8b5dad` (#619) | `trail init` shares one hook and the code map in `.trail/` and keeps the rest personal: the second on-disk layout |
| 2026-10-23 | `d205ac3` (#658) | `trail init` look-back, hook wiring with skills on by default |
| 2026-10-26 | `b7e7616` (#696), release 0.26.0 | `init --pair` always runs as trail whichever name started it (`asksForTrail`, `src/brand.ts` at 0.26.0 lines 42-52) |

The reason is in the 0.22.0 changelog (`CHANGELOG.md:424-448`): graft became one
part, "the graft map", of a product whose other part is learnings shared
through `.trail/`. The company and the product are Trail; the npm scope and
command follow the product. The README at `release/0.26.0` keeps the promise in
one sentence (`README.md:49` in upstream's text, unchanged in the fork):
"Graft is now Trail-code. Graft lives on as the graft map, and every `graft`
command still works."

### 1.2 What `trail` changes

Five things differ between the two names. Everything else is the same code
path.

1. **Command layout.** `src/cli.ts:113` fixes `TRAIL` once from the brand.
   Under trail: `check` is the learnings check of the branch diff and the
   freshness check becomes `build --check` (`src/cli.ts:954-971`,
   `src/brand.ts:54`); `stats` and the former trail status become one
   `status` (`src/brand.ts:55`, `src/cli.ts:1018`); `version`, `stats`, `viz`
   and `mcp` are hidden but still run (`src/cli.ts:459,1018,1036,1097`);
   `note` is listed (`src/cli.ts:1266`, hidden under graft); `team`,
   `workspace`, `login` and `logout` exist only under trail
   (`src/cli.ts:2678-2681`); help is grouped with one-line summaries
   (`src/cli.ts:115-129,2683-2718`). Under graft the help is one flat list and
   nothing moves.
2. **Output prefix.** `tag()` is `[trail]` or `[graft]` (`src/brand.ts:44-46`);
   `cmd()` spells every hint in the running name (`src/brand.ts:64-71`);
   `inBrand()` renames `graft_*` tool names and the word graft in agent-facing
   prose (`src/brand.ts:79-82`). Upstream's skills, guard and learnings code
   also carry literal `[trail]` strings that print under graft too
   (`src/trace/guard-fast.ts:25`, `src/claude/start-skills.ts:59-62`,
   `src/notes/notes.ts:441`): this session's own start-up context in this
   graft-wired checkout opened with four `[trail]` lines, and the pre-bash
   guard refused a command with a line beginning "trail:".
3. **On-disk layout.** The map is `graft/` in a graft-wired repository and
   `.trail/cache/` once the repository is wired for trail or has
   `.trail/learnings/` (`src/context/map-dir.ts:22-37`). A `graft/` map is
   renamed on the move unless git tracks it (`src/context/map-dir.ts:49-56`).
   Learnings live in `.trail/learnings/` under both names when kept; the build
   configuration stays in `.graft/config.json` under both
   (`src/util/state.ts:139`); the home folders are `~/.graft/` for the
   notices' stamps and the update cache (`src/brand.ts:134,240`) and
   `~/.trail/` for personal learnings and the install hint
   (`src/notes/trail-home.ts:11`).
4. **Agent wiring.** The brand a repository's hooks speak is read from the
   repository, not the machine (`src/brand.ts:93-125`,
   `src/claude/init.ts:40-41`, `src/hosts/registry.ts:183-184`): a repository
   with `.trail/hook.cjs`, `.claude/helpers/trail-hooks.cjs`,
   `.claude/skills/trail/SKILL.md` or a settings file naming either is on
   trail; everything else is on graft. The hooks adopt that brand at every
   event (`src/claude/hooks.ts:521`), but only speak trail when a `trail`
   executable is on PATH (`src/brand.ts:122`). Section 2.4 lists what each
   layout writes.
5. **The move.** A graft-wired repository moves to trail's layout by itself
   the first time a session opens in it on a machine that has the `trail`
   command (`src/upkeep-run.ts:71-81`; the session-start hook calls `runUpkeep`
   at `src/claude/hooks.ts:530`, which calls `reconcileWiring` with the move).
   `graft upgrade` moves the current repository at once after installing trail
   (`src/cli.ts:466-495`). `GRAFT_NO_TRAIL_SWITCH=1` keeps a machine on graft.
   Nothing moves a repository back.

### 1.3 What upstream still promises graft users

- `@nanonets/graft` gets every release, at the same version as
  `@trailhq/trail-code`; both are at 0.26.0 on npm today (`npm view`,
  2026-10-27). The second package is laid out from the same build by
  `scripts/pack-trail.mjs:33-53`, which rewrites only `name`, `description`,
  `keywords` and `bin`.
- Under `graft` every old command, meaning and output is kept
  (`src/brand.ts:5-9`); the hook shims upstream writes find
  `@trailhq/trail-code`, `@nanonets/graft` or `@trailhq/trail`, newest first,
  and look for `trail.cmd` and `graft.cmd` on PATH
  (`src/claude/shim-template.ts:67-68`; the committed copy in this checkout,
  `.claude/helpers/graft-hooks.cjs:11-12`, is the same text).
- A person typing `graft` at a terminal sees one line a day saying graft is
  now trail (`src/brand.ts:179-200`); agents, pipes and CI never see it. On a
  machine with graft and no trail, a Claude Code session is told once a week
  that `graft upgrade` adds trail (`src/brand.ts:252-275`). The fork drops the
  `upgrade` advice from both (`src/brand.ts:198,255`), since its `upgrade`
  refuses (D24 A).
- The README's own words at 0.26.0 (`README.md:151-167` in the fork, unchanged
  by 0.26.0): nothing breaks; `graft` and `@nanonets/graft` run the same code
  and print what they always printed; `graft upgrade` adds `trail`; repos that
  graft set up move to trail on their own once `trail` is installed.

What upstream does not promise: a date. Nothing in the code or the changelog
deprecates `@nanonets/graft`, and the postinstall message still says "Graft
installed" for that package (`scripts/postinstall.mjs:60-61`). The graft
layout is maintained, not developed: every feature since 0.22.0 that touches
wiring (`.trail/hook.cjs`, the look-back, `--agents auto`, `init --pair`,
always-follow learnings) was written for trail's layout first, and 0.26.0's one
brand change (`asksForTrail`) forces trail on a command started as graft.

### 1.4 What this means for the fork

The fork's decision D9 A (2026-10-18) kept the graft command, package and
layout. Since then the fork has built nothing that depends on the graft
brand: every addition reads `brand()` or `cmd()` or is brand-free (section
3.1). The one place the fork pins the brand on purpose is
`test/graft-brand-layout.test.ts:19-34`, which asserts that `graft init` and
`graft build` under the graft brand keep the map in `graft/` and create no
`.trail/`. That test describes upstream's own graft behaviour and stays true
whatever D28 and D29 decide.

The fork's package already builds `dist/bin/trail.js`; the global install
holds it (`C:\nvm4w\nodejs\node_modules\@nanonets\graft\dist\bin\trail.js`,
verified 2026-10-27) with no shim pointing at it. So "trail in the fork" is a
shim and a layout decision, not a port.

## 2. The differences in use

### 2.1 Command by command

The table is every registered command at `main` (`src/cli.ts`, registrations
at lines 379-2676) and its trail spelling. "Same" means the same code path,
with only the prefix and the hints spelled in the running name. The
0.26.0 column says what upstream's next release changes for that row.

| `graft` spelling | `trail` spelling | Meaning and output | Agent wiring that names it | 0.26.0 |
|---|---|---|---|---|
| `graft ask "<q>" --source` | `trail ask "<q>" --source` | same; header `[graft] tokens saved` becomes `[trail] tokens saved`; under trail the learnings hints follow the answer (`src/cli.ts:926`) | prompt hook (`graft ask` child), skill, AGENTS.md block, statusline (reads the stats file, not the prefix) | unchanged |
| `graft grep` | `trail grep` | same | skill, AGENTS.md block | unchanged |
| `graft skeleton` | `trail skeleton` | same | skill, AGENTS.md block | unchanged |
| `graft callers` | `trail callers` | same | skill, AGENTS.md block | unchanged |
| `graft map` | `trail map` | same | skill | unchanged |
| `graft blast` | `trail blast` | same (CI group under trail) | post-edit hook | unchanged |
| `graft build` | `trail build` | same; the tier flags (`--no-structured`, `--no-documents`, `--no-lsp`) are the fork's and work under both; option text spells `graft/.graph/docs/` literally (`src/cli.ts:562`) | post-edit hook, skill | unchanged |
| `graft check` | `trail build --check` | **the freshness check moves** (`src/cli.ts:954-971`, `src/brand.ts:54`); `trail check` is a different command | `GRAFT_init.md` section 3 and 4 name `graft check` for freshness | unchanged |
| none | `trail check` | the learnings check of the branch diff, exit 1 on a conflict (`src/cli.ts:2679`) | the trail skill tells the agent to run it before a commit | unchanged |
| `graft stats` | `trail status` (`trail stats` runs, unlisted) | the session's graft-versus-source mix and tokens saved (`src/cli.ts:1018-1034`, `src/brand.ts:55`) | `GRAFT_init.md` section 3; Cursor users (no statusline) | unchanged |
| `graft status` (fork, D20, `src/cli.ts:2676`) | `trail status` (upstream, `src/cli.ts:2682`) | the same table: code map, cards, learnings, workspace, week; both read `brand()` for the hints | none | unchanged |
| `graft version` | `trail --version` (`trail version` runs, unlisted) | the fork reports upstream's release and says the merge is the operator's decision (`src/cli-meta.ts:117-128`) | none | unchanged |
| `graft upgrade` | `trail upgrade` | the fork refuses on both and names the install route (`src/cli-meta.ts:204-208`); upstream's installs both packages and moves the repository (`src/cli-meta.ts:209-224`, `src/cli.ts:481-495`) | the update nudge names no command on a fork | unchanged |
| `graft init` | `trail init` | **different layout** (section 2.4) and, under trail, a one-time read of past Claude sessions and merged PR reviews (`src/cli.ts:1701`) | written by the command itself | `--agents auto`, `--pair` always runs as trail |
| `graft uninstall` | `trail uninstall` | same; removes both names' wiring | none | unchanged |
| `graft mcp` | `trail mcp` (unlisted) | same server; `serverInfo.name` is the brand and the tools are advertised as `trail_*` under trail (`src/mcp/server.ts:129,145`); the server answers `graft_*` under both | `.mcp.json` (graft layout only), Cursor, Codex and OpenCode entries (`src/hosts/mcp-config.ts:49-59`) | `--brains` text only |
| `graft viz` | `trail viz` (unlisted) | same | none | unchanged |
| `graft note` (unlisted, works) | `trail note` | same; saves to `.trail/learnings/` when the repository keeps notes (`src/notes/home.ts:399-401`) | the trail skill and the session-start context tell the agent to save learnings | `--always-follow` |
| `graft skills …` | `trail skills …` | same (`src/cli.ts:1285`) | the skills hooks' `[trail]` lines, under both brands | wording |
| `graft keep` (hidden) | `trail keep` | same | the init screen | unchanged |
| `graft telemetry` | `trail telemetry` | same | none | unchanged |
| none | `trail team`, `trail workspace`, `trail login`, `trail logout` | trail only (`src/cli.ts:2678-2681`); `workspace`, `login` and `logout` are hidden unless the cloud is enabled | none | unchanged |
| `graft --help` | `trail --help` | flat list versus grouped list with summaries (`src/cli.ts:115-129,2683-2718`) | none | unchanged |

Hidden maintenance commands (`_trail-sync`, `_trail-branches`, `_trail-claim`,
`_trail-pair`, `_update-check`, `_telemetry-flush`; `src/cli.ts:379-428`) are
spelled the same under both names.

### 2.2 The prefix and the accounting

| Surface | Under graft | Under trail | Reads both? |
|---|---|---|---|
| `ask` header, `blast` header, hook context lines | `[graft] …` via `tag()` | `[trail] …` | n/a |
| Savings footer parser (`src/context/savings.ts:143-150`) | | | yes: `\[(?:graft\|trail)\] (?:tokens\|learnings) saved` |
| Command classifier (`src/claude/session-metrics.ts:78-86`) | | | yes: `graft`, `trail`, `npx @nanonets/graft`, `npx @trailhq/trail-code`, `dist/bin/trail.js` |
| Footer-printing commands, the fork's stats fix (`src/claude/session-metrics.ts:93-97`) | | | yes, tested with `trail ask x` (`test/stats-background-saving.test.ts:161`) |
| MCP tool classification (`src/claude/session-metrics.ts:71-75`) | `graft_find_code` | `trail_find_code` | yes: the bare name after `__` is looked up, and the settings matcher is `mcp__graft__\|mcp__trail__` (`src/claude/settings-merge.ts:80`) |
| Statusline (`.claude/helpers/graft-statusline.cjs`, `.trail/statusline.cjs`) | reads the session stats file | same file | yes |
| The agent's closing tally line | "graft saved ~N tokens" | "trail saved" also counted since 0.22.0 (`d45a801`) | yes |
| Upstream's literal `[trail]` lines (guard, skills, learnings) | print under graft too | | n/a |

The one open question the brief asked here is answered: a `[trail]` prefix
breaks nothing in the stats or savings accounting. The two pin-points that
would break are not in the fork's code: a user's own statusline parser or CI
grep that matches `[graft]` alone. None exists in this repository
(`scripts/tally-audit.mjs:24` matches `[graft]` alone, but it is an offline
audit script, not a hook).

### 2.3 Folders, environment and names

| Thing | Under graft | Under trail | Where decided |
|---|---|---|---|
| The brand of a process | `TRAIL_INVOKED_AS` unset or `graft` | `TRAIL_INVOKED_AS=trail`, set by `dist/bin/trail.js` | `src/brand.ts:27-37` |
| The brand of a repository's hooks | the repository has no trail-named file | it has one, and `trail` is on PATH | `src/brand.ts:93-125` |
| Code map | `graft/` | `.trail/cache/` | `src/context/map-dir.ts:31-37`; this checkout is already at `.trail/cache/` because it keeps `.trail/learnings/` (D12 A) |
| Documents' text renderings | `graft/.graph/docs/` | `.trail/cache/.graph/docs/` | follows the map |
| Learnings | `.trail/learnings/` when kept | same | `src/notes/repo-trail.ts:91-99` |
| Build configuration | `.graft/config.json` | same | `src/util/state.ts:139` |
| Home: notices, update cache | `~/.graft/` | same | `src/brand.ts:134,240` |
| Home: personal learnings, install hint | `~/.trail/` (`TRAIL_HOME`) | same | `src/notes/trail-home.ts:11` |
| Environment family | `GRAFT_*` (43 distinct names in `src/`) for the engine, `TRAIL_*` for the brand, cloud, hooks and tests | same names under both brands | no `TRAIL_` twin of any `GRAFT_` engine variable exists |
| Keep a machine on graft | `GRAFT_NO_TRAIL_SWITCH=1` | | `src/upkeep-run.ts:78` |
| Silence the notices | `GRAFT_NO_RENAME_NOTICE` | | `src/brand.ts:182,256` |
| Package name for the shims to find | `@nanonets/graft` | `@trailhq/trail-code` (and `@nanonets/graft`, and `@trailhq/trail`) | `src/claude/shim-template.ts:67` |

### 2.4 What each layout writes for Claude Code

Graft's layout (`legacyClaudeTargets`, `src/claude/init.ts:73,135-180`),
which is what this checkout commits:

| File | Role | Committed here |
|---|---|---|
| `.claude/settings.json` | seven hook events on `.claude/helpers/graft-hooks.cjs`, the statusline on `graft-statusline.cjs`, `footerLinksRegexes` for `graft/…md`, the allowlist `Bash(trail:*)`, `Bash(graft:*)`, `Bash(npx graft:*)`, `Bash(graft-dev:*)`, `Bash(node dist/cli.js:*)` | not tracked (`.claude/settings.json:17,35,105,112,116-120`) |
| `.claude/helpers/graft-hooks.cjs` | the hooks shim: finds the installed package, loads `dist/claude/hooks.js` | tracked |
| `.claude/helpers/graft-statusline.cjs` | the statusline shim | tracked |
| `.claude/skills/graft/SKILL.md` | the repository skill, from `src/claude/skill-template.ts` | tracked |
| `.mcp.json` | `mcpServers.graft = { command: "graft", args: ["mcp"] }` (`src/hosts/mcp-config.ts:49,56`) | tracked (`.mcp.json:3-6`) |
| `~/.claude/helpers/graft-hooks.cjs`, `~/.claude.json` `mcpServers.graft`, `~/.claude/skills/graft/SKILL.md` | user-level copies (`src/hosts/claude-global.ts:61-63,95`) | this machine has the statusline helper and the skill at user level, no user-level hooks shim and no user-level server (verified 2026-10-27) |

Trail's layout (`runTrailInit`, `src/claude/init.ts:189-245`):

| File | Role | Git |
|---|---|---|
| `.trail/hook.cjs` | the one shared hook shim, same text as graft's | committed by whoever runs `trail init` |
| `.claude/settings.json` | one `SessionStart` entry on `.trail/hook.cjs`; every other event's hook comes from `~/.claude` (`installClaudeGlobal(home, 'trail')`) | shared |
| `.claude/settings.local.json` | the statusline on `.trail/statusline.cjs` and the allowlist | kept out of git (`src/claude/init.ts:226`) |
| `.trail/statusline.cjs` | the statusline shim | ignored by `.trail/.gitignore` |
| `~/.claude/skills/trail/SKILL.md` | the skill, personal, never in the repository (`src/claude/init.ts:21-23`) | n/a |
| `.mcp.json` | **no server**: `mcp: null` (`src/claude/init.ts:244`); the old graft server entry is removed by `clearOldLayout` (`src/claude/init.ts:253-265`); a user-level graft server is turned off for this folder (`src/claude/init.ts:241`) | the file goes when nothing else is in it |

So a Claude Code session in a trail-wired repository has the hooks (prompt
context, savings, guard, post-edit blast) and the `trail` CLI through Bash,
and no `mcp__graft__*` or `mcp__trail__*` tools. The sessions in this
checkout today are offered six graft MCP tools; under trail they would not
be. The hooks and the skill tell the agent to use the CLI, which is what the
`[graft]` instruction block in this session's context already says.

Other hosts (`src/hosts/registry.ts:143-150`): owned files are renamed in
their path (`.cursor/rules/graft.mdc` to `trail.mdc`, `.kiro/steering/graft.md`,
`.windsurf/rules/graft.md`, `.adal/skills/graft/`, `.grok/skills/graft/`),
shared files (`AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`) get
trail's fenced block in place of graft's, Cursor's hook shim becomes
`.cursor/hooks/trail-hooks.cjs`, and the MCP entry for Cursor, Codex and
OpenCode becomes `trail mcp` (`src/hosts/mcp-config.ts:52,56`). Codex's hooks
stay under `~/.codex/hooks/graft/` by path (`src/hosts/codex-hooks.ts:29`).
Antigravity's skill moves to `~/.gemini/skills/trail/`
(`src/hosts/antigravity.ts:37-38`).

## 3. The blast radius of parity

### 3.1 The fork's additions under the graft name, and what each needs under trail

Every file the fork changed since `4e7d0f5` (`git diff --stat 4e7d0f5 main`:
97 source files, 7,742 insertions) was checked for the brand. The rows below
are the ones that name a brand, a command spelling or a layout; the structured
and documents tiers, the LSP default, the cards check, the workspace index and
the retrieval evaluation are brand-free and are not listed.

| Fork addition (commit) | File and span at `main` | Under trail today | Needed for parity |
|---|---|---|---|
| `status` registered under graft (D20, `e312bff`) | `src/cli.ts:2676` | `status` is upstream's own under trail (`src/cli.ts:2682`); both call `statusCommand()`, whose hints use `cmd()` | nothing |
| Fork marker, `upgrade` refusal, version report, nudge (D24 A, `efd0c4e`) | `src/cli-meta.ts:42-72,117-128,170-184,204-208`, `src/upkeep.ts:52-56,160-167`, `src/upkeep-run.ts:87-105`, `src/cli.ts:103-104,338,345,463,466-472` | all read `brand()`; the refusal says "trail upgrade is off on this build" under trail; the nudge names no command under either | nothing; the README sentence that says `trail` would be installed by `upgrade` (`README.md:126`) stays true for upstream's package |
| Notices drop the `upgrade` advice on a fork (`efd0c4e`) | `src/brand.ts:22,163-170,198,252-256` | graft-only by upstream's design (`graftNotice` and `trailHandoverLine` return null under trail) | nothing |
| Stats saving read back from a file (`ffa5aca`) | `src/claude/hooks.ts:158-166,236-257`, `src/claude/session-metrics.ts:88-97,123-131,156-159`, `src/claude/state.ts:60-65`, `src/context/savings.ts:137-150` | the footer regex and the command regex accept both names; `test/stats-background-saving.test.ts:161` already runs `trail ask x` and `dist/bin/trail.js` shapes | nothing |
| MCP launcher always the installed binary (`c4d4120`, Stage 14) | `src/hosts/mcp-config.ts:28-59`, `src/cli.ts:2106-2108` | `serverEntry({ brand: 'trail' })` writes `trail mcp`; `init` warns when the launcher's name is not on PATH, spelled by `TRAIL` | nothing |
| Structured, documents, LSP on by default (`c0e74d1`, `a4a04ca`) | `src/cli.ts:515-516,549-570,617-626` option text | the option descriptions spell `graft/.graph/docs/` and `GRAFT_*` literally; under trail the map is at `.trail/cache/.graph/docs/` | one cosmetic edit: say "the map folder" or spell the path through the map-dir constant; the `GRAFT_*` names are the real variable names under both brands and stay |
| `graft build --deep` token line (`0743b9a`) | `src/cli.ts:796-799` | brand-free | nothing |
| `graft-brand-layout` test (D9 A) | `test/graft-brand-layout.test.ts:19-34` | asserts the graft brand keeps `graft/`; true under upstream too | keep; add a twin that asserts the trail brand writes `.trail/` and `.trail/cache/` (D31) |
| `cli-status-graft` test (D20) | `test/cli-status-graft.test.ts:14-23,33-62` | spawns `src/bin/graft.ts` through `tsx`; the same test under `src/bin/trail.ts` would pass | add the trail twin, the same shape |
| `fork-upgrade-guard` test (D24 A) | `test/fork-upgrade-guard.test.ts:86-215` | brand-free except `(d)`, which runs `node dist/cli.js upgrade` (brand unset, graft) | add one case under `TRAIL_INVOKED_AS=trail` |
| Release script (`1a1340e`) | `scripts/release.mjs:22,55-70,96-98` | rewrites the README "This build" section and keeps the `fork` marker; knows nothing of `bin` | nothing under D28 A; under D28 B it would also lay out `build/trail/` (`scripts/pack-trail.mjs`) |
| Global sync (`7041c34`, `1393bba`, `b96f716`) | `scripts/sync-global.mjs:45-46,116`, `scripts/sync-global-checks.mjs:21-27,69-73` | copies `dist/` into `@nanonets/graft` only and checks `graft --version` | under D28 A: also report whether a `trail` shim exists beside `graft`'s and print the tarball reinstall command when it does not (the sync cannot create shims; npm links them at install); under D28 B: a second target folder |
| `package.json` `bin` | `package.json` (`"bin": { "graft": "dist/bin/graft.js" }`) | upstream's `@nanonets/graft` is the same; `@trailhq/trail-code` has `bin: trail` only | D28 |
| `GRAFT_init.md` (`91e95b6`) | the whole file: sections 1, 3, 4, 6 name `graft` commands, `graft check` for freshness and `graft stats` | every command works under `trail` except `graft check` (becomes `trail build --check`) and `graft stats` (`trail status`) | rewrite in the chosen name with a line on the two renamed commands |
| `AGENTS.md` "Code navigation (Graft)" | `AGENTS.md`, the section after "Daily commands" | names `graft ask`, `graft skeleton`, `graft callers`, `graft build` | the same four commands in the chosen name |
| `README.md` "This build" | `README.md:104-128` | says "it installs no `trail` command" (`README.md:106`) | one sentence under D28 A |
| `docs/architecture/system-reference.md` | 161 mentions of `graft` | the command table and the hook descriptions | a column or a note for the trail spellings |
| This checkout's wiring (`7b43032`, D12 A) | `.claude/helpers/graft-hooks.cjs`, `.claude/helpers/graft-statusline.cjs`, `.claude/skills/graft/SKILL.md`, `.mcp.json`, `.claude/settings.json` (untracked) | the graft layout | D29 |

The second open question in the brief is also answered here: the fork needs no
second package to have `trail`. One package can expose two bins (D28 A), and
upstream's own `@nanonets/graft` could have done the same; it did not because
78 percent of its active installs were older than the rename
(`scripts/pack-trail.mjs:11-14`), a constraint the fork does not share.

### 3.2 By surface: what changes so that sessions, projects, harnesses and the global install invoke `trail`

| Surface | Today | To invoke `trail` | Who does it | Breaks if skipped |
|---|---|---|---|---|
| Global `bin` shims | `graft`, `graft.cmd`, `graft.ps1` under `C:\nvm4w\nodejs`, pointing at `@nanonets/graft/dist/bin/graft.js`; `dist/bin/trail.js` present, unlinked | D28 A: add `"trail": "dist/bin/trail.js"` to `package.json` `bin`, release, then one tarball reinstall (protocol section 10) so npm links the three `trail` shims; later syncs copy `dist/` as now | Stage 33, then the operator runs the reinstall | without the shim `trailOnPath()` is false, so the hooks keep speaking graft and no repository moves |
| The machine-wide switch | unset | set `GRAFT_NO_TRAIL_SWITCH=1` in the user environment before the reinstall, so no repository moves until its own stage; drop it when the last repository has moved | the operator (a user environment variable) | ten repositories move on their next session open, in whatever order sessions happen to open them, with uncommitted wiring changes in each |
| Hooks (Claude Code, per repository) | `.claude/settings.json` on `.claude/helpers/graft-hooks.cjs` | `trail init` in the repository rewrites it to trail's layout (section 2.4); the shim text is the same; commit `.trail/hook.cjs` and the one-line `settings.json` change | Stages 35 and 36 | hooks keep speaking graft; `trail ask` still works and its footers still count |
| Hooks (Claude Code, user level) | `~/.claude/helpers/graft-statusline.cjs` only | `trail init` with global writes adds `~/.claude/helpers/trail-hooks.cjs` and the other events' entries in `~/.claude/settings.json` | the first `trail init` run (Stage 35) | a trail repository then gets only the SessionStart hook |
| Skills | `.claude/skills/graft/SKILL.md` committed in each repository; `~/.claude/skills/graft/SKILL.md` at user level | the repository copy is removed; `~/.claude/skills/trail/SKILL.md` is written; the graft user-level skill stays until `graft uninstall` or by hand | `trail init` | both skills offered; the agent sees two instruction sets |
| Agent instruction files (`AGENTS.md` blocks, Cursor rules, Kiro, Windsurf, Gemini, Copilot) | graft's fenced block or `graft`-named file | trail's block or file (`src/hosts/registry.ts:143-145`), written by `trail init --agents …` for the hosts the repository had | `trail init` | the files name `graft` commands, which still run |
| MCP entry | `.mcp.json` `graft mcp` in each repository | removed for Claude Code under trail; `trail mcp` for Cursor, Codex and OpenCode | `trail init` | a trail repository keeps a `graft` server if `settings.json` could not be rewritten (`clearOldLayout`, `keepShims`) |
| Statusline | `.claude/helpers/graft-statusline.cjs` through `settings.json` | `.trail/statusline.cjs` through `settings.local.json` (untracked) | `trail init` | the status bar reads graft's shim, which still works |
| The SessionDispatch skill (`D:\Code\Claude\SessionDispatch`) | 14 lines mention `fork_graft`, the folder name; no line names a `graft` or `trail` command (`grep -rni graft`, 2026-10-27) | nothing | none | nothing |
| This checkout's own gate | `scripts/run-tests.mjs:85-88` turns the move off for the test run | nothing; the tests of the move turn it back on | none | nothing |
| The operator's protocol and `GRAFT_init.md` | name `graft` commands and warn never to run one in a wired checkout | the same warning in the chosen name: `trail` commands rewrite wiring on a version mismatch exactly as `graft` ones do | Stage 34 | sessions run `graft check` for freshness and read a learnings check instead |
| Memories and handoffs | `graft` spellings throughout | leave the record; new handoffs use the chosen name | none | nothing |

Repositories wired for graft on this machine (from `~/.claude.json`'s project
list, checked for `.claude/skills/graft/SKILL.md` or a `graft` server in
`.mcp.json`, 2026-10-27; none is wired for trail): `fork_graft` (this
checkout), `Malkovich`, `Tsunami`, `SocialBee`, `BOOK-The.Connected.Body`,
`Fixer`, `Orchestrator`, `Capsule`, `BeWhole` and `bewhole-accept`. Ten
distinct repositories (fourteen project entries, four of them the same folder
spelled with a different drive letter or separator). Each move is a commit in
that repository.

### 3.3 Parity on the current base, or after merging 0.26.0

Files changed by both the fork and 0.26.0 since `4e7d0f5` (`comm` of the two
`git diff --name-only` lists): `CHANGELOG.md`, `README.md`, `package.json`,
`package-lock.json`, `src/brand.ts`, `src/cli.ts`, `src/hosts/mcp-config.ts`,
`src/upkeep-run.ts`, `src/upkeep.ts`, `test/trail-connect-cli.test.ts`. The
2026-10-27 assessment counted four conflicting files in a trial merge; the
rest auto-merge.

What the parity stages add to that set under D28 A: one line in
`package.json`'s `bin` (0.26.0 leaves `bin` unchanged, verified by
`git show upstream/release/0.26.0:package.json`), `scripts/sync-global.mjs`
and `scripts/sync-global-checks.mjs` (upstream does not touch them), new
fork-only test files, `GRAFT_init.md` and `AGENTS.md` (fork-only), and at most
one cosmetic edit in `src/cli.ts`'s option text, in lines the fork alone
added. None of these creates a new conflict with 0.26.0, so the merge costs
the same after parity as before it.

What merging first would give the parity work: `asksForTrail`
(`init --pair` under any name) and `--agents auto`, both for Trail's hosted
setup page, which the fork does not use; and the always-follow learnings. What
it would cost first: Stage 30 as priced in the 2026-10-27 assessment ($3.90,
60 to 120 minutes plus three gates of 27 to 41 minutes each, a tarball
reinstall and a new D13 baseline). Parity on the current base starts today
and does not change the merge's price. D26 stays A.

## 4. Decisions for the operator

Everything that does not depend on these decisions is finished: this document,
the handoff. The staged plan in section 5 assumes the recommended options and
says where another option changes a stage.

```
D28 Decision:      how the fork provides the `trail` command (the reversal of D9 A's "no trail")
    Facts:         the build already produces dist/bin/trail.js and the global install holds it
                   unlinked; package.json bin has graft alone, in the fork and in upstream's
                   @nanonets/graft; upstream's second package is laid out by scripts/pack-trail.mjs
                   from the same build and differs only in name, description, keywords and bin;
                   the hook shims find either package by name and look for trail.cmd on PATH;
                   sync-global copies dist/ and cannot create shims.
    Options:       A one package, two bins: add "trail": "dist/bin/trail.js" to the fork's
                     package.json, release, reinstall once from the tarball; later syncs as now
                   B two packages: lay out @trailhq/trail-code from the build (pack-trail.mjs),
                     install it globally from the fork's layout beside @nanonets/graft, teach
                     sync-global two targets and the Kotlin copy twice
                   C hand-written trail, trail.cmd and trail.ps1 shims beside graft's, pointing
                     at @nanonets/graft/dist/bin/trail.js, written by sync-global
                   D keep D9 A: no trail command; sessions keep invoking graft
    Pros and cons: A one install, one node_modules, one sync; a later npm install -g of
                     upstream's trail package would collide on the trail bin, which the fork's
                     refusing upgrade already prevents. B matches upstream's shape exactly and
                     doubles the install (about 29 MB unpacked plus the grammars, twice) and every
                     maintenance step. C needs no release and sits outside npm's bookkeeping, so
                     npm uninstall leaves it behind and a reinstall may overwrite it. D costs
                     nothing and leaves the operator's request unmet.
    Blast radius:  A and B: the global install (one reinstall), and, once trail is on PATH, every
                   graft-wired repository on the machine (D29). C: the same plus a shim nobody
                   else manages. D: none.
    Recommended:   A. It is the boring option: npm links the shims, the shim text already names
                   both packages, and the release script already rewrites what a release touches.
                   B is right only if the fork ever needs its trail at a different version from
                   its graft, which the one-tree design makes impossible anyway.

D29 Decision:      what the repositories on this machine do once trail is on PATH
    Facts:         ten graft-wired repositories (section 3.2); each moves itself to trail's
                   layout at its next Claude Code session start unless GRAFT_NO_TRAIL_SWITCH=1;
                   the move removes the repository's MCP server for Claude Code, replaces the
                   committed skill with a personal one under ~/.claude, moves the map to
                   .trail/cache/, commits .trail/hook.cjs, and under `trail init` reads past
                   Claude sessions once; graft's layout keeps working unchanged under trail on
                   PATH, with trail commands usable in it.
    Options:       A stay on graft's layout everywhere, with GRAFT_NO_TRAIL_SWITCH=1 set for good;
                     sessions and docs spell trail where they like, since trail ask works in a
                     graft-wired repository
                   B move every repository to trail's layout deliberately: set the switch first,
                     move this checkout and a scratch repository in a verified stage, then the
                     other nine one commit each, then drop the switch
                   C set no switch and let each repository move on its next session open
    Pros and cons: A keeps the MCP tools in Claude Code and every committed file as it is, and
                     leaves the fork on the layout upstream maintains but no longer develops;
                     forward compatibility is partial (the command, not the wiring). B is the
                     operator's stated intent and the layout upstream develops first; it costs a
                     stage and ten commits, loses the repository MCP server for Claude Code (the
                     hooks and the CLI do that work), and the look-back's one-time read of past
                     sessions runs in each repository. C is free and uncontrolled: the first
                     session in each repository does the move mid-task and leaves it uncommitted.
    Blast radius:  A: none. B: ten repositories' committed wiring, ~/.claude (hooks and skill),
                   and every session's tool list in those repositories. C: the same as B, at an
                   unplanned moment.
    Recommended:   B. The operator asked for trail "for forwards compatibility", and the wiring
                   is where upstream moves first; A would leave every future merge carrying a
                   layout the fork alone exercises. Do it with the switch set, so each move is a
                   stage with a commit, and start with a scratch repository to see the result
                   before this checkout moves.

D30 Decision:      whether parity waits for the 0.26.0 merge
    Facts:         section 3.3: the parity changes add no conflicting line to the merge; 0.26.0's
                   brand changes serve Trail's hosted setup; D26 answered A today.
    Options:       A parity now, on the current base; D26 stays A
                   B merge 0.26.0 first (Stage 30), then parity
    Pros and cons: A starts today at no extra merge cost. B spends $3.90, three gates and a
                     reinstall first, for features the fork does not use, and reopens D26.
    Blast radius:  A: none beyond the parity stages. B: src/cli.ts and the global install, now.
    Recommended:   A.

D31 Decision:      what the fork's own tests pin about the layout
    Facts:         test/graft-brand-layout.test.ts asserts that the graft brand keeps graft/ and
                   writes no .trail/ (D9 A); it describes upstream's graft behaviour, which the
                   fork does not change; no fork test runs the trail layout end to end.
    Options:       A keep the graft layout test and add its trail twin (trail brand writes
                     .trail/, .trail/cache/, .trail/hook.cjs, no .mcp.json server), plus the
                     trail twins of cli-status-graft and the fork-upgrade-guard case (d)
                   B replace the graft layout test with the trail one
    Pros and cons: A keeps the promise upstream makes to graft users under test in the fork,
                     which is what makes the two commands safely interchangeable. B loses it.
    Blast radius:  test/ only.
    Recommended:   A.
```

## 5. Staged plan

Prices are the protocol's section 2 table (USD per million tokens; cache
read Haiku 0.01, Sonnet 0.10, Opus 0.20, Fable 0.25; fresh input at 1.25 times
the input price: Haiku 0.125, Sonnet 2.50, Opus 5.00, Fable 12.50; output
Haiku 0.50, Sonnet 10, Opus 20, Fable 50). Method: section 6 of the protocol,
cache reads at turns times average context, fresh input 3k per turn, output
1.5k per turn (2k for Fable). Haiku prompts are kept under 100,000 tokens so
the low tier applies. A gate is `npm run build && npm test`, 27 to 41 minutes
here, judged under D13. Stage numbers continue from the 2026-10-27 roadmap
(Stage 32 is its last).

| Stage | Model, effort | Scope | Depends on | Turns, context | Cost (central, quoted range) | Agent time |
|---|---|---|---|---|---|---|
| 33 | Sonnet 5.5, high | D28 A: the `trail` bin in `package.json`; `sync-global` reports a missing `trail` shim and prints the tarball reinstall; the trail twins of `cli-status-graft` and `fork-upgrade-guard (d)`; CHANGELOG and README "This build"; release `0.25.0-nishadherath.5` with `scripts/release.mjs`; the operator sets `GRAFT_NO_TRAIL_SWITCH=1`, runs the tarball reinstall (protocol section 10) and copies the Kotlin binary back; `trail --version` and `trail ask` checked in a scratch folder | D28, D30 | 50 turns, 80k | $1.53 ($1.50 to $3) | 45 to 90 min plus one gate; 15 min review plus 15 min of operator steps |
| 34 | Haiku 5.5, medium | Docs in the chosen name: `GRAFT_init.md` (with the two renamed commands called out), `AGENTS.md`'s code-navigation section, the protocol's section 10 smoke-test warning, the system reference's command table; the mapping is section 2.1 of this document | 33 | 25 turns, 40k | $0.04 ($0.05 to $0.20) | 15 to 30 min; 10 min review; no gate if `src/` and `test/` are untouched |
| 35 | Opus 5.5, high | D29 B, first two moves: `trail init` in a scratch repository, then in this checkout (`.trail/hook.cjs`, the one-line `settings.json` change, the removed `.mcp.json` server and skill, the map already at `.trail/cache/`); verify the hooks, statusline, `[trail]` footers in `trail status`, the absence of MCP tools and the fork tests under both brands; the trail layout test (D31 A); one commit here | 33 | 60 turns, 100k | $3.90 ($4 to $8) | 60 to 120 min plus one gate; 30 min review |
| 36 | Haiku 5.5, medium | D29 B, the other nine repositories: `trail init` in each, `trail status` and one session start as the oracle, one commit per repository by the operator or the session in that folder; drop `GRAFT_NO_TRAIL_SWITCH` last | 35 | 30 turns, 50k | $0.05 ($0.05 to $0.20), plus the look-back's one headless Claude read per repository (about a minute each, on the operator's Claude Code account, not the API) | 30 to 60 min; 20 min review; nine commits |
| 37 | Fable 5.1, high | Acceptance of 33 to 36 one tier up, or folded into the roadmap's Stage 32 if it has not run | 33 to 36 | 55 turns, 100k | $8.94 ($8 to $16) | 60 to 120 min plus one gate; 30 min review |

Totals: about $14.46 at list price (quote $14 to $28); 3.5 to 7 hours of
agent time plus three to four gates (1.4 to 2.7 hours), so 4.5 to 9 hours of
wall clock; about 1.75 hours of operator review and steps. If D28 is B, Stage
33 grows to Opus 5.5 (two install targets and the sync's second path:
about $3.90 and one more gate). If D29 is A, Stages 35 and 36 are not run
and Stage 34 spells `trail` only where a command's meaning is the same. If
D29 is C, Stage 36 becomes a clean-up of whatever each session left
uncommitted, which is why it is not recommended.

By class: Haiku takes the docs and the nine checklist moves with the harness
as the oracle (34, 36); Sonnet takes the scoped code, script and release work
(33); Opus takes the first move, where the layout's behaviour is judged
(35); Fable accepts (37). Nothing here needs Fable to write code.

## 6. Verified facts (this session, 2026-10-27)

- `main` is `b91165f`; the tree has the Stage 31 session's uncommitted
  `src/ask/ask.ts` edit and two untracked files, not touched here
  (`git status --short`).
- `git log 4e7d0f5..upstream/release/0.26.0`: nine commits, `cc48a9d` at the
  tip, untagged; `git diff --stat`: 109 files, 3,315 insertions, 809
  deletions. `git diff --stat 4e7d0f5 main -- src scripts package.json …`:
  97 files, 7,742 insertions.
- `package.json` `bin` is `{ "graft": "dist/bin/graft.js" }` in the fork and
  at `upstream/release/0.26.0`; `npm view @trailhq/trail-code@0.26.0 bin` is
  `{ "trail": "dist/bin/trail.js" }`, 28,757,302 bytes unpacked;
  `npm view @nanonets/graft@0.26.0 bin` is `{ "graft": "dist/bin/graft.js" }`.
- The global install is `@nanonets/graft 0.25.0-nishadherath.4` with the
  `fork` marker, under `C:\nvm4w\nodejs\node_modules`; the prefix holds
  `graft`, `graft.cmd`, `graft.ps1` and no `trail` shim; `dist/bin/` there
  holds `graft.js` and `trail.js`; no `@trailhq` package is installed.
- `src/brand.ts` history on `upstream/main`: six commits, first `8dc7a63`
  (2026-10-13), the rename `d45a801` (2026-10-14), the layout `f8b5dad`
  (2026-10-15), `asksForTrail` in `b7e7616` (2026-10-26).
- Files changed on both sides since `4e7d0f5`: ten (section 3.3).
- 52 test files set `BRAND_ENV` or `TRAIL_INVOKED_AS`; 41 test files were
  added by the fork since `4e7d0f5` (`git diff --name-only --diff-filter=A`).
- This checkout tracks `.claude/helpers/graft-hooks.cjs`,
  `.claude/helpers/graft-statusline.cjs`, `.claude/skills/graft/SKILL.md`,
  `.mcp.json`, `.trail/.gitignore` and six learnings; `.claude/settings.json`
  is untracked. The user level has `~/.claude/helpers/graft-statusline.cjs`
  and `~/.claude/skills/graft/SKILL.md`, no hooks shim, no `graft` server in
  `~/.claude.json`, and no `~/.claude/skills/trail`.
- Ten distinct repositories in `~/.claude.json`'s project list are wired for
  graft; none for trail (section 3.2).
- The SessionDispatch skill has 14 lines mentioning `fork_graft` and none
  naming a `graft` or `trail` command (`grep -rni graft` over the folder,
  excluding `.git` and `node_modules`).
- The pre-bash hook in this checkout refused one read-only command of this
  session with a line beginning "trail:" (its guard, `src/trace/guard-fast.ts:25`,
  speaks trail under graft), and the session's start-up context carried four
  `[trail]` lines from `src/claude/start-skills.ts:59-62`.
