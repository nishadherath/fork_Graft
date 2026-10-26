/**
 * The gate lock (Stage 25, D21): `scripts/run-tests.mjs` takes a machine-wide lock before it
 * runs the suite, so two sessions' gates never overlap and starve the MCP and CLI tests into
 * timeouts. The lock is a folder created atomically; its owner file names the pid, so a gate
 * that was killed leaves a lock the next one can see is stale.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireGateLock, gateLockDir, releaseGateLock } from "../scripts/gate-lock.mjs";

function scratch(): { dir: string; done: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "graft-gate-lock-"));
  return { dir, done: () => rmSync(dir, { recursive: true, force: true }) };
}

const alive = () => true;
const dead = () => false;
const quick = { pollMs: 5, timeoutMs: 60 };

test("gateLockDir takes GRAFT_GATE_LOCK_DIR, else a folder under the temp directory", () => {
  assert.equal(gateLockDir({ GRAFT_GATE_LOCK_DIR: "X:\\gates" }), "X:\\gates");
  assert.equal(gateLockDir({}), join(tmpdir(), "graft-gate-lock"));
});

test("acquiring writes the owner's pid, and releasing removes the lock", async () => {
  const s = scratch();
  try {
    const lock = await acquireGateLock({ dir: s.dir, pid: 4242, isAlive: alive, ...quick });
    const owner = JSON.parse(readFileSync(join(lock.path, "owner.json"), "utf8"));
    assert.equal(owner.pid, 4242);
    assert.equal(typeof owner.cwd, "string");
    releaseGateLock(lock);
    assert.equal(existsSync(lock.path), false);
  } finally {
    s.done();
  }
});

test("a second gate waits while the first is alive, then gives up naming the holder", async () => {
  const s = scratch();
  try {
    const first = await acquireGateLock({ dir: s.dir, pid: 1111, isAlive: alive, ...quick });
    await assert.rejects(acquireGateLock({ dir: s.dir, pid: 2222, isAlive: alive, ...quick }), /held by pid 1111/);
    releaseGateLock(first);
    const second = await acquireGateLock({ dir: s.dir, pid: 2222, isAlive: alive, ...quick });
    assert.equal(JSON.parse(readFileSync(join(second.path, "owner.json"), "utf8")).pid, 2222);
    releaseGateLock(second);
  } finally {
    s.done();
  }
});

test("a lock whose owner is gone is stale and is taken over", async () => {
  const s = scratch();
  try {
    await acquireGateLock({ dir: s.dir, pid: 1111, isAlive: alive, ...quick });
    const messages: string[] = [];
    const lock = await acquireGateLock({ dir: s.dir, pid: 2222, isAlive: dead, onStale: (m: string) => messages.push(m), ...quick });
    assert.equal(JSON.parse(readFileSync(join(lock.path, "owner.json"), "utf8")).pid, 2222);
    assert.match(messages.join("\n"), /stale lock of pid 1111/);
    releaseGateLock(lock);
  } finally {
    s.done();
  }
});

test("a lock folder with no owner file is held while fresh and stale once old", async () => {
  const s = scratch();
  try {
    mkdirSync(join(s.dir, "gate.lock"), { recursive: true });
    await assert.rejects(acquireGateLock({ dir: s.dir, pid: 2222, isAlive: alive, ...quick }), /held/);
    const lock = await acquireGateLock({ dir: s.dir, pid: 2222, isAlive: alive, now: () => Date.now() + 3_600_000, ...quick });
    assert.equal(JSON.parse(readFileSync(join(lock.path, "owner.json"), "utf8")).pid, 2222);
    releaseGateLock(lock);
  } finally {
    s.done();
  }
});

test("releasing a lock another gate has since taken leaves it alone", async () => {
  const s = scratch();
  try {
    const mine = await acquireGateLock({ dir: s.dir, pid: 1111, isAlive: alive, ...quick });
    writeFileSync(join(mine.path, "owner.json"), JSON.stringify({ pid: 3333, cwd: "elsewhere" }));
    releaseGateLock(mine);
    assert.equal(existsSync(mine.path), true);
  } finally {
    s.done();
  }
});

test("run-tests.mjs takes the lock before it runs anything, and refuses while a live gate holds it", () => {
  const s = scratch();
  try {
    mkdirSync(join(s.dir, "gate.lock"), { recursive: true });
    // the holder is this process, which is running for as long as the test is
    writeFileSync(join(s.dir, "gate.lock", "owner.json"), JSON.stringify({ pid: process.pid, cwd: "the holder" }));
    const started = Date.now();
    const r = spawnSync(process.execPath, [join(process.cwd(), "scripts", "run-tests.mjs")], {
      encoding: "utf8",
      env: { ...process.env, GRAFT_GATE_LOCK_DIR: s.dir, GRAFT_GATE_LOCK_TIMEOUT_MS: "300" },
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, new RegExp(`held by pid ${process.pid} in the holder`));
    assert.ok(Date.now() - started < 30_000, "it gave up instead of running the suite");
    assert.equal(existsSync(join(s.dir, "gate.lock")), true, "the holder's lock is left alone");
  } finally {
    s.done();
  }
});
