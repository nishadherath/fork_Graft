/**
 * A graft output dir outside the repository must leave the repository's `.gitignore` and
 * `.ignore` alone. On Windows a dir on another drive has no relative path, so `relative`
 * returns the absolute target and a `startsWith("..")` test let it through, writing
 * `/C:/Users/x/out/` into the repository's ignore files.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, realpathSync, rmSync } from "node:fs";
import { join, parse } from "node:path";
import { tmpdir } from "node:os";
import { ensureGitignored, ensureSearchable } from "../src/context/node-file.js";

function withRepo(fn: (root: string) => void): void {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "ctxout-")));
  const saved = { GRAFT_NO_GITIGNORE: process.env.GRAFT_NO_GITIGNORE, GRAFT_NO_IGNORE: process.env.GRAFT_NO_IGNORE };
  delete process.env.GRAFT_NO_GITIGNORE;
  delete process.env.GRAFT_NO_IGNORE;
  try { fn(root); } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(root, { recursive: true, force: true });
  }
}

function assertUntouched(root: string): void {
  assert.equal(existsSync(join(root, ".gitignore")), false, "no .gitignore written");
  assert.equal(existsSync(join(root, ".ignore")), false, "no .ignore written");
}

test("ensureGitignored and ensureSearchable: a dir beside the repo writes nothing", () => {
  withRepo((root) => {
    const out = mkdtempSync(join(tmpdir(), "ctxout-elsewhere-"));
    try {
      ensureGitignored(root, join(out, "lexical"));
      ensureSearchable(root, join(out, "lexical"));
      assertUntouched(root);
    } finally { rmSync(out, { recursive: true, force: true }); }
  });
});

test("ensureGitignored and ensureSearchable: a dir on another drive writes nothing (Windows)", { skip: process.platform !== "win32" }, () => {
  withRepo((root) => {
    const own = parse(root).root[0].toUpperCase();
    const other = "CDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((l) => l !== own)!;
    // The target need not exist: the check is path arithmetic.
    for (const dir of [`${other}:/Users/x/scratch/lexical`, `${other}:\\Users\\x\\scratch\\lexical`]) {
      ensureGitignored(root, dir);
      ensureSearchable(root, dir);
      assertUntouched(root);
    }
  });
});

test("ensureGitignored and ensureSearchable: a dir inside the repo is still written", () => {
  withRepo((root) => {
    mkdirSync(join(root, "tools", "ctx"), { recursive: true });
    writeFileSync(join(root, "keep"), "");
    ensureGitignored(root, join(root, "tools", "ctx"));
    ensureSearchable(root, join(root, "tools", "ctx"));
    assert.equal(existsSync(join(root, ".gitignore")), true);
    assert.equal(existsSync(join(root, ".ignore")), true);
  });
});
