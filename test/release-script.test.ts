/**
 * `scripts/release.mjs` cuts a fork release: it bumps the version in `package.json` and both
 * places in `package-lock.json`, dates the CHANGELOG's Unreleased section, rewrites the README's
 * "This build" section and keeps or writes the `fork` marker. The runs here use a scratch
 * repository, never this checkout.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { releaseAnchor, runRelease } from "../scripts/release.mjs";

const OLD = "0.25.0-nishadherath.3";
const NEW = "0.25.0-nishadherath.4";

function git(dir: string, ...args: string[]): string {
  const r = spawnSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@example.test", "-c", "commit.gpgsign=false", ...args],
    { cwd: dir, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

interface Options {
  unreleased?: string | null;
  fork?: boolean;
  eol?: string;
}

const templates = new Map<string, string>();

/**
 * A scratch repository shaped like the fork's release files, committed clean. Git is slow on this
 * machine, so each shape is built once and copied for every test that needs it.
 */
function scratch(options: Options = {}): string {
  const key = JSON.stringify(options);
  let template = templates.get(key);
  if (!template) {
    template = buildTemplate(options);
    templates.set(key, template);
  }
  const copy = mkdtempSync(join(tmpdir(), "fork-graft-release-copy-"));
  cpSync(template, copy, { recursive: true });
  return copy;
}

function buildTemplate({ unreleased = "### Fixed\n\n- A thing.\n", fork = true, eol = "\n" }: Options): string {
  const dir = mkdtempSync(join(tmpdir(), "fork-graft-release-"));
  const pkg: Record<string, unknown> = { name: "@nanonets/graft", version: OLD, license: "MIT" };
  if (fork) pkg.fork = { upstream: "@nanonets/graft", install: "node scripts/sync-global.mjs", releases: "kept_releases" };
  const lock = {
    name: "@nanonets/graft",
    version: OLD,
    lockfileVersion: 3,
    packages: { "": { name: "@nanonets/graft", version: OLD }, "node_modules/x": { version: OLD } },
  };
  const eolize = (s: string) => s.replace(/\n/g, eol);
  writeFileSync(join(dir, "package.json"), eolize(JSON.stringify(pkg, null, 2) + "\n"));
  writeFileSync(join(dir, "package-lock.json"), eolize(JSON.stringify(lock, null, 2) + "\n"));
  const section = unreleased === null ? "" : `## Unreleased\n\n${unreleased}\n`;
  writeFileSync(join(dir, "CHANGELOG.md"), eolize(`# Changelog\n\n${section}## ${OLD} (2026-10-27)\n\n### Fixed\n\n- Older.\n`));
  const readme = [
    "# Title",
    "",
    "## Contents",
    "",
    `- [This build: ${OLD}](#this-build-0250-nishadherath3)`,
    "- [Quick start](#quick-start)",
    "",
    "---",
    "",
    `## This build: ${OLD}`,
    "",
    "Some prose.",
    "",
    "```bash",
    `npm pack                       # writes nanonets-graft-${OLD}.tgz`,
    `npm install -g ./nanonets-graft-${OLD}.tgz`,
    `graft --version                # ${OLD}`,
    "```",
    "",
    "---",
    "",
    `## Quick start (${OLD} is not this build)`,
    "",
  ].join("\n");
  writeFileSync(join(dir, "README.md"), eolize(readme));
  git(dir, "init", "-q");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "init");
  return dir;
}

const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");

test("the README anchor drops dots and keeps hyphens, as GitHub makes it", () => {
  assert.equal(releaseAnchor(`This build: ${OLD}`), "this-build-0250-nishadherath3");
  assert.equal(releaseAnchor(`This build: ${NEW}`), "this-build-0250-nishadherath4");
});

test("a release bumps the version in package.json and both lockfile fields", () => {
  const dir = scratch();
  runRelease(dir, NEW, { date: "2026-10-28" });
  assert.equal(JSON.parse(read(dir, "package.json")).version, NEW);
  const lock = JSON.parse(read(dir, "package-lock.json"));
  assert.equal(lock.version, NEW);
  assert.equal(lock.packages[""].version, NEW);
  // A dependency that happens to share the old string is not a version of this package.
  assert.equal(lock.packages["node_modules/x"].version, OLD);
});

test("the CHANGELOG keeps an empty Unreleased heading above a dated one", () => {
  const dir = scratch();
  runRelease(dir, NEW, { date: "2026-10-28" });
  const log = read(dir, "CHANGELOG.md");
  assert.match(log, /## Unreleased\n\n## 0\.25\.0-nishadherath\.4 \(2026-10-28\)\n\n### Fixed\n\n- A thing\.\n/);
  assert.ok(log.indexOf("## Unreleased") < log.indexOf(`## ${NEW}`));
  assert.ok(log.indexOf(`## ${NEW}`) < log.indexOf(`## ${OLD}`));
});

test("the README section takes the new version in its heading, anchor, tarball and --version lines", () => {
  const dir = scratch();
  runRelease(dir, NEW, { date: "2026-10-28" });
  const readme = read(dir, "README.md");
  assert.match(readme, /^## This build: 0\.25\.0-nishadherath\.4$/m);
  assert.match(readme, /\[This build: 0\.25\.0-nishadherath\.4\]\(#this-build-0250-nishadherath4\)/);
  assert.match(readme, /writes nanonets-graft-0\.25\.0-nishadherath\.4\.tgz/);
  assert.match(readme, /npm install -g \.\/nanonets-graft-0\.25\.0-nishadherath\.4\.tgz/);
  assert.match(readme, /graft --version\s+# 0\.25\.0-nishadherath\.4/);
  // Outside the section the old string is left alone.
  assert.match(readme, /## Quick start \(0\.25\.0-nishadherath\.3 is not this build\)/);
});

test("an existing fork marker is kept as it is", () => {
  const dir = scratch({ fork: true });
  runRelease(dir, NEW, { date: "2026-10-28" });
  assert.deepEqual(JSON.parse(read(dir, "package.json")).fork, {
    upstream: "@nanonets/graft",
    install: "node scripts/sync-global.mjs",
    releases: "kept_releases",
  });
});

test("a package.json without the marker gets one naming upstream, the install route and the releases folder", () => {
  const dir = scratch({ fork: false });
  runRelease(dir, NEW, { date: "2026-10-28" });
  assert.deepEqual(JSON.parse(read(dir, "package.json")).fork, {
    upstream: "@nanonets/graft",
    install: "node scripts/sync-global.mjs",
    releases: `${basename(dir)}_releases`,
  });
});

test("CRLF files stay CRLF", () => {
  const dir = scratch({ eol: "\r\n" });
  runRelease(dir, NEW, { date: "2026-10-28" });
  for (const file of ["package.json", "package-lock.json", "CHANGELOG.md", "README.md"]) {
    const text = read(dir, file);
    assert.ok(!/(^|[^\r])\n/.test(text), `${file} gained a bare LF`);
  }
  assert.equal(JSON.parse(read(dir, "package.json")).version, NEW);
});

test("a dirty tree is refused and nothing is written", () => {
  const dir = scratch();
  writeFileSync(join(dir, "stray.txt"), "x");
  assert.throws(() => runRelease(dir, NEW, { date: "2026-10-28" }), /uncommitted|dirty/i);
  assert.equal(JSON.parse(read(dir, "package.json")).version, OLD);
});

test("a CHANGELOG with no Unreleased section, or an empty one, is refused", () => {
  const none = scratch({ unreleased: null });
  assert.throws(() => runRelease(none, NEW, { date: "2026-10-28" }), /Unreleased/);
  const empty = scratch({ unreleased: "" });
  assert.throws(() => runRelease(empty, NEW, { date: "2026-10-28" }), /Unreleased/);
  assert.equal(JSON.parse(read(empty, "package.json")).version, OLD);
});

test("a version that is not semver, or is the current one, is refused", () => {
  const dir = scratch();
  assert.throws(() => runRelease(dir, "v1", { date: "2026-10-28" }), /version/i);
  assert.throws(() => runRelease(dir, OLD, { date: "2026-10-28" }), /already/i);
});

test("the report prints the commit, tag, push and pack commands, and runs none of them", () => {
  const dir = scratch();
  const { commands } = runRelease(dir, NEW, { date: "2026-10-28" });
  const text = commands.join("\n");
  assert.match(text, /git add package\.json package-lock\.json CHANGELOG\.md README\.md/);
  assert.match(text, new RegExp(`git commit -m "chore\\(release\\): version ${NEW.replace(/\./g, "\\.")}"`));
  assert.match(text, new RegExp(`git tag -a v${NEW.replace(/\./g, "\\.")} `));
  assert.match(text, /git push origin main/);
  assert.match(text, new RegExp(`git push origin v${NEW.replace(/\./g, "\\.")}`));
  assert.match(text, /npm pack --ignore-scripts --pack-destination/);
  assert.match(text, /kept_releases/);
  assert.equal(git(dir, "log", "--oneline").trim().split("\n").length, 1);
});
