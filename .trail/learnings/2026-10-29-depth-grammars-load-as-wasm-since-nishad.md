---
title: "Depth grammars load as WASM since 0.28.0 (#707): README fences and page scripts parse only if warmed first"
author: Nishad
date: 2026-10-29
branch: main
id: l-2461acc2
scope: repo
status: active
src: agent
touches:
  - src/graph/build.ts
  - src/graph/structured/index.ts
  - src/graph/structured/markdown.ts
  - src/graph/structured/html.ts
  - src/graph/container.ts
  - src/hosts/mcp-config.ts
  - test/structured-fences.test.ts
  - test/hosts-trail.test.ts
---

## Decided

- Upstream #707 parses the depth tier on WASM. Loading a grammar is asynchronous and extraction is
  synchronous, so `depthReady(lang)` is false until `warmDepthGrammars` ran for that language. The fork's
  embedded code goes through `extractEmbedded` (container.ts), so it needs the same: `warmGrammarsFor`
  (build.ts) warms the languages each Markdown file's fences name (`fenceLanguagesOf`, the scanner's own
  opener test, read per file by `embeddedDepthLanguages`), and `warmStructuredGrammars` warms the page
  script language (`PAGE_SCRIPT_LANGUAGE` in structured/html.ts). Merge `3337689`, Stage 39.
- A test that calls `extractFile`, `extractContainer` or `extractStructured` directly warms first, at top
  level (`await warmDepthGrammars([...])`), as upstream's own tests do.
- Upstream tests that expect an npx MCP launch are held to the fork's rule, the installed launcher always
  (`c4d4120`, option C): `test/hosts-trail.test.ts` does so twice.

## Tried and ruled out

- Warming all nine depth grammars whenever a Markdown file is in the build: 107 to 255 ms per cold
  process, paid on every rebuild and on the edit-overlap hook path, for languages most READMEs never use.

## Watch out

- An unwarmed fence fails silently: the block yields no nodes and the build stays green. Only a span
  assertion catches it, in a repo with no source file in the fence's language (a `.ts` file beside the
  README warms TypeScript for it), after `setDepthParsersForTest({})` forgets what earlier tests warmed.
- Copying the Kotlin native binary is obsolete since #707; `scripts/sync-global-checks.mjs` and `AGENTS.md`
  non-negotiable 1 still mention it (Stage 40 decides).
