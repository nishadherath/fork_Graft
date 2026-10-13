---
stage: "Stage 11: live --deep smoke against DeepSeek, BENCH reasoning levels in .env"
model: claude-opus-5-5
effort: high
status: in-progress
created: 2026-10-14
from: "Stage 10 session; operator switched the session to Opus 5.5 and chose DeepSeek"
---

# Stage 11: live --deep smoke against DeepSeek

## Goal

The global `graft build --deep` completes against DeepSeek (`GRAFT_MODEL=deepseek-flash`,
`GRAFT_BASE_URL=https://api.deepseek.com`) on a throwaway two-file repo, with the
exit code and cost line quoted, and the key found in no file or log written by the run.
`.env` gains `BENCH_AGENT_REASONING` and `BENCH_JUDGE_REASONING`. Nothing pushed.

## Decisions already made

- Model: the operator moved this session to Opus 5.5 at effort high; the Stage 10
  report had proposed Sonnet at low. Recorded, not reopened.
- The key stays in `.env` (git-ignored, `.gitignore:11`); the smoke run gets it through
  the process environment only, never on a command line or in a file under the repo.
- `.env.example` is upstream's file and is left as it is: the BENCH variables it
  documents belong to the `bench/` harness upstream removed in `821b12f`.
- If the run fails, restore `D:/Code/Claude/fork_graft-global-deps-backup-2026-10-14`
  only after the operator is told what failed.

## Files and links that matter

- `src/ai/providers.ts:76` (`resolveConfig`: one model, `GRAFT_MODEL`, for every LLM call).
- `src/ai/llm/openai.ts:123` and `:198` (DeepSeek thinking mode refuses a forced
  `tool_choice`; retried with `reasoning_effort: "none"`).
- `src/cli.ts:7` (`dotenv/config`: `.env` is read from the working directory only).
- DeepSeek thinking-mode guide: https://api-docs.deepseek.com/guides/thinking_mode/

## Verified facts

- `GET /models` on the configured base URL lists `deepseek-flash` and `deepseek-v4-pro` (2026-10-14).
- DeepSeek guide, fetched 2026-10-14: thinking on by default, `reasoning_effort` low, high or
  max, default high; `temperature` has no effect in thinking mode; with `tools`, every
  earlier turn's `reasoning_content` must be passed back or the API answers 400.
- Nothing in `src/`, `scripts/` or `test/` reads `BENCH_*` (`git grep`, 2026-10-14).
  The removed harness read them in `bench/llm.ts` (`git show 821b12f^:bench/llm.ts`).

## Work completed

Nothing yet in Stage 11.

## Unresolved questions

- Operator: whether graft itself should gain a reasoning-effort setting for `GRAFT_MODEL`.
- Operator: pushing `main`. Not this stage.

## Exact next action

Append the two reasoning lines to `.env` after `BENCH_JUDGE_MODEL`, then build the throwaway repo under the scratchpad.

## Cost projection

Opus 5.5, high ($4.00 in, $20.00 out, $0.20 cache read per million; protocol table).
Assumptions: 15 turns, average context 90k, 3k fresh input and 2k output per turn.
Cache 15 x 90k = 1.35M x $0.20 = $0.27. Fresh 15 x 3k = 45k x $5.00 = $0.23.
Output 15 x 2k = 30k x $20 = $0.60. About $1.10; quote $1 to $2. DeepSeek spend for the
smoke run: two files, a handful of calls, under one cent. Estimates.

## Time projection

Wall clock 10 to 15 minutes; no `npm test` (no source change). Operator review: about 5 minutes.
