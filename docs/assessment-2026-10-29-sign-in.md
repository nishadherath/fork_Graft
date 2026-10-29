# The npx trail sign-in: what it is, what it permits, its blast radius, and its pros and cons

Written 2026-10-29 by the sign-in analysis session (Claude Fable 5.1, high),
on the operator's request of the same day, in ASD-STE100 style as asked.
Evidence is the fork at `main` (`7f2130c`, release 0.28.0-nishadherath),
upstream's commits `bc9544d` (0.27.0), `961a9e8` and `25ea4c7` (0.28.0), the
learnings in `.trail/learnings/` of 2026-10-27, and the operator's machine as
read on 2026-10-29. No `graft` or `trail` command was run in this checkout.
Decisions continue from D36; this document opens D37.

## 0. Conclusion

The npx trail sign-in is upstream's one-time-code login, merged into this
fork at Stage 39. One command connects a laptop to a Trail workspace and
writes a user-level MCP entry for every coding agent on the laptop. This fork
keeps the installed launcher, never npx, so a laptop without trail installed
gets entries that fail until a global install. The feature is dormant on the
operator's machine: no token file, no sign-in state. No action is necessary
today. Two fork changes are worth one Sonnet stage if the operator plans to
sign in (section 5, D37).

## 1. What is the new npx trail sign-in feature?

It is a command that connects one laptop to one Trail workspace. The command
is `trail login --code <CODE>`. Trail's web page gives the code. The code
works one time, for 15 minutes. You run the command through npx, so trail
does not have to be installed first.

The sequence is this:

1. You sign in to Trail's web page in a browser.
2. The page gives you a prompt. The prompt holds the command and the one-time code.
3. You paste the prompt into your coding agent. The agent runs the command.
4. If trail is not installed, npx downloads the newest package to a temporary folder and runs it.
5. trail sends the code to Trail. Trail sends back a token for this laptop.
6. trail writes the token to a file in your home folder.
7. trail writes one Trail MCP entry into the user configuration of each installed agent.
8. trail uploads the committed learnings of your repos that are in the workspace.
9. The agent tells you that the laptop is signed in. The next agent session shows the workspace's tools.

Upstream added the code sign-in in release 0.27.0 (`trailhq/Trail-Code#706`,
2026-10-27). Release 0.28.0 (`trailhq/Trail-Code#709`) corrected a fault.
Under npx, trail is on PATH only for that one process. The sign-in wrote
agent entries that start `trail`, and the agents found no such command.
Upstream now writes an npx launcher on such laptops.

This fork merged both changes at Stage 39 (2026-10-29). The fork keeps one
older rule: the MCP launcher is always the installed program, never npx.
Commit `c4d4120` set the rule, and
`docs/security/2026-10-15-graft-mcp-npx-launcher-advisory.txt` gives the
reason. The test at `test/hosts-trail.test.ts:272` holds upstream's npx case
to that rule. The `login`, `logout` and `workspace` commands exist only under
the `trail` name (`src/cli.ts:2938-2943`). Under the `graft` name there is no
sign-in. The fork's global install has both names (`package.json` `bin`).

| Item | Value | Source |
|---|---|---|
| One-time code | 1 use, 15 minutes | CHANGELOG 0.27.0 |
| Claim request limit | 15 seconds | `src/cloud/workspace.ts:330-336` |
| Browser link life | 24 hours | `src/cloud/nudge.ts:42` |
| Background wait for a link | 20 minutes | `src/cloud/nudge.ts:46` |
| Token file mode | 0o600 on POSIX, none on Windows | `src/util/private-file.ts` |

The code path, for the next reader: `loginCommand` and `loginWithCode`
(`src/cli.ts:2347-2430`), `claimLoginCode` (`src/cloud/workspace.ts:330`),
`writeCloud` (`src/cloud/workspace.ts:175`), `addAgentEntries`
(`src/cli.ts:2440-2449`), `installBrainsServer` and
`installCursorBrainsServer` (`src/hosts/claude-global.ts:242-273`),
`syncWorkspaceRepos` (`src/cloud/workspace-sync.ts:459`), and
`commandOnPath` (`src/brand.ts:162`).

## 2. What does it permit?

- **One sign-in for all agents.** Claude Code, Cursor and Codex on the laptop
  get the workspace in every project. There is nothing more to run.
- **The workspace's tools, skill prompts and instructions.** The local server
  runs as `trail mcp --brains`. It passes the workspace's own MCP server
  through, with the token as a bearer (`src/mcp/connector.ts`). A new tool on
  the server shows up with no release.
- **Upload of learnings.** The committed learnings of each repo in the
  workspace go up, with teammates' pushed branches and tracked skills. An
  uncommitted edit, an untracked file, a personal learning or a file with a
  secret never goes up (`src/cloud/workspace-sync.ts:1-23`).
- **Reports of use.** Each search or check sends the names and authors of the
  learnings it showed, counts and saved tokens. It never sends the query or
  the file paths (`src/cloud/lookup-activity.ts`).
- **Several workspaces on one laptop.** Each repo goes to one workspace
  (`cloudForRepo`, `src/cloud/workspace.ts:148`).
- **An offer to teammates.** A signed-in laptop writes `.trail/workspace.json`
  into the repo. A teammate's agent is then told, one time per session, to run
  the login command for that workspace (`src/cloud/team-file.ts`,
  `src/claude/hooks.ts:574`).
- **Disconnection.** `trail logout` removes the token and the Claude Code and
  Cursor entries (`src/cli.ts:2451-2488`).

## 3. What is the blast radius?

The sign-in writes these files outside every repo: `~/.trail/cloud.json` (the
token), `~/.trail/cloud-nudge.json` and `~/.trail/outbox.jsonl`, the
user-scope `mcpServers` map in `~/.claude.json`, Cursor's `~/.cursor/mcp.json`,
and Codex's `~/.codex/config.toml`. Inside a repo it writes
`.trail/workspace.json`, with three fields and no token. That file is
committed, so it reaches every teammate.

The effects are these:

- **Every project on the laptop.** The workspace's instructions and tool
  descriptions go into every agent session, also in repos that are not in
  the workspace (`src/mcp/server.ts:160-200`). The workspace server controls
  that text. This is a new path for text into the agent's context.
- **Codex gets the full server.** The sign-in writes a user-level `trail mcp`
  entry for Codex, not the workspace-only one (`src/cli.ts:2445`). That server
  runs upkeep in each folder Codex opens (`src/mcp/server.ts:112`). In this
  fork, upkeep can move a graft-wired repo to trail's layout, as it did in
  this checkout on 2026-10-28 (protocol section 10). Twelve repos on the
  operator's machine are wired.
- **The fork's npx case.** On a laptop without trail installed, the fork
  writes entries that start `trail`. The agents show a server that cannot
  start, until trail is installed. This is the accepted cost of the launcher
  rule.
- **The token at rest.** On Windows the profile's ACL is the only guard. Any
  process that runs as the user can read the file. Logout deletes the file
  but sends nothing to Trail. The CLI has no revoke call and no delete call
  for uploaded learnings. Logout also leaves the Codex entry in place.
- **The npx run itself.** The agent runs the registry's newest package with
  `-y`, one time, at sign-in. Upstream's launcher repeats that at every
  session start on such laptops. This fork never writes that launcher.
- **Teammates.** The offer line is in every session of every teammate, until
  they sign in or remove the file.
- **Usage events.** `TELEMETRY.md` names two sign-in events
  (`brain_signup_opened`, `brain_signup_settled`). This fork's build has no
  telemetry key, so none go out.

The operator's machine on 2026-10-29 has no token file, no nudge state and
no outbox. The user-scope MCP map in `~/.claude.json` holds one server,
`graft`. `~/.codex/config.toml` is present, so a sign-in here would also
write a Codex entry. `~/.cursor` is absent.

## 4. What are the pros and cons?

Pros:

- One command signs in every agent, with no install and no browser step on
  the laptop.
- The code is single use, and it expires in 15 minutes.
- The data limits are clear and tested: committed learnings only, counts
  instead of queries, secrets held back.
- A repo cannot send a person to a different Trail: the address in
  `.trail/workspace.json` is used only when it matches the laptop's own Trail
  (`teamWorkspace`, `src/cloud/team-file.ts`).
- Every call to Trail has a time limit and never throws. The repo tools
  continue to work when Trail is unreachable.
- The fork's launcher stays pinned to the installed program.

Cons:

- The sign-in executes an unpinned package from the registry, at the agent's
  hands.
- In the fork, a laptop without trail gets entries that fail until a global
  install.
- The sign-in writes to three agents' machine-wide configuration. The Codex
  entry runs upkeep in every folder Codex opens.
- Logout does not revoke the token on the server, does not remove uploaded
  learnings, and leaves the Codex entry.
- The workspace's instructions enter every session on every signed-in
  laptop.
- `README.md` still answers "Do I need to sign in?" with "No" and calls the
  workspace "coming soon" (`README.md:459-460`). That is upstream's prose,
  and it is out of date.

## 5. Open decision

```
Decision:      D37. Two fork changes to the Trail sign-in, before the operator signs in.
Options:       A. One Sonnet stage: `trail logout` also removes the Codex entry, and
                  `trail login --code` warns when no `trail` is on PATH, naming the install.
               B. Leave upstream's behaviour as merged; revisit at the next upstream release.
Pros and cons: A: closes two gaps the fork's launcher rule exposes; about $2 to $4 and
                  one gate. B: no cost now; the gaps stay until a sign-in meets them.
Blast radius:  A: `src/cli.ts` logout and login paths, two tests, a CHANGELOG line; nothing
                  outside the fork. B: a signed-in laptop without trail gets failing agent
                  entries; a logout leaves Codex pointed at `trail mcp`.
Recommended:   B until the operator plans a sign-in, then A. The feature is dormant
                  here, and the merge stage already judged the gate under D13.
```

If A is chosen: Sonnet 5.5, effort high. Kickoff prompt:

```
Read docs/operator-protocol.md and AGENTS.md. Stage 43: two fork changes to the Trail sign-in, test first. (1) `trail logout` and `trail logout --workspace` of the last workspace also remove the user-level Codex `[mcp_servers.trail]` entry that `addAgentEntries` wrote (src/cli.ts). (2) `trail login --code` warns, after the sign-in, when `commandOnPath("trail")` is false, because this fork writes the installed launcher and the agents will find no `trail` command; name the install command in the warning. Tests in test/hosts-trail.test.ts and a new test/cloud-login-fork.test.ts. CHANGELOG entry under Unreleased. Gate: npm run build && npm test, judged under D13. Commit, then write docs/handoffs/2026-10-29-stage-43-sign-in-fork-fixes.md.
```
