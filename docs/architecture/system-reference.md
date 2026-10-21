# graft system reference

Last verified: 2026-10-21. Sections 1 to 5 were checked by Stage 17 against the merge
of upstream `0c750cc` (0.23.0). Sections 6 to 8 are from Stage 15b, at `6e46fce`.

This is a living reference for the operator's fork of graft. It states what the
tool does today, as the source code defines it. Section 8 says how to keep it
current.

## How to read this document

- The writing style is Simplified Technical English. Sentences are short. Each
  sentence makes one point.
- Every section names its source file. A line number is the line on the
  verification date. Line numbers drift, so re-check them with `grep -n`.
- Where the source and the upstream README disagree, the source is right. The
  disagreement is listed in section 9.
- "Keyless" means the step needs no API key and no network. "Opt-in" means the
  step is off until the user turns it on.
- A fact that was not checked is listed in section 9. It is not stated in the
  body.

Contents:

1. Project state
2. Terms and files on disk
3. CLI commands
4. MCP server
5. Claude Code integration and other hosts
6. File types by tier
7. How graft reduces token use and cost
8. Keeping this document current
9. Source disagreements and unverified facts

## 1. Project state

Sources: `package.json`, `docs/handoffs/2026-10-18-stage-17-merge-upstream-0.23.0.md`
(verified facts), `docs/assessment-2026-10-18.md` (sections 4 and 8), `CHANGELOG.md`
(top section).

| Item | State |
|---|---|
| Package | `@nanonets/graft`, version `0.23.0-nishadherath` (`package.json` line 3) |
| Branch | `main`, with upstream `0c750cc` merged on 2026-10-21 (Stage 17) |
| Global install | A `--ignore-scripts` install of the fork's own packed tarball, then `sync-global`. `graft --version` printed `0.23.0-nishadherath` on 2026-10-21. The shim runs `dist/bin/graft.js` |
| Node | `engines` says `>=20`. The operator runs 26.7.0 |
| Upstream | `trailhq/Trail-Code`. It publishes 0.23.0 as `@nanonets/graft` and as `@trailhq/trail-code` (with a `trail` command) |
| Distance from upstream | 0 commits behind `upstream/main` (`0c750cc`) on 2026-10-21 |
| Brand | This build runs as `graft` and writes its map to `graft/`. It installs no `trail` command. `test/graft-brand-layout.test.ts` holds this. Exception: a repository with a `.trail/learnings/` folder is on trail for the map whatever the brand. Upstream tracks one, so this checkout's own map is in `.trail/cache/` (decision D12 in the Stage 17 handoff) |
| Last full gate | `npm run build && npm test` on 2026-10-21 (Node 26.7.0), after the merge: 1,665 tests, 1,653 passed, 0 failed, 12 skipped, 531 s. The 12 skips are Windows platform skips and tests that upstream marks skip |
| Stages done | Stages 0 to 18 have `status: done` in `docs/handoffs/`. Stage 17 is the upstream merge |
| Upstream pull requests | None opened. The operator's one upstream item is issue 542 |
| Draft advisory | Written, not sent. The Windows PATH probe bug is still in upstream `0c750cc` |

What the fork adds to upstream (assessment section 1, `CHANGELOG.md`):

- The structured tier: 13 families of documents and configuration. On by default since the tag `enable-improved-support-by-default`. `--no-structured` turns it off.
- The documents tier: PDF, DOCX, ODT, EPUB, PPTX and ODP. On by default since the same tag. `--no-documents` turns it off.
- LSP edges: on by default since the same tag. `--no-lsp` turns them off. The Windows server lookup works (`findOnPath` in `src/graph/lsp/registry.ts`).
- `GRAFT_REASONING` and `--reasoning`, and a `tokens:` usage line after
  `build --deep`.
- The crux id echo fix in `src/ai/crux.ts`.
- An MCP launcher that is always the installed binary, `graft mcp` (or
  `trail mcp` under the trail brand), with no PATH probe
  (`src/hosts/mcp-config.ts` lines 49 to 58). Section 5 has the detail.

What is open (assessment sections 0, 4 and 7):

- Startup. On 2026-10-21 `graft --version` took 2.1 s through node and 2.3 to
  3.0 s through the shim from the global install, and 1.5 s from the fork's own
  `dist/`. The assessment measured 6.3 s on 2026-10-18. `ask --no-refresh -n 1`
  took 2.2 to 2.6 s through the shim.
- The graph of this repository had no structured nodes and no summaries on
  2026-10-18.
- The design issue for upstream was not opened.
- Decisions D8 to D11 are open. They cover the fork's purpose, the `trail`
  name, the advisory, and `GRAFT_REASONING`.
- The staged roadmap is in assessment section 6. Its Stage 18 (startup by
  per-command loading) is the next code stage, named Stage 18r in
  `docs/handoffs/` because the defaults-on work took the number 18.

## 2. Terms and files on disk

Sources: `src/graph/types.ts`, `src/graph/relations.ts`, `src/graph/build.ts`
(lines 285 to 294), `src/graph/extract-cache.ts`, `src/ask/index-file.ts`,
`src/viz/serve.ts` (line 83), `src/graph/workspace.ts`.

### Terms

| Term | Meaning |
|---|---|
| Graph | The set of nodes and edges for one repository |
| Node | One unit that has a name, a kind and a line span |
| Card | A markdown file under `graft/` for one source file |
| Span | `L<start>-L<end>`. Both numbers are 1-based and inclusive |
| Locator | The `path:span` pair that an agent opens to read the unit |
| Tier | One family of extractors. The tiers are depth, container, breadth, structured and documents |
| Tier-1 | The deterministic layer. It needs no key |
| Tier-2 | The meaning layer. It holds a summary and a crux for each node. It needs `build --deep` and a key |
| Crux | The few lines of a definition that carry its logic. An LLM picks them |
| Scope | A sub-project found by marker files such as `package.json` or `go.mod` |
| Workspace | A parent directory with two or more git-repo children and no source graph of its own |

### Node fields

Source: `src/graph/types.ts` lines 64 to 106.

- Identity: `id` (path-scoped, for example `src/cache.ts#Cache.get`), `name`,
  `kind`, `owner` (methods only).
- Location: `path`, `span`, `signature`, `exported`.
- Origin: `ast` (a hand-written extractor) or `generic` (the breadth and
  structured tiers).
- Hashes and size: `body_hash`, `chars` (file nodes only), `body_text`
  (search text, capped).
- Meaning: `summary_state` (`pending`, `ready`, `stale`), `summary`, `crux`.

### Node kinds

Source: `src/graph/types.ts` lines 15 to 44.

- Code: `file`, `class`, `function`, `method`, `interface`, `type`, `enum`,
  `struct`, `trait`, `module`, `constant`, `variable`.
- Structured tier: `section`, `key`, `element`, `selector`, `task`.

### Edge relations and confidence

Sources: `src/graph/types.ts` lines 46 to 52 and 108 to 121,
`src/graph/relations.ts`, `src/graph/resolve.ts` lines 1 to 14.

- Relations: `contains`, `calls`, `imports`, `references`, `implements`,
  `extends`.
- Walks and rankings use `calls`, `references`, `imports`, `implements` and
  `extends`. They skip `contains`.
- Confidence, best first: `lsp_resolved`, `lsp_dispatch`, `extracted`,
  `inferred`.
- `extracted` means the target is certain. Examples are a match in the same
  file and an import specifier.
- `inferred` means a unique name match across files.
- The resolver drops an ambiguous match. It does not guess.

### Dispatch order

Source: `tierOf` in `src/graph/build.ts` (line 77). `buildGraph` and
`checkGraph` both use it, so the build and the check see the same files.

1. The depth tier, if a hand-written extractor claims the extension and its
   native grammar loads. If the grammar does not load, the file goes to that
   language's WASM stand-in in the breadth tier. The build prints one line that
   names the language and the fix.
2. The container tier, if no depth extractor claimed the file. An embedded
   block whose native grammar does not load also goes to the WASM stand-in.
3. The breadth tier, if neither claimed it.
4. The structured tier, if none of the above claimed it. The walk lists these
   files only while the tier is on (the default).

`warmGrammarsFor` (line 286) loads the WASM grammars of all four before the
parse loop. The documents tier converts binaries before this loop. The Markdown
scanner then reads each rendering.

### Files graft writes

| Path (under the context directory `graft/`) | Content | Source |
|---|---|---|
| `.graph/wiring.json` | Nodes and edges | `src/viz/serve.ts` line 83 |
| `*.md`, `INDEX.md` | Cards and the index | assessment section 2 |
| `.graph/docs/<sha256>.txt` | Text renderings of documents | `src/graph/structured/documents/cache.ts` |
| `.cache/extract.json` | Per-file parse results, replayed when the file is unchanged | `src/graph/extract-cache.ts` |
| `.cache/fingerprint.json` | Size, mtime and hash of each source file | `src/graph/fingerprint.ts` |
| `.cache/ask-index.json` | Token counts for the lexical ranker | `src/ask/index-file.ts` |
| `.cache/stats.json` | Hook-maintained state for the statusline | `src/claude/statusline.ts` |
| `.cache/.sync.lock` | Stops two rebuilds from running at once | `src/graph/refresh.ts` |

Settings are stored in `.graft/config.json` in the repository (structured,
documents, include directories, submodule choices). The `--dir` option and the
`GRAFT_DIR` variable move the context directory. A relative `GRAFT_DIR`
resolves against the project directory (`src/util/state.ts` lines 43 to 47).

A build adds `graft/` to `.gitignore` unless `--no-gitignore` is given.

### Workspaces and scopes

Source: `src/graph/workspace.ts` lines 1 to 23.

- A workspace parent keeps `graft/workspace.json`. Each child keeps its own
  `graft/`.
- A query at the parent runs on each child. `ask` fuses the ranked lists with
  reciprocal-rank fusion. `grep`, `map`, `check` and `callers` run on each child
  and merge. Each hit carries a `<child>/` label.
- Inside one repository, scopes share corpus statistics. Their results combine
  by score.

## 3. CLI commands

Sources: `src/cli.ts` (line numbers below), `src/brand.ts`.
The list comes from `grep -n '\.command("' src/cli.ts`. It has 30 entries. They
include hidden commands, the `skills` subcommands and `workspace add`.

The program runs under two names. `dist/bin/graft.js` sets the graft brand and
`dist/bin/trail.js` sets the trail brand (`src/bin/`, `src/brand.ts` lines 24 to 37).
This section describes the graft brand, the one the fork's global install runs.
The last subsection lists what changes under the trail brand.

### Global options

Source: `src/cli.ts` lines 150 to 164.

| Option | Purpose |
|---|---|
| `--dir <path>` | Context graph directory. Default: `<repo>/graft` |
| `--provider <name>` | LLM wire format: `openai`, `anthropic`, `litellm` or `orcarouter`. Env: `GRAFT_PROVIDER` |
| `--model <id>` | Model id for the LLM pass. Env: `GRAFT_MODEL` |
| `--api-key <key>` | Provider key. Env: `GRAFT_API_KEY` |
| `--base-url <url>` | OpenAI-compatible endpoint. Env: `GRAFT_BASE_URL` |
| `--reasoning <level>` | Reasoning effort, in the provider's words. Env: `GRAFT_REASONING`. Unset sends nothing |
| `-v, --version` | Print the installed version |

### Behaviour shared by commands

- Query commands take `[dir]`. When it is omitted, graft uses the nearest
  ancestor directory that holds a `graft/` index. It prints a note on stderr when
  it answers from an ancestor (lines 217 to 222).
- `ask`, `skeleton`, `callers`, `blast`, `grep` and `map` refresh the graph first
  when the working tree has moved. `--no-refresh` skips the refresh. The variable
  `GRAFT_NO_REFRESH=1` does the same for every command (lines 230 to 244;
  `src/graph/refresh.ts` line 70).
- `GRAFT_REFRESH=hash` makes the freshness probe hash every file. It does not
  trust size and mtime (`src/graph/fingerprint.ts` line 107).
- Before every command except `version`, `upgrade`, `_update-check`,
  `_trail-past-read` and `mcp`, graft starts a background check of the latest
  version, prints an upgrade note if one is due, and handles the telemetry
  notice (lines 273 to 300).
- A person who types `graft` at a terminal sees one line, at most once a day, that
  says graft is now trail. An agent, a hook, CI or a pipe never sees it. The
  variable `GRAFT_NO_RENAME_NOTICE` turns it off (`src/brand.ts` `graftNotice`).

### Build and check

#### `graft build [dir]` (line 441)

Builds `graft/` from the code: the wiring graph and the per-file cards. It is
keyless unless `--deep` is given. The default `dir` is `.`.

| Option | Effect |
|---|---|
| `--check` | Build nothing. Fail if `graft/` is stale. The same as `graft check`, and counted as `check` in telemetry (lines 536 to 542) |
| `--json` | With `--check`: print the drift as JSON |
| `--deep` | Run the LLM pass: concept nodes, and a summary and crux for each symbol. Without a key, graft prints a warning and runs the keyless build (lines 633 to 648) |
| `-e, --extensions <exts...>` | Code extensions to include. An extension with no parser is ignored with a warning that lists the supported set (lines 195 to 206) |
| `-j, --concurrency <n>` | Files processed in parallel in the deep pass. Default 5 |
| `--no-reuse` | Parse every file again. Do not replay unchanged files from the cache |
| `--lsp`, `--no-lsp` | Turn the language-server pass on or off. It is on by default. It adds compiler-grade call edges when a server is on PATH. It makes the build slower. The choice persists. Env: `GRAFT_LSP` |
| `--allow-partial` | With `--deep`: exit 0 even if some summaries failed. The default is exit 1 for a degraded meaning tier |
| `--follow-submodules`, `--no-follow-submodules` | Include or exclude initialised submodules. The choice persists. Default: exclude |
| `--follow-nested-repos`, `--no-follow-nested-repos` | Include or exclude nested git clones that the index does not track. The choice persists. Default: exclude |
| `--include-dir <name>` | Remove a name from the skip list. Repeatable. Takes a bare directory name. A dot-directory is rejected. The choice persists (lines 567 to 584) |
| `--only-dir <path>` | Index only files under this repo-relative path. Repeatable. The list goes into the graph fingerprint. It is not written to the repository (lines 588 to 601) |
| `--structured`, `--no-structured` | Turn the structured tier on or off. It is on by default. The choice persists. Env: `GRAFT_STRUCTURED` |
| `--documents`, `--no-documents` | Turn the documents tier on or off. It is on by default. It needs the structured tier. The choice persists. Env: `GRAFT_DOCUMENTS` |
| `--deep-documents` | With `--deep`: also summarise documents. Not persisted. Env: `GRAFT_DEEP_DOCUMENTS` |
| `--no-gitignore` | Do not write `graft/` into `.gitignore`. Env: `GRAFT_NO_GITIGNORE=1` |
| `--no-ignore` | Do not write the `.ignore` file for ripgrep. Env: `GRAFT_NO_IGNORE=1` |

Notes:

- A workspace parent builds each child into its own `graft/` (lines 650 to 669).
- `--documents` without `--structured` prints a warning and does nothing
  (lines 560 to 562).
- The build prints the node count by kind, the edge count, the languages, and
  how many files it parsed or replayed from cache. With `--deep` it also prints a
  usage line. A build that starts from a graph copied from the main worktree
  prints a `seeded` line (line 716).
- If a native grammar does not load, graft parses that language with its WASM
  stand-in. The build then prints a notice that names the languages and the
  packages to allow at install (lines 741 to 744; `src/graph/native.ts`).

#### `graft check [dir]` (line 885)

Fails when `graft/` is stale relative to the code. It is for CI. It never
refreshes first, because it reports the drift. The work is in `runCheckCommand`
(line 901).

| Option | Effect |
|---|---|
| `-e, --extensions <exts...>` | Code extensions to include |
| `--json` | Print the drift as JSON |

Exit code 1 means no graph exists, or a present layer is out of sync. The drift
categories are `added`, `removed`, `changed` and `stale` (`src/graph/check.ts`
lines 9 to 18). `stale` means a summary is out of date. A never-built markdown
layer is only informational.

#### `graft stats [dir]` (line 943)

Shows the usage mix of the latest agent session and the tokens saved. It reads
local session JSON only. It uses no graph and no network.

| Option | Effect |
|---|---|
| `--json` | Print the session summary as JSON |

### Query commands

#### `graft ask <query> [dir]` (line 823)

Ranks nodes for a plain-words query and returns exact `file:line` locators. It
is keyless. A structural query such as "what calls X" walks the wiring graph. Any
other query ranks lexically (`src/ask/ask.ts` lines 1 to 15).

| Option | Effect |
|---|---|
| `-n, --limit <n>` | Maximum results. Default 8 |
| `--source` | Print the source at each hit. This turns the pack into the answer |
| `--full` | With `--source`: print whole definition spans. Default: the crux excerpt where one exists |
| `--in <path>` | Keep only nodes under this path prefix. Applied before scoring |
| `--json` | Print the result as JSON |
| `--no-graph-rank` | Rank by lexical relevance only |
| `--no-refresh` | Skip the freshness check |

#### `graft skeleton <file> [dir]` (line 867)

Prints the signatures of one file. The file is matched as an exact repo-relative
path first, then as a basename. An ambiguous basename returns a list of paths
(`src/ask/ask.ts` lines 1439 to 1469).

| Option | Effect |
|---|---|
| `--json` | Print as JSON |
| `--no-refresh` | Skip the freshness check |

#### `graft callers <symbol> [dir]` (line 1032)

Lists who calls or references a symbol. It is keyless. The symbol may be a bare
name, a qualified name (`Class.method`) or a package-qualified name (`pkg.Fn`).

| Option | Effect |
|---|---|
| `--direction <in\|out>` | `in` (default) gives callers. `out` gives callees |
| `-d, --depth <n>` | Walk N hops for the blast radius. `all` walks the whole connected closure. Default 1 |
| `--in <path>` | Keep only matches at or under this path prefix |
| `--json` | Print as JSON |
| `--no-refresh` | Skip the freshness check |

#### `graft blast [dir]` (line 1073)

Reports what depends on the lines that a diff touched. It is built for CI.

| Option | Effect |
|---|---|
| `--base <ref>` | Diff against the merge base of this ref with HEAD. Default: working tree against HEAD |
| `-d, --depth <n>` | Hops over incoming edges, or `all`. Default 2 |
| `--format <fmt>` | `text` (default), `markdown`, `mermaid` or `json` |
| `--name` | Name the affected areas with one cached LLM call. It needs `GRAFT_API_KEY` |
| `--export-viz <dir>` | Also write the interactive page for this radius |
| `--title <text>` | Subtitle for the exported page |
| `--no-owners` | Do not suggest people to tag from git history |
| `--pr-author <who...>` | Keep the PR author out of the suggestions |
| `--no-refresh` | Skip the freshness check |

#### `graft grep <pattern> [dir]` (line 1105)

Runs a regex over the indexed files. It groups hits by the innermost enclosing
symbol. It ranks groups by the count of incoming edges. It is keyless.

| Option | Effect |
|---|---|
| `-i, --ignore-case` | Case-insensitive match |
| `--fixed` | Treat the pattern as a literal string |
| `--in <path>` | Keep only files at or under this path prefix |
| `--json` | Print as JSON |
| `--no-refresh` | Skip the freshness check |

The default cap is 300 hits. Each hit text is cut at 160 characters. The output
counts the hits and unreadable files that it dropped (`src/search/grep.ts`
lines 59 to 80).

#### `graft map [dir]` (line 1140)

Prints a token-budgeted orientation: directory clusters, the hubs in each
directory, and global hotspots. Importance is the count of incoming dependency
edges (`src/graph/map.ts` lines 1 to 20).

| Option | Effect |
|---|---|
| `--max-dirs <n>` | Maximum directories shown. The rest are counted as dropped. Default 16 |
| `--json` | Print as JSON. At a workspace parent the JSON path does not federate (lines 1163 to 1166) |
| `--no-refresh` | Skip the freshness check |

#### `graft viz [dir]` (line 961)

Serves an interactive view of the graph, or writes it as one HTML file.

| Option | Effect |
|---|---|
| `-p, --port <port>` | Port to serve on. Default 4400 |
| `--no-open` | Do not open the browser |
| `--export <dir>` | Write one self-contained `index.html` instead of serving |
| `--title <text>` | Subtitle for an exported page |
| `--tabs <list>` | Tabs for an exported page: `context`, `code`, `outline`. Default: all three. An unknown name is an error |

#### `graft mcp [dir]` (line 1022)

Serves the graph over MCP on stdio. Section 4 describes the tools.

### Setup commands

#### `graft init [dir]` (line 1344)

Wires graft into the coding agents used with the repository. The default `dir`
is `.`. Section 5 lists what it writes.

| Option | Effect |
|---|---|
| `--no-build` | Wire the files only. Do not build the graph |
| `--agents <ids...>` | Wire only these agents. The ids are the host ids in section 5 and `claude` |
| `--all-agents` | Write instruction files for every known agent |
| `--no-agents` | Wire Claude Code only |
| `--list-agents` | Print the known ids and exit |
| `--no-mcp` | Skip MCP registration for the other agents |
| `--no-hooks` | Skip hook installation for the other agents |
| `--no-statusline` | Do not write the Claude Code statusline. Env: `GRAFT_NO_STATUSLINE` |
| `--dry-run` | Print every file that would change, then exit |
| `-y, --yes` | Skip the picker. Wire every detected agent |
| `--no-global` | Skip writes outside the repository |
| `--verbose` | Print every file written, the build output and the closing banner |

Selection logic (lines 1536 to 1555): explicit flags win. With a terminal,
graft shows a picker. Without a terminal and without `--yes` or `--agents`, graft
writes nothing and prints the command to run. At a workspace parent, graft wires
the parent and each child.

#### `graft uninstall [dir]` (line 1947)

Removes the files and config entries that graft wrote. Without `-y` it prints
what it would remove and exits.

| Option | Effect |
|---|---|
| `-y, --yes` | Remove the files |
| `--keep-cache` | Keep `graft/` and the `.gitignore` entries |
| `--no-global` | Leave files outside the repository alone |

### Maintenance commands

| Command | Purpose | Line |
|---|---|---|
| `graft version` | Print the installed version and the latest on npm | 406 |
| `graft upgrade` | Upgrade the global install to the latest on npm. This replaces the fork build with the published one. It also installs `@trailhq/trail-code` when that package is published. It can then run `trail init` for the repository in the current directory (`moveHereToTrail`, line 428) | 413 |
| `graft telemetry [action]` | `status` (default), `enable`, `disable` or `debug` for the anonymous usage stats | 377 |

The `upgrade` caution comes from assessment section 3.

### Learnings commands

A learning is a short note that a session saves for the next session. These
commands exist under the graft brand but are hidden from `--help`. They are
listed by default under the trail brand. All three are keyless.

| Command | Purpose | Options | Line |
|---|---|---|---|
| `graft note [dir]` | Save what a session decided, tried and ruled out as a learning in `.trail/learnings/`. The text comes on stdin | `--title <text>` (required), `-m, --body <text>`, `--personal`, `--touches <list>`, `--author <name>`, `--minutes <n>`, `--tokens <n>`, `--json` | 1186 |
| `graft learn <skill> [dir]` | Save a correction as a takeaway on a skill, kept in `~/.trail` | `-m, --text <text>`, `--description <text>`, `--section <heading>`, `--author <name>` | 1205 |
| `graft skills [dir]` | List the repository's skills and the takeaways that wait to fold in | `--json` | 1238 |
| `graft skills show <skill>` | Print a skill with every takeaway not yet folded in | `-C, --dir <path>` | 1264 |
| `graft skills fold [skill]` | Write waiting takeaways into `SKILL.md` and raise its version | `--confirmed`, `-C, --dir <path>` | 1275 |
| `graft skills publish <skill>` | Move a skill kept on this machine into the repository's `.claude/skills/` | `-C, --dir <path>` | 1308 |
| `graft skills confirm <skill> [takeaway]` | Say that a teammate's takeaway is right, so `fold --confirmed` takes it | `--author <name>`, `-C, --dir <path>` | 1325 |

### Hidden commands

Hidden commands do not appear in `--help`. The upkeep step and the hooks start
them in detached processes.

| Command | Purpose | Line |
|---|---|---|
| `graft _update-check` | Refresh the cached answer for the latest version | 362 |
| `graft _telemetry-flush` | Send the queued anonymous usage events | 371 |
| `graft _trail-past-read <dir>` | Read a repository's past sessions and PR reviews for learnings, after a move to trail | 327 |
| `graft _trail-sync [dir]` | Send the repository's learnings and waiting uses to the Trail workspace | 338 |
| `graft _trail-branches [dir]` | Fetch, then note which files teammates' open branches change and the learnings they carry | 347 |
| `graft _trail-claim` | Wait for a sign-in through the link that the agent was given, then connect the workspace | 355 |

### Under the trail brand

`trail` runs the same program with a different command layout (`src/cli.ts`
line 106, lines 2417 to 2455). The fork's global install has no `trail` command,
so these facts come from the source only.

- `trail check` is the team check (`teamCheckCommand`, line 2241). It compares the
  branch diff with the learnings. The freshness check is `trail build --check`.
- `trail status` (line 2361) replaces `stats` and shows the map, the learnings and
  the tokens saved. `stats`, `viz`, `mcp` and `version` are hidden.
- `trail note` is listed. `trail team` (line 2134) shows what the team learned this
  week.
- `trail workspace` (line 2041, with `add` at line 2079), `trail login` (line 1986)
  and `trail logout` (line 2021) manage a Trail workspace. They are hidden unless
  the cloud is enabled (line 2420).
- `trail init` also reads the repository's past Claude sessions and merged PR
  reviews for learnings (lines 1607 to 1610).
- The default context directory is `.trail/cache/` in a repository that is on
  trail (`src/context/map-dir.ts` `mapDirFor`, line 31). A `graft/` map that git
  does not track is moved there.

## 4. MCP server

Sources: `src/mcp/tools.ts`, `src/mcp/server.ts`, `src/mcp/instructions.ts`,
`src/mcp/tool-names.ts`.

### Transport and methods

- The server speaks newline-delimited JSON-RPC 2.0 on stdio. Stdout carries
  protocol messages only (`server.ts` lines 1 to 4).
- It answers `initialize`, `ping`, `tools/list` and `tools/call`. It ignores
  `notifications/initialized` and `notifications/cancelled`.
- Errors: -32700 for a parse error, -32601 for an unknown method, -32603 for an
  internal error in `tools/call`.
- `initialize` returns `serverInfo.name` (`graft` under the graft brand), the
  version, `capabilities` with `tools`, and the instructions text (`server.ts`
  line 109).
- `callTool` never throws. A tool failure returns text with `isError: true`
  (`tools.ts` lines 218 to 245).

### Which tools the server lists

Source: `server.ts` lines 61 to 66.

- With a `--dir` override, the server lists all tools.
- Otherwise it lists all tools only if the repository has a graft index, or if
  the main worktree of a git worktree has one.
- In any other case `tools/list` returns an empty list. The reason is that the
  user-level registration starts this server in every project.

### Freshness before each call

Source: `tools.ts` lines 203 to 245.

Every tool except `graft_check_freshness` refreshes the graph first. The refresh
is keyless. If the refresh adds a note, the note comes before the answer.

### Tools

Six tools exist (`tool-names.ts` lines 9 to 16).

#### `graft_find_code`

Queries the graph in plain words. It returns ranked nodes with exact spans and
the source inlined. The source is always on for this tool.

| Parameter | Type | Required | Meaning |
|---|---|---|---|
| `query` | string | yes | What to understand |
| `limit` | number | no | Maximum results. Default 5 |
| `full` | boolean | no | Inline whole definition spans instead of the crux excerpt |
| `in` | string | no | Keep only nodes under this path prefix |

#### `graft_file_api`

Returns every definition in one file with its signature and span. The tool
description says it costs about a tenth of reading the file.

| Parameter | Type | Required | Meaning |
|---|---|---|---|
| `file` | string | yes | Repo-relative path, or a unique basename |

#### `graft_check_freshness`

Reports whether the graph is in sync with the code. It takes no parameters. It
does not refresh first.

#### `graft_trace_calls`

Returns the structural edges of a symbol over calls, references, imports,
implements and extends. The default is direct callers.

| Parameter | Type | Required | Meaning |
|---|---|---|---|
| `symbol` | string | yes | Bare name, `Class.method`, `pkg.Fn`, or a file path |
| `direction` | `in` or `out` | no | `in` (default) gives callers. `out` gives callees |
| `depth` | number or `"all"` | no | Hops to walk. Default 1. `all` (or `full`) walks the whole closure |
| `in` | string | no | Keep only matches under this path prefix |

Notes:

- An unknown symbol returns an error that tells the caller to check the spelling
  or run `graft build`.
- The code also accepts a `file` argument in place of `symbol`. The schema does
  not list it (`tools.ts` line 286).
- At a workspace root, the code reads `depth` only when it is a number
  (`tools.ts` line 175). A string value such as `"all"` is ignored there.

#### `graft_find_all`

Runs a regex over the indexed files. Hits are grouped by the innermost enclosing
symbol and ranked by incoming-edge count.

| Parameter | Type | Required | Meaning |
|---|---|---|---|
| `pattern` | string | yes | Regex, or a literal string with `fixed: true` |
| `in` | string | no | Keep only files under this path prefix |
| `ignore_case` | boolean | no | Case-insensitive match |
| `fixed` | boolean | no | Treat the pattern as a literal string |

A search with no hits returns a note, not an error. In a single-graph repository
the note takes extra text from `ignoredCode` (`tools.ts` line 318,
`src/search/ignored-code.ts`).

#### `graft_repo_map`

Returns the directory clusters, hubs and hotspots.

| Parameter | Type | Required | Meaning |
|---|---|---|---|
| `max_dirs` | number | no | Maximum directories shown. The schema says default 16. A value of 0 or less is ignored |

### Tool names from earlier versions

The server still accepts the names from before version 0.8.1
(`tool-names.ts` lines 23 to 30):

| Old name | Current name |
|---|---|
| `graft_ask` | `graft_find_code` |
| `graft_grep` | `graft_find_all` |
| `graft_callers` | `graft_trace_calls` |
| `graft_skeleton` | `graft_file_api` |
| `graft_map` | `graft_repo_map` |
| `graft_check` | `graft_check_freshness` |

### The instructions text

Source: `src/mcp/instructions.ts`.

- The server sends this text in the `initialize` reply. A host that defers tool
  schemas still delivers it.
- The text tells the agent that the repository is indexed and that these tools
  usually replace several file reads.
- It gives one `ToolSearch` query that loads all tools in one lookup. The query
  is built by `toolSearchQuery()` with the prefix `mcp__<brand>__`, so
  `mcp__graft__` under the graft brand (lines 37 to 40).
- It lists five tools in order of use: `graft_find_code`, `graft_find_all`,
  `graft_trace_calls`, `graft_file_api`, `graft_repo_map`. It does not list
  `graft_check_freshness`.
- It states that results include uncommitted edits.
- The source comment sets a budget of about 1,000 characters (line 23).
- If the upkeep step has lines to report, the server puts them before this text.

This document does not copy the text. Its tool lines use a dash character that
the prose rules of this repository forbid. Read the exact words in
`src/mcp/instructions.ts` lines 43 to 59.

### Under the trail brand

Started as `trail mcp`, the same server changes its names (`src/brand.ts`
`inBrand`).

- `serverInfo.name` is `trail` (`server.ts` line 109).
- `tools/list` advertises `trail_find_code`, `trail_find_all`, `trail_trace_calls`,
  `trail_file_api`, `trail_repo_map` and `trail_check_freshness`. The tool
  descriptions and the instructions text use the word trail (`server.ts` line 123,
  `tool-names.ts` line 38).
- The server answers both name sets. `canonicalToolName` maps a `trail_` name to
  its `graft_` name (`tool-names.ts` line 47).
- The `ToolSearch` prefix is `mcp__trail__`.
- `trail init` registers no MCP server for Claude Code. See section 5.

## 5. Claude Code integration and other hosts

Sources: `src/claude/settings-merge.ts`, `src/claude/hooks.ts`,
`src/claude/format.ts`, `src/claude/statusline.ts`, `src/claude/init.ts`,
`src/claude/skill-template.ts`, `src/hosts/` (all files), `src/cli.ts`
lines 1536 to 1555.

This section describes the graft brand. The last subsection lists what changes
under the trail brand.

### What `graft init` writes for Claude Code

Sources: `src/claude/init.ts` lines 73 to 84 (`legacyClaudeTargets`),
`src/hosts/claude-global.ts` lines 57 to 67.

| Scope | Path | Content |
|---|---|---|
| Repo | `.claude/settings.json` | Statusline, hook blocks, footer regex, Bash allow list |
| Repo | `.claude/helpers/graft-statusline.cjs` | Statusline shim |
| Repo | `.claude/helpers/graft-hooks.cjs` | Hooks shim |
| Repo | `.claude/skills/graft/SKILL.md` | The graft skill. `init` never edits `CLAUDE.md` |
| Repo | `.mcp.json` | `mcpServers.graft` |
| User | `~/.claude/helpers/graft-hooks.cjs` | Hooks shim at an absolute path |
| User | `~/.claude/settings.json` | The hook blocks only. No statusline |
| User | `~/.claude.json` | `mcpServers.graft` at the user MCP scope |

The user-level copy exists for git worktrees. A repository may ignore the repo
files above. A new worktree receives tracked files only, so it would have no hooks
and no MCP entry. `~/.claude` is not in any working tree (`claude-global.ts`
lines 1 to 27).
`--no-global` skips the three user-level writes.

### Settings merge

Source: `src/claude/settings-merge.ts`.

- The merge removes graft's earlier entries and adds the current ones. It keeps
  every entry that is not graft's. Running `init` again gives the same result.
- A `statusLine` that does not name `graft-statusline.cjs` or `trail-statusline.cjs`
  stays untouched. A warning says so (lines 100 to 127). `--no-statusline` or
  `GRAFT_NO_STATUSLINE` removes graft's own statusline and writes no new one.
- `footerLinksRegexes` gets the pattern `graft/[\w./-]+\.md` (line 11).
- `permissions.allow` gets `Bash(trail:*)`, `Bash(graft:*)`, `Bash(npx graft:*)`,
  `Bash(graft-dev:*)` and `Bash(node dist/cli.js:*)` (lines 16 to 22). The
  purpose is that a retrieval call does not raise a permission prompt.
- Each hook command has the form
  `node "${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-hooks.cjs" <argument>`.

### Hooks

Sources: `settings-merge.ts` lines 44 to 72, `hooks.ts` lines 704 to 797.

| Event | Matcher | Argument | Budget | Purpose |
|---|---|---|---|---|
| SessionStart | none | `session-start` | 8,000 ms | Orientation, upgrade note, handover line |
| UserPromptSubmit | none | `prompt` | 15,000 ms | Retrieval pack for the prompt |
| PostToolUse | `Write\|Edit\|MultiEdit` | `post-edit` | 10,000 ms | Blast radius, mark graph dirty |
| PostToolUse | `Bash\|mcp__graft__\|mcp__trail__\|Read\|Grep\|Glob` | `tool-savings` | 8,000 ms | Score usage mix, sum savings |
| Stop | none | `stop` | 8,000 ms | Bill the turn, tally, background rebuild |
| SessionEnd | none | `session-end` | 5,000 ms | Send queued telemetry from a detached child |

The hook process makes no network call. SessionStart and SessionEnd start a
detached child that sends the queued telemetry, at most once a day (`hooks.ts`
lines 727 and 750).

#### SessionStart (`hooks.ts` lines 713 to 748)

1. Run the upkeep step without the network. It refreshes wiring that an older
   graft wrote and reads the cached "newer version" answer.
2. If Claude Code is wired and no `trail` command is on PATH, add a handover line
   at most once a week. It tells the agent to say that `graft upgrade` adds the
   `trail` command (`src/brand.ts` `trailHandoverLine`, line 248). `CI` and
   `GRAFT_NO_RENAME_NOTICE` turn it off.
3. Queue the telemetry summaries of sessions that ended. Start the detached send.
4. Read `INDEX.md` from the context directory. Add a stale banner if the graph
   has drifted.
5. Emit the orientation as `additionalContext`.

The orientation holds a directive and the first 1,500 bytes of `INDEX.md`
(`format.ts` line 297). The directive names the five commands `ask`, `grep`,
`skeleton`, `callers` and `map`. It tells the agent to pick one tool, and to close
a reply with a one-line tally of tokens saved. It tells the agent not to pipe
graft output through `head` or `tail`.

#### UserPromptSubmit (`hooks.ts` lines 770 to 796)

1. A prompt shorter than 12 characters gets no pack (line 36).
2. The hook runs `graft ask <prompt> . --json -n 3` as a child process. On a
   multi-scope repo it adds `--in <scope>` when the last edited file maps to one
   scope.
3. The child's time limit is the installed hook budget minus 2,000 ms, with a
   floor of 4,000 ms. If several settings files declare the hook, the smallest
   budget wins (lines 76 to 140).
4. A strength gate decides what to inject (`format.ts` lines 279 to 295). The top
   hit must match a symbol name with a share of at least 0.1, or match the query
   with a share of at least 0.5 (`src/ask/fuse.ts` lines 100 and 108).
5. A structural result (such as "who calls X") always passes the gate. If a
   lexical result fails it, the hook injects a one-line nudge instead of a pack.
   It spends at most two nudges in a session (`format.ts` line 246).
6. A novelty gate drops hits whose pointer was already injected this session. The
   hook remembers the last 40 pointers.
7. The pack holds up to three hits. Each hit has a title, a locator and a snippet
   of at most 140 characters. The hook does not pass `--source`, so the pack holds
   no code.

#### PostToolUse: post-edit (`hooks.ts` lines 201 to 215)

1. Skip files under `graft/` or `.trail/cache/` (line 48).
2. Mark the graph dirty. Record the count of changed, added and removed nodes
   from a child run of `graft check . --json`. Record the file's base name.
3. Print the blast radius: up to eight incoming edges from outside the file, then
   a count of the rest (`format.ts` lines 72 to 83).

The hook also reads the touched path from a Codex `apply_patch` payload
(`editedFilePath`, lines 190 to 199).

#### PostToolUse: tool-savings (`hooks.ts` lines 308 to 313)

1. Classify the tool use as a graft retrieval or a source read (`Read`, `Grep`,
   `Glob`).
2. Parse each `[graft] tokens saved ≈ N` line in the output. Add N to the session
   total.
3. Flag the turn so the Stop hook can check the reply.

The classification feeds `graft stats` and the usage summary.

#### Stop (`hooks.ts` lines 417 to 561)

1. Bill the turn: read the last turn's usage from the transcript and add its
   input cost and token count to the session. A turn already billed is skipped.
2. Tally: if the turn used graft, check whether the reply told the user what graft
   saved. Only turns that the hook can observe count.
3. If the graph is dirty and no lock is held, start a detached `graft build .`
   with a 120,000 ms limit (`src/claude/sync-run.ts`). The comment calls this the
   money guard: it never runs `--deep`.

### Statusline

Sources: `src/claude/format.ts` lines 27 to 56, `src/claude/statusline.ts`.

The first line shows these segments, separated by a dot:

- `graft`, then `<N> nodes / <M> edges`.
- Freshness: `syncing…`, `⚠ <N> stale`, `⚠ stale` or `✓ synced`.
- `~<N> tok saved`, with `· ~$<X>` once a turn has been billed. It shows only if
  N is above zero.

The second line shows `ctx <percent>%` and `last: <file>`. Without a graph the
line reads `not built · run graft build`. A subagent line shows the agent name
and the prompt that the agent last used.

### The skill

Source: `src/claude/skill-template.ts`.

The skill tells the agent to pick one of six commands and act on the answer:
`ask --source`, `grep`, `skeleton`, `callers`, `map`, and `build` or `check`.
It has a table of common tasks. It tells the agent to close a turn with a tally
of tokens saved. `init` writes the same text for every host that uses a skill
file.

### Other hosts

Sources: `src/hosts/registry.ts` lines 33 to 128, `src/hosts/mcp-config.ts`
lines 176 to 233, `src/hosts/plan.ts`, `src/hosts/codex-hooks.ts`,
`src/hosts/cursor-hooks.ts`, `src/hosts/antigravity.ts`.

A "section" file is a shared file that the user owns. Graft keeps a fenced block
in it. An "owned" file is wholly graft's. Graft overwrites it on each run.

| Id | Host | Instruction file | Kind | MCP registration | Hooks | Detected by |
|---|---|---|---|---|---|---|
| `claude` | Claude Code | `.claude/skills/graft/SKILL.md` | owned | `.mcp.json` | Yes, see above | Always |
| `agents` | AGENTS.md hosts | `AGENTS.md` | section | `~/.codex/config.toml` if `~/.codex` exists. `opencode.json` key `mcp` if `~/.config/opencode` exists | `~/.codex/hooks.json` and a shim, if `~/.codex` exists | `~/.codex`, `~/.config/opencode` or `~/.config/agents` |
| `adal` | AdaL | `.adal/skills/graft/SKILL.md` | owned | None | None | `.adal` in home or repo |
| `cursor` | Cursor | `.cursor/rules/graft.mdc` | owned | `.cursor/mcp.json` | `.cursor/hooks.json` and a shim | `.cursor` in home or repo |
| `gemini` | Gemini CLI | `GEMINI.md` | section | `.gemini/settings.json` | None | `~/.gemini` |
| `grok` | Grok | `.grok/skills/graft/SKILL.md` | owned | `.grok/config.toml` | None | `.grok` in home or repo |
| `hermes` | Hermes Agent | `AGENTS.md` | section | None | None | `~/.hermes`, a local app-data folder, or `.hermes` in the repo |
| `antigravity` | Antigravity | `AGENTS.md` | section | `~/.gemini/config/mcp_config.json` | None. A skill goes to `~/.gemini/skills/graft/SKILL.md` | `~/.gemini/config`, `~/.gemini/antigravity-cli`, or `.agents` in the repo |
| `copilot` | GitHub Copilot | `.github/copilot-instructions.md` | section | None | None | `.github` in the repo |
| `kiro` | Kiro | `.kiro/steering/graft.md` | owned | `.kiro/settings/mcp.json` | None | `.kiro` in home or repo |
| `windsurf` | Windsurf | `.windsurf/rules/graft.md` | owned | None | None | `~/.codeium/windsurf` or `.windsurf` in the repo |

Hook events by host:

- Codex (`codex-hooks.ts` lines 51 to 59): SessionStart (matcher
  `startup|resume|compact`, 10,000 ms), UserPromptSubmit (15,000 ms), PostToolUse
  (matcher `apply_patch|Write|Edit|MultiEdit`, 10,000 ms) and Stop (10,000 ms).
  These entries fire in every repository opened with Codex.
- Cursor (`cursor-hooks.ts` lines 71 to 77): `postToolUse` (matcher
  `Read|Grep|Glob|Search|Shell`), `afterMCPExecution` and `sessionEnd`. They score
  the usage mix and savings. They are repo-local.

MCP launch command. These are deliberate decisions of this fork:

- `serverEntry` in `mcp-config.ts` (lines 49 to 58) returns a constant for each
  brand: `{ "command": "graft", "args": ["mcp"] }`, or `trail mcp` under the trail
  brand. `opencode.json` uses the array form.
- The command is a bare name. It is never `npx` and never an absolute path. There
  is no PATH probe when the entry is written, and no `GRAFT_MCP_NPX` switch.
- `graft init` warns once if the command is not on PATH (`cli.ts` line 1885). The
  check is `commandOnPath` in `src/brand.ts` (line 142). It looks for
  `<name>.cmd`, `<name>.exe` and the bare name on Windows. It does not read
  `PATHEXT`. It spawns no process.
- `findOnPath` is in `src/graph/lsp/registry.ts` (line 19). Only the language
  server lookup uses it. It honours `PATHEXT` and returns the path.

### Under the trail brand

`trail init` wires the same hosts with a different layout. The fork's global
install has no `trail` command, so these facts come from the source only.

- Claude Code files (`claude/init.ts` `claudeTargetsFor`, line 55, and
  `runTrailInit`, line 175):
  - `.claude/settings.json` holds one SessionStart entry that runs
    `.trail/hook.cjs`. The team commits both files.
  - `.claude/settings.local.json` holds the statusline and the allow list. It stays
    out of git.
  - `.trail/statusline.cjs` is the statusline shim.
  - The skill goes to `~/.claude/skills/trail/SKILL.md`, not into the repository.
  - No `.mcp.json` entry and no `~/.claude.json` server. The user-level step
    removes a `trail` server from `~/.claude.json`. It also turns graft's
    user-level server off for that folder (`claude-global.ts` line 160).
  - The other hooks come from `~/.claude/settings.json`. With `--no-global` they go
    into `.claude/settings.local.json`.
- SessionStart runs `trailAtStart` (`hooks.ts` line 682). It fetches teammates'
  branches, waits at most 3,000 ms, and starts a detached sync of learnings to
  the workspace. The `git fetch` is the one network wait in the hooks.
- The orientation adds a learnings paragraph (`format.ts` line 331). The
  statusline adds an `<N> learnings` segment (`format.ts` line 38).
- The prompt hook puts matching learnings above the code pack (`notesForPrompt`,
  `format.ts` line 113). The post-edit and tool-savings hooks add learnings for
  the touched file (`learningsOnTouch`, `hooks.ts` line 321). The post-edit hook
  also reports a teammate's branch that changes the same function (`editOverlap`,
  line 225).
- The Stop hook can block once in a session, to ask the agent to save a learning
  after a turn of real digging (`askForNote`, line 532).
- Files that a host owns carry the name `trail`: `.cursor/rules/trail.mdc`,
  `.adal/skills/trail/SKILL.md`, and `.cursor/hooks/trail-hooks.cjs`
  (`registry.ts` `hostRelPath`, line 143). The Antigravity skill goes to
  `~/.gemini/skills/trail/SKILL.md`.
- Every host that gets an MCP entry gets `trail mcp`, and the entry name is `trail`.

## 6. File types by tier

Sources: `src/graph/extract.ts`, `src/graph/generic.ts`,
`src/graph/container.ts`, `src/graph/structured/` (all files),
`src/graph/resolve.ts`, `src/graph/resolve-structured.ts`,
`src/graph/source-files.ts`, `src/ingest/fs.ts`.

### What graft never indexes

| Rule | Source |
|---|---|
| Directories named `node_modules`, `dist`, `build`, `_build`, `out`, `target`, `vendor`, `coverage`, `__pycache__`, `venv` | `ingest/fs.ts` lines 9 to 25 |
| Any dot-directory, and any dot-file. Exception: with the structured tier on, `.yml` and `.yaml` under `.github/workflows` | `ingest/fs.ts` lines 52 and 76 |
| Files over 1,000,000 bytes. With the documents tier on, a document may be up to 25,000,000 bytes | `ingest/fs.ts` lines 28 and 33 |
| Key material: `.pem`, `.key`, `.p12`, `.pfx`, `.jks`, `.keystore`, `.crt`, `.cer` | `source-files.ts` line 44 |
| Lockfiles: `package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml` | `structured/index.ts` lines 79 to 83 |
| Minified `.min.css`, `.min.json`, `.min.html`, `.min.htm`, `.min.svg` | `structured/index.ts` line 88 |
| Files that git ignores and does not track | `ingest/fs.ts` lines 82 to 107 |
| Initialised submodules and nested git clones, unless the user opts in | `ingest/fs.ts` lines 93 to 121 |
| The graft output directory | `source-files.ts` line 128 |

Notes:

- `--include-dir <name>` removes a name from the skip list. It never lifts a
  dot-directory or a git ignore rule (`ingest/fs.ts` lines 64 to 75).
- In a git work tree, the file set is `git ls-files` for tracked files plus
  untracked files that are not ignored. A tracked file stays in even if a later
  ignore rule matches it. Outside git, the walk reads the file system.
- A `.min.js` file stays with the depth tier (`structured/index.ts` lines 85 to
  88).

### Summary of tiers

| Tier | Default | Parser | Extent of understanding |
|---|---|---|---|
| Depth | On | Hand-written extractors over native tree-sitter grammars | Definitions, signatures, spans. Imports, calls, references, extends, implements. Local scope and receiver types |
| Container | On | A wasm grammar finds the block. The depth tier reads it | Same as depth, for the script block of a `.vue` file |
| Breadth | On | One generic extractor over a wasm grammar and its `tags.scm` query | Definitions, signatures, spans. Bare-name calls. No scope resolution |
| Structured | On | Line scanners and wasm grammars | Units of documents and configuration, with exact spans. Edges to code, links and scripts |
| Documents | On. Needs the structured tier | Converters, then the Markdown scanner | Sections of a text rendering. The locator names the page or slide |
| LSP | On. `graft build` only | A language server on PATH | Promotes call edges to compiler grade |

### Depth tier

Sources: `extract.ts` lines 24 to 61 and 154 to 300, `resolve.ts` lines 1 to 14,
`src/graph/lsp/registry.ts` lines 18 to 24.

The depth tier gives definitions with signatures and exact spans. It gives edges
for imports, calls, references, extends and implements. It resolves a call by
using the file's imports, its local bindings, and the receiver's type when a local
clue exists. It does not run a type checker. It drops a call that matches more
than one target in different files.

| Language | Extensions | Node kinds produced |
|---|---|---|
| TypeScript and JavaScript | `.ts` `.tsx` `.mts` `.cts` `.js` `.jsx` `.mjs` `.cjs` | class, function, method, interface, type, enum. Arrow-function constants count as functions |
| Python | `.py` `.pyi` | class, function, method |
| Go | `.go` | function, method, struct, interface, type |
| Java | `.java` | class, interface, enum, struct (for a record), method (constructors too) |
| Kotlin | `.kt` `.kts` | class (objects too), interface, enum, function, method, type, variable (top level) |
| Swift | `.swift` | class, struct, enum, interface (protocols), function, method, type, variable (top level) |
| PHP | `.php` | function, method, class, interface, trait, enum |
| R | `.r` `.R` | functions and methods. S3 generics and R6 classes are recognised |

Locator: the node's `path` and its `span`, read from the parse tree. Default: on.

Limits and rules:

- The extension match is case-insensitive. `.jsx` and `.tsx` use the TSX grammar.
  The other JavaScript extensions use the TypeScript grammar.
- Search text per symbol is capped at 5,000 characters. The module-level text of
  a file node is capped at 16,000 characters (`extract.ts` lines 157 and 163).
- Java and Swift calls carry the argument count. The resolver uses it to pick
  between overloads.
- The code-to-structured edges (`key`, `script`, `link`) are wired for TypeScript,
  JavaScript and Python only (`src/graph/code-refs.ts` lines 1 to 20).
- `file` nodes store `chars`: the depth tier stores the string length, and the
  other tiers store the byte length (`extract.ts` line 429, `generic.ts` line
  212, `structured/shared.ts` line 51).
- Native grammars need a compiled binary. The Kotlin grammar does not build under
  Visual Studio 18 on this machine (`AGENTS.md`, rule 1).

LSP layer (on by default; `graft build --no-lsp` turns it off):

- It adds `lsp_resolved` call edges. It makes `graft build` slower. Only `graft build` runs it. The automatic refresh and the hooks do not.
- It uses the first installed server that covers a language in the repository:
  `rust-analyzer` (Rust), `clangd` (C and C++), `gopls` (Go), `pyright-langserver`
  (Python), `typescript-language-server` (TypeScript and JavaScript).
- With no server installed the graph is unchanged.
- A server that exits at start ends the wait at once. Before the tag `enable-improved-support-by-default`, the client waited 120 s (`lsp/client.ts`).
- On Windows the lookup walks `PATH` with `PATHEXT`. A `.cmd` or `.bat` shim starts through a shell (`lsp/registry.ts`, `lsp/client.ts`).

### Container tier

Source: `container.ts` lines 1 to 50.

| Extension | What it yields | Locator |
|---|---|---|
| `.vue` | The symbols in the `<script>` block, from the depth tier with TypeScript, which also reads JavaScript | Line numbers of the `.vue` file. The extractor shifts each span by the lines before the block |

Default: on. The tier reads the script block only. Svelte and Astro files are not
in this tier. The structured tier reads them. The container tier has a test with
known line numbers (`test/container-extract.test.ts`), because a wrong shift would
give a plausible but wrong line.

### Breadth tier

Sources: `generic.ts` lines 1 to 61 and 207 to 285, `src/graph/queries/`.

The breadth tier gives signatures and conservative call edges. It does not resolve
scopes. It does not type the receiver of a member call.

| Language | Extensions | Query file |
|---|---|---|
| Rust | `.rs` | `rust.scm` |
| C | `.c` `.h` | `c.scm` |
| C++ | `.cpp` `.cc` `.cxx` `.hpp` `.hh` | `cpp.scm` |
| Ruby | `.rb` | `ruby.scm` |
| C# | `.cs` | `c_sharp.scm` |
| Scala | `.scala` `.sc` | `scala.scm` |
| Elixir | `.ex` `.exs` | `elixir.scm` |
| Solidity | `.sol` | `solidity.scm` |
| OCaml | `.ml` `.mli` | none: symbols only |
| Zig | `.zig` | none: symbols only |
| Dart | `.dart` | `dart.scm` |
| Clojure | `.clj` `.cljs` `.cljc` `.bb` | `clojure.scm` |
| Nix | `.nix` | `nix.scm` |
| Lua | `.lua` | `lua.scm` |

Locator: the node's `path` and its `span`, read from the parse tree. Default: on.
The grammars are WebAssembly files in the `tree-sitter-wasm` package, so a new
language needs no native build (`generic.ts` lines 1 to 10).

What the tier yields:

- A file node, and one node for each `@definition.<kind>` capture. The signature
  is the first line of the definition. Every node is marked as exported.
- A `calls` edge for each `@reference.call` capture, from the innermost enclosing
  definition. The resolver matches the call by name. A match in the same file is
  `extracted`. A unique match across files is `inferred`. An ambiguous match is
  dropped.
- For C and C++, an `imports` edge for each local `#include "x.h"`. For Rust, an
  `imports` edge for each `use crate::...` (`generic.ts` lines 278 to 283).
- For OCaml and Zig, symbols only. Neither language has a `tags.scm` query here.

Limits:

- Search text per node is capped at 5,000 characters (`generic.ts` line 267).
- A grammar that cannot load gives a file node only. A grammar that throws on a
  file is recorded as a build error (`generic.ts` lines 123 to 149 and 233 to 240).
- The registry also has a `java` row. The depth tier claims `.java` first, so the
  row has no effect (`build.ts` lines 287 to 292).
- A call edge may not cross a language family. The families are TypeScript with
  TSX, Java with Kotlin, Scala and Clojure, and C with C++ (`resolve.ts` lines 56
  to 60).

### Structured tier

Sources: `structured/index.ts`, `structured/shared.ts`, and one file for each
family in `structured/`.

Default: on. Turn it off with `graft build --no-structured` or
`GRAFT_STRUCTURED=0`. The locator is the node's `path` and its `span`, in lines
of the host file. The choice persists in `.graft/config.json`. The variable wins in both directions: `0` or
`false` turns the tier off (`src/util/state.ts` lines 180 to 189). The scanners
are deterministic and keyless. They never throw on bad input. They index fewer
units, not a wrong span.

| Family | Extensions | Parser | Unit (kind) | What it does not do |
|---|---|---|---|---|
| Markdown | `.md` `.markdown` `.mdx` | Line scanner | `section` for each ATX or setext heading, and `key` for each front matter key. The symbols of tagged fenced code | Does not render. Skips headings in block quotes and list items |
| JSON | `.json` `.jsonc` `.jsonl` | Wasm grammar | `key` for each dotted path | Does not validate. An array adds an index only for object elements with a `name`, `id` or `key` field. A `.jsonl` file indexes its first record only |
| YAML | `.yaml` `.yml` | Wasm grammar | `key` for each dotted path | Does not resolve anchors, aliases or merge keys. A later document in a file gets the prefix `doc2.`, `doc3.` |
| TOML | `.toml` | Line scanner | `key` for each table and key | Does not validate. There is no TOML grammar in the bundled set |
| INI | `.ini` `.cfg` | Wasm grammar | `key` as `section.name` | Does not read `name: value` lines. Stores the raw text after `=` |
| CSS, SCSS | `.css` `.scss` | Wasm grammar | `selector` for each rule, block at-rule, custom property and Sass variable | Does not resolve the cascade. Does not expand Sass nesting. A name is cut at 120 characters |
| HTML, Svelte, Astro | `.html` `.htm` `.svelte` `.astro` | Wasm grammar | `element` for each element with an `id` or `name`. The symbols of `<script>` blocks. The rules of `<style>` blocks | Skips elements with no identifier. Leaves a non-JavaScript script as text |
| XML | `.xml` `.plist` `.storyboard` `.xib` `.entitlements` | Line scanner | `element` for Android resources, Maven coordinates and Interface Builder scenes. `key` for property list keys | Does not validate. The bundled XML grammar crashes on this runtime, so there is none |
| Gradle | `.gradle` | Line scanner | `task`, and `key` for plugins and dependencies | Does not evaluate Groovy. `.gradle.kts` goes to the depth tier as Kotlin |
| Make | `Makefile`, `.mk` | Line scanner | `task` for each rule | Skips special targets, variables, conditionals and includes |
| Dockerfile | Names ending in `dockerfile` | Wasm grammar | `task` for each build stage | Does not expand variables or follow `COPY --from` |
| CMake | `CMakeLists.txt`, `.cmake` | Wasm grammar | `task` for each target. `function` for `function()` and `macro()` | Does not follow `include()` |
| Bash, PowerShell | `.sh` `.bash` `.ps1` `.psm1` | Wasm grammar | `function` for each function | Does not record calls between functions. Does not follow `source` |

Limits that apply to the whole tier (`structured/shared.ts`):

| Limit | Value | Line |
|---|---|---|
| Characters of body text kept for each section | 5,000 | 21 |
| Deepest key path indexed (key segments only) | 4 | 96 |
| Most key nodes for each file. Shallow keys are kept first | 500 | 101 |
| Most element, selector or task nodes for each file. The first in document order are kept | 500 | 235 |
| Shortest value, with no spaces, treated as a credential | 20 characters | 118 |

Secret rule (`shared.ts` lines 106 to 133):

- The value of a key is left out of its signature and its search text when the
  path matches a credential word, or when the value is long and opaque, or when it
  is a URL with a user name in it.
- The credential words include `token`, `secret`, `password`, `api key`,
  `private`, `access key`, `credential`, `bearer`, `authorization`, and `auth` as a
  whole word.
- The rule covers keys. It does not scan prose in Markdown. The treatment of
  prose secrets is an open operator decision (assessment section 4).
- The rule hides a value from the signature and the search text. A span that
  contains the key still prints its lines with `--source`.

Spans (`shared.ts` lines 10 to 30):

- A span is a range of 1-based inclusive lines in the host file.
- `spanOf` throws on an inverted range, so a wrong range cannot be written.
- A Markdown section ends before the next heading of equal or higher level, so it
  includes its sub-sections. A TOML table and a Dockerfile stage end at their last
  entry.

Edges that the tier adds (`resolve-structured.ts`; `structured/commands.ts`):

| Reference | What names it | Target | Confidence |
|---|---|---|---|
| `key` | A member chain or string in TypeScript, JavaScript or Python that spells a dotted path of two or more segments | The unique `key` node. A path matches as written, or with the file's first segment removed | `inferred` |
| `link` | A relative link in a document, such as `setup.md#install` | The section that the anchor names, else the file | `extracted` |
| `path` | A path that a command names, such as `node scripts/x.mjs` | The file, if exactly one of "beside the file" and "at the repository root" exists | `inferred` |
| `class` | An HTML `class` | The rule whose selector is exactly `.<name>`. A rule in the same page wins | `extracted` in the same file, else `inferred` |
| `script` | `npm run <name>`, `npm test` and similar | The `scripts` key of the nearest `package.json` above the file | `inferred` |

An HTML `src` or stylesheet `href` becomes an `imports` edge. Another `href`
becomes a `references` edge (`structured/html.ts` lines 11 to 13). A name that
matches more than one node gets no edge. A name that matches none gets no edge.
Fenced code in Markdown keeps `contains` edges only. A sample that
calls a function is not a dependency of the real code. Command text is not
interpreted. After a `cd`, nothing in the same text is reported.

### Documents tier

Sources: `structured/documents/` (all files), `src/ingest/fs.ts` line 33,
`src/util/state.ts` lines 191 to 214, `package.json` lines 105 to 108.

Default: on. Turn it off with `graft build --no-documents` or `GRAFT_DOCUMENTS=0`.
The structured tier must also be on. A binary has no lines. Graft converts each
document once into a text rendering. The Markdown scanner then indexes the
rendering.

| Format | Extension | Converter package | Unit | Notes |
|---|---|---|---|---|
| PDF | `.pdf` | `pdfjs-dist` | Page | Reads the text layer in the order the file stores it. A scanned page with no text layer gives an empty page. There is no OCR |
| Word | `.docx` | `fflate` | Heading, and page where Word recorded it | A page starts at each `lastRenderedPageBreak`. A file that no editor laid out gets no page markers. Headers, footers, footnotes, comments, field codes and deleted text are left out |
| OpenDocument text | `.odt` | `fflate` | Heading, and page where LibreOffice recorded it | Notes, annotations, tracked deletions and the generated table of contents are left out |
| EPUB | `.epub` | `fflate` | Chapter, one for each spine item | Does not follow links between chapters. Does not read the navigation document unless the spine lists it |
| PowerPoint | `.pptx` | `fflate` | Slide, in presentation order | Titled by the title placeholder. Speaker notes, layouts and masters are left out |
| OpenDocument slides | `.odp` | `fflate` | Slide | Titled by the title frame |

How the rendering works:

- The rendering is stored at `graft/.graph/docs/<sha256 of the binary>.txt`
  (`cache.ts` lines 28 to 35). The hash is the cache key for both the rendering and
  the extraction.
- Each page, slide or chapter starts with a marker line such as
  `<!-- page 12 -->` (`render.ts` lines 41 and 63 to 66).
- A body line that the Markdown scanner would read as structure gets a leading
  backslash. Document text cannot create a heading by accident (`render.ts`
  lines 43 to 55).
- If the rendering has headings, each heading is a section. If not, each page,
  slide or chapter that holds text is a section (`extract.ts` lines 56 to 100).

Locator:

- Every node keeps the path of the binary. The span is a line range of the
  rendering.
- The signature names the binary, the page or slide, and the rendering, in the
  form `report.pdf (page 3) -> graft/.graph/docs/<hash>.txt:L40-L52`
  (`extract.ts` lines 5 to 8).
- `ask --source` and `grep` look up the rendering by the hash of the binary.
- A DOCX or ODT with no page boundaries has no page marker. The locator names the
  heading. Graft does not estimate pages.

Limits and refusals:

| Limit | Value | Source |
|---|---|---|
| Size of one document | 25,000,000 bytes. `GRAFT_DOCUMENT_MAX_BYTES` overrides it with a positive whole number. A bad value is ignored with a message | `ingest/fs.ts` line 33; `state.ts` lines 202 to 214 |
| Size of one entry inside a zip archive | 200,000,000 bytes after expansion | `documents/zip.ts` line 26 |
| Page, slide or chapter sections for a document with no headings | 500 (`MAX_UNITS_PER_FILE`) | `documents/extract.ts` line 82 |
| Units that `--deep --deep-documents` summarises for each structured file | 40 | `graph/enrich.ts` line 36 |

- The converters load only when a document is converted. If the package is not
  installed, the build skips that document. It prints one warning for each missing
  package, with the count, the fix and `graft build --no-documents`
  (`documents/load.ts` lines 13 to 22; `documents/notices.ts`).
- Document notices are one line for each cause: over the size cap, no text layer, or
  converter not installed. Each line gives the count and the first five file names.
  One affected file keeps the per-file wording (`documents/notices.ts`).
- `package.json` lists `fflate` 0.8.3 and `pdfjs-dist` 5.6.205 as optional
  dependencies. They install unless the user omits optional packages.
- The PDF converter also needs `@napi-rs/canvas`, which pdfjs loads in Node
  (`pdf.ts` lines 50 to 52). A missing canvas package gives a refusal that names
  it.
- A failed conversion is remembered for the same bytes. It does not retry on the
  next query (`cache.ts` lines 68 to 70).
- `--deep` leaves documents alone unless `--deep-documents` is given
  (`enrich.ts` lines 56 to 59).

## 7. How graft reduces token use and cost

Sources: `src/context/savings.ts`, `src/context/price.ts`, `src/claude/tally.ts`,
`src/claude/format.ts`, `src/claude/hooks.ts`, `src/ask/ask.ts`,
`src/ask/index-file.ts`, `src/graph/enrich.ts`, `src/graph/fingerprint.ts`,
`src/graph/extract-cache.ts`.

This section states what the code does and what it computes. It does not claim a
saving. The upstream benchmark claims are in section 7.4, with their source.

### 7.1 Mechanisms

| Mechanism | What it does | Source |
|---|---|---|
| A span instead of a file | `ask --source` prints the span of each hit. A span over 80 lines is cut. The cut ends with a marker that gives the exact range | `ask.ts` lines 100 and 1252 to 1269 |
| Signatures instead of a file | `skeleton` and `graft_file_api` print the signature and span of each definition | `ask.ts` lines 1439 to 1482 |
| The crux excerpt | With `--source` and without `--full`, `ask` prints the stored crux for a hit that has one. An LLM chooses the crux. The prompt asks for about 8 lines and never the whole function. Graft cuts a stored crux at 12 lines | `ask.ts` lines 1276 to 1293; `ai/crux.ts` line 89; `graph/enrich.ts` lines 29 and 345 |
| No crux on a keyless build | A keyless build stores no crux. The same call then prints the full span, up to 80 lines | `ask.ts` lines 1285 to 1291 |
| The lexical index | `build` writes the token counts of each node once. A query reads the counts. It does not split every node's text again. A source comment says the split took about 45% of query time at 32,000 nodes | `ask/index-file.ts` lines 1 to 21 |
| Ranking | Terms weigh by rarity (idf). The body field uses BM25. A test file ranks at 0.35 times its score. A graph re-rank adds up to 0.5 weight for connectivity. A node that the query did not name joins only if it holds at least 0.15 of the top node's graph mass | `ask.ts` lines 206, 252, 415 and 421 |
| Few hits, with a switch hint | The CLI returns 8 hits by default. The MCP tool returns 5. When a lexical result has 3 hits or fewer, the output tells the agent to switch tool. It tells the agent not to re-ask with new wording | `cli.ts` line 690; `mcp/tools.ts` line 163; `ask.ts` lines 1543 to 1550 |
| The hook retrieval pack | Pointers only, three hits at most, 140 characters of snippet. Two gates (section 5) drop weak and repeated packs | `format.ts` lines 96 to 116 and 193 to 209 |
| The session orientation | The first 1,500 bytes of `INDEX.md` and one directive, once for each session | `format.ts` line 211 |
| A refresh that avoids parsing | The probe walks the file set and runs one `stat` for each file. It reads and hashes only files whose size or mtime differ. An unchanged file replays from `extract.json`. A change to the extractor code changes a stamp and empties the cache. The source comments give about 3 ms for 280 files, and about 4.6 ms to parse one file | `graph/fingerprint.ts` lines 1 to 20; `graph/extract-cache.ts` lines 1 to 25 |
| A keyless refresh only | A query rebuilds the structural graph. It never calls an LLM | `graph/refresh.ts` lines 15 to 17 |
| The deep cache by hash | A node keeps its summary and crux when `id` and `body_hash` match and the state is `ready`. A changed body marks the old text `stale`. A call happens only for a stale or pending node, and only when a summariser is present | `graph/enrich.ts` lines 1 to 21 |
| The document cache by hash | The rendering and the extraction both use the sha256 of the binary as the key | `documents/cache.ts` lines 1 to 16 |
| Narrowing before scoring | `--in` filters nodes before scoring. `--only-dir` limits the files indexed | `ask.ts` lines 1222 to 1226; `cli.ts` lines 495 to 511 |
| Visible caps | `grep` stops at 300 hits and says how many it dropped | `search/grep.ts` lines 59 to 79 |

### 7.2 The arithmetic the code performs

Source: `src/context/savings.ts`. Each step names its line.

1. Tokens from characters: `tokens(c) = round(c / 4)` (line 26).
2. Baseline `B`: the sum of `chars` over the distinct files that the answer
   covers. A file node without `chars` is skipped. If no file has a size, graft
   prints no estimate (lines 33 to 54).
3. Pack `P`: `tokens(n)`, where `n` is the length of the rendered text that the
   agent reads (line 115).
4. If `B <= P`, graft prints nothing (line 117). A tiny file gives no line.
5. Otherwise `S = B - P` and `pct = round(S / B * 100)` (lines 118 to 119).
6. The line goes on top of the output, not at the end. A pipe through `head`
   keeps it (lines 143 to 154).

The files that make up `B` differ by command:

| Command or tool | Files in the baseline | Source |
|---|---|---|
| `ask --source`, `graft_find_code` | The files that the hits point into | `ask.ts` lines 1297 to 1314 |
| `ask` without `--source` | None. No estimate is made | `ask.ts` lines 1376 to 1393 |
| `skeleton`, `graft_file_api` | The one file | `ask.ts` line 1467 |
| `grep`, `graft_find_all` | The files of all hit groups | `search/grep.ts` line 218 |
| `callers`, `graft_trace_calls` | The files of the matched symbols and of every resolved edge end | `graph/traverse-cli.ts` lines 80 to 94 |
| `map`, `graft_repo_map` | Every file in the graph | `graph/map.ts` line 283 |

Worked example. The numbers are an illustration, not a measurement.

- A file has 24,000 characters. `B = 24,000 / 4 = 6,000`.
- Its skeleton output has 960 characters. `P = 960 / 4 = 240`.
- `S = 6,000 - 240 = 5,760`. `pct = 5,760 / 6,000 = 96%`.
- A file of 400 characters gives `B = 100`. An output of 600 characters gives
  `P = 150`. Then `B <= P`, and graft prints no line.

The hook pack is different. `retrievalTokensSaved` (`format.ts` lines 119 to 125)
returns 0 when the result has no `saved` field. `ask` sets that field only with
`--source`, and the prompt hook does not pass `--source`. So the per-prompt pack
claims no saving.

### 7.3 From tokens to dollars

Sources: `src/context/price.ts`, `src/claude/tally.ts`, `src/claude/hooks.ts`
lines 332 to 346, `src/claude/session-metrics.ts` line 178,
`src/context/savings.ts` lines 56 to 106.

Graft prices a saved token at the rate that the session pays. It does not use a
list price alone. The steps:

1. At the end of each turn, the Stop hook reads the turn from the transcript. It
   costs each API response once. It identifies a response by `message.id`,
   because one response appears on several transcript lines
   (`tally.ts` lines 161 to 204).
2. Weighted input: `W = input + 1.25 * cacheCreate + 0.1 * cacheRead`
   (`price.ts` lines 47 to 51 and 61 to 65).
3. Turn cost in micro-dollars: `round(W * listRate)`, where `listRate` is the
   input rate of the model in dollars per million tokens. The table has five
   model-family patterns (`price.ts` lines 19 to 25). Output tokens are ignored,
   because a saved token is context that the agent would have read.
4. Tokens billed: `T = input + cacheCreate + cacheRead` (lines 70 to 72).
5. The session keeps the running sums `cost` and `T`. The blended rate is
   `r = cost / T`. A micro-dollar for each token equals a dollar for each million
   tokens (`session-metrics.ts` lines 178 to 185).
6. Dollars saved: `S * r / 1,000,000` (`price.ts` lines 82 to 92).
7. The result is null when no turn has been billed, when `S` is 0 or less, or when
   the model has no price. A null result shows tokens only. A response from a model
   with no price adds neither cost nor tokens, so it cannot lower the rate
   (`tally.ts` lines 195 to 199).
8. Format: `<$0.01` below one cent. Otherwise two decimals (`price.ts` lines 97
   to 100).

Worked example. The rate `L` is a symbol, not a vendor price.

- One turn has 10,000 fresh input tokens, 100,000 cache-read tokens, and none
  written to the cache.
- `W = 10,000 + 0.1 * 100,000 = 20,000`. `T = 110,000`.
- `r = 20,000 * L / 110,000 = 0.18 * L`. A cache-heavy session pays about 18% of
  the list rate for each token.
- With `S = 5,760` and the arbitrary rate `L = 3`: `r = 0.545` dollars per million
  tokens. `S * r / 1,000,000 = 0.0031`. The display is `<$0.01`.

Where the rate appears:

- The CLI `noteQuery` and the MCP `callTool` set the rate before they format the
  answer (`cli.ts` lines 123 to 129; `mcp/tools.ts` line 230).
- The savings line then carries a nudge that states the call's dollar value. It
  asks the agent to tell the user the total at the end of its reply
  (`savings.ts` lines 91 to 106).
- The statusline shows the session total and its dollar value
  (`format.ts` lines 35 to 43).
- The Stop hook measures whether the reply carried a tally. The ratio is the
  count of reported turns over the count of graft turns. A turn that the hook
  cannot observe counts in neither number (`hooks.ts` lines 348 to 378).
- `graft stats` prints the share of graft reads against source reads:
  `round(graft / (graft + source) * 100)` (`session-metrics.ts` lines 187 to 196).

### 7.4 Limits of the estimate

- The estimate is a ratio of characters. No tokeniser is used.
- The baseline assumes the agent would read each covered file whole. The code
  cannot know what the agent would have done.
- The depth tier stores the string length in `chars`. The other tiers store the
  byte length. The two differ for text that is not ASCII.
- A saving is claimed only where the output is a substitute for the files.
  The hook pack and `ask` without `--source` claim none.
- No harness in this repository measures retrieval quality. The assessment says so
  (section 3). A saving in tokens does not prove an answer was as good.
- Graft also adds cost. On this machine, startup took 6.3 s in the assessment.
  A query that had to rebuild took 65 s (assessment section 8). The MCP tool
  schemas use context on every turn (`mcp/server.ts` lines 41 to 49).
- A `--deep` build spends tokens. It prints a `tokens:` line. A keyless build
  spends none.

### 7.5 Upstream's benchmark claims

Source: `README.md`. These are upstream's claims. This fork has not reproduced
them. Upstream ran them on its own version, models and harness.

| README section (lines) | Setup | Reported result |
|---|---|---|
| Benchmark (163 to 179) | 162 runs, two repositories, 3 trials, a cold agent against an agent with graft | Tokens 8,070 to 4,650 (+42%). Cost 0.0429 to 0.0292 (+32%). Tool calls 4.2 to 2.3 (+46%). Latency 39.8 s to 15.8 s (+60%). Correctness 93% for both |
| SWE-bench Verified (183 to 202) | 50 instances, one model on both arms | Correctness 27 of 50 to 33 of 50. Tokens 142.0M to 109.4M (+23%). Cost $52.34 to $42.43 (+19%). Tool calls 1,370 to 1,031 (+25%) |

The README headline (line 23) says "Up to 4× cheaper and 3× faster". The cost row
above gives 0.0429 divided by 0.0292, which is 1.47. Treat the tables as the
claim, not the headline.

## 8. Keeping this document current

This document describes code that changes. A section is current only if its
sources have not changed since the "Last verified" date.

### Source map

| Section | Derived from | Command that lists the facts |
|---|---|---|
| 1 Project state | `package.json`, git, `docs/assessment-*.md`, `docs/handoffs/`, `CHANGELOG.md` | `node -p "require('./package.json').version"`; `git log --oneline -1`; `git fetch upstream` then `git rev-list --count main..upstream/main`; `graft --version`; `grep -rn "tests, " docs/handoffs` |
| 2 Terms and files | `src/graph/types.ts`, `src/graph/relations.ts`, `src/graph/build.ts`, `src/graph/extract-cache.ts`, `src/context/node-file.ts` | `grep -n "export type" src/graph/types.ts`; `grep -rn "CACHE_DIR\|GRAPH_DIR\|\.cache/" src` |
| 3 CLI | `src/cli.ts`, `src/legacy-args.ts` | `grep -n '\.command("' src/cli.ts`; `grep -n '\.option(' src/cli.ts`; `grep -n '\.argument(' src/cli.ts`; `node dist/cli.js <command> --help` |
| 4 MCP | `src/mcp/tools.ts`, `tool-names.ts`, `instructions.ts`, `server.ts` | `grep -n "name: 'graft_" src/mcp/tools.ts`; `grep -n "GRAFT_MCP_TOOL" src/mcp/tool-names.ts`; `grep -n "case '" src/mcp/server.ts` |
| 5 Claude Code and hosts | `src/claude/settings-merge.ts`, `hooks.ts`, `format.ts`, `statusline.ts`, `init.ts`, `skill-template.ts`, `src/hosts/*.ts` | `grep -n "timeout:" src/claude/settings-merge.ts src/hosts/codex-hooks.ts`; `grep -n "event ===" src/claude/hooks.ts`; `grep -n "id: '" src/hosts/registry.ts`; `grep -n "case '" src/hosts/mcp-config.ts` |
| 6 File types | `src/graph/extract.ts`, `generic.ts`, `container.ts`, `structured/index.ts`, `structured/shared.ts`, `structured/documents/`, `src/ingest/fs.ts`, `src/graph/source-files.ts`, `src/graph/resolve*.ts` | `grep -n 'ext: "' src/graph/extract.ts`; `grep -n 'exts:' src/graph/generic.ts src/graph/container.ts src/graph/structured/index.ts`; `grep -n 'FORMAT_BY_EXTENSION' -A 8 src/graph/structured/documents/index.ts`; `grep -n "MAX_\|MIN_OPAQUE" src/graph/structured/shared.ts src/ingest/fs.ts src/graph/extract.ts`; `ls src/graph/queries` |
| 7 Token and cost | `src/context/savings.ts`, `price.ts`, `src/claude/tally.ts`, `src/ask/ask.ts`, `src/graph/enrich.ts`, `README.md` | `grep -rn "toTokens\|savingsFor\|withSavings" src`; `grep -n "MULTIPLIER" src/context/price.ts`; `grep -n "^## Benchmark\|^## SWE-bench" README.md` |

### Procedure

1. Before a change merges, find which source files the change touches. Match
   them against the middle column. Edit each matching section in the same commit.
2. Run the listing command for each edited section. Compare its output with the
   tables. Add, remove and rename rows to match.
3. Re-check every line number that you cite. Run `grep -n` on the symbol.
4. Set the "Last verified" line to the date and the commit.
5. Run the two prose checks below. Both must print nothing.
6. After the upstream merge (Stage 17), re-verify sections 1, 3, 4 and 5. The
   merge changes `cli.ts`, `build.ts`, `extract.ts` and `mcp-config.ts`.
7. A new CLI command, MCP tool, host or tier needs a row here, a `CHANGELOG.md`
   entry, and a README update (`AGENTS.md`, rule 8).

Counts to check on each pass: the CLI has 28 `.command(` entries. The MCP server
has 6 tools. The breadth registry has 15 rows, of which 14 take effect.

Prose checks, from the repository root. Each must print nothing. The first
pattern hides one letter of each banned word in a bracket, so the command does
not match its own text. The word list is `ENGINEERING_PERSONA.md` section 14.1.

```
grep -n -i -E "d[e]lve|nuanc[e]d|tapest[r]y|rob[u]st|multifac[e]ted|landsc[a]pe|worth n[o]ting|important to n[o]te|genu[i]nely|tru[l]y|abso[l]utely" docs/architecture/system-reference.md
grep -n $'\xe2\x80\x94' docs/architecture/system-reference.md
```

## 9. Source disagreements and unverified facts

### Where the source and another document disagree

The source is right in each case.

| Item | The other document says | The source says |
|---|---|---|
| Statusline content | README line 412: graph size, "% enriched" and a stale warning | `format.ts` lines 27 to 56: node and edge counts, freshness, tokens saved with dollars, context percent, last file. No enrichment percent |
| Codex hooks | README lines 383 and 406: one `PostToolUse` entry that matches `Write\|Edit\|MultiEdit` | `codex-hooks.ts` lines 51 to 59: four events, and the edit matcher also holds `apply_patch` |
| CLI list | The upstream README CLI block omits `stats` and `telemetry` | `cli.ts` defines both |
| Dot-paths | A comment in `structured/index.ts` lines 51 to 53 says dot-directories are never walked | `ingest/fs.ts` line 52 admits `.github/workflows` for `.yml` and `.yaml` files |
| Crux size | The `ask --full` help text and the skill call the crux an excerpt of 8 lines or fewer | The prompt asks for about 8 lines. `enrich.ts` line 29 allows 12 |
| MCP tool count | `instructions.ts` lists five tools | `tool-names.ts` lists six. `graft mcp` help says six |
| `graft_trace_calls` depth | The tool schema accepts `"all"` | At a workspace root, `tools.ts` line 175 reads a number only |
| Deep-pass concurrency default | `cli.ts` line 453: the `-j` help text says "default 5" | `cli.ts` line 546 passes nothing when `-j` is absent. `context/build.ts` line 200 then uses 8 for the file pass. `graph/enrich.ts` line 39 uses 5 for the symbol pass. Found by Stage 15c |

Gate counts and the upstream distance differ between documents by date, not by
fact. Each was right on its date. Section 1 holds the values after the Stage 17
merge on 2026-10-21.

### Not verified in this stage

This stage used file reads only. It ran no command, no build and no network
call.

- Stage 17 re-ran the global install version, the test counts, the upstream
  commit distance and the section 1 timings on 2026-10-21. The open pull-request
  count comes from the assessment and was not re-run.
- The timings in section 7.4 come from assessment section 8. They were not
  re-measured.
- The upstream benchmark figures were not reproduced.
- `src/telemetry/`, `src/app/`, `src/blast/`, `src/viz/` and upstream's
  learnings and workspace modules (`src/notes/`, `src/cloud/`) were read at the
  command definition and the module header only.
- The node kinds of the R extractor, the Go type resolution and the per-language
  rules for `references` edges were not traced through the walker. The tables use
  the kind maps and the header comments in `extract.ts`.
- Whether a Markdown fence tag parses depends on `languageOf` for the tag as an
  extension. This stage read the map in `markdown.ts` lines 129 to 143 and did not
  test it.
- The price table values are not copied here. They change with vendor
  announcements. Read `src/context/price.ts` lines 19 to 25.
- The hook budgets are the values that `graft init` writes. A repository wired by
  an older version may carry other values. `promptAskTimeout` reads the installed
  value at run time.
- The post-edit hook counts stale nodes with `graft check . --json` as a child
  process (`hooks.ts` line 170). Under the trail brand the child inherits the brand,
  and `check` is then the team check. Its JSON has no `graph` key, so the count is
  0. This was read from the source and not run.
