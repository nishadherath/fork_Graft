---
stage: "Stage 5: upstream texts and branch audits for the five pull-request branches"
model: claude-haiku-5-5
effort: medium
status: ready
created: 2026-10-13
from: "Opus 5.5 Stage 4 session (documents tier), 2026-10-13"
---

# Stage 5: upstream texts and audits

First confirm your own model and effort match the front matter (session tool,
`self`); if not, stop and say which to pick. Read `AGENTS.md`, the plan's sections
5 and 6 (`docs/plan-file-type-indexing-2026-10-13.md`) and the Stage 4 handoff.
Do not edit `src/` or `test/`. Do not push.

## Goal

Every pull-request branch audited and ready for the operator to push, and the
texts the operator pastes written: one design-issue body (D5 A) and one
pull-request description per branch. Done when `docs/upstream/` holds those six
Markdown files, each branch's audit result is recorded below, and the files are
committed on `main`.

## Decisions already made

- D1 to D7 stand (plan section 6). D5 A: the design issue goes first; the operator
  opens it and the pull requests by hand.
- Branches, stacked in this order, each cut from `upstream/main`:
  `pr/crux-id-echo`, `pr/structured-tier-core`, `pr/structured-tier-markup-build`,
  `pr/structured-edges`, `pr/documents-tier`.
- Texts follow AGENTS.md prose rules: Australian English, no em-dashes, none of the
  persona's banned words. Each description ends with the attribution line the
  session's system reminder gives for pull requests.

## Files and links that matter

- CHANGELOG.md "Unreleased" and README.md (the structured-tier section and table):
  the user-facing facts; copy, do not restate differently.
- Commit messages on each branch: the gate counts and what each commit did.
- `docs/handoffs/2026-10-13-stage-{1,2,3,4}-*.md`: verified facts per stage.

## Verified facts

- `pr/documents-tier` = `pr/structured-edges` + 12 cherry-picked Stage 4 commits;
  `git log upstream/main..pr/documents-tier --stat` touches only `src/`, `test/`,
  `README.md`, `CHANGELOG.md`, `package.json` and `package-lock.json` (Stage 4
  session, 2026-10-13).
- Final gate on `stage-4/documents`: 1,489 tests, 1,484 pass, 0 fail, 5 skipped.
- npm installs optionalDependencies by default: pdfjs-dist 41 MB, its
  @napi-rs/canvas 37 MB, fflate 0.8 MB (measured on Windows).

## Work completed

Nothing yet in Stage 5.

## Unresolved questions

The operator's decision, needed before the documents pull request is described:

```
Decision:      how the documents tier's converters are installed
Options:       A keep optionalDependencies (installed by default)
               B peerDependencies marked optional (installed only on request)
               C drop them from package.json; the refusal says what to install
Pros and cons: A works out of the box; every install grows by about 79 MB,
                 which D4 assumed would not happen
               B install stays small; users run one npm command to enable;
                 npm 7+ warns about optional peers only when versions clash
               C smallest diff; no version pin travels with graft, so the
                 refusal's `npm install pdfjs-dist` gets a Node 22-only major
Blast radius:  A every user's disk and install time; B and C only users who
               pass --documents, plus one line in the README
Recommended:   B, because the tier is opt-in and its cost should be too, and
               the pin (pdfjs-dist 5.6.205, the last for Node 20) still travels
```

- A change from A needs a small Opus or Sonnet session (package.json, the
  refusal text, README); it is not Haiku work.

## Exact next action

Run `git log upstream/main..pr/crux-id-echo --stat` and record which paths it
touches, then repeat for the other four branches in the order above.

## Cost projection

Haiku 5.5 at $0.10 in, $0.50 out, $0.01 cache read per million tokens; 40 turns,
average context 60k, 3k fresh input and 2k output per turn: cache 2.4M x $0.01 =
$0.02; fresh 120k x $0.125 = $0.02; output 80k x $0.50 = $0.04; about $0.10.
Quote $0.10 to $0.50.

## Time projection

30 to 45 minutes. Operator review: about 30 minutes for six texts, plus the
footprint decision above.
