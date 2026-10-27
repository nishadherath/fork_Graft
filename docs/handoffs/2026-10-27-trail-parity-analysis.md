---
stage: "Trail parity analysis: what upstream's trail command means for the fork, and the blast radius of making graft and trail interchangeable with trail as the configured name"
model: claude-fable-5-1
effort: high
status: done
created: 2026-10-27
from: "Stage 23 session (Fable 5.1, local_d2cce6fb) on the operator's request of 2026-10-27, dispatched under the session-dispatch skill; the record is at the end of this file"
---

# Trail parity analysis

The operator asked, on 2026-10-27, in these words:

> deeply and thoroughly analyze the current codebase and the upstream 0.26.0 version. Looks like
> at some point the upstream project started using the trail command instead of graft. What does
> this mean? Deeply investigate and tell me what the differences are in using trail vs graft.
> Give me the details blast radius of what we have to update to port any improvements implemented
> in the fork using the graft command, to parity with the trail command. I want both commands to be
> useable interchangeably in the fork, and we configure the sessions/projects/harnesses and the
> global install to invoke trail rather than graft for forwards compatibility

## Goal

A dated analysis document, `docs/assessment-2026-10-27-trail-parity.md`, that answers the three
questions with evidence from the fork at `main` and upstream at `release/0.26.0` (`cc48a9d`, no tag
yet), and ends with the decisions the operator must make in the five-part format. The document
is committed on `main`. No source changes, no release, no push, no change to the global install in
this stage: the analysis informs the stage that does those, and that stage is this document's
"exact next action".

The three questions, as the document must answer them:

1. **What the rename means.** When and why upstream moved to `trail` (the `trailhq/Trail-Code`
   repository and the `@trailhq/trail-code` package, October 2026), what `trail` changes in the
   command layout, the output prefix, the on-disk layout and the agent wiring, and what upstream
   still promises `graft` users (the same code under both names, `graft` byte for byte compatible,
   the once-a-day "graft is now trail" notice).
2. **The differences in use.** A command-by-command table: every `graft` command, its `trail`
   spelling, whether the meaning or output differs, and which of the two the agent wiring (hooks,
   skills, `AGENTS.md` blocks, the MCP server entry, the statusline) looks for. Cover the
   `[graft]` and `[trail]` prefixes, the `.trail/` folder, and the environment variable that
   selects the brand.
3. **The blast radius of parity.** Every place the fork added or changed behaviour under the
   `graft` name since the merge base `4e7d0f5`, with `file:line` spans, and what each needs so the
   same behaviour exists under `trail`: the `status` command registered under graft (D20), the
   fork-aware `upgrade` refusal and nudge (D24), the stats saving fix, the session-start handover
   line, `GRAFT_init.md` and the agent wiring the fork writes, `scripts/sync-global.mjs`,
   `scripts/release.mjs` and the README "This build" section, the tests that assert the graft
   brand, and `package.json`'s `bin` (the fork and upstream's `@nanonets/graft` both expose only
   `graft`; `dist/bin/trail.js` is built but not linked). Then the second half of the operator's
   request: what changes so that sessions, projects, harnesses and the global install invoke
   `trail` rather than `graft`, in a table by surface (global `bin` shims, hooks, skills, agent
   instruction files, the MCP entry, the statusline, the SessionDispatch skill's references), with
   the reversal of assessment decision D9 A (which kept the graft layout) presented as a decision.

## Decisions already made (do not reopen)

- The fork is the operator's own build; no pull requests upstream; `main` is the only branch;
  pushes go to `origin` only; the `upstream` remote is read-only (2026-10-26).
- D26 answered A on 2026-10-27: upstream 0.26.0 is not merged yet. This stage must not merge or
  cherry-pick from upstream; it reads upstream to compare. If the analysis finds the merge is now
  the cheapest route to parity, it says so under the decisions, with the numbers.
- D9 A (`docs/assessment-2026-10-18.md`): the global install keeps the `graft` command and
  layout. The operator's request of 2026-10-27 asks to reverse this; present the reversal as a
  decision block (next free number is D28), with options, pros and cons, blast radius and a
  recommendation, and finish everything that does not depend on it.
- Prose conventions: Australian English, no em-dashes, none of the persona's banned vocabulary;
  upstream's own prose stays as it is.

## Files that matter

- `src/brand.ts` (whole file): `Brand = "trail" | "graft"`, the environment variable the two
  `dist/bin/*.js` launchers set, the command remap table (`graft check` to `trail build --check`,
  `graft stats` to `trail status`), the `[trail]`/`[graft]` prefix, the once-a-day notice.
- `src/cli.ts` (2,584 lines): command registration, including `.command("stats", { hidden: TRAIL })`
  near line 1016 and the fork's `status` registration under graft (commit `e312bff`).
- `src/claude/hooks.ts`, `src/claude/session-metrics.ts`, `src/claude/state.ts`,
  `src/claude/skill-template.ts`, `src/claude/pre-bash.ts`: the hook text and the command detection
  (`commandInvokesGraft`) that the brand prefix and the saving footer depend on.
- `src/hosts/*.ts` (13 files): what each harness gets written (Claude, Codex, Cursor, Antigravity,
  the MCP entry in `mcp-config.ts`).
- `src/upgrade.ts` or wherever commit `efd0c4e` put the fork marker and the refusal; `src/cloud/nudge.ts`.
- `scripts/sync-global.mjs`, `scripts/release.mjs`, `scripts/vendor-grammars.mjs`, `package.json` `bin`.
- `GRAFT_init.md`, `AGENTS.md`, `README.md` "This build" section, `CHANGELOG.md`.
- Tests that pin the brand: `test/cli-status-graft.test.ts`, `test/agent-trust-merge-1b.test.ts`,
  the upgrade and stats tests added in Stage 27 (`git log --name-only efd0c4e ffa5aca`).
- Upstream: `git diff --stat 4e7d0f5 upstream/release/0.26.0` (109 files, 3,315 insertions, 809
  deletions); `git show upstream/release/0.26.0:src/brand.ts` and `:src/cli.ts` for the trail side.
- `docs/assessment-2026-10-27.md` sections 3, 6 and 7 (D9, D18, D26); `docs/assessment-2026-10-18.md` D9.

## Verified facts (this session, 2026-10-27)

- `main` is `18ce2b5`, clean, equal to `origin/main`. Global install `0.25.0-nishadherath.4`.
- `package.json` `bin` has only `graft`, in the fork and in upstream `release/0.26.0`; the global
  prefix has `graft`, `graft.cmd`, `graft.ps1` and no `trail` shim; the global `dist/bin/` holds
  both `graft.js` and `trail.js`.
- `src/brand.ts` line 36 selects the brand from an environment variable the launcher sets, defaulting
  to `graft`; lines 54 and 55 remap `graft check` and `graft stats`.
- Upstream `main` is `a298b4c`, ten commits past the merge base `4e7d0f5`; `release/0.26.0` is `cc48a9d`.
- The Stage 31 session (Opus 5.5, retrieval round two) is running in this same checkout on `main`
  and commits there. This stage touches only its own two documents and retries a `git` index lock
  rather than removing it. The Stage 31 session owns `scripts/retrieval-eval.mjs`, the test files it
  adds, `CHANGELOG.md` and its own handoff; do not edit those.

## Constraints that bite

- Never run `graft` or `trail` inside this checkout (it rewrites the agent wiring). Compare
  behaviour from a scratch folder under `$TEMP` holding a copy, or by reading the source.
- Never edit `dist/`. No vendor fact, price or model name goes into source (this stage writes none).
- `npm test` takes a machine-wide lock and runs 25 to 45 minutes; a docs-only stage does not run it.
- Use the Edit and Write tools for files (Python and heredocs mangle line endings on Windows).
- No `gh` CLI. The upstream remote is read-only; `git fetch upstream` is allowed.

## Work completed

- `docs/assessment-2026-10-27-trail-parity.md` (trail parity analysis session, Fable 5.1, high,
  2026-10-27): the three questions answered with spans from `main` (`b91165f`) and
  `upstream/release/0.26.0` (`cc48a9d`), decisions D28 to D31 in the five-part format, a staged
  plan (Stages 33 to 37) with model class, effort, cost and time per stage. No source change, no
  release, no push, no change to the global install; no gate (docs only).
- This handoff: status `done`, the answers below.

## Open questions, answered by the analysis

- One package, two bins: the fork's `package.json` gains `"trail": "dist/bin/trail.js"` (D28 A,
  recommended); upstream's `@trailhq/trail-code` tarball is the same build with `bin: trail` only,
  laid out by `scripts/pack-trail.mjs`. A second package is possible (D28 B) and doubles the install.
- The `[trail]` prefix breaks nothing: the footer parser (`src/context/savings.ts:146`), the
  command classifier (`src/claude/session-metrics.ts:78-86`) and the MCP tool classifier already
  accept both names; the fork's stats fix is tested with `trail ask`.
- Parity on the current base (D30 A, recommended): it adds no conflicting line to the 0.26.0 merge.
  D26 stays A.

## Open questions, answered by the operator on 2026-10-27

- D28 A: one package, two bins (`"trail": "dist/bin/trail.js"` beside `graft`).
- D29 B: the ten graft-wired repositories move to trail's layout deliberately, behind
  `GRAFT_NO_TRAIL_SWITCH=1`, a scratch repository and this checkout first (Stage 35), the other
  nine one commit each (Stage 36).
- D30 A: parity on the current base; D26 stays A.
- D31 A: keep `test/graft-brand-layout.test.ts` and add the trail twins.
- The `Answered:` line in each block of section 4 of the analysis records the same. None left
  open.

## Exact next action

Done. D28 and D30 are answered, so Stage 33 (Sonnet 5.5, high) can start; its
scope, cost and time are in section 5 of `docs/assessment-2026-10-27-trail-parity.md`, and its
kickoff prompt is in this session's closing report. Under D28 A it ends with a release, a tarball
reinstall by the operator (protocol section 10) and `GRAFT_NO_TRAIL_SWITCH=1` set in the user
environment before the reinstall.

## Cost projection (this stage)

Fable 5.1, high, from the price table `pricing/2026-10-18.json` (cache read $0.25, cache write
$12.50, output $50.00 per million): 60 turns, 6,000 fresh input tokens and 2,500 output tokens per
turn, baseline 91,390 plus a re-read set of 35,500 tokens. Cache reads 60 x 306,890 x $0.25 =
$4.60; fresh input 60 x 6,000 x $12.50 = $4.50; output 60 x 2,500 x $50 = $7.50; first read
126,890 x $12.50 = $1.59; the handoff $0.15. About $18.34 (quote $18 to $37).

## Time projection

About 90 minutes of agent wall clock (60 turns at about 90 seconds), plus 10 minutes to write and
commit this handoff and 5 minutes for the new session to read it. Operator review: 30 minutes for
the analysis and its decisions. No gate.

## Session dispatch decision

Date: 2026-10-27. Decided by: claude-fable-5-1, effort not reported by the harness, in Claude Code
(desktop app). Price table: `pricing/2026-10-18.json` (age 9 days).

### Inputs

| Input | Value | Source (measured or estimated, and how) |
|---|---|---|
| Window W | 1,000,000 | measured, usage tool `contextWindow` |
| Compaction point K | 970,000 | measured, `autoCompactsAtPercent` 97 x W |
| Current context C0 | 163,266 | measured, usage tool at step 1.1 |
| Compacted already | yes | this session was summarised once earlier today |
| Unrecorded context | one item: Stage 31 is running in this checkout and owns the files named above | written into this handoff |
| Expected turns T | 60 (range 45 to 80) | estimated from Stage 26's assessment (same shape, 55 turns) |
| Fresh input per turn F | 6,000 | estimated, read-heavy stage per skill step 1.2 |
| Output per turn O | 2,500 | estimated, writing-heavy stage |
| Fresh baseline B | 91,390 | measured, usage total 163,266 less Messages 71,876 |
| Re-read set R | AGENTS.md 7.4k, persona 53.0k, node-ts-js.fable 1.6k, protocol 22.6k, assessment 31.7k, brand.ts 11.7k, GRAFT_init.md 10.7k, handoff README 1.8k characters: 140.5k characters, about 35,500 tokens | measured sizes, divided by 4 (3.5 for code) |
| Handoff size H | 3,000 | estimated: this file |
| Task type | whole-project assessment and the tiering of a blast radius | matrix row 5: Fable, high |
| Design-heavy | yes | assessment with design options (interchangeable commands, D9 reversal) |
| Irreversible or outward-facing steps | none in this stage; the push and the global-install change belong to the next stage | brief says do not push |

### Step A: continue or hand off

```
C_end   = 163,266 + 60 x 6,000           = 523,266
crosses = 523,266 > 970,000              = false
C_cont  = 163,266 + 360,000 / 2          = 343,266
C_fresh = 91,390 + 35,500 + 360,000 / 2  = 306,890

cost_continue = 60 x 343,266 x 0.25e-6 + 60 x 6,000 x 12.5e-6 + 60 x 2,500 x 50e-6 + 0
              = 5.15 + 4.50 + 7.50 = $17.15
cost_fresh    = 3,000 x 50e-6 + 126,890 x 12.5e-6 + 60 x 306,890 x 0.25e-6
                + 60 x 6,000 x 12.5e-6 + 60 x 2,500 x 50e-6 + 0
              = 0.15 + 1.59 + 4.60 + 4.50 + 7.50 = $18.34
```

Prices used (per million): input 10.00, output 50.00, cache_read 0.25, cache_write 12.50 for
claude-fable-5-1. penalty_compaction is zero (no crossing); penalty_loss is zero (the one
unrecorded item is written above).

Draft verdict: fresh, by quality. On cost, continue wins by $1.19 (6.9 percent of the smaller),
inside the 10 percent band, so the quality terms decide, and a session that has compacted once loses.

### Step B: model, effort and concurrency

| Piece | Class | Model id (from table) | Effort | Oracle | Serial or parallel | Cost |
|---|---|---|---|---|---|---|
| Trail parity analysis document | fable | claude-fable-5-1 | high | the document answers the three questions with spans; the operator's review | serial (one piece); runs beside Stage 31, which shares no files | $18.34 |

Serial chain and its wall clock: one piece, about 90 minutes plus 15 minutes of handoff. Operator
review time: 30 minutes.

Effort raised or lowered because: no change. Matrix row 5 says high; the stage has no irreversible
step to raise it, and an assessment is never lowered.

### Guardrails checked

1. Under 10 turns: no, T = 60.
2. Design-heavy across a compaction: design-heavy is yes and the session has compacted already, so
   the verdict is fresh whatever the arithmetic says.
3. Irreversible steps and their approval step: none in this stage; the brief forbids a push, and the
   next stage names the operator's go as its approval step.
4. Model chosen from the table, not memory: yes, the fable row of `pricing/2026-10-18.json`.
5. Table age and nulls: 9 days; no null price in the anthropic rows used.
6. Acceptance one class above the author: not an acceptance stage; the roadmap's Stage 32 covers it.
7. Decision budget: within it (see the cost table).
8. Class and effort match the harness: this session is claude-fable-5-1; the new session is started
   with model and effort set explicitly, and it checks them against this front matter first.

### Adversarial pass

The opposite verdict, argued: this session already holds the fork's release state, the linked
sessions and the upstream layout, and the arithmetic favours continuing by 7 percent. Context is at
16 percent of the window, so no compaction is ahead, and the earlier compaction summary kept every
fact this analysis needs, since none of the lost detail concerned `src/brand.ts` or trail. A handoff
costs 15 minutes that the analysis could spend reading upstream.

Each input, the way it could be wrong:

- C0: measured. If it were 30 percent higher (212,000), continue would cost $0.73 more and the gap
  would fall to 2.6 percent; still inside the band, still decided by quality.
- T: if it doubles to 120, both sides scale and the gap falls to 1.6 percent (recomputed below).
- F and O: a heavier read load (F 8,000) raises both sides by the same fresh-input term; the
  difference stays the first-read cost against the lower average context, about $1.
- B and R: R leaves out `src/cli.ts` and the upstream diff, but both sessions must read those, so
  they sit in F on both sides. B is measured for this harness and project today.
- Task type: it could hide a mechanical core (the command table) but the operator asks for blast
  radius and design options, which is assessment work. The row stands.
- Prices: the table is 9 days old; the fable row lists no long-context tier, so none is applied.
- Unrecorded context: the Stage 27 observation that this checkout's pre-bash hook blocked a shell
  command with a "trail skills on" message is in the Stage 27 handoff, so it is recorded.

Recomputed with the adverse value that moves the result most (T = 120):

```
cost_continue = 120 x 523,266 x 0.25e-6 + 120 x 6,000 x 12.5e-6 + 120 x 2,500 x 50e-6 = 15.70 + 9.00 + 15.00 = $39.70
cost_fresh    = 0.15 + 1.59 + 120 x 486,890 x 0.25e-6 + 9.00 + 15.00 = 0.15 + 1.59 + 14.61 + 9.00 + 15.00 = $40.35
```

Verdict holds: yes. The gap stays inside the band, quality decides, and guardrail 2 decides it the
same way.

### Final verdict

Fresh, model claude-fable-5-1, effort high, pieces 1 (serial, beside Stage 31). Exact next action:
this session commits the handoff and starts the new session with this file as its brief; the new
session follows "Exact next action" above.

### Cost of deciding

| Row | Value | Source |
|---|---|---|
| Context at start | 163,266 | usage tool at step 1.1 |
| Context at end | 165,144 | usage tool after step 5, before this record was written |
| Input tokens read | about 1,900 | the difference of the two rows (the price table, the template, file sizes) |
| Output tokens | about 3,300 | estimate, characters of this record and the brief divided by 4 |
| Wall clock | about 7 minutes | from the first usage reading to the commit |
| Priced | $0.19 (1,900 x $12.50 + 3,300 x $50.00 per million) | table `pricing/2026-10-18.json` |

The decision cost about 1 percent of the stage it dispatches.
