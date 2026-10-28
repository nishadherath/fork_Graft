---
stage: "Stage 36: D29 B, the other nine repositories move to trail's layout"
model: claude-haiku-5-5
effort: medium
status: ready
created: 2026-10-28
from: "Stage 35 (claude-opus-5-5, run as a subagent of the operator's session): trail init verified, this checkout's move committed"
---

# Stage 36: the other nine repositories

## Goal

Each of the nine other graft-wired repositories is on trail's layout, committed once in that
repository by the operator (or with the operator's approval), with `trail status` and one Claude Code
session start as the oracle; then the operator drops `GRAFT_NO_TRAIL_SWITCH`. Nothing pushed.

## Decisions already made

- D28 A, D29 B, D30 A, D31 A (`docs/assessment-2026-10-27-trail-parity.md` section 4). Stage 35 is done.
- This checkout was not re-run through `trail init`: its in-repo result already equals a clean
  `trail init` (verified facts), and a re-run would add only the look-back (D32 below).
- No stage pushes. The operator pushes `main` and drops the switch last.

## Files and links that matter

- `test/trail-brand-layout.test.ts`: what `trail init` must lay down, and the graft-to-trail move.
- `src/upkeep-run.ts:75-79` (`shouldMoveToTrail`): the only check of `GRAFT_NO_TRAIL_SWITCH`.
- `src/notes/memory-notes.ts:190-209` (`memoryCandidates`) and `src/init/run.ts:125-133`: `trail init`
  turns Claude Code memory notes about a repository into `.trail/learnings/` files, ticked, with no screen.
- A repository's wiring stamp: `<map dir>/.cache/wiring-stamp.json` (`hosts` names its agents).

## Verified facts (2026-10-28)

- From `%TEMP%\stage35-ver`: `trail --version` and `graft --version` print `0.25.0-nishadherath.5`.
  `GRAFT_NO_TRAIL_SWITCH` is `1` at user level but empty in the desktop app's own process tree.
- This checkout was moved by the upkeep, not by `trail init`: `~/.trail/init/local/` is empty (a real
  `trail init` writes a record there), and `.trail/cache/.cache/wiring-stamp.json` was written by
  `0.25.0-nishadherath.5` at 12:26:30, the minute of the move. The upkeep moves only when the switch is
  absent from its process. So a session opened in any of the nine now moves that repository unasked.
- Scratch repositories under `%TEMP%\s35` with a scratch home: `trail init` on a fresh repository and on a
  `graft init` one produce `.trail/{.gitignore,README.md,hook.cjs}` (hook 10,688 bytes, 201 lines; README
  and statusline hashes equal this checkout's), one SessionStart entry on `.trail/hook.cjs`, the statusline,
  permissions and footer regex in `settings.local.json`, no `.mcp.json`, no repository skill or shims.
  `git status` of the graft one lists the same seven paths as this checkout.
- User level: the other six hook events live in `~/.claude/settings.json` on `~/.claude/helpers/graft-hooks.cjs`
  (not `trail-hooks.cjs`, as the analysis's section 3.2 says); `~/.claude.json` names no MCP server.
- This checkout: map at `.trail/cache/` (10,083 nodes), `graft/` gone; `node .trail/statusline.cjs` prints
  `trail · 10065 nodes / 31426 edges · stale · 6 learnings`; `trail ask --source` opens with
  `[trail] tokens saved ≈ 31,520 (94%)`; `trail status` read `this week ~168k tokens saved` before two
  `trail ask --source` calls whose `[trail]` lines said 89,391 and 31,520, and `~289k` after (+120,911).
- Fork tests under both brands, scratch home: `trail-brand-layout` (new, 2), `graft-brand-layout`,
  `cli-status-graft`, `cli-status-trail`, `fork-upgrade-guard` pass. `graft-to-trail` "a graft repo moves to
  trail once the trail command is installed" fails with `trail` on PATH and passes with it removed: the
  test assumes no `trail` on the machine, false since the Stage 33 reinstall.
- Gate `npm run build && npm test` on Node 26.7.0, with `HOME`, `USERPROFILE` at a scratch folder (holding a
  copy of `.gitconfig`) and `GRAFT_NO_TRAIL_SWITCH=1`, per `.trail/learnings/2026-10-19-interview-bug-fixes-...`:
  build exit 0; 4,325 tests, 4,177 pass, 59 fail, 89 skipped, 3,072 s, exit 1. D13 by name: 35 baseline, 24 not.
  The 22 files rerun alone (`--test-concurrency=1`, 594 s): 177 tests, 162 pass, 9 fail; 4 baseline, 5 not.
  `claude-hook-timeouts` then passes 8 of 8 alone. `graft-to-trail`, `hosts-trail` and `init-keep` pass with
  `trail` removed from PATH (3 and 1 skipped, 9, 11) and `init-keep` fails 2 of 11 twice with it on PATH:
  upstream tests that assume no `trail` command, unchanged by this stage. Judged green under D13.
- Wiring after the gate: hashes of `~/.claude/settings.json`, this checkout's `.claude/settings.json` and
  `settings.local.json`, `~/.trail/install.json`, `~/.claude/skills/trail/SKILL.md` and
  `~/.claude/helpers/graft-hooks.cjs` equal their pre-gate values (`Compare-Object`, no difference).
- `git show --stat e52531f` records `.claude/helpers/graft-hooks.cjs => .trail/hook.cjs` with no line
  changed: the shared hook is graft's old shim, renamed.

## Work completed

- `e52531f`: the move (four deletions, `.trail/.gitignore`, `.trail/README.md`, `.trail/hook.cjs`),
  `test/trail-brand-layout.test.ts`, `GRAFT_init.md` section 1 and protocol section 10 brought up to date.
- This handoff.

## Unresolved questions

- The operator: the nine repository paths. Not in any document read here.
- The operator, D32: whether `trail init` may write memory notes into each repository's `.trail/learnings/`.
  Options: A let it, and review the new files before each commit; B remove them before committing;
  C hold back the look-back where memory notes exist. Recommended: A, since the files are visible in
  `git status` and nothing is pushed; B for any note the operator calls private.
- The operator: `~/.claude/skills/graft/SKILL.md` (2026-09-14) still sits beside the trail skill, so
  sessions are offered both; remove it by hand once the nine have moved (analysis section 3.2).
- Stage 37: whether the three trail-on-PATH test files above warrant a refreshed D13 baseline or an upstream
  issue (upstream tests, not a fork fault); whether the global and the repository SessionStart hooks both
  firing in a trail repository is intended upstream; the stale `footerLinksRegexes` (`graft/…md`) in
  `settings.local.json`, which upstream's move keeps.

## Exact next action

Before Stage 36: fully quit the Claude desktop app and reopen it, so `GRAFT_NO_TRAIL_SWITCH=1` reaches every
session. Then open a fresh session on this repository on **Haiku 5.5 (`claude-haiku-5-5`), effort medium**,
and paste the kickoff prompt from the Stage 35 report (also below), adding the nine paths.

```
You are the Stage 36 session for D:\Code\Claude\fork_graft. Check you are claude-haiku-5-5 at effort medium; stop on a mismatch. Read AGENTS.md, sections 1 and 14.1 of ENGINEERING_PERSONA.md, ENGINEERING_PERSONA_LANGUAGES/node-ts-js.haiku.md, docs/operator-protocol.md, docs/handoffs/2026-10-28-stage-35-trail-init.md and section 5 row 36 of docs/assessment-2026-10-27-trail-parity.md. In PowerShell, $env:GRAFT_NO_TRAIL_SWITCH must print 1; if not, stop and tell the operator to quit and reopen the Claude desktop app. The nine repository paths follow this prompt; stop if they are missing. For each repository, one at a time: (1) git -C <repo> status --short; if anything is dirty, skip the repository and report it. (2) Read <repo>\graft\.cache\wiring-stamp.json, or <repo>\.trail\cache\.cache\wiring-stamp.json, for its hosts. (3) From a folder under $env:TEMP, never from inside a repository, run: $env:GRAFT_NO_TRAIL_SWITCH='1'; trail init <repo> --agents <hosts> --yes. (4) git -C <repo> status --short must show the removal of .claude/helpers/graft-hooks.cjs, .claude/helpers/graft-statusline.cjs, .claude/skills/graft/SKILL.md and .mcp.json (or its graft server), and new .trail/.gitignore, .trail/README.md and .trail/hook.cjs; list any other path, and any new .trail/learnings/ file by its title, for the operator (decision D32 in the handoff) and do not stage those. (5) From the same temp folder, trail status <repo>: the code map line must say it is built. Do not commit in another repository; give the operator, per repository, the exact git add with explicit paths and the commit command, ending the message with Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>. Read any .trail/hook.cjs only with Read, Grep or Glob, never Bash. After all nine, tell the operator to open one Claude Code session in each and check the statusline reads trail, then to delete GRAFT_NO_TRAIL_SWITCH at user level and restart the app. Write docs/handoffs/2026-10-28-stage-36-nine-repositories.md from docs/handoffs/README.md, under 120 lines, and commit only that file here with git add by its path. Do not push. Australian English, no em-dashes. End with Stage 37's model (Fable 5.1, xhigh) and its exact kickoff prompt.
```

## Cost projection

Haiku 5.5, 30 turns. A fresh session starts near 85k tokens (dispatch, measured), so every request is
over 100k and pays the higher tier: cache reads 30 x 150,000 x $0.05/M = $0.23; fresh input 30 x 3,000 x
$0.625/M = $0.06; output 30 x 1,500 x $2.50/M = $0.11. About $0.40 (dispatch: $0.47).

## Time projection

30 to 60 min of agent time, no gate (no `src/` or `test/` change). Operator: nine reviews and commits,
about 20 to 30 min, plus the app restart and dropping the switch.
