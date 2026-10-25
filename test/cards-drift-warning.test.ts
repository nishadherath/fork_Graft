/**
 * D14: card or INDEX.md drift keeps `graft check` failing, but `trail status` and the MCP
 * check tool report it as a warning and do not call the map behind the code, because the
 * Stop hook rewrites the cards at the end of each turn.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGraph } from "../src/graph/build.js";
import { checkGraph, formatGraphCheckReport } from "../src/graph/check.js";

async function repoWithMissingCard(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "graft-d14-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "util.ts"), "export function util(): number {\n  return 1;\n}\n");
  writeFileSync(join(dir, "src", "more.ts"), "export function more(): number {\n  return 2;\n}\n");
  await buildGraph(dir, { contextDir: join(dir, "graft"), reuse: false });
  rmSync(join(dir, "graft", "src", "more.md"));
  return dir;
}

test("check fails on card drift, but the result says the wiring itself is in sync", async () => {
  const dir = await repoWithMissingCard();
  try {
    const r = await checkGraph(dir, { contextDir: join(dir, "graft") });
    assert.equal(r.ok, false, "graft check keeps exiting 1");
    assert.equal(r.inSync, true, "the nodes agree with the code");
    assert.match(formatGraphCheckReport(r), /STALE/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the warning form says OK and names the cards as a warning line", async () => {
  const dir = await repoWithMissingCard();
  try {
    const r = await checkGraph(dir, { contextDir: join(dir, "graft") });
    const text = formatGraphCheckReport(r, { cardsAsWarning: true });
    assert.match(text, /graph check: OK/);
    assert.doesNotMatch(text, /STALE/);
    assert.match(text, /warning: .*card file/);
    assert.match(text, /src\/more\.md/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a real change in the code still reads stale in the warning form", async () => {
  const dir = await repoWithMissingCard();
  try {
    writeFileSync(join(dir, "src", "c.ts"), "export function gamma(): number {\n  return 3;\n}\n");
    const r = await checkGraph(dir, { contextDir: join(dir, "graft") });
    assert.equal(r.inSync, false);
    assert.match(formatGraphCheckReport(r, { cardsAsWarning: true }), /STALE/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("trail status keeps the code map in sync and adds a cards warning row", async () => {
  const dir = await repoWithMissingCard();
  const home = mkdtempSync(join(tmpdir(), "graft-d14-home-"));
  try {
    const r = spawnSync(process.execPath, ["--import", "tsx", join(process.cwd(), "src", "bin", "trail.ts"), "status", dir], {
      cwd: process.cwd(), encoding: "utf8",
      env: { ...process.env, HOME: home, USERPROFILE: home, TRAIL_HOME: join(home, "trail"), DO_NOT_TRACK: "1", GRAFT_NO_REFRESH: "1", CLAUDECODE: undefined, TRAIL_INVOKED_AS: undefined, TRAIL_CLOUD: undefined },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /code map\s+✓ \d+ nodes · in sync with the code/);
    assert.match(r.stdout, /cards\s+⚠ .*src\/more\.md/);
    const json = JSON.parse(spawnSync(process.execPath, ["--import", "tsx", join(process.cwd(), "src", "bin", "trail.ts"), "status", dir, "--json"], {
      cwd: process.cwd(), encoding: "utf8",
      env: { ...process.env, HOME: home, USERPROFILE: home, TRAIL_HOME: join(home, "trail"), DO_NOT_TRACK: "1", GRAFT_NO_REFRESH: "1", CLAUDECODE: undefined, TRAIL_INVOKED_AS: undefined, TRAIL_CLOUD: undefined },
    }).stdout);
    assert.equal(json.codeMap.inSync, true);
    assert.equal(json.codeMap.cardsInSync, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
