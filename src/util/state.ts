/**
 * The `graft/.cache/` sidecar state: the statusline's stats snapshot and the
 * build lock that serializes rebuilds.
 *
 * Lives in `util/` rather than `claude/` because two very different callers need
 * it: the Claude Code hooks (which flip `dirty` on an edit and clear it after a
 * background sync) and the graph's own pre-query auto-refresh
 * (`graph/refresh.ts`), which must take the same lock so the two never rebuild
 * on top of each other. `claude/state.ts` re-exports all of this, so nothing
 * outside had to change when it moved.
 */
import { readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, statSync, openSync, writeSync, closeSync, fchmodSync, constants } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, dirname, isAbsolute } from 'node:path';
import { mapDirFor } from '../context/map-dir.js';

export interface Stats {
  nodeCount: number; edgeCount: number; languages: string[];
  totalCount: number; readyCount: number;
  staleCount: number; dirty: boolean; syncing: boolean;
  syncedAt: string | null; lastFile: string | null;
}

export const LOCK_STALE_MS = 300000;

export function emptyStats(): Stats {
  return { nodeCount: 0, edgeCount: 0, languages: [], totalCount: 0, readyCount: 0,
    staleCount: 0, dirty: false, syncing: false, syncedAt: null, lastFile: null };
}

const LOCK_FILE = '.sync.lock';

/**
 * Where the pieces this module manages (the stats cache, the sync lock,
 * per-session state, the upkeep stamp) actually live when no caller-supplied
 * override is available. The Claude Code hooks, `sync-run`, the statusline,
 * and `upkeep` all resolve a bare project dir and never see an explicit
 * `--dir` — unlike a direct CLI invocation, which threads one through
 * `contextDirFor` (`context/node-file.ts`). This mirrors that same override
 * precedence for those entry points: `GRAFT_DIR` wins over the default
 * `<projectDir>/graft`, the same env var `resolveConfig` already honors for
 * the `--deep` LLM path. A relative `GRAFT_DIR` resolves against `projectDir`
 * so it holds regardless of the caller's cwd.
 */
export function resolveContextDir(projectDir: string): string {
  const override = process.env.GRAFT_DIR;
  if (!override) return mapDirFor(projectDir);
  return isAbsolute(override) ? override : join(projectDir, override);
}

export function cacheDir(projectDir: string): string { return join(resolveContextDir(projectDir), '.cache'); }
function statsPath(d: string): string { return join(cacheDir(d), 'stats.json'); }

export function readJson<T>(p: string): T | null {
  try { return JSON.parse(readFileSync(p, 'utf8')) as T; } catch { return null; }
}
/**
 * Write JSON to `p` via a scratch file and a rename, so a concurrent reader sees
 * either the whole old file or the whole new one — never a truncated prefix. The
 * pid in the temp name keeps two concurrent writers off each other's scratch file.
 *
 * `compact` drops the indentation, for the caches only a machine ever opens —
 * it's ~30% of the bytes on a big, deep object.
 *
 * A failed write takes its scratch file with it. Every CLI invocation is a new pid,
 * so the names never collide and never get reused: leaving them behind means a repo
 * that fails this write repeatedly (ENOSPC, or a Windows indexer holding the target
 * open) accumulates one full-size file per attempt, and nothing in graft ever lists
 * `.cache/` to clean them up.
 */
export function writeJsonAtomic(p: string, value: unknown, compact = false, mode?: number): void {
  mkdirSync(dirname(p), { recursive: true });
  // A name no one can guess, opened new-only and never through a link: a link
  // planted where the temp file goes is neither written through nor renamed
  // into place (D85).
  const tmp = `${p}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    // `mode` applies to the new file before it's renamed into place, so a
    // secret is never readable by others even for a moment.
    const fd = openSync(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), mode ?? 0o666);
    try {
      if (mode !== undefined && process.platform !== 'win32') fchmodSync(fd, mode);
      const buf = Buffer.from(compact ? JSON.stringify(value) : JSON.stringify(value, null, 2), 'utf8');
      for (let off = 0; off < buf.length; ) off += writeSync(fd, buf, off, buf.length - off);
    } finally {
      closeSync(fd);
    }
    renameSync(tmp, p);
  } catch (e) {
    try { rmSync(tmp, { force: true }); } catch { /* nothing more we can do */ }
    throw e;
  }
}

export function readStats(d: string): Stats | null { return readJson<Stats>(statsPath(d)); }
export function writeStats(d: string, s: Stats): void { writeJsonAtomic(statsPath(d), s); }

/**
 * Persisted per-repo build configuration. Explicit CLI choices live here so
 * later no-flag builds and automatic refreshes enumerate the same file set.
 * Missing fields always retain backwards-compatible defaults.
 */
export interface BuildConfig {
  /** SKIP_DIRS names to include in this repo's walks, persisted so a LATER
   * no-flag build — and the fingerprint/refresh path, which never sees CLI
   * flags at all — behave identically to the invocation that set it. */
  includeDirs?: string[];
  /** Whether initialized Git submodules (gitlinks) are folded into this repo's
   * graph. Absent/false keeps the historical boundary at the superproject. */
  followSubmodules?: boolean;
  /** Whether nested Git clones the index does not track — how manifest-driven
   * multi-repo tools check dependencies out, and how an ad-hoc local clone lands
   * in the tree — are folded into this repo's graph. Deliberately SEPARATE from
   * `followSubmodules`: a submodule is a dependency the parent pins, a nested
   * clone is invisible to the parent's index and may equally be a scratch
   * checkout someone parked in the tree. Absent/false keeps the historical
   * boundary. */
  followNestedRepos?: boolean;
  /** Whether the structured tier (Markdown, JSON, YAML, TOML, INI and the markup
   * and build families) is part of this repo's graph. On unless `false`:
   * `graft build --no-structured` saves `false`. Persisted so the freshness
   * probe, `check` and the automatic refresh enumerate the same files as the build
   * that chose it. */
  structured?: boolean;
  /** Whether PDF, DOCX, ODT, EPUB, PPTX and ODP files are indexed through a cached
   * text rendering. On unless `false`: `graft build --no-documents` saves `false`.
   * Only takes effect with the structured tier on, whose Markdown scanner reads
   * the rendering. */
  documents?: boolean;
  /** Whether `graft build` adds compiler-grade call edges from a language server
   * found on PATH. On unless `false`: `graft build --no-lsp` saves `false`. Only
   * `build` runs it; the automatic refresh does not. */
  lsp?: boolean;
}

/** Local, Git-ignored repository configuration. Kept outside generated
 * `graft/` output so deleting/replacing that cache, workspace federation, and
 * custom `--dir` builds cannot erase or redirect the persisted choice. */
export const BUILD_CONFIG_DIR = '.graft';

export function buildConfigPath(d: string): string { return join(d, BUILD_CONFIG_DIR, 'config.json'); }

/** Keep local build configuration out of Git without coupling it to the
 * generated graph directory. Best-effort, matching graph-cache ignore setup. */
function ensureBuildConfigIgnored(d: string): void {
  const noGitignore = process.env.GRAFT_NO_GITIGNORE;
  if (noGitignore && noGitignore !== '0' && noGitignore !== 'false') return;
  const path = join(d, '.gitignore');
  let current = '';
  try { current = readFileSync(path, 'utf8'); } catch { /* no .gitignore yet */ }
  const present = current.split('\n').some((line) => {
    const value = line.trim();
    return value === BUILD_CONFIG_DIR || value === `${BUILD_CONFIG_DIR}/` || value === `/${BUILD_CONFIG_DIR}/`;
  });
  if (present) return;
  const gap = current === '' ? '' : current.endsWith('\n') ? '\n' : '\n\n';
  const block = `${gap}# graft's local repository settings — not committed.\n/${BUILD_CONFIG_DIR}/\n`;
  try { writeFileSync(path, current + block); } catch { /* best-effort */ }
}

export function readBuildConfig(d: string): BuildConfig | null { return readJson<BuildConfig>(buildConfigPath(d)); }
export function writeBuildConfig(d: string, c: BuildConfig): void {
  ensureBuildConfigIgnored(d);
  writeJsonAtomic(buildConfigPath(d), c);
}

/** Merge explicit CLI choices into the existing local config, so updating one
 * persisted build option cannot erase another. */
export function patchBuildConfig(d: string, patch: BuildConfig): void {
  writeBuildConfig(d, { ...(readBuildConfig(d) ?? {}), ...patch });
}

/** The persisted `--include-dir` override for repo `d`, as a Set — `undefined`
 * when nothing was ever persisted (or the persisted list is empty), which every
 * `shouldSkipDir`/`walkDir` caller treats as "today's default behavior". Shared
 * by every walkDir-driven entry point (source-files.ts, scopes.ts) so a build,
 * a later no-flag rebuild, and the hooks/refresh path all agree. */
export function readIncludeDirs(d: string): Set<string> | undefined {
  const dirs = readBuildConfig(d)?.includeDirs;
  return dirs && dirs.length ? new Set(dirs) : undefined;
}

/** Missing and explicit false both retain the backwards-compatible default. */
export function readFollowSubmodules(d: string): boolean {
  return readBuildConfig(d)?.followSubmodules === true;
}

/** A default-on switch: the env twin wins in both directions ("0"/"false" is off,
 * any other non-empty value is on, unset or empty defers), then the saved choice,
 * and with neither it is ON. Only an explicit `false` turns it off. */
function defaultOn(envValue: string | undefined, saved: boolean | undefined): boolean {
  if (envValue === '0' || envValue === 'false') return false;
  if (envValue !== undefined && envValue !== '') return true;
  return saved !== false;
}

/** Whether the structured tier is on for repo `d`. On by default; switched off by
 * `--no-structured` (saved) or `GRAFT_STRUCTURED=0`. */
export function readStructured(d: string): boolean {
  return defaultOn(process.env.GRAFT_STRUCTURED, readBuildConfig(d)?.structured);
}

/** Whether the documents tier is on for repo `d`: the structured tier must be on,
 * and then `GRAFT_DOCUMENTS` (the env twin of `--documents`) decides exactly as
 * `GRAFT_STRUCTURED` does, falling back to the saved choice. On by default. */
export function readDocuments(d: string): boolean {
  if (!readStructured(d)) return false;
  return defaultOn(process.env.GRAFT_DOCUMENTS, readBuildConfig(d)?.documents);
}

/** Whether `graft build` runs LSP enrichment for repo `d`. On by default; switched
 * off by `--no-lsp` (saved) or `GRAFT_LSP=0`. With no language server on PATH the
 * pass is a no-op either way. */
export function readLsp(d: string): boolean {
  return defaultOn(process.env.GRAFT_LSP, readBuildConfig(d)?.lsp);
}

/** The documents tier's size cap in bytes: `GRAFT_DOCUMENT_MAX_BYTES` when it is a
 * positive whole number, else `fallback`. `problem` names a value that was set
 * but ignored, so the build can say so instead of silently using the default. */
export function readDocumentMaxBytes(fallback: number): { maxBytes: number; problem?: string } {
  const raw = process.env.GRAFT_DOCUMENT_MAX_BYTES;
  if (raw === undefined || raw.trim() === '') return { maxBytes: fallback };
  const n = Number(raw);
  if (Number.isSafeInteger(n) && n > 0) return { maxBytes: n };
  return {
    maxBytes: fallback,
    problem: `GRAFT_DOCUMENT_MAX_BYTES="${raw}" ignored: expected a positive whole number of bytes, using ${fallback}`,
  };
}

/** Missing and explicit false both retain the backwards-compatible default. */
export function readFollowNestedRepos(d: string): boolean {
  return readBuildConfig(d)?.followNestedRepos === true;
}
// Best-effort read-modify-write; not atomic across concurrent processes, but acceptable
// for episodic hook writes (worst case is a lost update, not corruption).
export function patchStats(d: string, patch: Partial<Stats>): Stats {
  const next: Stats = { ...(readStats(d) ?? emptyStats()), ...patch };
  writeStats(d, next);
  return next;
}

export function acquireLock(d: string): boolean {
  return acquireLockIn(cacheDir(d));
}
export function releaseLock(d: string): void {
  releaseLockIn(cacheDir(d));
}

/**
 * The lock, addressed by cache dir rather than project dir. For the default layout
 * `<root>/graft/.cache` these are the same file, which is the point: the Claude Code
 * hooks lock by project dir and the graph's auto-refresh locks by the context dir it
 * is actually writing, and the two must collide so they can't rebuild at once.
 */
export function acquireLockIn(cache: string): boolean {
  const p = join(cache, LOCK_FILE);
  mkdirSync(cache, { recursive: true });
  const payload = JSON.stringify({ pid: process.pid, at: new Date().toISOString() });
  try {
    writeFileSync(p, payload, { flag: 'wx' }); // atomic exclusive create
    return true;
  } catch (e: any) {
    if (e?.code !== 'EEXIST') throw e;
    let stale: boolean;
    try { stale = Date.now() - statSync(p).mtimeMs >= LOCK_STALE_MS; } catch { stale = true; }
    if (!stale) return false;
    try { rmSync(p); } catch { /* another process reclaimed it */ }
    try { writeFileSync(p, payload, { flag: 'wx' }); return true; }
    catch (e2: any) { if (e2?.code === 'EEXIST') return false; throw e2; }
  }
}
export function releaseLockIn(cache: string): void {
  try { rmSync(join(cache, LOCK_FILE)); } catch { /* already gone */ }
}
