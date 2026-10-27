/**
 * `graft version` / `graft --version` / `graft upgrade` support.
 *
 * Split out of cli.ts so the formatting helpers can be unit-tested with
 * injected results instead of hitting the network from tests.
 */
import { existsSync, readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { toPosixPath } from "./util/paths.js";
import { brand, PACKAGE_FOR } from "./brand.js";

/** Locates package.json relative to a module URL (works for both `dist/cli.js`
 * running one level under the published package root, and `src/cli.ts` running
 * one level under the repo root via tsx). */
export function resolvePackageJsonPath(moduleUrl: string): string {
  const moduleDir = dirname(fileURLToPath(moduleUrl));
  const candidates = [resolve(moduleDir, "..", "package.json"), resolve(moduleDir, "package.json")];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

/**
 * The npm package this code was installed as: `@trailhq/trail-code`, or
 * `@nanonets/graft` (the same code under its old name). Upgrades and update
 * checks go to the package actually installed, not to the name typed.
 */
export function readPackageName(moduleUrl: string): string {
  try {
    const pkg = JSON.parse(readFileSync(resolvePackageJsonPath(moduleUrl), "utf8")) as { name?: string };
    return pkg.name ?? PACKAGE_FOR.graft;
  } catch {
    return PACKAGE_FOR.graft;
  }
}

const PKG_NAME = readPackageName(import.meta.url);

/**
 * The `fork` object in package.json that marks a build as someone's own build of this
 * package. Data, not a comparison against a name: a fork's release step writes it, and
 * every place that would send a person to upstream's `upgrade` reads it instead.
 */
export interface ForkMarker {
  /** The npm package this build forks, whose newer releases the update check reports. */
  upstream: string;
  /** The command, run from the fork's repository, that installs this build. */
  install: string;
  /** The folder holding the fork's release tarballs, named relative to the repository's parent. */
  releases?: string;
}

/** The fork marker in the package.json this module belongs to, or null when the build is unmarked
 * or the marker lacks an upstream package or an install command. */
export function readForkMarker(moduleUrl: string): ForkMarker | null {
  try {
    const pkg = JSON.parse(readFileSync(resolvePackageJsonPath(moduleUrl), "utf8")) as { fork?: Partial<ForkMarker> | null };
    const fork = pkg.fork;
    if (!fork || typeof fork !== "object") return null;
    if (typeof fork.upstream !== "string" || !fork.upstream || typeof fork.install !== "string" || !fork.install) return null;
    return {
      upstream: fork.upstream,
      install: fork.install,
      ...(typeof fork.releases === "string" && fork.releases ? { releases: fork.releases } : {}),
    };
  } catch {
    return null;
  }
}

/** Reads the version of the graft package this module was loaded from. */
export function readCurrentVersion(moduleUrl: string): string {
  const raw = readFileSync(resolvePackageJsonPath(moduleUrl), "utf8");
  const pkg = JSON.parse(raw) as { version?: string };
  return pkg.version ?? "0.0.0";
}

/** True when the running module lives under an npx cache dir (e.g.
 * `~/.npm/_npx/<hash>/node_modules/...`) rather than a regular global install.
 *
 * Normalized first: `fileURLToPath` returns the *platform* separator, so on
 * Windows the cache path is `…\_npx\…` and a bare `includes("/_npx/")` is always
 * false — `graft upgrade` would then run `npm install -g` on top of an npx run.
 * Same hardcoded-`/` mistake as #33; `src/util/paths.ts` exists for exactly this. */
export function isRunningViaNpx(moduleUrl: string): boolean {
  return toPosixPath(fileURLToPath(moduleUrl)).includes("/_npx/");
}

export interface NpmViewResult {
  ok: boolean;
  version?: string;
}

/** `npm view <pkg> version`, offline-safe: any failure (no npm, no network,
 * timeout) resolves to `{ ok: false }` rather than throwing. Through the shell on
 * Windows, where npm is `npm.cmd` and a bare spawn is ENOENT (as `globalRoot` does). */
export function getNpmViewVersion(pkgName: string = PKG_NAME, timeoutMs = 2000): NpmViewResult {
  try {
    const args = ["view", pkgName, "version"];
    const opts = { encoding: "utf8" as const, timeout: timeoutMs, windowsHide: true };
    // One command string under the shell (an args array with `shell` is deprecated, DEP0190),
    // only for a name shaped like npm's own (`@scope/name`), which the shell reads literally.
    const res =
      process.platform === "win32" && /^[@\w./-]+$/.test(pkgName)
        ? spawnSync(`npm ${args.join(" ")}`, { ...opts, shell: true })
        : spawnSync("npm", args, opts);
    if (res.error || res.signal || res.status !== 0) return { ok: false };
    const version = res.stdout?.trim();
    if (!version) return { ok: false };
    return { ok: true, version };
  } catch {
    return { ok: false };
  }
}

/** Pure formatter for `graft version`: no I/O, easy to unit-test. A fork build reports
 * upstream's release without pointing at `upgrade`, which would replace the fork. */
export function formatVersionReport(current: string, latest: NpmViewResult, fork: ForkMarker | null = null): string {
  const lines = [`${brand()} ${current}`];
  if (!latest.ok || !latest.version) {
    lines.push("latest: unreachable (offline?)");
  } else if (latest.version === current) {
    lines.push(`latest on npm: ${current} ✓ up to date`);
  } else if (fork) {
    lines.push(`latest on npm: ${latest.version} (${fork.upstream}); this build is a fork, and merging that release is the operator's decision`);
  } else {
    lines.push(`latest on npm: ${latest.version}, run ${brand()} upgrade`);
  }
  return lines.join("\n");
}

/** The global npm node_modules dir (handles Homebrew/Windows/volta layouts). */
function globalRoot(): string | null {
  try {
    const root = execFileSync("npm", ["root", "-g"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell: process.platform === "win32",
    }).trim();
    return root || null;
  } catch {
    return null;
  }
}

/** Reads the version actually sitting in the global install, straight from
 * disk — more reliable right after `npm install -g` than re-querying the
 * registry (which just tells you what "latest" is, not what landed locally). */
export function readGlobalInstalledVersion(pkgName: string = PKG_NAME): string | null {
  const root = globalRoot();
  if (!root) return null;
  const pkgJson = join(root, ...pkgName.split("/"), "package.json");
  if (!existsSync(pkgJson)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgJson, "utf8")) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

export interface UpgradeResult {
  /** True when `npm install -g` actually ran (false for the npx no-op path). */
  ran: boolean;
  ok: boolean;
  /** Present when ran=true and the install failed. */
  errorMessage?: string;
  oldVersion?: string;
  newVersion?: string;
  /** The `trail` package's version, when `graft upgrade` installed it alongside. */
  trailVersion?: string;
  /** Present when the build is a fork and the upgrade was refused before any npm call. */
  refusedFork?: ForkMarker;
}

/** The refusal a fork build prints in place of an upgrade: what happened, and the fork's own route. */
function formatForkRefusal(oldVersion: string | undefined, fork: ForkMarker): string {
  const lines = [
    `✗ ${brand()} upgrade is off on this build (${oldVersion ?? "?"}): it is a fork of ${fork.upstream}, and npm's latest would replace it with upstream's release.`,
    `To install this fork, run from its repository: ${fork.install}`,
  ];
  if (fork.releases) lines.push(`Its release tarballs are in the folder ${fork.releases}, beside that repository.`);
  return lines.join("\n");
}

/** Pure formatter for a finished upgrade — no I/O, easy to unit-test. */
export function formatUpgradeReport(result: UpgradeResult): string {
  if (result.refusedFork) return formatForkRefusal(result.oldVersion, result.refusedFork);
  if (!result.ran) {
    return (
      `running via npx: npx already fetches the latest ${brand()} on every run.\n` +
      `For a permanent install: npm install -g ${PKG_NAME}`
    );
  }
  if (!result.ok) {
    return `✗ npm install -g ${PKG_NAME}@latest failed${result.errorMessage ? `: ${result.errorMessage}` : ""}`;
  }
  const line = `${brand()} ${result.oldVersion ?? "?"} → ${result.newVersion ?? result.oldVersion ?? "?"}`;
  return result.trailVersion ? `${line}\n✓ trail ${result.trailVersion} installed too: graft keeps working, and trail is its new name` : line;
}

/** Runs `npm install -g @nanonets/graft@latest` (inheriting stdio so the user
 * sees npm's own progress/errors), then re-reads the freshly installed
 * version. No-ops with guidance when running via npx. */
export function runUpgrade(moduleUrl: string): UpgradeResult {
  const oldVersion = readCurrentVersion(moduleUrl);
  // A fork is replaced by upstream's release if npm installs it, so nothing is spawned.
  const fork = readForkMarker(moduleUrl);
  if (fork) return { ran: false, ok: false, oldVersion, refusedFork: fork };
  if (isRunningViaNpx(moduleUrl)) {
    return { ran: false, ok: true, oldVersion };
  }
  // `graft upgrade` is the handover: it also installs the `trail` command, once
  // that package is published. One npm call, so the two land at one version.
  const alongside = PKG_NAME === PACKAGE_FOR.graft && getNpmViewVersion(PACKAGE_FOR.trail).ok ? [`${PACKAGE_FOR.trail}@latest`] : [];
  const res = spawnSync("npm", ["install", "-g", `${PKG_NAME}@latest`, ...alongside], { stdio: "inherit" });
  if (res.error || (res.status ?? 1) !== 0) {
    return { ran: true, ok: false, oldVersion, errorMessage: res.error?.message };
  }
  const newVersion = readGlobalInstalledVersion(PKG_NAME) ?? getNpmViewVersion(PKG_NAME).version ?? oldVersion;
  const trailVersion = alongside.length ? (readGlobalInstalledVersion(PACKAGE_FOR.trail) ?? undefined) : undefined;
  return { ran: true, ok: true, oldVersion, newVersion, trailVersion };
}
