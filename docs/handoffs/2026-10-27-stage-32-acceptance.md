---
stage: "Stage 32: adversarial acceptance of Stages 27 to 31 (roadmap items 1 to 6), and whether a new assessment is due"
model: claude-fable-5-1
effort: high (confirmed by get_session self)
status: done
created: 2026-10-27
from: "Stage 23 session (local_60e06b5a), roadmap item 7 of docs/assessment-2026-10-27.md"
---

# Stage 32: acceptance of Stages 27 to 31

## Goal

Each of Stages 27 to 31 checked one tier above its author on a scratch install, a scratch clone and
the Stage 31 clones, findings by severity with the command that shows each, fixes only with a test
that failed first, the gate judged under D13, and a judgement on whether a new assessment is due.

## Decisions made

- Four findings fixed here, each low, each with a test that failed first (commits below). Nothing
  above low was found; Stages 27 to 31 are accepted.
- A new assessment is not due. Items 1 to 6 are done or deliberately deferred (item 5 waits on the
  operator naming a release, D26 A); the trail-parity assessment of the same day already extends the
  roadmap (Stages 33 to 37) and holds the open decisions. Due again after Stage 37, or when the
  operator names an upstream release for Stage 30 (new base, new D13 baseline), whichever is first.
  Stage 37 (acceptance of 33 to 36) is not folded in: Stage 33 was still working when this ran.

## Findings, by severity (none high or medium)

1. Low, fixed `e5ecef1`: `graft stats` counted a backgrounded graft command's read twice when the
   output came back through the harness's output tool, and `graft --dir <map> ask` owed no footer,
   so its saving was lost. Shown by `node --import tsx --test test/stats-background-saving.test.ts`
   at `0be2821^` (cases e and f fail).
2. Low, fixed `418b047`: `scripts/release.mjs` dated the heading in UTC. Shown by
   `node -e "const d=new Date('2026-10-28T09:00:00+11:00');console.log(d.toISOString().slice(0,10))"`
   (prints 2026-10-27).
3. Low, fixed `353c4c0`: the registry check never succeeded on Windows: `npm` spawned without a
   shell is ENOENT for `npm.cmd`, and `npm view` takes 11 s here against a 2 s budget. Shown by
   `node -e "import('./dist/cli-meta.js').then(m=>console.log(JSON.stringify(m.getNpmViewVersion('@nanonets/graft'))))"`
   (`{"ok":false}` while `npm view @nanonets/graft version` prints 0.26.0), and by
   `~/.graft/update-check.json` holding `latest: null` after a check at 20:29 today. Consequence:
   the D24 nudge had never printed on this machine; after the next `_update-check` it will, in
   every wired repository, as the fork's informational line. `graft version` keeps the 2 s budget
   and still says unreachable here (open question below).
4. Low, fixed `0be2821`: `docs/archive/README.md` did not name the decisions companion moved in
   `18fac1c`.
5. Low, recorded: two blind questions carry two of their symbol's three words (`lockHeld`,
   `removeTomlSection`); lexical hit@3 2 of 20 shows no inflation. `test-runner-windows`'s recorded
   answer is stale since Stage 28 (Stage 31 noted it). `npm run test:fork` needs the `upstream`
   remote and fails with git's own message without it. The Stage 28 handoff's effort line says it
   could not verify its effort, though `get_session self` reports it (Stages 29 and 31 used it).

## Verified facts (2026-10-27, commands as run)

- Stage 27, scratch install of `nanonets-graft-0.25.0-nishadherath.4.tgz` under a scratch prefix
  (`npm install -g --prefix <scratch>/g --ignore-scripts`, 45 packages, 32 min): `--version` and the
  `graft.cmd` shim print `.4`; `upgrade` with a stub npm first on PATH prints the refusal naming
  `node scripts/sync-global.mjs` and `fork_graft_releases`, exits 1, stub never called; `status` with
  a seeded `~/.graft/update-check.json` at 0.26.0 prints the fork line ("Merging it is the operator's
  decision. No action needed.") and no `upgrade`; the installed package.json carries the marker.
- Stage 28, scratch clone at `ae5cefd`: `node scripts/release.mjs 0.25.0-nishadherath.99` changed
  the four files only (package.json 1 field, lockfile 2, CHANGELOG dated heading under an empty
  Unreleased, README heading, anchor, tarball and `--version` lines), exit 0; `v1.2.3`, the current
  version, a stray file and an empty Unreleased each refused with nothing written, exit 1.
  `npm run test:fork` there (52 files, `upstream/main` set to `4e7d0f5`, `node_modules` a junction
  to this checkout's): 434 tests, 424 pass, 7 fail, 3 skipped, 633 s of tests after a 39 min wait
  for the gate lock, exit 1. The 7 are wall-clock bars run beside the harness and the end of
  Stage 33's gate: five in `test/mcp-server.test.ts` (15 to 31 s), `startup-imports` (`--version`
  took 120 s) and `trail-connect-cli` (152 s). Rerun alone after the gate: `mcp-server` 5 of 5,
  `startup-imports` 2 pass 1 skipped, `trail-connect-cli` 5 of 6 with the one failure a baseline
  name ("init --connect claims the code…"). Green under D13. The roadmap's 2.5 min for the quick
  run is 10.5 min here under load.
- Stage 29: `git grep` for the old paths outside `docs/archive` hits only the two deliberate lines
  in the assessment and the Stage 29 handoff; `git log --follow` on a moved file reaches `31b8af1`.
- Stage 31: the blind set resolves with no problems on every graph; the blind clone lacks `.eval`,
  `docs/handoffs`, `docs/archive` and the assessments. Harness reruns on the four clones at
  `1d93158` with the CLI at `ccb5e65` (frozen copy), hit@3 / file@3 of 20: Stage 22 set lexical
  4 / 14, none 7 / 15, default 8 / 16, high 9 / 16; blind set lexical 2 / 12, none 3 / 13,
  default 3 / 13, high 3 / 12. Every number, hit@1 included, equals the Stage 31 record. Runs took
  194 to 584 s each under load (the record says about 75 s). The three deep-pass `tokens:` lines in the
  saved runs match the record. `wantsTests`: `test/ask-test-intent.test.ts` 2 of 2.
- Gate, `npm run build && npm test`, Node 26.7.0, on `353c4c0` (Stage 33's `ae5cefd` included;
  only this handoff untracked), 23:14 to 23:46: 4,323 tests, 4,200 pass, 34 fail, 89 skipped,
  1,827 s, exit 1. By name against `docs/baselines/upstream-4e7d0f5-failures.txt`: 33 in the
  baseline, 1 not (`test/skills-session-start.test.ts`, J13 compact). That file rerun alone
  (`node --import tsx --test`): 10 of 11, J13 passes, the one failure a baseline name ("compact:
  the cut block's failed ready probes…"). Green under D13.

## Work completed

- `e5ecef1`, `418b047`, `0be2821`, `353c4c0` (fixes and tests above, CHANGELOG under Unreleased),
  this handoff. `main` not pushed (the brief said not to).

## Open questions

- `graft version` is useless on this machine (2 s budget, 11 s npm); serving it from the cache is a
  design change for a later stage, or an upstream issue. Operator.
- The fixes change code the global install runs; D23 A wants a release. Stage 33 is cutting
  `0.25.0-nishadherath.5` from `main`'s tip; if it cuts after this gate, these commits ride in it,
  otherwise a `.6` follows. Stage 33 was told (message, 2026-10-27).
- The blind-set span misses (file found, span not) remain the next ranking question (Stage 31).

## Exact next action

Stage 34 (Haiku 5.5, medium) once the Stage 33 handoff is at status done; kickoff prompt in the
stage report. Stage 30 still waits on the operator naming an upstream release.

## Cost projection

This session, Fable 5.1 at high, from the usage tool (317k context at 85 percent of the way
through; average about 200k) and about 85 turns: cache reads 85 x 200k = 17.0M x $0.25 = $4.25;
fresh input 85 x 3k = 255k x $12.50 = $3.19; output 85 x 2k = 170k x $50 = $8.50. About $15.90,
at the top of the roadmap's quoted $8 to $16 (central $8.94): 85 turns against the planned 55,
because four fixes were made rather than none. No provider spend: the harness ran no model.

## Time projection

22:01 to about 00:20 local, 2 h 20 min, of which the gate 45 min, the scratch install 32 min and
the eight harness runs 48 min, all in the background. Operator review about 30 minutes: the
findings list, the D13 judgement, and the open question on `graft version`.
