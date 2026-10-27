---
stage: "Stage 33: the trail command from the one package (D28 A)"
model: claude-sonnet-5-5
effort: high
status: done
created: 2026-10-27
from: "docs/assessment-2026-10-27-trail-parity.md section 5, Stage 33; D28 A and D30 A answered by the operator on 2026-10-27"
---

# Stage 33: the trail command from the one package

## Goal

`package.json` `bin` lists `trail` beside `graft`; `sync-global` reports a missing `trail` shim and
prints the tarball reinstall; the trail twins of the `status` and upgrade-refusal tests exist;
release `0.25.0-nishadherath.5` is committed, tagged and packed. Nothing pushed, global install untouched.

## Decisions already made

- D28 A (one package, two bins), D30 A (parity now, no 0.26.0 merge), D31 A (keep the graft layout
  test, add trail twins), D29 B (repositories move deliberately, switch first). Not reopened.
- `sync-global` cannot create shims (npm links them at install), so it only reports; the report
  never fails the sync and is skipped when the fork's `package.json` declares no `trail` bin.
- The shim folder is `npm prefix -g` on Windows and `<prefix>/bin` elsewhere; on Windows the
  working shim is `trail.cmd` (the extensionless file is for Git Bash only).

## Files that matter

- `package.json` (`bin`), `scripts/sync-global-checks.mjs` (`globalShimDir`, `checkGlobalInstall`
  with `shimDir` and `platform`, result field `trailPresent`), `scripts/sync-global.mjs`.
- New: `test/package-bin.test.ts`, `test/cli-status-trail.test.ts`. Extended:
  `test/sync-global-checks.test.ts` (temporary prefix, both platforms),
  `test/fork-upgrade-guard.test.ts` (case `(d, trail)`, shared `runBuiltUpgrade` helper).
- `CHANGELOG.md` Unreleased (two Added entries, now under 0.25.0-nishadherath.5), `README.md` "This build".
- Tarball `D:\Code\Claude\fork_graft_releases\nanonets-graft-0.25.0-nishadherath.5.tgz` (4,417,095 bytes;
  `dist/bin/trail.js` and the two-entry `bin` checked with `tar`).

## Verified facts

- Fail first: `package-bin` (bin had `graft` only) and `sync-global-checks` (no `globalShimDir` export)
  failed before the change; both pass after. The `cli-status-trail` tests and the `(d, trail)` case
  pass on the unchanged code, as the analysis (section 3.1) said they would: they pin behaviour, not new code.
- Gate `npm run build && npm test`, Node 26.7.0, started on `ae5cefd`: 4,320 tests, 4,159 pass, 72 fail,
  89 skipped, 3,161.5 s, exit 1. The shared tree gained Stage 32's four fix commits while it ran, so
  the run is not of one commit; Stage 32's own gate on `353c4c0` (which contains `ae5cefd`) is the clean one.
- D13 by name against `docs/baselines/upstream-4e7d0f5-failures.txt`: 38 of the 72 failing names are
  baseline; 34 are not. Rerun alone in 25 files (`--test-concurrency=1`, 1,352 s): 160 tests, 147 pass,
  7 fail, 6 skipped; every one of the 7 is a baseline name except "the prompt hook ends inside its total
  budget" (`claude-hook-timeouts`), which passes 8 of 8 alone. Green under D13.
- After the release bump (`ec37e8d`), `npm run build` exit 0 and the 68 files that mention README,
  CHANGELOG or package.json, plus my four: 852 tests, 819 pass, 17 fail, 16 skipped; all 17 are baseline names.
- `dist/bin/trail.js --version` and `dist/bin/graft.js --version` from a scratch folder both print
  `0.25.0-nishadherath.5` (this checkout's dist, cwd under `$TEMP`).

## Work completed

- `ae5cefd` feat(bin); `ec37e8d` chore(release); tag `v0.25.0-nishadherath.5` on `ec37e8d`; the
  tarball above. No push; `sync-global` not run; the global install is unchanged.

## Unresolved questions

- None. Operator: push `main` and the tag when satisfied.

## Exact next action

Operator steps, in this order (PowerShell; the switch first, so no repository moves before its stage):

```powershell
[Environment]::SetEnvironmentVariable("GRAFT_NO_TRAIL_SWITCH", "1", "User")   # then restart Claude Code and any open terminal
$g = "$(npm root -g)\@nanonets\graft"; $b = "$env:TEMP\graft-backup-0.25.0-nishadherath.4"
New-Item -ItemType Directory $b -Force | Out-Null; Copy-Item $g "$b\graft" -Recurse; Copy-Item "$(npm prefix -g)\graft*" $b
npm install -g "D:\Code\Claude\fork_graft_releases\nanonets-graft-0.25.0-nishadherath.5.tgz" --ignore-scripts
Copy-Item "$b\graft\node_modules\tree-sitter-kotlin\build" "$g\node_modules\tree-sitter-kotlin\build" -Recurse -Force
graft --version; trail --version      # both 0.25.0-nishadherath.5
```

Then check in a scratch folder, never in a wired repository:

```powershell
$s = New-Item -ItemType Directory "$env:TEMP\trail-smoke-$(Get-Random)"; Set-Location $s
git init -q; "export function add(a, b) { return a + b }" | Set-Content a.js
trail build; trail ask "where is add defined" --source
```

Expect `[trail] tokens saved` and the map under `.trail/cache/`. `node scripts/sync-global.mjs --dry-run`
from the fork should then print `sync-global: trail command present`. If `trail` is missing after
the install, the sync prints the same reinstall line. Stage 34 (documentation in the chosen name) needs
none of this and can start now.

Next stage: **Stage 34, Haiku 5.5 (`claude-haiku-5-5`), effort medium.** Kickoff prompt:

```
You are the Stage 34 session for D:\Code\Claude\fork_graft. Check you are claude-haiku-5-5 at effort
medium; stop on a mismatch. Read AGENTS.md, ENGINEERING_PERSONA.md, docs/operator-protocol.md and
docs/handoffs/2026-10-27-stage-33-trail-bin.md. Task, from section 5 row 34 of
docs/assessment-2026-10-27-trail-parity.md (mapping in its section 2.1): spell the commands in the
chosen name, trail, in GRAFT_init.md (call out the two renamed commands: graft check is trail build
--check, graft stats is trail status), the "Code navigation" section of AGENTS.md, the smoke-test
warning in section 10 of docs/operator-protocol.md (a trail command rewrites wiring on a version
mismatch exactly as a graft one does; keep the rule "never run one in a wired checkout"), and the
command table in docs/architecture/system-reference.md (add a trail column or note). Touch no file in
src/ or test/, so no gate runs; Australian English, no em-dashes. Leave dated records (assessments,
handoffs, memories) as written. Commit with Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>,
do not push, write docs/handoffs/2026-10-27-stage-34-docs-in-trail.md, and end with Stage 35's model
(Opus 5.5, high) and its exact kickoff prompt. Never run graft or trail in this checkout.
```

## Cost projection

Sonnet 5.5, list price (protocol section 2). Assumed 50 turns, average context 80k, fresh input 3k and
output 1.5k per turn (the roadmap's figures; not measured from the usage tool). Cache reads 50 x 80k =
4.0M x $0.10 = $0.40; fresh input 50 x 3k = 150k x $2.50 = $0.38; output 50 x 1.5k = 75k x $10 = $0.75;
total $1.53, the roadmap's number. Stage 34 (Haiku, 25 turns, 40k): about $0.04. Stage 35 (Opus, 60
turns, 100k): about $3.90.

## Time projection

Stage 33: gate 52.7 min, D13 rerun 22.5 min, post-release checks about 10 min, about 45 min of editing
and waiting on Stage 32's lock. Operator: 15 min review plus 15 min of steps. Stage 34: 15 to 30 min
agent time, 10 min review, no gate.
