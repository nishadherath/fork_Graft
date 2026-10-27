#!/usr/bin/env node
/**
 * Cut a release of this fork: the files a release changes, in one step, and the commands that
 * finish it printed for the operator's stage to run.
 *
 * It bumps the version in `package.json` and in both places in `package-lock.json`, turns the
 * CHANGELOG's Unreleased section into a dated heading (leaving a fresh empty Unreleased above
 * it), rewrites the README's "This build" section (heading, contents anchor, tarball name and
 * `--version` lines), and keeps the `fork` marker in `package.json` or writes one. It refuses on
 * a dirty tree, on a version that is not semver or is the current one, and on a CHANGELOG with no
 * Unreleased section or an empty one. It commits, tags, pushes and packs nothing.
 *
 *   node scripts/release.mjs <version>
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const FORK_INSTALL = "node scripts/sync-global.mjs";
const FILES = ["package.json", "package-lock.json", "CHANGELOG.md", "README.md"];

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The anchor GitHub makes for a heading: lower case, punctuation other than hyphens dropped. */
export function releaseAnchor(heading) {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, "")
    .replace(/ /g, "-");
}

function readText(root, file) {
  const text = readFileSync(join(root, file), "utf8");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  return { text: text.replace(/\r\n/g, "\n"), eol };
}

/** Replace the first `count` exact `"version": "<from>"` fields. */
function bumpVersionFields(text, from, to, count, file) {
  const field = new RegExp(`("version": ")${escapeRegExp(from)}(")`, "g");
  let seen = 0;
  const out = text.replace(field, (whole, open, close) => (++seen <= count ? `${open}${to}${close}` : whole));
  if (seen < count) throw new Error(`${file} holds ${seen} version field(s) at ${from}; expected ${count}`);
  return out;
}

/** The Unreleased body, or a refusal when the section is missing or empty. */
function checkUnreleased(changelog) {
  const m = /^## Unreleased[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(changelog);
  if (!m) throw new Error("CHANGELOG.md has no '## Unreleased' section to turn into a release");
  if (m[1].trim() === "") throw new Error("CHANGELOG.md's Unreleased section is empty; nothing to release");
}

function rewriteReadme(readme, from, to) {
  const heading = new RegExp(`^## This build: ${escapeRegExp(from)}[ \\t]*$`, "m");
  const start = heading.exec(readme);
  if (!start) throw new Error(`README.md has no '## This build: ${from}' section to rewrite`);
  const afterHeading = start.index + start[0].length;
  const rule = /^---[ \t]*$/m.exec(readme.slice(afterHeading));
  const end = rule ? afterHeading + rule.index : readme.length;
  const swap = (s) => s.split(from).join(to);
  const section = swap(readme.slice(start.index, end));
  const oldToc = `[This build: ${from}](#${releaseAnchor(`This build: ${from}`)})`;
  const newToc = `[This build: ${to}](#${releaseAnchor(`This build: ${to}`)})`;
  if (!readme.includes(oldToc)) throw new Error(`README.md's contents has no ${oldToc} entry`);
  return (readme.slice(0, start.index) + section + readme.slice(end)).split(oldToc).join(newToc);
}

/**
 * Apply a release to the repository at `root`. Returns the commands to run next. Every check runs
 * before the first write, so a refusal leaves the tree as it was.
 */
export function runRelease(root, version, { date = new Date().toISOString().slice(0, 10) } = {}) {
  if (!VERSION.test(version)) throw new Error(`'${version}' is not a version (expected 1.2.3 or 1.2.3-suffix)`);
  const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim();
  if (dirty) throw new Error(`the working tree has uncommitted changes; commit or stash them first:\n${dirty}`);

  const files = Object.fromEntries(FILES.map((f) => [f, readText(root, f)]));
  const pkg = JSON.parse(files["package.json"].text);
  const from = pkg.version;
  if (from === version) throw new Error(`package.json is already at ${version}`);
  checkUnreleased(files["CHANGELOG.md"].text);

  const next = {
    "package.json": bumpVersionFields(files["package.json"].text, from, version, 1, "package.json"),
    "package-lock.json": bumpVersionFields(files["package-lock.json"].text, from, version, 2, "package-lock.json"),
    "CHANGELOG.md": files["CHANGELOG.md"].text.replace(/^## Unreleased[ \t]*\n/m, `## Unreleased\n\n## ${version} (${date})\n`),
    "README.md": rewriteReadme(files["README.md"].text, from, version),
  };

  let fork = pkg.fork;
  if (!fork) {
    fork = { upstream: pkg.name, install: FORK_INSTALL, releases: `${basename(resolve(root))}_releases` };
    const closing = next["package.json"].replace(/\n\}\s*$/, "");
    next["package.json"] = `${closing.replace(/(\n  "license": "[^"]*",?)/, (m) => (m.endsWith(",") ? m : `${m},`) + `\n  "fork": ${JSON.stringify(fork, null, 2).replace(/\n/g, "\n  ")}${m.endsWith(",") ? "," : ""}`)}\n}\n`;
    JSON.parse(next["package.json"]);
  }

  for (const f of FILES) writeFileSync(join(root, f), next[f].replace(/\n/g, files[f].eol));

  const tag = `v${version}`;
  const releases = join(dirname(resolve(root)), fork.releases ?? `${basename(resolve(root))}_releases`);
  return {
    from,
    version,
    commands: [
      `git add ${FILES.join(" ")}`,
      `git commit -m "chore(release): version ${version}"`,
      `git tag -a ${tag} -m "${version}"`,
      "git push origin main",
      `git push origin ${tag}`,
      `npm pack --ignore-scripts --pack-destination "${releases}"`,
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!version) {
    console.error("usage: node scripts/release.mjs <version>");
    process.exit(2);
  }
  try {
    const { from, commands } = runRelease(resolve(dirname(fileURLToPath(import.meta.url)), ".."), version);
    console.log(`Released ${from} -> ${version} in package.json, package-lock.json, CHANGELOG.md and README.md.`);
    console.log("Review the diff, run the gate, then run:\n");
    for (const c of commands) console.log(`  ${c}`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
