---
stage: "Stage 13b: repeat unset and none to separate the level from variance"
model: claude-sonnet-5-5
effort: medium
status: done
created: 2026-10-14
from: "Stage 13 handoff (2026-10-14-stage-13-reasoning-levels.md), operator request"
---

# Stage 13b: reasoning level, repeat run

## Goal

Stage 13 saw 14 concept nodes with `GRAFT_REASONING` unset and 7 with `none`, from one
run each. Repeat both once, same method, to see whether the gap is the level or variance.

## Decisions already made

- Same method as Stage 13: global graft 0.21.1, Node 26.7.0, `deepseek-flash`, throwaway
  copy per run, `build --deep --no-reuse --only-dir src/ai`, settings from `.env` through
  the child environment only. `.env` not changed.
- This time the copy filter matches on the base name, so the copy held no `.env`,
  `node_modules`, `.git`, `graft/` or `dist/` (listed the copy: none present).

## Files and links that matter

- `docs/handoffs/2026-10-14-stage-13-reasoning-levels.md` (first sample and method).

## Verified facts

All 2026-10-14, both runs exit 0, 13 files, 103 symbols.

```
unset: 27 calls, 10,371 input, 47,872 cached, 18,492 output (1,129 reasoning) · reasoning: provider default; 14 forced-tool calls ran with reasoning off
none:  27 calls,  9,897 input, 47,744 cached, 16,439 output · reasoning none
```

Both samples together (input is input plus cached):

| | run | input total | output | reasoning | concept nodes | links |
|---|---|---|---|---|---|---|
| unset | 13 | 58,406 | 21,034 | 1,407 | 14 | 48 |
| unset | 13b | 58,243 | 18,492 | 1,129 | 10 | 28 |
| none | 13 | 57,512 | 16,540 | 0 | 7 | 19 |
| none | 13b | 57,641 | 16,439 | 0 | 10 | 27 |

- The node-count gap was mostly variance. Unset ranged 10 to 14 nodes and 28 to 48
  links; `none` ranged 7 to 10 nodes and 19 to 27 links. At 10 nodes they match
  (28 against 27 links). One sample cannot rule out a small effect, but 14 against 7 is
  not the level.
- Output means: unset 19,763, `none` 16,490, a saving of 3,273 tokens a run (16.6%).
  About 1,268 of it (39%) is reasoning skipped (mean unset reasoning); the rest, about
  2,005, is shorter visible text. `none` was also steadier (16,540 and 16,439) than unset
  (21,034 and 18,492).
- Reasoning at the default is 6.7% and 6.1% of output, so the thinking itself is a small
  cost here; only 13 of the 27 calls can think at all.
- Concept titles: the repeat nodes differ from Stage 13's (unset 13b has
  `provider-quirk-fallback-ladder` and `multi-turn-replay-and-cache-breakpoints`; `none`
  13b has `litellm-and-orcarouter-gateway-adapters` and `provider-factory-and-wire-format-dispatch`),
  so which concepts get a node of their own moves from run to run at either setting. I
  compared counts and titles only this stage, not node bodies or symbol lines.
- Recommendation, revised: `GRAFT_REASONING=none`. Stage 13 recommended leaving it unset
  because its `none` run had coarser nodes; the repeat shows that was variance, so the
  reason falls away. What remains is a 17% output saving, steadier output, and no
  quality loss seen in two samples of each. Still weak evidence (n=2); unset remains a
  safe choice. `low` stays out (Stage 13: 5,333 reasoning tokens for no saving).
  Prices are not in this repository, so the saving is quoted in tokens.
- Key scan, key supplied on stdin, 2026-10-14: scratchpad before deleting the copies,
  after, the repository except `.env` and `node_modules`, and 78 MB of patch text across
  every git ref: 0 hits.

## Work completed

- Two deep passes on throwaway copies under the session scratchpad; copies deleted
  (the scratchpad holds only the two scripts, which contain no key).
- No source changed, so no build or test gate; the commit is this handoff only.
- `.env` untouched; nothing pushed.

## Unresolved questions

- Operator: set `GRAFT_REASONING=none` in `.env`, or leave unset. Neither is applied.
- Not measured: node-body and symbol-summary quality in the repeat; Anthropic mapping
  (no key here).

## Exact next action

Operator: to adopt, uncomment `GRAFT_REASONING` in `.env` and set it to `none`. No
further stage is required.

## Cost projection

Sonnet 5.5, medium ($2.00 in, $10.00 out, $0.20 cache read per million). Assumptions:
12 turns, average context 40k, 3k fresh input and 1.2k output per turn.
Cache 12 x 40k = 480k x $0.20 = $0.10. Fresh 12 x 3k = 36k x $2.50 = $0.09.
Output 12 x 1.2k = 14.4k x $10 = $0.14. About $0.33. The two DeepSeek passes
used 76,735 and 74,080 tokens in total; provider prices are not recorded here. Estimates.

## Time projection

Wall clock about 15 minutes, mostly the two sequential passes. Operator review: about 5 minutes.
