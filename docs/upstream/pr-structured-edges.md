# Pull request: edges between the structured tier and code (base `pr/structured-tier-markup-build`)

> Operator note (not part of the text). Branch `pr/structured-edges`, ten commits above its base: the eight feature commits (`342319f`, `ce54251`, `cd0a87e`, `5f2158f`, `b55a76e`, `6bf0625`, `05e3426`, `d52a1c4`) and two Stage 7 commits (`efeb238`, which makes the concept pass walk with the workflow admit, and `9c6273d`, a test). Changed paths beyond the markup branch include `src/blast/blast.ts`, `src/context/build.ts`, `src/context/check.ts`, `src/graph/code-refs.ts`, `src/graph/enrich.ts`, `src/graph/extract.ts`, `src/graph/resolve.ts`, `src/graph/resolve-structured.ts` (new) and `src/graph/structured/commands.ts` (new). Set the base to `pr/structured-tier-markup-build`. The gate figure is from tip `9c6273d`, rebased onto the fixed markup branch in Stage 7. One point for the reviewer and the operator: the concept pass's default file list now includes structured files when the tier is on, which raises the cost of existing `--deep` runs in repositories that enable the tier. The text says so.

---

**Title:** feat(structured): edges from code, Markdown and HTML into keys, sections and files; blast and the deep pass follow them

**Summary**

The structured tier can now link its units to the code and documents that name them. The links are deterministic and cost nothing at run time. A changed key or section can then show, through `graft blast`, the code and documents that depend on it.

**Edges added**

- **Code to key.** A member chain or string literal in TypeScript, JavaScript or Python that spells a key path references the key (`inferred`).
- **Markdown links.** A link references the section or file it names. A code string that names a heading references that section.
- **HTML.** `src` and stylesheet `href` import the file. Any other `href` references it. A `class` references the stylesheet rule `.class`.
- **Commands.** `npm run x`, `npm test` and `node scripts/x.mjs` in workflows, shell scripts, Dockerfiles, Makefiles and `package.json` scripts reference the nearest `package.json`'s script key, or the file.
- **Ambiguity.** A match that could name more than one target produces no edge.
- **Anchors.** A code string that carries an anchor, such as `README.md#boot`, targets the section or nothing. A dotted token glued to `#` or `:` names nothing. Markdown links keep the file fallback, because a link states its file.

**`graft blast`**

A changed key or section walks to the code and documents that name it, and to any key or section that contains it.

**`--deep` over structured files**

With the tier on, the concept pass reads the structured files it claims, and never a lockfile. Per-node summaries cover the first 40 units of each structured file, by line; the rest stay `pending`, which is not a failure. Code files are unaffected.

This is a cost change for existing `--deep` runs in repositories that enable the tier: structured files now take part in the concept pass, and each file's summary input is bounded by the 40-unit limit and the summariser's existing per-file character cap. An explicit `--extensions` list still means exactly that list.

**Verification**

- `npm run build && npm test` on Node 26.7.0, at the tip commit `9c6273d`: 1,520 tests, 1,515 pass, 0 fail, 5 skipped.
- A real-data audit of this repository found two false edges (a test id read as a key read, and an anchor that fell back to a file). Both are fixed in `8dda43e`, with tests.

**Stack**

Base is `pr/structured-tier-markup-build`. The next pull request, documents, is based on this branch.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
