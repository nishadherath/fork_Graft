---
title: "A bare call with no code candidate resolves into a README fence symbol; the fence tests guard only fence-to-code"
author: Nishad
date: 2026-10-29
branch: main
id: l-053d69dd
scope: repo
status: active
src: agent
touches:
  - src/graph/resolve.ts
  - src/graph/structured/markdown.ts
  - src/graph/container.ts
  - test/structured-fences.test.ts
---

## Decided

- Stage 40 (the Fable acceptance of the 0.28.0 merge, `3337689`) found this on a smoke repo and
  left it in place: it predates the merge (`src/graph/resolve.ts` last changed at the 0.25.0
  merge; fence symbols exist since `7f284b8`, 2026-10-13), so it is not a merge defect. A
  follow-up stage fixes it in the resolver, with a test that fails first.

## Tried and ruled out

- Reading it as a WASM parser regression: rebuilding the same repo without the Kotlin fence
  leaves `shout`'s call unresolved (0 `calls` edges in the graph), so the fence symbol was simply
  the only candidate named `greet`. The depth parser change is not involved.

## Watch out

- `extractMarkdown` keeps only `contains` edges from a fence, so a sample that calls `greet()`
  makes no edge into `src/`. The other direction is open: `resolveEdges` sees fence-born symbols
  as ordinary targets, so a Kotlin method `shout()` calling `greet()` with no resolvable code
  candidate gets `calls src/Main.kt#Greeter.shout -> README.md#greet`, and `graft callers greet`
  then presents documentation as code. The fix belongs in `resolve.ts`: a symbol hosted by a
  structured-tier document (a Markdown fence, a page script) is never the target of a `calls`
  or `imports` edge whose source is code.
