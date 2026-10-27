Your installed Graft is **0.21.1**. It currently builds a code-oriented graph rather than a general repository knowledge graph. Unsupported file types are skipped instead of indexed as plain text. This matches the current [Graft package documentation](https://www.npmjs.com/package/@nanonets/graft) and the installed parser registry.

## Files Graft Indexes

The structural pass supports **43 extensions**, plus case-insensitive matching where applicable.

| Fidelity | Languages and extensions |
| --- | --- |
| Full, scope-aware | TypeScript/JavaScript: `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs` |
| Full, scope-aware | Python: `.py`, `.pyi` |
| Full, scope-aware | Go `.go`; Java `.java`; Kotlin `.kt`, `.kts`; Swift `.swift`; PHP `.php`; R `.r`/`.R` |
| Broad tree-sitter | Rust `.rs`; C `.c`, `.h`; C++ `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hh` |
| Broad tree-sitter | Ruby `.rb`; C# `.cs`; Scala `.scala`, `.sc`; Elixir `.ex`, `.exs`; Solidity `.sol` |
| Broad tree-sitter | OCaml `.ml`, `.mli`; Zig `.zig`; Dart `.dart`; Nix `.nix`; Lua `.lua` |
| Broad tree-sitter | Clojure `.clj`, `.cljs`, `.cljc`, `.bb` |
| Embedded container | Vue `.vue`, extracting TypeScript/JavaScript from `<script>` blocks |

Full extractors understand scopes, bindings, imports, definitions, and more cross-file references. Broad extractors primarily produce signatures, symbols, and conservative name-resolved calls.

Optional `--lsp` enrichment supports:

- TypeScript/JavaScript through `typescript-language-server`
- Python through Pyright
- Go through `gopls`
- Rust through `rust-analyzer`
- C/C++ through `clangd`

Vue is currently the only embedded-language container. The installed source explicitly says Svelte and Astro are contemplated but not yet enabled.

## Which Files Are Selected

Graft normally processes files that are:

- Tracked by Git, including tracked files that subsequently match an ignore rule.
- Untracked but not Git-ignored.
- Smaller than 1 MB.
- In a supported language.
- Outside `graft/` itself.
- Inside any active `--only-dir` scope.

It skips these directories by default:

```text
node_modules
dist
build
_build
out
target
vendor
coverage
__pycache__
venv
```

Every dot-prefixed directory is skipped wholesale, including `.github`, `.vscode`, and arbitrary project-specific dot directories. Dot directories cannot currently be restored with `--include-dir`. Named directories such as `build` can be restored explicitly.

Submodules and nested Git repositories are excluded unless `--follow-submodules` or `--follow-nested-repos` is enabled. Internal directory symlinks are not followed.

## What the Structural Graph Contains

For every supported source file, Graft creates:

- A file node.
- Nodes for functions, methods, classes, interfaces, types, enums, constants, and other language-specific definitions.
- Exact source spans.
- Signatures.
- Content hashes.
- Containment edges.
- Import edges.
- Resolved and inferred call edges.
- Inheritance and implementation relationships where extraction supports them.

The structural graph is written to:

```text
graft/.graph/wiring.json
```

Human-readable per-file cards mirror the source tree under `graft/`, with `graft/INDEX.md` as the entry point.

## What `--deep` Adds

The deep pass has two related layers.

First, it enriches structural symbols with:

- A one-line semantic summary.
- A source-derived crux excerpt containing the important implementation lines.
- A state indicating whether meaning is ready, stale, pending, or failed.

These are cached by symbol body hash inside `wiring.json`. An unchanged function does not need to be summarized again.

Second, it summarizes whole files and synthesizes higher-level concept nodes such as systems, subsystems, design decisions, and cross-cutting invariants. Those become top-level Markdown files under `graft/`.

Deep concept links use this controlled vocabulary:

- `part_of`
- `uses`
- `depends_on`
- `produces`
- `configures`
- `validates`
- `implements`

Structural relations additionally include `contains`, `calls`, `imports`, `extends`, and optional `lsp_resolved` calls.

The default whole-file deep pass recognizes this somewhat older, separate extension list:

```text
.ts .tsx .js .jsx .mjs .cjs
.py .go .rs .java .kt .scala
.rb .php .c .h .cpp .hpp .cc
.cs .swift .sql .sh .proto
```

That means SQL, shell scripts, and Protobuf can receive whole-file LLM summaries and participate in concept synthesis, even though they currently lack structural parsers. They do not receive the same symbol/call graph treatment.

## What Graft Caches and Creates

A structural build creates:

```text
graft/INDEX.md
graft/<source-tree>/<file>.md
graft/.graph/wiring.json
graft/.cache/extract.<extractor-id>.json
graft/.cache/fingerprint.<extractor-id>.json
graft/.cache/ask-index.json
graft/.cache/stats.json
graft/.cache/session/*.json
```

A deep build additionally creates or populates:

```text
graft/<concept-slug>.md
graft/manifest.json
graft/.cache/summaries.json
```

`summary` and `crux` fields are also added to nodes in `wiring.json`.

The caches serve distinct purposes:

- `extract.*.json`: parsed symbols and raw structural edges by file hash.
- `fingerprint.*.json`: file size, modification time, hash, and active scope.
- `ask-index.json`: tokenized search index so queries do not repeatedly tokenize the graph.
- `summaries.json`: whole-file summaries and concept-synthesis batches by content hash.
- `wiring.json`: structural graph and reusable per-symbol semantic enrichment.
- `manifest.json`: deep concept-node inventory and file provenance.
- Markdown cards: compact agent-facing projections designed to replace expensive source reads.

## This Repository Right Now

The current graph indexes only the repository’s Python source:

- **22 `.py` files**
- **144 nodes**
- **415 edges**
- 151 `calls`
- 139 `imports`
- 122 `contains`
- 3 `extends`

It currently has:

- **0 nodes with semantic summaries**
- **0 nodes with crux excerpts**
- No top-level concept nodes
- No deep semantic links

So this repository has had a structural build, but no successful deep pass on the current graph.

Most of the actual book is presently invisible to Graft: Markdown manuscripts, research CSVs, JSON records, PDFs, Word documents, images, and typography assets are not represented in its graph.

## Best Additional File Types

For this repository, the biggest token-saving opportunity would be **structured Markdown support**.

A Markdown extractor could create nodes for books, parts, chapters, sections, tables, claims, references, figures, and appendices. It could link:

- Contents entries to headings.
- Claims to citations.
- Chapters to bibliography records.
- Editorial briefs to manuscript sections.
- Production documentation to generated outputs.
- Cross-references to their targets.

That would let an agent retrieve a 200-token chapter card or one relevant section instead of opening a very large manuscript.

The next most valuable additions are:

1. **CSV and TSV**

   Parse headers, schemas, identifiers, row counts, foreign-key-like columns, and selected representative records. This would make citation registers and research manifests searchable without inserting entire datasets into context.

2. **JSON, JSONL, YAML, and TOML**

   Create nodes for configuration sections, manifests, scripts, dependencies, named records, and schema-bearing objects. Large arrays should be summarized rather than copied.

3. **SQL and migrations**

   SQL already participates in whole-file deep summaries, but a structural parser could create tables, columns, views, procedures, queries, and data-lineage edges.

4. **OpenAPI, GraphQL, Protobuf, Avro, and JSON Schema**

   These should produce service, endpoint, operation, message, and data-contract nodes, with `implements`, `uses`, and `produces` links into application code.

5. **Build and deployment files**

   Dockerfiles, Compose, Makefiles, CMake, Gradle, Bazel/Starlark, Terraform/HCL, Helm, GitHub Actions, and PowerShell would expose how source becomes artifacts and how environments are configured.

6. **Svelte, Astro, HTML, CSS, SCSS, and templates**

   Svelte and Astro are especially natural extensions of the existing Vue container mechanism. HTML/template and CSS graphs could connect components, templates, selectors, assets, and routes.

7. **Jupyter notebooks**

   Index Markdown headings, code-cell definitions, imports, and cell dependencies while omitting bulky outputs. Notebook outputs should be hashed and described, not placed directly into retrieval context.

8. **PDF and DOCX documents**

   Extract headings, page/section boundaries, tables, citations, footnotes, and internal links. Keep source-page pointers so retrieval returns exact passages. Avoid treating raw binaries as text.

9. **Images, diagrams, fonts, and media metadata**

   Index filenames, dimensions, checksums, captions, alt text, embedded metadata, and references from source files. Semantic image descriptions should be opt-in and content-hash cached.

The strongest design would use format-specific parsers, bounded searchable bodies, exact provenance, and compact semantic nodes. A generic “send every text file to the model” fallback would consume more tokens during indexing and create a noisy graph. For this book repository, Markdown, CSV, JSON, and PDF/DOCX structure would deliver the largest practical reduction in repeated source reads.

