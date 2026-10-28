---
stage: "Stage 38: an init for one repository never removes machine-wide wiring (D33 A)"
model: claude-sonnet-5-5
effort: high
status: done
created: 2026-10-28
from: "Stage 38 (claude-sonnet-5-5, high, side session); brief: docs/handoffs/2026-10-28-stage-37-acceptance.md finding 1 and D33"
---

# Stage 38: init keeps global wiring

## Goal

`trail init <repo> --agents <hosts without claude>` must leave `~/.claude/settings.json` hook events, the helper shim and
`~/.claude/skills/trail/SKILL.md` alone. Pinned by a test that failed first. Done: committed, gate judged under D13.

## Decisions already made

- D33 A: the init-time retract is repository-only; `uninstall` keeps the machine-wide scope. Not reopened.
- D13 judges the gate by failing-test names against `docs/baselines/upstream-4e7d0f5-failures.txt`.
- The side effect of `global: false` is deliberate: an init also stops stripping `~/.codex` hooks and the Antigravity
  skill for hosts it omits. Those are machine-wide too, and the mirror case of finding 1.

## Files that matter

- `src/cli.ts:2052-2058` (the `runRetract` call and its comment); `src/hosts/retract.ts:477-502` (section 4, unchanged).
- `test/init-keeps-global-wiring.test.ts` (new, 2 tests); `CHANGELOG.md` Unreleased, Fixed.
- `GRAFT_init.md:13,36,73`, `docs/architecture/system-reference.md:502,522` (docs commit).
- `src/cli.ts:2169-2196`: `uninstall`, the explicit path, passes `global: opts.global` as before.

## Verified facts (2026-10-28)

- Test first: `node --import tsx --test test/init-keeps-global-wiring.test.ts` failed 1 of 2 on the unfixed tree:
  `trail init B --agents agents antigravity hermes` printed `- removed claude (agent not selected)` (exit 0).
  After the fix: 2 of 2 pass. The second test (`uninstall --yes` still removes skill, shim and hook events) passes both sides.
- `test/hosts-init.test.ts` alone: 22 of 22 pass after the fix (the only other file naming "not selected").
- Gate, `HOME` and `USERPROFILE` at a scratch folder with a copy of `.gitconfig`, `DO_NOT_TRACK=1`, `GRAFT_NO_TRAIL_SWITCH=1`,
  Node 26.7.0, one gate alone from PowerShell: `npm run build` exit 0; `npm test` 4,328 tests, 4,201 pass, 38 fail,
  89 skipped, 977.4 s, exit 1. Stage 37 counted 4,325; two are the new tests, one more is unexplained (not chased).
  Both new tests pass inside the run.
- D13 by name: 38 distinct failing lines, 30 baseline, 8 strays (one file-level line, seven tests). Rerun alone,
  `--test-concurrency=1`, same environment: the wall-clock bar in `claude-hooks-perf` and `context-synth-concurrency` pass;
  `skills-probes-init-paths-1b` (git probes at 300 ms, a baseline family) passes; `init-keep` (2) and `claude-hook-timeouts` (1)
  pass from Git Bash (they fail from PowerShell: `ps` is not on its PATH, and `init-keep` also differs there, cause not chased).
  The two trail-on-PATH move tests fail alone while `C:\nvm4w\nodejs` and `%APPDATA%\nvm\v26.7.0` are on PATH (both hold
  `trail`), and pass with every `nvm` folder off PATH and `node.exe` copied beside: 24 tests, 23 pass, 0 fail, 1 skipped.
  Judged green under D13. `git status` clean after the gate; `~/.claude/settings.json` untouched by it (scratch home).

## Work completed

- `a241f6f` fix(init): `global: false` at the init-time `runRetract`, comment states why, test, CHANGELOG entry.
- `e354329` docs: `GRAFT_init.md` names `0.25.0-nishadherath.5` (lines 13, 36), line 73 says no committed graft shims
  since `e52531f`; `system-reference.md` cites `src/cli.ts` lines 113 and 2483.
- Nothing pushed, `sync-global` not run, no graft or trail command run in this checkout (scratch repositories only).

## Unresolved questions

- The global install still has the bug until a sync: `node scripts/sync-global.mjs` after the release (operator's call).
  Until then repeat the all-hosts init after any hosts-only init (Stage 37 recipe).
- Line 2483 differs from the kickoff's 2479 because the new comment adds four lines above `teamCheckCommand`. Recheck the
  two cited lines whenever `src/cli.ts` moves. `system-reference.md:502` still says "lines 2417 to 2455" for the trail command
  layout; not checked here (operator or the release stage).
- Stage 37 findings 2 to 4 (D34, D35, footer regex, `.gitignore:26`) are untouched; they are the operator's decisions.
- Running the full gate from Git Bash would remove the PowerShell-only strays; say which shell the gate used when quoting it.

## Exact next action

Operator: decide whether to cut `0.25.0-nishadherath.6` now or fold the fix into the next upstream merge. If now, open the
release stage below, then run `node scripts/sync-global.mjs` once its gate is judged. Either way the machine-wide wiring
is already restored (Stage 37) and the fix only matters after the sync.

## Cost projection

This stage (Sonnet 5.5 high, 2026-10-11 method, list prices cache read 0.10, input 2.00 x 1.25, output 10.00): about
50 turns, average context 70k, fresh 3k, output 1.5k. Cache reads 50 x 70k = 3.5M x 0.10 = $0.35; fresh 150k x 2.50 =
$0.38; output 75k x 10 = $0.75; about $1.50 (kickoff quoted $1.50 to $3.50). Release stage (Sonnet 5.5 medium, 25 turns,
60k average): 1.5M x 0.10 = $0.15; fresh 75k x 2.50 = $0.19; output 37k x 10 = $0.38; about $0.70, plus one gate.

## Time projection

This stage: about 70 minutes wall clock, the gate 16.3 minutes, the strays rerun 3 minutes; operator review 15 minutes.
Release stage: 30 to 45 minutes including one gate; review 10 minutes.

## Next stage

Model: **Sonnet 5.5 (`claude-sonnet-5-5`), effort medium.** Pick both in the model menu. Or none, if the operator folds the fix into the next merge.

```
You are the release stage for D:\Code\Claude\fork_graft. Check you are claude-sonnet-5-5 at effort medium; stop on a mismatch. Read AGENTS.md, docs/operator-protocol.md, docs/handoffs/2026-10-28-stage-38-init-keeps-global-wiring.md and the release handoffs docs/handoffs/2026-10-26-stage-24-own-build-release.md and 2026-10-27-stage-28-release-script-test-fork.md. Task: cut 0.25.0-nishadherath.6 exactly as those did: move the CHANGELOG Unreleased entry under a new heading dated today, bump package.json and the lockfile version, update the version strings GRAFT_init.md names, run npm run build && npm test with HOME and USERPROFILE at a scratch folder holding a copy of .gitconfig, DO_NOT_TRACK=1 and GRAFT_NO_TRAIL_SWITCH=1, one gate alone, judged under D13 against docs/baselines (rerun strays alone, the trail-on-PATH move tests with every nvm folder off PATH), commit with explicit paths, tag v0.25.0-nishadherath.6, do not push, and do not run sync-global: tell the operator to run node scripts/sync-global.mjs. Never run graft or trail in this checkout. Australian English, no em-dashes. Write docs/handoffs/2026-10-28-release-0.25.0-nishadherath.6.md under 120 lines, commit it, and end with the next stage or none.
```
