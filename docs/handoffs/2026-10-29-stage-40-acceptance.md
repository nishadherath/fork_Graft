---
stage: "Stage 40: adversarial acceptance of the upstream 0.28.0 merge (3337689), its own gate, verdict in writing"
model: claude-fable-5-1
effort: xhigh
status: done
created: 2026-10-29
from: "Stage 39, docs/handoffs/2026-10-29-stage-39-merge-upstream-0.28.0.md (claude-opus-5-5, xhigh, local_80852083), under D36 option A"
---

# Stage 40: accept or reject the upstream 0.28.0 merge

First action: read your own configuration with the session tool (`self`). If the model is not
`claude-fable-5-1` or the effort is not `xhigh`, stop and name the value to pick in the model menu.

## Goal

A written verdict, accept or reject, on merge commit `3337689` (upstream `19865ff` into `main`),
reached by trying to break it, with the session's own gate judged under D13 against
`docs/baselines/upstream-19865ff-failures.txt`. Accept: the Stage 41 release brief. Reject: each
defect with its failing test or reproduction, fixes as their own commits. Nothing is pushed or tagged.

## Decisions already made

- D36 option A (operator, 2026-10-29 13:10): Fable acceptance before the push; Stage 41 (Sonnet 5.5,
  high) releases only after an accept.
- D13 option A: pass when no test fails that plain upstream `19865ff` does not fail in a full run on
  this machine; compare by name; rerun a one-sided failure alone first. Baseline: 42 names.
- Gate environment, as Stage 39 and the .6 release: Git Bash, Node 26.7.0, scratch `HOME` and
  `USERPROFILE` with a `.gitconfig` copy (fresh per gate, learnt here), `DO_NOT_TRACK=1`,
  `GRAFT_NO_TRAIL_SWITCH=1`, one gate at a time in the background; the two PATH strays rerun with nvm
  and nodejs off PATH, `--test-concurrency=1`.
- Never run the `graft` or `trail` CLI in this checkout or in `D:\Code\Claude\ub`; smoke-test the built
  CLI in a temporary folder with a scratch `HOME`. Prose: Australian English, no em-dashes.

## Files and links that matter

- The eight conflicts and how each was resolved: the merge commit message (`git log -1 3337689`).
- The semantic fix the merge needed: #707 made depth grammars WASM, loaded asynchronously, so the
  fork's embedded code parsed nothing unless warmed. `src/graph/build.ts` `warmGrammarsFor` (fences,
  via `embeddedDepthLanguages` and `fenceLanguagesOf`), `warmStructuredGrammars` (page scripts,
  `PAGE_SCRIPT_LANGUAGE`); tests at the end of `test/structured-fences.test.ts`.
- `src/graph/code-refs.ts`, `scripts/vendor-grammars.mjs`, `src/cli.ts` (lazy `wiring` seam kept),
  `package.json` and the regenerated lock; Stage 39's brief for the counts.

## Verified facts (Stage 39, 2026-10-29)

- Merge `3337689` (parents `d27fb4e`, `19865ff`), baseline `afa99d2`; nothing pushed or tagged;
  version `0.25.0-nishadherath.6`; global install untouched.
- Fork gate 4,452 tests, 37 fail (34 in the baseline; the two machine-speed files pass alone; the
  third is the #709 npx case, held to the fork's installed-launcher rule, `c4d4120`). Plain upstream
  4,135 tests, 42 fail. That gate ran before the hosts-trail edit; Stage 40's is the first on `3337689`.

## Work completed (Stage 40, claude-fable-5-1 xhigh, local_6c0345a1, 2026-10-29)

**Verdict: accept merge `3337689`.** Evidence, each item run in this session:

- Own full gate on `61f64b8` (`3337689` plus three docs commits; code identical), environment as
  above: `npm run build` exit 0 in 31.5 s (9 depth grammars to `dist/vendor/grammars/`, SCSS to
  `dist/vendor/wasm/`); `npm test` 4,452 tests, 4,316 pass, 34 fail, 0 cancelled, 102 skipped,
  1,087.6 s, exit 1 (14:24 to 14:43). D13: 34 distinct failing names, all 34 in the 42-name
  baseline, 0 strays; 8 baseline names did not fail here.
- `hosts-trail` and `graft-to-trail` with nvm and nodejs off PATH, a `node.exe` copy first,
  `--test-concurrency=1`: 14 tests, 13 pass, 0 fail, 1 skipped, 5.9 s. The adapted npx case passes.
- The eight resolutions read against both parents. The fork's delta over `19865ff` in the graph files
  is additive; the only upstream lines gone are ones the fork had replaced before the merge (walk
  options, the LSP progress event, `container.ts`'s inline block). `cli.ts` keeps the lazy `wiring`
  seam; `refresh.js` and `build-progress.js` load only inside `loadWiring` and `refreshBefore`.
- Attacks that found nothing: `fenceLanguagesOf` reuses the scanner's opener regexes, so its set is a
  superset of `scanMarkdown`'s fences; the pre-query refresh reaches `warmGrammarsFor` through
  `buildGraph(graphOnly)`; `extractorStamp` hashes every `dist/graph/*.js`, `structured/` and the
  version, so the release cold-rebuilds every memo; `parseDepth` frees its tree in `finally` and
  `extractEmbedded` keeps only strings; wrappers parse on the 0.27 runtime, blocks on 0.22.2, so no
  parser is re-entered; `serverEntry` is the only launcher writer and never spells npx. Pack dry run
  numbers are in the Stage 41 brief.
- Smoke test, `node <fork>\dist\bin\graft.js` in a temp repo with scratch `HOME` and `USERPROFILE`:
  both `--version`s print `0.25.0-nishadherath.6`; `build` on five files gives 26 nodes (7 function,
  5 file, 5 section, 4 key, 2 method, 1 selector, 1 element, 1 class), 27 edges: fences `boot`
  L8-L10, `run` L16-L17, `greet` L23-L23; `Main.kt` `Greeter` L3-L9 with methods `greet` L4-L6 and
  `shout` L8-L8 (method kinds on WASM, no native binary); `page.html` `render` L12-L14, `.hero`
  L6-L6; `src/app.ts#retries -> config.json#key:app.retries`. `ask --source` and `skeleton` print the
  spans verbatim. Nothing written under the scratch `HOME`; real `~/.claude/settings.json` and
  `~/.trail` mtimes unchanged. `--version` 2.5 s with the gate running (`node -e 0` 0.78 s then).
- Found, pre-merge, not a merge defect: `calls src/Main.kt#Greeter.shout -> README.md#greet`. A
  bare call with no code candidate resolves into a README fence symbol; without the fence the call
  is unresolved (0 `calls` edges). `resolve.ts` is untouched by the merge; fence symbols date from
  `7f284b8` (2026-10-13); the fork's tests guard only fence-to-code. Learning `l-053d69dd`.
- `scripts/sync-global-checks.mjs`: fixed in `86af73e` (test first: 2 of 9 failed, then 9 of 9);
  `sync-global --dry-run` against the real install reports converters present, trail present, no
  Kotlin line. Second full gate on `86af73e`: build exit 0, 4,452 tests, 4,309 pass, 41 fail, 0
  cancelled, 102 skipped, 1,209.3 s (14:54 to 15:15). D13: 35 names in the baseline; 3 machine-speed
  strays pass alone (29 tests, 26 pass, the 3 below fail); the other 3, all in
  `test/trail-scenario-hooks.test.ts`, fail alone too, deterministically, because this session reused
  the first gate's scratch `HOME`: the commit check keeps `~/.trail/sessions/<id>.ship-checks.json`
  under fixed test session ids. With a fresh scratch `HOME` the file passes 9 of 9. Green under D13;
  the rule is now in protocol section 10 and learning `l-096b5bff`.
- `src/notes/edit-overlap.ts` `symbolsIn`: harmless. For a `.md` path `warmGrammarsFor` reads the
  file once and loads its fence grammars, `tierOf` yields no code tier and `symbolsIn` returns `[]`;
  one extra read on a hook path that runs only when a teammate's branch touches that file. No change.

## Unresolved questions

- The resolver gap above: a Sonnet stage, test first, in `src/graph/resolve.ts`.
- `AGENTS.md` non-negotiable 1 and its line 113 still tell sessions to copy the Kotlin binary; the
  protocol's 2026-10-29 section 10 bullets supersede them. Operator or a documentation stage.
- Node 20 (upstream's CI floor) was not exercised here; the gate ran on 26.7.0 only. Upstream's
  0.28.0 CHANGELOG says agents "now start Trail through npx"; this fork keeps the installed launcher
  (`c4d4120`), and the Stage 41 brief has it say so in the release notes.

## Exact next action

Stage 41, in a fresh session on Sonnet 5.5 at high: read
`docs/handoffs/2026-10-29-stage-41-release-0.28.0-nishadherath.md` and do its first action.

## Cost projection

Projected $16.40 ($12 to $24). Measured: context 374k at the end (session usage tool), about 55
turns, average context about 240k. Cache reads 55 x 240k = 13.2M x 0.25 = $3.30; fresh about 300k x
12.50 = $3.75; output about 120k x 50 = $6.00. About $13. Gates cost no tokens.

## Time projection

Projected 90 to 150 minutes; took about 70 (14:17 to 15:25): two gates of 18 and 21 minutes in the
background, the review and smoke test overlapping the first, the fix and briefs the second.
Operator review 20 minutes, plus one click for the Stage 41 chip.
