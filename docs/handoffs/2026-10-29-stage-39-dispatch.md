---
stage: "Stage 39: dispatch of the upstream 0.28.0 merge, its acceptance and the release"
model: claude-fable-5-1
effort: xhigh
status: done
created: 2026-10-29
from: "session-dispatch run in local_802088bb (claude-fable-5-1, xhigh) on the operator's request of 2026-10-29: merge latest upstream, verify, commit, merge to main, tag, push to origin, release tarball and changelog as for .6, delete unused branches and worktrees"
---

# Stage 39: dispatch

## Goal

Decide, by the session-dispatch arithmetic, where the upstream 0.28.0 merge and what follows it
run, and write the brief for the first piece. The work itself is three pieces: the merge with its
gate judged under D13 (Stage 39), adversarial acceptance of the merge (Stage 40), and the release
`0.28.0-nishadherath` with push, tarball, global reinstall and clean-up (Stage 41).

## Session dispatch decision

Date: 2026-10-29. Decided by: claude-fable-5-1, effort xhigh, in Claude Code (desktop app).
Price table: `pricing/2026-10-18.json` (age 11 days, under the 14-day limit).

### Inputs

| Input | Value | Source (measured or estimated, and how) |
|---|---|---|
| Window W | 1,000,000 | Measured: usage tool `contextWindow`, 12:55 local |
| Compaction point K | 970,000 | Measured: `autoCompactsAtPercent` 97 of W |
| Current context C0 | 103,084 | Measured: usage tool `tokensUsed` at the start of step 1 |
| Compacted already | no | This session started at 12:54 local; no summary yet |
| Unrecorded context | the 8 conflicting files from a `git merge-tree` dry run; upstream 0.28.0 moved every native `tree-sitter-*` grammar to `optionalDependencies` and added `web-tree-sitter-depth`; 16 upstream commits, 197 files, +8,300/-1,682 | All three reproduced by one command each; all three written into the Stage 39 brief, so the loss list after the handoff is empty |
| Expected turns T | 100 (range 80 to 140) for the merge piece | Stage 20 (the 0.25.0 merge, Opus 5.5) reported about 100 turns; acceptance 55 (Stage 23); release 45 (the .6 release took 30, plus push, pack, reinstall, clean-up) |
| Fresh input per turn F | 3,000 (5,000 for acceptance) | Protocol section 6 defaults; Stage 20's average context of 110k over 100 turns agrees |
| Output per turn O | 1,500 | Protocol section 6 default; xhigh may double it (adversarial pass) |
| Fresh baseline B | 87,661 | Measured: usage total 103,084 minus the Messages category 15,423 |
| Re-read set R | 28,750: protocol 5,750; persona 13,250; two language files 800; the Stage 39 brief 3,000; handoffs README 450; Stage 20 handoff 3,000; the .6 release handoff 2,000; baseline failures file 500 | Estimated: characters divided by 4 (`wc -c`) |
| Handoff size H | 3,000 | Estimated: a brief under 120 lines plus the three unrecorded facts |
| Task type | Cross-module merge (Opus row); acceptance (one class above the author); release (scoped, harness as oracle, Sonnet row) | Step 3.1 matrix |
| Design-heavy | yes | Conflicts in `src/graph/build.ts`, `extract.ts`, `container.ts`, `src/cli.ts` and `scripts/vendor-grammars.mjs`; upstream replaced the native parser tier with a WASM depth tier |
| Irreversible or outward-facing steps | `git push origin main`; push of the annotated tag; global reinstall of the new base (backed up first); removal of the baseline worktree and stale refs | Operator's request; protocol section 10 |

### Step A: continue or hand off

Continuing means this session, which is Fable 5.1 (guardrail 8: a session cannot become Opus), so
the continue side is priced at Fable and the fresh side at Opus, the class the matrix assigns.

```
C_end   = C0 + T * F            = 103,084 + 300,000 = 403,084
crosses = C_end > K             = false (403,084 < 970,000)
C_cont  = C0 + T * F / 2        = 253,084
C_fresh = B + R + T * F / 2     = 87,661 + 28,750 + 150,000 = 266,411

cost_continue (Fable: cr 0.25, cw 12.50, out 50.00 per million)
  = 100*253,084*0.25e-6 + 300,000*12.50e-6 + 150,000*50e-6 + 0
  = 6.33 + 3.75 + 7.50 = $17.58
cost_fresh (Opus: cr 0.20, cw 5.00, out 20.00; handoff written here at Fable output)
  = 3,000*50e-6 + 116,411*5e-6 + 100*266,411*0.20e-6 + 300,000*5e-6 + 150,000*20e-6 + 0
  = 0.15 + 0.58 + 5.33 + 1.50 + 3.00 = $10.56
```

Prices used (per million): Opus 5.5 input 4.00, output 20.00, cache read 0.20, cache write 5.00;
Fable 5.1 input 10.00, output 50.00, cache read 0.25, cache write 12.50.

Draft verdict: fresh, by cost, margin $7.02 (66 percent of the smaller). For the record, a
same-class continue at Opus prices would be $9.56, which beats fresh by $1.00 (10.5 percent);
that path does not exist here, and guardrail 8 forbids pretending it does.

### Step B: model, effort and concurrency

| Piece | Class | Model id (from table) | Effort | Oracle | Serial or parallel | Cost |
|---|---|---|---|---|---|---|
| Stage 39: merge 19865ff into main, baseline of plain upstream, gate, D13 by name, handoff | Opus | claude-opus-5-5 | xhigh | `npm run build` exit 0; `npm test` counts quoted; failing names minus `docs/baselines/upstream-19865ff-failures.txt` empty, or each stray rerun alone and explained | Serial first; the baseline gate runs in the background while conflicts are resolved, the lock serialises the two gates | $10.56 (above) |
| Stage 40: adversarial acceptance of the merge | Fable | claude-fable-5-1 | xhigh | A written verdict, accepted or rejected with the failing evidence, in `docs/handoffs/2026-10-29-stage-40-acceptance.md`, after its own gate | Serial after 39 | T 55, F 5,000: 3,000*20e-6 + 116,411*12.5e-6 + 55*253,911*0.25e-6 + 275,000*12.5e-6 + 82,500*50e-6 = 0.06 + 1.46 + 3.49 + 3.44 + 4.13 = $12.58 |
| Stage 41: `release.mjs 0.28.0-nishadherath`, gate, commit, tag, push, pack, reinstall, sync, clean-up | Sonnet | claude-sonnet-5-5 | high | `origin/main` and the tag on origin; tarball and CHANGELOG copy in `D:\Code\Claude\fork_graft_releases`; `trail --version` from an unwired folder prints the new version; `git worktree list` shows one entry | Serial after 40 | T 45, R 25,250: 3,000*50e-6 + 112,911*2.5e-6 + 45*180,411*0.10e-6 + 135,000*2.5e-6 + 67,500*10e-6 = 0.15 + 0.28 + 0.81 + 0.34 + 0.68 = $2.26 |

Stage total about $25.40 at list price. Serial chain and its wall clock: Stage 39, 150 to 200 min
(two 27-minute gates in series, a stray rerun, conflicts resolved during the baseline gate);
Stage 40, 90 to 130 min (one gate); Stage 41, 60 to 75 min (one gate, reinstall, pack, push).
Chain 300 to 405 min. Operator review time: about 65 min (30, 20, 15) plus one click per stage.

Effort raised or lowered because: step 3.1 raises one step for a merge, a release, or an
irreversible step; so Opus high becomes xhigh for Stage 39, Sonnet medium becomes high for
Stage 41. Stage 40 is xhigh by the acceptance row. Protocol section 10 still says "Opus 5.5 at
high effort" for merge stages (D8, D17, D18 of 2026-10-26); the skill of 2026-10-27 is the newer
instruction and was invoked for this decision, so xhigh applies. Open question for the operator.

### Guardrails checked

1. Under 10 turns: no, T = 100, 55 and 45.
2. Design-heavy across a compaction: design-heavy yes, crosses false, not compacted; no stop.
3. Irreversible steps and their approval step: every push, the tag, the reinstall and the deletions
   sit in Stage 41, which the operator starts by a click only after reading the Stage 40 verdict;
   the Stage 41 brief pushes only when its own gate is green under D13 and Stage 40 says accepted.
   Stages 39 and 40 push nothing and delete nothing.
4. Model chosen from the table, not memory: yes, the three ids above are the table's rows.
5. Table age and nulls: 11 days; no null on the Anthropic rows used.
6. Acceptance one class above the author: the author of the merge is Opus, so acceptance is Fable
   xhigh in a fresh session (Stage 40). Stage 41's author is Sonnet; its acceptance is the
   operator's own check of the push, tag and tarball, as for the .6 release.
7. Decision budget: overrun, see "Cost of deciding". Inputs took about 61k tokens of reading and
   12 minutes against a cap of 8,000 and 10. The skill says to take the default past the cap
   (continue, same model, same effort). That default would have Fable run a merge stage, which
   protocol section 10, an operator decision older than this skill, forbids, and which guardrail 4
   also rules out. The verdict therefore follows the standing assignment and the arithmetic, not
   the default; the overrun is recorded as the skill asks.
8. Class and effort match the harness: this session reads as claude-fable-5-1, xhigh (session tool,
   `self`); it decided and did not run the merge.

### Adversarial pass

The opposite verdict, argued: this session already holds the dry-run conflict list, the dependency
diff and the three precedents, and it has 870k tokens of headroom before compaction, so a handoff
throws away a warm context to save about $7 on a $25 stage. Fable at xhigh would also resolve the
graph-core conflicts with fewer wrong turns than Opus, and the acceptance stage could then shrink
to a Sonnet read, since the author would already be the top class. One session instead of three
also saves two operator clicks and perhaps two hours of calendar time.

Each input, the way it could be wrong:

- C0: measured, but the record itself adds about 45k before any merge turn; at C0 = 150,000 the
  continue side rises to $18.75 and fresh is unchanged.
- T: if the merge doubles to 200 turns, both sides double in their read terms; fresh stays ahead
  because its per-turn price is lower on every term.
- F and O: at xhigh, O may be 3,000 not 1,500; that adds $3.00 to fresh (Opus) and $7.50 to
  continue (Fable), widening the margin.
- B and R: B is measured; R leaves out the upstream commits themselves (the brief points at
  `git log 4e7d0f5..19865ff`) and any file the merge opens, which both sides read equally.
- Task type: the stage hides no design choice beyond conflict resolution; the WASM depth tier is
  upstream's design, taken as is. If it did hide one, Opus is the matrix's class for it anyway.
- Prices: 11 days old; no long-context tier applies to Opus or Fable.
- Unrecorded context: the loss list is empty only if the brief carries the three facts; it does.

Recomputed with the adverse value that moves the result most (C0 = 150,000 and O = 3,000 together):

```
cost_continue = 100*276,584*0.25e-6 + 3.75 + 300,000*50e-6 = 6.91 + 3.75 + 15.00 = $25.66
cost_fresh    = 0.15 + 0.58 + 5.33 + 1.50 + 300,000*20e-6 = 7.56 + 6.00 = $13.56
```

Verdict holds: yes. The argument for staying is time and warmth, not money, and the skill changes
a verdict only on arithmetic.

### Final verdict

fresh, model claude-opus-5-5, effort xhigh, pieces 3 (serial as above). Exact next action: this
session starts Stage 39 with the model and effort set (the app's session tool accepts both for a
fresh session, measured 2026-10-29, so protocol section 5's "the chip cannot set the model" is out
of date); the new session reads `docs/handoffs/2026-10-29-stage-39-merge-upstream-0.28.0.md`.

### Cost of deciding

| Row | Value | Source |
|---|---|---|
| Context at start | 103,084 | usage tool, 12:55 local |
| Context at end | 172,819 | usage tool, 13:05 local, after the record and brief were written |
| Input tokens read | about 61,000 | end minus start (69,735) minus output; protocol, persona excerpts, price table, templates, four handoffs, git state, two tool schemas |
| Output tokens | about 8,500 (estimate: the two files are 22,137 characters, about 5,500 tokens, plus messages) | no harness figure for one turn |
| Wall clock | 12:55 to 13:07 local, 12 minutes | `date` at step 1 and at the commit |
| Priced | 61,000 x 12.50e-6 + 8,500 x 50e-6 = $0.76 + $0.43 = about $1.19 | table `pricing/2026-10-18.json` |

The decision cost under 5 percent of the stage it dispatches, so the skill pays for itself here;
what did not fit was the cap. For a stage with more than one piece and two gate precedents to
read, 8,000 tokens is below the cost of the inputs alone. Suggested skill change, for the
operator: a cap of 20,000 tokens and 20 minutes when the stage has more than one piece.

## Decision for the operator (D36)

```
Decision:      Does the merge get an adversarial acceptance (Stage 40) before the push?
Options:       A: yes, Fable xhigh, fresh session, before Stage 41 / B: no, Stage 41 follows the D13-green gate
Pros and cons: A costs about $12.58 and 90 to 130 min, and catches what one gate cannot (the
               WASM depth tier changes how Kotlin, Java, Go, PHP, Python, R and TypeScript parse);
               B saves that and pushes two hours sooner, on the gate alone
Blast radius:  the global install runs in every wired repository on this machine (twelve on
               2026-10-28); a bad build is reversible by reinstalling the .6 tarball from
               D:\Code\Claude\fork_graft_releases, a bad tag only by a further release
Recommended:   A, because Stage 20 (the last base-release merge) was followed by Stage 23's
               acceptance before Stage 24 released, and the depth-tier change is larger than 0.25.0's
```

Stage 39 does not depend on this decision and starts now. Stage 40's brief is written by Stage 39
under option A; under option B the operator tells Stage 39 to write the Stage 41 brief instead.

Answered 2026-10-29, 13:10 local: option A. Stage 40 (Fable 5.1, xhigh, fresh session) accepts the
merge before Stage 41 pushes; Stage 39 writes its brief. The running Stage 39 session was told.

## Work completed

- This record and the Stage 39 brief, committed together; the Stage 39 session started from this
  session's final turn on Opus 5.5 at xhigh.

## Exact next action

Operator: answer D36 above; Stage 39 is already running and needs nothing until it reports.
