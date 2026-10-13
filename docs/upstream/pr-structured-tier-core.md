# Pull request: structured tier core (base `upstream/main`)

> Operator note (not part of the text). Branch `pr/structured-tier-core`, seven commits, tip `4298acb`. Changed paths: `CHANGELOG.md`, `README.md`, `src/cli.ts`, `src/graph/build.ts`, `src/graph/cards.ts`, `src/graph/check.ts`, `src/graph/container.ts`, `src/graph/extract-cache.ts`, `src/graph/invariants.ts`, `src/graph/source-files.ts`, `src/graph/structured/` (index, markdown, json, yaml, toml, ini, shared), `src/graph/types.ts`, `src/graph/workspace-cli.ts`, `src/util/state.ts`, and seven test files. All of these are allowed by AGENTS.md rule 3. Before opening, fix one line in `README.md`: the `--no-structured` example reads "(the default)", but the tier is off unless enabled, so the wording must change to "(the default is off)". Make that edit in a commit on this branch, then run the gate again.

---

**Title:** feat(structured): opt-in structured tier for Markdown sections and JSON, YAML, TOML and INI keys

**Summary**

graft indexes code today and skips the text files agents read whole. This adds a fourth parse tier, `structured`, behind `graft build --structured`. It turns Markdown into a `section` per heading and configuration files into a `key` per dotted path, each with an exact line span in the file itself, so `ask --source`, `skeleton`, `grep` and the cards show them at no model cost.

The design was agreed in the design issue (link when opened). This is the core: the dispatch, the new kinds, the shared helpers, and the first five families.

**What is indexed**

| Format | Files | Unit (kind) | Parser |
|---|---|---|---|
| Markdown | `.md` `.markdown` `.mdx` | a section per heading (`section`), front matter keys, and the symbols of fenced code in a language graft already indexes | line scanner |
| JSON | `.json` `.jsonc` `.jsonl` | a dotted key path such as `bewhole.upload.maxBodyBytes` (`key`) | tree-sitter |
| YAML | `.yaml` `.yml` | a dotted key path such as `jobs.verify.runs-on` (`key`) | tree-sitter |
| TOML | `.toml` | a table or key such as `profile.release.opt-level` (`key`) | line scanner |
| INI | `.ini` `.cfg` | `section.name` (`key`) | tree-sitter |

- Keys go four levels deep, with at most 500 per file, shallowest first.
- A key whose name suggests a credential, or whose value is a long opaque string, has no value in its signature or search text.
- Lockfiles are never indexed.
- Dot-files and dot-directories are not walked, as before.

**Choosing it**

The tier is off by default. `graft build --structured` turns it on and saves the choice in `.graft/config.json`. `GRAFT_STRUCTURED=1` does the same from the environment. `--no-structured` turns it off again.

**Other changes**

- Card file names no longer collide when two files share a stem. `config.json` and `config.yml` both mapped to `graft/config.md`; the later file now keeps its extension (`config.yml.md`).
- The structured tier's kinds (`section`, `key`) are added to the node kind union and to the label and render tables that consume it.

**Verification**

- `npm run build && npm test` on Node 26.7.0, at the tip commit: 1,397 tests, 1,392 pass, 0 fail, 5 skipped.
- The span tests (`test/structured-spans.test.ts`, with the family files for JSON, YAML, TOML and INI) pin exact line numbers against fixtures.

**Stack**

Base is `upstream/main`. The next pull request in the stack, markup and build files, is based on this branch.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
