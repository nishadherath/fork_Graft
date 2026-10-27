#!/usr/bin/env node
/**
 * Copy this fork's built `dist/` into the global @nanonets/graft install, so the
 * `graft` every other repository runs is exactly what this tree builds.
 *
 * Why a copy and not `npm i -g .`: a global install from the fork re-runs the
 * native grammar builds, and `tree-sitter-kotlin` does not compile under this
 * machine's Visual Studio (docs/operator-protocol.md section 10). The global
 * install already holds working binaries, so only `dist/` needs to move.
 *
 * Guards: the two package versions must agree up to a fork suffix (a sync across
 * 0.x.y releases would pair new JS with old dependencies; "0.21.1-name" and
 * "0.21.1" share their dependencies), the global package.json then takes the
 * fork's version, so `graft --version` names the build, and the fork's `fork` marker, so the
 * installed `graft upgrade` refuses; `dist/cli.js` must exist (the tree was
 * built), and the copied CLI must answer `--version` afterwards. Files in the
 * global `dist/` that the fork no longer builds are removed, so a renamed
 * module cannot leave a stale twin behind. `--dry-run` reports without writing.
 *
 * After the copy, `sync-global-checks.mjs` reports missing optional converters and the
 * Kotlin grammar binary, with the step that fixes each. Those lines never fail the sync.
 *
 *   node scripts/sync-global.mjs [--dry-run]
 */
import { execSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkGlobalInstall, syncedPackageJson } from "./sync-global-checks.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const forkRoot = resolve(here, "..");
const dryRun = process.argv.includes("--dry-run");

const fail = (msg) => {
  console.error(`✗ sync-global: ${msg}`);
  process.exit(1);
};

const forkPkg = JSON.parse(readFileSync(join(forkRoot, "package.json"), "utf8"));
const forkDist = join(forkRoot, "dist");
if (!existsSync(join(forkDist, "cli.js"))) fail(`dist/cli.js is missing; run "npm run build" first (fork at ${forkRoot})`);

const npmRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
const target = join(npmRoot, "@nanonets", "graft");
if (!existsSync(join(target, "package.json"))) fail(`no global install at ${target}; install @nanonets/graft globally first`);
const globalPkg = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
/** The release a version is built on: "0.21.1-nishadherath" is based on "0.21.1". */
const baseRelease = (version) => version.split("-")[0];
if (baseRelease(globalPkg.version) !== baseRelease(forkPkg.version)) {
  fail(
    `version mismatch: fork is ${forkPkg.version}, global install is ${globalPkg.version}. ` +
      `Fast-forward the fork to the installed tag (or reinstall) before syncing.`,
  );
}

/** Every file under `dir`, as paths relative to it (posix separators). */
function walk(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, base, out);
    else out.push(relative(base, abs).split("\\").join("/"));
  }
  return out;
}

const sameBytes = (a, b) => existsSync(b) && statSync(a).size === statSync(b).size && readFileSync(a).equals(readFileSync(b));

const forkFiles = walk(forkDist);
const targetDist = join(target, "dist");
const targetFiles = existsSync(targetDist) ? walk(targetDist) : [];
const forkSet = new Set(forkFiles);

let updated = 0;
let unchanged = 0;
let removed = 0;
for (const rel of forkFiles) {
  const src = join(forkDist, rel);
  const dst = join(targetDist, rel);
  if (sameBytes(src, dst)) {
    unchanged++;
    continue;
  }
  updated++;
  if (dryRun) {
    console.log(`would write ${rel}`);
    continue;
  }
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, readFileSync(src));
}
for (const rel of targetFiles) {
  if (forkSet.has(rel)) continue;
  removed++;
  if (dryRun) {
    console.log(`would remove ${rel}`);
    continue;
  }
  rmSync(join(targetDist, rel), { force: true });
}

const verb = dryRun ? "would change" : "changed";
console.log(
  `sync-global: ${forkPkg.version} → ${target}: ${updated} ${verb}, ${removed} stale removed, ${unchanged} unchanged`,
);

if (!dryRun) {
  const globalPkgPath = join(target, "package.json");
  const synced = syncedPackageJson(readFileSync(globalPkgPath, "utf8"), forkPkg);
  if (synced.changed) {
    writeFileSync(globalPkgPath, synced.text);
    console.log(`sync-global: global package.json now carries version ${forkPkg.version}${forkPkg.fork ? " and the fork marker" : ""} (was ${globalPkg.version})`);
  }
  const version = execFileSync(process.execPath, [join(target, "dist", "cli.js"), "--version"], { encoding: "utf8" }).trim();
  if (version !== forkPkg.version) fail(`the synced CLI answers "${version}", expected ${forkPkg.version}`);
  console.log(`sync-global: global graft answers --version ${version}`);
}

// Read-only, so they run in a dry run too; they report the install as it is now.
const report = checkGlobalInstall({ target, forkRoot, forkPkg });
for (const line of report.lines) console.log(line);
if (dryRun) console.log("sync-global: dry run, nothing written");
