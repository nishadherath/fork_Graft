/**
 * LSP server registry — maps graft language names to a language server command.
 * Only servers whose binary is actually on PATH are eligible; a missing binary
 * simply means that language gets no LSP enrichment (the AST graph stands alone).
 */
import { execSync } from "node:child_process";
import { statSync } from "node:fs";
import { delimiter, join } from "node:path";

/** Windows' own default when PATHEXT is unset. */
const DEFAULT_PATHEXT = ".COM;.EXE;.BAT;.CMD";

/**
 * Filesystem PATH lookup that returns where `name` lives. A spawn cannot do this on
 * Windows: a server installed as a `.cmd` shim is ENOENT to a shell-less spawn.
 * Unlike `commandOnPath` in brand.ts (a yes or no), this honours PATHEXT and the
 * `Path` spelling, and returns the first match, or undefined.
 */
export function findOnPath(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  const win = platform === "win32";
  const dirs = (win ? (env.PATH ?? env.Path ?? "") : (env.PATH ?? "")).split(win ? ";" : delimiter).filter(Boolean);
  const exts = win
    ? ["", ...(env.PATHEXT ?? DEFAULT_PATHEXT).split(";").filter(Boolean)].map((e) => e.toLowerCase())
    : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir.replace(/^"|"$/g, ""), name + ext);
      try {
        const s = statSync(candidate);
        if (s.isFile() && (win || (s.mode & 0o111) !== 0)) return candidate;
      } catch { /* not here */ }
    }
  }
  return undefined;
}

export interface LspServer {
  /** graft language names (as produced by languageLabelOf/genericLangOf) this serves. */
  languages: string[];
  command: string;
  args: string[];
  /** the LSP `languageId` to tag opened documents with. */
  languageId: string;
}

/** First-match-wins; ordering is priority. Extend by adding a row. */
export const LSP_SERVERS: readonly LspServer[] = [
  { languages: ["rust"], command: "rust-analyzer", args: [], languageId: "rust" },
  { languages: ["cpp", "c"], command: "clangd", args: ["--background-index"], languageId: "cpp" },
  { languages: ["go"], command: "gopls", args: [], languageId: "go" },
  { languages: ["python"], command: "pyright-langserver", args: ["--stdio"], languageId: "python" },
  { languages: ["typescript", "javascript", "tsx"], command: "typescript-language-server", args: ["--stdio"], languageId: "typescript" },
];

const resolved = new Map<string, string | null>();
/** Resolve a command to its ABSOLUTE path. On Windows that is a PATH walk with
 * PATHEXT (no shell: `command -v` does not exist in cmd.exe, so the old probe
 * found nothing there and LSP never ran). Elsewhere it is the shell's `command -v`:
 * `spawn` resolves against `process.env.PATH`, which often omits `~/.cargo/bin`,
 * `~/go/bin`, etc. where these servers live, so `command -v` can find a server
 * that `spawn(cmd)` then can't. Spawning the absolute path avoids that mismatch. */
function resolveCommand(cmd: string, env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string | null {
  if (platform === "win32") return findOnPath(cmd, env, platform) ?? null;
  if (resolved.has(cmd)) return resolved.get(cmd)!;
  let abs: string | null = null;
  try { abs = execSync(`command -v ${cmd}`, { encoding: "utf8" }).trim() || null; } catch { abs = null; }
  resolved.set(cmd, abs);
  return abs;
}

/** Pick the highest-priority installed server that covers at least one of the
 * languages present in the repo, with `command` resolved to an absolute path.
 * Returns null if none is installed. `env` and `platform` are injectable for tests. */
export function pickServer(
  languagesPresent: Set<string>,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): LspServer | null {
  for (const s of LSP_SERVERS) {
    if (!s.languages.some((l) => languagesPresent.has(l))) continue;
    const abs = resolveCommand(s.command, env, platform);
    if (abs) return { ...s, command: abs };
  }
  return null;
}
