# Pull request: markup and build files in the structured tier (base `pr/structured-tier-core`)

> Operator note (not part of the text). Branch `pr/structured-tier-markup-build`, nineteen commits above `upstream/main`, of which eleven are the core branch. Above the core tip `d716f05`, this PR adds eight commits: `aa5fe4e`, `6f09cf8`, `74d244f`, `1e70a5e`, `4c69876`, `8ead234`, `9f48614` and `4ee45ea`. Changed paths beyond core: `src/graph/structured/` (css, gradle, html, make, shell, targets, xml), `src/ingest/fs.ts` (the workflow admit rule, D7), `src/graph/source-files.ts` (denylist), and their tests. Gate figure is from tip `aa5fe4e`, rebased onto the fixed core in Stage 7. Set the PR base to `pr/structured-tier-core`, so the diff shows only this PR's commits.

---

**Title:** feat(structured): HTML, CSS, XML, build and shell files, with a denylist for key material

**Summary**

The structured tier from the core pull request now covers markup and build files. Each unit carries an exact line span, as the core does, and each is found without a model or a network call.

**What is added**

- **HTML, Svelte and Astro**: elements with an `id` or `name` (`element`); the symbols of `<script>` (through the container mechanism); the rules of `<style>`.
- **CSS and SCSS**: rules (`selector`), custom properties and Sass variables, and at-rules.
- **XML**: Android ids and names in layouts and manifests, Maven coordinates in `pom.xml`, property list keys in `.plist`, and storyboard scenes (scene and view ids only, never the whole tree).
- **Gradle**: tasks (`task`), plugins and dependencies (`key`), for Groovy build scripts. Kotlin build scripts (`.kts`) are already indexed by the depth tier.
- **Makefile and CMake**: targets (`task`); CMake functions and macros, and `add_executable`, `add_library`, `add_custom_target` and `add_test` names.
- **Dockerfile**: stages (`task`).
- **Bash and PowerShell**: functions.
- **Workflow YAML**: the walker admits `.yml` and `.yaml` files under `.github/workflows/`, and no other file behind a dot. This is the one exception to the dot-directory rule, and it applies only when the structured tier is on.

**Never indexed**

Key material (`.pem`, `.key` and similar), `.env` files and minified assets are denied by name and extension in the source-file selection. A test pins the list.

**Node kinds**

`element`, `selector` and `task` join `section` and `key` in the node kind union. Each consumer's label and render table is extended.

**Verification**

- `npm run build && npm test` on Node 26.7.0, at the tip commit `aa5fe4e`: 1,492 tests, 1,487 pass, 0 fail, 5 skipped.
- Each family has its own test file, with fixtures that pin line spans.

**Stack**

Base is `pr/structured-tier-core`. The next pull request, edges between the tier and code, is based on this branch.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
