/**
 * A machine-wide lock for the test gate (Stage 25, D21). Two gates running at once starve the
 * MCP and CLI tests into timeouts, and sessions in separate worktrees cannot see each other,
 * so `scripts/run-tests.mjs` takes this lock before it runs the suite and waits while another
 * gate holds it.
 *
 * The lock is a folder, `gate.lock`, made with `mkdir`, which is atomic on every platform: the
 * first caller creates it and the rest see EEXIST. Inside it `owner.json` names the pid, so a
 * gate that was killed (the lock is released on exit, but a killed process does not exit) is
 * recognised as stale by its pid no longer running, and taken over. The folder is
 * `GRAFT_GATE_LOCK_DIR`, else one under the temp directory, which every session of one user
 * shares.
 */
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOCK_NAME = "gate.lock";
const OWNER_FILE = "owner.json";
/** How long a lock folder with no readable owner file counts as being written: the owner
 * file follows the `mkdir` by microseconds, so an older bare folder was left by a crash. */
const OWNERLESS_GRACE_MS = 10_000;
const DEFAULT_POLL_MS = 5_000;
/** How often a waiting gate says what it is waiting for. */
const REPORT_EVERY_MS = 60_000;

/** The folder the lock lives in. */
export function gateLockDir(env = process.env) {
  return env.GRAFT_GATE_LOCK_DIR || join(tmpdir(), "graft-gate-lock");
}

/** Whether a process with this pid is running. EPERM means it is, under another user. */
export function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e?.code === "EPERM";
  }
}

function readOwner(lockPath) {
  try {
    const owner = JSON.parse(readFileSync(join(lockPath, OWNER_FILE), "utf8"));
    return Number.isInteger(owner?.pid) ? owner : null;
  } catch {
    return null;
  }
}

/** Why the lock at `lockPath` may be taken over, or null while its owner holds it. */
function staleReason(lockPath, isAlive, now) {
  const owner = readOwner(lockPath);
  if (owner) return isAlive(owner.pid) ? null : `stale lock of pid ${owner.pid} (not running)`;
  try {
    return now() - statSync(lockPath).mtimeMs > OWNERLESS_GRACE_MS ? "stale lock with no owner file" : null;
  } catch {
    return "lock folder gone"; // released between the failed mkdir and now: just retry
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Take the lock, waiting while a live gate holds it. Resolves to a handle for
 * {@link releaseGateLock}; rejects, naming the holder, once `timeoutMs` has passed (default:
 * wait for ever). `isAlive`, `now`, `pid` and `onStale`/`onWait` are injectable for the tests.
 */
export async function acquireGateLock({
  dir = gateLockDir(),
  pid = process.pid,
  isAlive = pidAlive,
  now = Date.now,
  pollMs = DEFAULT_POLL_MS,
  timeoutMs = Infinity,
  onStale = () => {},
  onWait = () => {},
} = {}) {
  const path = join(dir, LOCK_NAME);
  mkdirSync(dir, { recursive: true });
  const started = Date.now();
  let lastReport = 0;
  for (;;) {
    try {
      mkdirSync(path);
      writeFileSync(join(path, OWNER_FILE), JSON.stringify({ pid, cwd: process.cwd(), started: new Date().toISOString() }));
      return { path, pid };
    } catch (e) {
      if (e?.code !== "EEXIST") throw e;
    }
    const stale = staleReason(path, isAlive, now);
    if (stale) {
      // Look again just before removing: another waiting gate may have taken it over already.
      if (staleReason(path, isAlive, now)) {
        onStale(`${stale}, taking it over`);
        rmSync(path, { recursive: true, force: true });
      }
      continue;
    }
    const owner = readOwner(path);
    const held = owner ? `held by pid ${owner.pid} in ${owner.cwd}` : "held (owner not yet written)";
    if (Date.now() - started >= timeoutMs) throw new Error(`gate lock ${path} ${held}; gave up after ${timeoutMs} ms`);
    if (Date.now() - lastReport >= REPORT_EVERY_MS) {
      onWait(`waiting for the gate lock ${path}, ${held}`);
      lastReport = Date.now();
    }
    await sleep(pollMs);
  }
}

/** Release a lock from {@link acquireGateLock}, unless another gate has taken it over since. */
export function releaseGateLock(lock) {
  const owner = readOwner(lock.path);
  if (owner && owner.pid !== lock.pid) return;
  rmSync(lock.path, { recursive: true, force: true });
}
