---
stage: "Stage 44: the sign-in marks the Codex table it writes, logout removes only a marked one, and the workspace-only server is quiet while sign-in is off"
model: claude-sonnet-5-5
effort: high
status: done
created: 2026-10-29
from: "the sign-in analysis session (Claude Fable 5.1), on the operator's answer D38 A of 2026-10-29 20:43; the question is in docs/handoffs/2026-10-29-stage-43-sign-in-fork-fixes.md"
---

# Stage 44: the Codex trail table has one owner at a time

## Goal

Under the `trail` name: (1) the sign-in writes Codex's `[mcp_servers.trail]` table only when Codex has no `trail`
and no `graft` table, and marks the one it writes with a comment line; `trail logout` removes a marked table only;
`trail init`'s own write rewrites the table without the mark and so takes it over. (2) The workspace-only MCP server
(`trail mcp --brains`) answers with no "run trail login" line while sign-in is off. Tests first, CHANGELOG adjusted,
gate green under D13, committed. Nothing pushed.

## Decisions already made

- Operator, 2026-10-29 20:43: D38 option A. Sonnet 5.5 at high as a subagent of the accepting session (record
  below); acceptance there; the push belongs to the release stage.
- Ownership rule, fixed here: `trail init` owns Codex's table. The sign-in (`addAgentEntries`, `src/cli.ts`, the only
  Codex writer at sign-in) writes a table only when `stripTomlSection` finds neither a `trail` nor a `graft` table in
  `~/.codex/config.toml`; otherwise it leaves the file byte for byte. Its table carries one comment line right after
  the header, the exported constant `CODEX_SIGN_IN_MARK` in `src/hosts/mcp-config.ts`, text
  `# written by trail login; trail logout removes this table, trail init takes it over`. `upsertCodexToml` as init
  calls it is unchanged and never writes the mark, so an init over a marked table drops the mark.
- `removeCodexToml(path, name, { markedOnly })` returns `'absent' | 'kept' | 'removed' | 'deleted'`: with
  `markedOnly`, a table whose lines (header to the next `[` header) hold no `CODEX_SIGN_IN_MARK` is `'kept'`. Logout
  calls it with `markedOnly: true`; `trail uninstall` keeps its own remover in `src/hosts/retract.ts:205`.
- (2) `src/mcp/server.ts:173`: when `brainsOnly` and not paired, answer `NOT_CONNECTED_LINE` only if
  `signInEnabled()`, else `''`. `test/mcp-connector.test.ts` lines 175 and 206 get `TRAIL_CLOUD: "1"` with the
  comment `// fork: a sign-in needs TRAIL_CLOUD=1`.
- CHANGELOG: the Unreleased entries are unreleased, so edit them rather than add: the Fixed entry on logout says the
  marked-table rule and that init's table stays; the Changed entry on `TRAIL_CLOUD` adds that the workspace-only
  server no longer asks for a sign-in while it is off.
- Prose rules as in Stage 43. Never run a graft or trail command in this checkout. Gate from Git Bash under a fresh
  scratch `HOME` and `USERPROFILE`, `DO_NOT_TRACK=1`, judged under D13 against `docs/baselines/upstream-19865ff-failures.txt`.

## Files that matter

- `src/hosts/mcp-config.ts:93-166` (`tomlHeader`, `stripTomlSection`, `upsertCodexToml`, `removeCodexToml`).
- `src/cli.ts` `addAgentEntries` and `removeCodexEntry` (search by name; around lines 2470-2490), logout at
  `logoutCommand`.
- `src/mcp/server.ts:44` (`NOT_CONNECTED_LINE`) and `:173`; `src/cloud/workspace.ts` `signInEnabled`.
- Tests: `test/cloud-login-fork.test.ts` (add: a sign-in with no Codex table writes a marked one and logout removes
  it; an unmarked table is left byte-identical by the sign-in and kept by logout; a `graft` table present means the
  sign-in writes nothing; init's upsert over a marked table drops the mark; the brains-only server's instructions
  carry no `NOT_CONNECTED_LINE` while off and do with `TRAIL_CLOUD=1`), `test/hosts-trail.test.ts` (the round-trip
  test of Stage 43 now goes through the marked write), `test/mcp-connector.test.ts` (two env lines).
- The learning `.trail/learnings/2026-10-29-the-codex-trail-table-has-two-writers-nishad.md` says why.

## Verified facts (2026-10-29)

- `upsertCodexToml` strips and re-appends the table (`src/hosts/mcp-config.ts:129-147`), so a write without the mark
  removes a mark that was there. `stripTomlSection` runs from the header to the next `[` header, comments included.
- The operator's `~/.codex/config.toml:168` holds `[mcp_servers.trail]`, `command = "trail"`, `args = ["mcp"]`,
  written by `trail init`: under this stage a logout there is `'kept'`.
- Stage 43 gate on `88d59b3`: 4470 tests, 4329 pass, 39 fail, 102 skipped; D13 held (its handoff, Acceptance).

## Work completed

Claude Sonnet 5.5 at high, as a subagent of the accepting session, 2026-10-29. Commit `7afdc64` (nothing pushed).

- `src/hosts/mcp-config.ts`: exported `CODEX_SIGN_IN_MARK` (text as in the brief); new `upsertCodexSignInToml(id, path)`
  writes the marked table, and returns `'unchanged'` with the file untouched when `stripTomlSection` finds a `trail` or a
  `graft` table; `removeCodexToml(path, name, { markedOnly })` returns `'absent' | 'kept' | 'removed' | 'deleted'`, and
  `'kept'` leaves the file byte for byte; `stripTomlSection` also returns the table's lines as `section`. `upsertCodexToml`
  is unchanged, so init's write over a marked table drops the mark.
- `src/cli.ts`: `addAgentEntries` calls `upsertCodexSignInToml`; `removeCodexEntry` passes `{ markedOnly: true }`.
- `src/mcp/server.ts:173`: the brains-only server answers `NOT_CONNECTED_LINE` only when `signInEnabled()`, else `''`.
- Tests, all failing first (8 of 23 in `cloud-login-fork`, and `hosts-trail` at the import): `test/cloud-login-fork.test.ts`
  (existing logout cases now use a marked table; new: markedOnly return values, CRLF, the sign-in write and its four
  no-write cases, init taking over a marked table, logout keeping init's table in both forms, `login --code` then `logout`
  through the CLI for a marked write and for an init or graft table, the brains-only server off and on);
  `test/hosts-trail.test.ts` (round trip through the marked write; new case that init's table is kept);
  `test/mcp-connector.test.ts` (`TRAIL_CLOUD: "1"` on the two cases, with the fork comment; the second case is the
  connector's own message and does not depend on the server line).
- CHANGELOG: the two Unreleased entries edited as the brief says; no new entry.
- Gate on `7afdc64`'s tree, Git Bash, fresh scratch `HOME`/`USERPROFILE`, `DO_NOT_TRACK=1`, `TRAIL_CLOUD` unset:
  `npm run build && npm test` gave 4479 tests, 4339 pass, 38 fail, 102 skipped (Stage 43: 4470, 4329, 39, 102).
- D13: 34 of the 38 failing names are in `docs/baselines/upstream-19865ff-failures.txt`. The other four, rerun alone under
  fresh scratch homes: `ignored-code` 2 of 2 pass; `trace-perf` 1 pass, 1 skipped; `skills-prompt` "the check line
  carries the values of the block it checks" passes (the file's two failures are baseline lines); `trace-guard-fast`
  "a guard call takes under 2 ms" fails alone (the timing test Stage 43 named). No failure in a file this stage touched
  beyond `hosts-trail` "a session start that moves a graft repo to trail moves the other agents too" (baseline). D13 held.

## Unresolved questions

- None known. A sign-in on a Codex wired for `graft` leaves Codex on `graft mcp`; whether that server passes the
  workspace through is upstream's question, not this stage's.
- `trace-guard-fast` "a guard call takes under 2 ms" is a timing test that fails here without this stage's help (also in
  Stage 43's gate); it is not in the baseline file.

## Exact next action

Write the failing tests first and run `test/cloud-login-fork.test.ts` alone; implement (1) then (2); build; gate;
CHANGELOG; commit with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; set this file's `status: done`
and fill Work completed with the commit, the gate counts and the D13 comparison. Blocked: stop and report in five lines.

## Session dispatch decision

Date: 2026-10-29 20:44. Decided by: claude-fable-5-1, in Claude Code (desktop app). Price table: `pricing/2026-10-18.json`
(age 11 days). Same shape as Stage 43's record; only the measured inputs changed.

| Input | Value | Source |
|---|---|---|
| W / K | 1,000,000 / 970,000 | measured, usage tool |
| C0 | 310,269 | measured, usage tool, 20:44 |
| Compacted already | no | |
| Unrecorded context | none | the ownership rule is written above; the cause is in the learning |
| T / F / O | 30 (25 to 40) / 3,000 / 2,000 | T from the step list; F default; O as Stage 43 |
| B | 86,870 | measured: total 310,269 minus Messages 223,399 |
| R | 46,000 | Stage 43's set 41,000 plus this and the Stage 43 handoff, 5,000 |
| H | 3,000 | this file |
| Task type | scoped module work with a stated test: Sonnet, high (touches the sign-in) | matrix row 2 |
| Design-heavy | no | the ownership rule is fixed above |
| Irreversible steps | a local commit; no push | |

Step A: C_end 400,269, crosses no; C_cont 355,269; C_fresh 177,870.
cost_continue (Fable) = 30 x 355,269 x 0.25/M + 30 x 3,000 x 12.5/M + 30 x 2,000 x 50/M = 2.66 + 1.13 + 3.00 = $6.79.
cost_fresh (Sonnet) = 3,000 x 50/M + 132,870 x 2.5/M + 30 x 177,870 x 0.1/M + 30 x 3,000 x 2.5/M + 30 x 2,000 x 10/M
= 0.15 + 0.33 + 0.53 + 0.23 + 0.60 = $1.84. Draft verdict: fresh, by cost, margin $4.95 (269 percent).

Step B: piece 1 the stage, `claude-sonnet-5-5`, high, oracle: new tests fail first then pass, gate under D13, commit;
$1.84 as a subagent. Piece 2 acceptance here, `claude-fable-5-1`, 4 turns at F 5,000 and C about 330,000: $0.88.
Serial chain: brief 4 min, author 45 to 75 min with one 27-minute gate, acceptance 10 min.

Guardrails: (1) T 30; (2) not design-heavy, no compaction; (3) local commit only, push forbidden in the brief;
(4) model from the table; (5) table 11 days, no null; (6) author Sonnet, acceptance Fable; (7) budget below;
(8) this session claude-fable-5-1, the subagent's model and effort set by the Agent tool.

Adversarial pass. The case for continuing: this session read the writer, the stripper and the logout path minutes
ago and wrote the ownership rule, so it would make no reading mistake and needs no acceptance pass by another
class. Inputs: C0 measured; T doubled to 60 gives continue $14.25 against fresh $3.47, holds; F and O defaults move
both sides; R may be 20 percent light (the tests the author reads), $0.02 on the fresh side; the task hides no
design choice after the rule above; prices carry no long-context tier for these two models. Recomputed with F 1,000
for the first 10 turns here: C_cont 340,269, cost_continue = 2.55 + 0.88 + 3.00 = $6.43, fresh $1.84, margin 249
percent. Verdict holds.

Final verdict: fresh at Sonnet as a subagent of this session; acceptance here; 2 pieces, serial.

| Cost of deciding | Value | Source |
|---|---|---|
| Context at start / end | 310,269 / about 318,000 | usage tool; end estimated |
| Input tokens read | about 2,000 | the writer, the stripper, the usage; estimate |
| Output tokens | about 3,500 with reasoning | this record; characters / 4 |
| Wall clock | about 4 minutes | 20:44 to the commit of this file |
| Priced | 2,000 x 12.5/M + 3,500 x 50/M = $0.20 | table `pricing/2026-10-18.json` |

## Cost projection

Piece 1 about $1.84 (range $1.50 to $2.50), piece 2 about $0.88, the decision $0.20, this handoff and its update
about $0.25: about $3.20 in all.

## Time projection

Author 45 to 75 minutes of wall clock, one gate included; acceptance 10 minutes; operator review 10 minutes.
