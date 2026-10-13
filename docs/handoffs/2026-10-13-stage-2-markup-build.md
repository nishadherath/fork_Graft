---
stage: "Stage 2: markup and build families, HTML, CSS, XML, Groovy, shell, Dockerfile, Make, CMake, and the denylist"
model: claude-sonnet-5-5
effort: medium
status: ready
created: 2026-10-13
from: "Sonnet 5.5 Stage 1 session (structured tier core), 2026-10-13"
---

# Stage 2: markup and build families

First confirm your own model and effort match the front matter (session tool,
`self`); if not, stop and say which to pick. Read `AGENTS.md`,
`docs/operator-protocol.md` (section 10), the plan's sections 3 and 4, and the
Stage 1 handoff (`2026-10-13-stage-1-structured-tier-core.md`), then this.

## Goal

Extend the structured tier to the plan's "second" rows: HTML, Svelte and Astro
(an `element` per node with an `id` or `name`; `<script>` and `<style>` through
`extractEmbedded`), CSS and SCSS (a `selector` per rule, custom properties,
`@mixin`), XML (Android manifest and layouts by `android:id`, pom, plist keys as
`key`), Groovy `build.gradle` (a `task` per block), Bash and PowerShell (functions
in the existing kind), Dockerfile, Make and CMake (a `task` per target or stage).
Plus first, the operator's decided dot-directory item (Decision D7 below).
Done: each family has a failing-first span test in the fixture style, the README
table has its rows, CHANGELOG has an entry, the denylist (`.pem`, `.key`, minified
bundles; lockfiles exist already) is pinned by a test, the gate is green with
counts quoted, `sync-global` has run, and the branch `pr/structured-tier-markup-build`
is cut from `upstream/main` (or from `pr/structured-tier-core` if that has not
merged; say which).

## Decisions already made

- D1 to D6 in the plan's section 6 stand. The tier stays opt-in behind `--structured`.
- Registry rows in `src/graph/structured/index.ts` (`STRUCTURED_LANGS`), one
  extractor module per family, wasm grammars through `loadWasmLanguage` and
  `parseWasm`; a family that needs another grammar names it in `ALSO_NEEDS`.
- New kinds `element`, `selector`, `task` go on `Kind` (`src/graph/types.ts`) and
  in `invariants.ts`; audit as Stage 1 did (only `invariants.ts` is exhaustive).
- Reuse `emitKeys`, `isSecret`, `endRowOf`, `splitLines`, `spanOf` from
  `structured/shared.ts`. `emitKeys` is for key paths; elements, selectors and tasks
  need their own small emitter that applies a size cap with a named constant.
- Spans are host-file lines. Embedded `<script>` and `<style>` use
  `extractEmbedded` from `container.ts` and keep only `contains` edges.
- D7 C, decided 2026-10-13 by the operator: with the structured tier on, the walker
  admits files under `.github/workflows/` (YAML only, by the registry) despite its
  dot-directory rule. Nothing else changes: `.editorconfig`, `.github/` outside
  `workflows/`, every other dot-path, `SKIP_DIRS` and Git's ignore rules behave as
  today, and with the tier off the file set is byte-identical to today. Shape: a
  named constant for the admitted prefixes beside `shouldSkipDir` in
  `src/ingest/fs.ts`, a `WalkOptions` field callers pass when `readStructured(root)`
  is true, wired into the callers of `walkDir` that enumerate source files
  (`graph/build.ts`, `graph/source-files.ts`; check `graph/scopes.ts` and
  `context/build.ts` and say why each does or does not need it). Build, probe and
  `check` must agree, as in `test/structured-tier.test.ts`. Raise it in the D5
  design issue when the operator opens it; do not wait for that.
- The structured tier's choice persists in `.graft/config.json`
  (`readStructured`); do not add a second switch.
- Prose conventions: Australian English, no em-dashes, no banned words.

## Files and links that matter

- `src/graph/structured/{index,shared,markdown,json,yaml,toml,ini}.ts`
- `src/graph/container.ts` (`extractEmbedded`), `src/graph/cards.ts` (card names)
- `test/structured-*.test.ts` for the fixture shape; `test/structured-surfaces.test.ts`
  for the skeleton, ask, grep and card checks to copy
- Grammars present in `node_modules/tree-sitter-wasm/out/`: html, svelte, astro, css,
  scss, xml, bash, powershell, dockerfile, make, cmake, groovy. Probe tree shapes
  before writing an extractor; `.mts` probe scripts are the quickest way.

## Verified facts

- Stage 1 gate: 1,397 tests, 1,392 pass, 0 fail, 5 skipped (2026-10-13).
- A registry match is a path suffix, so `Dockerfile` and `Makefile` (no extension)
  need basename rows; `structuredLangOf` currently matches `endsWith(ext)`.
- Dot-files and dot-directories are never walked (`src/ingest/fs.ts`).
- Python edits on this Windows machine write CRLF unless `newline=""` is passed to
  `open`; check with `git ls-files --eol -m` before committing.

## Work completed

Nothing yet in Stage 2.

## Unresolved questions

- Whether `.properties` and `.conf` belong in the INI family; the grammar reads `=`
  only. Probe first and record the outcome.

## Exact next action

Set `status: in-progress` here, then write `test/structured-dotpaths.test.ts` (D7):
a temp repo with `.github/workflows/ci.yml`, `.github/dependabot.yml` and `.editorconfig`;
with the tier on, `listSourceFiles` returns only the workflow, with it off it returns
none of them; build, `probeDrift` and `checkGraph` agree. Watch it fail before touching
`src/ingest/fs.ts`. Commit D7 with its gate, then start HTML with
`test/structured-markup.test.ts` (an element with an `id`, an inline `<script>`
defining a function, a `<style>` rule, true line numbers written in the fixture).

## Cost projection

Sonnet 5.5 at $2.00 in, $10.00 out, $0.20 cache read per million tokens, 60 turns,
average context 100k, 3k fresh input, 1.5k output: cache 6M x $0.20 = $1.20; fresh
180k x $2.50 = $0.45; output 90k x $10 = $0.90; about $2.55. The Stage 1 actual ran
about three times its quote, so quote $4 to $8 including D7.

## Time projection

75 to 115 minutes of agent time (D7 adds about 15) (the gate is about 6 minutes and runs once per
family at least). Operator review: about 25 minutes.
