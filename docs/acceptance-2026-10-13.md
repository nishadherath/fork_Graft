# Acceptance of Stages 1 to 5: the structured and documents tiers

Stage 6 of `docs/plan-file-type-indexing-2026-10-13.md`, run on 2026-10-13 by a
Fable 5.1 (high) session against the five pull-request branches at the tips the
Stage 5 audit recorded. Each branch was tested in its own `git worktree`; no
branch was checked out in the main tree, no `src/` or `test/` file on a `pr/`
branch was edited, and nothing was pushed. The scripts that produced every
number below are in `docs/acceptance/2026-10-13/`.

## 1. Conclusion

The tiers hold on the cases the plan names. Every unit of every family starts on
the line the fixture was written with and, with one exception in YAML (finding
1), ends on the right line too; `--source` prints those lines verbatim,
the documents cap refuses a 50 MB PDF and obeys its override, the 500-key cap
keeps the shallowest keys, the secret rule hides what it promises to hide, the
workflow admit indexes exactly the YAML under `.github/workflows/`, and the
concept pass lists exactly the files the tier claims. The gates are green on all
five branches when run one at a time.

Four findings need a fix before the core and edges pull requests open. The
first is inside case 1's criterion and the third inside case 8's; the second
came from a heading form added beyond the case's list, and the fourth is the
README line Stage 5 reported:

1. A YAML mapping's span runs past its last entry to a following comment line.
2. The Markdown scanner emits a section for a `#` line inside a raw HTML block.
3. The concept pass's file list omits `.github/workflows/` even when the tier is on.
4. The README's `--no-structured` line still reads "(the default)" on every branch.

Three further gaps in the secret rule are listed for a decision (section 6),
and the documents gate figure is settled: 1,517 tests, which is the Stage 4
handoff's number, not the commit message's.

## 2. Method

Branch tips re-checked with `git rev-parse` before testing; all five matched
the Stage 5 table (`4748b34`, `4298acb`, `77eb591`, `e6f30cc`, `3aa52c1`;
`upstream/main` at `fe30ead`). The path audit
(`git log upstream/main..<branch> --name-only`) also matched: only
`pr/documents-tier` touches a file outside `src/`, `test/`, `CHANGELOG.md`,
`README.md` and `CREDITS.md`, namely `package.json` and `package-lock.json`.

Worktrees: `git worktree add ../fork_graft-accept-<name> <branch>` for crux,
core, markup, edges and docs. Install per worktree: `npm ci --ignore-scripts`,
then `node_modules/tree-sitter-kotlin/build/Release` copied from the global
install (protocol section 10). Gate: `npm run build && npm test` on Node 26.7.0
(`run.sh`, then `sequential.sh`).

Fixture: `node make-fixtures.mjs D:\Code\Claude\fork_graft-accept-fx\fx --huge`
writes a repository with one file per family whose line numbers are known
(the script comments each line with its number), the heading-forms file, the
secrets directory, the 10,110-key JSON, the `.github` tree, a two-page PDF and
a 50,000,691-byte PDF; then `git init`. Builds used each worktree's own
`dist/cli.js`, so the branch under test is the code that ran. Node spans were
read from `graft/.graph/wiring.json` with `dump-nodes.mjs` and compared by hand
with the fixture's line numbers.

## 3. Gates

One `npm test` at a time. A first attempt ran the five suites in parallel and
failed 9 to 12 tests on every branch, all timeouts in `test/mcp-server.test.ts`,
the workspace query tests and `blast`, with CLI tests taking two minutes each;
the MCP file alone passes in 14 seconds, and the sequential runs below are the
gate. Counts are from the test runner's summary lines.

| Branch | Tip | Build | Tests | Pass | Fail | Skipped | Shell |
|---|---|---|---|---|---|---|---|
| `pr/crux-id-echo` | `4748b34` | exit 0 | 1,359 | 1,354 | 0 | 5 | npm, 230 s |
| `pr/structured-tier-core` | `4298acb` | exit 0 | 1,425 | 1,420 | 0 | 5 | npm, 230 s |
| `pr/structured-tier-markup-build` | `77eb591` | exit 0 | 1,474 | 1,469 | 0 | 5 | npm, 218 s |
| `pr/structured-edges` | `e6f30cc` | exit 0 | 1,500 | 1,495 | 0 | 5 | npm, 247 s |
| `pr/documents-tier` | `3aa52c1` | exit 0 | 1,517 | 1,512 | 0 | 5 | `cmd /c "npm run build && npm test"`, 265 s |

Every branch counts about 30 more tests than its commit message quotes (crux
1,329 in the message against 1,359 here, and so on up the stack). The delta is
the same on the crux branch, which changes one source file and no lockfile, so
it is the installed `node_modules` of a fresh `npm ci` of each branch's
lockfile, not the branches. The documents figure to quote in
`docs/upstream/pr-documents-tier.md` is the one in the table.

## 4. Cases

### Case 1: span exactness, every family

Build: `node <docs-worktree>/dist/cli.js build --structured --documents .` in
the fixture (691 nodes, 664 edges, 33 cards, 19 languages). Then
`node dump-nodes.mjs . <prefix>` per family. Every node below is at the lines
the fixture was written with.

| Family | File | Units checked (span) |
|---|---|---|
| Markdown | `docs/guide.md` | front matter keys `title` L2, `version` L3; sections Install L7-L22, Windows L11-L18, Paths L15-L18, Linux L19-L22, Usage L23-L33; fenced `function sample()` L28-L30 |
| JSON | `cfg/app.json` | `server` L3-L14, `server.tls.ciphers.weak` L9-L11 (depth 4 kept, depth 5 dropped), `files[0]: first` L16 |
| YAML | `cfg/app.yaml` | `server.port` L3, `server.hosts[0]` L5-L6, `logging.level` L11; see finding 1 for `server` L2-L9 |
| TOML | `cfg/app.toml` | `server` L3-L8 (stops at its last entry, not the comment at L10), `server.tls` L11-L12, `plugins[0]: auth` L14-L16, `plugins[1]: cache` L18-L19 |
| INI | `cfg/app.ini` | `core` L1-L2, `["remote \"origin\""]` L5-L7, `.url` L6, `.fetch` L7 |
| CSS, SCSS | `web/site.css`, `web/site.scss` | `:root` L1-L3, `--brand` L2, `.btn, .btn-primary` L5-L8, `@media (min-width: 600px)` L10-L14, nested `.btn` L11-L13, `@keyframes spin` L16-L19; `$accent` L1, `.card` L3-L8, `&:hover` L5-L7 |
| HTML, Svelte, Astro | `web/index.html`, `web/App.svelte`, `web/Page.astro` | `#main` rule L6, `div#main` L11-L16, `form[name=login]` L12-L15, void `input#user` L13, `button#go` L14, `function greet()` L18-L20; `shout` L3-L5, `main#root` L8-L10, `h1#title` L9, `#title` L13; `count` L3-L5, `section#list` L7-L9, `ul#items` L8 |
| XML, plist, pom | `xml/*` | `application[name=.App]` L4-L10, `activity` L5-L9, `action` L7; `CFBundleName = Demo` L5-L6, `Nested` L7-L11, `Nested.Inner = true` L9-L10; `parent:org.example:parent` L3-L7, `dependency:junit:junit` L9-L13 |
| Gradle | `tooling/build.gradle` | `plugins` L1-L4, `plugins.java` L2, `dependencies["implementation org.x:y"]` L7, task `hello` L10-L14, task `clean2` L16-L18 |
| Make, CMake, Dockerfile | `tooling/*` | `all` L3, `build` L5-L6, `main.o` L8-L9, `clean` L12-L13; `function(add_demo)` L4-L6, `core` L8, `app` L9-L11, `smoke` L12; stage `deps` L1-L4, `runtime` L7-L9 (the comment at L6 is not claimed) |
| Bash, PowerShell | `tooling/run.sh`, `tooling/run.ps1` | `greet` L4-L6, `farewell` L8-L10; `Get-Greeting` L3-L6 |
| PDF | `docs/manual.pdf` | rendering `graft/.graph/docs/<sha256>.txt` of 7 lines; `page 1` L1-L3, `page 2` L5-L7 of the rendering; file signature names the rendering and `(2 pages)` |

`--source`: `graft ask "Windows nvm4w" --source` printed `docs/guide.md:L11-L18`
and the eight lines `sed -n 11,18p docs/guide.md` prints; `graft ask "server tls
ciphers" --source` printed `cfg/app.json:L7-L12` with the six lines of the
object; `graft ask "Chapter Two second page" --source` printed the rendering's
path with `:L5-L7`, the locator
`manual.pdf (page 2) -> graft/.graph/docs/<hash>.txt:L5-L7`, and the three
rendering lines including the `<!-- page 2 -->` marker.

Per branch: the same fixture built with the core worktree's CLI gives the
Markdown, JSON, YAML, TOML and INI spans above and nothing for the other
families (16 files, no `.github` admit, as that branch documents); built with
the markup worktree's CLI it gives every span above except the PDF (32 files).
The edges and documents worktrees add edges and the PDF without moving a span.

Cosmetic: the CMake `add_test` signature reads `add_test(NAME smoke COMMAND)`,
dropping the last argument `app`; the span is right. Held.

### Case 2: Windows paths

The fixture lives at `D:\Code\Claude\fork_graft-accept-fx\fx`; a copy at
`D:\Code\Claude\fork_graft-accept-fx\fx with space` (without the 50 MB PDF)
was built the same way. `node compare-builds.mjs fx "fx with space" pdf/`: 691
nodes and 664 edges in each; the (id, kind, span, signature) sets are identical;
no node path, id or span holds a backslash. The three ids that contain one are
the INI keys `cfg/app.ini#key:["remote \"origin\""]` and its two children, where
the backslash is JSON quoting of the double quote inside the section name, the
same on both paths. The documents branch gate ran through
`cmd /c "npm run build && npm test"` (section 3), which also covers
`scripts/run-tests.mjs` under cmd.exe. Held.

### Case 3: a 50 MB PDF and the cap

`pdf/huge.pdf` is a valid one-page PDF of 50,000,691 bytes (a padding stream
after the page). Default build: the graph has no node for it and the build
prints one line,
`⚠ pdf/huge.pdf: skipped, 50000691 bytes is over the documents tier's cap of 25000000 bytes (GRAFT_DOCUMENT_MAX_BYTES)`.
`GRAFT_DOCUMENT_MAX_BYTES=60000000 graft build --structured --documents`: the
PDF is converted (pdfjs reads the whole file), its rendering appears under
`graft/.graph/docs/`, and the graph gains `pdf/huge.pdf` with `page-1` at
L1-L3 of the rendering; 31 seconds for that one file with the parallel test
suites still running. `GRAFT_DOCUMENT_MAX_BYTES=500`: both PDFs are refused,
each with its own line, and `docs/manual.pdf` leaves the graph (32 files).
`GRAFT_DOCUMENT_MAX_BYTES=abc`: one line,
`⚠ GRAFT_DOCUMENT_MAX_BYTES="abc" ignored: expected a positive whole number of bytes, using 25000000`,
and the default applies. Held.

### Case 4: a 10,000-key JSON

`big/keys.json`: 10 keys at depth 1, 100 at depth 2, 1,000 at depth 3 and 9,000
at depth 4 (10,110 keys, 11,222 lines, 202,944 bytes). The build keeps 500
keys: all 10 of depth 1, all 100 of depth 2 and the first 390 of depth 3 in
document order (`a0.b0.c0` to `a3.b8.c9`), none of depth 4. `deep/deep.json`
with six nested levels keeps `l1` to `l1.l2.l3.l4` and drops the fifth. The
file's card `graft/big/keys.md` is 22,102 bytes; `graft/.graph/wiring.json`
for the whole fixture is 393,022 bytes. Build time for the whole fixture
(33 files, the 10,110-key file included) on a quiet machine:
`graft build --structured --documents --no-reuse` 2.9 seconds, a cached rebuild
1.9 seconds; the same build took 49 seconds while five test suites ran beside
it. Held.

### Case 5: secrets in configuration

Planted values and where they appear after the build (`grep -r -F <value>
graft/` over the cards, the graph, the extract cache and the ask index):

| Planted | Key or file | In any output |
|---|---|---|
| `SHORTKEY01`, `hunter2pw`, `tok_abc123` | `api_key`, `password`, `token` (JSON) | no |
| 56-character base64 blob | `innocent` (JSON, value only) | no |
| `wJalrXUtnFEMI/...` | `secret_access_key` (JSON) | no |
| `-----BEGIN PRIVATE KEY-----...` | `private_key` (JSON) | no |
| `dbpass99`, `urlpass77` | `db.passwd`, `db.url` (33-character URL) | no |
| `ghp_...`, `smtppw55`, `clientsecret44` | `github_token`, `smtp_password`, `oauth.client_secret` (YAML) | no |
| `tomlkey66`, `tomlsecret77` | `auth.api-key`, `auth.secret` (TOML) | no |
| `inipass88` | `db.password` (INI) | no |
| `PEMBODY11`, `KEYBODY22` | `server.pem`, `server.key` | no (not indexed) |
| `envpass33`, `envtoken44` | `secrets/.env` | no (dot-file, never walked) |
| `LOCKNAME55`, `LOCKPKG66` | `package-lock.json`, `pnpm-lock.yaml` | no (not indexed) |
| `pkid77` | `private_key_id` (JSON) | no |
| `AKIAIOSFODNN7EXAMPLE` | `aws_access_key_id` (JSON, 20 characters) | yes: signature, card, graph |
| `abcdefghijklmnopqrstuvwxyz012345` | `exactly32` (32 characters) | yes: signature, card, graph, ask index |
| `Basic dXNlcjpwYXNz` | `auth` (JSON, has a space) | yes: signature, card, graph |
| `PROSETOKEN88` | prose in `secrets/notes.md` | yes: extract cache only (section body text) |

The rule as written (a name matching token, secret, password, api key or
private; or a value longer than 32 characters with no whitespace) held in every
case. The three `yes` rows are outside the rule: a name containing `access_key`
but not `api_key`, a value exactly at the length boundary, and a header value
with a space. Prose is indexed as prose. Held as specified; see section 6 for
whether to widen the rule.

### Case 6: every CommonMark heading form

`headings/forms.md`, 54 lines, sections as emitted (expected per CommonMark in
brackets where they differ):

| Line | Form | Result |
|---|---|---|
| 1 | setext `=` | `Title Setext One`, L1-L8, level 1 |
| 6 | setext `-` | `Title Setext Two`, L6-L8, level 2 |
| 9 | ATX | `ATX Plain`, L9-L37 |
| 11 | ATX with closing `##` | `ATX Closed`, L11-L37; closing run stripped |
| 13 | ATX with trailing spaces | `ATX Trailing Spaces`, L13-L37; trimmed |
| 15 | ATX closed, trailing spaces | `ATX Closed Trailing`, L15-L37 |
| 18 | `#` inside a backtick fence | no section (correct) |
| 22 | `##` inside a tilde fence | no section (correct) |
| 25 | `> # Quoted Heading` | no section [CommonMark: a heading inside the quote]; the scanner's header documents this choice, and the quote stays inside `ATX Closed Trailing` |
| 28, 30 | `#####`, `######` | `Five` L28-L37, `Six` L30-L37 |
| 32 | seven `#` | no section (correct) |
| 34 | `#NoSpace` | no section (correct) |
| 36 | four-space indented `#` | no section (correct) |
| 38 to 40 | two-line paragraph then `===` | `Multi line setext second line`, L38-L44, from the paragraph's first line |
| 42 | `- # In a list item` | no section [CommonMark: a heading inside the item]; documented choice |
| 45 | `# Inside an HTML block` between `<div>` and `</div>` | section `Inside an HTML block` L45-L49 [CommonMark: raw HTML, no heading]. Finding 2 |
| 48 | `\# Escaped hash` | no section (correct) |
| 50 | `#` then a tab | `Tab After Hash`, L50-L51 |
| 52 | `# ` with no text | no node, but a boundary: lines 52 to 54 belong to no section |

Every emitted section starts on its heading's real line and ends on the line
before the next heading of its level or higher, including the two documented
omissions, whose text lengthens the section above. The one wrong locator is
the HTML-block line, which also cuts the setext section short at L44 instead of
L54. Held except for finding 2.

### Case 7: the workflow admit (D7)

`.github/` in the fixture holds `workflows/ci.yml`, `workflows/sub/nested.yml`,
`workflows/notes.md`, `workflows/.hidden.yml`, `dependabot.yml`,
`ISSUE_TEMPLATE/bug.yml`, `CODEOWNERS` and `FUNDING.yml`. With the tier on,
in a Git repository and in a plain directory alike, the graph holds exactly
`ci.yml` (six keys, `jobs.verify.runs-on = ubuntu-latest` at L5) and
`sub/nested.yml`; nothing else under `.github/` has a node. With the tier off
(`graft build` in a fresh copy) nothing under `.github/` is indexed. On the
core branch, which predates D7, nothing under `.github/` is indexed with the
tier on, as its pull-request text says. Held.

### Case 8: the concept pass and `--deep`

`node deep-count.mjs <docs-worktree>/dist <fixture>` calls the concept pass's
own file list (`listContextFiles`) and the per-node pass (`enrichGraph`) with a
counting stand-in for the model; nothing leaves the machine.

- Concept pass, tier off: 2 files (`src/app.ts`, `tooling/run.sh`).
- Concept pass, tier on: 30 files, one summary call each in phase 1; the
  lockfiles are absent; `docs/manual.pdf` is absent (documents never enter the
  concept pass, as designed). `.github/workflows/ci.yml` and `sub/nested.yml` are
  absent although the build indexed them: finding 3.
- Concept pass, `--extensions .md`: exactly 3 files, the three Markdown files.
- Per-node pass: 32 summary calls (one per file) sending 228 units;
  `big/keys.json` sends its file node and its first 40 keys by line (41 nodes in
  the call), the other 460 keys stay `pending` with no error. With
  `--deep-documents`: 33 calls, `docs/manual.pdf` sends 3 units (file and two
  pages).
- `graft build --deep --deep-documents` with no key in the environment prints
  a warning that no API key is set, falls back to the structural build and
  builds the same 691-node graph; no network call is made.

Held, with finding 3.

### Extra: edges

In the fixture as generated, `cfg.server.port` in `src/app.ts` produces no
edge because `server.port` exists in three files, and `button class="btn"`
produces none because `.btn` has two rules; both are the documented ambiguity
rule. With unambiguous targets (`cfg.server.tls.ciphers.strong`,
`cfg.logging.level`, the string `"docs/guide.md#install"`), the build adds
`references` edges from `src/app.ts` to the JSON key, the YAML key and the
section. A bare string `"Install"` adds none. The Markdown link edges, the
HTML stylesheet import, the Dockerfile `COPY package.json` reference and the
workflow step's `npm test` edge to `package.json#key:scripts.test` all appear.
Not a plan case; recorded because the edges text makes the claims.

## 5. Findings (not fixed in this stage)

1. **YAML span claims a following comment line.** Branch `pr/structured-tier-core`,
   `src/graph/structured/yaml.ts`. Probe `probe.yaml` (12 lines): mapping `b`
   ends at line 8, its node spans L5-L10, taking the blank line 9 and the
   `# gap comment` at line 10 that introduces `c`; in the fixture `server`
   spans L2-L9 for a mapping that ends at L8. The start line is right; the end
   line is a comment that belongs to the next key, so `--source` prints it.
   The TOML scanner avoids exactly this. Fix: trim trailing blank and comment
   rows from a block node's end row before `emitKeys`, with the probe as the
   test. Low severity, every YAML file with comments between top-level keys.
2. **A `#` line inside a raw HTML block becomes a section.** Branch
   `pr/structured-tier-core`, `src/graph/structured/markdown.ts`. CommonMark
   treats `<div>` to the next blank line as an HTML block; the scanner has no
   HTML-block state and matches the ATX pattern. An invented section is the
   wrong locator the scanner's own header says it must not produce, and it
   ends the section above early. Fix: on a line that opens an HTML block (a
   `<` followed by a block tag name, or a comment, which it already handles),
   set `para = -1` and skip heading checks until the next blank line. Low
   severity, rare in real documents.
3. **The concept pass walks without the workflow admit.** Branch
   `pr/structured-edges`, `src/context/build.ts` `listContextFiles`: it calls
   `walkDir` with the follow options only, not `sourceWalkOptions`, so
   `.github/workflows/*.yml` is indexed by the build but never summarised, and a
   repository with the documents tier on would also walk with the 1 MB cap
   (harmless, documents are excluded by extension anyway). Fix: pass
   `sourceWalkOptions(root)` and extend `test/structured-deep.test.ts` with a
   workflow file. Low severity, cost-neutral (two more files summarised).
4. **README `--no-structured` line.** Every branch from core up:
   `graft build --no-structured   # ... persist that choice (the default)` at
   README line 379 (core), 385 (markup), 395 (edges), 415 (docs). The tier is
   off unless enabled. Fix on `pr/structured-tier-core`, then rebase the
   three branches above it (Stage 5 finding 1, confirmed).

Confirmed as designed, no action: headings inside block quotes and list items
are not sections (documented in `markdown.ts`); prose in Markdown is indexed as
body text; `.env` is excluded by the dot-file rule rather than by the
denylist; nested directories under `.github/workflows/` are admitted; the
`add_test` signature drops its last argument.

## 6. Decisions for the operator

```
Decision:      widen the secret rule (finding rows that leaked in case 5)
Options:       A keep the rule as shipped (name list plus 33-character opaque value)
               B add `access[_-]?key`, `auth`, `credential`, `bearer` to the name
                 pattern and lower the opaque threshold to 20 characters
               C B, and never show a value that parses as a URL with userinfo
Pros and cons: A matches the pull-request text exactly; leaks AWS access key ids
                 and short basic-auth headers
               B hides those; `auth` also hides harmless values such as
                 `auth = oidc`
               C also hides connection strings under 33 characters; one more
                 regex, one more test
Blast radius:  B and C change signatures of a few keys per repo; nothing else
Recommended:   C, on pr/structured-tier-core with a test per planted value,
               before the core pull request opens; the text's "a key whose
               name suggests a credential" then stays true
```

```
Decision:      findings 1 to 3 go on their branches before the pull requests open
Options:       A fix now on core (1, 2) and edges (3), rebase the stack, re-gate
               B open the pull requests as they are and fix in review
Pros and cons: A one Sonnet session, four small edits with tests, the stack
                 rebased once together with the README line (finding 4)
               B faster to open; reviewers find a wrong locator in the first
                 YAML file with comments they try
Blast radius:  A touches four source files and three tests; the rebase rewrites
                 the three upper branches' hashes (nothing is pushed yet)
Recommended:   A, as Stage 7 (handoff written)
```

Standing items, unchanged by this stage: the AGENTS.md rule 3 exception for
`package.json` and `package-lock.json` on `pr/documents-tier` (operator), and
D4 option A (decided).

## 7. Claims in `docs/upstream/` checked

- Core text: keys four levels deep, 500 per file, shallowest first: held
  (case 4). Secret rule: held as worded (case 5). Lockfiles never indexed:
  held. Dot-files and dot-directories not walked: held on core. Gate figure:
  see section 3.
- Markup text: every family and its unit: held (case 1). Workflow YAML admitted
  and nothing else behind a dot: held (case 7). `.pem`, `.key` and `.env` never
  indexed: held. Gate figure: see section 3.
- Edges text: code to key, Markdown links, HTML `href`, commands, ambiguity:
  held (extra). Concept pass reads structured files, never a lockfile,
  `--extensions` exact: held except workflows (finding 3). Forty units per
  structured file: held (41 nodes including the file node). Gate figure: see
  section 3.
- Documents text: rendering per hash, page markers, section per page when
  there are no headings, locator form, cap and override with one warning line,
  bad cap value named, `--deep-documents` per run and bounded: held (cases 1,
  3, 8). Gate figure: 1,517, not 1,489; the text must change.
- Crux text: the gate is the acceptance; see section 3.
