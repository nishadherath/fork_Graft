---
stage: "Stage 18: structured, documents and LSP on by default (tag enable-improved-support-by-default)"
model: claude-sonnet-5-5
effort: medium
status: done
created: 2026-10-21
from: "the operator's request of 2026-10-21; run on Sonnet 5.5 after a /model change"
---

# Stage 18: structured, documents and LSP on by default

## Goal

`graft build` indexes the structured tier, the documents tier and LSP edges unless
told not to. `--no-structured`, `--no-documents` and `--no-lsp` (env twins
`GRAFT_STRUCTURED=0`, `GRAFT_DOCUMENTS=0`, `GRAFT_LSP=0`) turn each off and the
choice is saved in `.graft/config.json`. Repository, global install and docs agree.
Committed on `main`, tagged `enable-improved-support-by-default`, pushed.

## Decisions already made

- Default is "on unless an explicit `false`" (`defaultOn` in `src/util/state.ts`).
  A repository that saved `false` keeps it; one that saved nothing is now on.
- Documents still need the structured tier. A missing converter is still named.
- LSP runs only in `graft build` (CLI and workspace children), never in the
  automatic refresh or the hooks: a server can take minutes to index.
- The API level (`buildGraph`, `engine.graph`) keeps `lsp` as an explicit option;
  the CLI supplies the default. Tests that call the API are unchanged.
- The pull-request branches for upstream stay opt-in (plan decision D1); this
  change is on `main` only (`docs/upstream/design-issue.md` operator note).
- No version bump: the tag names the release; `graft build --help` shows it.

## Files and links that matter

- `src/util/state.ts` (`defaultOn`, `readStructured`, `readDocuments`, `readLsp`),
  `src/cli.ts` (build options, `lspWasExplicit`), `src/graph/workspace-cli.ts`.
- `src/graph/lsp/registry.ts` (Windows PATH walk), `src/graph/lsp/client.ts`
  (shell for `.cmd`, exit-aware initialize).
- `test/defaults-on.test.ts` (new), `test/lsp-enrich.test.ts` (two new tests),
  `test/helpers.ts` (`runCli` takes `env`).
- Docs: `README.md`, `CHANGELOG.md` (Unreleased), `.env.example`, `AGENTS.md` rule 5,
  `docs/architecture/system-reference.md` and `system-diagram.html`.

## Verified facts (2026-10-21, Node 26.7.0)

- First gate with the new defaults: 1,560 tests, 1,546 passed, 9 failed. All nine
  assumed the tier off by default. Fixed by saying `structured: false` where the test
  is about the off state, a `.txt` fixture in `test/blast.test.ts`, and on-by-default
  assertions in `test/structured-tier.test.ts`.
- Real LSP check: a two-file Rust repo with `C:\Users\Bob\.cargo\bin\rust-analyzer.exe`
  (a rustup shim, component not installed). Before the client fix the default build
  took 125 s; after it 4 s. `--no-lsp` takes 5 s. The server is now found on Windows
  (the progress line named it); before, `command -v` never found anything there.
- The final gate and the push are quoted in the report that closed this stage.

## Work completed

- Source, tests, docs as listed above, committed on `main` (c0e74d1, tag `enable-improved-support-by-default`).
- Follow-up the same day: document notices are one line for each cause, never one for each
  file (`src/graph/structured/documents/notices.ts`). A missing converter package is a warning
  that names `--no-documents`, not an error. Gate after it: 1,565 tests, 1,560 passed, 0 failed,
  5 skipped. Tag `enable-improved-support-by-default.1`.
- Cleanup: the four merged `stage-*` branches deleted; the five `pr/*` branches kept (they hold
  the upstream pull-request work, 3 to 8 commits each not on `main`) and pushed to origin as a
  backup; no worktrees other than the main checkout.

## Unresolved questions

- Operator: a default build now costs more where a working language server exists
  (rust-analyzer, clangd, gopls, pyright, typescript-language-server): each node is
  queried, 15 s per call at worst. If that hurts, `GRAFT_LSP=0` in the environment
  turns it off everywhere, or a per-call `maxNodes` cap can be added.
- Not done: syncing the converters into the global install (memory note
  `global-install-converters`); `sync-global` still copies `dist/` only.

## Exact next action

Stage 17 (the upstream merge) is still the next code stage. The merge will conflict
in `src/cli.ts`, `src/util/state.ts` and the build files where this stage also edited;
keep the fork's default-on behaviour and `readLsp`.

## Cost projection

Sonnet 5.5 ($2.00 in, $10.00 out, $0.10 cache read per million). About 95 turns at
about 120k average context, 3k fresh and 1.2k output per turn: cache 11.4M x $0.10 =
$1.14; fresh 285k x $2.50 = $0.71; output 114k x $10.00 = $1.14. About $3.

## Time projection

Actual: about 90 minutes of wall clock including three gates of 7 to 8 minutes. Operator
review about 10 minutes.
