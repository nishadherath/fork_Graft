---
stage: "Stage 6: adversarial acceptance of Stages 1 to 5"
model: claude-fable-5-1
effort: high
status: ready
created: 2026-10-13
from: "Haiku 5.5 Stage 5 session (upstream texts and audits), 2026-10-13"
---

# Stage 6: adversarial acceptance

First confirm your own model and effort match the front matter (session tool,
`self`); if not, stop and say which to pick in the model menu. Set the status to
`in-progress` on starting, `done` on finishing, in this file.

## Goal

An acceptance report that tries to break the structured tier and the documents tier
on the cases the plan names, and says for each whether it held. Done when the report
exists at `docs/acceptance-2026-10-13.md` (a new file, prose rules apply), every case
below has a result with the command that produced it, and every failure is either
fixed on its branch or listed for the operator. Nothing pushed.

## Decisions already made

- D1 to D7 stand (plan section 6). Do not reopen D1 (opt-in in the first pull request),
  D2 (hand scanners for Markdown and TOML), D3 (rendering with line spans), D4 as an
  open question for the operator (see below), D5 (design issue first).
- The branches and their tips are as recorded in
  `docs/handoffs/2026-10-13-stage-5-upstream-texts.md` (audit table). Re-check each tip
  before testing; if a tip has moved, record the new tip and test that one.
- The crux branch is independent of the structured stack. Test it separately.
- Work in a `git worktree` per branch, so the `main` working tree is not touched.
  The gate is `npm ci --ignore-scripts` plus the Kotlin binary (protocol section 10),
  then `npm run build && npm test`. About 7 minutes per run.

## Files and links that matter

- `docs/plan-file-type-indexing-2026-10-13.md` section 5, row 6 (the cases) and
  section 4 (the span and locator contract).
- `docs/upstream/` (the six texts): where the text makes a claim, test it.
- `docs/handoffs/2026-10-13-stage-5-upstream-texts.md` (audit, findings 1 to 4).
- `docs/handoffs/2026-10-13-stage-4-documents.md` (the converters' verified facts).
- `AGENTS.md` non-negotiables 4 (exact locator) and 5 (deterministic and keyless).

## Cases (plan section 5, row 6)

1. Span exactness on fixtures with known line numbers, for every family in the
   structured tier: `--source` prints exactly those lines.
2. Windows paths: the same build from `D:\` and from a path with spaces; `relPosix`
   used throughout; the tests pass under cmd.exe (`scripts/run-tests.mjs`).
3. A 50 MB PDF: the documents size cap refuses it with the warning line, and the cap
   setting `GRAFT_DOCUMENT_MAX_BYTES` changes that.
4. A 10,000-key JSON: four levels deep, 500 keys per file, shallowest first; the build
   time and the card size are recorded.
5. Secrets in config: a key named like a credential, a long opaque value, a `.pem`, a
   `.env`, a lockfile. None may appear in a signature or search text, and none may be
   indexed as content.
6. A Markdown file with every CommonMark heading form: ATX with and without a closing
   run of `#`, setext, headings inside fenced code and inside block quotes, a heading
   with trailing spaces. Each section's span must be the heading's real lines.
7. The workflow admit (D7): `.github/workflows/*.yml` indexed with the tier on, and
   `.github/` other files not indexed.
8. The concept pass with `--deep` on a repository where the tier is on: the default
   file list includes the structured files; `--extensions` still means exactly that
   list. Record the number of summary calls.

## Decisions for the operator (do not decide these here)

- **D4, install footprint.** Options A keep `optionalDependencies` (about 79 MB),
  B optional peers, C drop them. Recommended B. Blast radius: every install under A.
  Report what the documents text would need under each option; do not change
  `package.json`.
- **Rule 3 conflict.** `pr/documents-tier` changes `package.json` and the lockfile,
  which AGENTS.md rule 3 does not allow in a pull-request branch.
- **README line 415.** Reads "(the default)" for `--no-structured`; the tier is off by
  default. Report it; do not fix it.
- **Documents gate figure.** Commit `3aa52c1` says 1,489 tests; the Stage 4 handoff
  says 1,517. The acceptance gate run settles which is right; report the count you see.

## Work completed

Nothing yet in Stage 6.

## Unresolved questions

- Operator: D4, and the rule 3 exception (see above).
- Operator: whether the README fix goes in before the core pull request is opened.

## Exact next action

`git worktree add ../fork_graft-accept-core pr/structured-tier-core`, then the gate
there, then case 1. Record the tip hash before testing.

## Cost projection

Fable 5.1, high (protocol section 2: $10 in, $50 out, $0.25 cache read per million).
Assumptions: 120 turns, average context 150k, 3k fresh input and 2k output per turn.
Cache 120 x 150k = 18M x $0.25 = $4.50. Fresh 120 x 3k = 360k x $10 = $3.60.
Output 120 x 2k = 240k x $50 = $12.00. Total about $20. At 80 turns about $13;
at 150 turns about $25. The plan's quote was $10 to $20; the gate runs (each about
7 minutes of tool time, not model time) add turns, so $13 to $25 is the range to
quote. Estimate.

## Time projection

Wall clock 60 to 120 minutes (protocol: Fable 45 to 120 minutes), dominated by gate
runs in worktrees. Operator review of the report: about 30 minutes.
