---
stage: "Stage 15d: the system reference and the architecture diagram, linked from README"
model: claude-fable-5-1
effort: high
status: done
created: 2026-10-21
from: "the operator's request of 2026-10-21 (system description, document types, token economy, visual diagram)"
---

# Stage 15d: the system reference and the architecture diagram

## Goal

Two living documents under `docs/architecture/`, linked from `README.md`, that
describe the whole system: `system-reference.md` (Simplified Technical English;
every CLI command, MCP tool, hook, host, indexed file type with its limits, and
the token arithmetic the code performs) and `system-diagram.html` (one
self-contained interactive file). Both written by subagents from handoff
briefs, reviewed here, gate green, committed.

## Decisions already made

- Living documents, undated file names, a "Last verified" line inside; the
  procedure to keep them current is section 8 of the reference. Re-verify both
  after Stage 17 (the merge changes `cli.ts`, `build.ts`, `extract.ts`,
  `mcp-config.ts`).
- Written by class: the reference by Sonnet 5.5 high (Stage 15b), the diagram by
  Opus 5.5 high (Stage 15c), each from a handoff brief; reviewed by this session.
- Prose in the reference and the diagram: Simplified Technical English,
  Australian spelling, no em-dashes, no banned words; no vendor names or prices.
- The README link lives in the fork's "This build" section only.
- Decision D8 (what the fork is for) is still open; the operator did not answer
  the 2026-10-18 question. Stage 17 is needed under every option and remains the
  next code stage.

## Files and links that matter

- `docs/architecture/system-reference.md` (1,343 lines) and
  `docs/architecture/system-diagram.html` (about 94 KB, 79 parts, 127
  connections, 13 fork additions).
- `README.md`, "This build" section: the paragraph that links both.
- `docs/handoffs/2026-10-21-stage-15b-system-reference.md` and
  `...-stage-15c-system-diagram.md`: the briefs, both `status: done`.
- `docs/handoffs/2026-10-18-stage-17-merge-upstream-0.23.0.md`: the next stage.

## Verified facts (2026-10-21)

- Gate on `main` at `6e46fce` with the source unchanged: `npm run build && npm test`
  on Node 26.7.0, 1,553 tests, 1,548 passed, 0 failed, 5 skipped, 336 s
  (09:51 to 09:57).
- Reference checks: all 28 `.command(` names and all 6 MCP tool names appear;
  banned-word and em-dash greps print nothing; LF only; US spellings only in the
  protocol word `initialize` and the tool name `rust-analyzer`.
- Diagram checks: 93,919 bytes; no external URL, script, stylesheet or font
  (the only `http` strings are the SVG namespace); banned-word, em-dash and
  vendor-name greps print nothing; LF only; opened from `file://` in the
  built-in browser at 1440 x 900 with no console errors; Fit shows all ten
  layers; a detail card opens on click and closes on Escape; the theme switch
  sets `data-theme="dark"` and a dark body background (checked by script, since
  the preview pane renders local files light).
- Subagent usage reported by the harness: Stage 15b 427,715 tokens, 177 tool
  uses, 942 s; Stage 15c 355,251 tokens, 148 tool uses, 1,714 s.
- Source inconsistency found by Stage 15c and recorded in the reference,
  section 9: the `-j` help text says default 5, the file pass uses 8, the
  symbol pass uses 5.
- `git fetch upstream` on 2026-10-21: `main` is 15 commits behind `upstream/main`.

## Work completed

- `docs/architecture/system-reference.md` written (15b), reviewed, four rows
  corrected or added by this session (gate date, upstream distance, concurrency).
- `docs/architecture/system-diagram.html` written (15c), reviewed in the browser,
  one fix by this session (the theme button's label now follows its state).
- `README.md` links both documents.
- Committed together with this file; see `git log` for the hash.

## Unresolved questions

- Operator: D8, D9, D10, D11 (`docs/assessment-2026-10-18.md`, section 7).
- Not tested: the diagram in Firefox; the reference's section 3 options against
  `node dist/cli.js <command> --help` output (read from source only).
- The protocol's section 6 default of 60 turns per stage under-counted both
  subagents by about three times (177 and 148 tool uses): a document-writing
  stage with many small edits runs longer than a coding stage. Update the
  default when the next projection is written.

## Exact next action

Stage 17, in a new session on Opus 5.5 at high effort, from
`docs/handoffs/2026-10-18-stage-17-merge-upstream-0.23.0.md` (a New task card
was proposed on 2026-10-18). After it lands, re-verify both living documents.

## Cost projection

Actual, by the protocol's method with the measured tool-use counts as turns.
Stage 15b, Sonnet 5.5: 177 turns at about 60k context: cache 10.6M x $0.10 =
$1.06; fresh 531k x $2.00 x 1.25 = $1.33; output about 177k x $10.00 = $1.77;
about $4.20 (projected $1.60). Stage 15c, Opus 5.5: 148 turns at about 70k:
cache 10.4M x $0.20 = $2.07; fresh 444k x $4.00 x 1.25 = $2.22; output about
178k x $20.00 = $3.55; about $7.80 (projected $3.25). This session, Fable 5.1:
about 25 turns at about 350k context: cache 8.75M x $0.25 = $2.19; fresh about
100k x $12.50 = $1.25; output about 40k x $50.00 = $2.00; about $5.50. Total
about $17.50 at list price.

## Time projection

Actual: the two subagents ran in parallel, 16 and 29 minutes; this session about
55 minutes of wall clock including the five-minute status reports and the
six-minute gate. Operator reading: about 20 minutes for the reference, 10 for the
diagram.
