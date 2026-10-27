# Assessment of fork_graft, 2026-10-27

Written by a Fable 5.1 (high) session on 2026-10-27 (Stage 26), answering the
operator's six standing analysis questions (recorded verbatim in
`docs/operator-protocol.md`, section 1.1) for the whole project directory at
`v0.25.0-nishadherath.2` (`main` at `82a9713`, equal to `origin/main`). Every
number below was measured in this session on the operator's machine (Windows
11, Node 26.7.0 under nvm4w) unless a date says otherwise; the commands are in
section 8. The previous assessment is `docs/assessment-2026-10-18.md`; its
section 9 records the own-build pivot of 2026-10-26. This document does not
repeat what that one established and still holds. Decisions continue from D24.

## 0. Conclusion

The fork is in good order and, for the first time, in a settled strategic
position: it is the operator's own build, released and tagged on `origin`,
with every planned stage of the previous roadmap done. Three things need
attention, in order of cost to the operator:

1. **The own build is one `graft upgrade` away from being replaced by
   upstream, and the tool will now recommend exactly that.** Upstream
   published 0.26.0 on 2026-10-26. The version comparison in
   `src/upkeep.ts` strips the prerelease part, so `0.26.0` ranks above
   `0.25.0-nishadherath.2`, and once the daily registry check succeeds
   (today's cached answer is `latest: null` from a failed check at 04:09
   UTC on 2026-10-26) every `graft` command and every wired repository's
   session-start hook prints
   `⬆ graft 0.25.0-nishadherath.2 → 0.26.0 available: run graft upgrade`.
   `graft upgrade` runs `npm install -g @nanonets/graft@latest
   @trailhq/trail-code@latest` and then `trail init` in the current
   repository. An agent that follows the line it is shown replaces the
   fork's global install with upstream's and rewires the repository to
   `trail`. Nothing in the fork guards against this; the nudge is correct
   for upstream's users and wrong for an own build. Decision D24.
2. **The gate is now the dominant cost of every stage.** A full
   `npm test` is 4,261 tests and 27 to 41 minutes here, of which the
   fork's own 34 test files are 248 tests and 143 seconds (measured today,
   all passing). Each stage runs the gate at least once, a merge stage
   three times (fork, baseline, fork again). The fork's suite also sits
   3,873 characters under the Windows command-line limit: upstream 0.26.0
   adds 11 test files at about 58 characters each, so one or two more
   merges and `npm test` fails with `ENAMETOOLONG` before a single test
   runs. A fork-only quick run for the inner loop and a test runner that
   does not put every path on one command line are cheap and pay back on
   the next stage. Decision D27 sets the rule.
3. **Release mechanics are by hand, and the record has already drifted.**
   Five tarballs in twelve days, each needing the same edits to
   `package.json`, both lockfile version fields, a CHANGELOG heading, a
   README section, a tag and a pack. The README's "This build" section
   still says `0.25.0-nishadherath` while the package says `.2`. A release
   script with a test, run by every release stage, ends the drift.

Upstream 0.26.0 itself carries nothing the graft brand needs (its changes
are `trail init --pair`, the workspace connector and `--always-follow`
learnings) and conflicts in four files, all at the fork's seams. Under D18
the merge waits for the operator; the recommendation (D26) is to wait.

The roadmap in section 6 is six stages: a Sonnet stage for item 1 with a
release, a Sonnet stage for items 2 and 3, a Haiku stage for documentation
hygiene, an Opus merge stage held until the operator names a release, an
Opus retrieval stage, and a Fable acceptance. Total about $20 to $40 at
list price and 8 to 15 hours of wall clock, most of it gates.

## 1. What the project's deliverables are

The repository is the operator's own build of upstream `@nanonets/graft`
(now `trailhq/Trail-Code`, MIT), a tool that builds a code graph of a
repository as Markdown cards plus a wiring file and serves it to coding
agents through a CLI, an MCP server and Claude Code hooks. Since the
decisions of 2026-10-26 (D8 B, D17, D18) it merges upstream only when the
operator names a release and sends nothing upstream. Its deliverables, in
the order the operator depends on them:

1. **The global `graft` command on this machine**, `0.25.0-nishadherath.2`,
   under `C:\nvm4w\nodejs\node_modules`, copied from this tree's `dist/`
   by `scripts/sync-global.mjs` after every green gate on `main`. Every
   wired repository on the machine runs it through its hooks, its MCP entry
   and the `graft` skill.
2. **Release tarballs** in `D:\Code\Claude\fork_graft_releases\`: five, from
   `0.21.1-nishadherath` (2026-10-14) to `0.25.0-nishadherath.2`
   (2026-10-26, 4,407,260 bytes), each matching an annotated tag on
   `origin` (`github.com/nishadherath/fork_Graft`).
3. **The fork's features, on by default**: the structured tier (Markdown
   sections; JSON, YAML, TOML and INI keys; HTML, Svelte and Astro
   elements; CSS and SCSS rules; XML, Gradle, Makefile, CMake, Dockerfile
   and shell units), the documents tier (PDF, DOCX, ODT, EPUB, PPTX, ODP
   rendered once to a cached text with page markers), deterministic edges
   from the structured tier to code, LSP edges with a one-line report,
   `GRAFT_REASONING` and the `tokens:` line for the deep pass, per-command
   module loading, the cards-against-wiring check, the SCSS grammar
   vendored from the 1.x bundle, `status` under the graft brand, and the
   fixes recorded in `CHANGELOG.md`. Against the merge base `4e7d0f5` the
   fork is 216 files, 24,973 insertions and 482 deletions in 134 commits,
   with 37 added test files carrying 242 static `test(` calls.
4. **The retrieval evaluation**: `scripts/retrieval-eval.mjs`, twenty
   questions in `.eval/retrieval-questions.json` pinned to symbols, and the
   baseline `.eval/retrieval-2026-10-26.md`.
5. **The operator's process assets**: `AGENTS.md`, the persona and its
   language profiles, `docs/operator-protocol.md`, the session-start hook,
   37 handoffs under `docs/handoffs/`, the acceptance report of 2026-10-13
   with its fixtures, the system reference and interactive diagram under
   `docs/architecture/`, the D13 baseline
   `docs/baselines/upstream-4e7d0f5-failures.txt` (38 names), and the
   machine-wide gate lock in `scripts/gate-lock.mjs`.
6. **Historical texts that no longer describe a plan**: five pull-request
   texts and a design issue under `docs/archive/upstream/`, the unsent launcher
   advisory under `docs/security/`, and `docs/archive/graft-assessment-6.0-astra.md`
   (about a stock 0.21.1 install). Decision D25.

## 2. How it all works

The mechanics have not changed in kind since 2026-10-18; the system
reference (`docs/architecture/system-reference.md`) and the diagram beside
it are the full account. What is different at this release:

- **Tiers.** `graft build` walks git-visible files under 1 MB (dot paths
  skipped except `.github/workflows`) and dispatches each to the depth,
  container, breadth or structured tier; documents are converted first
  and indexed as Markdown. The structured and documents tiers and the LSP
  pass are on unless `--no-structured`, `--no-documents` or `--no-lsp`
  turned them off, and the choice persists in `.graft/config.json` (here:
  `{"structured": true}`). Extraction is cached by content hash per
  extractor stamp.
- **Outputs.** Wiring plus one card per file plus `INDEX.md`, under
  `graft/` for a repository wired as graft and `.trail/cache/` for one wired
  as trail (this checkout, after upstream 0.23.0's layout; D12). `graft
  check` compares the cards and `INDEX.md` with the wiring and exits 1 on
  drift; `status`, the MCP freshness tool and the hooks report card drift
  as a warning (D14) because the Stop hook rewrites cards each turn.
- **Retrieval.** `ask` ranks lexically with a graph boost; summaries and
  crux from a deep pass let the answering symbol outrank its own file
  (section 3). Every query refreshes first unless told not to.
- **Startup.** Each command loads its own modules; `--version` loads no
  graph builder, SDK or MCP server (`test/startup-imports.test.ts`).
- **Upkeep.** Every command except `version`, `upgrade`, `mcp` and the
  hidden update check tops up a machine-global registry cache
  (`~/.graft/update-check.json`, 24-hour TTL, refreshed by a detached
  child) and prints the nudge when the cached `latest` ranks above the
  running version; session-start hooks print the same line from the cache.
- **The process.** A stage is a handoff with model and effort in its front
  matter; it ends with the gate (`npm run build && npm test`, judged by
  test name against the D13 baseline because upstream's timing tests
  cannot pass here), a commit on `main`, a sync into the global install, a
  release when code changed (D23), and the next handoff. `npm test` takes
  `gate.lock` under the user's temp folder, so two gates never overlap.

## 3. Assessment

**What is good.** Every claim in the last three handoffs reproduced today
from the released build in a fresh repository: a five-file fixture built to
21 nodes (11 keys, 3 sections, 2 functions), 19 edges and 5 cards in 5.3 s;
`ask --source` put `server.port` at `config/app.json:L3-L3` first and the
function that reads it second, printing both spans verbatim; a key named
`apiKey` was indexed by name with its value absent from every file under
`graft/`; `check` exited 0 and `status` showed the code map in sync. The
fork's own 34 test files pass 248 of 248 alone. The release, tag, tarball
and global install agree at `0.25.0-nishadherath.2`. Decisions are written
down and not reopened, and the retrieval harness means a ranking change can
now be measured rather than asserted. This is the state the 2026-10-18
assessment asked for.

**What is weak.**

- *The upgrade path is upstream's, not the fork's* (section 0, item 1).
  This is the only item that can undo the operator's work without a
  session noticing, and it became live the day 0.26.0 was published.
- *Gate economics* (section 0, item 2). Of a 27-to-41-minute gate, under
  2.5 minutes exercise the fork's own code. Upstream's wall-clock tests
  are also the reason the gate cannot exit zero here, so every result is
  read through a 38-name baseline that has to be regenerated at every
  merge. The command-line headroom is a cliff, not a slope.
- *Release by hand* (section 0, item 3). Six edits and five commands per
  release, with the README already one release behind.
- *Startup on the C: drive.* From a temporary folder, three rounds:
  `node -e 0` 633, 500 and 513 ms; the fork's own `dist/cli.js --version`
  on D: 1,875, 1,893 and 2,012 ms; the global `graft.cmd --version` on C:
  3,931, 4,189 and 4,026 ms. The two `dist/` trees are identical bytes
  (Stage 23). The operator closed this on 2026-10-26 as transient load;
  today's machine was calm by the `node -e 0` figure and the two-times
  ratio held. The prompt hook gives its `graft ask` child 8 s
  (`CHILD_TIMEOUT_MS`), and `ask --no-refresh` on the 21-node fixture took
  4.4 s through the shim, so the hook works with about half its budget
  spent before the query. Recorded, not reopened.
- *Retrieval quality is measured but low, and the set is not blind.*
  Lexical hit@3 is 4 of 20 and deep 9 of 20; file@3 is 13 of 20 on both;
  three questions fail at file level on both graphs. The questions were
  written by the session that had read the summaries. D11 (the reasoning
  level) is still unsettled because it needs one deep pass per level.
- *Dead texts carry weight.* The pull-request texts, the design issue and
  the advisory describe a plan the operator closed. A session that reads
  `docs/archive/upstream/` cold can mis-start a pull request; `AGENTS.md` now says
  not to, but the texts contradict it. The advisory's bug is still in
  upstream 0.26.0 (`spawnSync('graft', ['--version'])` at line 57 of
  `src/hosts/mcp-config.ts` there), and D10 (send it) was decided on
  2026-10-18 and never carried out; its reporter and notification fields
  are placeholders.
- *Inherited learnings.* `.trail/learnings/` holds six learnings by an
  upstream author about upstream's own publishing, merged in with 0.23.0;
  `graft ask` here puts them above the code when they match. Harmless, and
  a reminder that a merge brings upstream's notes as well as its code.

**Scalability, stated as an envelope.** The structural build is linear in
files and bytes with a per-file cache; this repository's graph is 9,779
nodes and 31,013 edges in a 12.9 MB `wiring.json`, loaded whole on each
query, with 9,048 summaries and 4,269 crux from one deep pass of about
6.1 million input and 1.3 million output tokens (Stage 19; price it from
the provider's list, the fork keeps none). The breaking points today are
the hook budget on the C: drive and the test command line, not the graph.

## 4. Status

| Item | State on 2026-10-27 |
|---|---|
| `main` | `82a9713`, version `0.25.0-nishadherath.2`, equal to `origin/main`; the only branch; worktrees none |
| Tags on `origin` | `v0.25.0-nishadherath.2` (and `.1`, `v0.25.0-nishadherath`, `v0.23.0-nishadherath`, the two `0.21.1` tags) |
| Against upstream | 134 fork commits over `4e7d0f5`; `upstream/main` is `d878681` (0.26.0, 2026-10-26), 9 commits ahead, 109 files, 3,315 insertions, 809 deletions; dry-run merge conflicts in `CHANGELOG.md`, `package-lock.json`, `package.json`, `src/cli.ts`; no dependency change |
| Upstream on npm and GitHub | `@nanonets/graft` and `@trailhq/trail-code` both 0.26.0 (2026-10-26); 10,785 stars, 115 open pull requests, 250 open issues and pull requests together |
| Stages 0 to 25 | All `status: done`; the last gate (Stage 25, 2026-10-26) 4,261 tests, 4,135 passed, 37 failed (34 baseline names, 3 load flakes passing alone), 89 skipped, 1,630.9 s |
| Global install | `0.25.0-nishadherath.2`; both optional converters and the Kotlin binary present (Stage 25 sync) |
| Update nudge | Not yet shown: cached `latest: null` from a failed check on 2026-10-26 04:09 UTC; fires on the next successful check |
| Tree | `src/` 82,820 lines; `test/` 86,906 lines in 495 files with 4,073 static `test(` calls; `src/cli.ts` 2,719, `src/graph/extract.ts` 2,588, `src/ask/ask.ts` 1,605 |
| Test command line | 28,894 of 32,767 characters, 3,873 of headroom, 58 per file |
| Fork-only suite | 34 files, 248 tests, 248 passed, 143 s (`node --import tsx --test <files>`, nothing else running) |
| This repository's graph | 9,779 nodes, 31,013 edges, 9,048 summaries, 4,269 crux, `structured: true` saved |
| Open operator decisions | D11 (reasoning level, needs one pass per level); D10 (advisory, decided A, not sent); new: D24 to D27 below |
| Uncommitted at session start | Nothing |

## 5. Improvements proposed

In priority order. Each is scoped so a lower class can execute it from a
handoff; the class is set by the judgement the work needs.

1. **Make `upgrade` and the nudge fork-aware** (D24). A build whose
   `package.json` carries a fork marker (a field the release script
   writes, not a string compared against a vendor's name) makes `graft
   upgrade` refuse with the fork's own route (`node scripts/sync-global.mjs`
   from the fork, or the tarball), and makes the nudge informational: it
   names upstream's version and says the merge is the operator's decision,
   with no command to run. `_update-check` keeps running so the fact is
   current. Tests: the nudge text under a fork marker, the refusal, and the
   unchanged behaviour without the marker. Then release `.3`, because the
   global install runs this code and the nudge is live.
2. **A release script with a test.** `scripts/release.mjs <version>`
   bumps `package.json` and both lockfile fields, turns the CHANGELOG's
   Unreleased section into a dated heading, rewrites the README's "This
   build" section (version, tarball name, `--version` output), refuses on a
   dirty tree or a missing Unreleased section, and prints the commit, tag,
   push and pack commands for the operator's stage to run. It writes the
   fork marker of item 1.
3. **Gate tooling.** `npm run test:fork` runs the fork's added test files
   (by `git diff --name-status <merge-base> -- test`, so a merge cannot
   stale the list) in about 2.5 minutes for the inner loop; the full gate
   still ends every stage (D27). `scripts/run-tests.mjs` stops putting
   every path on one command line: on Node 22 and later it passes the glob
   to `--test` directly, otherwise it spawns in chunks and merges the
   counts, with a test that proves a 600-file list runs. Upstream CI on Node
   20 keeps working.
4. **Documentation hygiene** (D25). Move `docs/upstream/` and the astra
   assessment under `docs/archive/` with a one-paragraph note that the plan
   closed on 2026-10-26; keep the advisory where it is and fill its
   reporter and status lines once the operator sends it (the bug is live in
   0.26.0 and the fix is theirs to take or leave).
5. **Merge upstream 0.26.0 or a later release, when the operator names
   one** (D18, D26). Four conflicting files, all known seams. The stage
   also regenerates the D13 baseline from plain upstream at the merged
   commit (one extra gate) and reinstalls the global install from the
   tarball, because `sync-global` refuses across base releases.
6. **Retrieval, second round.** A blind question set written by a session
   that builds the lexical graph in a scratch folder and never opens
   `.trail/cache/`; the three questions that fail on both graphs diagnosed
   (test files outranking `isTestPath`, an older handoff outranking the
   protocol, a script with no symbol node) with any ranking change measured
   by the harness before and after; and D11 settled with one deep pass per
   reasoning level, each measured, each quoted by its `tokens:` line.
7. **Adversarial acceptance of items 1 to 6** one tier above their authors,
   and a judgement on whether the next assessment is due.

Not proposed: embeddings (the harness has not yet shown the lexical rank
to be the limit; the deep pass moved hit@3 from 4 to 9 of 20 without
them); adopting the `trail` command or layout for the global install (D9
A still holds; upstream publishes `@nanonets/graft` at every release);
fixing or skipping upstream's wall-clock tests (D13 keeps the fork's hands
off them); moving the nvm4w root to D: (a machine change the operator
closed; the numbers are in section 3 for when it is next weighed);
splitting `cli.ts` or `extract.ts` (merge debt with no behaviour change).

## 6. Staged roadmap by model class

Prices are the protocol's section 2 table (USD per million tokens, cache
read: Haiku 0.01, Sonnet 0.10, Opus 0.20, Fable 0.25). The method is the
protocol's section 6: cache reads at turns times average context, fresh
input at 1.25 times the input rate (3k per turn), output at the output rate
(1.5k per turn, 2k for Fable). Time is agent wall clock; a full gate is 27
to 41 minutes here and the fork-only run about 2.5 minutes; operator review
is extra. Stage numbers continue from 26.

| Stage | Model, effort | Scope (section 5 item) | Depends on | Turns, context | Cost (central, quoted range) | Agent time |
|---|---|---|---|---|---|---|
| 26 | Fable 5.1, high | This assessment | none | done | see the Stage 26 handoff | 2 h plus one gate |
| 27 | Sonnet 5.5, high | Item 1: fork marker, `upgrade` refuses, informational nudge, tests, release `0.25.0-nishadherath.3`, tarball, sync | D24 | 50 turns, 80k | $1.53 ($1.50 to $3) | 45 to 90 min plus one gate; 15 min review |
| 28 | Sonnet 5.5, medium | Items 2 and 3: release script, `test:fork`, the test runner off the command-line limit, tests for each | 27 (the marker the script writes) | 50 turns, 70k | $1.48 ($1.50 to $3) | 45 to 90 min plus one gate; 15 min review |
| 29 | Haiku 5.5, medium | Item 4: archive the closed texts with a note, README fixed by hand once if 28 has not run | D25 | 25 turns, 40k | $0.04 ($0.05 to $0.20) | 15 to 30 min; 10 min review, plus the operator's own sending of the advisory |
| 30 | Opus 5.5, high | Item 5: merge the release the operator names, four conflicts, new D13 baseline, tarball reinstall, sync | D26 and the operator naming a release | 60 turns, 100k | $3.90 ($4 to $8) | 60 to 120 min plus three gates; 30 min review |
| 31 | Opus 5.5, high | Item 6: blind question set, the three ranking cases, D11 by one deep pass per level | 28 (for the quick loop); independent of 30 | 60 turns, 90k | $3.78 ($4 to $8), plus the provider's charge for three deep passes of about 6.1M input and 1.3M output tokens each | 60 to 120 min plus one gate and the passes' own time; 30 min review |
| 32 | Fable 5.1, high | Item 7: acceptance of 27 to 31 one tier up; whether a new assessment is due | 27 to 31 | 55 turns, 100k | $8.94 ($8 to $16) | 60 to 120 min plus one gate; 30 min review |

Totals: about $20 (quote $20 to $40) at list price, excluding the deep
passes; 4.75 to 9.5 hours of agent time plus 7 to 8 gates (3.2 to 5.5
hours), so 8 to 15 hours of wall clock; about two hours of operator review
and decisions. Stage 27 first and alone, since it changes the code the
global install runs and ends in a release. Stages 28 and 29 may run at
once after it (they touch `scripts/`, `README.md` and `docs/` only), with
their gates one after the other under the lock. Stage 30 waits for the
operator; 31 can run beside it in its own worktree if their gates queue;
32 last.

By class: Haiku takes the archive move with the harness as the oracle
(29); Sonnet takes the scoped code and script work with a stated test
(27, 28); Opus takes the cross-module merge and the evaluation design (30,
31); Fable takes acceptance one tier above the authors (32). Nothing in
this roadmap needs Fable to write code.

## 7. Decisions for the operator

```
D24 Decision:      what `graft upgrade` and the update nudge do on an own build
    Facts:         upstream 0.26.0 is on npm since 2026-10-26; compareVersions
                   strips the prerelease, so 0.26.0 > 0.25.0-nishadherath.2;
                   the nudge prints on every command and in every wired
                   repository's session-start hook once the cached check
                   succeeds (today: latest null, failed check 2026-10-26);
                   `graft upgrade` runs npm install -g of both upstream packages
                   and then `trail init` in the repository.
    Options:       A a fork marker in package.json, written by the release
                     script: `upgrade` refuses and names the fork's route; the
                     nudge says upstream's version with no command
                   B silence both on a fork build; nothing is printed
                   C leave as is; rely on sessions not following the line
    Pros and cons: A keeps the fact visible (the operator still learns that
                     0.26.0 exists) and makes the destructive path refuse; two
                     small functions and their tests. B is simpler and hides
                     the one fact the merge rule needs. C costs nothing until an
                     agent runs the command it was told to run, after which the
                     global install is upstream's and the repository is trail's.
    Blast radius:  A and B: `src/upkeep.ts`, `src/cli-meta.ts`, `src/cli.ts`,
                   one release; C: the global install and every wired repository.
    Recommended:   A.
    Answered:      A, by the operator on 2026-10-27.

D25 Decision:      the closed-plan texts and the unsent advisory
    Facts:         docs/upstream/ holds five pull-request texts and a design
                   issue for a plan closed on 2026-10-26; docs/graft-assessment-
                   6.0-astra.md describes a stock 0.21.1; the advisory's bug is
                   live in upstream 0.26.0 and D10 A (send it) was decided on
                   2026-10-18 with the reporter and status lines still blank.
    Options:       A move the texts under docs/archive/ with a one-paragraph
                     note; the operator fills the two lines and sends the
                     advisory through the channel upstream's SECURITY.md names,
                     and a Haiku stage records the date
                   B delete the texts; drop the advisory
                   C leave everything where it is
    Pros and cons: A keeps the record, removes the contradiction with AGENTS.md
                     and carries out D10; the sending is the operator's action.
                   B is cleaner and loses texts that cost real stages to write.
                   C leaves a cold session two documents that disagree.
    Blast radius:  docs only; the advisory's sending is outward-facing.
    Recommended:   A.
    Answered:      A, by the operator on 2026-10-27.

D26 Decision:      whether to merge upstream 0.26.0 now
    Facts:         9 commits, 109 files, 3,315 insertions; four conflicting
                   files (CHANGELOG, package.json, lockfile, src/cli.ts); no
                   dependency change; the features are trail init --pair, the
                   workspace connector and --always-follow learnings; a merge
                   also needs a new D13 baseline (one more 27-to-41-minute run)
                   and a tarball reinstall of the global install.
    Options:       A wait; re-check at the next upstream release
                   B merge now as Stage 30
    Pros and cons: A costs nothing today; the gap grows by one release and the
                     conflicts stay at the same four seams. B spends about $4
                     and three gates for features the graft brand does not use.
    Blast radius:  B: src/cli.ts and the global install; A: none.
    Recommended:   A, with D18 unchanged.
    Answered:      A, by the operator on 2026-10-27.

D27 Decision:      what the fork-only quick run may stand in for
    Facts:         the fork's 34 test files run 248 tests in 143 s; the full
                   gate is 4,261 tests in 27 to 41 min and is read through the
                   D13 baseline.
    Options:       A inner loop only; every stage still ends with the full gate
                   B the quick run plus the test files of every touched module
                     suffice for a stage that changes no file under src/
                   C no quick run; the full gate always
    Pros and cons: A saves the mid-stage gates and keeps D13's evidence at the
                     end. B saves one full gate on docs and scripts stages at the
                     cost of a rule that has to be judged. C is the state today.
    Blast radius:  A and B: scripts/ and the protocol's gate paragraph.
    Recommended:   A.
    Answered:      A, by the operator on 2026-10-27.
```

## 8. Verified facts (this session, 2026-10-27)

- `get_session self`: model `claude-fable-5-1`, effort `high`.
- `git fetch upstream`; `git log -1 upstream/main`: `d878681 2026-10-26
  chore(release): 0.26.0 (#694)`; `git rev-list --count main..upstream/main`
  9; `git rev-list --count 4e7d0f5..main` 134; `git diff --stat
  main...upstream/main | tail -1` 109 files, 3,315 insertions, 809 deletions;
  `git diff --shortstat 4e7d0f5 main` 216 files, 24,973 insertions, 482
  deletions; `git diff main upstream/main -- package.json` shows only the
  fork's own lines (`tree-sitter-wasm-v1`, `optionalDependencies`) as
  differences.
- `git merge-tree --write-tree --name-only main upstream/main` exit 1,
  naming `CHANGELOG.md`, `package-lock.json`, `package.json`, `src/cli.ts`.
- `npm view @nanonets/graft version` 0.26.0 (modified 2026-10-26T11:36Z);
  `npm view @trailhq/trail-code version` 0.26.0. GitHub API
  `repos/trailhq/Trail-Code`: 10,785 stars, 250 open issues, pushed
  2026-10-26T11:28Z; search `is:pr is:open` 115.
- `node -e "import('./dist/upkeep.js')..."`: `formatUpdateNudge(
  '0.25.0-nishadherath.2', '0.26.0')` returns the nudge line;
  `compareVersions('0.26.0', '0.25.0-nishadherath.2')` is 1.
  `~/.graft/update-check.json` holds `latest: null`, `checkedAt`
  1792987766099 (2026-10-26T04:09:26Z); `UPDATE_TTL_MS` is 24 hours.
  `src/cli-meta.ts:164` spawns `npm install -g <pkg>@latest` plus
  `@trailhq/trail-code@latest`; `src/cli.ts:470` then calls
  `moveHereToTrail`, which spawns `trail init`.
- `git show upstream/main:src/hosts/mcp-config.ts | grep -n spawnSync`:
  line 57, `spawnSync('graft', ['--version'], ...)`, unchanged.
- Fixture smoke in the session scratchpad (`smoke/`, five files: a TS
  module, `config/app.json` with a `server.port` and an `apiKey`, `ci.yml`,
  `README.md` with two headings, `package.json`): `graft build .` 21 nodes
  (11 key, 5 file, 3 section, 2 function), 19 edges, 5 cards, languages
  json, markdown, typescript, yaml, `lsp: no language server on PATH`,
  5,336 ms wall; `graft ask "where is the server port read" --no-refresh
  --source -n 3` ranked `server.port` (`config/app.json:L3-L3`), `loadPort`
  (`src/app.ts:L3-L6`), `server` (`L2-L5`), 4,408 ms; `grep -rl
  sk-not-a-real graft/` 0 files; `graft check .` exit 0; `graft status`
  `code map ✓ 21 nodes · in sync with the code`; `graft version`
  `0.25.0-nishadherath.2`, `latest: unreachable (offline?)`.
- Startup, bash wall clock from the scratchpad, three rounds: `node -e 0`
  633, 500, 513 ms; `graft.cmd --version` 3,931, 4,189, 4,026 ms;
  `node D:\...\fork_graft\dist\cli.js --version` 1,875, 1,893, 2,012 ms.
- `src/claude/hook-io.ts:15` `CHILD_TIMEOUT_MS = 8000`;
  `src/claude/settings-merge.ts` hook timeouts: prompt 15 s, session start
  10 s, stop 10 s, post-edit 10 s, tool savings 8 s.
- Tree: `find src -name '*.ts' | xargs cat | wc -l` 82,820; `test/*.test.ts`
  495 files, 86,906 lines, 4,073 lines matching `^\s*test(`; fork-added
  test files (`git diff --name-status 4e7d0f5 main -- test | grep ^A`) 37,
  of which 34 are `*.test.ts`, 242 `test(` lines by grep; `wc -l` on
  `src/cli.ts` 2,719, `src/graph/extract.ts` 2,588, `src/ask/ask.ts` 1,605.
- Command line: the 495 absolute test paths quoted and joined measure
  28,894 characters, 3,873 under 32,767, 58 per file; upstream 0.26.0 adds
  11 test files (`git diff --name-status main...upstream/main -- test |
  grep ^A | wc -l`).
- `node --import tsx --test <34 fork test files>` with no other gate
  running: tests 248, pass 248, fail 0, duration 143,154 ms, exit 0.
- This repository's graph (`.trail/cache/.graph/wiring.json`, 12,946,164
  bytes, 2026-10-26 20:03): 9,779 nodes, 31,013 edges, 9,048 with a
  summary, 4,269 with a crux; kinds file 1,016, key 524, section 754,
  task 2, function 5,923, method 232, element 47, selector 388, class 44,
  interface 646, type 203; `.graft/config.json` `{"structured": true}`;
  `manifest.json` `deepUsage` 34 calls, 106,752 input, 108,544 cached,
  94,524 output, `openai:deepseek-flash`, reasoning none (the last rerun;
  the full pass's line is in `.eval/retrieval-2026-10-26.md`).
- `.trail/learnings/`: six files, all `author: Anirudhkumar-nanonets`.
- `README.md` lines 80, 104, 121 to 123 say `0.25.0-nishadherath`;
  `package.json` says `0.25.0-nishadherath.2`.
- `ls D:\Code\Claude\fork_graft_releases`: five tarballs, the newest
  `nanonets-graft-0.25.0-nishadherath.2.tgz` 4,407,260 bytes (2026-10-26).
- `git status --short` at session start: clean; `git rev-parse HEAD
  origin/main` both `82a9713`; `git branch -a` `main` only; `git remote -v`
  `origin` `github.com/nishadherath/fork_Graft.git`, `upstream` the old
  `NanoNets/context-graph-engine.git` URL.
- The gate run by this session is quoted in the Stage 26 handoff.
