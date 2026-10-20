---
stage: "Stage 15b: the system reference document (living, Simplified Technical English)"
model: claude-sonnet-5-5
effort: high
status: done
created: 2026-10-21
from: "Fable 5.1 session of 2026-10-21, on the operator's request for a system description"
---

# Stage 15b: the system reference document

## Goal

`docs/architecture/system-reference.md` exists and is correct. It is a living
reference (undated file name; dated "Last verified" line at the top) written in
Simplified Technical English (ASD-STE100 style: sentences under 20 words, one
topic per sentence, active voice, present tense, simple approved words, one
term per thing, lists and tables for enumerations) with Australian spelling.
It describes:

1. The state of the project on 2026-10-21 (version, upstream distance, what is
   done, what is open), from `docs/assessment-2026-10-18.md` section 4 and the
   facts below.
2. Every CLI command `src/cli.ts` defines (including hidden ones, marked as
   hidden), each with its options and one sentence of purpose.
3. Every MCP tool `src/mcp/tools.ts` defines, with its parameters and what it
   returns, and the instructions text the server sends (`src/mcp/instructions.ts`).
4. The Claude Code integration: each hook event, its budget, what it does; the
   statusline; what `graft init` writes for the other hosts (`src/hosts/`).
5. The file types graft indexes, as one table per tier: depth, container,
   breadth, structured, documents. Columns: extensions; what each file yields
   (node kinds, edges, spans); the locator; the limits (size caps, key depth and
   count, body text cap, dot-path rule, lockfiles, secrets, minified assets);
   whether the tier is on by default or opt-in. State the extent of
   understanding in plain words (for example: "The breadth tier gives
   signatures and conservative call edges. It does not resolve scopes.").
6. How graft reduces token use and cost: the mechanisms (a card or a span
   instead of a whole file; the lexical index; the crux excerpt; the hooks'
   retrieval pack; the refresh that avoids re-parsing; the deep cache by hash)
   and the arithmetic graft itself performs (`src/context/savings.ts`,
   `src/claude/tally.ts`, `src/context/price.ts`), stated as what the code
   computes, not as a marketing claim. Quote the README benchmark figures only
   as upstream's claim, with the section named.
7. "How to keep this document current": for each section, the source files it
   is derived from and the command that lists them.

Done when: the file exists; every `.command(` in `src/cli.ts` and every tool in
`src/mcp/tools.ts` appears in it; every fact names its source file (and line
where useful) or the command that produced it; the prose checks below print
nothing; and the final report lists any fact that could not be verified.

## Decisions already made

- Location `docs/architecture/`, file `system-reference.md`. The parent session
  links it from `README.md`; this stage does not touch `README.md`.
- No commit, no `npm` run, no network. Use the Read, Grep and Write or Edit
  tools only; never Python or shell heredocs (they turn LF into CRLF here).
- Facts come from the files listed below and from `docs/assessment-2026-10-18.md`.
  Nothing from memory. Where the source and the README disagree, the source
  wins and the disagreement is noted.
- Prose: Simplified Technical English as above, Australian spelling, no em-dashes
  (restructure the sentence), none of the persona's banned words (section 14.1
  of `ENGINEERING_PERSONA.md`). Upstream's own quoted text is left as it is.

## Files and links that matter

- `src/cli.ts`: `grep -n '\.command("' src/cli.ts` lists the commands; each
  block's `.option(` and `.description(` lines are the facts.
- `src/mcp/tools.ts`, `src/mcp/instructions.ts`, `src/mcp/server.ts`,
  `src/mcp/tool-names.ts`.
- `src/claude/settings-merge.ts` (hook events and budgets), `src/claude/hooks.ts`
  (what each hook does), `src/claude/statusline.ts`, `src/claude/skill-template.ts`,
  `src/hosts/registry.ts` and `src/hosts/*.ts` (other hosts).
- Tiers: `src/graph/extract.ts` (depth languages), `src/graph/generic.ts`
  (breadth registry), `src/graph/container.ts`, `src/graph/structured/index.ts`,
  `src/graph/structured/documents/index.ts`, `src/graph/structured/shared.ts`
  (limits), `src/graph/source-files.ts`, `src/ingest/fs.ts` (skip dirs, caps,
  `STRUCTURED_DOT_PATHS`), `src/graph/types.ts` (kinds, relations, confidences),
  `src/graph/resolve-structured.ts` (edge rules).
- Retrieval and savings: `src/ask/ask.ts` (header comment), `src/search/grep.ts`,
  `src/context/savings.ts`, `src/claude/tally.ts`, `src/context/price.ts`.
- README sections: Supported languages (lines 228 to 312), What's in a node
  (313 to 334), What runs where (335 to 345), Agent integration (346 to 428),
  CLI (429 to 518), Search & orient (519 to 550), Monorepos (551 to 588),
  Visualize (589 to 624). Line numbers from 2026-10-18; re-check with grep.
- `docs/assessment-2026-10-18.md` sections 2, 4 and 8; `CHANGELOG.md` top section.

## Verified facts (2026-10-21)

- `main` is `6e46fce`, version `0.21.1-nishadherath.1`; `git log main..upstream/main
  | wc -l` printed 15 after `git fetch upstream`; the global `graft` answers
  `0.21.1-nishadherath.1`. Stage 17 (the merge) has not started.
- The last gate (2026-10-18): 1,553 tests, 1,548 passed, 0 failed, 5 skipped.
- Everything in `docs/assessment-2026-10-18.md` section 8 holds unless re-measured.

## Work completed

Wrote `docs/architecture/system-reference.md` (1,342 lines), covering sections 1 to 9 of the Goal; the facts it could not verify are listed in its section 9.

## Unresolved questions

- None known. Report any fact the files do not settle rather than guess.

## Exact next action

`grep -n '\.command("' src/cli.ts`, then read each command block in turn and
build the command table first; then the MCP tools; then the tiers.

Prose checks, from the repository root, both of which must print nothing:
`grep -n -i -E "delve|nuanced|tapestry|robust|multifaceted|landscape|worth noting|important to note|genuinely|truly|absolutely" docs/architecture/system-reference.md`
and `grep -n $'\xe2\x80\x94' docs/architecture/system-reference.md`.

## Cost projection

Sonnet 5.5, high ($2.00 in, $10.00 out, $0.10 cache read per million). 60 turns,
average context 70k, 3k fresh input per turn, output about 70k in total (the
document is about 8k tokens, written in parts). Cache 4.2M x $0.10 = $0.42; fresh
180k x $2.00 x 1.25 = $0.45; output 70k x $10.00 = $0.70. About $1.60; quote $1.50
to $3.

## Time projection

Wall clock 20 to 40 minutes. Review by the parent session about 15 minutes;
operator reading about 20 minutes.
