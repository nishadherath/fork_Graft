/**
 * A build that carries a `fork` marker in its package.json must not send anyone to
 * `graft upgrade`, which would replace it with upstream's release (Stage 27, D24 A).
 * The nudge turns informational, `upgrade` refuses and names the fork's own install
 * route, the version report and the two trail notices stop advertising the command,
 * and an unmarked build behaves exactly as it always did.
 *
 * Every spawn here runs with a PATH that holds only stub npm shims, so a run that
 * fails first can never touch the real global install. Temp homes and temp folders
 * only; nothing here runs inside a wired checkout.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brand } from "../src/brand.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const builtCli = join(repoRoot, "dist", "cli.js");

const FORK = { upstream: "@example/tool", install: "node scripts/sync-global.mjs", releases: "tool_releases" };
const CURRENT = "1.2.0-mine.3";
const LATEST = "1.3.0";

function scratch(label: string): string {
  return mkdtempSync(join(tmpdir(), `graft-fork-${label}-`));
}

/** A package folder with `dist/cli.js` beside the package.json, as an install lays it out. */
function fakePackage(root: string, extra: Record<string, unknown>): string {
  mkdirSync(join(root, "dist"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "@example/tool", version: CURRENT, ...extra }));
  writeFileSync(join(root, "dist", "cli.js"), "");
  return pathToFileURL(join(root, "dist", "cli.js")).href;
}

/** A folder holding only `npm` and `npm.cmd` stubs that record their arguments to `log` and exit 1. */
function stubNpm(root: string): { bin: string; log: string } {
  const bin = join(root, "stub-bin");
  const log = join(root, "npm-calls.log");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "npm.cmd"), `@echo off\r\necho %* >> "${log}"\r\nexit /b 1\r\n`);
  const sh = join(bin, "npm");
  writeFileSync(sh, `#!/bin/sh\necho "$@" >> "${log}"\nexit 1\n`);
  chmodSync(sh, 0o755);
  return { bin, log };
}

function writeCache(home: string, latest: string): void {
  mkdirSync(join(home, ".graft"), { recursive: true });
  writeFileSync(join(home, ".graft", "update-check.json"), JSON.stringify({ latest, checkedAt: Date.now() }));
}

// --- the marker ---

test("the marker is read from the package.json beside dist/, and only when it is complete", async () => {
  const { readForkMarker } = await import("../src/cli-meta.js");
  const root = scratch("marker");
  try {
    assert.deepEqual(readForkMarker(fakePackage(join(root, "a"), { fork: FORK })), FORK);
    assert.equal(readForkMarker(fakePackage(join(root, "b"), {})), null, "no marker");
    assert.equal(readForkMarker(fakePackage(join(root, "c"), { fork: { upstream: "@example/tool" } })), null, "no install route");
    assert.equal(readForkMarker(fakePackage(join(root, "d"), { fork: "yes" })), null, "not an object");
    assert.deepEqual(
      readForkMarker(fakePackage(join(root, "e"), { fork: { upstream: FORK.upstream, install: FORK.install } })),
      { upstream: FORK.upstream, install: FORK.install },
      "the releases folder is optional",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("this repository's own package.json carries the marker", async () => {
  const { readForkMarker } = await import("../src/cli-meta.js");
  const marker = readForkMarker(pathToFileURL(join(repoRoot, "src", "cli.ts")).href);
  assert.ok(marker, "package.json has a fork object with an upstream package and an install command");
  assert.match(marker.install, /sync-global/);
});

// --- the nudge ---

test("(a) on a fork the nudge names both versions, leaves the merge to the operator and offers no command", async () => {
  const { formatUpdateNudge } = await import("../src/upkeep.js");
  const line = formatUpdateNudge(CURRENT, LATEST, FORK) ?? "";
  assert.ok(line.includes(LATEST), `names upstream's version: ${line}`);
  assert.ok(line.includes(CURRENT), `names this build's version: ${line}`);
  assert.ok(line.includes(FORK.upstream), `names the upstream package: ${line}`);
  assert.match(line, /operator/i);
  assert.doesNotMatch(line, /upgrade|npm install|\brun\b/i);
  assert.equal(formatUpdateNudge(CURRENT, "1.0.0", FORK), null, "nothing newer, nothing said");
  assert.equal(formatUpdateNudge(CURRENT, null, FORK), null, "no answer cached, nothing said");
});

test("(b) without a marker the nudge is the line it always was", async () => {
  const { formatUpdateNudge } = await import("../src/upkeep.js");
  const expected = `⬆ ${brand()} 1.2.0 → ${LATEST} available: run \`${brand()} upgrade\` (restart your agent after).`;
  assert.equal(formatUpdateNudge("1.2.0", LATEST), expected);
  assert.equal(formatUpdateNudge("1.2.0", LATEST, null), expected);
  assert.equal(formatUpdateNudge("1.2.0", "1.2.0"), null);
});

test("the session-start upkeep says the same thing from the cached answer", async () => {
  const { runUpkeep } = await import("../src/upkeep-run.js");
  const root = scratch("upkeep");
  try {
    const home = join(root, "home");
    const repo = join(root, "repo");
    mkdirSync(repo, { recursive: true });
    writeCache(home, LATEST);
    const fork = runUpkeep(repo, CURRENT, { background: false, home, fork: FORK }).lines.join("\n");
    assert.ok(fork.includes(LATEST) && fork.includes(CURRENT), fork);
    assert.doesNotMatch(fork, /upgrade/i);
    const plain = runUpkeep(repo, CURRENT, { background: false, home, fork: null }).lines.join("\n");
    assert.match(plain, /graft upgrade|trail upgrade/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- the other places that send an agent to `upgrade` ---

test("the once-a-day rename notice drops its upgrade line on a fork and keeps it otherwise", async () => {
  const { graftNotice } = await import("../src/brand.js");
  const base = { ran: "graft ask", tty: true, env: { PATH: "" } };
  const plain = graftNotice({ ...base, home: scratch("notice-a") });
  assert.match(plain ?? "", /run graft upgrade to get the trail command too/);
  const fork = graftNotice({ ...base, home: scratch("notice-b"), fork: FORK });
  assert.match(fork ?? "", /graft is now trail\. this ran trail ask/, "upstream's first line stays");
  assert.doesNotMatch(fork ?? "", /upgrade/i);
});

test("the session-start trail handover line is not offered on a fork", async () => {
  const { handoverStampPath, trailHandoverLine } = await import("../src/brand.js");
  const home = scratch("handover");
  assert.equal(trailHandoverLine({ env: { PATH: "" }, home, fork: FORK }), null);
  assert.equal(existsSync(handoverStampPath(home)), false, "nothing stamped");
  assert.match(trailHandoverLine({ env: { PATH: "" }, home }) ?? "", /`graft upgrade` adds it/);
});

test("graft version on a fork reports upstream's release without telling anyone to upgrade", async () => {
  const { formatVersionReport } = await import("../src/cli-meta.js");
  const ahead = { ok: true, version: LATEST };
  const fork = formatVersionReport(CURRENT, ahead, FORK);
  assert.ok(fork.includes(LATEST) && fork.includes(CURRENT), fork);
  assert.match(fork, /operator/i);
  assert.doesNotMatch(fork, /upgrade/i);
  assert.match(formatVersionReport(CURRENT, ahead), /upgrade/, "unmarked builds are unchanged");
  assert.equal(formatVersionReport(CURRENT, ahead), formatVersionReport(CURRENT, ahead, null));
});

// --- the refusal ---

test("(c) runUpgrade on a fork refuses before it spawns anything, and the report names the install route", async () => {
  const { runUpgrade, formatUpgradeReport } = await import("../src/cli-meta.js");
  const root = scratch("refuse");
  const savedPath = process.env.PATH;
  try {
    const url = fakePackage(join(root, "pkg"), { fork: FORK });
    const { bin, log } = stubNpm(root);
    process.env.PATH = bin;
    const result = runUpgrade(url);
    assert.equal(result.ok, false);
    assert.equal(result.ran, false);
    assert.equal(existsSync(log), false, "no npm call was made");
    const report = formatUpgradeReport(result);
    assert.ok(report.includes(FORK.install), `names the install route: ${report}`);
    assert.ok(report.includes(FORK.releases), `names the releases folder: ${report}`);
    assert.ok(report.includes(CURRENT), `names this build: ${report}`);
    assert.doesNotMatch(report, /npm install -g/);
  } finally {
    process.env.PATH = savedPath;
    rmSync(root, { recursive: true, force: true });
  }
});

test("(d) node dist/cli.js upgrade exits non-zero with the refusal and never reaches npm", { skip: existsSync(builtCli) ? false : "dist/cli.js is not built (run npm run build)" }, () => {
  const marker = (JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as { fork?: { install?: string } }).fork;
  assert.ok(marker?.install, "package.json carries the marker this run reads");
  const root = scratch("cli");
  try {
    const home = join(root, "home");
    const cwd = join(root, "work");
    mkdirSync(home, { recursive: true });
    mkdirSync(cwd, { recursive: true });
    const { bin, log } = stubNpm(root);
    const res = spawnSync(process.execPath, [builtCli, "upgrade"], {
      cwd,
      encoding: "utf8",
      timeout: 120_000,
      env: {
        PATH: bin,
        HOME: home,
        USERPROFILE: home,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        DO_NOT_TRACK: "1",
        GRAFT_NO_REFRESH: "1",
        GRAFT_NO_TRAIL_SWITCH: "1",
      },
    });
    const said = `${res.stdout}${res.stderr}`;
    assert.notEqual(res.status, 0, `exit status\n${said}`);
    assert.ok(said.includes(marker.install), `prints the install route\n${said}`);
    assert.match(said, /fork/i);
    assert.equal(existsSync(log), false, "the stub npm was not called");
    assert.doesNotMatch(said, /trail init|installed too/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
