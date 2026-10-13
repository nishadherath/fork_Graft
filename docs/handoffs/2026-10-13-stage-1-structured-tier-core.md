---
stage: "Stage 1: the structured tier, Markdown, JSON, YAML, TOML, INI"
model: claude-sonnet-5-5
effort: high
status: done
created: 2026-10-13
from: "Fable 5.1 Stage 0 session (fork sync, crux fix, plan), 2026-10-13"
---

# Stage 1: the structured tier, Markdown, JSON, YAML, TOML, INI

First confirm your own model and effort match the front matter above
(session tool, `self`); if not, stop and say which to pick. `high`
because this adds a parse tier that every build runs through. Escalate
to `claude-opus-5-5` only on the persona's triggers. Read `AGENTS.md`,
`docs/operator-protocol.md` (section 10 is this fork's mechanics),
`docs/plan-file-type-indexing-2026-10-13.md` sections 3 and 4, then this.

## Goal

A fourth parse tier, "structured", that turns Markdown, JSON (and JSONC,
JSONL headers), YAML, TOML and INI-family files into nodes with exact
line spans, so `graft build` indexes them at $0 and `ask`, `grep`,
`skeleton` and the cards show them. Done means: on this fork and on
`D:\Code\GLM\BeWhole`, `graft build` reports the new files as indexed,
`graft skeleton AGENTS.md` lists every heading with a correct span,
`graft ask "upload body limit"` on BeWhole returns the `package.json`
key node `bewhole.upload.maxBodyBytes` with its line, `--source` prints
the right lines for a section and for a key, the gate is green with the
new tests, and `node scripts/sync-global.mjs` has run. One commit per
item below, each gated and quoted.

## Decisions already made

- D1 A, decided 2026-10-13: the tier is behind `--structured` in this
  first cut, with `GRAFT_STRUCTURED=1` as its env twin; default-on is a
  one-line flip later. D2 A: Markdown and TOML are hand-written line
  scanners; JSON, YAML and INI parse with the bundled wasm grammars
  through `loadWasmLanguage` and `parseWasm` in `src/graph/generic.ts`.
- New kinds `section` and `key` on `Kind` (`src/graph/types.ts`). Audit
  every consumer of `Kind` (`grep -rn '"module"' src --include=*.ts`
  finds the label tables) and extend each exhaustive one; cards and
  skeleton must print the kind truthfully, not coerce it.
- Ids: `path#section:<slug>` and `path#key:<dotted.path>`, deduplicated
  with `mintId` like symbols. `origin: "generic"` for the new nodes (the
  field's doc comment gains the new tier).
- Spans are in the host file. A Markdown section spans its heading line
  to the line before the next heading of equal or higher level; a key
  spans its own line to the end of its value. `test/structured-spans.test.ts`
  pins spans against fixtures whose true line numbers are written in the
  fixture, in the shape of `test/container-extract.test.ts`.
- `body_text`: a section's text (existing cap); a key's scalar value,
  except when the key name matches the secret pattern (`token`, `secret`,
  `password`, `api_key`, `private`, or a value over 32 opaque characters),
  which gets no body_text. Pinned by a test.
- Markdown fenced code with a language tag goes through the container
  mechanism (`src/graph/container.ts`) so the embedded symbols get real
  spans; fences without a tag are text. MDX is Markdown here.
- JSON depth cap 4 and at most 500 keys per file (constants in one place,
  named, with the reason); arrays contribute an index only when their
  elements are objects with a `name`, `id` or `key` field. JSONL: the
  first line's keys only.
- Nothing else changes: no edges beyond `contains`, no deep-pass change,
  no documents. Upstream conventions: tests in `test/`, a CHANGELOG
  "Unreleased" entry, README language table row, CREDITS untouched.
- Prose conventions in every file you write: Australian English, no
  em-dashes, no banned words. Upstream's existing comments stay as they are.

## Files and links that matter

- `src/graph/build.ts` L195-L230 (tier dispatch and grammar warm-up),
  `src/graph/source-files.ts` (`listSourceFiles`, `supportedExtensions`),
  `src/graph/extract.ts` L40-L90 (the depth table, `languageLabelOf`,
  `mintId`), `src/graph/generic.ts` (`GENERIC_LANGS`, `loadWasmLanguage`,
  `parseWasm`, `extractGeneric` as the model for a wasm-backed extractor),
  `src/graph/container.ts`, `src/graph/types.ts` (`Kind`, `NodeV1`),
  `src/graph/cards.ts`, `src/ask/ask.ts` (lexical rank uses `body_text`),
  `src/cli.ts` L355-L460 (build options).
- Grammar availability: `node_modules/tree-sitter-wasm/out/` has
  `json`, `yaml`, `ini`; no block markdown, no toml.
- Tests to copy the shape of: `test/container-extract.test.ts`,
  `test/covers.test.ts`, `test/ask-file-rank.test.ts`.

## Verified facts

- Final gate on the Stage 1 branch (`npm run build && npm test`, Node 26.7.0,
  2026-10-13): 1,397 tests, 1,392 pass, 0 fail, 5 skipped, about 6.7 minutes.
  Baseline on `main` was 1,329 tests; the 68 new ones are in
  `test/structured-{tier,spans,fences,json,yaml,toml-ini,surfaces}.test.ts`.
- `node scripts/sync-global.mjs`: 64 files changed, global graft answers 0.21.1.
- This repository with `GRAFT_STRUCTURED=1 graft build .`: 2,832 nodes including 224
  `section` and 113 `key`. `graft skeleton AGENTS.md` lists L9, L19, L61, L92, and
  `sed -n` confirms each is that heading's line. `ask ... --source` prints
  `ENGINEERING_PERSONA.md:L93-L103` for section 3.2, which is exactly that section.
- BeWhole with the same: 1,396 nodes including 359 `section` and 347 `key`;
  `graft ask "upload body limit" --source` returns `package.json:L24-L24`
  `bewhole.upload.maxBodyBytes`, and line 24 is that key. BeWhole's git status was
  identical before and after, and both graphs were rebuilt code-only afterwards.
- Real-data span checks (the key's name, or the heading, is on the span's first
  line): 603 sections in 78 Markdown files, 440 keys in 19 JSON files, 334 keys in
  9 YAML files, 3,653 keys in 150 TOML, INI and CFG files, 0 mismatches. No real
  document had a depth-tier fence, so that path rests on fixtures only.
- Graft never walks dot-files or dot-directories (`src/ingest/fs.ts`, a documented
  upstream limit), so `.github/workflows/*.yml` and `.editorconfig` are unreachable.
  BeWhole's one `.yml` is `.github/workflows/ci.yml`, so it is not indexed.
- `.jsonc` needs no separate path: the json grammar parses comments and recovers
  around a trailing comma (the handoff's open question, answered and tested).

## Work completed

Branch `stage-1/structured-tier-core` on `main`, one commit per item, each gated:

- `8d4395b` tier skeleton, `section`/`key` kinds, `--structured`, `GRAFT_STRUCTURED`
- `c62c7a8` Markdown sections  `7f284b8` fenced code via `extractEmbedded`
- `a61aa12` JSON, JSONC, JSONL  `9f1d668` YAML and Markdown front matter
- `1d6c935` TOML scanner and INI  `715d5bb` surfaces, card collision fix, docs

Deviations from the plan, each with its reason:

- The opt-in persists in `.graft/config.json` (like `--follow-submodules`), not the
  fingerprint, so a flagless `graft build` from the Stop hook keeps the tier.
- `extractorStamp` now also hashes `src/graph/structured/`, or a scanner edit would
  replay stale parses.
- `writeCards` gives later claimants of a shared stem their extension
  (`config.yml.md`); before, `config.json` and `config.yml` overwrote one card.
- Fences keep only `contains` edges; a README sample must not claim an edge into `src/`.
- Lockfiles (`package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`) are denied
  by name now, because `.json` is claimed; Stage 2 completes the denylist.

## Unresolved questions

- Decided 2026-10-13 by the operator: option C, a structured-only admit-list for
  `.github/workflows` (Stage 2 handoff, D7). Not yet implemented.
- Viewer colour table (`viewer/data.ts`) has no entry for `section` or `key`; they
  draw in the neutral colour. Cosmetic; Stage 2 or the operator.

## Exact next action

Operator: review `git log upstream/main..pr/structured-tier-core --stat`, push the
branch, then open the D5 design issue pointing at it. Stage 2 is specified in
`docs/handoffs/2026-10-13-stage-2-markup-build.md` (Sonnet 5.5, medium).

## Cost projection

Projected $4 to $8 (100 turns, 100k average context). Actual, estimated: about 190
turns, context rising to 443k (average about 220k), so cache reads 190 x 220k = 41.8M
x $0.20 = $8.4; fresh input 190 x 3k = 570k x $2.50 = $1.4; output 190 x 2k = 380k
x $10 = $3.8; about $13.6 at API list price. Higher than the quote because the gate
runs, seven of them, and the real-data checks kept the context long. Not measured:
the plan account reports percentages, not tokens.

## Time projection

Projected 90 to 150 minutes. Actual about 75 minutes wall clock (session
clock 02:01 to 03:15 UTC), seven gates of about 5 to 7 minutes each. Operator
review: about 25 minutes, mostly `markdown.ts`, `toml.ts` and the `cards.ts` change.
