---
stage: "Stage 2: markup and build families, HTML, CSS, XML, Groovy, shell, Dockerfile, Make, CMake, and the denylist"
model: claude-sonnet-5-5
effort: medium
status: done
created: 2026-10-13
from: "Sonnet 5.5 Stage 1 session (structured tier core), 2026-10-13"
---

# Stage 2: markup and build families

First confirm your own model and effort match the front matter (session tool,
`self`); if not, stop and say which to pick. Read `AGENTS.md`,
`docs/operator-protocol.md` (section 10), the plan's sections 3 and 4, and the
Stage 1 handoff (`2026-10-13-stage-1-structured-tier-core.md`), then this.

## Goal

Extend the structured tier to the plan's "second" rows: HTML, Svelte and Astro
(an `element` per node with an `id` or `name`; `<script>` and `<style>` through
`extractEmbedded`), CSS and SCSS (a `selector` per rule, custom properties,
`@mixin`), XML (Android manifest and layouts by `android:id`, pom, plist keys as
`key`), Groovy `build.gradle` (a `task` per block), Bash and PowerShell (functions
in the existing kind), Dockerfile, Make and CMake (a `task` per target or stage).
Plus first, the operator's decided dot-directory item (Decision D7 below).
Done: each family has a failing-first span test in the fixture style, the README
table has its rows, CHANGELOG has an entry, the denylist (`.pem`, `.key`, minified
bundles; lockfiles exist already) is pinned by a test, the gate is green with
counts quoted, `sync-global` has run, and the branch `pr/structured-tier-markup-build`
is cut from `upstream/main` (or from `pr/structured-tier-core` if that has not
merged; say which).

## Decisions already made

- D1 to D6 in the plan's section 6 stand. The tier stays opt-in behind `--structured`.
- Registry rows in `src/graph/structured/index.ts` (`STRUCTURED_LANGS`), one
  extractor module per family, wasm grammars through `loadWasmLanguage` and
  `parseWasm`; a family that needs another grammar names it in `ALSO_NEEDS`.
- New kinds `element`, `selector`, `task` go on `Kind` (`src/graph/types.ts`) and
  in `invariants.ts`; audit as Stage 1 did (only `invariants.ts` is exhaustive).
- Reuse `emitKeys`, `isSecret`, `endRowOf`, `splitLines`, `spanOf` from
  `structured/shared.ts`. `emitKeys` is for key paths; elements, selectors and tasks
  need their own small emitter that applies a size cap with a named constant.
- Spans are host-file lines. Embedded `<script>` and `<style>` use
  `extractEmbedded` from `container.ts` and keep only `contains` edges.
- D7 C, decided 2026-10-13 by the operator: with the structured tier on, the walker
  admits files under `.github/workflows/` (YAML only, by the registry) despite its
  dot-directory rule. Nothing else changes: `.editorconfig`, `.github/` outside
  `workflows/`, every other dot-path, `SKIP_DIRS` and Git's ignore rules behave as
  today, and with the tier off the file set is byte-identical to today. Shape: a
  named constant for the admitted prefixes beside `shouldSkipDir` in
  `src/ingest/fs.ts`, a `WalkOptions` field callers pass when `readStructured(root)`
  is true, wired into the callers of `walkDir` that enumerate source files
  (`graph/build.ts`, `graph/source-files.ts`; check `graph/scopes.ts` and
  `context/build.ts` and say why each does or does not need it). Build, probe and
  `check` must agree, as in `test/structured-tier.test.ts`. Raise it in the D5
  design issue when the operator opens it; do not wait for that.
- The structured tier's choice persists in `.graft/config.json`
  (`readStructured`); do not add a second switch.
- Prose conventions: Australian English, no em-dashes, no banned words.

## Files and links that matter

- `src/graph/structured/{index,shared,markdown,json,yaml,toml,ini}.ts`
- `src/graph/container.ts` (`extractEmbedded`), `src/graph/cards.ts` (card names)
- `test/structured-*.test.ts` for the fixture shape; `test/structured-surfaces.test.ts`
  for the skeleton, ask, grep and card checks to copy
- Grammars present in `node_modules/tree-sitter-wasm/out/`: html, svelte, astro, css,
  scss, xml, bash, powershell, dockerfile, make, cmake, groovy. Probe tree shapes
  before writing an extractor; `.mts` probe scripts are the quickest way.

## Verified facts

- Final gate on the Stage 2 branch (`npm run build && npm test`, Node 26.7.0,
  2026-10-13): 1,446 tests, 1,441 pass, 0 fail, 5 skipped. Stage 1 ended at 1,397, so
  49 new tests, in `test/structured-{dotpaths,css,html,xml,build-scripts,targets,shell,denylist}.test.ts`.
- `node scripts/sync-global.mjs`: 51 files changed, global graft answers 0.21.1.
- This repository with `GRAFT_STRUCTURED=1 graft build .`: 3,373 nodes including 320 `key`,
  244 `section`, 195 `selector`, 20 `element`, 2 `task`; `.github/workflows/*.yml` keys appear
  (D7). BeWhole: 1,720 nodes including 402 `key`, 230 `selector`, 6 `element`;
  `graft ask "upload body limit" --source` still returns `package.json:L24-L24`, and
  `.github/workflows/ci.yml:L32-L32` is reachable. BeWhole's git status was identical before and
  after; both graphs were rebuilt code-only afterwards.
- Real-data span checks (the unit's id, name or first token is on its span): 120 CSS and SCSS
  files with 9,339 rules; 150 HTML, Svelte and Astro files with 6,883 units; 162 XML-family
  files with 202 units; 33 Gradle and Make files with 340 units; 31 Docker and CMake files with
  391 units; 150 shell scripts with 166 functions; 0 mismatches. My first checker versions gave
  false mismatches (tokenising `a[name=L1]`, `appcompat:appcompat"]`); each was the checker's
  fault and was fixed there, not in the extractor.
- The bundled XML grammar crashes on every input here ("memory access out of bounds", two-element
  document, Node 26.7.0). The other eleven planned grammars load and parse.
- The Groovy grammar parses `task hello { }` as a call plus a detached closure; the Make grammar
  decides recipe spans by recovery. Both are scanners now.
- `git ls-files --eol -m` was clean (all LF) at each commit; no control characters in `src/`.

## Work completed

Branch `stage-2/markup-build` on `main`, one commit per item, each gated:

- `341a793` D7: `.github/workflows` YAML admitted by the walker (`STRUCTURED_DOT_PATHS`)
- `dfddca7` CSS and SCSS, kinds `element`/`selector`/`task`, the shared unit emitter
- `dc3a015` HTML, Svelte, Astro  `b1ff78e` XML scanner  `ecb7d0e` Gradle and Make scanners
- `45651fb` Dockerfile and CMake  `8aa8fde` Bash and PowerShell  `01ace3a` denylist, README, CHANGELOG

Deviations from the handoff, each with its reason:

- XML, Gradle and Make are hand-written scanners instead of wasm walks (evidence above); D2 allows it.
- CSS landed before HTML because HTML's `<style>` reuses the CSS walker.
- The denylist is key-material extensions for every tier (a pinned no-op today) and minified
  css/json/html/svg for the structured tier only; `.min.js` stays with the depth tier so the
  tier-off file set is unchanged.
- A first HTML gate failed two MCP tests because a new file appeared in `structured/` mid-run and
  moved the extractor stamp; I reran on a stable tree and noted it in that commit.

## Unresolved questions

- Viewer colours for `section`, `key`, `element`, `selector`, `task` (neutral today). Cosmetic.
- `.properties` and `.conf` in the INI family: not probed; the ini grammar reads `=` only. Operator.
- Whether XML should return to the grammar if a later `tree-sitter-wasm` fixes the crash
  (one `wasm` field and deleting `xml.ts`'s tree builder). A later release can answer it.

## Exact next action

Operator: review `git log upstream/main..pr/structured-tier-markup-build --stat`, push the
branch after `pr/structured-tier-core`, then start Stage 3 from
`docs/handoffs/2026-10-13-stage-3-edges.md` (Opus 5.5 at high).

## Cost projection

Projected $4 to $8 (60 turns, 100k context). Actual, estimated: this stage ran inside the
Stage 1 session, so its context started near 450k and ended at 623k: about 110 turns x 530k
average = 58M cache reads x $0.20 = $11.7, fresh input 330k x $2.50 = $0.8, output 220k x $10 =
$2.2, about $14.7 at API list price. A fresh session would have cost roughly a third of that;
the handoff exists for exactly this reason. Not measured: the plan account reports percentages.

## Time projection

Projected 75 to 115 minutes. Actual about 95 minutes wall clock (04:02 to 05:37 UTC), nine gates
of 5 to 7 minutes each. Operator review: about 30 minutes, mostly `xml.ts`, `gradle.ts`, `make.ts`
and the `fs.ts` change.
