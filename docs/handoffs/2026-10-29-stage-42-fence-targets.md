---
stage: "Stage 42: code calls must not resolve into README fence symbols"
model: claude-sonnet-5-5
effort: medium
status: in-progress
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
- None yet.

## Unresolved questions
- None.

## Exact next action
Add the two tests to `test/structured-fences.test.ts` and run that file alone.

## Cost projection
Sonnet 5.5, about 40 turns, the protocol's $2 to $4 band for a 60-turn stage scaled down: about $1.50 to $3 at API list price.

## Time projection
About 25 minutes wall clock, most of it the 7-minute gate; operator review 5 minutes.
