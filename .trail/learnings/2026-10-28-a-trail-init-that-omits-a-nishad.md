---
title: "A trail init that omits a host retracts that host's machine-wide wiring; restore with an init selecting every host"
author: Nishad
date: 2026-10-28
branch: main
cost: { minutes: 65, tokens: 540881 }
id: l-cb02fe3c
scope: repo
status: active
src: agent
touches:
  - docs/handoffs/2026-10-28-stage-37-acceptance.md
  - src/cli.ts
  - src/hosts/retract.ts
  - src/claude/settings-merge.ts
  - src/claude/hooks.ts
  - ENGINEERING_PERSONA.md
---

## Decided
- An init for one repository must never remove machine-wide wiring (D33 A, Stage 38): src/cli.ts near line 2052 hands the init-time runRetract global: opts.global, and src/hosts/retract.ts section 4 then strips the user-level targets of every host not in --agents. On 2026-10-28 the Digi-J init (agents antigravity hermes) deleted the user-level Claude hooks block, the hooks shim and the trail skill at 15:56:19.
- Until that lands, restore with an init that selects every host the machine uses, from a temp folder: trail init D:\Code\OpenAI\Tensegrity --agents agents antigravity claude gemini hermes --yes. A claude-only init retracts the Codex hooks and the Antigravity skill instead (the mirror). Proven in a scratch home before running it for real.
- The gate recipe that leaves the user-level files alone: HOME and USERPROFILE at a scratch folder holding a copy of .gitconfig, DO_NOT_TRACK=1, GRAFT_NO_TRAIL_SWITCH=1. On 2026-10-28 it ran in 1,010 s (4,325 tests, 33 fail, 30 of 34 names in docs/baselines); Stage 35 measured 3,072 s the same day.

## Tried and ruled out
- Judging the three D13 strays from the full run alone: the 300 ms bar in claude-hooks-perf passes alone, and the move tests in graft-to-trail and hosts-trail fail only while a trail shim is on PATH (pass with the nvm4w folder off PATH and node copied beside it). Treat them as machine-environment failures until docs/baselines is refreshed at the next merge stage (D35).
- Counting carriage returns with grep -c in Git Bash: it miscounts; count bytes with tr -cd and wc -c, and check git ls-files --eol.

## Watch out
- GRAFT_NO_TRAIL_SWITCH is no longer set at user level (since 2026-10-28 afternoon). A graft-wired repository with a claude host (SocialBee) moves to trail unasked at its next session start.
- footerLinksRegexes stays graft/...md under trail (src/claude/settings-merge.ts line 11), so footer links never match the map in .trail/cache/.
- A user-level and a repository SessionStart hook both run the same session-start code with no once-per-session guard (src/claude/hooks.ts near line 532), so the orientation prints twice when both exist.
