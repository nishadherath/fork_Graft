---
stage: "Stage 42: code calls must not resolve into README fence symbols"
model: claude-sonnet-5-5
effort: medium
status: done
created: 2026-10-29
from: "Stage 40 smoke test, via session local_6c0345a1 (learning l-053d69dd)"
---

# Stage 42: code calls must not resolve into README fence symbols

## Goal
A symbol hosted by a structured-tier document (a Markdown fence symbol, a page script symbol) is never the target of a `calls` or `imports` edge whose source is code. A code call to a real code symbol of the same name still resolves as before. Done: failing test first, fix in `src/graph/resolve.ts`, CHANGELOG Unreleased bullet, gate judged under D13, committed on `main`, nothing pushed.

## Decisions already made
- Smallest change: in `resolveEdges`, exclude candidates whose host file `structuredLangOf(path)` claims, when the edge's source is a code-tier node. Fences keep emitting what they emit.
- Stage 41 (the 0.28.0-nishadherath release) owns the CHANGELOG first; this stage starts after it.

## Files and links that matter
- `src/graph/resolve.ts`: `resolveEdges`, `resolveName`, `narrowByArity`.
- `src/graph/structured/index.ts`: `structuredLangOf`.
- `src/graph/structured/markdown.ts`, `src/graph/structured/html.ts`: fence and page-script emitters.
- `test/structured-fences.test.ts`; learning `.trail/learnings/2026-10-29-a-bare-call-with-no-code-candidate-nishad.md`.

## Verified facts
- Session configuration read with `self` on 2026-10-29: `claude-sonnet-5-5`, `medium`. Matches.

## Work completed
- Fix, two tests and CHANGELOG bullet committed as d2b51e8; `test/structured-fences.test.ts` passes 13/13 alone.
- Gate on 8c58170 (`npm run build && npm test`, fresh scratch HOME, Node 26.7.0): 4454 tests, 4305 pass, 47 fail, 0 cancelled, 102 skipped. Run once for Stages 41 and 42; Stage 41 released on it as a498f6f, tag v0.28.0-nishadherath.
- D13: 13 failing names are not in `docs/baselines/upstream-19865ff-failures.txt` (8 baseline names did not fail). The 12 files holding them, rerun alone under fresh HOMEs, pass except `a guard call takes under 2 ms` (trace-guard-fast), which also fails on plain upstream 19865ff. Verdict: no regression from d2b51e8.
- Mistake recorded: a stray `run-tests.mjs --help` started a second full suite during the reruns; it ended on its own and did not touch the gated results.

## Unresolved questions
- None.

## Exact next action
None; the stage is done.

## Cost projection
Sonnet 5.5, about 40 turns, the protocol's $2 to $4 band for a 60-turn stage scaled down: about $1.50 to $3 at API list price.

## Time projection
About 25 minutes wall clock, most of it the 7-minute gate; operator review 5 minutes.
