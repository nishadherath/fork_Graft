---
stage: "Stage 43: three fork changes to the Trail sign-in (logout removes the Codex entry, login warns without trail on PATH, sign-in off unless TRAIL_CLOUD=1)"
model: claude-sonnet-5-5
effort: high
status: ready
created: 2026-10-29
from: "the sign-in analysis session (Claude Fable 5.1), on the operator's /session-dispatch of 2026-10-29 19:36; D37 A with addition (3), per docs/assessment-2026-10-29-sign-in.md section 5"
---

# Stage 43: three fork changes to the Trail sign-in

## Goal

Under the `trail` name, (1) `trail logout`, and `trail logout --workspace <slug>` of the last workspace, also remove
the user-level Codex `[mcp_servers.trail]` table that the sign-in wrote; (2) `trail login --code` warns after a
sign-in when no `trail` command is on PATH, naming the install command, because this fork writes the installed
launcher and the agents will find no `trail`; (3) every sign-in path refuses unless `TRAIL_CLOUD=1`, with a message
that names the variable. Tests first, CHANGELOG under Unreleased, gate green under D13, committed. Nothing pushed.

## Decisions already made

- Operator, 2026-10-29: D37 option A, plus (3). Sonnet 5.5 at high (dispatch record below). Author commits locally;
  this session accepts; the push belongs to a later release stage.
- (3) semantics, fixed here so the author executes: a sign-in path is any command that would send a code or a link
  state to Trail or write a token: `trail login` in every form (browser link, `--code`, the "already signed in" branch
  included), `trail init --connect <code>` and `trail init --pair <code>`. Each refuses first, before any network call
  or file write, exits 1, and prints `✗ sign-in to a Trail workspace is off in this build · set TRAIL_CLOUD=1 in your
  environment to turn it on, then run the command again`. For `init --connect` and `init --pair` the line also says
  `plain trail init sets the repo up without a workspace`. When stdout is not a TTY add one agent line:
  `[trail] Tell the user that Trail sign-in is off here and that TRAIL_CLOUD=1 turns it on. Don't run trail login again.`
  Unset, empty, `0` or any value other than `1` means off. An existing connection in `~/.trail/cloud.json` keeps
  working as upstream has it (`cloudEnabled`); only new sign-ins are refused.
- (3) also silences the offer to sign in while off: `teamSignInLine` and the MCP server's `teamLine` return nothing
  when sign-in is off, so no agent is told to run a command that refuses. The nudge is already off without
  `TRAIL_CLOUD=1` (`src/cloud/nudge.ts:170`); leave it.
- (2) wording: `· no trail command is on PATH: this build's agent entries start trail itself, so Claude Code, Codex
  and Cursor get no workspace tools until it is installed · npm install -g @nanonets/graft`. Decide with
  `commandOnPath("trail")` after the token is saved; the sign-in itself still succeeds.
- (1) remove the Codex table through the TOML table remover in `src/hosts/retract.ts:205` (or a narrower helper
  beside `upsertCodexToml`), only when `~/.codex/config.toml` exists; never touch Codex's hook entries.
- Upstream tests that exercise a sign-in need `TRAIL_CLOUD: "1"` in their spawn env; add it with the comment
  `// fork: a sign-in needs TRAIL_CLOUD=1` and never weaken an assertion. Judge under D13 by test name.
- Prose: Australian English, no em-dashes, none of the persona's banned words. Upstream's prose untouched unless
  the change touches the line. New helper in `src/cloud/workspace.ts`: `signInEnabled(env)`, next to `cloudEnabled`.

## Files that matter

- `src/cli.ts:2347-2449` (`loginCommand`, `loginWithCode`, `addAgentEntries`), `:2451-2488` (`logoutCommand`),
  `:1323-1340` and `:1719-1730` (`init --connect`, `init --pair` entry), `:2048` (`runConnectInit`).
- `src/cloud/workspace.ts:158-166` (`cloudEnabled`), `src/cloud/team-file.ts:70-85` (`teamLine`, `teamSignInLine`),
  `src/mcp/server.ts:170-171`, `src/claude/hooks.ts:574`, `src/brand.ts:162` (`commandOnPath`).
- `src/hosts/mcp-config.ts:93-135` (`upsertCodexToml`, the TOML table header), `src/hosts/retract.ts:205`.
- Tests: `test/hosts-trail.test.ts:272` (the fork's npx case; extend it), new `test/cloud-login-fork.test.ts`
  (the three behaviours, spawn `dist/cli.js` as trail with a scratch HOME, as `test/trail-name.test.ts:161` does),
  `test/cloud-login-code.test.ts` (unit pattern for a stand-in Trail).
- `CHANGELOG.md` Unreleased; `docs/assessment-2026-10-29-sign-in.md` (the analysis this stage acts on).
- Protocol section 10: never run a graft or trail command in this checkout; test in a temp folder or by spawning
  `node dist/cli.js` with `TRAIL_INVOKED_AS=trail` and a scratch HOME.

## Verified facts (2026-10-29)

- `addAgentEntries` writes Codex's table with `upsertCodexToml(..., "trail")` (`src/cli.ts:2445`); `logoutCommand`
  removes only the Claude Code and Cursor workspace servers (`src/cli.ts:2451-2488`). Read, not run.
- `serverEntry` never spells npx (`src/hosts/mcp-config.ts:56-59`, commit `c4d4120`); `test/hosts-trail.test.ts:272`
  holds upstream's npx case to it.
- `TRAIL_CLOUD` is read in two places only (`src/cloud/nudge.ts:170`, `src/cloud/workspace.ts:165`); tests that set
  it: `trail-nudge`, `trail-scenario-hooks`, `trail-cloud`, `trail-name`. `grep -rn TRAIL_CLOUD src test`.
- Gate on `7f2130c`'s parent run (Stage 42): 4454 tests, 4305 pass, 47 fail; D13 baseline
  `docs/baselines/upstream-19865ff-failures.txt`. The gate runs under a fresh scratch `HOME` and `USERPROFILE`
  made for that gate, `DO_NOT_TRACK=1`, one gate at a time (the lock waits).

## Work completed

- None yet. The brief above is the whole specification.

## Unresolved questions

- Whether `trail status` should show a "sign-in off" row. Out of scope unless it costs one line; say so in the report.

## Exact next action

Write the failing tests in `test/cloud-login-fork.test.ts` for (1), (2) and (3); run that file alone; then implement
in the order (3), (2), (1); build; gate; CHANGELOG; commit with `Co-Authored-By: Claude Sonnet 5.5
<noreply@anthropic.com>`; set this file's `status: done` and fill Work completed with the gate counts and the D13
comparison. Blocked: stop and report in five lines (what, where, what was tried, what is needed, what it costs).

## Session dispatch decision

Date: 2026-10-29. Decided by: claude-fable-5-1, in Claude Code (desktop app). Price table: `pricing/2026-10-18.json`
(age 11 days).

| Input | Value | Source |
|---|---|---|
| W / K | 1,000,000 / 970,000 | measured, usage tool (`autoCompactsAtPercent` 97) |
| C0 | 235,841 | measured, usage tool, 19:36 |
| Compacted already | no | this session's transcript |
| Unrecorded context | none | the analysis is committed as `docs/assessment-2026-10-29-sign-in.md` |
| T / F / O | 45 (35 to 60) / 3,000 / 2,000 | T from the step list; F default; O between default and writing-heavy |
| B | 86,870 | measured: total 235,841 minus Messages 148,971 |
| R | 41,000 | brief 3,500; AGENTS.md 1,888; protocol 6,008; persona 13,259 + 351; handoffs README 449; source spans 9,700; tests 4,467; CHANGELOG 1,500 (characters / 4) |
| H | 3,500 | this file's brief |
| Task type | scoped module work with a stated test: Sonnet | matrix row 2; high because it touches sign-in and a token |
| Design-heavy | no | the design choices of (3) are fixed above |
| Irreversible steps | a local commit (reversible); no push, no release | |

Step A, with T 45: C_end 370,841, crosses no; C_cont 303,341; C_fresh 195,370.
cost_continue (Fable here: cache read 0.25, cache write 12.5, output 50 per million)
= 45 x 303,341 x 0.25/M + 45 x 3,000 x 12.5/M + 45 x 2,000 x 50/M = 3.41 + 1.69 + 4.50 = $9.60.
cost_fresh (Sonnet: 0.1, 2.5, 10) = 3,500 x 50/M + 127,870 x 2.5/M + 45 x 195,370 x 0.1/M + 45 x 3,000 x 2.5/M
+ 45 x 2,000 x 10/M = 0.18 + 0.32 + 0.88 + 0.34 + 0.90 = $2.61. Draft verdict: fresh, by cost, margin $6.99
(268 percent of the smaller).

Step B: piece 1, the stage, class sonnet, `claude-sonnet-5-5`, high, oracle: the new tests fail first and pass
after, `npm run build && npm test` judged under D13, commit present; serial; $2.61 as a subagent (protocol section 5)
with this file as the brief. Piece 2, acceptance here, `claude-fable-5-1`, 4 turns at F 5,000: 4 x 265,000 x 0.25/M
+ 4 x 5,000 x 12.5/M + 4 x 1,500 x 50/M = $0.82. Effort raised from medium to high: the change touches credentials.
Serial chain: brief 10 min (this turn), author 60 to 90 min including one 27-minute gate, acceptance 10 min.

Guardrails: (1) T 45; (2) not design-heavy, crosses false; (3) the only irreversible step is a local commit, and the
brief forbids a push; (4) model from the table; (5) table 11 days, no null used; (6) author Sonnet, acceptance Fable;
(7) budget, below; (8) this session is claude-fable-5-1, the subagent's model and effort set by the Agent tool.

Adversarial pass. The opposite verdict: this session already holds every span the stage touches, so its first 15
turns read almost nothing new, it needs no brief and no second acceptance pass, and it fixed the design of (3) itself
and would not misread it. Inputs: C0 measured; T doubled to 90 gives continue $20.72 against fresh $5.34, holds; F
and O are defaults and move both sides alike; B measured; R may omit the upstream tests the author must touch (about
10,000 tokens, $0.03 on the fresh side); the task hides no design choice after the decisions above, and the author
escalates on a gap; prices carry no long-context tier for Sonnet or Fable; unrecorded context none. Recomputed with
the input that helps continue most, F 1,000 for the first 15 turns here: C_cont 288,341, cost_continue = 3.24 + 1.31
+ 4.50 = $9.06, fresh unchanged at $2.61, margin 247 percent. Verdict holds.

Final verdict: fresh at Sonnet, run as a subagent of this session; acceptance here. Pieces 2, serial.

| Cost of deciding | Value | Source |
|---|---|---|
| Context at start / end | 235,841 / about 252,000 | usage tool; the end figure estimated from this file and the reads |
| Input tokens read | about 4,500 | price table, template, usage, four greps; estimate |
| Output tokens | about 6,500 with reasoning | this file and the record; characters / 4 |
| Wall clock | about 13 minutes | 19:36 to the commit of this file |
| Priced | 4,500 x 12.5/M + 6,500 x 50/M = $0.38 | table `pricing/2026-10-18.json` |

## Cost projection

Piece 1 about $2.61 (range $2 to $5 with T 35 to 60), piece 2 about $0.82, the decision $0.38, this handoff and its
update about $0.30: about $4.10 in all.

## Time projection

Author 60 to 90 minutes of wall clock, one gate included; acceptance 10 minutes; operator review 15 minutes.
