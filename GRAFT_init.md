# Graft: setup and use in this project

Audience: any agent or person working in this repository who needs to find, read or change code, or who sets the repository up on a new machine.

Graft builds a map of the repository from the code and the Markdown files and answers from that map. It gives exact `file:line` locations and the code around them, and it costs no model tokens for the lookups. Use it before Grep or Read for code questions. Graft's answers are only as current as its index, so rebuild the index after code changes.

This repository is the operator's fork of `@nanonets/graft` (see `AGENTS.md`). Its own source is what the global `graft` command runs, so the index covers this fork's code.

## 1. What is in place

| Part | Where | Purpose |
|---|---|---|
| Graft CLI | Global npm install, built from this fork (`C:\nvm4w\nodejs\node_modules\@nanonets\graft`). `trail --version` reports `0.25.0-nishadherath.2` | Runs every `trail` command. `graft` is the same program under its other name |
| Index | `.trail/cache/` (git-ignored by `.trail/.gitignore`, rebuilt locally). The wiring graph is `.trail/cache/.graph/wiring.json` | The map Graft answers from. 1,020 files, 9,841 nodes and 31,071 edges as built on 2026-10-27 |
| Deep layer | `.trail/cache/` manifest (`manifest.json`) and per-node summaries, last built 2026-10-27 with `graft build --deep`, model `openai:deepseek-flash` (`GRAFT_PROVIDER`, `GRAFT_MODEL`, `GRAFT_BASE_URL` in `.env`) | Concept summaries and per-symbol crux from a language model. Optional. Costs API tokens to refresh. Section 4 has the last run's counts |
| Project instructions | `AGENTS.md`, section "Code navigation (Graft)" | Tells every agent when to ask Graft first |
| Hooks | `.claude/settings.json` (`hooks`) and `.claude/helpers/graft-hooks.cjs` | Session-start, prompt, tool-savings, pre-bash, post-edit, stop and session-end hooks. Each calls the installed Graft package and fails open (`|| exit 0`) so a missing Graft never blocks a tool call |
| Status line | `.claude/settings.json` (`statusLine` and `subagentStatusLine`) and `.claude/helpers/graft-statusline.cjs` | Shows Graft status in the Claude Code status line |
| Permissions | `.claude/settings.json` (`permissions.allow`) | `Bash(graft:*)` and `Bash(npx graft:*)` run without a prompt |
| Ignore rules | `.trail/.gitignore` (`cache/`) and `.gitignore` (`/.graft/`) | The index is not committed, so every clone builds its own |

Subagents do not get the `AGENTS.md` instruction automatically. Give any new agent that reads code and has Bash in its tools the same instruction in its own prompt.

The root `.gitignore` also has `/graft/` (line 10). That folder is not used in this checkout: the index is in `.trail/cache/`.

## 2. Set up a fresh clone

Run these from the repository root, one command at a time.

1. Confirm the CLI is installed:

   ```bash
   trail --version
   ```

   If the command is missing, install Graft as described in `docs/operator-protocol.md` section 10 (the 0.25.0-nishadherath.5 tarball installs `trail` and `graft` together), then run the check again. This repository was verified with `0.25.0-nishadherath.2`.

2. Install dependencies, then build the index:

   ```bash
   npm ci --ignore-scripts
   trail build
   ```

   `npm ci` needs `--ignore-scripts` on this machine; section 10 of the protocol explains the Kotlin grammar copy. The build reads every indexed file and takes several minutes. It needs no API key. Leave out `--deep`: the deep build calls a language model, and it needs `GRAFT_API_KEY` from `.env`.

3. Check the settings files are valid JSON:

   ```bash
   node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')); console.log('ok')"
   ```

   Repeat with `.claude/settings.local.json`. Both should print `ok`.

## 3. Daily use

Use the first command that answers the question. Do not use Grep or Read first for code questions.

`trail` and `graft` run the same program. Under the trail name two commands change: `graft check` is `trail build --check`, and `graft stats` is `trail status`. Every table and example below uses the trail name.

| Need | Command | Notes |
|---|---|---|
| Where is this code, and how does it work? | `trail ask "<task>" --source` | Returns ranked hits with `file:line` and the code. Output can be long; narrow the question if it is |
| Every occurrence of a literal | `trail grep "<literal>"` | Groups hits by enclosing symbol. Use it when you need all of them |
| A file's API without reading the file | `trail skeleton <file>` | Every signature with its line span. Cheapest way to see a file |
| Who calls a function, or what it calls | `trail callers <symbol>` | Add `--direction out` for callees and `--depth all` for the full connected set |
| Is the index current? | `trail build --check` | Renamed from `graft check`. See section 4 for the current verdict and why it is not `OK` |
| Refresh the index | `trail build` | Run after code changes. Does not refresh the deep layer |
| How much has Graft saved? | `trail status` | Renamed from `graft stats`. Shows reads, source reads and tokens saved for the current session |

Before changing a symbol, run `trail callers <symbol> --depth all` and edit every connected file it lists. Editing only the file that defines a symbol is the usual way to miss a caller.

Do not run a graft or trail command as a smoke test in this checkout. This checkout has committed Graft shims, and a version mismatch makes Graft rewrite the agent files and `.claude/settings.json` (`docs/operator-protocol.md` section 10). The commands in this section are safe under the graft name: a `graft build` on 2026-10-27 left `.claude/` byte-identical. The trail spelling has not been measured that way, so back up `.claude/settings.json` (it is git-ignored) before the first `trail` command in this checkout.

## 4. Verify the setup

Run these in order. Each has a pass condition.

1. `trail build --check` reports `trail build --check: OK`. (Under the graft name the same report read `graft check: OK`; `src/cli.ts` line 601 and `src/brand.ts` line 64 pick the spelling.) **Met on 2026-10-27**, when it was run as `graft check` after `graft build --deep`. Before that run it reported `STALE` for 14 changed files and 22 files not in the deep layer.
2. `trail skeleton src/graph/check.ts` lists the functions in that file with their line spans. **Met** (under the graft name).
3. `trail callers checkGraph` shows `callSingleTool` in `src/mcp/tools.ts` and `federateCheck` in `src/graph/workspace.ts` as callers. **Met** (under the graft name).
4. `trail ask "where is the graph staleness check computed" --source` ranks `formatGraphCheckReport` in `src/graph/check.ts` first. **Met** (under the graft name).
5. `trail status` reports graft reads above zero after any of the commands above in the same session. **Met** (four reads in the verifying session).

On 2026-10-27, `graft build` parsed all 1,020 files (a second run with `--no-reuse` gave the same counts). The `.claude/` folder was unchanged after each build.

### Deep layer refresh (2026-10-27)

The operator approved `graft build --deep` on 2026-10-27. Result:

- **Summaries.** 287 nodes computed, 8,997 cached, 0 stale, 559 pending. `graft check` reports this as `meaning tier 94% complete`. The 559 pending nodes are: 310 CSS selectors (155 each in `viewer/style.css` and `docs/architecture/system-diagram.html`), 115 Markdown sections (45 in `CHANGELOG.md`, 41 in `docs/architecture/system-reference.md`, 29 in `ENGINEERING_PERSONA.md`), 64 YAML keys, 25 HTML elements and 45 functions, all 45 in `docs/architecture/system-diagram.html`. The run logged no errors. Nothing here blocks `graft check`. The pending functions are all in one HTML diagram file, so the code under `src/` is fully summarised.
- **Model use.** 89 model calls: 297,594 input tokens (103,808 of them cached) and 117,053 output tokens, on `openai:deepseek-flash` with reasoning off.
- **Verdict.** `graft check: OK`. The wiring graph is in sync with the code.
- **Wiring.** `.claude/` was unchanged after the run.

To refresh the deep layer again after code changes, run `trail build --deep`. It costs model tokens every time, so run it when you need the concept summaries or before a gate that calls `trail build --check`.

## 5. Known limits

- **Two layers.** `trail build` refreshes the wiring graph (nodes, edges, cards) without a model. The deep layer (concept summaries, the `manifest.json` that `trail build --check` reads) only refreshes with `--deep`. A clean `trail build` therefore does not turn `trail build --check` green.
- **Index scope.** Graft indexes Markdown in `docs/` and the repository root as well as code. A query can return prose from an assessment or a handoff. For prose, Read and Grep are still the right tools.
- **Output size.** `trail ask --source` and `trail grep` can return several thousand tokens. Narrow the query when you know the file, and use `trail skeleton` in place of Read.
- **Post-edit rebuild.** The `post-edit` hook delegates to the installed Graft package. Whether it rebuilds the index after each edit has not been verified. Assume it does not, and run `trail build` yourself after code changes.
- **Pipe warning.** Do not pipe Graft output through `head` or `tail`. Graft's token-saving line is at the top of its output, and clipping it hides the savings figure. Write long output to a file and read that instead.
- **Agent coverage.** Only the main agent and `AGENTS.md` carry the Graft instruction. Subagents that read code need it in their own prompts.

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `trail: command not found` | CLI not on the PATH | Reinstall Graft globally from this fork, then open a new terminal |
| `trail build --check` reports `NO GRAPH` | No index yet | `trail build` from the repository root |
| `trail build --check` reports `STALE` with changed files | Code changed since the last build, or the deep layer is behind | `trail build` for the wiring graph, then `trail build --deep` if the deep layer is behind. Section 4 has the last run |
| `trail ask` returns nothing useful | Index missing or built from another checkout | `trail build` from the repository root |
| Hooks do nothing | Graft package not found by `graft-hooks.cjs` | The helper looks for `@trailhq/trail-code`, `@nanonets/graft` or `@trailhq/trail`. Check that one is installed globally |
| `trail status` shows zero graft reads | No Graft commands were run in the session | Expected. Run a command from section 3 |
| `.claude/` changed after a graft command | A version mismatch rewrote the wiring | Restore from git or a backup. The ignored `.claude/settings.json` has no git copy, so back it up before any risky run |

## 7. Changes made when this file was copied in

On branch `main`, not committed:

1. Copied `GRAFT_init.md` from `D:\Code\Claude\Fixer` into this repository, then rewrote it for this fork. The Fixer version described a different project (`tools/`, `books/`, a Korean sync check and a `CLAUDE.md`), none of which exists here.
2. Added the "Code navigation (Graft)" section to `AGENTS.md`, after "Daily commands".
3. Built the index with `graft build`, then ran `graft build --deep` once, as the operator asked. The index is git-ignored, so nothing is committed for it.

Already present before this work: the hooks, status line, permissions and the ignore rules (section 1). They were verified, not changed. `graft check` now reports `OK` (section 4).
