---
stage: "Stage 4: documents tier, PDF, DOCX, ODT, EPUB, PPTX and ODP through a cached text rendering"
model: claude-opus-5-5
effort: high
status: done
created: 2026-10-13
from: "Opus 5.5 Stage 3 session (structured edges), 2026-10-13"
---

# Stage 4: the documents tier

Done 2026-10-13 by an Opus 5.5 (high) session. Final gate on `stage-4/documents`
(`npm run build && npm test`, Node 26.7.0): 1,489 tests, 1,484 pass, 0 fail,
5 skipped. Stage 3 ended at 1,472; the 17 new tests are in
`test/structured-documents.test.ts`, fixtures built in `test/document-fixtures.ts`.

## Goal

`graft build --structured --documents` (env twin `GRAFT_DOCUMENTS=1`, persisted) renders
PDF, DOCX, ODT, EPUB, PPTX and ODP to `graft/.graph/docs/<sha256>.txt` and indexes it
with the Markdown scanner. Done as specified; see "Work completed".

## Decisions already made

- D1 to D7 stand. D3 A as built: a node keeps the BINARY's path (ids, cards,
  `--only-dir`); its span is rendering lines; its signature is the locator
  `manual.pdf (page 3) -> graft/.graph/docs/<hash>.txt:L40-L52`. `ask` and `grep`
  print the rendering's path as the pointer, so it opens in any tool. The path is
  repository-relative (`graft/.graph/...`), not `.graph/...` as the plan sketched.
- Pages only from what the file records: PDF pages, `w:lastRenderedPageBreak`,
  `text:soft-page-break`. A file with none gets no page markers, never a guess.
- Sections per heading; per page or slide only when a document has no headings.
- `--deep-documents` (env `GRAFT_DEEP_DOCUMENTS`) is per run, not persisted, and
  covers the per-node pass only; the concept pass never reads a document.
- Scanned PDF: one warning line per file (the default the handoff proposed).

## Files and links that matter

- `src/graph/structured/documents/`: `index.ts` (formats, dispatch), `render.ts`
  (rendering format, markers, escaping), `extract.ts` (sections, locator,
  `renderingOf`, `pointerOf`), `cache.ts` (prepare, prune, read), `load.ts` (lazy
  import, `MissingConverterError`), `pdf.ts`, `docx.ts`, `odf.ts`, `epub.ts`,
  `pptx.ts`, `flow.ts` (shared DOCX/ODT body), `xml-events.ts`, `zip.ts`.
- `src/graph/build.ts` (pre-pass, warnings), `src/ingest/fs.ts` (`DOCUMENT_MAX_BYTES`,
  `SizeCap`), `src/graph/source-files.ts` (`sourceWalkOptions`), `fingerprint.ts`,
  `check.ts`, `enrich.ts`, `ask/ask.ts`, `search/grep.ts`, `cli.ts`.

## Verified facts

- Every gate green; counts are in each commit message.
- `node scripts/sync-global.mjs`: global graft answers 0.21.1. The sync copies
  `dist/` only: the converters were copied into the global install's
  `node_modules` by hand (`pdfjs-dist`, `fflate`, `@napi-rs/canvas` and its
  `canvas-win32-x64-msvc` binary). Without them the build refuses by package name.
- Real files: LibreOffice-made ODT, DOCX and PDF of a three-chapter guide, global
  graft with both env twins: 21 nodes, 18 sections; PDF split at the true page
  boundary; `ask "habitat shelter plants" --source` returns the DOCX section with
  the rendering's lines. Two fixes came from this (`e4513bc`, `1021ff4`).
- This repository, both env twins: 3,602 nodes, 9,164 edges (no documents here);
  code-only rebuild 2,763 nodes. BeWhole: 1,774 nodes, 3,027 edges (no documents);
  code-only 643 nodes; `git status` empty before and after, no `.graft/` written.
- Install footprint measured on Windows: pdfjs-dist 41 MB, @napi-rs/canvas 37 MB,
  fflate 0.8 MB. npm installs optionalDependencies by default.

## Work completed

Branch `stage-4/documents`, one gated commit per item: `39b5599` PDF and the cache,
`76b22b1` DOCX, `fda0381` ODT, `2aa5cd8` EPUB, `2dffe3a` PPTX and ODP, `5976efe` size
cap and warnings, `ac00a9a` ask and grep locators, `8f7afe0` CLI flags and
`--deep-documents`, `083b4f6` README and CHANGELOG, `e4513bc` ODT styled headings,
`751721e` pdfjs load noise, `1021ff4` canvas refusal. `pr/documents-tier` is stacked on
`pr/structured-edges`.

## Unresolved questions

- Install footprint (operator): optionalDependencies add about 79 MB to every
  install, which D4 assumed would not happen. See the decision in the Stage 5 handoff.
- `scripts/sync-global.mjs` does not carry optional packages into the global
  install (operator or a later stage).
- Not built: links inside documents (DOCX relative hyperlinks), document nodes in
  `blast` and `traverse` output (they print the binary's `path:span`), workspace
  builds passing `--documents` to children, `graft check --deep` over documents.
- The refusal's `npm install pdfjs-dist` installs the newest major, which needs
  Node 22; graft pins 5.6.205 for Node 20 (maintainer, in review).

## Exact next action

Start Stage 5 from `docs/handoffs/2026-10-13-stage-5-upstream-texts.md`.

## Cost projection

Projected $11 to $25. Actual, estimated: about 200 tool turns, context rising to
470k (average about 250k): cache 200 x 250k = 50M x $0.20 = $10.00; fresh
200 x 3k = 600k x $5.00 = $3.00; output 200 x 2k = 400k x $20 = $8.00; about $21.

## Time projection

Projected 2 to 3 hours. Actual about 100 minutes wall clock (07:56 to about 09:40
UTC), twelve gates of about 6 minutes run in the background. Operator review:
about 40 minutes, mostly the converters, `extract.ts` and the locator text.
