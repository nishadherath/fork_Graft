---
stage: "Stage 15c: the interactive system and architecture diagram (single HTML file)"
model: claude-opus-5-5
effort: high
status: done
created: 2026-10-21
from: "Fable 5.1 session of 2026-10-21, on the operator's request for a visual system diagram"
---

# Stage 15c: the interactive system and architecture diagram

## Goal

`docs/architecture/system-diagram.html` exists: one self-contained HTML file
(inline CSS, inline JavaScript, inline SVG; no external requests of any kind, no
fetched fonts, no CDN; opens from `file://` in Chromium and Firefox with no
console errors) that shows the whole system so a reader can understand it
visually. It must show, as distinct, labelled, connected parts:

1. Inputs: the repository's files, git visibility, the user's flags and env twins.
2. File selection (`src/ingest/fs.ts`, `src/graph/source-files.ts`): skip
   directories, the 1 MB cap and the 25 MB documents cap, the dot-path rule with
   the `.github/workflows` admission, the key-material denylist, lockfiles and
   minified assets, `--only-dir` and `--include-dir`, the opt-in flags.
3. The four parse tiers and the document converters (`src/graph/build.ts`
   dispatch order: depth, container, breadth, structured; documents converted
   first): what each takes and what each yields.
4. The extraction cache keyed by content hash and extractor stamp
   (`src/graph/extract-cache.ts`), and the fingerprint probe (`src/graph/fingerprint.ts`).
5. The graph artefacts under `graft/`: `.graph/wiring.json`, the per-file cards,
   `INDEX.md`, `.cache/ask-index.json`, `.cache/extract.*.json`,
   `.cache/fingerprint.*.json`, `.graph/docs/<sha256>.txt` renderings,
   `manifest.json`, `.cache/summaries.json`, `.cache/stats.json`.
6. The refresh loop: every query probes freshness and rebuilds what changed;
   `upkeep` at session start reconciles wiring when the version changes.
7. The deep pass (`src/context/build.ts`, `src/ai/`): one provider adapter
   behind four wire formats, summaries and crux excerpts cached by body hash,
   concept nodes, the reasoning level and the usage line. No model names or
   prices anywhere in the diagram: say "the configured provider".
8. Retrieval (`src/ask/`, `src/search/`, `src/graph/traverse.ts`, `src/blast/`,
   `src/viz/`): ask, grep, skeleton, callers, map, blast, viz, check, stats.
9. Surfaces: the CLI, the MCP server and its six tools, the Claude Code hooks
   (each event with its budget) and statusline, the instruction files and MCP
   entries written for the other hosts.
10. The agents that consume it, and the token-saving mechanism as a panel: a
    card or span instead of a whole file; the savings tally; the price lookup.
11. The fork's additions marked distinctly from upstream (structured tier,
    documents tier, structured edges, reasoning and usage, crux fix, launcher).

Interaction: click a node for a detail card (responsibility, source file, key
facts, limits); hover highlights the connected edges and dims the rest; filter
by layer; a toggle that highlights fork-only parts; an animated data-flow toggle
(off by default; respects `prefers-reduced-motion`); light and dark themes
(`prefers-color-scheme` plus a switch, both readable); pan and zoom with mouse,
touch and keyboard; a legend; a search box that finds a node by name; responsive
down to 1024 px wide; keyboard-reachable nodes with ARIA labels and visible
focus; contrast at WCAG AA.

Done when: the file opens with no console errors; every part listed above is
present and labelled; every node's detail names its source file; the file is
under 400 KB; the prose checks below print nothing; and the final report lists
the facts used with their sources and any fact that could not be verified.

## Decisions already made

- Vanilla JavaScript and SVG. No d3, no framework, no bundler, no build step:
  the file is read from the repository as it is.
- Location `docs/architecture/`, file `system-diagram.html`. The parent session
  links it from `README.md`; this stage does not touch `README.md`.
- No commit, no `npm` run, no network. Write with the Write or Edit tools only;
  never Python or shell heredocs (they turn LF into CRLF here). LF line endings.
- Facts come from the listed files and `docs/assessment-2026-10-18.md` section 2
  and 8, not from memory. Where unsure, read the file.
- Text in the diagram: Australian spelling, no em-dashes, none of the persona's
  banned words (`ENGINEERING_PERSONA.md` section 14.1). Short labels; detail in
  the cards.
- If the Skill tool lists `impeccable` or `artifact-design`, load one for design
  guidance before laying out the page. The facts still come from the files.

## Files and links that matter

- `docs/assessment-2026-10-18.md` section 2 (how it works) and section 8 (measured
  facts, including the hook budgets and startup timings).
- `src/graph/build.ts` (dispatch, lines 215 to 375), `src/graph/source-files.ts`,
  `src/ingest/fs.ts`, `src/graph/extract-cache.ts`, `src/graph/fingerprint.ts`,
  `src/graph/refresh.ts`, `src/upkeep.ts`, `src/graph/cards.ts`, `src/graph/write.ts`.
- `src/graph/structured/index.ts`, `src/graph/structured/documents/index.ts` and
  `cache.ts`, `src/graph/resolve-structured.ts`, `src/graph/types.ts`.
- `src/context/build.ts`, `src/ai/llm/factory.ts`, `src/ai/crux.ts`,
  `src/ai/synthesize.ts`, `src/ai/summarize.ts`.
- `src/ask/ask.ts` (header), `src/search/grep.ts`, `src/graph/traverse.ts`,
  `src/blast/blast.ts`, `src/viz/serve.ts`.
- `src/cli.ts` (`grep -n '\.command("'`), `src/mcp/tools.ts`, `src/mcp/server.ts`,
  `src/claude/settings-merge.ts`, `src/claude/hooks.ts`, `src/claude/statusline.ts`,
  `src/hosts/registry.ts`, `src/hosts/mcp-config.ts`.
- `src/context/savings.ts`, `src/claude/tally.ts`, `src/context/price.ts`.
- `viewer/` is upstream's `graft viz` bundle; it is a different thing and is not
  reused here.

## Verified facts (2026-10-21)

- `main` is `6e46fce`, version `0.21.1-nishadherath.1`; upstream is 15 commits
  ahead; Stage 17 (the merge) has not started.
- The hook budgets and the startup timings are in the assessment, section 8.

## Work completed

- `docs/architecture/system-diagram.html` written: 93,919 bytes (79 parts, 127 connections, 13 fork additions).

## Unresolved questions

- None known. Report any fact the files do not settle rather than guess.

## Exact next action

Read `docs/assessment-2026-10-18.md` section 2, then `src/graph/build.ts` lines
215 to 375, then write the node and edge model as a JavaScript data structure
first (every node with its source file and facts), then the rendering.

Prose checks, from the repository root, both of which must print nothing:
`grep -n -i -E "delve|nuanced|tapestry|robust|multifaceted|landscape|worth noting|important to note|genuinely|truly|absolutely" docs/architecture/system-diagram.html`
and `grep -n $'\xe2\x80\x94' docs/architecture/system-diagram.html`.

## Cost projection

Opus 5.5, high ($4.00 in, $20.00 out, $0.20 cache read per million). 50 turns,
average context 70k, 3k fresh input per turn, output about 90k in total (the file
is about 15k tokens, written in parts and revised). Cache 3.5M x $0.20 = $0.70;
fresh 150k x $4.00 x 1.25 = $0.75; output 90k x $20.00 = $1.80. About $3.25;
quote $3 to $6.

## Time projection

Wall clock 30 to 60 minutes. Review by the parent session in the browser about
20 minutes; operator reading about 15 minutes.
