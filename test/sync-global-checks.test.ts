/**
 * `sync-global` reports on the global install after it copies `dist/`: which optional
 * converters are missing and whether npm linked the `trail` command. The checks run here
 * against a fake global root, never the real install, and they only report.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkGlobalInstall, globalShimDir } from "../scripts/sync-global-checks.mjs";

const forkRoot = join(tmpdir(), "fork-graft-under-test");
const forkPkg = {
  name: "@nanonets/graft",
  version: "0.25.0-nishadherath",
  optionalDependencies: { fflate: "0.8.3", "pdfjs-dist": "5.6.205" },
};

/** A fake global `@nanonets/graft` folder with the named packages under its node_modules. It
 * also carries what a pre-0.28.0 install's failed local Kotlin build left behind (an `.exp`
 * file, never a `.node` binary), which the report must not mention. */
function fakeInstall(packages: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "sync-global-checks-"));
  const target = join(root, "@nanonets", "graft");
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, "package.json"), JSON.stringify({ name: "@nanonets/graft", version: "0.25.0" }));
  for (const name of packages) {
    const dir = join(target, "node_modules", name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), "{}");
  }
  const release = join(target, "node_modules", "tree-sitter-kotlin", "build", "Release");
  mkdirSync(release, { recursive: true });
  writeFileSync(join(release, "tree_sitter_kotlin_binding.exp"), "");
  return target;
}

test("a missing optional converter is named with the command that installs it", () => {
  const target = fakeInstall(["fflate"]);
  const report = checkGlobalInstall({ target, forkRoot, forkPkg });

  assert.deepEqual(report.missing, ["pdfjs-dist"]);
  const named = report.lines.find((line) => line.includes("pdfjs-dist"));
  assert.ok(named, "the missing converter is named");
  const install = report.lines.find((line) => line.trimStart().startsWith("install:"));
  assert.ok(install?.includes("npm pack --ignore-scripts"), "the reinstall packs the fork first");
  assert.ok(install?.includes("npm install -g"), "the reinstall puts the tarball in the global install");
  assert.ok(install?.includes("nanonets-graft-0.25.0-nishadherath.tgz"), "the tarball name follows npm's pack naming");
  assert.ok(!report.lines.some((line) => line.includes("fflate") && line.includes("missing")));
});

test("a complete global install reports no missing converter", () => {
  const target = fakeInstall(["fflate", "pdfjs-dist"]);
  const report = checkGlobalInstall({ target, forkRoot, forkPkg });

  assert.deepEqual(report.missing, []);
  assert.ok(!report.lines.some((line) => line.includes("missing")));
  assert.ok(report.lines.some((line) => line.includes("all 2 optional converters present")));
});

test("nothing is said about a Kotlin binary: since 0.28.0 the depth tier parses on WASM and a global install has no tree-sitter-kotlin", () => {
  const report = checkGlobalInstall({ target: fakeInstall(["fflate", "pdfjs-dist"]), forkRoot, forkPkg });

  assert.ok(!report.lines.some((line) => /kotlin/i.test(line)), report.lines.join("\n"));
  assert.equal("kotlinPresent" in report, false);
});

// --- the trail command (Stage 33, D28 A) ---

const forkWithTrail = { ...forkPkg, bin: { graft: "dist/bin/graft.js", trail: "dist/bin/trail.js" } };

/** A temporary npm prefix; `shims` are the file names npm would have linked into its shim folder. */
function fakePrefix(platform: "win32" | "linux", shims: string[]): { prefix: string; shimDir: string } {
  const prefix = mkdtempSync(join(tmpdir(), "sync-global-prefix-"));
  const shimDir = globalShimDir(prefix, platform);
  mkdirSync(shimDir, { recursive: true });
  for (const name of shims) writeFileSync(join(shimDir, name), "");
  return { prefix, shimDir };
}

test("the shim folder is the prefix on Windows and prefix/bin elsewhere", () => {
  assert.equal(globalShimDir("C:\\nvm4w\\nodejs", "win32"), "C:\\nvm4w\\nodejs");
  assert.equal(globalShimDir("/usr/local", "linux"), join("/usr/local", "bin"));
});

test("a missing trail shim is reported with the tarball reinstall, and the checks still only report", () => {
  const target = fakeInstall(["fflate", "pdfjs-dist"]);
  const { shimDir } = fakePrefix("win32", ["graft", "graft.cmd", "graft.ps1"]);
  const report = checkGlobalInstall({ target, forkRoot, forkPkg: forkWithTrail, shimDir, platform: "win32" });

  assert.equal(report.trailPresent, false);
  assert.ok(report.lines.some((line) => line.includes("no trail command") && line.includes(shimDir)));
  const install = report.lines.filter((line) => line.trimStart().startsWith("install:"));
  assert.equal(install.length, 1, "one reinstall line");
  assert.ok(install[0]?.includes("npm pack --ignore-scripts") && install[0].includes("npm install -g"));
  assert.ok(install[0]?.includes("nanonets-graft-0.25.0-nishadherath.tgz"));
  assert.deepEqual(report.missing, [], "a missing shim is not a missing converter");
});

test("a trail shim in place is reported present, with no reinstall line", () => {
  const target = fakeInstall(["fflate", "pdfjs-dist"]);
  const win = fakePrefix("win32", ["graft.cmd", "trail", "trail.cmd", "trail.ps1"]);
  const winReport = checkGlobalInstall({ target, forkRoot, forkPkg: forkWithTrail, shimDir: win.shimDir, platform: "win32" });
  assert.equal(winReport.trailPresent, true);
  assert.ok(winReport.lines.some((line) => line.includes("trail command present")));
  assert.ok(!winReport.lines.some((line) => line.trimStart().startsWith("install:")));

  const posix = fakePrefix("linux", ["graft", "trail"]);
  assert.equal(checkGlobalInstall({ target, forkRoot, forkPkg: forkWithTrail, shimDir: posix.shimDir, platform: "linux" }).trailPresent, true);
});

test("on Windows a bare trail file without trail.cmd is not a working shim", () => {
  const target = fakeInstall(["fflate", "pdfjs-dist"]);
  const { shimDir } = fakePrefix("win32", ["trail"]);
  assert.equal(checkGlobalInstall({ target, forkRoot, forkPkg: forkWithTrail, shimDir, platform: "win32" }).trailPresent, false);
});

test("no shim folder, or a package that declares no trail bin, skips the trail check", () => {
  const target = fakeInstall(["fflate", "pdfjs-dist"]);
  const unasked = checkGlobalInstall({ target, forkRoot, forkPkg: forkWithTrail });
  assert.equal(unasked.trailPresent, null);
  assert.ok(!unasked.lines.some((line) => line.includes("trail command")));
  const { shimDir } = fakePrefix("win32", []);
  const undeclared = checkGlobalInstall({ target, forkRoot, forkPkg: { ...forkPkg, bin: { graft: "dist/bin/graft.js" } }, shimDir, platform: "win32" });
  assert.equal(undeclared.trailPresent, null);
  assert.ok(!undeclared.lines.some((line) => line.includes("trail command")));
});

// --- the fork marker reaches the global install (Stage 27) ---

test("the synced package.json takes the fork's version and its fork marker, and nothing else", async () => {
  const { syncedPackageJson } = await import("../scripts/sync-global-checks.mjs");
  const marker = { upstream: "@nanonets/graft", install: "node scripts/sync-global.mjs", releases: "fork_graft_releases" };
  const globalText = JSON.stringify({ name: "@nanonets/graft", version: "0.25.0-nishadherath.2", license: "MIT" }, null, 2) + "\n";
  const out = syncedPackageJson(globalText, { ...forkPkg, version: "0.25.0-nishadherath.3", fork: marker });
  assert.equal(out.changed, true);
  assert.deepEqual(JSON.parse(out.text), { name: "@nanonets/graft", version: "0.25.0-nishadherath.3", license: "MIT", fork: marker });
  assert.ok(out.text.endsWith("\n"));
  // Already in step: nothing to write.
  assert.equal(syncedPackageJson(out.text, { ...forkPkg, version: "0.25.0-nishadherath.3", fork: marker }).changed, false);
  // A fork build without a marker leaves the global one unmarked, so it cannot refuse an upgrade it should allow.
  const unmarked = syncedPackageJson(out.text, { ...forkPkg, version: "0.25.0-nishadherath.3" });
  assert.equal(unmarked.changed, true);
  assert.equal("fork" in JSON.parse(unmarked.text), false);
});
