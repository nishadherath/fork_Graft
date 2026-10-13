---
stage: "Stage 3: cross-type edges, deep pass over structured files, blast aware of key edges"
model: claude-opus-5-5
effort: high
status: in-progress
created: 2026-10-13
from: "Sonnet 5.5 Stage 2 session (markup and build families), 2026-10-13"
---

# Stage 3: edges between documents and code

First confirm your own model and effort match the front matter (session tool,
`self`); if not, stop and say which to pick. Read `AGENTS.md`,
`docs/operator-protocol.md` (section 10), the plan's sections 3, 4 and 5, then the
Stage 1 and Stage 2 handoffs, then this. `high` because this adds a resolver over
the finished node set and touches `blast`, which other tools trust.

## Goal

Derive edges between structured nodes and code, deterministically and at $0
(plan section 4, "Edges"): a string literal in code equal to a key path or a
Markdown anchor becomes a `references` edge with `inferred` confidence; a Markdown
link becomes `references` to the file or section node; an HTML `src` or `href`
becomes `imports` of the file, a `<link>` or `class` to a CSS selector;
`run: npm run x` in a workflow and `node scripts/x.mjs` in a shell script or
Dockerfile become `references` to the `package.json` script key or the file.
Then the deep pass: `--deep` may summarise structured files, bounded to their first
N sections or keys (a named constant), documents staying out of it. Then `blast`
reads key edges: changing `package.json#key:bewhole.upload.maxBodyBytes` reports the
code that names it. Done: every edge kind has a failing-first test with a fixture
whose true lines are written in it, an ambiguous match produces no edge, the gate is
green with counts quoted, `sync-global` has run, and `pr/structured-edges` is cut as
the handoff for Stage 2 describes.

## Decisions already made

- D1 to D7 stand (plan section 6, and D7 in the Stage 2 handoff). The tier is opt-in.
- Precision first, as `resolve.ts` already is: same-file certain, a unique match
  elsewhere `inferred`, an ambiguous or absent match dropped. A wrong edge is worse
  than none (AGENTS.md rule 4 in spirit).
- Edges come from a resolver pass over the finished node set, in or beside
  `src/graph/resolve.ts`; the structured extractors keep emitting `contains` only.
- Extractors produce `RawEdge`s (`name`, `specifier`) as the code tiers do, so the
  extraction cache replays them; do not compute cross-file edges inside an extractor.
- No LLM anywhere in this stage except the existing deep pass. Prose conventions:
  Australian English, no em-dashes, no banned words.

## Files and links that matter

- `src/graph/structured/*` (one module per family; `shared.ts` has `emitKeys`,
  `emitUnits`, `isSecret`), `src/graph/resolve.ts`, `src/graph/types.ts` (`Relation`),
  `src/graph/invariants.ts` (relations set), `src/blast/blast.ts`, `src/context/build.ts`
  (`CODE_EXTENSIONS`, the deep pass), `src/ask/ask.ts` (how edges rank).
- `test/structured-*.test.ts` for the fixture shape; `test/graph-references.test.ts`
  for how reference edges are tested.

## Verified facts

- Stage 2 final gate: see "Work completed" in the Stage 2 handoff for the counts.
- The bundled XML grammar crashes on every input here ("memory access out of bounds"),
  so XML, Gradle and Make are hand-written scanners; Groovy's grammar splits `task x { }`.
- A key's `signature` and `body_text` never hold a value for secret-looking names or
  long opaque values; an edge pass must not reintroduce one (no edge label with a value).
- Key ids are `path#key:<dotted.path>`, brackets for odd keys: `a["b.c"]`. Section ids
  are `path#section:<slug>`, GitHub slugs, duplicates `~2`.
- The extractor stamp hashes `src/graph/structured/`; a source file appearing during a
  gate run moves it and fails the MCP tests. Do not edit `src/` while a gate runs.
- Python edits through a bash heredoc here lose backslashes (`\\n`, `\\b` become
  control characters); write scripts with the Write tool, and check
  `grep -lP "[\x00-\x08\x0b\x0c\x0e-\x1f]" src/graph/structured/*.ts` before committing.

## Work completed

Nothing yet in Stage 3.

## Unresolved questions

- Whether `blast` should treat a key edge as `behavioural`; today it counts only
  functions, methods and classes. Operator preference welcome, default no.
- The viewer colour table has no entry for the new kinds (cosmetic).

## Exact next action

Set `status: in-progress` here, then write `test/structured-edges.test.ts` with a
fixture repo holding `package.json` (a key `app.limits.maxBody`), a TypeScript file
that reads `config.app.limits.maxBody`, and a Markdown file linking to a heading;
assert the `references` edges by id and that an ambiguous second key of the same
name yields no edge. Watch it fail before touching the resolver.

## Cost projection

Opus 5.5 at $4.00 in, $20.00 out, $0.20 cache read per million tokens, 80 turns,
average context 110k, 3k fresh input, 2k output: cache 8.8M x $0.20 = $1.76; fresh
240k x $5.00 = $1.20; output 160k x $20 = $3.20; about $6.20. The earlier stages ran
about three times their quotes, so quote $6 to $12.

## Time projection

60 to 120 minutes of agent time. Operator review: about 30 minutes, mostly the
resolver's precision rules and the `blast` change.
