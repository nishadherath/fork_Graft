---
stage: "Stage 16: refresh the design issue and advisory texts for upstream 0.23.0"
model: claude-haiku-5-5
effort: medium
status: ready
created: 2026-10-18
from: "Fable 5.1 assessment session, 2026-10-18 (docs/assessment-2026-10-18.md, section 6)"
---

# Stage 16: refresh the design issue and advisory texts for upstream 0.23.0

## Goal

Two documents the operator will post are factually current for upstream 0.23.0
and ready to paste: `docs/upstream/design-issue.md` and
`docs/security/2026-10-15-graft-mcp-npx-launcher-advisory.txt`. Nothing is
posted or sent by this stage. Done means: every fact listed under "Verified
facts" below appears correctly in the two texts, no other line of either file
changed except where a fact required it, `git diff --stat` shows only those two
files, and the prose check in "Exact next action" passes.

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

## Files and links that matter

- `docs/upstream/design-issue.md`: the operator note above the rule, then the
  issue text. The "Shape of the pull requests" paragraph names `upstream/main`
  as the base.
- `docs/security/2026-10-15-graft-mcp-npx-launcher-advisory.txt`: the header
  block (`Upstream:`, `Versions:`), section 2 and the patch in section 8.
- `docs/assessment-2026-10-18.md` section 8: the verified facts and the commands.
- `docs/handoffs/2026-10-17...`: none; Stage 17 is the merge and runs separately.

## Verified facts (2026-10-18, assessment session)

- Upstream repository: `https://github.com/trailhq/Trail-Code` (renamed from
  `NanoNets/context-graph-engine`; the old URL redirects). Release 0.23.0 on
  2026-10-15, published as both `@nanonets/graft` and `@trailhq/trail-code`.
- The CLI keeps the `graft` name and every graft command; `trail` is a second
  name with a new layout (`.trail/cache/`). The issue should say the proposal is
  for the graft tier set and that the branches will be rebased onto 0.23.0.
- Upstream still probes PATH with `spawnSync('graft', ['--version'], { stdio:
  'ignore', timeout: 5000 })` at `src/hosts/mcp-config.ts:57` and still writes
  `npx -y @nanonets/graft mcp` (and `npx -y @trailhq/trail-code mcp` under the
  trail brand) when the probe fails. The advisory's "Versions:" line must add
  0.22.0 and 0.23.0 as affected, and its "Upstream:" line the new URL.
- Upstream open pull requests: 133 on 2026-10-18. The issue text need not say so.
- The operator's upstream item: issue #542 (the crux id echo), 2026-10-03. The
  issue text may reference it where it mentions the separate crux fix.

## Work completed

None.

## Unresolved questions

- Operator: the reporter identity and channel for the advisory (`SECURITY.md`
  names `shrish@nanonets.com` and GitHub security advisories; the repository is
  now under `trailhq`).

## Exact next action

Open `docs/upstream/design-issue.md`, change the repository facts listed above,
then the advisory's header and section 2, then run from the repository root:
`grep -n -i -E "delve|nuanced|tapestry|robust|multifaceted|landscape|worth noting|important to note" docs/upstream/design-issue.md docs/security/2026-10-15-graft-mcp-npx-launcher-advisory.txt` and
`grep -n $'—' docs/upstream/design-issue.md docs/security/2026-10-15-graft-mcp-npx-launcher-advisory.txt`,
both of which must print nothing new (lines that already existed before this
stage are upstream's quoted text and stay).

## Cost projection

Haiku 5.5, medium ($0.10 in, $0.50 out, $0.01 cache read per million under
100k tokens of prompt). 30 turns, average context 50k, 3k fresh input and 1.5k
output per turn. Cache 1.5M x $0.01 = $0.015; fresh 90k x $0.10 x 1.25 = $0.011;
output 45k x $0.50 = $0.023. About $0.05; quote $0.05 to $0.20.

## Time projection

Wall clock 15 to 30 minutes. Operator: about 15 minutes to read both texts and
post the issue, plus whatever the advisory channel needs.
