/**
 * `getNpmViewVersion` reaches npm through the platform's shell (Stage 32). npm is `npm.cmd` on
 * Windows, which Node does not spawn without a shell, so the registry check always failed there:
 * `graft version` said "latest: unreachable (offline?)" while online, `_update-check` wrote
 * `latest: null` to the update cache, and the update nudge never printed. A stub npm first on
 * PATH answers a version; the check must return it on every platform.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getNpmViewVersion } from "../src/cli-meta.js";

test("npm view answers through a stub npm first on PATH, on every platform", () => {
  const bin = mkdtempSync(join(tmpdir(), "graft-npm-stub-"));
  writeFileSync(join(bin, "npm.cmd"), "@echo off\r\necho 9.9.9\r\n");
  writeFileSync(join(bin, "npm"), "#!/bin/sh\necho 9.9.9\n");
  chmodSync(join(bin, "npm"), 0o755);
  const saved = process.env.PATH;
  process.env.PATH = bin;
  try {
    assert.deepEqual(getNpmViewVersion("@nanonets/graft"), { ok: true, version: "9.9.9" });
  } finally {
    process.env.PATH = saved;
    rmSync(bin, { recursive: true, force: true });
  }
});

test("the detached update check gives a slow npm the time it needs, past the interactive budget", async () => {
  const { refreshUpdateCache } = await import("../src/upkeep.js");
  const bin = mkdtempSync(join(tmpdir(), "graft-npm-stub-"));
  const home = mkdtempSync(join(tmpdir(), "graft-npm-home-"));
  // About three seconds before answering: over the interactive check's budget, under the detached one's.
  writeFileSync(join(bin, "npm.cmd"), "@echo off\r\nping -n 4 127.0.0.1 > nul\r\necho 9.9.9\r\n");
  writeFileSync(join(bin, "npm"), "#!/bin/sh\nsleep 3\necho 9.9.9\n");
  chmodSync(join(bin, "npm"), 0o755);
  const saved = process.env.PATH;
  process.env.PATH = process.platform === "win32" ? `${bin};${join(process.env.SystemRoot ?? "C:\\Windows", "System32")}` : bin;
  try {
    assert.equal(refreshUpdateCache(home).latest, "9.9.9");
  } finally {
    process.env.PATH = saved;
    rmSync(bin, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("a failing npm is reported as unreachable, not thrown", () => {
  const bin = mkdtempSync(join(tmpdir(), "graft-npm-stub-"));
  writeFileSync(join(bin, "npm.cmd"), "@echo off\r\nexit /b 1\r\n");
  writeFileSync(join(bin, "npm"), "#!/bin/sh\nexit 1\n");
  chmodSync(join(bin, "npm"), 0o755);
  const saved = process.env.PATH;
  process.env.PATH = bin;
  try {
    assert.deepEqual(getNpmViewVersion("@nanonets/graft"), { ok: false });
  } finally {
    process.env.PATH = saved;
    rmSync(bin, { recursive: true, force: true });
  }
});
