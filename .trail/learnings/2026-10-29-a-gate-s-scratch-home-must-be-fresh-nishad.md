---
title: "A gate's scratch HOME must be fresh for that gate: a reused one fails three trail-scenario-hooks tests deterministically"
author: Nishad
date: 2026-10-29
branch: main
id: l-096b5bff
scope: repo
status: active
src: agent
touches:
  - src/claude/pre-bash-check.ts
  - test/trail-scenario-hooks.test.ts
  - scripts/run-tests.mjs
  - docs/operator-protocol.md
---

## Decided

- Every gate on this machine runs under a scratch `HOME` and `USERPROFILE` made for that gate alone
  (a copy of `.gitconfig` inside, nothing else). Protocol section 10 records the rule (Stage 40,
  2026-10-29).

## Tried and ruled out

- Blaming the tree: the three tests failed alone on the fixed tree (`86af73e`) and still failed with
  the session's uncommitted learning file moved aside, in 5 to 17 ms each, so not a timeout and not
  a code change. They had passed in the same session's first gate, whose scratch `HOME` was new.

## Watch out

- `shipCheck` (`src/claude/pre-bash-check.ts`) warns once per set of conflicts and remembers that in
  `~/.trail/sessions/<session id>.ship-checks.json`. `test/trail-scenario-hooks.test.ts` uses fixed
  session ids (`ship-1`, `warn-1`, `wired-1`), so a second run against the same `HOME` finds the
  keys from the first and the check returns null: "a warning, not a decision", "the check ran with
  no brand in the environment" and the `permissionDecision` assertion all fail together. The test
  runner gives each run a fresh temp folder, but `HOME` is the caller's to make fresh.
