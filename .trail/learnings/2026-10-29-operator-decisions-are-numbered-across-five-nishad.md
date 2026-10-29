---
title: "Operator decisions are numbered across five documents, not a register; next free number is D36"
author: Nishad
date: 2026-10-29
branch: main
cost: { minutes: 16, tokens: 79695 }
id: l-4c5bc920
scope: repo
status: active
src: agent
touches:
  - docs/handoffs/2026-10-28-release-0.25.0-nishadherath.6.md
  - docs/handoffs/2026-10-28-stage-36-nine-repositories.md
  - docs/handoffs/2026-10-28-stage-37-acceptance.md
  - docs/handoffs/2026-10-28-stage-38-init-keeps-global-wiring.md
  - CHANGELOG.md
  - GRAFT_init.md
  - README.md
  - package-lock.json
  - package.json
  - docs/architecture/system-reference.md
---

## Decided

- There is no decisions register. The operator's numbered decisions live in five kinds of place, each as a
  block headed `Dnn Decision:` with `Recommended:` and, when answered in that file, `Answered:`: D1 to D7 in
  `docs/plan-file-type-indexing-2026-10-13.md`; D8 to D11 in `docs/assessment-2026-10-18.md` section 7; D12
  (Stage 17), D14 (Stage 19), D15 and D16 (Stage 21), D17 to D23 (Stage 25) in those handoffs; D24 to D27 in
  `docs/assessment-2026-10-27.md` section 7; D28 to D31 in `docs/assessment-2026-10-27-trail-parity.md`
  section 4; D32 in the Stage 35 and 36 handoffs; D33 to D35 in the Stage 37 handoff. Next free number: D36.
- To list them: grep every `docs/**/*.md` outside `docs/archive` for `^\s*D[0-9]+\s+Decision:`, `Answered:`
  and `Recommended:`, then read the `## Decisions already made` and `## Unresolved questions` sections of the
  handoffs from the last few days for the ones answered later than their block.
- An operator action a handoff listed as pending is marked done in that same handoff, dated, with what was
  verified on disk (Stage 37's restore step, the release handoff's push, pack and sync, 2026-10-29). The
  handoff stays at or under 120 lines, so a done note usually means rewrapping the paragraph, not adding a line.

## Tried and ruled out

- Grepping bare `D[0-9]+` across the docs: it also matches D57, D65 and D137 from unrelated text and gives
  85 hits for D13 alone. Anchoring on `Decision:` and `Answered:` is the usable list.
- Expecting every closed decision to carry an `Answered:` line: D1 to D7 and D12 to D23 are closed only by
  later handoffs' `Decisions already made` lines (for example "D28 A, D29 B, D30 A, D31 A").

## Watch out

- A decision answered as "wait, re-check at the next upstream release" (D26 A, 2026-10-27) comes due
  silently; upstream was at 0.28.0 by 2026-10-29 and nothing re-opened it.
- D10 and D25 both say "send the advisory", but `docs/security/2026-10-15-graft-mcp-npx-launcher-advisory.txt`
  still carries placeholder reporter and status lines, so a decision "answered" is not a decision carried out.
