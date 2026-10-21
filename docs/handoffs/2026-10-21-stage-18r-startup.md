---
stage: "Stage 18r: startup by per-command loading (roadmap Stage 18)"
model: claude-sonnet-5-5
effort: high
status: ready
created: 2026-10-21
from: "Stage 17 session (Opus 5.5, high), after the upstream 0.23.0 merge"
---

# Stage 18r: startup by per-command loading

Roadmap Stage 18 in `docs/assessment-2026-10-18.md` section 6 (item 3 of section 5).
Named 18r because the defaults-on work took the number 18.

## Goal

`graft --version`, `graft ask --no-refresh` and the hook entry points load only what
they use. A test spawns `dist/cli.js --version` with a module loader hook that records
every resolved module and asserts that no LLM SDK (`openai`, `@anthropic-ai/sdk`), no
MCP server module (`dist/mcp/`) and no Claude hooks module loaded. Wall times for
`--version` and `ask --no-refresh -n 1` are quoted before and after, three runs each.
The target is under 1.5 s for `--version` through the global shim. The gate is green
with its counts, the global install is synced, and the work is committed on `main`.

## Decisions already made

- Move the MCP server, the LLM adapters, the hooks machinery, the learnings and
  workspace modules and anything else a command alone needs behind `await import()`
  inside that command's action. Keep the static imports that `--version`, `ask`,
  `grep`, `skeleton` and the hook entry points need.
- No behaviour change: same output, same exit codes, same options. A split of
  `cli.ts` into files is out of scope (assessment section 5, "Not proposed").
- Keep each commit to `src/cli.ts`, the modules it touches and the new test, so the
  change can later be cut onto `upstream/main` and offered (roadmap Stage 21).
- Run the gate one at a time (memory note `gates-one-at-a-time`).
- Never run a graft command in this checkout as a smoke test: upkeep rewrites the
  agent files (protocol section 10). Use a temporary folder, wired there with
  `graft init <tmp> --agents claude --yes --no-global` when a hook must be observed.

## Files and links that matter

- `src/cli.ts` (about 2,400 lines; `grep -c "^import" src/cli.ts` for the count),
  `src/bin/graft.ts` (the shim's entry since 0.23.0; it sets the brand and imports
  `cli.js`), `src/cli-meta.ts`.
- `src/claude/hooks.ts` and the prompt hook budget: `UserPromptSubmit` 15,000 ms,
  child `graft ask` 8,000 ms (`src/claude/settings-merge.ts`, `promptAskTimeout`).
- `scripts/run-tests.mjs` (tests are `test/*.test.ts` on `node --test` via `tsx`);
  `test/helpers.ts` `runCli`.
- `docs/assessment-2026-10-18.md` section 8: the module import times of 2026-10-18.
- `docs/architecture/system-reference.md` sections 3 and 7.4 (update the timings).

## Verified facts (2026-10-21, Node 26.7.0, after the merge `a1e3f50`)

- `--version`, bash wall clock: fork `dist/` 1.53, 1.52, 1.46 s; global through node
  2.15, 2.07, 2.06 s; through `graft.cmd` 2.52, 3.03, 2.35 s; `node -e 0` 0.38 s.
- `ask --no-refresh -n 1` through `graft.cmd` in a one-file repo: 2.38, 2.61, 2.24 s.
- The 6.3 s of 2026-10-18 did not reproduce; the per-module import times in
  assessment section 8 were not re-measured and must be, first.
- Gate on `a1e3f50`: 1,665 tests, 1,653 passed, 0 failed, 12 skipped, 531 s.
- `main` and the global install match: `node scripts/sync-global.mjs --dry-run`
  printed 0 would change, 859 unchanged.

## Work completed

None.

## Unresolved questions

- Whether the global install is slower than the fork's `dist/` (2.1 s against
  1.5 s, same code) because of the C: drive, its scanning, or the shim. Measure
  before attributing; a later stage or the operator decides whether it matters.

## Exact next action

Re-measure the import time of each top-level module of `dist/cli.js` in a fresh
node process each (`node --input-type=module -e "const t=Date.now(); await
import('./dist/<m>.js'); console.log(Date.now()-t)"`), and write the list down
before any edit.

## Cost projection

Sonnet 5.5, high ($2.00 in, $10.00 out, $0.10 cache read per million). 60 turns,
average context 80k, 3k fresh and 1.5k output per turn: cache 4.8M x $0.10 = $0.48;
fresh 180k x $2.50 = $0.45; output 90k x $10.00 = $0.90. About $1.83; quote $2 to $4.

## Time projection

Wall clock 45 to 90 minutes, including two gates of about nine minutes each, run one
at a time. Operator review about 15 minutes.
