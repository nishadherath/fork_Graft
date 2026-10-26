---
stage: "Stage 25: close out the own-build pivot; decisions D17 to D23, the remaining fixes, release and tarball"
model: claude-sonnet-5-5
effort: high
status: pending
created: 2026-10-26
from: "Stage 23 session (Fable 5.1, local_60e06b5a) after Stage 24 (b3db337) on the operator's instruction of 2026-10-26"
---

# Stage 25: close out the own-build pivot

Stage 24 made the fork the operator's own build: `main` and `v0.25.0-nishadherath.1` are on
`origin`, the `pr/*` stack is gone. What remains is the text that still describes an
upstreaming fork, three small findings from Stage 23, the gate-lock question, and the release
tarball that Stage 24 did not produce. The operator asked that every decision below be put to
them first, in the dispatched session, before any of the work starts.

## Goal

The operator has answered D17 to D23 in this session. Every answered item is done: text and
code committed on `main` with a test that fails first for each code change, the gate green under
D13, a release tagged and pushed to `origin` if the answers call for one, the release tarball in
`D:\Code\Claude\fork_graft_releases\`, the global install synced, no unused branch or worktree
left, and this handoff at status `done`.

## Decisions already made (not to reopen)

- 2026-10-26, operator: the fork is its own build; SCSS stays through the vendoring; no
  upstream pull requests; `main` is the only branch; pushes go to `origin` only.
- One gate at a time, judged by name against `docs/baselines/upstream-4e7d0f5-failures.txt`.
- The release tarball convention: `npm pack --ignore-scripts --pack-destination
  D:\Code\Claude\fork_graft_releases` after `npm run build`, giving
  `nanonets-graft-<version>.tgz` beside the four earlier ones (0.21.1-nishadherath,
  0.21.1-nishadherath.1, 0.23.0-nishadherath, 0.25.0-nishadherath). No tarball exists yet for
  0.25.0-nishadherath.1.
- Never run a `graft` command inside this checkout; smoke tests go in a temporary folder.

## Decisions for the operator (ask first, in the five-part format, then wait)

```
D17 Decision:      what AGENTS.md says the fork is for
    Facts:         the purpose paragraph says fixes are "upstreamed by pull request";
                   non-negotiable 3 says upstream branches are cut from upstream/main and
                   lists what a PR branch may carry. Every session loads this file first.
    Options:       A reword the purpose paragraph to "the operator's own build of
                     @nanonets/graft, merging upstream releases when one matters", and
                     replace rule 3 with the merge rule: upstream is merged into main by a
                     recorded stage, never rebased onto, and no pr/* branches are kept
                   B delete rule 3 and leave the purpose paragraph as it is
                   C leave AGENTS.md unchanged
    Pros and cons: A: the file matches what the fork now is; a future session cannot
                     mis-start a PR stack. B: half the fix; the paragraph still promises
                     pull requests. C: nothing to do, and the first instruction every
                     session reads is wrong.
    Blast radius:  AGENTS.md only; every later session's first instruction.
    Recommended:   A.

D18 Decision:      how often upstream is merged into main
    Facts:         Stage 17 merged 0.23.0 for about $6.50 and two hours plus review; the
                   0.25.0 merge followed; upstream publishes often (168 commits between
                   the crux fix and 0.25.0).
    Options:       A every upstream release tag, as a Stage on Opus 5.5
                   B only when the operator names a release that carries something wanted
                   C never again; the fork stands alone
    Pros and cons: A keeps the gap small and each merge cheap, at a recurring cost. B pays
                   only for value, but a long gap makes the next merge dearer (the 12
                   conflicts of Stage 17 came from two releases). C is free until the fork
                   needs an upstream fix it cannot take.
    Blast radius:  future spend and the merge conflicts of future stages; nothing now.
    Recommended:   B, with the rule written into AGENTS.md under D17 option A.

D19 Decision:      Stage 23 finding 6, the retrieval question set pins absolute spans
    Facts:         .eval/retrieval-questions.json holds 20 questions whose answers carry
                   symbol, file and span (for example src/ai/crux.ts#resolveTargetId,
                   L206-L218); scripts/retrieval-eval-score.mjs scores a hit by span, and
                   test/retrieval-eval.test.ts fails whenever an edit above a pinned symbol
                   moves its lines (Stage 23's two-line import did).
    Options:       A resolve each answer's span from its symbol in the current wiring at
                     test time; the pinned span stays as the recorded answer and the test
                     reports when the two differ
                   B store the symbol only and drop the span field
                   C keep absolute pins and move them by hand after every edit
    Pros and cons: A: the test survives edits and still records what was true; a renamed
                   symbol fails loudly, which is right. B: simpler, but loses the record
                   and cannot score a whole-file answer. C: no code change; every edit
                   above a pin costs a gate.
    Blast radius:  the two eval scripts and their test; the question file's schema under B.
    Recommended:   A.

D20 Decision:      Stage 23 finding 7, no `status` command under the graft brand
    Facts:         src/cli.ts registers `status` only when brand() is "trail"; under
                   `graft` it is "unknown command", so D14's status row and `status --json`
                   cannot be reached from the global install.
    Options:       A register `status` under both brands (one line of the command table,
                     a test that runs it under GRAFT branding)
                   B leave it trail-only and strike the status claim from D14's text in
                     docs/operator-protocol.md
                   C nothing
    Pros and cons: A gives the operator the D14 row they were promised, at the cost of one
                   more command under graft. B keeps the two brands as upstream has them
                   and makes the protocol truthful. C leaves a documented feature
                   unreachable.
    Blast radius:  A: the CLI help under graft; B: one paragraph of the protocol.
    Recommended:   A.

D21 Decision:      the gate.lock clause in kickoff prompts
    Facts:         the Stage 22 and 23 prompts said to check for a gate.lock in "the shared
                   notes folder"; no such file or folder exists anywhere under
                   D:\Code\Claude; the check that works is the process list for a
                   scripts/run-tests.mjs node process.
    Options:       A name a folder (for example D:\Code\Claude\.gates) and have
                     scripts/run-tests.mjs create and remove the lock itself, waiting while
                     another gate holds it
                   B drop the clause; sessions poll the process list
                   C both: the script takes the lock and sessions still poll
    Pros and cons: A works across worktrees and sessions and needs no polling; a crashed
                   gate leaves a stale lock (the script can check the pid). B costs nothing
                   and is what works today, but each session re-invents the poll. C belt
                   and braces, two mechanisms to keep right.
    Blast radius:  A and C: scripts/run-tests.mjs and its test; every gate on the machine.
    Recommended:   A, with a stale-lock check by pid and the folder named in the protocol.

D22 Decision:      the roadmap, which ends at Stage 23 in docs/assessment-2026-10-18.md
    Options:       A add a short dated section to that assessment recording the own-build
                     pivot, Stages 24 and 25, and the standing merge rule
                   B a new assessment on the operator's six-question brief (protocol
                     section 1.1), a Fable 5.1 stage of about two hours
                   C nothing; the handoffs are the record
    Pros and cons: A: cheap and the roadmap stays one document. B: a full re-read of the
                   project, warranted when the next body of work is unknown, not for a
                   closing note. C: the next session has to reconstruct the state from
                   handoffs.
    Blast radius:  docs only.
    Recommended:   A.

D23 Decision:      what the release at the end of this stage is
    Facts:         v0.25.0-nishadherath.1 is tagged and pushed with no tarball in the
                   releases folder. D19 option A, D20 option A and D21 option A each change
                   code or scripts that the global install runs.
    Options:       A if any code or script change lands, release 0.25.0-nishadherath.2
                     (version bump, dated CHANGELOG section, annotated tag, push) and pack
                     that; otherwise pack 0.25.0-nishadherath.1 as it stands
                   B pack 0.25.0-nishadherath.1 now and leave later changes untagged on main
                   C always cut a new release at the end of a stage
    Pros and cons: A: the tarball always matches a tag. B: the global install and the tag
                   drift apart. C: tags for docs-only changes.
    Blast radius:  one tag and one tarball.
    Recommended:   A.
```

## Exact next action, in order

1. Check model (`claude-sonnet-5-5`) and effort (`high`) against this front matter; stop on a
   mismatch. Read `AGENTS.md`, `docs/operator-protocol.md` (sections 1.1, 6, 7, 10), this file
   and the Stage 23 and 24 handoffs.
2. Put D17 to D23 to the operator in your first message, each in the five-part format above
   with the recommendation, and wait. Start no work before the answers.
3. Do the answered items. Each code change has a test that fails first: D19 in
   `scripts/retrieval-eval-score.mjs`, `scripts/retrieval-eval.mjs` and
   `test/retrieval-eval.test.ts`; D20 in `src/cli.ts` and a new test under `test/`; D21 in
   `scripts/run-tests.mjs` and a test. D17, D18 and D22 are text in `AGENTS.md`,
   `docs/operator-protocol.md` and `docs/assessment-2026-10-18.md`. A CHANGELOG entry per
   user-visible change. Australian English, no em-dashes.
4. If D23 calls for a release: `package.json` and both `package-lock.json` version fields to
   `0.25.0-nishadherath.2`, CHANGELOG heading `## 0.25.0-nishadherath.2 (<date>)`, commit
   `chore(release): version 0.25.0-nishadherath.2`.
5. Gate: `npm run build && npm test` (poll the process list first); D13 by name; rerun any
   non-baseline failure's file alone; quote the counts.
6. Commit everything on `main`. If releasing: annotated tag `v0.25.0-nishadherath.2`, then
   `git push origin main` and `git push origin v0.25.0-nishadherath.2`; otherwise `git push
   origin main`. Confirm with `git ls-remote origin`.
7. After the confirmation: `git branch -a` and `git worktree list`; delete anything other than
   `main` that has no unique content, locally and on `origin`; `git worktree prune`. Record it.
8. Tarball: `npm pack --ignore-scripts --pack-destination D:\Code\Claude\fork_graft_releases`
   from the built tree at the tagged commit; confirm the file name and that `tar -tzf` lists
   `package/dist/bin/graft.js` and `package/dist/vendor/wasm/tree-sitter-scss.wasm`.
9. `node scripts/sync-global.mjs`; quote its counts; `graft --version` from a temporary folder.
10. Update this handoff (status `done`, answers recorded, counts, deletions), commit, push.
    End the report with the next stage's model, effort and kickoff prompt, or say there is none.

## Cost projection

Sonnet 5.5, high: about 70 turns at 90k average context. Cache reads 70 x 90k x $0.10 = $0.63;
fresh 70 x 3k x 1.25 x $2.00 = $0.53; output 70 x 1.5k x $10 = $1.05. About $2.20 (quote $2 to $4).

## Time projection

Waiting for the operator's seven answers, then about two hours: 60 minutes of text and code,
one gate of about 25 to 41 minutes, 20 minutes of release, tarball, sync and clean-up.
Operator review about 20 minutes plus the decision time.
