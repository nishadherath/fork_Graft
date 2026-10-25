/**
 * Copies the grammars the package ships itself into dist/vendor/. Runs as part
 * of `npm run build`; native.ts loads them from there.
 *
 * tree-sitter-swift is a dev dependency only: it asks for tree-sitter ^0.22
 * while every other grammar asks for ^0.21, so as a dependency it made every
 * `npm install -g` print a wall of ERESOLVE peer warnings. What it ships is a
 * prebuilt binary per platform plus node-types.json, and that is all native.ts
 * needs. Its MIT license comes along.
 *
 * Usage: node scripts/vendor-grammars.mjs [outDir]   (default dist/vendor)
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = resolve(process.argv[2] ?? join(root, "dist", "vendor"));
const require = createRequire(join(root, "package.json"));

for (const id of ["tree-sitter-swift"]) {
  const pkg = dirname(require.resolve(`${id}/package.json`));
  const { version } = require(`${id}/package.json`);
  const out = join(outDir, id);
  rmSync(out, { recursive: true, force: true });
  const platforms = readdirSync(join(pkg, "prebuilds"));
  for (const platform of platforms) {
    mkdirSync(join(out, "prebuilds", platform), { recursive: true });
    copyFileSync(join(pkg, "prebuilds", platform, `${id}.node`), join(out, "prebuilds", platform, `${id}.node`));
  }
  copyFileSync(join(pkg, "src", "node-types.json"), join(out, "node-types.json"));
  copyFileSync(join(pkg, "LICENSE"), join(out, "LICENSE"));
  console.log(`vendored grammar → ${id}@${version} (${platforms.length} platforms)`);
}

// WASM grammars tree-sitter-wasm 2.x no longer ships, from the 1.x bundle that is
// a dev dependency as tree-sitter-wasm-v1. generic.ts loads them from here.
{
  const bundle = "tree-sitter-wasm-v1";
  const langs = ["scss"];
  // Its `exports` map hides package.json, so find the package from a grammar it does export.
  const first = require.resolve(`${bundle}/${langs[0]}/tree-sitter-${langs[0]}.wasm`);
  const pkg = dirname(dirname(dirname(first)));
  const { version } = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8"));
  const out = join(outDir, "wasm");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const lang of langs) copyFileSync(require.resolve(`${bundle}/${lang}/tree-sitter-${lang}.wasm`), join(out, `tree-sitter-${lang}.wasm`));
  copyFileSync(join(pkg, "LICENSE"), join(out, "LICENSE"));
  console.log(`vendored grammar → ${langs.join(", ")} from tree-sitter-wasm@${version}`);
}
