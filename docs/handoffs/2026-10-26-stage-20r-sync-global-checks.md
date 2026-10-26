---
stage: "Stage 20r: sync-global checks on the global install"
model: claude-haiku-5-5
effort: medium
status: done
created: 2026-10-26
from: "Session on main at 0b2dbe5 (Haiku 5.5). Roadmap Stage 20 renamed 20r because 'Stage 20' names the 0.25.0 merge."
---

# Stage 20r: sync-global checks on the global install

Roadmap Stage 20 in `docs/assessment-2026-10-18.md` section 6 (scope section 5 item 7).

## Goal

After `scripts/sync-global.mjs` copies `dist/`, it checks the global install and reports,
without failing the sync:

1. each optional converter in `package.json` `optionalDependencies` that is missing from
   the global `node_modules`, with the exact command that installs it;
2. whether `node_modules/tree-sitter-kotlin/build/Release/*.node` exists there, and if not,
   the copy step from protocol section 10;
3. a `--dry-run` flag that prints what would be copied and checked and writes nothing.

The global root comes from `npm root -g`, as the script already does. A test runs the checks
against a temporary fake global root, never the real one. Gate green with counts, changelog
line, protocol section 10 updated if a step changed, committed on `main`, nothing pushed.

## Decisions already made

- The checks only report. They never change the exit code of the sync.
- The checks live in their own module (`scripts/sync-global-checks.mjs`) so the test can
  call them with a fake root; `sync-global.mjs` only prints their lines.
- `--dry-run` already existed in `scripts/sync-global.mjs` (commit `7041c34`). It stays
  the same flag: it prints would-write and would-remove lines and writes nothing. The new
  checks are read-only, so they run in dry-run too and print the same lines.
- A missing converter is installed by reinstalling the fork tarball, not by `npm i -g <pkg>`:
  a bare global package would land beside `@nanonets/graft`, not inside its `node_modules`.
  Protocol section 10 says to back up the Kotlin `build/` folder before a reinstall.
- Test runs one at a time (memory note `gates-one-at-a-time`).

## Files and links that matter

- `scripts/sync-global.mjs` (the sync; `--dry-run` already present; the `npm root -g`
  lookup and version guards at the top stay as they are).
- `scripts/sync-global-checks.mjs` (new): the checks.
- `test/sync-global-checks.test.ts` (new): fake global root in `mkdtemp`.
- `package.json` `optionalDependencies`: `fflate`, `pdfjs-dist`. The third converter named in
  the brief, `@napi-rs/canvas`, is not an optional dependency in this tree; the check reads
  `optionalDependencies` and so does not list it.
- `docs/operator-protocol.md` section 10 (the Kotlin copy and the reinstall steps).
- `CHANGELOG.md` `## 0.25.0-nishadherath`.
- `docs/baselines/upstream-4e7d0f5-failures.txt` (38 names; D13 comparison).

## Verified facts

- Node 26.7.0 on this machine (`node -v`, 2026-10-26).
- `git status --short` clean at 0b2dbe5 (2026-10-26).
- Haiku persona: `ENGINEERING_PERSONA.md` section 3.2 names one edition per class. Haiku loads
  `ENGINEERING_PERSONA_LANGUAGES/node-ts-js.haiku.md`; no bash file is needed (no shell script
  touched).

## Work completed

- `test/sync-global-checks.test.ts` written first; run alone it failed on the missing module,
  then passed 3 of 3 after `scripts/sync-global-checks.mjs` existed.
- `scripts/sync-global-checks.mjs` (new): `checkGlobalInstall`, `reinstallCommand`.
- `scripts/sync-global.mjs`: imports the checks, prints their lines after the copy and version
  check, and prints `dry run, nothing written` on `--dry-run`.
- `CHANGELOG.md` `## 0.25.0-nishadherath` gained `### Added` with one entry.
- `docs/operator-protocol.md` section 10: one bullet on what the sync now reports.
- Gate (`npm run build && npm test`, Node 26.7.0, one run): build exit 0; tests 4,234, pass
  4,111, fail 34, skipped 89, 2,015 s. Of the 34, 32 are on `docs/baselines/upstream-4e7d0f5-failures.txt`.
  Two were not: `once per epoch: the same ask re-arms the block with a fresh run id (D65)...`
  and `the deadline: slow probes are left out...`. Rerun alone (`test/skills-prompt.test.ts`)
  both passed, so they are load flakes under D13. The same file alone also failed two
  baseline names (`ready probes...`, `credit in the prompt hook (D57)...`), as expected.
- `node scripts/sync-global.mjs` for real, after the gate: 0 changed, 1,630 unchanged;
  `global graft answers --version 0.25.0-nishadherath`; `all 2 optional converters present`;
  `tree-sitter-kotlin binary present`.
- Brief said the converters include `@napi-rs/canvas`. `package.json` `optionalDependencies`
  lists only `fflate` and `pdfjs-dist`, so the check covers those two. `@napi-rs/canvas` sits
  in the global install (`@napi-rs` folder) as a dependency of `pdfjs-dist`, not of this package.
- `--dry-run` was already in the script before this stage (commit `7041c34`); the stage kept it.

## Unresolved questions

- Whether `@napi-rs/canvas` should be listed as a converter. Operator decides; it would
  change only the `optionalDependencies` list the check reads.
- Effort cannot be read from inside the session. The stage ran at the session's effort;
  the handoff asked for medium, and the session did not report a different one.

## Exact next action

Commit the six paths named in the handoff with explicit `git add`, on `main`. Push nothing.

## Cost projection

Model claude-haiku-5-5. The session's token counter fell from 15,000,000 to about 14,860,000
(about 140,000 tokens across all turns, including context re-reads). Dollar price is not in
source (AGENTS.md rule 6); at the provider's list price for Haiku 5.5 on the day, the total is
that token count times the input and output rates, which were not checked here.

## Time projection

Wall clock: about 25 minutes of editing and checks, plus the gate at 2,015 s (33.6 min), the
reruns and the sync. Operator review time: about 10 minutes.
