---
stage: "Stage 3: cross-type edges, deep pass over structured files, blast aware of key edges"
model: claude-opus-5-5
effort: high
status: done
created: 2026-10-13
from: "Sonnet 5.5 Stage 2 session (markup and build families), 2026-10-13"
---

# Stage 3: edges between documents and code

Done 2026-10-13 by an Opus 5.5 (high) session. Final gate on `stage-3/edges`
(`npm run build && npm test`, Node 26.7.0): 1,472 tests, 1,467 pass, 0 fail,
5 skipped. Stage 2 ended at 1,446; the 26 new tests are in
`test/structured-{edges,deep,blast}.test.ts`.

## Goal

Deterministic, $0 edges between structured nodes and code; `--deep` over
structured files bounded; `blast` reporting the code that names a changed key.
Done as specified; see "Work completed".

## Decisions already made

- D1 to D7 stand. The tier is opt-in.
- Precision first: a unique match is an edge, an ambiguous or absent one is dropped.
  Stated links (Markdown, HTML) are `extracted`; key paths, base-less paths, script
  names and repository-wide class matches are `inferred`.
- Extractors emit `RawEdge`s carrying `ref` (`key`, `link`, `path`, `class`,
  `script`); `src/graph/resolve-structured.ts` resolves them after extraction, so
  the extraction cache replays them. With the tier off there are no targets and the
  wiring graph is unchanged.
- A key path matches as written or with its file's root segment removed, never a
  deeper suffix. One segment is never looked up.
- `blast` widens the walk from a key or section seed to its containing keys or
  sections only; seeds reported stay innermost; key seeds are not behavioural.

## Files and links that matter

- `src/graph/code-refs.ts` (code side: member chains, string tokens, `.md#anchor`
  strings), `src/graph/resolve-structured.ts`, `src/graph/structured/commands.ts`
  (command-line scanner), hooks in `markdown.ts`, `html.ts`, `yaml.ts`, `json.ts`,
  `shell.ts`, `targets.ts`, `make.ts`; `ownerAt` and `isExternalTarget` in `shared.ts`.
- `src/graph/enrich.ts` (`MAX_DEEP_UNITS_PER_STRUCTURED_FILE` = 40),
  `src/context/build.ts` (`listContextFiles` default), `src/blast/blast.ts`
  (`withContainers`).

## Verified facts

- Every gate in this stage was green; counts are in each commit message.
- `node scripts/sync-global.mjs`: 61 files changed, global graft answers 0.21.1.
- BeWhole, `GRAFT_STRUCTURED=1 graft build .`: 1,772 nodes, 3,024 edges. New edges:
  54 function to key, 40 module body to key, 22 CI step or script to script key,
  20 script key to file, 4 class to rule, 2 Markdown links. Samples read by hand:
  all correct. `graft ask "upload body limit" --source` (with the env twin) returns
  `package.json:L24-L24`, and line 24 is `"maxBodyBytes": 26214400`. `blast` on that
  line seeds `bewhole.upload.maxBodyBytes` and reports `readUploadBody`, three test
  files and `scripts/config.ts` at depth 1, the `admin:test` script at depth 2.
- This repository, same flag: 3,430 nodes, 8,742 edges; README contents links, viewer
  classes to `viewer/style.css`, CI steps and `package.json` scripts all resolve. The
  audit found two precision gaps (a `#key:a.b` id read as a key, a stale anchor in a
  code string falling back to the file); fixed in `c8cf178`.
- Both graphs rebuilt code-only afterwards; BeWhole's `git status` (5 files modified by
  other work) identical before and after; no `.graft/config.json` written.
- Python edits through a bash heredoc mangle backslashes here (seen again this stage);
  use the Edit tool for regex-bearing source.

## Work completed

Branch `stage-3/edges` on `main`, one commit per item, each gated:

- `e701794` code to key  `dabf02d` Markdown links, code strings naming a heading
- `156bfe4` HTML `src`/`href` and class to rule  `0055874` commands to scripts and files
- `3192222` deep pass bound, concept pass reads structured files
- `20753c4` blast walks from containing keys and sections
- `c8cf178` precision fix from the real-data audit  `cf486d2` README and CHANGELOG

## Unresolved questions

- Whether key and section seeds should count as behavioural in `blast`'s test signal.
  Default no, kept. Operator.
- Code to key covers TypeScript, JavaScript and Python. Go, Java (Spring
  `@Value("${a.b}")`), Kotlin and PHP join by adding node types to the two tables in
  `code-refs.ts`. A later stage or the operator.
- Not built: TSX `className` to rule, `getElementById("x")` to element, plain file-path
  strings in code (`readFileSync("docs/x.md")`). Plan table rows, not in this stage's goal.
- Upstream's README contents link `#monorepos--multi-repo-folders` is broken (the heading
  now reads "Monorepos, submodules & multi-repo folders"). Maintainer.
- Viewer colours for the structured kinds (cosmetic).

## Exact next action

Operator: review `git log upstream/main..pr/structured-edges --stat` (stacked on
`pr/structured-tier-markup-build`), push after the two earlier branches, then start
Stage 4 from `docs/handoffs/2026-10-13-stage-4-documents.md` (Opus 5.5 at high).

## Cost projection

Projected $6 to $12. Actual, estimated: about 150 turns, context rising to 410k
(average about 230k): cache 150 x 230k = 34.5M x $0.20 = $6.90; fresh 150 x 3k = 450k
x $5.00 = $2.25; output 150 x 2.5k = 375k x $20 = $7.50; about $16.70 at list price.
Over the quote because eight gates of about 5 minutes each kept the context growing,
and the real-data audit added a fix commit. The plan account reports percentages only.

## Time projection

Projected 60 to 120 minutes. Actual about 95 minutes wall clock (06:04 to about
07:40 UTC), eight gates. Operator review: about 35 minutes, mostly
`resolve-structured.ts`, `commands.ts` and the `blast.ts` change.
