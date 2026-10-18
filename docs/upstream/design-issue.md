# Design issue: index structured text and opt-in documents

> Operator note (not part of the issue text). Open this before the pull requests (plan decision D5 A). Paste from the line below the rule. Open question 1 (the default setting) is still open. The install footprint (open question 4) is decided as option A, so the issue states it as the proposal and still asks maintainers for their view.

---

**Title:** Index structured text (Markdown, configuration, markup and build files) and opt-in documents

graft indexes code through three tiers today: a depth tier with hand-written extractors, a container tier for `.vue` files, and a breadth tier that loads WebAssembly grammars. Text files that agents read whole, such as the Markdown instruction files, JSON and YAML configuration, HTML templates, stylesheets, Android and Maven XML, Gradle and shell scripts, produce no nodes. We propose a fourth tier, `structured`, that gives each of them one node per addressable unit, with an exact line span, behind `graft build --structured`. A later, separate option would index binary documents (PDF, DOCX, ODT, EPUB, PPTX, ODP) through a cached text rendering.

We would like the shape agreed before we open the code pull requests. The CLI keeps the `graft` name and every graft command; release 0.23.0 also ships it as `trail`, which has a new layout (`.trail/cache/`). This proposal is for the graft tier set.

### What we propose

- **A tier beside depth, container and breadth.** One module per family under `src/graph/structured/`, each exporting `extract(rel, source)`, registered in one table that names its extensions and, where one exists, its WebAssembly grammar. Dispatch gains one branch after the container tier. The extraction cache, cards, skeleton, grep and ask do not change: a section or key is an ordinary node with a span and searchable body text.
- **Five new kinds:** `section`, `key`, `element`, `selector` and `task`.
- **Units per family.** Markdown: a section per heading, fenced code in a language graft already indexes, front matter keys. JSON, JSONC, JSONL, YAML, TOML and INI: a key per dotted path. HTML, Svelte and Astro: elements with an `id` or `name`, the symbols of `<script>` and the rules of `<style>`. CSS and SCSS: rules, custom properties and Sass variables. XML: Android ids and names, Maven coordinates, property list keys, storyboard scenes. Gradle: tasks, plugins and dependencies. Makefile and CMake: targets. Dockerfile: stages. Bash and PowerShell: functions.
- **Exact spans.** Every node carries `L<start>-L<end>` in the file itself, so `--source` prints the lines verbatim. Each family has a fixture test with known line numbers.
- **No network, no model, no new grammar dependency for the common path.** JSON, YAML, INI, HTML, CSS, XML, Gradle, Bash, PowerShell, Dockerfile, Make and CMake use grammars that `tree-sitter-wasm` already ships. Markdown and TOML use short hand-written line scanners, because that tool has no block-level Markdown or TOML grammar.
- **Secrets stay out.** Key material (`.pem`, `.key` and similar), `.env` files, lockfiles and minified assets are never indexed; a denylist pins this in a test. A key whose name suggests a credential, or whose value is a long opaque string, has no value in its signature or search text.
- **Bounds.** Keys go four levels deep, at most 500 per file, shallowest first.
- **Edges, deterministic.** A string literal or member chain in code that spells a key path references the key (`inferred`). Markdown links reference the section or file they name. HTML `src` and stylesheet `href` import the file, and a `class` references the rule. Commands such as `npm run x` in workflows, scripts, Dockerfiles and Makefiles reference the script key or the file. Ambiguous matches produce no edge. `blast` walks these edges, and `--deep` summarises the first 40 units of each structured file.
- **Documents, opt-in.** `graft build --structured --documents` converts each PDF, DOCX, ODT, EPUB, PPTX or ODP once into a deterministic text rendering at `graft/.graph/docs/<sha256>.txt`, with a marker line per page, slide or chapter, and indexes that rendering with the Markdown scanner. Every span is a line range of the rendering, so `ask --source` prints it. Page numbers come only from what the file records. The converters are optional dependencies, loaded lazily; a missing one is named in the refusal.

### What we deliberately leave out

Embeddings or a vector index (lexical ranking already finds section text), image understanding, an assets tier, sending every text file to a model, and a new locator grammar that every consumer would need to learn.

### Open questions for maintainers

1. **Default.** We propose opt-in first (`--structured`), with a later release that makes it the default if you agree. The Markdown and configuration units are cheap to index, so the question is about surprise, not cost.
2. **Parsers.** Hand-written scanners for Markdown and TOML, rather than adding block Markdown and TOML grammars to `tree-sitter-wasm` first. We would switch if acceptance finds heading forms the scanner mis-spans.
3. **Document locators.** A text rendering with line spans, rather than a locator grammar for pages and slides. The binary's own path stays on the node, so ids, cards and `--only-dir` behave as they do today.
4. **Converter installation.** We propose declaring `pdfjs-dist` and `fflate` as `optionalDependencies`, so npm installs them by default and `--documents` works without a further step. On Windows that adds about 79 MB (`pdfjs-dist` 41 MB, its canvas package 37 MB, `fflate` 0.8 MB). The alternatives are optional peer dependencies, or no packages with a refusal that names what to install. We would value your view on that trade-off.

### Shape of the pull requests

Four stacked pull requests, each opened against the one before it: the structured core, then markup and build files, then edges, then documents. The core is based on `upstream/main`, which is release 0.23.0, and the branches will be rebased onto 0.23.0 before they are opened. A separate fix to the crux pass (issue #542), which does not depend on any of them, goes in its own pull request. Each stacked pull request adds its changelog entry and README lines in the same commit as the feature, and each is checked with `npm run build && npm test`, which upstream CI runs on Node 20.
