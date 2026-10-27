---
stage: "Stage 16: refresh the design issue and advisory texts for upstream 0.25.0"
model: claude-haiku-5-5
effort: medium
status: done
created: 2026-10-18
refreshed: 2026-10-26
from: "Fable 5.1 assessment session, 2026-10-18 (docs/assessment-2026-10-18.md, section 6); refreshed for 0.25.0 by a Haiku 5.5 session on 2026-10-26"
---

# Stage 16: refresh the design issue and advisory texts for upstream 0.25.0

## Goal

Two documents the operator will post are factually current for upstream 0.25.0
and ready to paste: `docs/archive/upstream/design-issue.md` and
`docs/security/2026-10-15-graft-mcp-npx-launcher-advisory.txt`. Nothing is
posted or sent by this stage. Done means: every fact listed under "Verified
facts" below appears correctly in the two texts, no other line of either file
changed except where a fact required it, `git diff --stat` shows only those two
files and this handoff, and the prose checks in "Exact next action" pass.

## Decisions already made

- The issue is opened by the operator (plan decision D5 A, 2026-10-13), after
  this refresh, through the GitHub REST API with the credential-manager token
  (memory note `gh-cli-absent-use-gcm-token`). Not by this stage.
- The advisory's reporter name, contact and vendor-notification lines stay as
  placeholders in square brackets; only the operator fills them (assessment D10).
- Edit only facts. Do not restructure, shorten or reword either document.
- Prose conventions of `AGENTS.md` rule 7: Australian English, no em-dashes,
  none of the persona's banned words (delve, nuanced, tapestry, robust,
  multifaceted, landscape, "it is worth noting", "it is important to note").
- Recorded 2026-10-26: the advisory's section 8 patch is left as written. It
  does not apply to upstream 4e7d0f5; the section now says so. Rebasing the
  patch is a separate piece of work for the operator to schedule (see Open
  questions).

## Files and links that matter

- `docs/archive/upstream/design-issue.md`: the operator note above the rule, then the
  issue text. The "Shape of the pull requests" paragraph names `upstream/main`
  as the base.
- `docs/security/2026-10-15-graft-mcp-npx-launcher-advisory.txt`: the header
  block (`Upstream:`, `Versions:`), sections 2, 3, 4 and 8.
- `docs/handoffs/2026-10-25-stage-20-merge-upstream-0.25.0.md`: the merge that
  put `upstream/main` at 0.25.0 on `main`.
- `src/hosts/mcp-config.ts` on `upstream/main`: the probe at line 57 and the
  fallback constant at line 49 (read with `git show upstream/main:...`).

## Verified facts (rechecked 2026-10-26 against upstream/main 4e7d0f5, release 0.25.0)

- Upstream repository: `https://github.com/trailhq/Trail-Code` (renamed from
  `NanoNets/context-graph-engine`; the old URL redirects). Release 0.25.0 is
  published as both `@nanonets/graft` and `@trailhq/trail-code`
  (`scripts/pack-trail.mjs`). The `trail` bin is still shipped.
- The CLI keeps the `graft` name and every graft command; `trail` is a second
  name with a new layout (`.trail/cache/`). The issue says the proposal is for
  the graft tier set and that the branches will be rebased onto 0.25.0.
- Upstream still probes PATH with `spawnSync('graft', ['--version'], { stdio:
  'ignore', timeout: 5000 })` at `src/hosts/mcp-config.ts:57` and still writes
  `npx -y @nanonets/graft mcp` (constant at line 49; `npx -y @trailhq/trail-code
  mcp` at line 53 under the trail brand) when the probe fails.
- The probe and the fallback are unchanged from the 0.22.0 release commit
  `d45a801` to `4e7d0f5`. `git log upstream/main -- src/hosts/mcp-config.ts`
  shows no later commit. The same code is in tags v0.19.0 to v0.21.1 too; those
  were not tested for the advisory. The advisory's "Versions:" line is now
  0.21.1 through 0.25.0.
- Section 8's patch was written against `fe30ead`. `git apply --check` against
  `4e7d0f5` (temporary index, no checkout) fails on `CHANGELOG.md`,
  `src/hosts/mcp-config.ts` and `src/upkeep.ts`.
- Not rechecked here: the Windows `spawnSync` behaviour itself (the advisory's
  observations were made on Node 26.7.0 at 0.21.1). The code is unchanged, so
  the observations still describe it, but no run was done in this stage.
- Upstream open pull requests: 133 on 2026-10-18. The issue text need not say so.
- The operator's upstream item: issue #542 (the crux id echo), 2026-10-03. The
  issue text may reference it where it mentions the separate crux fix.

## Work completed

- `docs/archive/upstream/design-issue.md`: "release 0.23.0 also ships it as `trail`"
  now reads 0.25.0; the "Shape of the pull requests" sentence now names release
  0.25.0 twice (base and rebase target). 2 lines.
- `docs/security/2026-10-15-graft-mcp-npx-launcher-advisory.txt`: `Versions:`
  now 0.21.1 through 0.25.0 with the commit and checked date; section 2 trail
  brand line now release 0.25.0; section 3.1 gives the spawn at line 57 of
  4e7d0f5; section 3.2 gives the constant at line 49 of 4e7d0f5; section 4
  checked at 4e7d0f5 on 2026-10-26; section 8's first sentence now says the
  patch was written against `fe30ead` and does not apply to `4e7d0f5`, naming
  the three files. The `Upstream:` line already had the new URL. Placeholders
  untouched.
- Prose checks: the banned-word grep prints nothing. The em-dash grep prints
  one line, `advisory.txt:434`, which is inside section 8's quoted upstream test
  code and was there before this stage.
- Commit: only the two texts and this handoff, on `main`. The other session's
  `src/` and `test/` changes in the same checkout were left alone.

## Open questions

- Operator, before the advisory is sent: the reporter identity and channel
  (`SECURITY.md` names `shrish@nanonets.com` and GitHub security advisories;
  the repository is now under `trailhq`), and the vendor notification lines.
- Operator, a decision: rebase the section 8 patch onto `4e7d0f5` (a separate
  small stage for a Sonnet session, with the gate), or send the advisory with
  the patch marked as not applying to 0.25.0. The first is recommended, because
  the advisory tells the vendor the fix exists; the second costs nothing now.
- Operator, a decision: whether the advisory's `Versions:` line should also say
  that tags v0.19.0 to v0.21.1 carry the same code (untested). This stage
  leaves it out.

## Exact next action

Operator: read the two texts, fill the advisory placeholders, post the issue
(plan decision D5 A) and then send the advisory through the channel chosen.
Stage 21 waits for the upstream answer to the issue.

Checks, run from the repository root (both must print nothing new):
`grep -n -i -E "delve|nuanced|tapestry|robust|multifaceted|landscape|worth noting|important to note" docs/archive/upstream/design-issue.md docs/security/2026-10-15-graft-mcp-npx-launcher-advisory.txt`
and
`grep -n $'—' docs/archive/upstream/design-issue.md docs/security/2026-10-15-graft-mcp-npx-launcher-advisory.txt`
(the em-dash hit at `advisory.txt:434` is upstream's quoted test code and stays).

## Actuals

- Model and effort: the session checked its model against the front matter
  (`claude-haiku-5-5`, matched). Effort could not be read from inside the session;
  `medium` is taken from the front matter.
- Turns: about 12 tool-call turns. Upstream reads were 5 `git show` / `git log`
  calls and 1 temporary-index `git apply --check`; the rest were edits and checks.
- Cost, by the method in "Cost projection": about $0.01 (estimated from turns and
  context, not metered). Within the $0.05 to $0.20 quoted.
- Time: about 15 minutes wall clock. Operator review still to come.

## Cost projection

Haiku 5.5, medium ($0.10 in, $0.50 out, $0.01 cache read per million under
100k tokens of prompt). 30 turns, average context 50k, 3k fresh input and 1.5k
output per turn. Cache 1.5M x $0.01 = $0.015; fresh 90k x $0.10 x 1.25 = $0.011;
output 45k x $0.50 = $0.023. About $0.05; quote $0.05 to $0.20. Actual, see above.

## Time projection

Wall clock 15 to 30 minutes. Operator: about 15 minutes to read both texts and
post the issue, plus whatever the advisory channel needs.

## Next stage

- Next stage: Stage 21, rebase the five pull-request branches onto upstream
  0.25.0 and open the pull requests. Model: claude-sonnet-5-5, effort: high.
  It waits for the operator to post the issue and for the upstream answer;
  do not start it before then.
- Kickoff prompt:

```text
Take over Stage 21 of docs/assessment-2026-10-18.md (section 6, item 5): rebase the five pull-request branches onto upstream/main at release 0.25.0. First check that you are claude-sonnet-5-5 at high effort, as the Stage 21 row says, and stop on a mismatch. Read docs/handoffs/2026-10-25-stage-20-merge-upstream-0.25.0.md and docs/handoffs/2026-10-18-stage-16-upstream-texts-refresh.md (its "Open questions" hold the advisory patch decision). Do not start until the operator has posted the design issue and given you the upstream answer; if they have not, stop and say so. Use upstream/main as the base, never main; commit only the feature paths; run the gate (npm run build && npm test) on each branch in turn; push nothing unless the operator says so.
```
