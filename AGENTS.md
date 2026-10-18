Model class: load `ENGINEERING_PERSONA.md` (the Fable-class edition is
the one checked in; a harness or delegating agent directing a lower
class loads the matching edition as the persona's section 3.2 says)
plus `ENGINEERING_PERSONA_LANGUAGES/node-ts-js.<class>.md` and, when
the task touches shell scripts, `bash.<class>.md`. Then
`docs/operator-protocol.md`: the operator's standing instructions,
loaded on every session and binding.

# AGENTS.md: fork_graft (the operator's fork of @nanonets/graft)

This repository is the operator's fork of
`github.com/NanoNets/context-graph-engine` (npm `@nanonets/graft`, MIT).
It exists to carry local fixes and new file-type indexing that are
upstreamed by pull request. The global install on the operator's
machine (`npm root -g`, Node 26.7.0 under nvm4w) is built from this
fork, so what this tree builds is what every other repository's
`graft` command runs.

## Non-negotiables

1. **`npm run build && npm test` is the gate**, on the Node the global
   install runs (26.7.0 here; upstream CI runs Node 20 on Ubuntu and
   Windows, so nothing may need a newer Node). Nothing is done until it
   exits zero and the counts are quoted in the report. `npm ci` fails on
   this machine while `tree-sitter-kotlin` compiles under Visual Studio
   18 (its `binding.gyp` passes clang-only LTO flags); install with
   `npm ci --ignore-scripts` and copy `node_modules/tree-sitter-kotlin/build/Release`
   from the global install, as `docs/operator-protocol.md` section 10 records.
2. **Patches live in source, with a test that fails first.** Never edit
   `dist/` by hand; `dist/` is rebuilt and copied into the global install
   (section 10 of the protocol). The former `patch/patch_graft_crux.py`
   workflow is retired by `test/crux-id-echo.test.ts` and its fix in
   `src/ai/crux.ts`.
3. **Upstream branches are cut from `upstream/main`, never from `main`.**
   `main` carries the operator's files (this file, the persona, the
   protocol, `docs/handoffs/`, `docs/*plan*`); a pull-request branch
   cherry-picks only the feature's `src/`, `test/`, `CHANGELOG.md`,
   `CREDITS.md` and `README.md` commits. `git log upstream/main..<branch>`
   must show nothing else before a branch is handed to the operator.
4. **graft's promise is an exact locator.** Every node this fork adds
   carries a span that `--source` can print verbatim: a `file:line` span
   in the file itself, or a span into a cached text rendering whose
   page or heading the locator names. A plausible-but-wrong line is worse
   than no node.
5. **Deterministic and keyless by default.** New tiers parse with
   tree-sitter grammars already in `tree-sitter-wasm` or with a
   hand-written scanner, cached by content hash, no network, no model.
   Anything that needs a converter dependency (PDF, DOCX, EPUB, PPTX) is
   opt-in and loaded lazily, with a refusal that names the package to
   install.
6. **No vendor fact, price or model name in source.** The persona's
   rules on magic numbers, error messages and configuration apply.
7. **Windows is the primary platform.** Paths through `relPosix`; tests
   must pass under cmd.exe (`scripts/run-tests.mjs` enumerates files for
   that reason); never assume a POSIX shell.
8. **Keep the upstream conventions.** Tests are `test/*.test.ts` on
   `node --test` via `tsx`; a changelog entry per user-visible change;
   credits for contributed languages; the README language table updated
   in the same commit as a new tier.

## Operator protocol (always on)

The full text and mechanics are `docs/operator-protocol.md`. The rules
that every session applies without being asked:

1. **Handoff on every model or effort change, new agent, or finished
   stage.** Write `docs/handoffs/YYYY-MM-DD-<stage>.md` from the
   template in `docs/handoffs/README.md`: goal, decisions made, files
   that matter, verified facts, work completed, open questions, exact
   next action, API cost projection, time projection. Nothing else.
2. **Commit before handing off.** Gate green, work committed, then the
   handoff; never a red tree, never uncommitted work.
3. **Create the next session's entry yourself.** A stage for a cheaper
   model that is fully specified runs as a subagent (`Agent` tool with
   `model` and `effort`) with the handoff as its brief. A stage that
   needs a fresh long-lived session gets a sidebar chip (`spawn_task`)
   carrying the handoff path; tell the operator the model and effort
   to pick, since a chip cannot set them and a session cannot re-price
   itself. A session that takes over a handoff checks its own model
   and effort first and stops on a mismatch.
4. **Every stage report ends with the next stage's model, effort and exact kickoff
   prompt**, as a labelled line and a fenced block, so the operator can set the
   model menu and paste without hunting. Standing instruction, 2026-10-13.
5. **Projections are arithmetic, not adjectives.** Cost at API list
   price with the assumptions stated; time as wall clock plus review
   time. Method in the protocol, section 6 and 7.
6. **Decisions the operator must make** are presented as decision,
   options, pros and cons, blast radius, recommendation with reasoning.
   Everything not depending on the decision is finished first.
7. **Prose conventions hold in every file written here:** Australian
   English, no em-dashes, none of the persona's banned vocabulary.
   Upstream's own prose (README, comments) is left as it is unless the
   change touches the line.
8. **The standing analysis brief.** The operator's six-question project
   analysis instructions are recorded verbatim in the protocol, section
   1.1. A session asked to analyse the project answers them in a dated
   `docs/assessment-YYYY-MM-DD.md`. The newest is
   `docs/assessment-2026-10-18.md`; the staged roadmap in its section 6
   is the current plan, and its section 7 holds the open decisions.

## Daily commands

```
npm ci --ignore-scripts     # then copy the Kotlin grammar binary (protocol section 10)
npm run build               # tsc + viewer bundle + grammar queries into dist/
npm test                    # node --test over test/*.test.ts (about 7 minutes here)
npm run cli -- ask "<q>"    # run the CLI from source
node scripts/sync-global.mjs   # copy the built dist into the global install (Stage 0)
```
