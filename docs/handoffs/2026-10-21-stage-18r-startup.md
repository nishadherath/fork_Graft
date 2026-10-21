---
stage: "Stage 18r: startup by per-command loading (roadmap Stage 18)"
model: claude-sonnet-5-5
effort: high
status: done
created: 2026-10-21
from: "Stage 17 session (Opus 5.5, high), after the upstream 0.23.0 merge"
---

# Stage 18r: startup by per-command loading

Roadmap Stage 18 in `docs/assessment-2026-10-18.md` section 6 (item 3 of section 5).
Named 18r because the defaults-on work took the number 18.

## Goal

`graft --version`, `graft ask --no-refresh` and the hook entry points load only what
they use. A test spawns `--version` with a module loader hook that records every
resolved module and asserts that no LLM SDK, no MCP server module and no Claude hooks
module loaded. Wall times for `--version` and `ask --no-refresh -n 1` are quoted
before and after, three runs each. The target is under 1.5 s for `--version` through
the global shim. Done: met for `--version`, not for `ask` (see Verified facts).

## Decisions already made

- Move command-only modules behind `await import()` inside that command. No behaviour
  change: same output, same exit codes, same options. A split of `cli.ts` into files is
  out of scope (assessment section 5, "Not proposed").
- Keep the commit to `src/cli.ts`, the modules it touches and the new test, so the
  change can later be cut onto `upstream/main` (roadmap Stage 21).
- Run the gate one at a time (memory note `gates-one-at-a-time`).
- Never run a graft command in this checkout as a smoke test (protocol section 10).
  Timing and smoke runs used a temporary git repository in the session scratchpad.

## Files and links that matter

- Commit `24608e3` on `main`: `src/cli.ts`, `src/engine.ts`, `src/graph/refresh.ts`,
  `src/graph/root.ts`, `src/graph/workspace.ts`, new `src/graph/workspace-index.ts`,
  new `test/startup-imports.test.ts`, `test/resolve-recorder.mjs`,
  `test/resolve-recorder-register.mjs`, `CHANGELOG.md`.
- `docs/architecture/system-reference.md` sections 1, 3 and 7.4 (timings, loading rule).

## Work completed

Per-module import times were re-measured first (fresh node each, `dist/`, ms, shared
dependencies included): `engine.js` 1,617, `graph/workspace-cli.js` 1,203,
`claude/init.js` 505, `hosts/plan.js` 498, `context/check.js` 445, `hosts/retract.js` 417,
`claude/build-progress.js` 414, `graph/check.js` 384, `upkeep-run.js` 350,
`graph/root.js` 298, `graph/workspace.js` 296, `graph/refresh.js` 286. A loader hook then
showed `mcp/server` and `claude/hooks` were already not loaded by `--version`. The cost was
514 resolved modules, 344 of them `openai` and `@anthropic-ai/sdk`, reached through
`engine.ts` and `ai/llm/factory.ts`.

- `engine.ts`: the factory loads on first model use (`chatModel()`, `summarizer()`,
  `synthesizer()` and `cruxSummarizer()` are async; `init` and `graph` already were).
- `cli.ts`: `engineFrom()` is async; `loadWiring()` serves init and uninstall;
  `workspaceCli()` serves the federated commands; `refreshBefore`, the check formatters,
  `upkeep-run` and `graph/source-files` load in place; `ask` calls `ask/ask.js` and
  `notes/ask-notes.js` directly (what `Graft.ask` does), so it skips the engine.
- `graph/workspace-index.ts`: the `workspace.json` readers, re-exported by `workspace.ts`;
  `root.ts` and `cli.ts` import it. `graph/refresh.ts` loads the builder only to rebuild.
- `test/startup-imports.test.ts`: runs from source through tsx (so upstream CI, which does
  not build before `npm test`, can run it) and from `dist/cli.js` (skipped with a reason
  when unbuilt), plus a guard that the recorder sees the SDKs. Red first: with
  `import "./ai/llm/factory.js"` added to `cli.ts` it failed naming
  `node_modules/openai/index.mjs`.
- System reference updated; its committed line numbers into `cli.ts` drifted by up to 30
  lines, and section 3 says so.

## Verified facts (2026-10-21, Node 26.7.0)

- Gate on `24608e3`'s source: 1,668 tests, 1,656 passed, 0 failed, 12 skipped, 583 s
  (`npm run build && npm test`, one run, nothing else running).
- `--version` loads 81 resolved modules (62 under `dist/`, no SDK), from 514.
- Bash wall clock, three runs each, `node -e 0` 0.5 to 0.65 s. `--version`, before (Stage
  17 runs): 2.06, 2.07, 2.15 s through node and 2.35, 2.52, 3.03 s through the shim; after:
  `dist/` 0.97, 1.05, 1.09 s and shim 1.21, 1.29, 1.41 s. `ask --no-refresh -n 1` in a
  one-file temp repo, before: shim 2.24, 2.38, 2.61 s; after: `dist/` 0.82, 1.01, 1.08 s and
  shim 1.75, 1.78, 2.02 s. While the machine was loaded, runs in the same period gave the
  old code 4 to 7 s and the new 1.0 to 1.9 s.
- `node scripts/sync-global.mjs`: 19 changed, 0 stale, 844 unchanged; the global
  `graft --version` printed `0.23.0-nishadherath`.
- `ask` output matched between the old global code and the new `dist/` on identical repos.

## Unresolved questions

- The prompt hook's retrieval pack was not observed inside its 15 s budget in a wired
  repository (assessment item 3 asks for it; this task did not). It has wide headroom:
  `ask --no-refresh` is about 1 s from `dist/`.
- `ask` through the shim is 1.75 to 2.0 s. The rest is `ask/ask.js` (50 modules, reaches
  `graph/extract` through the documents extractor), the freshness probe and the shim. A
  further cut would touch `src/ask/` and `src/graph/fingerprint.ts`.
- The shim costs about 0.2 s over `dist/` for `--version` and about 0.8 s for `ask`; not
  attributed (cmd.exe start, a second node start, or the C: drive).
- The session-start hook rewrote `.claude/helpers/graft-hooks.cjs`,
  `.claude/helpers/graft-statusline.cjs` and `.claude/skills/graft/SKILL.md` and created
  `.mcp.json` in this checkout (the trap in protocol section 10). They are uncommitted and
  were not touched by this stage; the operator decides whether to reset them.
- Offering this upstream (roadmap Stage 21): cherry-pick `24608e3` onto `upstream/main`;
  `cli.ts` will conflict where the fork differs.

## Exact next action

Roadmap Stage 19: `docs/handoffs/2026-10-21-stage-19-cards-check.md`.

## Cost projection

Projected $1.83 ($2 to $4) at Sonnet 5.5 list price. Actual: about 75 turns, context
growing to roughly 130k (average about 80k): cache 6.0M x $0.10 = $0.60; fresh 225k x
$2.50 = $0.56; output about 110k x $10.00 = $1.10. About $2.30. The figures are
estimates; the session usage tool was not queried.

## Time projection

Projected 45 to 90 minutes. Actual about 90 minutes of session wall clock, of which the
gate was 583 s and the import measurements and timing runs about 10 minutes. Operator
review about 15 minutes.
