---
stage: "Stage 21: rebase the five PR branches onto upstream 0.25.0, gate each, open the pull requests"
model: claude-sonnet-5-5
effort: high
status: blocked
created: 2026-10-26
from: "Roadmap session (Haiku 5.5, local_2a1bae05) after Stage 20r (b96f716). Scope from assessment section 6 stage 21 and section 5 item 5; the 0.23.0 base there is now 0.25.0."
---

# Stage 21: rebase the PR branches onto upstream, gate each, open the pull requests

Roadmap Stage 21 in `docs/assessment-2026-10-18.md` section 6; scope is section 5 item 5.
Blocked on two operator decisions (below). Nothing is pushed, no pull request is open.

## Goal

Each `pr/*` branch carries only its feature's `src/`, `test/`, `CHANGELOG.md`, `CREDITS.md` and
`README.md` commits on top of `upstream/main` (`4e7d0f5`, 0.25.0), passes the gate by name against
the baseline, and has a pull request open against `trailhq/Trail-Code` after the operator approves
each push.

## Decisions already made

- Branches are cut from `upstream/main`, never from `main` (AGENTS.md rule 3). Gates one at a time.
- A failure counts only if it is not a baseline name (D13) and still fails when its file is run alone.
- The comment citing "operator decision D7" in `src/ingest/fs.ts` was reworded in its own commit
  (upstream readers cannot resolve it). The restack that followed changed nothing else (diffed).

## Decisions for the operator (open)

```
D15 Decision:      SCSS on the PR branches (2 tests fail on plain upstream, every time)
    Cause:         upstream's tree-sitter-wasm 2.x has no SCSS grammar (protocol section 10);
                   main works because the 0.25.0 merge vendors it from tree-sitter-wasm@1.1.8.
                   On upstream the .scss extraction returns nothing: structured-css.test.ts
                   "scss: variables, mixins, functions and nested rules" and "css: a stylesheet
                   goes through a real build" (it builds a theme.scss). Affects markup-build,
                   edges and documents-tier; all from commit d66e06f.
    Options:       A drop .scss from the PR branches (index.ts row, its test, README and CHANGELOG
                     lines); main keeps SCSS
                   B carry the vendoring (devDependency, scripts/vendor-grammars.mjs, generic.ts)
                   C keep .scss and skip its tests when the grammar is absent, saying so in README
    Pros and cons: A smallest and truthful; loses SCSS in the PR until upstream bundles a grammar.
                   B full feature; adds a dev dependency and touches scripts/ and package files,
                     a bigger ask of upstream.
                   C keeps a code path that does nothing on upstream.
    Blast radius:  each option restacks markup-build, edges and documents-tier (hashes change,
                   nothing is pushed) and needs three more gates (about 100 minutes).
    Recommended:   A, because every claim in the PR then holds on upstream's own dependencies.

D16 Decision:      pushing and the pull requests (outward-facing)
    Options:       (a) all four at once; (b) one approval per branch
    Facts:         the four branches are one stack (core 11, markup-build 19, edges 29,
                   documents-tier 41 commits), so each PR shows the earlier ones' commits unless
                   they merge first. pr/crux-id-echo needs no PR (see below).
    Recommended:   (b), core first; open the next when the one below merges or upstream says
                   how it wants a stack. Also unanswered: Stage 16's question to upstream
                   (is a contribution wanted at all).
    Also:          9 commit messages cite fork-internal "Stage N" or "decision D2/D7" numbers.
                   Leave for upstream to squash, or reword in the restack (one extra restack).
```

## Files and links that matter

- Branches `pr/structured-tier-core`, `pr/structured-tier-markup-build`, `pr/structured-edges`,
  `pr/documents-tier`; old tips kept as `refs/s21-backup/pr/*` (delete when the operator agrees).
- `docs/baselines/upstream-4e7d0f5-failures.txt`; protocol section 10; memory `gh-cli-absent-use-gcm-token`.

## Verified facts (2026-10-26, Node 26.7.0, gates in a worktree at D:\Code\Claude\s21, now removed)

- `pr/crux-id-echo` is superseded: upstream's `resolveTargetId` (`src/ai/crux.ts:206`, #259, tests in
  `test/llm-ops.test.ts:115`) cuts an echoed `<id> | ...` back to the bare id. With upstream's
  `crux.ts` unchanged the fork's `test/crux-id-echo.test.ts` passes (2 of 2). No PR; branch untouched.
- Final tips and audit (`git diff --name-only upstream/main <branch>`): core `d225674` (11 commits),
  markup-build `8763eea` (19), edges `d34f5b3` (29), documents-tier `4edaf05` (41); all 0 behind
  `upstream/main`; every file is under `src/`, `test/` or the changelog, credits and README, except
  `package.json` and `package-lock.json` on documents-tier (the optional `fflate` and `pdfjs-dist`).
- Gates (`npm run build` exit 0 each; `npm test` exit 1 each, as on plain upstream):

  | Branch | Tests | Pass | Fail | Skipped | Seconds | Failing, not in baseline | Of those, fail alone |
  |---|---|---|---|---|---|---|---|
  | core | 4,098 | 3,963 | 46 | 89 | 2,201 | 12 | 0 |
  | markup-build | 4,147 | 4,016 | 42 | 89 | 1,938 | 8 | 2 (the SCSS pair) |
  | edges | 4,175 | 4,045 | 41 | 89 | 2,106 | 8 | 2 (the SCSS pair) |
  | documents-tier | 4,192 | 4,066 | 37 | 89 | 1,665 | 7 | 2 (the SCSS pair) |

  The other non-baseline names were hook, git and timing tests (J07, J10, J11, D137, the 300 ms and
  400 ms budgets, `ensureGitignored`, workspace queries). Each passed when its file was run alone
  (core: J11 failed once inside an 11-file batch and passed alone twice). Two baseline names fail
  alone too (`ready probes`, `credit in the prompt hook (D57)`), as on plain upstream.
- Hand edits were needed in `core` (`cli.ts`, `build.ts`, `check.ts`, `state.ts`, `workspace-cli.ts`,
  `container.ts`, `cards.ts`, README, CHANGELOG), `edges` (`extract.ts` imports, README) and
  `documents-tier` (`build.ts`, `check.ts`, `state.ts`, `cli.ts`, `grep.ts`, `fs.ts`, README);
  `markup-build` applied cleanly. Kept as on `main`: the `structured` slot in upstream's `tierOf`,
  the native fallback in `extractEmbedded`, and `writeIfChanged` with the collision-safe card names.
  `tsc` was clean on core before its gate; the other tips built in their gates.

## Work completed

Rebases and gates only; the one commit on `main` is this file. Worktrees removed (junction first).
Open: D15, D16 and the upstream answer on whether contributions are wanted (all the operator's).

## Exact next action

Operator answers D15 and D16. Then, this stage (Sonnet 5.5, high) applies the SCSS option, restacks
markup-build, edges and documents-tier, gates each (about 100 minutes, one at a time), and pushes one
branch at a time only on a yes. Stage 23 (Fable acceptance) is separate and in the Stage 22 handoff.

```
Take over the rest of Stage 21: docs/handoffs/2026-10-26-stage-21-rebase-pr-branches.md (read it first, and AGENTS.md and docs/operator-protocol.md section 10; check your model, claude-sonnet-5-5, and effort, high, against its front matter). The operator chose for D15: <A, B or C> and for D16: <a or b>. Apply the SCSS option in commit d66e06f (use a fixup commit and an autosquash rebase), restack markup-build, edges and documents-tier onto the new tips, gate each one at a time in a worktree at a short path with main's node_modules as a junction (remove the junction with cmd rmdir before removing the worktree), compare by name with docs/baselines/upstream-4e7d0f5-failures.txt, rerun every non-baseline failure's file alone. Path-audit each branch against upstream/main. Push nothing without the operator's yes for that branch.
```

## Cost projection

Projected: Sonnet 5.5, 80 turns, 90k context, about $2.52 (quote $2.50 to $5). Actual, estimated (no
usage meter run): about 85 turns, context from about 100k to 190k (this session carried the Stage 22
start): cache reads 85 x 150k x $0.10 = $1.28; fresh 85 x 3k x 1.25 x $2.00 = $0.64; output
85 x 1.5k x $10 = $1.28; about $3.20. The remaining work: about 40 turns, about $1.60.

## Time projection

Projected 3 to 3.5 hours. Actual about 3 h 10 min (12:20 to 15:30): gates 2 h 12 min (7,910 s), rebases
and conflict work about 50 min, 25 min waiting for Stage 22's gate. Remaining: about 100 minutes of
gates plus 30 minutes of rebase; operator review 30 to 45 minutes.
