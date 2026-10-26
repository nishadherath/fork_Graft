/**
 * `sync-global` reports on the global install after it copies `dist/`: which optional
 * converters are missing, and whether the Kotlin grammar binary is there. The checks run
 * here against a fake global root, never the real install, and they only report.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkGlobalInstall } from "../scripts/sync-global-checks.mjs";

const forkRoot = join(tmpdir(), "fork-graft-under-test");
const forkPkg = {
  name: "@nanonets/graft",
  version: "0.25.0-nishadherath",
  optionalDependencies: { fflate: "0.8.3", "pdfjs-dist": "5.6.205" },
};

/** A fake global `@nanonets/graft` folder with the named packages under its node_modules. */
function fakeInstall(packages: string[], kotlinBinary: boolean): string {
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
  // The local failed build leaves .obj and .exp files behind, never a .node binary.
  writeFileSync(join(release, "tree_sitter_kotlin_binding.exp"), "");
  if (kotlinBinary) writeFileSync(join(release, "tree_sitter_kotlin_binding.node"), "");
  return target;
}

test("a missing optional converter is named with the command that installs it", () => {
  const target = fakeInstall(["fflate"], false);
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

test("the Kotlin binary is reported missing, with the copy step from protocol section 10", () => {
  const target = fakeInstall(["fflate", "pdfjs-dist"], false);
  const report = checkGlobalInstall({ target, forkRoot, forkPkg });

  assert.deepEqual(report.missing, []);
  assert.equal(report.kotlinPresent, false);
  assert.ok(report.lines.some((line) => line.includes("tree-sitter-kotlin binary missing")));
  assert.ok(report.lines.some((line) => line.includes("docs/operator-protocol.md section 10")));
});

test("a complete global install reports no missing converter and the Kotlin binary present", () => {
  const target = fakeInstall(["fflate", "pdfjs-dist"], true);
  const report = checkGlobalInstall({ target, forkRoot, forkPkg });

  assert.deepEqual(report.missing, []);
  assert.equal(report.kotlinPresent, true);
  assert.ok(!report.lines.some((line) => line.includes("missing")));
  assert.ok(report.lines.some((line) => line.includes("tree-sitter-kotlin binary present")));
});
