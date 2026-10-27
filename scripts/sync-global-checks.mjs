/**
 * Read-only checks on the global @nanonets/graft install, run by `sync-global` after it has
 * copied `dist/`. They report and never fail: a missing converter or Kotlin grammar is for the
 * operator to act on (docs/operator-protocol.md section 10).
 *
 * Only `package.json` `optionalDependencies` count as converters; the global root is the one
 * `sync-global` finds with `npm root -g`, passed in as `target`.
 */
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const KOTLIN_STEP =
  "copy node_modules/tree-sitter-kotlin/build/Release from a previous global install " +
  "(docs/operator-protocol.md section 10)";

/**
 * The command that puts this fork's converters back into the global install: the fork is packed
 * to a temporary folder, then that tarball is installed globally with its install scripts off.
 */
export function reinstallCommand(forkRoot, forkPkg) {
  const tarball = `${forkPkg.name.replace(/^@/, "").replace("/", "-")}-${forkPkg.version}.tgz`;
  const dest = join(tmpdir(), "graft-pack");
  return (
    `cd "${forkRoot}" && npm pack --ignore-scripts --pack-destination "${dest}" && ` +
    `npm install -g "${join(dest, tarball)}" --ignore-scripts`
  );
}

/**
 * Report the global install at `target`: each optional converter from `forkPkg` that has no
 * package folder there, and whether `tree-sitter-kotlin` has a compiled `.node` binary.
 * Returns the lines to print, the missing converter names and the Kotlin result.
 */
export function checkGlobalInstall({ target, forkRoot, forkPkg }) {
  const lines = [];
  const missing = [];
  const converters = Object.entries(forkPkg.optionalDependencies ?? {});
  const install = reinstallCommand(forkRoot, forkPkg);

  for (const [name, range] of converters) {
    if (existsSync(join(target, "node_modules", name, "package.json"))) continue;
    missing.push(name);
    lines.push(`sync-global: optional converter ${name}@${range} is missing from ${target}`);
    lines.push(`  install: ${install}`);
  }
  if (converters.length > 0 && missing.length === 0) {
    lines.push(`sync-global: all ${converters.length} optional converters present`);
  }

  const kotlinDir = join(target, "node_modules", "tree-sitter-kotlin", "build", "Release");
  const kotlinPresent = existsSync(kotlinDir) && readdirSync(kotlinDir).some((file) => file.endsWith(".node"));
  if (kotlinPresent) {
    lines.push("sync-global: tree-sitter-kotlin binary present");
  } else {
    lines.push(`sync-global: tree-sitter-kotlin binary missing in ${kotlinDir}`);
    lines.push(`  step: ${KOTLIN_STEP}`);
  }

  return { lines, missing, kotlinPresent };
}

/**
 * The global package.json as it should read after a sync: the fork's version, so `graft --version`
 * names the build, and the fork's `fork` marker, which is what makes the installed `graft upgrade`
 * refuse and the update line name no command. A fork build without a marker leaves none behind.
 * Returns the text to write and whether it differs from `globalText`.
 */
export function syncedPackageJson(globalText, forkPkg) {
  const pkg = JSON.parse(globalText);
  pkg.version = forkPkg.version;
  if (forkPkg.fork) pkg.fork = forkPkg.fork;
  else delete pkg.fork;
  const text = `${JSON.stringify(pkg, null, 2)}\n`;
  return { text, changed: text !== globalText };
}
