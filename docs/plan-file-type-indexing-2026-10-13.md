# Plan: indexing structured text and documents in graft

Written 2026-10-13 by the Fable 5.1 session that synced this fork to
0.21.1 (Stage 0). The question: which of the file types graft skips today
are worth indexing, how to add them with the least code and the most
reuse of what graft already has, and how to package the result for
upstream. Decisions for the operator are in section 6; everything else is
settled here.

## 1. Conclusion

**Index the structured text, make binary documents opt-in, never index
images or secrets as content.** Of the operator's skipped list, Markdown,
YAML, JSON, HTML, XML, Gradle, CSS, shell and the plist family all earn a
place; PNG files do not; `.pem` files must be denylisted. PDF, DOCX, ODT,
EPUB, PPTX and ODP earn a place behind an opt-in flag, through a cached
text rendering so graft's exact-span promise survives.

The cheap lever is already installed: `tree-sitter-wasm` ships 103
WebAssembly grammars, and graft's breadth tier (`src/graph/generic.ts`)
loads any of them by name. JSON, YAML, HTML, CSS, SCSS, XML, Bash,
PowerShell, Dockerfile, Make, CMake, Groovy and INI are all there. Two
are not: block-level Markdown (only `markdown_inline` ships) and TOML. Both
are line-structured enough for a short hand-written scanner, which is also
the cheaper path for exact line spans (section 6, D2).

Six stages, about 30 to 55 dollars of API spend at list price and five
to eight hours of agent time, delivered as six upstream pull-request
branches cut from `upstream/main`. Stage 0 is done: the fork is at
0.21.1, the one hand patch is now a source fix with a test, and
`scripts/sync-global.mjs` makes the global install a copy of this tree.

## 2. What graft is, in the terms this plan uses

Measured in the fork at v0.21.1 (`375a37e`), 2026-10-13.

- **Three parse tiers**, all deterministic and keyless, dispatched per
  file in `src/graph/build.ts`: depth (hand-written extractors, native
  grammars: TS/JS, Python, Go, Java, Kotlin, Swift, PHP, R), container
  (`.vue`: a wrapper grammar locates the embedded script, the depth tier
  parses it, spans are shifted back to the host file), breadth (a generic
  `tags.scm` query over a WebAssembly grammar: 16 languages).
- **A node** (`NodeV1`, `src/graph/types.ts`) is `id`, `name`, `kind`
  (file, class, function, method, interface, type, enum, struct, trait,
  module, constant, variable), `path`, `span` (`L10-L42`), `signature`,
  `origin`, `body_hash`, optional `body_text` (capped, searchable, never
  emitted). Edges are `contains`, `calls`, `imports`, `references` with
  a confidence.
- **Retrieval** (`src/ask/ask.ts`) is lexical, BM25-style term overlap
  over concept prose and symbol name, signature, summary and `body_text`;
  `--source` prints the span verbatim from the file. `graft grep` runs a
  regex over indexed files and groups hits by enclosing symbol. `graft
  skeleton` lists a file's symbols with spans. Cards (`src/graph/cards.ts`)
  are one Markdown file per source file.
- **File selection** (`src/graph/source-files.ts`, `src/ingest/fs.ts`):
  git-visible files under 1 MB whose extension a tier claims; skip dirs
  and dot-dirs; `--extensions`, `--include-dir`, `--only-dir` on the CLI.
- **The deep pass** (`--deep`, `src/context/build.ts`) summarises files
  whose extension is in `CODE_EXTENSIONS` and synthesises concept nodes;
  the crux pass (`src/ai/crux.ts`) summarises symbols. Both cached by hash.
- **Tests**: 126 files under `test/`, `node --test` through `tsx`,
  1,329 tests, about 7 minutes here. CI: Node 20 on Ubuntu and Windows.

## 3. Which file types, and why

The rule: index a type when a deterministic parser yields addressable
units with an exact locator, and either agents read those files whole
today or edges to code can be derived from them. Never index secrets,
and never pass a binary to a text parser.

| Family | Operator's count | Verdict | Units (new kinds in bold) | Edges worth deriving | Parser |
|---|---|---|---|---|---|
| Markdown, MDX | 79 | Yes, first | **section** per heading (nested), fenced code via the container tier, front matter keys | link → file or section (`references`); fence → the embedded language's symbols | hand scanner (D2) |
| YAML | 46 | Yes, first | **key** per path (`jobs.verify.steps[3]`), documents in multi-doc files; workflow jobs and steps named | `run: npm run x` → package.json script key; `uses:` → action name | wasm `yaml` |
| JSON, JSONC, JSONL | 46 | Yes, first | **key** per path to a bounded depth; package.json scripts, dependencies, config blocks; JSONL header only | code string literal `config.a.b` → key (`references`) | wasm `json` |
| TOML, INI, .properties, .editorconfig | in the plist row | Yes, first | **key** per table and key | same as JSON | hand scanner (TOML), wasm `ini` |
| HTML, templates (Svelte, Astro) | 23 | Yes, second | **element** with `id` or `name`, `<script>` and `<style>` via the container tier, `<template>` ids | `src`/`href` → file (`imports`); `getElementById("x")` → element; class → CSS selector | wasm `html`, `svelte`, `astro` |
| CSS, SCSS | 3 | Yes, second | **selector** per rule, custom property, `@mixin` | class usage in HTML/TSX → selector | wasm `css`, `scss` |
| XML: Android manifest and layouts, pom, plist, storyboard, entitlements | 11 plus about 10 | Yes, second | **element** with `android:id`, `name`, `key`; plist keys as **key**; storyboard scene and view ids only (never the whole tree) | `R.id.x` → layout element; plist key → Swift `Bundle` reads | wasm `xml` |
| Gradle (Groovy), build.gradle.kts | 7 | Yes, second | **task** per task block, plugin and dependency entries as **key** | none in v1 | wasm `groovy`; `.kts` is already depth-tier Kotlin |
| Shell, PowerShell | 3 | Yes, second | function per definition (existing kind), **task** none | `node scripts/x.mjs` → file (`references`) | wasm `bash`, `powershell` |
| Dockerfile, Makefile, CMake | not listed | Yes, second | **task** per target or stage | `COPY`/`RUN node x` → file | wasm `dockerfile`, `make`, `cmake` |
| PDF, DOCX, ODT, EPUB, PPTX, ODP | not listed | Yes, opt-in | **section** per heading, page or slide, into a cached text rendering | citations and links → file or section where present | converters (D4) |
| PNG, JPG, SVG, fonts | 31 | Not as content | at most an asset node (dimensions, references from code), deferred (D6) | code → asset | none |
| `.pem`, `.key`, `.env`, lockfiles, minified bundles | about 10 | Never | denylist by name and extension in `source-files.ts`; a test pins it | none | none |

Why Markdown first: it is the largest skipped set in every repository on
this machine, it holds the agents' own instruction files (`AGENTS.md`,
handoffs, plans), and a 200-token section card replaces reading a
500-line document. Why configuration next: config keys are the thing
code reads by string, so `references` edges from code to keys answer
"who uses this setting" at $0. Why markup third: value is real but
narrower (front-end repositories). Why documents last and opt-in: they
need converters, their value is repository-specific, and they are the
only tier whose locator is not a line in the file itself.

## 4. How: the least code that fits the architecture

**A fourth tier, "structured", beside depth, container and breadth.**
`src/graph/structured/` holds one small module per family, each
exporting `extract(rel, source): ExtractResult` and registered in a
`STRUCTURED_LANGS` table (`exts`, `family`, optional wasm grammar). The
dispatch in `build.ts` gains one branch after container; `listSourceFiles`
and `supportedExtensions` include the table; `languageLabelOf` labels
it. The extraction cache, cards, skeleton, grep and ask need no change
for the units to appear: a section is a node with a span and
`body_text`, exactly like a function.

- **Kinds.** Add `section`, `key`, `element`, `selector`, `task` to the
  `Kind` union. The 24 sites that consume `Kind` are label tables and
  render switches; Stage 1 audits each and extends the exhaustive ones.
- **Spans.** Structured nodes carry `L<start>-L<end>` in the host file,
  so `--source` works unchanged. Fenced code in Markdown and `<script>`
  in HTML reuse `container.ts`'s span-shift, which is already pinned by
  `test/container-extract.test.ts`.
- **Ids.** `path#section:heading-slug` (deduplicated like symbols),
  `path#key:a.b.c`, `path#element:id`, `path#selector:.btn`, `path#task:build`.
- **Body text.** Sections carry their text to the existing cap; keys
  carry their scalar value (never for a name that looks like a secret:
  `token`, `secret`, `password`, `key` with a long opaque value, which
  is the same test the denylist uses).
- **Edges (Stage 3).** A resolver pass over the finished node set:
  string literals in code that equal a key path or a Markdown anchor
  become `references` edges with `inferred` confidence; Markdown links
  become `references` to the file or section node; HTML `src` and
  `href` become `imports`. No LLM.
- **Deep pass (Stage 3).** `CODE_EXTENSIONS` becomes "extensions a tier
  claims" so `--deep` can summarise structured files, bounded to their
  first N sections; documents stay out of `--deep` unless
  `--deep-documents` is given (cost).
- **Documents (Stage 4).** A converter maps a binary to a deterministic
  text rendering stored at `graft/.graph/docs/<content-hash>.txt`, with
  one marker line per page or slide. The Markdown scanner then indexes
  the rendering as if it were a file, so every section has a line span
  into the rendering, and `--source` prints from it. The locator shown to
  the agent is `manuscript.docx (page 12) → .graph/docs/<hash>.txt:L340-L372`.
  Converters: PDF through `pdfjs-dist` (pure JS); DOCX, ODT, EPUB, PPTX
  and ODP are zip archives of XML, read with `fflate` and the bundled XML
  grammar, headings from paragraph styles and `<h1>` to `<h6>`. All
  optional dependencies, imported lazily, with a refusal naming the
  package to install. Their own size cap (`GRAFT_DOCUMENT_MAX_BYTES`,
  default 25 MB) because PDFs exceed the 1 MB source cap.
- **CLI and config.** `graft build --structured` on by default once
  shipped, `--no-structured` to disable; `--documents` opt-in;
  `--extensions` keeps working for any listed extension. Every flag has
  an env twin in the pattern of `GRAFT_NO_REFRESH`.

What is deliberately not built: embeddings or a vector index (the
lexical rank already finds section text), image understanding, a
generic "send every text file to the model" fallback (noisy, costly),
and a new locator grammar through every consumer (D3).

## 5. Stages

One commit series and one upstream branch per stage; the gate is
`npm run build && npm test` on this machine, counts quoted, plus
`node scripts/sync-global.mjs` and a `graft build` of this fork and of
BeWhole to see the new nodes appear. Projections use the protocol's
section 6 method with the prices in its section 2.

| Stage | Model, effort | Scope | Branch for upstream | Cost (list) | Agent time |
|---|---|---|---|---|---|
| 0 | Fable 5.1, high | Done 2026-10-13: fork to 0.21.1, crux fix in source with a failing-first test, sync script, protocol seeded, this plan | `pr/crux-id-echo` | about $12 spent | 70 min |
| 1 | Sonnet 5.5, high | The structured tier: table, dispatch, kinds, Markdown and TOML scanners, JSON, YAML, INI through wasm; cards, skeleton, grep, ask verified; README table, CHANGELOG | `pr/structured-tier-core` | 100 turns, 100k context: cache $2.0, fresh $0.8, output $1.5; quote $4 to $8 | 90 to 150 min |
| 2 | Sonnet 5.5, medium | Markup and build families: HTML, Svelte, Astro, CSS, SCSS, XML with the Android, pom and plist rules, Groovy, Bash, PowerShell, Dockerfile, Make, CMake; the denylist | `pr/structured-tier-markup-build` | 60 turns: quote $2 to $5 | 60 to 100 min |
| 3 | Opus 5.5, high | Cross-type edges (code to key, link to section, html to css and js), deep pass over structured files, `blast` aware of key edges | `pr/structured-edges` | 80 turns: cache $1.4, fresh $1.2, output $2.4; quote $5 to $9 | 60 to 120 min |
| 4 | Opus 5.5, high | Documents tier: converters, rendering cache, locators, size cap, opt-in flags, Windows paths | `pr/documents-tier` | 120 turns, 110k: cache $2.6, fresh $1.8, output $3.6; quote $7 to $12 | 2 to 3 h |
| 5 | Haiku 5.5, medium | README, CHANGELOG "Unreleased", CREDITS, the upstream pull-request texts, `git log upstream/main..pr/*` audits | all five branches | quote $0.20 to $0.50 | 30 to 45 min |
| 6 | Fable 5.1, high | Adversarial acceptance of Stages 1 to 5: span exactness on fixtures with known lines, Windows paths, a 50 MB PDF, a 10,000-key JSON, secrets in config, a Markdown file with every CommonMark heading form | none | quote $10 to $20 | 60 to 120 min |

Totals: about $30 to $55 of API spend and five to eight hours of agent
time, plus the operator's review (about 20 minutes a stage) and the
upstream review cycle, which this plan cannot schedule.

Order and parallelism: 1 then 2 then 3 are serial (each builds on the
tier the previous one shipped). Stage 4 depends only on Stage 1 and can
run beside Stage 3 in a second worktree if the operator wants the wall
clock shorter; the two touch different files (`structured/documents/`
against the resolver), and the gate has no fixed ports here. Stage 5
after 4; Stage 6 last.

Stage 1 is specified in `docs/handoffs/2026-10-13-stage-1-structured-tier-core.md`.

## 6. Decisions for the operator

```
D1  Decision:      is the structured tier on by default once shipped
    Options:       A on by default, --no-structured to disable
                   B opt-in with --structured
    Pros and cons: A every repo gains section and key nodes at $0 and about
                     20 percent more nodes; a bad scanner is visible to everyone
                   B nobody sees it unless asked; upstream may prefer this for
                     the first release
    Blast radius:  node counts, card counts and ask ranking in every repo
    Recommended:   A for Markdown, JSON, YAML, TOML and INI; the first upstream
                   PR can ship it as B and flip to A a release later if the
                   maintainers ask

D2  Decision:      how Markdown and TOML are parsed
    Options:       A hand-written line scanners (headings, fences, links,
                     front matter; TOML tables and keys)
                   B add tree-sitter-markdown (block) and tree-sitter-toml
                     wasm builds to tree-sitter-wasm upstream first
    Pros and cons: A no dependency change, exact lines, 200 to 300 lines each,
                     covers what the nodes need and nothing else
                   B full grammars, but a second upstream dependency to land
                     first and heavier parsing for units that are line-shaped
    Blast radius:  A none outside the new modules; B tree-sitter-wasm's release
    Recommended:   A; revisit B only if acceptance finds heading forms the
                   scanner mis-spans

D3  Decision:      how a document locator is expressed
    Options:       A a cached text rendering with line spans and page markers;
                     the span contract is untouched
                   B a new locator grammar (page, slide, heading path) carried
                     through nodes, cards, ask, grep, blast and the viewer
    Pros and cons: A one new cache directory, every consumer works unchanged,
                     the agent reads the rendering not the binary
                   B purer, but touches every consumer and the viewer, and
                     --source cannot print a page of a PDF anyway
    Blast radius:  A the cache dir; B every surface
    Recommended:   A

D4  Decision:      document converter dependencies
    Options:       A optionalDependencies, lazy import, a refusal naming the
                     package (pdfjs-dist, fflate; own OOXML, ODF, EPUB readers)
                   B hard dependencies
                   C shell out to pandoc or similar when installed
    Pros and cons: A install stays small, the tier is opt-in anyway; B adds
                     megabytes for every user; C exact but not reproducible
                     across machines and absent on CI
    Blast radius:  A none for users who never pass --documents
    Recommended:   A

D5  Decision:      how to approach upstream
    Options:       A open a design issue first (this plan's sections 3 and 4,
                     condensed), then the pull requests
                   B pull requests only
    Pros and cons: A one round trip before code, far less rework if the
                     maintainers want a different shape; B faster to the
                     first review, higher rejection risk on a 56-open-PR repo
    Blast radius:  schedule only
    Recommended:   A; the operator opens the issue after Stage 1 lands locally,
                   so the issue can point at a working branch

D6  Decision:      an assets tier (images, fonts) in this plan
    Options:       A defer; B metadata nodes in Stage 2
    Pros and cons: A keeps Stage 2 bounded; B answers "where is this image used"
                     but the orphan question is already answered by grep
    Blast radius:  none
    Recommended:   A
```

Assumptions taken until the operator answers: D1 A (shipped as B in the
first PR), D2 A, D3 A, D4 A, D5 A, D6 A. Stage 1 depends only on D1 and
D2 and proceeds on those assumptions.

## 7. Verified facts (this session, 2026-10-13)

- Global install: `@nanonets/graft@0.21.1` under `C:\nvm4w\nodejs` (Node
  26.7.0). Content diff against the pristine npm tarball: one file,
  `dist/ai/crux.js` (the GRAFT-CRUX-ID-PATCH). Nested packages differ from
  the fork lockfile only by semver drift (openai 6.49.0 against 6.45.0 and
  six others); no hand edits there.
- Fork: was 0.18.0 with no commits of its own; fast-forwarded to v0.21.1
  (`375a37e`). `npm ci` fails on `tree-sitter-kotlin` under Visual Studio
  18; `npm ci --ignore-scripts` plus the global Kotlin binary loads every
  grammar. `npm run build` exit 0. Baseline `npm test`: 1,329 tests,
  1,323 pass, 1 fail (the new failing-first crux test), 5 skipped.
- Fork build against the global `dist/`: 4 of 611 files differ
  (`ai/crux.js` and its map, `telemetry/key.js` and its map; the key is
  stamped only at publish).
- `tree-sitter-wasm@1.1.8` ships 103 grammars including json, yaml, html,
  css, scss, xml, bash, powershell, dockerfile, make, cmake, groovy, ini,
  svelte, astro, csv, latex, bibtex, typst, graphql, proto; not
  block-level markdown, not toml.
- Upstream: 117 open issues, 56 open PRs; none about indexing non-code
  files (searched 2026-10-13). One closed, unmerged PR added Terraform.
  Release cadence: six releases between 2026-08-24 and 2026-09-29.
