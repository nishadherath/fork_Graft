---
stage: "Stage 27: fork-aware upgrade and update nudge (D24), release 0.25.0-nishadherath.3"
model: claude-sonnet-5-5
effort: high
status: ready
created: 2026-10-27
from: "Stage 26 session (Fable 5.1, local_4edbf0b9), roadmap item 1 of docs/assessment-2026-10-27.md"
---

# Stage 27: fork-aware upgrade and update nudge

## Goal

On a fork build, `graft upgrade` refuses and names the fork's own install route, and the update
nudge names upstream's version without telling anyone to run a command. An unmarked build
behaves exactly as upstream. Each change has a test that failed first. The gate is green under
D13, the release `0.25.0-nishadherath.3` is tagged and pushed to `origin`, its tarball is in
`D:\Code\Claude\fork_graft_releases\`, the global install runs it, and this handoff is at
status `done` with the counts.

## Decisions already made (do not reopen)

- D24, operator's answer recorded in the Result section below (recommended A: a fork marker,
  refusal, informational nudge). Start no code before the answer is recorded here.
- D23 A: a stage whose code the global install runs ends in a release; the release convention
  is `chore(release): version <v>` with both `package-lock.json` version fields, a dated
  CHANGELOG heading and an annotated tag `v<v>`; pushes go to `origin` only.
- D13 A: the gate is judged by name against `docs/baselines/upstream-4e7d0f5-failures.txt`;
  a non-baseline failure's file is rerun alone before it is called a fault.
- D21: `npm test` takes its own lock; no process-list poll.
- No vendor fact in source (AGENTS.md rule 6): the marker is a field in `package.json`, not a
  string compared against a package or vendor name; the install route it names is a command in
  this repository, never a machine path.
- Never run a `graft` command inside this checkout; smoke tests go in the session scratchpad.

## Files and links that matter (spans at `main` `4143785`)

- `src/upkeep.ts`: `UPDATE_TTL_MS` L54; `compareVersions` and `isNewer` L63 to L79 (strips the
  prerelease, so 0.26.0 ranks above 0.25.0-nishadherath.2); `formatUpdateNudge` L155 to L159;
  `readUpdateCache`, `maybeRefreshInBackground` L81 to L145.
- `src/cli-meta.ts`: `runUpgrade` spawns `npm install -g <pkg>@latest @trailhq/trail-code@latest`
  at L164; `formatUpgradeReport`; `readCurrentVersion` reads the package.json beside `dist/`
  (follow the same path to read the marker).
- `src/cli.ts`: the `preAction` hook prints the nudge L332 to L344; the `upgrade` command
  L464 to L470 then calls `moveHereToTrail`, which spawns `trail init`.
- `src/upkeep-run.ts` L98: the session-start hook's nudge from the cache.
- `docs/assessment-2026-10-27.md` sections 0, 5 (item 1), 7 (D24), 8 (the facts).
- `README.md` L80, L104, L121 to L123 (the "This build" section, still says `0.25.0-nishadherath`).

## Verified facts (Stage 26, 2026-10-27)

- `formatUpdateNudge('0.25.0-nishadherath.2', '0.26.0')` from `dist/upkeep.js` returns the
  "run graft upgrade" line; `compareVersions('0.26.0', '0.25.0-nishadherath.2')` is 1.
- `~/.graft/update-check.json` holds `latest: null` (failed check 2026-10-26T04:09Z); the TTL is
  24 h, so the nudge appears at the next successful check in every wired repository.
- `npm view @nanonets/graft version` 0.26.0. Global install `0.25.0-nishadherath.2`.
- The fork's 34 test files alone: `node --import tsx --test <files>` 248 of 248 in 143 s.

## Exact next action, in order

1. Check model (`claude-sonnet-5-5`) and effort (`high`); stop on a mismatch. Read `AGENTS.md`,
   `ENGINEERING_PERSONA.sonnet.md` if present (else the checked-in edition),
   `ENGINEERING_PERSONA_LANGUAGES/node-ts-js.sonnet.md`, `docs/operator-protocol.md` sections 6,
   8 and 10, this file, and the assessment sections named above. Confirm the D24 answer is in
   the Result section; if not, stop and say so.
2. Tests first, in a new `test/fork-upgrade-guard.test.ts`, all failing before the code:
   (a) the nudge with a fork marker names upstream's version and this build's, says the merge is
   the operator's decision, and contains no `upgrade` command; (b) without a marker the line is
   unchanged from today; (c) `runUpgrade` with a marker returns a refusal naming the install
   route and spawns nothing; (d) one CLI run of `node dist/cli.js upgrade` from a scratch folder
   whose `PATH` holds only a stub `npm.cmd` and `npm` that record their arguments and exit 1,
   so a failing-first run can never touch the real install: the command exits non-zero, prints
   the refusal, and the stub was not called. Run `npm run build` before (d).
3. Code: a `fork` object in `package.json` (`upstream` package name, `install` command,
   `releases` as a folder name relative to the repository's parent or omitted); a reader in
   `cli-meta.ts` beside `readCurrentVersion`; `formatUpdateNudge` takes the marker (both call
   sites, `cli.ts` and `upkeep-run.ts`); `runUpgrade` refuses on a marker before any spawn;
   `formatUpgradeReport` prints the refusal; `upgrade` exits 1 and never reaches
   `moveHereToTrail`. `_update-check` keeps running so the cached fact stays current.
4. CHANGELOG under Unreleased: one Added or Changed entry per user-visible change.
5. Quick loop: `node --import tsx --test test/fork-upgrade-guard.test.ts test/startup-imports.test.ts
   test/cli-status-graft.test.ts` and `npx tsc --noEmit`.
6. Release: `package.json` and both `package-lock.json` version fields to
   `0.25.0-nishadherath.3`; CHANGELOG heading `## 0.25.0-nishadherath.3 (<date>)`; README
   "This build" section to `.3` (heading, anchor at L80, tarball name, `--version` lines);
   commit `chore(release): version 0.25.0-nishadherath.3`.
7. Gate: `npm run build && npm test`; D13 by name; rerun non-baseline failures alone; quote.
8. Annotated tag `v0.25.0-nishadherath.3`; `git push origin main` and the tag; confirm with
   `git ls-remote origin`. Approval for this outward step: the operator's D24 answer recorded
   below, under the standing D23 A rule. Then `npm pack --ignore-scripts --pack-destination
   D:\Code\Claude\fork_graft_releases`; `tar -tzf` lists `package/dist/bin/graft.js`;
   `node scripts/sync-global.mjs` (quote the counts); from the scratchpad, `graft --version`
   prints `.3` and `graft upgrade` prints the refusal and exits 1.
9. Update this file (status `done`, counts, commits), commit, push. End the report with the
   next stage's model, effort and kickoff prompt (Stage 28 from the assessment's section 6).

Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
Australian English, no em-dashes, none of the persona's banned words. When blocked, stop with
the five-line escalation of the persona's section 3.4.

## Cost projection

Sonnet 5.5, high, as a subagent of the Stage 26 session: see the dispatch record below,
$2.32 (quote $2 to $4).

## Time projection

45 to 90 minutes of tests and code, one gate of 27 to 41 minutes, 15 minutes of release, pack
and sync: 90 to 150 minutes. Operator review about 15 minutes plus the D24 to D27 answers.

## Session dispatch decision

Date: 2026-10-27. Decided by: claude-fable-5-1, effort high, in Claude Code (desktop app).
Price table: `pricing/2026-10-18.json` (age 9 days).

### Inputs

| Input | Value | Source |
|---|---|---|
| Window W | 1,000,000 | usage tool, measured |
| Compaction point K | 970,000 | usage tool, `autoCompactsAtPercent` 97 |
| Current context C0 | 244,794 | usage tool, measured |
| Compacted already | no | this session's history |
| Unrecorded context | none: the code sites, the smoke results and the fork-only timing are in the assessment's section 8 | checked against the assessment |
| Expected turns T | 50 (range 25 to 50) | Stage 26 roadmap row |
| Fresh input per turn F | 3,000 | default |
| Output per turn O | 1,500 | default |
| Fresh baseline B | 87,447 (session); 60,000 for a subagent, estimated | usage total minus Messages; subagent figure estimated |
| Re-read set R | this handoff 2,500; AGENTS.md 1,740; protocol 5,650; assessment sections 3,750; `upkeep.ts` 3,620; `cli-meta.ts` 1,775; persona 13,260; language file 350: 32,645 | file sizes / 4 |
| Handoff size H | 2,500 | default, nothing unrecorded to add |
| Task type | scoped module work with a stated test | matrix row 2 |
| Design-heavy | no (D24 fixes the behaviour; the field name is set above) | |
| Irreversible or outward-facing steps | tag and push to origin, global install sync | step 8 above |

### Step A: continue or hand off

```
C_end   = 244,794 + 50 * 3,000          = 394,794
crosses = C_end > K                     = false
C_cont  = 244,794 + 75,000              = 319,794
C_fresh = 87,447 + 32,645 + 75,000      = 195,092   (subagent: 60,000 + 32,645 + 75,000 = 167,645)

cost_continue (Fable prices, this session)
  = 50*319,794*0.25e-6 + 50*3,000*12.5e-6 + 50*1,500*50e-6 + 0
  = 4.00 + 1.88 + 3.75 = $9.62
cost_fresh (Sonnet prices, fresh session)
  = 2,500*50e-6 + 120,092*2.5e-6 + 50*195,092*0.1e-6 + 50*3,000*2.5e-6 + 50*1,500*10e-6 + 0
  = 0.13 + 0.30 + 0.98 + 0.38 + 0.75 = $2.53
cost_fresh (Sonnet subagent)
  = 0.13 + 92,645*2.5e-6 + 50*167,645*0.1e-6 + 0.38 + 0.75
  = 0.13 + 0.23 + 0.84 + 0.38 + 0.75 = $2.32
```

Prices used (per million): Fable 10 / 50 / 0.25 / 12.50; Sonnet 2 / 10 / 0.10 / 2.50 (input,
output, cache read, cache write).

Draft verdict: fresh, by cost, margin $7.09 (280 percent of the smaller); and by rule, since
guardrail 8 forbids this Fable session doing Sonnet-class work.

### Step B: model, effort and concurrency

| Piece | Class | Model id | Effort | Oracle | Serial or parallel | Cost |
|---|---|---|---|---|---|---|
| Stage 27 whole (tests, code, release) | sonnet | claude-sonnet-5-5 | high | `test/fork-upgrade-guard.test.ts` fails first then passes; gate by name under D13; `graft upgrade` refuses from the scratchpad | serial (one writer, one gate) | $2.32 |

Serial chain and its wall clock: tests and code 45 to 90 min, gate 27 to 41 min, release 15 min:
90 to 150 min. Operator review time: 15 min plus the decision answers.

Effort raised because: the stage contains an outward-facing step (tag, push, release).

### Guardrails checked

1. Under 10 turns: no, T = 25 to 50.
2. Design-heavy across a compaction: not design-heavy; crosses false.
3. Irreversible steps: tag and push, named in step 8 with the approval step (the operator's D24
   answer under D23 A).
4. Model from the table: claude-sonnet-5-5, class sonnet.
5. Table age 9 days, under 14; no null used.
6. Acceptance one class above the author: Stage 32 (Fable) per the roadmap.
7. Decision budget: within (about 7,000 tokens read, 2,500 written, 7 min).
8. Class and effort match the harness: the subagent is started with model sonnet, effort high;
   it checks both against this front matter first.

### Adversarial pass

The opposite verdict, argued: this session already holds every fact about the two functions
and their four call sites, the change is about sixty lines, and 50 turns overstates it; at 25
turns the Fable session would finish in under an hour with no handoff to write or read, and no
risk that a Sonnet reading cold misses the `upkeep-run.ts` call site.

Each input, the way it could be wrong:

- C0: measured; a 30 percent error moves cost_continue by about $1.20 either way.
- T: if 25, both sides halve roughly; if 100, both double.
- F and O: the release steps produce long tool output; F may be 5,000.
- B and R: the Sonnet persona edition may be smaller than the Fable one; R overstated if so.
- Task type: the marker's shape is a small interface choice, settled in step 3 above.
- Prices: table 9 days old; no long-context tier for these models.
- Unrecorded context: none found; if the Sonnet misses a call site, the oracle (d) catches it.

Recomputed with the adverse value that moves the result most (T = 25):

```
cost_continue = 25*282,294*0.25e-6 + 25*3,000*12.5e-6 + 25*1,500*50e-6 = 1.76 + 0.94 + 1.88 = $4.58
cost_fresh    = 0.13 + 0.23 + 25*148,895*0.1e-6 + 0.19 + 0.38           = 0.13 + 0.23 + 0.37 + 0.19 + 0.38 = $1.30
```

Verdict holds: yes (margin 252 percent).

### Final verdict

fresh, model claude-sonnet-5-5, effort high, pieces 1 (serial), run as a subagent of the Stage
26 session with this file as the brief, after the operator answers D24 to D27 in that session.
Exact next action: record the answers in the Result section below, commit, then start the
subagent.

### Cost of deciding

| Row | Value | Source |
|---|---|---|
| Context at start | 244,794 | usage tool |
| Context at end | about 254,000 | estimated from the text written |
| Input tokens read | about 7,000 (skill text, price table, template, file sizes) | estimated, characters / 4 |
| Output tokens | about 2,500 (this record) | estimated, characters / 4 |
| Wall clock | about 7 minutes | session clock |
| Priced | 7,000 x 12.50e-6 + 2,500 x 50e-6 = $0.21 at Fable rates | table `pricing/2026-10-18.json` |

## Result

(The operator's answers to D24 to D27, then the stage's commits and counts.)
