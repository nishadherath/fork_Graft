---
stage: "Stage 37: acceptance of Stages 33 to 36 one tier up"
model: claude-fable-5-1
effort: xhigh
status: ready
created: 2026-10-28
from: "session-dispatch run by the coordinator (claude-fable-5-1) after Stage 36 reported done; brief is docs/handoffs/2026-10-28-stage-36-nine-repositories.md"
---

# Stage 37: dispatch

## Goal

Decide, by the session-dispatch arithmetic, where Stage 37 (acceptance of Stages 33 to 36,
including the release v0.25.0-nishadherath.5) runs and at what price.

## Decisions already made

D28 A, D29 B, D30 A, D31 A, D32 A. The kickoff prompt in the Stage 36 handoff is unchanged.

## Session dispatch decision

Date: 2026-10-28. Decided by: claude-fable-5-1, the coordinator session, in Claude Code desktop.
Price table: `pricing/2026-10-18.json` (age 10 days; expires 2026-11-01).

### Inputs

| Input | Value | Source |
|---|---|---|
| Window W | 1,000,000 | measured, usage tool |
| Compaction point K | 970,000 | measured, 97 percent of W |
| Current context C0 | 116,880 | measured, usage tool at 17:54 |
| Compacted already | yes | once, earlier today |
| Unrecorded context | none | Stage 36 findings, the twelve-repository list and the push are all on disk or in git |
| Expected turns T | 55 (range 40 to 70) | roadmap row 37, assessment section 5 |
| Fresh input per turn F | 6,000 | estimated: read-heavy audit (handoffs, test files, trail status output, one gate) |
| Output per turn O | 2,500 | estimated: xhigh reasoning plus findings by file and line |
| Fresh baseline B | 86,642 | measured: 116,880 total minus 30,238 Messages |
| Re-read set R | 31,500 | measured bytes / 4: AGENTS 7,552; persona 53,035; node-ts-js.fable 1,643; protocol 22,996; handoffs 33 to 36 31,983; baseline 3,726; assessment row 37 about 5,000 |
| Handoff size H | 2,500 | this record; the brief already exists |
| Task type | adversarial acceptance | authors Sonnet (33), Haiku (34, 36), Opus (35); one class above the highest is Fable |
| Design-heavy | yes | an acceptance judges work against D13 and the handoffs |
| Irreversible or outward-facing steps | none | the prompt forbids pushing and committing in other repositories |

### Step A: continue or hand off

```
C_end   = 116,880 + 55 * 6,000          = 446,880
crosses = 446,880 > 970,000             = false
C_cont  = 116,880 + 165,000             = 281,880
C_fresh = 86,642 + 31,500 + 165,000     = 283,142

cost_continue = 55*281,880*0.25e-6 + 55*6,000*12.5e-6 + 55*2,500*50e-6 + 0
              = 3.88 + 4.13 + 6.88                                      = $14.88
cost_fresh    = 2,500*50e-6 + 118,142*12.5e-6 + 55*283,142*0.25e-6 + 4.13 + 6.88 + 0
              = 0.13 + 1.48 + 3.89 + 4.13 + 6.88                        = $16.50
```

Prices used (per million): input 10.00, output 50.00, cache_read 0.25, cache_write 12.50 for
claude-fable-5-1.

Draft verdict: continue, by cost, margin $1.62 (10.9 percent of $14.88). Overridden by
guardrails 2 and 8 below: the verdict is fresh.

### Step B: model, effort and concurrency

| Piece | Class | Model id | Effort | Oracle | Serial or parallel | Cost |
|---|---|---|---|---|---|---|
| Stage 37 acceptance | fable | claude-fable-5-1 | xhigh | handoff `<date>-stage-37-acceptance.md` with findings by file and line, gate judged under D13 against docs/baselines | serial, one piece | $16.50 |

Serial chain: 55 turns, one gate of about 7 minutes, `trail status` per committed repository,
60 to 120 minutes, plus 5 minutes to read and the operator's click to open. Review: 30 minutes.
Effort raised because the acceptance covers a release (Stage 33's tag), rule in step 3.1.

### Guardrails checked

1. Under 10 turns: no, T = 55.
2. Design-heavy across a compaction: yes, this session has compacted once, so fresh.
3. Irreversible steps: none; the brief says do not push, do not commit in another repository.
4. Model from the table: claude-fable-5-1 is the table's fable-class row.
5. Table age 10 days, under 14; no null in the row used.
6. Acceptance one class above the author: highest author Opus (Stage 35), reviewer Fable.
7. Decision budget: within 8,000 tokens and 10 minutes (table below).
8. Class and effort: this session runs below xhigh and cannot raise itself or start a child above
   its own effort, so the operator opens the session and sets claude-fable-5-1, xhigh.

### Adversarial pass

The opposite verdict, argued: this session verified Stages 32 to 36 against disk itself and the
arithmetic favours it by 10.9 percent; a fresh session re-reads 31,500 tokens to reach the same
footing and starts colder. If the effort rule could be met here, continuing would be cheaper.

Each input, the way it could be wrong:

- C0: measured; 30 percent higher (152,000) adds $0.48 to continue and nothing to fresh, margin
  falls to 7.4 percent and quality decides for fresh.
- T: if it doubles to 110, both sides grow; margin falls to $1.64 (4.8 percent), within the band.
- F and O: F at 8,000 gives $17.01 against $18.63, margin 9.5 percent, within the band.
- B and R: R leaves out the test files Stage 37 may open; a larger R widens fresh's cost only.
- Task type: not mechanical; an acceptance that found nothing would still need the read.
- Prices: table 10 days old; Fable has no long-context tier in the table.
- Unrecorded context: none named, so penalty_loss is zero.

Recomputed with the adverse value that moves the result most (T = 110):

```
cost_continue = 110*446,880*0.25e-6 + 8.25 + 13.75   = 12.29 + 8.25 + 13.75          = $34.29
cost_fresh    = 0.13 + 1.48 + 110*448,142*0.25e-6 + 8.25 + 13.75 = 0.13+1.48+12.32+22.00 = $35.93
```

Verdict holds: yes. Within 10 percent, a compacted session loses on quality; fresh either way.

### Final verdict

Fresh, model claude-fable-5-1, effort xhigh, one piece, serial. Exact next action: the operator
commits the ten Stage 36 repositories (the kickoff checks committed repositories), opens a new
session on this checkout at claude-fable-5-1, xhigh, and pastes the kickoff prompt from the last
section of `docs/handoffs/2026-10-28-stage-36-nine-repositories.md`. This session verifies the
report when it lands.

### Cost of deciding

| Row | Value | Source |
|---|---|---|
| Context at start | 116,880 | usage tool, 17:54:46 |
| Context at end | 128,138 | usage tool, 17:56:37, after the record was written |
| Input tokens read | about 8,400 | the 11,258 difference less the output: price table, template, usage, file sizes, front matter |
| Output tokens | about 2,800 (estimate, characters / 4) | this record and the reply |
| Wall clock | about 3 minutes | 17:54:46 to 17:57 |
| Priced | 8,400 at 12.50 plus 2,800 at 50.00 per million, about $0.25 | table `pricing/2026-10-18.json` |

## Cost and time projection

Stage 37: $16.50 at Fable xhigh with T 55, F 6,000, O 2,500; $35.93 if T doubles. Wall clock 60
to 120 minutes plus 5 minutes to read; operator review 30 minutes.
