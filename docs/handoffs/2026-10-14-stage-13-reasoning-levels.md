---
stage: "Stage 13: choose a GRAFT_REASONING level for the deep pass"
model: claude-sonnet-5-5
effort: medium
status: done
created: 2026-10-14
from: "Stage 12 session; operator request of 2026-10-14"
---

# Stage 13: reasoning levels compared on a real deep pass

## Goal

Run the same `graft build --deep --no-reuse --only-dir src/ai` three times on a
throwaway copy of this repository, with `GRAFT_REASONING` unset, `low` and `none`,
using the global graft and the DeepSeek settings from `.env`. Quote each run's
`tokens:` line, read five concept nodes and five symbol summaries side by side,
and recommend one level with the token arithmetic and the quality differences
seen. Delete the copy; confirm no file holds the key. `.env` is not changed.

## Decisions already made

- Settings reach graft through the process environment only, read from `.env` by
  a script in the scratchpad; the key never appears on a command line or in a file.
- The copy lives under the session scratchpad, outside the repository, so the
  repository's own `graft/` and `.env` are untouched.
- `--no-reuse` on every run so no run is served from another run's cache; each
  run gets its own fresh copy of the graph directory.
- Stage 12 left the level unset because one sample of two text calls was too small;
  this stage uses 5 text-call-heavy summaries across `src/ai` instead.

## Files and links that matter

- `docs/handoffs/2026-10-14-stage-12-reasoning-and-usage.md` (open question this answers).
- `src/ai/llm/metered.ts:68` (the `tokens:` line format), `src/ai/providers.ts:110`.
- `.env` (git-ignored; read for settings, never printed, never edited).

## Verified facts

Global graft 0.21.1, Node 26.7.0, `deepseek-flash` via the DeepSeek base URL, copy of
`main` at 6ff8d88 without `node_modules`, `.git`, `graft/`, `dist/`, `.env`;
`graft build --deep --no-reuse --only-dir src/ai`, 13 files, 103 symbols, all three exit 0,
2026-10-14. The `tokens:` lines, verbatim:

```
unset: 27 calls, 50,854 input, 7,552 cached, 21,034 output (1,407 reasoning) · reasoning: provider default; 14 forced-tool calls ran with reasoning off
low:   27 calls, 26,554 input, 30,976 cached, 20,547 output (5,333 reasoning) · reasoning low; 14 forced-tool calls ran with reasoning off
none:  27 calls, 26,536 input, 30,976 cached, 16,540 output · reasoning none
```

Arithmetic (input = input + cached; visible = output - reasoning):

| | input total | output | reasoning | visible output | output vs unset |
|---|---|---|---|---|---|
| unset | 58,406 | 21,034 | 1,407 | 19,627 | 1.000 |
| low | 57,530 | 20,547 | 5,333 | 15,214 | 0.977 |
| none | 57,512 | 16,540 | 0 | 16,540 | 0.786 |

- Input is the same to within 1.5% in every run. The split between `input` and `cached`
  is provider cache state (unset ran first on a cold cache), so compare the sum, not the split.
- Reasoning is 6.7% of the output at the default and 26% at `low`: `low` is the dearest
  way to think here, 3.8 times the default's reasoning tokens. The most `none` can save
  from reasoning is 1,407 tokens; the other 3,087 of its 4,494-token saving is less visible text.
- Only 13 of the 27 calls could think (14 forced-tool calls run with reasoning off at the
  default and at `low`), which is why the reasoning share is small.
- Symbol summaries: all three runs produced the same 103 symbol lines with identical spans;
  the six compared (`terminalReason`, `record`, `checkReasoningLevel`, `resolveConfig`,
  `openai.create`, `formatUsageLine`) differ in wording only, none in meaning. `none`'s
  `formatUsageLine` line is the least complete (omits calls and the token breakdown); `low`'s
  `resolveConfig` is the only one to name precedence rules and `reasoning`.
- Concept nodes differ a great deal: unset 14 nodes and 48 links, `low` 6 nodes and 13 links,
  `none` 7 nodes and 19 links. Compared on the same topics (token metering, failure gate):
  the unset nodes are longer (203 and 246 words against 127/175 for `low` and 174/200 for
  `none`) and carry more links (3 each against 1 and 2 for `low`, 2 and 2 for `none`). `low` and `none` folded the
  per-vendor transports and the reasoning-effort negotiation into one transport node; only
  the unset run kept `reasoning-effort-negotiation-and-degradation`, `anthropic-native-transport`
  and `openai-compatible-transport` as nodes of their own, which are the concepts this
  directory is about. The failure-gate node of `none` states "1,617 failed calls", which
  `src/ai/failure.ts:7` confirms (the one hard figure I checked; the rest were read for sense, not audited line by line).
- One sample per level. The node count did not follow reasoning tokens (unset thought
  least and wrote most), so it cannot be attributed to the level without a repeat.
- Recommendation: leave `GRAFT_REASONING` unset (provider default). Reasoning is not the
  cost: the default spends 1,407 reasoning tokens in 21,034, and `low` costs more for
  less. `none` saves 21% of output tokens but the saving is mostly coarser concept nodes, not
  skipped thinking. If a fixed, reproducible setting is wanted, `none` is the one to choose
  (cheapest, summaries unchanged); `low` should not be used. Prices are not in this
  repository, so the saving is quoted in tokens: 4,494 output tokens a run of this size.

## Work completed

- Three deep passes run on throwaway copies under the session scratchpad; `.env` read into
  the child process environment only and not changed; copies deleted.
- Key scan, key supplied on stdin: before deletion the only hits were the three copied
  `.env` files (my copy filter missed `.env` on Windows, and also copied `node_modules`);
  after deletion the scratchpad and the repository (every file but `.env` and
  `node_modules`) hold 0 hits, and all git history on every ref (78 MB of patch text) holds 0.
  `.env` is git-ignored and was not edited.
- No source changed, so no build or test gate was run; the commit is this handoff only.
- Slip, disclosed: one history check passed the key as a `git log -S` argument for a
  moment (a process argument, nothing printed or written). Rotate the key if that matters to you.

## Unresolved questions

- Operator: accept "leave unset", or choose `none`. A repeat of unset and `none` (about
  60k tokens each) would show whether the 14-against-7 concept-node gap is the level or
  run-to-run variance; not run, since the request was three runs.

## Exact next action

Operator: read the recommendation under Verified facts. To keep it, do nothing. To
choose `none`, uncomment `GRAFT_REASONING` in `.env` and set it to `none`.

## Cost projection

Sonnet 5.5, medium ($2.00 in, $10.00 out, $0.20 cache read per million). Assumptions:
25 turns, average context 60k, 3k fresh input and 1.5k output per turn.
Cache 25 x 60k = 1.5M x $0.20 = $0.30. Fresh 25 x 3k = 75k x $2.50 = $0.19.
Output 25 x 1.5k = 37.5k x $10 = $0.38. About $0.87; quote $0.5 to $1.5.
Three DeepSeek deep passes over `src/ai`: provider list price not recorded in
this repository; the token totals below are the measure. Estimates.

## Time projection

Wall clock 20 to 40 minutes, dominated by three sequential deep passes. Operator
review: about 10 minutes.
