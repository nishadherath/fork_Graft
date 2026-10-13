---
stage: "Stage 1: the structured tier, Markdown, JSON, YAML, TOML, INI"
model: claude-sonnet-5-5
effort: high
status: in-progress
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

- Fork `main` at `9665d8b` (v0.21.1 plus the crux fix, the sync script
  and the docs): `npm run build` exit 0; `npm test` 1,329 tests, 1,324
  pass, 0 fail, 5 skipped, about 4 minutes (2026-10-13 11:13).
- `npm ci` fails on `tree-sitter-kotlin` here; `npm ci --ignore-scripts`
  then copy `node_modules/tree-sitter-kotlin/build/Release` from the
  global install (protocol section 10). All grammars then load.
- The global install is a copy of this tree's `dist/` (`sync-global`,
  4 files changed on 2026-10-13, 607 unchanged).
- BeWhole has 72 tracked Markdown, JSON and YAML files that graft skips
  today: 55 `.md`, 16 `.json`, 1 `.yml`
  (`git ls-files | grep -E "\.(md|json|ya?ml)$"`, 2026-10-13).

## Work completed

Nothing yet in Stage 1.

## Unresolved questions

- Whether `--structured` should also admit `.jsonc` tsconfig files with
  comments: parse with the `json` grammar's error recovery and see;
  record the outcome. (this stage)

## Exact next action

Set `status: in-progress` here, then write `test/structured-spans.test.ts`
with a Markdown fixture (ATX and setext headings, a fenced TypeScript
block, front matter) and a JSON fixture, asserting spans by known line
numbers, and watch it fail before adding `src/graph/structured/`.

## Cost projection

Sonnet 5.5 at $2.00 in, $10.00 out, $0.20 cache read per million tokens.
100 turns, average context 100k, 3k fresh input, 1.5k output per turn:
cache 10M x $0.20 = $2.00; fresh 300k x $2.50 = $0.75; output 150k x $10
= $1.50. About $4.25; quote $4 to $8 (the gate's output is large).

## Time projection

90 to 150 minutes of agent time (the gate is about 4 minutes and runs at
least six times; two `graft build` smoke runs on BeWhole). Operator
review: about 25 minutes, mostly the scanners and the kind audit.
