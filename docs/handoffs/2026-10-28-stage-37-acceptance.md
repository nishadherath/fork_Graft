---
stage: "Stage 37: acceptance of Stages 33 to 36 one tier up"
model: claude-fable-5-1
effort: xhigh
status: done
created: 2026-10-28
from: "Stage 37 (claude-fable-5-1, xhigh, fresh session); briefs: docs/handoffs/2026-10-28-stage-36-nine-repositories.md and 2026-10-28-stage-37-dispatch.md"
---

# Stage 37: acceptance of Stages 33 to 36

## Goal

Stages 33 to 36 judged one class above their authors: each claim checked against disk, git, the running install and one gate
under D13; findings by file and line; the operator's next action. Nothing pushed or committed elsewhere; no graft or trail
command inside a wired checkout (`trail status <repo>` ran from `%TEMP%`).

## Decisions already made

- D28 A, D29 B, D30 A, D31 A, D32 A; D13 for the gate. Not reopened.
- The ten Stage 36 repositories were judged as they stand on disk: none was committed when this session opened.

## Files that matter

- `src/cli.ts:2052-2053`, `src/hosts/retract.ts:479-487` (finding 1); `src/claude/settings-merge.ts:11` (finding 3);
  `src/claude/hooks.ts:532-560`; `src/context/check.ts:159` with `src/cli.ts:601`; drift in `GRAFT_init.md:13,36,73`,
  `docs/architecture/system-reference.md:502,522` and `.gitignore:26` (this checkout).

## Verified facts (2026-10-28, this session)

- Stage 33, accepted. `package.json` `bin` has both entries and `src/bin/{trail,graft}.ts` set the brand before `../cli.js`;
  tag `v0.25.0-nishadherath.5` is on `ec37e8d`; the global install is that version with both bins, six shims (12:22 today),
  the Kotlin binary and both converters; `trail --version` and `graft --version` from `%TEMP%` print it; `sync-global
  --dry-run` after this session's rebuild: 0 would change, 1,630 unchanged, `trail command present`.
- Stage 34, accepted with drift. The four files match `src/brand.ts:53-57`. In a scratch repository `trail build --check`
  and `graft check` both print `graph check: OK` (no deep layer); the `trail build --check: OK` verdict is
  `src/context/check.ts:159` with the label from `src/cli.ts:601`, read, not run. `GRAFT_init.md:13,36` still say
  `0.25.0-nishadherath.2`, `:73` still says this checkout has committed Graft shims (gone since `e52531f`), and
  `system-reference.md:502` cites `src/cli.ts` line 106 (now 113) and `:522` line 2241 (now 2479).
- Stage 35, accepted. `e52531f` renames the hook with no line changed; `.trail/hook.cjs`, `README.md`, `.gitignore` and
  `statusline.cjs` here hash equal to the eight Claude-wired repositories' copies; `trail-brand-layout` passes in the gate.
  Its open question, from source: a user-level and a repository SessionStart hook both run `hooks.js session-start`
  (`.trail/hook.cjs:122-123`) with no once-per-session guard (`src/claude/hooks.ts:532-560`), so the orientation prints twice.
- Stage 36, repository work accepted. All ten repositories carry the diff its table lists, byte for byte on the shared files;
  the nine new learnings are memory notes with no key-shaped string; the four host repositories' `AGENTS.md`, `GEMINI.md`,
  `opencode.json` and `.gemini/settings.json` name `trail`. `trail status <repo>` from `%TEMP%`: Fixer, Malkovich and Tsunami
  `in sync with the code`, the other seven `behind the code, refreshed on the next query`; each of the eight statuslines prints `trail · …`.
- Fresh session: a Haiku session opened in `D:\Code\Claude\Fixer` (no tool calls) reported the `[trail]` block, the `repo
  map (.trail/cache/INDEX.md)` block and the upstream notice in its startup context, and a `graft` skill but no `trail` skill.
- Finding 1 (high), against Stage 36's verification and the kickoff that shaped it, not its repository work. `trail init
  <repo> --agents <hosts without claude>` removes the user-level Claude wiring every other repository depends on.
  `~/.claude/settings.json`, `~/.claude/helpers` and `~/.claude/skills` were last written at 15:56:19, the second of the
  Digi-J stamp; the hooks block, `graft-hooks.cjs` and `skills/trail` that Stage 35 verified are gone. Reproduced in a scratch
  home with the global `trail`: a claude init writes the seven hook events and the skill; a following `--agents agents
  antigravity hermes` init prints `removed claude (agent not selected)` and deletes them. Cause: `src/cli.ts:2052-2053`
  passes `global: opts.global` (default on) and `exclude: ids` to `runRetract`, and `src/hosts/retract.ts:479-487` strips the
  global settings, shim and trail skill for every host not selected. Effect now: each Claude Code session on this machine
  gets only the repository SessionStart hook (no prompt, tool-savings, pre-bash, post-edit, stop or session-end hook).
- Finding 2 (medium). `GRAFT_NO_TRAIL_SWITCH` is set neither at user level (`HKCU\Environment`) nor in this process;
  Stage 36 read `1` at 16:01. The switch went before the commits, the reverse of Stage 36's order. `SocialBee` (graft stamp
  `0.25.0-nishadherath.4`, host claude, nine dirty lines) moves to trail unasked at its next session start, as this checkout
  did; `bewhole-accept` (no claude host; stamp `0.21.1-nishadherath.1`) does not auto-move but is rewired by its next command.
- Finding 3 (low). `footerLinksRegexes` stays `graft/[\w./-]+\.md` under trail (`src/claude/settings-merge.ts:11`, written
  at `:188` and `:299`) in every `settings.local.json`, and never matches `.trail/cache/`. `enabledMcpjsonServers: ["graft"]`
  (Tsunami, BeWhole, Capsule, BOOKS-Dx) and `disabledMcpjsonServers` (Fixer) name a server `.mcp.json` no longer declares.
- Finding 4 (low). This checkout ignores `.claude/settings.json` (`.gitignore:26`) though `.trail/README.md` says commit it:
  a fresh clone runs neither hook (pre-existing). `BeWhole/AGENTS.md:89-116` is a hand-written graft section; no init moves it.
- Gate: `npm run build && npm test`, Node 26.7.0, `HOME` and `USERPROFILE` at a scratch folder holding a copy of
  `.gitconfig`, `DO_NOT_TRACK=1`, `GRAFT_NO_TRAIL_SWITCH=1`: build exit 0 (29 s); 4,325 tests, 4,203 pass, 33 fail,
  89 skipped, 1,010.6 s, exit 1. D13 by name against `docs/baselines/upstream-4e7d0f5-failures.txt`: 30 of 34 distinct
  failing names are baseline; strays: the move tests in `graft-to-trail` and `hosts-trail`, the 300 ms bar in
  `claude-hooks-perf`. Rerun alone (`--test-concurrency=1`, same environment): 15 tests, 11 pass, 2 fail, 2 skipped, 18.7 s,
  the wall-clock test passing and the two move tests failing; with the nvm4w shim folder off PATH (node copied beside it):
  13 tests, 12 pass, 0 fail, 1 skipped, 4.0 s. Eleven wiring files hashed before and after: unchanged, except `~/.claude.json`,
  written by the desktop app at 18:35:42, after the gate ended at 18:27:54. `git status` clean. Judged green under D13.

## Work completed

This handoff. No source change, no commit outside this repository, no push.

## Unresolved questions (operator)

- D33, finding 1. A: fix in the fork (Stage 38) and restore the user-level wiring now. B: restore now and document the
  order (hosts-only inits before claude ones), no code change. C: upstream issue only. Recommended A: `src/cli.ts:2052`
  passes `global: false` to the init-time retract, so an init for one repository never removes machine-wide files (an
  explicit retract still can), pinned by a test that runs the reproduction above and fails first. The upstream-faithful
  alternative, retracting global targets only when no known repository still selects claude, needs `~/.trail/repos/known.json`.
- D34, finding 2. A: commit or stash SocialBee's nine lines, then from `%TEMP%` run `trail init D:\Code\Claude\SocialBee
  --agents claude --yes` before any session opens there, and the same for bewhole-accept with its three hosts once its
  untracked file is dealt with. B: re-set `GRAFT_NO_TRAIL_SWITCH=1` until then. Recommended A.
- D35, the baseline. A: refresh `docs/baselines` at the next merge stage (its plain-upstream run is needed anyway) and until
  then name the two move tests as machine-environment failures in every gate judgement. B: refresh now (27 minutes).
  Recommended A. D32 and the host files: as the Stage 36 handoff lists them.

## Exact next action

Operator, in order: (1) from `%TEMP%`, `trail init D:\Code\Claude\Fixer --agents claude --yes`, which restores the user-level
hooks and the trail skill (repeat after any hosts-only init until D33 lands), then confirm `~\.claude\settings.json` lists
seven hook events; (2) decide D33 to D35; (3) commit the ten repositories with the Stage 36 commands; (4) open Stage 38.

## Cost projection

This stage, measured: context 129,696 tokens at the first usage reading and 344,816 at the handoff, about 24 turns. At the
2026-10-18 list prices for claude-fable-5-1 (cache read 0.25, cache write 12.50, output 50.00 per million): cache reads
24 x 240,000 average = 5.76M x 0.25 = $1.44; fresh input about 350,000 written once = $4.38; output about 24 x 3,000 = $3.60;
about $9.42 plus a Haiku session of a few cents (dispatch: $16.50 at 55 turns). Stage 38 (Sonnet 5.5 high, 50 turns, 90k
average context, 3k fresh and 1.5k output per turn, a 90k baseline written once): about $1.80 (quote $1.50 to $3.50).

## Time projection

This stage: about 60 minutes of wall clock (17:59 to about 19:00), with the gate at 17.5 minutes and the ten `trail status`
runs at 21 minutes under its load; operator review 30 minutes. Stage 38: 45 to 90 minutes plus one gate of 17 to 51 minutes.

## Stage 38 kickoff

Model: **Sonnet 5.5 (`claude-sonnet-5-5`), effort high.** Pick both in the model menu.

```
You are the Stage 38 session for D:\Code\Claude\fork_graft. Check you are claude-sonnet-5-5 at effort high; stop on a mismatch. Read AGENTS.md, ENGINEERING_PERSONA.md (sections 1, 6, 11 and 14.1), ENGINEERING_PERSONA_LANGUAGES/node-ts-js.sonnet.md, docs/operator-protocol.md and docs/handoffs/2026-10-28-stage-37-acceptance.md (finding 1 and D33). Task, D33 A: an init for one repository must never remove machine-wide wiring. Test first, in a new test/init-keeps-global-wiring.test.ts modelled on test/trail-brand-layout.test.ts (scratch home, src/bin/trail.ts through tsx, --yes --no-build, TRAIL_NO_LOOK_BACK=1): trail init A --agents claude writes the hook events into <home>/.claude/settings.json and <home>/.claude/skills/trail/SKILL.md; a following trail init B --agents agents antigravity hermes must leave both in place and print no "removed claude" line. Run it and quote the failure. Then change src/cli.ts near line 2052 so the init-time runRetract gets global: false (the explicit retract path keeps its global scope), keep the comment above it honest, and make the test pass. Add a CHANGELOG Unreleased Fixed entry. Second commit, docs only: GRAFT_init.md lines 13 and 36 (0.25.0-nishadherath.5), line 73 (this checkout has had no committed graft shims since e52531f), and docs/architecture/system-reference.md lines 502 and 522 (src/cli.ts lines 113 and 2479). Gate: npm run build && npm test with HOME and USERPROFILE at a scratch folder holding a copy of .gitconfig, DO_NOT_TRACK=1 and GRAFT_NO_TRAIL_SWITCH=1, one gate alone in the background, judged under D13 against docs/baselines; rerun the two trail-on-PATH move tests and any wall-clock bar alone as the Stage 37 handoff records. Never run graft or trail in this checkout; scratch repositories only. Commit with explicit paths and Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>. Do not push, do not run sync-global. Australian English, no em-dashes. Write docs/handoffs/2026-10-28-stage-38-init-keeps-global-wiring.md under 120 lines, commit it, and end with the next stage's model, effort and kickoff prompt: the 0.25.0-nishadherath.6 release on Sonnet, or none if the operator folds it into the next merge.
```
