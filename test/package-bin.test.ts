/**
 * The fork's one package exposes two commands, `graft` and `trail` (Stage 33, D28 A). Both bin
 * entries load the same `dist/cli.js` and differ only in the brand they set, so each must point
 * at a built entry that has a source twin in `src/bin/`, and the package must ship `dist`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { bin?: Record<string, string>; files?: string[] };

test("package.json exposes graft and trail, each at its own built entry", () => {
  assert.deepEqual(pkg.bin, { graft: "dist/bin/graft.js", trail: "dist/bin/trail.js" });
});

test("each bin entry has a source file in src/bin/ that starts with a node shebang", () => {
  for (const target of Object.values(pkg.bin ?? {})) {
    const source = join(root, target.replace(/^dist\//, "src/").replace(/\.js$/, ".ts"));
    assert.ok(existsSync(source), `${source} exists`);
    assert.match(readFileSync(source, "utf8"), /^#!\/usr\/bin\/env node\r?\n/, `${source} starts with a shebang`);
  }
});

test("the package ships dist, where both entries live", () => {
  assert.ok(pkg.files?.includes("dist"), "files lists dist");
});

test("the trail entry sets the trail brand before it loads the CLI, and graft's sets graft", () => {
  const trail = readFileSync(join(root, "src", "bin", "trail.ts"), "utf8");
  const graft = readFileSync(join(root, "src", "bin", "graft.ts"), "utf8");
  assert.ok(trail.indexOf('setBrand("trail")') !== -1 && trail.indexOf('setBrand("trail")') < trail.indexOf("../cli.js"));
  assert.ok(graft.indexOf('setBrand("graft")') !== -1 && graft.indexOf('setBrand("graft")') < graft.indexOf("../cli.js"));
});
