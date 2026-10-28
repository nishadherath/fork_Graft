---
stage: "Stages 35 to 37: dispatch for the rest of the trail-parity roadmap"
model: claude-opus-5-5
effort: high
status: ready
created: 2026-10-28
from: "session-dispatch run by the Stage 33 session (claude-sonnet-5-5); roadmap is section 5 of docs/assessment-2026-10-27-trail-parity.md"
---

# Stages 35 to 37: dispatch

## Goal

Run Stage 35 (Opus 5.5, high), then 36 (Haiku 5.5, medium), then 37 (Fable 5.1, xhigh), each in a
fresh session at its own class. Stage 35 takes over from this handoff; its kickoff below corrects the
Stage 34 one.

## Decisions already made

- D28 A, D29 B, D30 A, D31 A (analysis sections 4 and 5). Stage 34 is done (`f1b7149`, `2d8b47b`).
- All three remaining stages are fresh sessions: the class changes, and a session never re-classes itself.
- No stage pushes. The operator pushes `main` and the tag, and drops `GRAFT_NO_TRAIL_SWITCH` last.

## Files that matter

`docs/assessment-2026-10-27-trail-parity.md` section 5 rows 35 to 37; `docs/operator-protocol.md`
sections 6, 7 and 10; `docs/baselines/upstream-4e7d0f5-failures.txt` (D13).

## Verified facts (2026-10-28, from a scratch folder under `$env:TEMP`)

- `graft --version` and `trail --version` both print `0.25.0-nishadherath.5`. The operator's Stage 33
  reinstall is done. `GRAFT_NO_TRAIL_SWITCH` is `1` at user level.
- This checkout has already been through `trail init`, uncommitted: `git status` shows deleted
  `.claude/helpers/graft-hooks.cjs`, `.claude/helpers/graft-statusline.cjs`, `.claude/skills/graft/SKILL.md`
  and `.mcp.json`; modified `.trail/.gitignore`; untracked `.trail/README.md` and the trail hook script.
  `.claude/settings.json` now names the trail hook and no graft entry. Who ran it is unknown.
- `.claude/settings.json` is git-ignored, so its pre-init text cannot be backed up now. Stage 35's
  "back up first" step is moot; record that, do not reconstruct it.
- A Bash call whose text names the trail hook script was refused by the hook itself ("hook scripts run
  only from the host's hooks"). Read those paths with Read, Grep and Glob.
- The roadmap prices Stages 35 to 37 at $12.89 on a 100k average context. It omits the fresh session's
  baseline (84,803 tokens measured here: total less Messages). Re-priced below: about $24.11.

## Work completed

This handoff and the decision record below. No source change.

## Unresolved questions

- The nine other repositories are not listed in the documents I read. The operator names them.
- Who ran `trail init` here, and did it back up `settings.json`? Stage 35 asks the operator.

## Exact next action

Open a fresh session on **Opus 5.5 (`claude-opus-5-5`), effort high** (a chip cannot set either; pick
them in the model menu), and paste:

```
You are the Stage 35 session for D:\Code\Claude\fork_graft. Check you are claude-opus-5-5 at effort high; stop on a mismatch. Read AGENTS.md, ENGINEERING_PERSONA.md, ENGINEERING_PERSONA_LANGUAGES/node-ts-js.opus.md, docs/operator-protocol.md and docs/handoffs/2026-10-28-stages-35-to-37-dispatch.md (it corrects the Stage 34 kickoff), then section 5 row 35 of docs/assessment-2026-10-27-trail-parity.md. From a scratch folder under $env:TEMP check trail --version and graft --version both print 0.25.0-nishadherath.5 and $env:GRAFT_NO_TRAIL_SWITCH is 1; stop and report if not. This checkout has already been through trail init, uncommitted (see the handoff's verified facts): read the tree and .claude/settings.json and say what is missing before you run trail init here again. Task, D29 B moves 1 and 2: run trail init in a fresh scratch git repository and verify the layout; then verify this checkout's result (the trail hook script, the one-line settings.json change, the removed .mcp.json server and graft skill, the map at .trail/cache/), the hooks, the statusline, the [trail] footers in trail status, the absence of MCP tools, and the fork tests under both brands; add the trail layout test (D31 A). Read the hook script's path with Read, Grep or Glob, never Bash. Gate: npm run build && npm test, judged under D13 against docs/baselines, one gate alone in the background. Commit once with explicit paths and Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>. Do not push. Australian English, no em-dashes. Write docs/handoffs/2026-10-28-stage-35-trail-init.md, commit it, ask the operator for the nine repositories, and end with Stage 36's model (Haiku 5.5, medium) and its exact kickoff prompt.
```

## Cost projection

Table `pricing/2026-10-18.json`, 10 days old (expires 2026-11-01; refresh before a Stage 37 that starts later).
Per piece below, in the record. Total about $24.11 (low $17.8). Roadmap: $12.89. This session: see the last row.

## Time projection

Serial chain: 35 (60 to 120 min plus a 27 to 41 min gate) then 36 (30 to 60 min) then 37 (60 to 120 min
plus a gate). Wall clock 3.4 to 6.4 hours. Operator review and steps about 80 min, plus nine commits.

## Session dispatch decision

Date 2026-10-28. Decided by claude-sonnet-5-5 in Claude Code desktop. Table `2026-10-18` (10 days).

| Input | Value | Source |
|---|---|---|
| W, K | 1,000,000; 970,000 | measured (usage tool, 97 percent) |
| C0 | 130,486 | measured, after reading the table and template |
| Compacted already | yes | summary at session start |
| B | 84,803 | measured: 130,486 less 45,683 Messages |
| T, F, O | 60, 3,000, 1,500 (35); 30, 3,000, 1,500 (36); 55, 6,000, 3,000 (37) | roadmap turns; F, O per skill defaults, read-heavy and writing-heavy for 37 |
| R | 26,810 (35); 26,577 (36); 40,544 (37) | file sizes in bytes over 4; assessment counted at 15k bytes for 35 and 36 |
| H | 3,700 | 3,000 plus the three facts above |
| Design-heavy | 35 yes, 36 no, 37 yes | matrix |
| Outward-facing | none pushed; 36 edits nine other repositories | |

```
35: C_fresh = 84,803 + 26,810 + 90,000 = 201,613      crosses: no (C_end 310,486 < 970,000)
cost_fresh  = 3,700*10 + 111,613*5 + 60*201,613*0.20 + 180,000*5 + 90,000*20  (per million)
            = 0.037 + 0.558 + 2.419 + 0.900 + 1.800 = $5.71
cost_continue (Sonnet, wrong class) = 13,229,160*0.10 + 180,000*2.50 + 90,000*10 = $2.67
36: Haiku long-context tier (prompt over 100k from turn 1): $0.47
37: Fable: 125,347*12.5 + 55*290,347*0.25 + 330,000*12.5 + 165,000*50 = $17.93
```

Draft verdict: fresh, by guardrail 2 (design-heavy, already compacted); continuing costs $3.04 less
but on the wrong class.

| Piece | Class, model id | Effort | Oracle | Order | Cost |
|---|---|---|---|---|---|
| 35 trail init, layout test | Opus, `claude-opus-5-5` | high | gate under D13; layout checked in a scratch repo | first | $5.71 |
| 36 nine repositories | Haiku, `claude-haiku-5-5` | medium | `trail status` and one session start per repository | after 35 | $0.47 |
| 37 acceptance of 33 to 36 | Fable, `claude-fable-5-1` | xhigh | gate under D13; findings by file and line | last | $17.93 |

Effort raised for 37: acceptance of a release (33 shipped `0.25.0-nishadherath.5`). Stage 36 needs
a human approval step per repository (the operator commits or approves each) and the operator drops the switch.

Guardrails: 1 pass (T=60). 2 fresh. 3 no push; 36 names its approval. 4 ids from the table. 5 table 10 days, no
nulls used. 6 Fable accepts Opus and Sonnet work. 7 decision budget overran (see below). 8 fresh sessions.

Adversarial pass. Opposite verdict: do 35 here; the facts above are loaded and it costs $3.04 less. Inputs: T
doubling gives 35 fresh $12.99 against $6.43 here (cost gap holds, class rule decides); B at the 25k default gives
$4.69; Haiku at the low tier gives $0.07; 37 at the default F and O gives $12.0. Task type: 35 hides a design
choice (how to adopt an uncommitted init). Verdict holds; no input crosses a guardrail.

Cost of deciding. Context 130,486 at the first reading (after the table, template and roadmap were
read, not measured, estimated 30k tokens) and 150,007 after this file was written: 19,521 tokens measured,
about 6,000 of them written output. Not timed; estimated 20 minutes. Over the 8,000-token and 10-minute caps,
so the decision took the verdict its guardrails already gave, not the default. Priced at $2.50 input and $10.00
output per million: about $0.09 measured, about $0.17 with the unmeasured reads.
