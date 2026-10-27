---
stage: "Stage 7: acceptance fixes on the structured branches, README line, stack rebase"
model: claude-sonnet-5-5
effort: high
status: done
created: 2026-10-13
from: "Fable 5.1 Stage 6 session (adversarial acceptance), 2026-10-13"
---

# Stage 7: acceptance fixes and the stack rebase

First confirm your own model and effort match the front matter (session tool,
`self`); if not, stop and say which to pick in the model menu. Load
`ENGINEERING_PERSONA.md` (the only edition checked in; no Sonnet edition exists
in this repository) and `ENGINEERING_PERSONA_LANGUAGES/node-ts-js.sonnet.md`.
Set the status to `in-progress` on starting, `done` on finishing, in this file.

## Goal

The four findings of `docs/acceptance-2026-10-13.md` section 5 fixed on the
branches that own them, each with a test that fails first; the secret rule
widened if the kickoff prompt says so (section 6, first decision); the three
upper branches rebased onto the fixed core; `git log upstream/main..<branch>
--name-only` still showing only the allowed paths; the gate green on all five
branches, one at a time, with counts quoted in the commit messages and in
`docs/archive/upstream/*.md`. Nothing pushed.

## Decisions already made

- D1 to D7 stand. Findings 1 to 4 are fixed in this stage (acceptance section
  6, second decision, option A).
- Branch ownership: findings 1 (`yaml.ts`), 2 (`markdown.ts`) and 4
  (`README.md`) on `pr/structured-tier-core`; finding 3 (`src/context/build.ts`)
  on `pr/structured-edges`; the secret rule (`shared.ts`) on core.
- Gates run one at a time: parallel `npm test` runs time out the MCP and CLI
  tests on this machine (acceptance section 3).
- Rebase order: markup onto the new core tip, edges onto markup, documents onto
  edges; `git rebase --onto` per branch, then the gate on each.

## Files and links that matter

- `docs/acceptance-2026-10-13.md` sections 5 and 6 (what to fix, with the fix
  sketch per finding) and `docs/acceptance/2026-10-13/make-fixtures.mjs` (the
  fixture; `headings/forms.md` lines 44 to 46 and `cfg/app.yaml` for the two
  scanner findings; the `yaml-probe` in section 5 item 1).
- `src/graph/structured/yaml.ts` (block node end rows), `markdown.ts` (the
  scan loop, `para` state), `shared.ts` (`SECRET_NAME`, `OPAQUE_VALUE`),
  `src/context/build.ts` (`listContextFiles`), `src/graph/source-files.ts`
  (`sourceWalkOptions`).
- Tests to extend: `test/structured-spans.test.ts` or the YAML family file,
  the Markdown scanner test, `test/structured-deep.test.ts`, the secret test.
- `docs/archive/upstream/pr-structured-tier-core.md`, `pr-structured-edges.md`,
  `pr-documents-tier.md`: update tips, gate figures and the secret-rule sentence.

## Verified facts

- Sequential gates at the current tips, 2026-10-13, Node 26.7.0: see the table
  in `docs/acceptance-2026-10-13.md` section 3. The documents branch counts
  1,517 tests, not the 1,489 its commit message says.
- The YAML over-claim reproduces with a 12-line file (`a:` mapping then a
  column-0 comment after a blank line): `b` L5-L10 where L5-L8 is right.
- The HTML-block heading reproduces with `<div>` / `# text` / `</div>`.
- `listContextFiles` walks with the follow options only; `sourceWalkOptions`
  carries the admit list and the documents cap.

## Work completed

All on branches, nothing pushed. Commits, gate counts and the reviewer notes
are in `docs/acceptance-2026-10-13.md` section 8.

- Core (`pr/structured-tier-core`, tip `d716f05`): `3840921` YAML span stops
  before the comment that introduces the next key; `e054a1d` raw HTML blocks
  hold no headings (CommonMark start conditions 1 and 3 to 7); `82bf96c` secret
  rule option C with `test/structured-secrets.test.ts` (one test per planted
  value); `d716f05` README `--no-structured` line. Gate 1,443 tests, 1,438
  pass, 0 fail, 5 skipped.
- Markup rebased, tip `aa5fe4e`: 1,492 tests, 1,487 pass, 0 fail, 5 skipped.
- Edges rebased (one conflict, `markdown.ts`, resolved by keeping both the HTML
  block state and the link recorder), tip `9c6273d`: `efeb238` concept pass
  walks with the workflow admit; `9c6273d` guard test. 1,520 tests, 1,515 pass,
  0 fail, 5 skipped.
- Documents rebased (one README conflict, resolved), tip `9cd4e9b`: 1,537
  tests, 1,532 pass, 0 fail, 5 skipped.
- `docs/archive/upstream/*.md` carry the new tips, gate figures and the secret-rule
  sentence. Path audit: only the allowed paths on every branch, plus
  `package.json` and `package-lock.json` on documents.
- Worktrees left in place beside the repository: `fork_graft-stage7-core`,
  `-markup`, `-edges`, `-docs` (the first three share core's `node_modules`
  through a junction: run `cmd /c rmdir node_modules` in markup and edges first,
  or `git worktree remove` may delete through the junction). Remove them once
  the branches are pushed.

## Unresolved questions

- Operator: PROSETOKEN88-style secrets in Markdown prose still reach the
  extract cache; the rule covers keys only. Decide whether prose needs a rule.
- Operator: the AGENTS.md rule 3 exception for `package.json` on
  `pr/documents-tier` (unchanged by this stage).

## Exact next action

Stage 8, `docs/handoffs/2026-10-14-stage-8-fixes-onto-main.md`: cherry-pick the
six fix commits onto `main`, gate, sync the global install.

## Cost projection

Sonnet 5.5, high ($2.00 in, $10.00 out, $0.20 cache read per million).
Assumptions: 80 turns, average context 100k, 3k fresh input and 2k output per
turn. Cache 80 x 100k = 8M x $0.20 = $1.60. Fresh 80 x 3k = 240k x $2.50 =
$0.60. Output 80 x 2k = 160k x $10 = $1.60. About $4; quote $3 to $6. Estimate.

## Time projection

Wall clock 60 to 90 minutes: 20 to 45 minutes of model time plus five
sequential gates of 4 to 7 minutes each. Operator review of the diffs and
the rebased stack: about 20 minutes.
