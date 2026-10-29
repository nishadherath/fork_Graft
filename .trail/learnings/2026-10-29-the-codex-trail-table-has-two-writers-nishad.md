---
title: "The Codex trail table has two writers, init and the sign-in, so a logout that removes it unwires Codex from init too"
author: Nishad
date: 2026-10-29
branch: main
id: l-8af64afd
scope: repo
status: active
src: agent
touches:
  - src/cli.ts
  - src/hosts/mcp-config.ts
  - test/cloud-login-fork.test.ts
  - test/hosts-trail.test.ts
---

## Decided
Codex has no workspace-only server. `trail init` writes a user-level `[mcp_servers.trail]` table (`trail mcp`) that
serves the repo tools and passes the workspace through once signed in, and the sign-in writes the identical table
when Codex is installed. Upstream's logout left it alone for that reason. Stage 43 (fork) made logout remove it, as
asked, and that also removes init's table: on the operator's machine the table came from init, so a logout there,
connected or not, unwires Codex from trail until `trail init` runs again. Decision D38 in the Stage 43 handoff: mark
the sign-in's table and remove only a marked one (A), revert (B), or ship as is (C); A recommended.

## Tried and ruled out
Judging the con "logout leaves the Codex entry" from the logout code alone (the 2026-10-29 sign-in analysis did):
it reads as a gap until `addAgentEntries` and `trail init` are read side by side and seen to write the same table.
Read the writer of an entry before deciding that a remover is missing.

## Watch out
- A fresh scratch `HOME` makes `~/.codex/config.toml` absent, so no test sees the shared table unless it writes one
  first; the round-trip test covers only the sign-in's own write.
- `init-pair-stops` "a folder that isn't a git repo" fails from cmd.exe only: the test calls `ls`. Launch the gate
  from Git Bash. `hosts-trail` "a session start that moves a graft repo to trail" is D13 baseline line 15 here.

In the code: `addAgentEntries` and `removeCodexEntry` (src/cli.ts), `upsertCodexToml` and `removeCodexToml`
(src/hosts/mcp-config.ts), `runConnectInit`'s Codex path; D38 and the Stage 44 prompt in
docs/handoffs/2026-10-29-stage-43-sign-in-fork-fixes.md.
