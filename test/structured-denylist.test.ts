/**
 * The denylist: key material and minified bundles are never indexed as content,
 * whichever tier or flag would otherwise claim them. Lockfiles are pinned in
 * structured-tier.test.ts. With the structured tier off nothing here may change
 * the file set, so the code tiers' behaviour is not touched.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpRepo } from "./helpers.js";
import { structuredLangOf } from "../src/graph/structured/index.js";
import { isDeniedSource, listSourceFiles } from "../src/graph/source-files.js";
import { patchBuildConfig } from "../src/util/state.js";

test("denylist: key material is denied by extension, case-insensitively, in any directory", () => {
  for (const p of ["server.pem", "a/b/signing.KEY", "cert.p12", "store.pfx", "app.jks", "debug.keystore", "ca.crt", "ca.cer"]) {
    assert.equal(isDeniedSource(p), true, `${p} must be denied`);
  }
  for (const p of ["src/key.ts", "keys.json", "pem.md", "monkey.py", "src/keystore.ts", "config.crt.ts"]) {
    assert.equal(isDeniedSource(p), false, `${p} must not be denied`);
  }
});

test("denylist: the structured tier skips minified assets, and only the structured tier", () => {
  for (const p of ["dist/app.min.css", "vendor/data.min.json", "page.min.html", "x.MIN.CSS"]) {
    assert.equal(structuredLangOf(p), null, `${p} must not be structured-indexed`);
  }
  assert.equal(structuredLangOf("app.css")?.family, "css");
  assert.equal(structuredLangOf("admin.min.md")?.family, "markdown", "only asset formats are treated as bundles");
});

test("denylist: file selection leaves denied files out with the tier on and is unchanged with it off", () => {
  const dir = tmpRepo("structured-denylist");
  mkdirSync(join(dir, "src"), { recursive: true });
  for (const [name, text] of [
    ["src/util.ts", "export function util(): number {\n  return 1;\n}\n"],
    ["site.css", ".a { b: c; }\n"],
    ["site.min.css", ".a{b:c}\n"],
    ["server.pem", "-----BEGIN CERTIFICATE-----\n"],
    ["signing.key", "secret\n"],
  ] as const) {
    writeFileSync(join(dir, name), text);
  }
  const listed = (): string[] =>
    listSourceFiles(dir, join(dir, "graft"))
      .map((f) => f.slice(dir.length + 1).replaceAll("\\", "/"))
      .sort();

  patchBuildConfig(dir, { structured: false });
  assert.deepEqual(listed(), ["src/util.ts"], "tier off: exactly today's set");
  patchBuildConfig(dir, { structured: true });
  assert.deepEqual(listed(), ["site.css", "src/util.ts"]);
});
