---
stage: "Stage 34: docs in the trail name"
model: claude-haiku-5-5
effort: medium
status: done
created: 2026-10-27
from: "docs/handoffs/2026-10-27-stage-33-trail-bin.md (Stage 34 kickoff); section 5 row 34 of docs/assessment-2026-10-27-trail-parity.md"
---

# Stage 34: docs in the trail name

## Goal

The four documents that tell an agent or the operator how to run Graft's commands now spell
them `trail`: `GRAFT_init.md`, the "Code navigation (Graft)" section of `AGENTS.md`, the
smoke-test rule in `docs/operator-protocol.md` section 10, and the "Under the trail brand" table in
`docs/architecture/system-reference.md`. The two renamed commands are called out wherever they
appear. No file under `src/` or `test/` changed, so no gate ran. Done: the four files are
committed, and every remaining `graft <command>` spelling in them is a dated record or a rename callout.

## Decisions already made

- Trail is the command name (D28 A, D30 A, Stage 33). Not reopened.
- The rule "never run a graft or trail command in a wired checkout" stays. A trail command
  rewrites wiring on a version mismatch as a graft one does.
- Dated records (the 2026-10-27 verification results, the 2026-10-21 incident, `GRAFT_init.md`
  section 7) keep the spelling they were recorded with. Only instructions and tables change.

## Files that matter

- `GRAFT_init.md`: section 1 (Graft CLI row), section 2 steps 1 and 2, section 3 (new note on the
  two renames, daily-use table), section 4 items 1 to 5, section 5 bullets, section 6 troubleshooting.
- `AGENTS.md`: "Code navigation (Graft)", the last section of the file.
- `docs/operator-protocol.md`: section 10, the bullet beginning "Never run a graft or trail command".
- `docs/architecture/system-reference.md`: section 3, "Under the trail brand", with the new
  graft-to-trail table. Its paragraph about the global install was updated because the Stage 33 tarball
  now installs `trail`.
- Read only, for the mapping: `docs/assessment-2026-10-27-trail-parity.md` section 2.1;
  `src/cli.ts` line 601 (`cmd("graft check")`) and line 962; `src/brand.ts` lines 64 to 70 (`cmd()`
  and `RENAMED`).

## Verified facts

- Commit `f1b7149` touches exactly the four files above: `git diff --stat` before the commit, and
  `git show --stat f1b7149` after it. 61 insertions, 38 deletions.
- No CRLF in the four files: `grep -c $'\r'` returns 0 for each (2026-10-28).
- No em-dash or en-dash in the four files: the content search for both characters returns no matches (2026-10-28).
- Remaining graft command spellings: `grep -nE "graft (ask|grep|skeleton|callers|build|check|stats|status|mcp|--version|init)" GRAFT_init.md AGENTS.md docs/operator-protocol.md`
  (2026-10-28). Each hit is a dated record, a rename callout, or the 2026-10-21 incident.
- Under the trail brand `graft check` becomes `trail build --check`: `cmd()` in `src/brand.ts` maps the
  label through `RENAMED`, and `src/cli.ts` line 601 passes `cmd("graft check")`. Read from source; the
  verdict string was not produced by running `trail`.
- No `graft` or `trail` command was run in this checkout or the global install. Only file and git
  tools were used. The operator's Stage 33 reinstall was not touched.
- The checked-in `ENGINEERING_PERSONA.md` is the Fable edition; there is no `ENGINEERING_PERSONA.haiku.md`
  in the repository. Section 3.2 was read for the Haiku loading rule. No language file was loaded,
  because no source or shell file changed.

## Work completed

- `f1b7149` docs: spell the commands in trail (Stage 34). Four files. Co-Authored-By Claude Haiku 5.5.
- This handoff, committed in a second commit (its hash is in the stage report, not in this file).
- Not pushed. No shim, no global install, no release.

## Unresolved questions

- Does a `trail` command rewrite the wiring of this checkout? The graft spelling was measured
  byte-identical on 2026-10-27 (`GRAFT_init.md` section 3); the trail spelling was not. Answer: Stage 35,
  in a scratch folder first, then in this checkout under the D29 B move, with `.claude/settings.json` backed up.
- Does `trail build --check` print `trail build --check: OK` under the trail brand? Source says so; not
  executed. Answer: Stage 35, or the operator's smoke test in a scratch folder.
- Has the Stage 33 reinstall finished? This stage did not check. The new docs assume `trail` is on PATH.
  Answer: the operator.

## Exact next action

Operator: confirm `GRAFT_NO_TRAIL_SWITCH` is `1` and that `trail --version` and `graft --version`
both print `0.25.0-nishadherath.5` when run from a scratch folder under `$env:TEMP`. Then start the
Stage 35 session with the kickoff prompt below. Its first action is the model and effort check, then
the version check. It stops if either fails.

## Cost projection

Haiku 5.5, API list price (protocol sections 2 and 6). Projected, not measured in this session:
25 turns, average context 40k, fresh input 3k per turn, output 1.5k per turn.

- Cache reads: 25 x 40k = 1.0M x $0.01 = $0.010
- Fresh input: 25 x 3k = 75k x $0.125 = $0.009
- Output: 25 x 1.5k = 37.5k x $0.50 = $0.019
- Total about $0.04 (roadmap range $0.05 to $0.20). Prompt length stays under 100k, so the low tier applies.

Next stage, Opus 5.5 high, 60 turns, average context 100k, 3k fresh and 1.5k output per turn:

- Cache reads: 6.0M x $0.20 = $1.20; fresh input: 180k x $5.00 = $0.90; output: 90k x $20 = $1.80
- Total $3.90 (roadmap range $4 to $8).

## Time projection

This stage: 15 to 30 min agent time (not timed), 10 min operator review, no gate.
Stage 35: 60 to 120 min agent time plus one gate of 27 to 41 min, 30 min operator review.

## Next stage

**Stage 35, Opus 5.5 (`claude-opus-5-5`), effort high.** Kickoff prompt:

```
You are the Stage 35 session for D:\Code\Claude\fork_graft. Check you are claude-opus-5-5 at effort high; stop on a mismatch. Before anything else, from a scratch folder under $env:TEMP, check `trail --version` and `graft --version` both print 0.25.0-nishadherath.5, and that GRAFT_NO_TRAIL_SWITCH is 1; stop and report if any check fails (the operator's Stage 33 reinstall). Read AGENTS.md, ENGINEERING_PERSONA.md, docs/operator-protocol.md, docs/handoffs/2026-10-27-stage-34-docs-in-trail.md, and section 5 row 35 of docs/assessment-2026-10-27-trail-parity.md. Task: decision D29 B, the first two moves. First run `trail init` in a fresh scratch git repository and verify the layout. Then, back up .claude/settings.json (git-ignored, no git copy), run `trail init` in this checkout, and verify .trail/hook.cjs, the one-line settings.json change, the removed .mcp.json server and skill, and that the map is already at .trail/cache/. Verify the hooks, the statusline, the [trail] footers in `trail status`, the absence of MCP tools, and the fork tests under both brands; add the trail layout test (D31 A). Gate: npm run build && npm test, judged under D13 against docs/baselines. Commit once here with explicit paths and Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>. Do not push. Australian English, no em-dashes. Write docs/handoffs/2026-10-28-stage-35-trail-init.md, commit it, and end your report with Stage 36's model (Haiku 5.5, medium) and its exact kickoff prompt.
```
