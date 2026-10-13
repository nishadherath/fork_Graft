---
stage: "Stage 12: GRAFT_REASONING, deep-pass token usage, .env.example refresh"
model: claude-opus-5-5
effort: high
status: done
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
  minimal, low, medium, high, xhigh, ultra, max; a bogus value is refused with HTTP 422
  (not 400) naming them, seen through graft's own build.
- SDK types after `npm ci` on `main` (openai 7.32.0, @anthropic-ai/sdk 0.122.0): openai
  `ReasoningEffort` none|minimal|low|medium|high|xhigh|max; Anthropic `OutputConfig.effort`
  low|medium|high|xhigh|max; Anthropic usage has `output_tokens_details.thinking_tokens`.
- Summaries ask for `maxTokens: 2048`; reasoning tokens spend the same budget.

## Work completed

- `0743b9a` feat(ai): `GRAFT_REASONING` / `--reasoning` / `EngineConfig.reasoning`;
  `MeteredChatModel`; `tokens:` line and `deepUsage` in the manifest (single repo and
  workspace children); refused level terminal in `failure.ts`; namer skips on a bad level.
  New `test/reasoning-usage.test.ts` (14 tests), each seen failing first; two checked
  by deliberate breakage (retry condition, reasoning-off clause).
- `238dc9b` docs(env): `.env.example` mirrors the operator's `.env` field set (verified by a
  sorted field-name diff). The operator's `.env` (git-ignored) gained the same commented
  `GRAFT_REASONING` block, the DeepSeek base URL example and the `<repo>/graft` default.
- Live, DeepSeek `deepseek-flash`, two-file repo, `--no-reuse`, worktree build:
  default 5 calls, 1,388 input, 2,560 cached, 1,875 output (218 reasoning), 3 calls
  reasoning off; `--reasoning low` 5 calls, 2,174 output (651 reasoning), 3 off;
  `--reasoning bogus` exit 1, both passes stopped naming `GRAFT_REASONING`. No file held the key.
- Gate on the final tree, Node 26.7.0, sequential: `npm run build` exit 0; `npm test`
  1,552 tests, 1,547 pass, 0 fail, 5 skipped, 349 s. `sync-global`: 43 changed, 0 stale;
  global `graft --help` lists `--reasoning`. Nothing pushed.

## Unresolved questions

- Operator: which `GRAFT_REASONING` to use with deepseek-flash. One sample per level
  (two text calls each) is too small to choose on: `low` produced more reasoning tokens
  than the default in that run. Left unset (provider default, high).
- Not live-tested: the Anthropic mapping (no Anthropic key here).
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
