---
stage: "Stage 4: documents tier, PDF, DOCX, ODT, EPUB, PPTX and ODP through a cached text rendering"
model: claude-opus-5-5
effort: high
status: ready
created: 2026-10-13
from: "Opus 5.5 Stage 3 session (structured edges), 2026-10-13"
---

# Stage 4: the documents tier

First confirm your own model and effort match the front matter (session tool,
`self`); if not, stop and say which to pick. Read `AGENTS.md`,
`docs/operator-protocol.md` (section 10), the plan's sections 3, 4 and 6
(`docs/plan-file-type-indexing-2026-10-13.md`), the Stage 3 handoff, then this.
`high` because this adds optional dependencies, a new cache directory and the
only locator that is not a line of the file itself.

## Goal

`graft build --structured --documents` (env twin `GRAFT_DOCUMENTS=1`, persisted in
`.graft/config.json` like `structured`) converts PDF, DOCX, ODT, EPUB, PPTX and ODP
into a deterministic text rendering at `graft/.graph/docs/<content-hash>.txt`, with
one marker line per page or slide, and indexes the rendering with the Markdown
scanner: a `section` per heading, page or slide, each with a line span into the
rendering. `ask --source` prints the rendering's lines; the locator shown names the
binary and its page (`manuscript.docx (page 12) -> .graph/docs/<hash>.txt:L340-L372`).
Done: each format has a failing-first test with a fixture built in the test and its
true lines written in it, a missing converter yields a refusal naming the package,
a file over the cap is skipped with a message, the gate is green with counts quoted,
`sync-global` has run, and `pr/documents-tier` is cut.

## Decisions already made

- D1 to D7 stand (plan section 6). D3 A: a cached rendering, the span contract is
  untouched, no new locator grammar through consumers. D4 A: `pdfjs-dist` and
  `fflate` as optionalDependencies, imported lazily; DOCX, ODT, EPUB, PPTX and ODP are
  zip archives of XML read with `fflate` and a hand-written scanner (the bundled XML
  grammar crashes here, Stage 2), headings from paragraph styles and `<h1>` to `<h6>`.
- Size cap `GRAFT_DOCUMENT_MAX_BYTES`, default 25 MB, a named constant beside the
  walker's `MAX_FILE_BYTES`; a PDF over 1 MB is otherwise never even listed.
- Documents stay out of `--deep` unless `--deep-documents` is given: extend
  `structuredUnitsBeyondBound` in `src/graph/enrich.ts` and `listContextFiles` in
  `src/context/build.ts` so a document unit is never sent by default.
- The rendering is keyed by the binary's content hash, so the extraction cache and the
  rendering agree; a stale rendering is deleted when no binary has its hash.
- Stage 3's `ref: "link"` resolution applies to a rendering unchanged once its
  sections exist; do not add document-specific edge kinds.
- No LLM, no network. Prose: Australian English, no em-dashes, no banned words.

## Files and links that matter

- `src/graph/structured/index.ts` (`STRUCTURED_LANGS`, `extractStructured`),
  `src/graph/structured/markdown.ts` (`scanMarkdown`, `extractMarkdown`),
  `src/graph/structured/xml.ts` (scanner to reuse for OOXML and ODF),
  `src/graph/build.ts` (dispatch), `src/graph/source-files.ts` (`listSourceStats`),
  `src/ingest/fs.ts` (`MAX_FILE_BYTES`, the 1 MB cap the walker applies, L288, L327,
  L380), `src/util/source.ts` (`readSourceFile`), `src/ask/ask.ts` and
  `src/graph/cards.ts` (where the locator is printed), `src/cli.ts` build options.
- Tests to copy the shape of: `test/structured-spans.test.ts`,
  `test/structured-edges.test.ts`, `test/structured-deep.test.ts`.

## Verified facts

- Stage 3 final gate: 1,472 tests, 1,467 pass, 0 fail, 5 skipped (Stage 3 handoff).
- The extractor stamp hashes `src/graph/structured/`; a file appearing there during a
  gate moves it and fails the MCP tests. Do not edit `src/` while a gate runs.
- Bash heredocs mangle backslashes here; write scripts and regex-bearing edits with
  the Write and Edit tools.
- `npm ci` cannot build `tree-sitter-kotlin` here; install with `--ignore-scripts` and
  copy the binary (protocol section 10). Adding optionalDependencies changes
  `package-lock.json`; check `npm ci --ignore-scripts` still succeeds.

## Work completed

Nothing yet in Stage 4.

## Unresolved questions

- Scanned PDFs (no text layer) yield a rendering with page markers only; whether to
  say so in the build output. Operator; default: one warning line per file.
- Whether `pdfjs-dist`'s Node build runs under Node 20 on upstream CI. Verify early.

## Exact next action

Set `status: in-progress` here, branch `stage-4/documents` off `main`, then write
`test/structured-documents.test.ts` with a two-page PDF written as a literal string
in the test (two text objects, one per page), and assert the rendering's page markers
and that `section` nodes for page 1 and page 2 carry spans into the rendering whose
lines hold that page's text. Watch it fail before adding the converter.

## Cost projection

Opus 5.5 at $4.00 in, $20.00 out, $0.20 cache read per million tokens; 120 turns,
average context 150k, 3k fresh input and 2.5k output per turn: cache 18M x $0.20 =
$3.60; fresh 360k x $5.00 = $1.80; output 300k x $20 = $6.00; about $11.40. Stages 1
to 3 ran 1.5 to 3 times their quotes, so quote $11 to $25.

## Time projection

2 to 3 hours of agent time, at least six gates of about 5 minutes. Operator review:
about 40 minutes, mostly the converters and the locator text.
