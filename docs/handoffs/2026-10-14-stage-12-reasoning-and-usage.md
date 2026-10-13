---
stage: "Stage 12: GRAFT_REASONING, deep-pass token usage, .env.example refresh"
model: claude-opus-5-5
effort: high
status: in-progress
created: 2026-10-14
from: "Stage 11 session; operator decisions 1 and 2 (both yes), run in the same Opus session"
---

# Stage 12: reasoning setting and deep-pass usage

## Goal

`GRAFT_REASONING` (and `--reasoning`, `EngineConfig.reasoning`) sets the reasoning
effort graft sends on every LLM call; unset sends nothing, as today. `graft build
--deep` prints one line of summed token usage after the deep pass and records it
as `deepUsage` in `graft/manifest.json`. `.env.example` matches the fields and
layout of the operator's `.env`. Gate green, global install synced, nothing pushed.

## Decisions already made

- Values are passed through, not enumerated in source: the vocabulary differs per
  vendor (no vendor facts in source). `resolveConfig` checks only the shape
  (lowercase letters) and names the variable when it is wrong; a server's 400 that
  names `reasoning_effort` is rethrown with `GRAFT_REASONING=<value>` and the model label.
- OpenAI wire (openai, litellm, orcarouter): `reasoning_effort`. A forced tool call
  the server refuses in thinking mode keeps the existing retry with `"none"`, now
  also when the user set a level; such calls are counted and reported, not hidden.
- Anthropic wire: `output_config.effort`; `none` sends `thinking: {type: "disabled"}`.
  Typed in the SDK, not live-tested (no Anthropic key here).
- Usage: `Usage.reasoning` (optional) from `completion_tokens_details.reasoning_tokens`;
  a `MeteredChatModel` decorator sums every call; the engine wraps its model in it.
- `deepUsage` is an additive optional manifest field; no timestamp (determinism).
- `.env.example` is upstream's file; changed because the operator asked.

## Files and links that matter

- `src/ai/providers.ts`, `src/ai/llm/{types,factory,openai,anthropic}.ts`, `src/engine.ts`,
  `src/cli.ts` (build action, global options), `src/graph/workspace-cli.ts:70`,
  `src/context/node-file.ts:64` (Manifest), `src/blast/name.ts:279` (namer model).
- `test/llm-adapters.test.ts` (stub-client pattern).

## Verified facts

- DeepSeek, live, 2026-10-14: usage carries `prompt_tokens_details.cached_tokens` and
  `completion_tokens_details.reasoning_tokens`; `reasoning_effort` accepts none,
  minimal, low, medium, high, xhigh, ultra, max, and a bogus value gets a 400 naming them.
- Installed SDK types: openai `ReasoningEffort` none|minimal|low|medium|high|xhigh;
  Anthropic `OutputConfig.effort` low|medium|high|xhigh|max.
- Summaries ask for `maxTokens: 2048`; reasoning tokens spend the same budget.

## Work completed

Nothing yet in Stage 12.

## Unresolved questions

- Operator: pushing `main`. Not this stage.

## Exact next action

`git worktree add ../fork_graft-stage12-main -b stage-12/reasoning-usage main`, `npm ci --ignore-scripts`, copy the Kotlin binary, write the failing tests.

## Cost projection

Opus 5.5, high ($4.00 in, $20.00 out, $0.20 cache read per million; protocol table).
Assumptions: 60 turns, average context 120k, 4k fresh input and 3k output per turn.
Cache 60 x 120k = 7.2M x $0.20 = $1.44. Fresh 60 x 4k = 240k x $5.00 = $1.20.
Output 60 x 3k = 180k x $20 = $3.60. About $6.25; quote $5 to $9. One live DeepSeek
check: under one cent. Estimates.

## Time projection

Wall clock 60 to 90 minutes, including one gate of about 7 minutes. Operator review: about 15 minutes.
