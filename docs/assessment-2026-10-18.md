# Assessment of fork_graft, 2026-10-18

Written by a Fable 5.1 (high) session on 2026-10-18, answering the
operator's six standing analysis questions (recorded verbatim in
`docs/operator-protocol.md`, section 1.1) for the whole project directory.
Every number below was measured in this session on the operator's machine
(Windows 11, Node 26.7.0 under nvm4w) unless a date says otherwise; the
commands are in section 8. The earlier assessment of the same kind is the
plan of 2026-10-13 (`docs/plan-file-type-indexing-2026-10-13.md`), which
this document does not repeat.

## 0. Conclusion

The fork is in good engineering order and in a weak strategic position.
Every stage of the 2026-10-13 plan is done, gated and synced into the
global install; the structured and documents tiers carry 174 tests of
their own and an acceptance report with fixtures of known line numbers.
Three things are wrong today, in order of cost:

1. **Upstream has moved further than the plan assumed.** It is now
   `trailhq/Trail-Code`, at 0.23.0 on npm since 2026-10-15, with 14 commits
   `main` does not have, 133 open pull requests (56 on 2026-10-13), and a
   product pivot to "Trail" (team learnings) that moves the code map to
   `.trail/cache/` under the new name. A dry-run merge into `main` conflicts
   in 12 files, all at the seams the fork's tiers were spliced into. None of
   the five pull-request branches has been pushed, and the design issue the
   operator approved on 2026-10-13 (decision D5 A) was never opened. The
   fork's 10,000 added lines are unreviewed by the people who would have to
   maintain them, and the cost of merging grows with every upstream day.
2. **graft is slow to start on this machine, and that defeats its own
   hooks.** `graft --version` takes 6.3 s through node and 7.8 s through the
   `.cmd` shim; bare node starts in 0.35 s. The cost is eager module loading:
   importing the MCP server module alone takes 4.5 s, the two LLM SDK
   adapters 2.8 s between them, the Claude hooks module 1.9 s, all before a
   command runs. The prompt hook that `graft init` installs has a 15 s budget
   and gives its `graft ask` child 8 s, so on this machine the child has
   under two seconds of real work time, and a query that must refresh first
   (65 s measured today) cannot finish inside any hook.
3. **The fork's own repository does not use the fork's features, and its
   graph has drifted.** `graft/` here holds cards dated 2026-10-13 that show
   `section` and `task` units, but the wiring rebuilt on 2026-10-14 and again
   today has none (no `.graft/config.json`, so the structured tier is off),
   zero summaries and zero crux excerpts, and `INDEX.md` lists the stale
   `Dockerfile` card as a concept. The tool's promise that cards and wiring
   agree does not hold after a tier is switched off, and nothing reports it.

The recommended order of work is: open the design issue now (cheap, and its
answer decides how much else is worth doing), merge upstream 0.23.0, fix
startup, add a cards-against-wiring invariant and re-enable the tier here,
then rebase and open the pull requests only if upstream wants them. Section
6 prices each stage; the total is about $23 to $45 of API spend and seven to
eleven hours of agent time. Decisions the operator must make are in section
7.

## 1. What the project's deliverables are

The repository is the operator's fork of upstream Graft (`@nanonets/graft`,
MIT), a tool that builds a code graph of a repository as Markdown cards plus
a wiring file and serves it to coding agents through a CLI, an MCP server and
Claude Code hooks. The fork exists to carry fixes and new indexing that are
meant to go upstream by pull request. Its deliverables, in the order the
operator depends on them:

1. **The global `graft` command on the operator's machine.** Built from this
   tree by `npm run build` and copied into the nvm4w global install by
   `scripts/sync-global.mjs`. Every other repository on the machine that is
   wired for graft runs this binary. Today it answers `0.21.1-nishadherath.1`.
2. **The structured tier** (`src/graph/structured/`, 13 families, opt-in with
   `--structured`): Markdown sections, JSON, YAML, TOML and INI keys, HTML,
   Svelte and Astro elements, CSS and SCSS rules, XML, Gradle, Makefile,
   CMake, Dockerfile and shell units, each with an exact line span, plus
   deterministic edges from code to keys, links to sections, pages to
   stylesheets and scripts, and `npm run x` to the script key.
3. **The documents tier** (`src/graph/structured/documents/`, opt-in with
   `--documents`): PDF, DOCX, ODT, EPUB, PPTX and ODP rendered once to a
   cached text file with page or slide markers, then indexed as sections.
4. **Reasoning control and usage reporting for the deep pass**:
   `GRAFT_REASONING` and `--reasoning`, and a `tokens:` line after
   `build --deep`, recorded in `graft/manifest.json`.
5. **Two fixes**: the crux id echo (`src/ai/crux.ts`, upstream issue #542) and
   the MCP launcher that is always the installed `graft mcp` on every
   platform (`src/hosts/mcp-config.ts`), with a Windows-correct PATH probe.
6. **Six branches for upstream**: `pr/crux-id-echo`, `pr/structured-tier-core`,
   `pr/structured-tier-markup-build`, `pr/structured-edges`,
   `pr/documents-tier` (based on upstream `fe30ead`, 2026-10-13) and
   `fix/windows-mcp-launcher` (pushed to origin, not opened upstream), with
   their texts in `docs/archive/upstream/` and a draft advisory in `docs/security/`.
7. **The operator's process assets**: `AGENTS.md`, the engineering persona and
   its language profiles, `docs/operator-protocol.md`, the session-start hook,
   sixteen stage handoffs under `docs/handoffs/`, the acceptance report and its
   fixture scripts, and two idempotent patch scripts under `patch/` for a stock
   0.21.1 install.

## 2. How it all works

**The build.** `graft build` walks the repository (`src/ingest/fs.ts`: git-visible
files under 1 MB, skip lists, every dot-path skipped except the admitted
`.github/workflows`), and `src/graph/build.ts` dispatches each file to one of four
tiers in a fixed order: depth (hand-written extractors over native tree-sitter
grammars for TypeScript, JavaScript, Python, Go, Java, Kotlin, Swift, PHP and R),
container (`.vue`, whose script block is handed to the depth tier with spans
shifted back), breadth (a generic `tags.scm` query over one of the WebAssembly
grammars shipped in `tree-sitter-wasm`), and, when the repository opted in, the
fork's structured tier. Documents are converted asynchronously before the loop
and their renderings indexed by the Markdown scanner. Extraction is cached by
content hash per extractor stamp; a change of extractor code moves the stamp and
empties the cache. The result is `graft/.graph/wiring.json` (nodes with `id`,
`kind`, `path`, `span`, `signature`, `body_hash`, optional `body_text`; edges with a
relation and a confidence), one Markdown card per source file under `graft/`, and
`graft/INDEX.md`.

**Retrieval.** `graft ask` (`src/ask/ask.ts`, 1,589 lines) ranks lexically over
names, signatures, summaries and the capped body text, with a graph-rank boost;
`--source` prints the span verbatim from the file or, for a document, from the
rendering. `graft grep` runs a regex over indexed files grouped by enclosing
symbol; `skeleton`, `callers`, `map` and `blast` read the wiring. Every query
first runs a freshness probe over the same file enumeration the build used and
rebuilds what changed, unless `--no-refresh` or `GRAFT_NO_REFRESH=1`.

**The deep pass.** `build --deep` summarises files and symbols and synthesises
concept nodes through one provider adapter (`src/ai/llm/`: OpenAI wire format,
native Anthropic, LiteLLM, OrcaRouter), cached by hash, with the fork's reasoning
level and token accounting. The repository's `.env` points at DeepSeek; no deep
pass has been run on this repository.

**Agent integration.** `graft init` writes each host's instruction file and MCP
entry (`.mcp.json`, `~/.claude.json`, Cursor, Gemini, Codex and others), and for
Claude Code a statusline plus hooks: `UserPromptSubmit` (15 s budget) runs `graft
ask` and injects a retrieval pack, `PostToolUse` tallies savings, `Stop` rebuilds
in the background, `SessionStart` refreshes the wiring when the running version
differs from the stamp. The MCP server exposes `graft_find_code`, `graft_find_all`,
`graft_trace_calls`, `graft_file_api`, `graft_repo_map` and
`graft_check_freshness`. This repository itself is wired only through the skill
file `.claude/skills/graft/SKILL.md`; it has no `.mcp.json` and no graft hooks.

**The fork's process.** `AGENTS.md` is loaded by every session and points at the
persona and the protocol. Each stage of work is specified by a handoff file whose
front matter names the model and effort; the session-start hook announces the
newest one. A stage ends with the gate (`npm run build && npm test`, about eight
minutes here, run one at a time), a commit, a sync into the global install and a
handoff for the next stage with a cost and time projection.

## 3. Assessment

**What is good.** The fork's own code follows the standard it sets itself:
every family has a fixture test with known line numbers, spans are asserted
(`spanOf` throws on an inverted range), secrets are denied by name and by
value shape, lockfiles and minified assets are never indexed, documents keep
the binary's path on the node and point into a hashed rendering, and the
resolver drops an ambiguous match rather than guess. The acceptance of
2026-10-13 tested a 50 MB PDF, a 10,110-key JSON, every CommonMark heading
form and Windows paths against fixtures, found four defects, and all four were
fixed with tests before the stack was rebased. Decisions are written down with
options and blast radius and then not reopened. The gate counts are quoted in
every handoff. This is better discipline than most upstream pull requests
show, and it is the reason the tiers can be trusted.

**What is weak.**

- *Strategy.* The plan of 2026-10-13 was built on upstream accepting four
  stacked pull requests and a design issue. Five days later the issue is not
  open, nothing is pushed, upstream has renamed itself, doubled its open
  pull-request count and pivoted its product. The probability that a
  10,000-line tier from an outside contributor lands in that queue is low
  and falling. The fork must decide whether it is a staging area for
  upstream or the operator's own build; the two call for different spend.
- *Startup cost.* Measured in section 8: 6.3 s before `--version` answers,
  because `src/cli.ts` (2,000 lines, 48 static imports) and the modules it
  pulls load the MCP server, both LLM SDKs and the hooks machinery
  regardless of command. Upstream 0.22 made native grammars lazy
  (`src/graph/native.ts`) but left the rest eager (58 static imports in its
  `cli.ts`). On this machine the installed hook budgets cannot be met, so the
  Claude Code integration that is graft's main selling point is mostly
  silent here. This has not been noticed because this repository has no
  hooks and the other wired repositories were not measured.
- *Graph drift in the fork's own repository.* Section 0, item 3. A plain
  build after a `--structured` build drops the tier's nodes but the refresh
  path leaves the old cards and `INDEX.md` in place, and the concept listing
  then mistakes a root-level structured card for a concept node. The
  invariant "cards agree with wiring" is not checked by `graft check`.
- *Retrieval quality is unmeasured.* With zero summaries, `ask` here is
  lexical only. A natural question about the structured tier's dispatch
  ("how does the structured tier decide which family parses a file")
  returned the `StructuredFamily` type alias first and never the function
  that answers it, `structuredLangOf` at `src/graph/structured/index.ts:L84-L89`.
  One sample proves nothing; the point is that no harness exists to turn
  that into a number, so no stage can claim an improvement.
- *Upstream traits the fork inherits.* Vendor prices live in source
  (`src/context/price.ts`, a table of Claude model ids and dollar rates),
  against the persona's rule 6; `src/graph/extract.ts` is 2,605 lines and
  `src/cli.ts` 2,000; there is no linter or formatter in the gate;
  `graft upgrade` would silently replace the fork build with upstream's. None
  of these is the fork's fault, and only the last one bites the operator.
- *The global install is partly hand-made.* `sync-global` copies `dist/`
  only; the document converters and the Kotlin grammar binary were copied by
  hand (recorded in the memory notes and protocol section 10). A Node switch
  under nvm4w silently loses them.

**Scalability, stated as an envelope.** The structural build is linear in
file count and bytes (one parse per changed file, cached by hash); the
fork's keys are capped at 500 per file and four levels deep, sections at
5,000 characters of body text. The lexical index (`ask-index.json`, 2.3 MB
here for 2,882 nodes) is loaded whole on every query, so query time grows
with repository size and is already dominated by startup, not ranking. The
breaking point today is the hook budget, not the graph.

## 4. Status

| Item | State on 2026-10-18 |
|---|---|
| `main` | `cdd4806`, version `0.21.1-nishadherath.1`, in sync with `origin/main` |
| Against upstream | 84 commits ahead; 14 behind `ead585b` (0.23.0); 182 files differ, 15,137 insertions and 9,532 deletions; 12 files conflict on a dry-run merge |
| Stages 0 to 14 | All `status: done` in `docs/handoffs/`; the last gate (2026-10-15) ran 1,553 tests, 1,548 passed, 5 skipped |
| Global install | `0.21.1-nishadherath.1`, converters hand-copied on 2026-10-13 |
| Upstream pull requests | None opened; the operator's one upstream item is issue #542 (2026-10-03) |
| Pull-request branches | Five on upstream `fe30ead` (2026-10-13), local only; `fix/windows-mcp-launcher` pushed to origin |
| Security advisory | Draft with reporter and notification placeholders; not sent; the Windows probe bug is still present in upstream 0.23.0 (`spawnSync('graft', ...)` at `src/hosts/mcp-config.ts:57` there) |
| Open operator decisions | `GRAFT_REASONING` (Stage 13b: leave unset or `none`, neither applied); the rule-3 exception for `package.json` on `pr/documents-tier`; prose secrets in Markdown (Stage 7) |
| Uncommitted at session start | A price correction in `docs/operator-protocol.md` dated 2026-10-18 in its own text; committed by this session on its own |
| This repository's graph | 2,882 nodes, no structured kinds, 0 summaries, cards and `INDEX.md` stale since 2026-10-13 and 2026-10-14 |

## 5. Improvements proposed

In priority order. Each is scoped so a lower class can execute it from a
handoff; the model class is justified by the judgement the work needs, not
its size.

1. **Open the design issue and decide the upstream question.** The text
   exists (`docs/archive/upstream/design-issue.md`); it needs the 0.23.0 facts (new
   repository name, the `.trail/cache/` layout, the brand split) and then
   posting through the REST API with the credential-manager token, as the
   memory note records. The answer, or its absence after a fortnight,
   decides whether item 5 is worth its cost.
2. **Merge upstream 0.23.0 into `main`.** Twelve conflicting files, all
   known: the CLI, the four build and check modules where the structured
   dispatch meets upstream's new `tierOf` and native fallback, `state.ts`,
   `mcp-config.ts` (keep the fork's constant launcher, replace `findOnPath`
   with upstream's `commandOnPath`), the two manifests and the two documents.
   Also: record the `trailhq/Trail-Code` name in `AGENTS.md` and protocol
   section 10, check whether upstream's WASM fallback removes the Kotlin
   binary-copy step, re-gate, sync, and measure startup before and after.
3. **Cut startup to under 1.5 s by loading per command.** Move the MCP
   server, the LLM adapters, the hooks machinery and the brain client behind
   `await import()` in the command that uses them; keep `--version`, `ask`,
   `grep`, `skeleton` and the hook entry points on a path that loads only the
   graph reader and the ranker. Definition of done: a test that spawns
   `dist/cli.js --version` with a loader hook recording every resolved module
   and asserts no SDK or MCP module loaded; wall time for `--version` and for
   `ask --no-refresh` quoted before and after; the prompt hook's retrieval
   pack observed inside its budget in one wired repository on this machine.
   This is a fix upstream would take, and it should be offered as one.
4. **A cards-against-wiring invariant, and the tier back on here.** `graft
   check` compares the kinds and ids the cards claim with the wiring and
   reports the drift; the refresh path prunes cards whose source file is no
   longer indexed and rewrites `INDEX.md`; the concept listing ignores a
   root-level card whose stem is a known source file whether or not that file
   is in the current wiring. Then `graft build --structured` in this
   repository so `.graft/config.json` persists the choice, and `--deep` once
   so `ask` here has summaries to rank on.
5. **Rebase the five branches onto 0.23.0 and open the pull requests**,
   only after items 1 and 2, and only if upstream's answer to the issue is
   not a refusal. Each branch is re-gated one at a time (the suite cannot
   run in parallel here) and audited with `git log upstream/main..<branch>
   --stat` before pushing.
6. **A retrieval evaluation harness.** Twenty questions about this
   repository with the span that answers each, a script that runs `graft ask`
   and reports hit-at-1 and hit-at-3, run on the lexical graph and again after
   a deep pass, with the pass's token line beside the numbers. Without it,
   neither the reasoning-level question from Stage 13 nor any ranking change
   can be settled.
7. **Make the global install reproducible.** `sync-global` carries the
   optional converter packages (or names each one missing and the command
   that installs it) and checks the Kotlin binary, so a Node switch cannot
   leave the documents tier refusing every file.
8. **Finalise and send the advisory.** Fill the reporter and notification
   fields, re-check the patch against 0.23.0 (the probe is unchanged there)
   and send it through the channel `SECURITY.md` names. This is the
   operator's action; a session prepares the text.
9. **Close the small open decisions.** Record `GRAFT_REASONING` as "leave
   unset" (Stage 13b showed the gap was variance), rule on the `package.json`
   exception and on prose secrets, and remove the dead reference to a
   2026-10-11 assessment from the protocol (done in this session).

Not proposed: embeddings or a vector index (the lexical rank has not been
measured to be insufficient), image understanding, adopting the `trail`
command or layout for the global install (the `graft` name keeps every
command and output unchanged, and `@nanonets/graft` continues to publish),
or splitting `cli.ts` and `extract.ts` for their own sake (upstream owns
them and a split without a behaviour change is merge debt).

## 6. Staged roadmap by model class

Prices are the protocol's section 2 table as corrected on 2026-10-18 (USD
per million tokens; Sonnet cache read 0.10, Opus 0.20, Fable 0.25, Haiku
0.01 under 100k tokens). The method is section 6 of the protocol: cache
reads at turns times average context, fresh input at 1.25 times the input
rate, output at the output rate, with 3k fresh and 1.5k output tokens per
turn unless stated. Time is agent wall clock; the gate is about eight
minutes and runs at least twice per coding stage; operator review is extra.

| Stage | Model, effort | Scope (section 5 item) | Depends on | Turns, context | Cost (central, quoted range) | Agent time |
|---|---|---|---|---|---|---|
| 15 | Fable 5.1, high | This assessment, the brief recorded, the protocol pointer fixed | none | done | see the Stage 15 handoff | 2 h |
| 16 | Haiku 5.5, medium | Item 1: refresh the design issue text for 0.23.0; item 8: fill the advisory placeholders; item 9: the three small decisions written up for the operator | none; can run now | 30 turns, 50k | $0.05 ($0.05 to $0.20) | 15 to 30 min, plus 15 min of operator posting |
| 17 | Opus 5.5, high | Item 2: merge upstream 0.23.0, resolve the 12 conflicts, `commandOnPath` for `findOnPath`, record the new upstream name, measure the Kotlin fallback and startup, gate, sync | none | 100 turns, 100k | $6.50 ($5 to $10) | 90 to 150 min, two gates; 30 min review |
| 18 | Sonnet 5.5, high | Item 3: per-command loading, the loader-hook test, before and after timings, the hook observed in budget | 17 | 60 turns, 80k | $1.83 ($2 to $4) | 45 to 90 min; 15 min review |
| 19 | Sonnet 5.5, medium | Item 4: the cards-against-wiring check, refresh-path pruning, concept listing fix, structured tier and one deep pass on this repository | 17 | 40 turns, 60k | $1.14 ($1 to $2.50) | 30 to 60 min, plus the deep pass's own API spend, quoted by its tokens line |
| 20 | Haiku 5.5, medium | Item 7: `sync-global` carries the converters and checks the Kotlin binary, with a dry-run test | none | 25 turns, 40k | $0.04 ($0.05 to $0.20) | 15 to 30 min |
| 21 | Sonnet 5.5, high | Item 5: rebase the five branches onto 0.23.0, five sequential gates, path audits, push, open the pull requests with the stored credential | 17, and the answer to the issue from 16 | 80 turns, 90k | $2.52 ($2.50 to $5) | 60 to 120 min, of which 40 min is gates |
| 22 | Opus 5.5, high | Item 6: the evaluation harness, its question set, the before and after run | 18, 19 | 50 turns, 80k | $3.05 ($3 to $5) | 45 to 90 min |
| 23 | Fable 5.1, high | Adversarial acceptance of 17 to 19: merge correctness on fixtures, startup budget on this machine, drift check on a repository switched on and off, the upstream patch offered for 18 | 17, 18, 19 | 60 turns, 100k | $8.25 ($8 to $16) | 60 to 120 min |

Totals: about $23 to $45 at list price, seven to eleven hours of agent
time, about two hours of operator review and posting. Stages 16 and 20 can
run at once with 17 (they touch `docs/`, `scripts/` and nothing 17 edits);
18 and 19 follow 17 and may run in parallel worktrees if their gates run
one after the other; 21 waits for both 17 and the upstream answer; 22 after
18 and 19; 23 last.

By class: Haiku takes the text and script chores with the harness as the
oracle (16, 20); Sonnet takes the scoped module work with a stated test
(18, 19, 21); Opus takes the cross-module merge and the evaluation design
(17, 22); Fable takes acceptance one tier above the author (23). Nothing in
this roadmap needs Fable to write code.

## 7. Decisions for the operator

```
D8  Decision:      what the fork is for, now that upstream has pivoted
    Options:       A staging area for upstream: open the issue, merge, rebase,
                     open the pull requests, keep merging upstream weekly
                   B the operator's own build: merge upstream when a release
                     matters, stop rebasing the stack, keep the branches as a
                     record
                   C open the issue now, merge once (Stage 17), then choose A
                     or B on upstream's answer within a fortnight
    Pros and cons: A keeps the door open at about $5 to $10 and two hours per
                     merge, every week or two, with a low chance of a 10,000-line
                     contribution landing in a 133-deep queue
                   B cheapest, and the fork keeps every feature; the gap to
                     upstream then only grows, and a later merge costs more
                   C spends $7 once to learn whether A is possible
    Blast radius:  A and C: nothing until a pull request is opened; B: none
    Recommended:   C. The issue costs nothing, Stage 17 is needed under every
                   option, and the answer is the only fact that separates A
                   from B.

D9  Decision:      whether the global install follows upstream's `trail` name
    Options:       A keep `graft` (command, package @nanonets/graft, graft/ layout)
                   B move to `trail` (@trailhq/trail-code, .trail/cache/)
    Pros and cons: A every wired repository, hook, statusline and this fork's
                     tests keep working unchanged; upstream says it will keep
                     @nanonets/graft publishing
                   B the layout upstream develops first, at the cost of
                     re-wiring every repository and re-aiming sync-global
    Blast radius:  B: every wired repository on the machine
    Recommended:   A, until upstream deprecates @nanonets/graft; re-check at
                   each merge.

D10 Decision:      whether to send the advisory
    Options:       A send after Stage 16 fills the placeholders
                   B fold the fix into the pull request only
                   C do neither
    Pros and cons: A is the responsible path and the bug is still live in 0.23.0;
                     needs the operator's name and a channel (SECURITY.md names
                     an email and GitHub advisories)
                   B reaches maintainers without a disclosure record
    Blast radius:  none to this machine; reputational only
    Recommended:   A

D11 Decision:      GRAFT_REASONING for the deep pass
    Options:       A leave unset (the provider's default)
                   B set `none`
    Pros and cons: Stage 13b found the concept-node gap between them was
                   run-to-run variance; A is the state in force
    Blast radius:  none
    Recommended:   A, and close the question in the next handoff.
```

## 8. Verified facts (this session, 2026-10-18)

- `git log upstream/main..main --oneline | wc -l` printed 84 before the
  fetch; after `git fetch upstream --tags`, `git log main..upstream/main`
  listed 14 commits to `ead585b` ("Trail-code 0.23.0", 2026-10-15) and
  `git diff main...upstream/main --stat | tail -1` printed 182 files,
  15,137 insertions, 9,532 deletions.
- `git merge-tree --write-tree --name-only main upstream/main` exited 1 and
  named `CHANGELOG.md`, `README.md`, `package-lock.json`, `package.json`,
  `src/cli.ts`, `src/graph/build.ts`, `src/graph/check.ts`,
  `src/graph/container.ts`, `src/graph/extract.ts`, `src/graph/workspace-cli.ts`,
  `src/hosts/mcp-config.ts` and `src/util/state.ts` as conflicting.
- `npm view @nanonets/graft version` and `npm view @trailhq/trail-code
  version` both printed 0.23.0, modified 2026-10-15.
- The GitHub search API for `repo:trailhq/Trail-Code author:nishadherath`
  returned one item, issue 542; `is:pr is:open` on the repository returned
  133.
- `git show upstream/main:src/hosts/mcp-config.ts` still has
  `spawnSync('graft', ['--version'], { stdio: 'ignore', timeout: 5000 })` at
  line 57 and the `NPX_LAUNCH` and `TRAIL_NPX_LAUNCH` entries;
  `src/graph/native.ts` exists there with lazy native loading.
- Timing (bash `time`, wall clock): `node -e 0` 0.35 s; `node <global>/dist/cli.js
  --version` 6.50, 6.35 and 6.33 s; `graft --version` through the shim 7.88
  and 7.78 s; `ask --no-refresh -n 1` 7.69 s; `ask -n 1` with the default
  refresh 65.47 s (the graph was from 2026-10-14; the refresh rebuilt it).
- Module import times, each in a fresh node process (`await import`):
  `mcp/server.js` 4,507 ms; `claude/hooks.js` 1,871 ms; `ai/llm/openai.js`
  1,671 ms; `ai/llm/anthropic.js` 1,133 ms; `graph/build.js` 1,010 ms;
  `ask/ask.js` 934 ms; `graph/extract.js` 592 ms; `brain/push.js` 392 ms;
  `graph/generic.js` 64 ms; `cli-meta.js` 46 ms; `hosts/registry.js` 33 ms.
  These overlap (the server imports the ranker and the builder), so they
  do not sum; the whole CLI measured 6.3 s above.
- `grep -c "^import" src/cli.ts` printed 48; the same on
  `upstream/main:src/cli.ts` printed 58.
- Hook budgets written by `graft init` (`src/claude/settings-merge.ts`):
  `UserPromptSubmit` 15,000 ms, `SessionStart` 8,000, `Stop` 8,000,
  `PostToolUse` 10,000 and 8,000; the prompt hook's child default is 8,000 ms
  with 2,000 ms overhead and a 4,000 ms floor (`src/claude/hooks.ts`).
- This repository's graph: `wiring.json` had 2,849 nodes and 8,548 edges
  (2026-10-14) and 2,882 nodes after today's refresh; kinds `file`, `function`,
  `method`, `class`, `interface`, `type` only; 0 nodes with a summary, 0 with a
  crux. No `.graft/config.json`. `graft/AGENTS.md`, `graft/Dockerfile.md` and
  `graft/package.md` are dated 2026-10-13 20:28 and list `section` and `task`
  units; `graft/INDEX.md` (2026-10-14) lists `Dockerfile` under Concepts. No
  `.mcp.json` and no graft entries in `.claude/settings.json` here.
- `graft ask "how does the structured tier decide which family parses a
  file" --no-refresh` returned, in order, `StructuredFamily`,
  `structuredFileNode`, `familyOf`, `resolveStructuredRef`, `Family`
  (viewer), `decideAutopush`, `buildGraph`, `types.ts`.
- Line counts: `src/` 41,283 lines; `test/` 32,235 lines in 156 `*.test.ts`
  files with 1,515 static `test(` calls, of which 174 in 20 `structured-*`
  files; `src/graph/extract.ts` 2,605, `src/cli.ts` 2,000, `src/ask/ask.ts`
  1,589.
- `git diff upstream/main...main --stat -- src test | tail -1`: 93 files,
  10,063 insertions, 191 deletions (the fork's own code and tests).
- `git status --short` at session start: `M docs/operator-protocol.md` only;
  `git log origin/main..main` and the reverse both printed 0.
- The gate run by this session is quoted in the Stage 15 handoff.

## 9. Own-build pivot and the roadmap after Stage 23 (added 2026-10-26)

The roadmap in section 6 ends at Stage 23. What followed, from the handoffs:

- **Decision D8 closed as option B, with SCSS kept (operator, 2026-10-26).**
  The fork is the operator's own build, not a staging area for upstream. No
  pull requests are sent, `main` is the only branch, and pushes go to
  `origin` only. The `upstream` remote is read-only.
- **Stage 24** released `v0.25.0-nishadherath.1`, pushed `main` to
  `origin` and deleted the `pr/*` stack and leftover worktrees; Stage 21
  (rebasing the pull-request branches) is superseded.
- **Stage 25** closed out the pivot on the operator's answers D17 to D23:
  AGENTS.md and the protocol reworded to the merge rule below (D17); the
  retrieval question set resolves spans from symbols (D19); `status`
  registered under the graft brand (D20); a machine-wide gate lock in
  `scripts/run-tests.mjs` (D21); this section (D22); release
  `0.25.0-nishadherath.2` and its tarball (D23). The record is
  `docs/handoffs/2026-10-26-stage-25-own-build-close-out.md`.
- **Standing merge rule (D17, D18).** Upstream is merged into `main` by a
  recorded stage, never rebased onto, and only when the operator decides to.
  The first such stage is whichever upstream release the operator names;
  it runs on Opus 5.5 at high effort, costs about $6.50 and two hours plus
  review at Stage 17's measure (more after a long gap), and ends with the
  gate judged by name under D13.
- **Open work.** None is scheduled. Section 5's remaining items are taken up
  only when the operator names them; the next body of work is the operator's
  to set, and a fresh assessment on the six-question brief (protocol section
  1.1) is the Fable-class stage to ask for when it is unknown.
