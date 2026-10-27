# Pull request: PDF, Word, EPUB and slide documents behind `--documents` (base `pr/structured-edges`)

> Operator note (not part of the text). Branch `pr/documents-tier`, forty-one commits above `upstream/main`: the twenty-nine structured commits (the core, markup and edges branches) and twelve documents commits (`9bcca24` to `9cd4e9b`, with `8fbc8d5`). Set the base to `pr/structured-edges`.
>
> Three things must be settled before this is opened:
>
> 1. **Install footprint (decided: option A, 2026-10-13).** `pdfjs-dist` and `fflate` stay as `optionalDependencies`, so npm installs them by default, about 79 MB on Windows. The section headed "Install" below stands as written.
> 2. **Repository rule conflict.** AGENTS.md rule 3 lets a pull-request branch carry only `src/`, `test/`, `CHANGELOG.md`, `CREDITS.md` and `README.md`. This branch also changes `package.json` and `package-lock.json`, which the converters need. The operator must accept that exception, or the dependency declaration must move out of the branch, before the branch is handed over.
> 3. **Gate figure (settled in Stage 7).** The tip commit `9cd4e9b` records 1,537 tests, 1,532 pass, 0 fail, 5 skipped, from a fresh `npm ci --ignore-scripts` on Node 26.7.0 under cmd.exe. The 1,489 an earlier message quoted was the count before the lockfile was regenerated on a newer upstream base.

---

**Title:** feat(documents): PDF, DOCX, ODT, EPUB, PPTX and ODP through a cached text rendering, behind `--structured --documents`

**Summary**

`graft build --structured --documents` indexes PDF, Word, OpenDocument text, EPUB, PowerPoint and OpenDocument presentation files. Each document is converted once into a deterministic text rendering, which is stored in the repository's graft directory, and the Markdown scanner indexes that rendering. Every node therefore has a line span in the rendering, so `ask --source` and `grep` print the lines, and the agent can open the rendering in any editor.

Documents are opt-in on top of the structured tier. Nothing changes for a repository that does not pass `--documents`.

**How a document is indexed**

- Each document is converted once to `graft/.graph/docs/<sha256 of the file>.txt`. The name is the hash of the binary, so a changed file gets a new rendering and the old one is pruned.
- The rendering has a marker line for each page, slide or chapter.
- The Markdown scanner indexes the rendering as a `section` per heading. A document with no headings gets a section per page or slide.
- A node keeps the binary's own path, so ids, cards and `--only-dir` behave as they do for any other file. Its signature names the file and its place, for example `manual.pdf (page 3) -> graft/.graph/docs/<hash>.txt:L40-L52`.
- Page numbers come only from what the file records: the pages of a PDF, the page breaks that Word or LibreOffice wrote when they last laid the file out, and the pages of an ODT. A file that records none gets no page markers. Nothing is estimated.

**Converters**

| Format | Extension | Reader |
|---|---|---|
| PDF | `.pdf` | `pdfjs-dist` |
| Word, OpenDocument text | `.docx` `.odt` | `fflate` and an XML scanner |
| EPUB | `.epub` | `fflate` and an XML scanner, in spine order |
| Slides | `.pptx` `.odp` | `fflate` and an XML scanner, one section per slide, named by its title |

The converters are loaded only when a document is read. If one is missing, the build names the package to install and skips the document. It does not fail the build.

**Install**

The converters are declared as `optionalDependencies`, so npm installs them by default. On Windows, the measured cost is about 79 MB: `pdfjs-dist` 41 MB, its canvas package 37 MB, and `fflate` 0.8 MB. The `pdfjs-dist` version is pinned to 5.6.205, the last major that supports Node 20.

**Limits and flags**

- `--documents` turns the tier on for documents (persisted, like `--structured`). `--no-documents` turns it off. Env: `GRAFT_DOCUMENTS=1`.
- Documents have their own size cap, `GRAFT_DOCUMENT_MAX_BYTES`, with a default of 25 MB. A skipped document, or one with no text, gets one warning line.
- A scanned PDF gets one warning line for the file.
- `--deep` sends no document to the model unless `--deep-documents` is given. That flag is per run and is not persisted, and it covers the per-node pass only.

**Changes beyond the converters**

- `ask` and `grep` print the rendering's path as the pointer, so the locator opens in any tool.
- `pdfjs-dist` writes canvas warnings during load. They are filtered while the module loads, so they do not reach the build output. A `pdfjs` load without its canvas package is refused by name.
- An ODT paragraph styled as a heading is a heading.

**Verification**

- `npm run build && npm test` on Node 26.7.0, at the tip commit `9cd4e9b`: 1,537 tests, 1,532 pass, 0 fail, 5 skipped.
- The documents tests (`test/structured-documents.test.ts`) use fixtures built in `test/document-fixtures.ts`.
- Checked against real files: a three-chapter guide, saved from LibreOffice as ODT, DOCX and PDF. With both environment flags set, the build produced 21 nodes and 18 sections. The PDF split at the true page boundary, and `ask --source` returned the DOCX section with the rendering's lines.

**Stack**

Base is `pr/structured-edges`. This is the last pull request in the stack.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
