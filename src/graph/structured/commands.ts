/**
 * Command lines inside build and CI files: which package scripts and which files
 * a command runs.
 *
 * Responsible for reading shell-like text (a workflow step's `run`, a shell
 * script, a Dockerfile `RUN`, a Makefile recipe, a `package.json` script) and
 * returning two kinds of reference: a package script by name (`npm run build`,
 * `npm test`) and a script file by path (`node scripts/x.mjs`, `./deploy.sh`).
 * The resolver turns them into `references` edges.
 *
 * What it deliberately does not do: run, expand or interpret the shell. Variables,
 * globs, aliases and inline code (`node -e`, `bash -c`) are left alone, because a
 * guessed target is worse than none.
 *
 * The non-obvious thing: a `cd` (or `pushd`, `Set-Location`) moves the directory
 * every later command runs in, so nothing after one in the same text is reported.
 * Callers pass text that runs in one shell: a whole script, one step, one recipe line.
 */

import type { RawEdge } from "../extract.js";

/** A reference one command makes: a package script, or a file to run. `line` is
 * 0-based within the text given. */
export interface CommandRef {
  kind: "script" | "path";
  target: string;
  line: number;
}

/** Programs that run a script file named by their first path argument. */
const INTERPRETERS: ReadonlySet<string> = new Set([
  "node", "tsx", "ts-node", "bun", "deno", "python", "python3", "py", "bash", "sh", "zsh",
  "pwsh", "powershell", "ruby", "perl",
]);

/** Words that run the command after them unchanged; `&` and `.` are PowerShell's
 * call and dot-source operators. */
const WRAPPERS: ReadonlySet<string> = new Set(["sudo", "npx", "exec", "time", "env", "cross-env", "nohup", "&", "."]);

/** Flags after which the next text is inline code, not a file. */
const INLINE_CODE_FLAGS: ReadonlySet<string> = new Set(["-e", "--eval", "-p", "--print", "-c", "-command", "-encodedcommand"]);

/** npm, yarn and pnpm flags that move the package the script is looked up in. */
const OTHER_PACKAGE_FLAGS = /^(?:--prefix|-C|--cwd|--dir|-w|--workspace|--workspaces|-ws|--filter|-F|-r|--recursive)(?:=|$)/;

/** Scripts npm runs by a subcommand of their own name. */
const NPM_SCRIPT_COMMANDS: Readonly<Record<string, string>> = {
  test: "test", t: "test", tst: "test", start: "start", stop: "stop", restart: "restart",
};

/** A file extension a script is run by. Only these count as a path: `node dist`
 * names a directory and `python -m pkg` a module, neither a file. */
const SCRIPT_EXT = /\.(?:[cm]?[jt]s|[jt]sx|py|sh|bash|ps1|psm1|rb|pl)$/i;

/** Commands that change the working directory. */
const CHANGES_DIRECTORY = /^(?:cd|pushd|set-location|push-location|sl|chdir)$/i;

/** A package script name: npm allows almost anything, but a name here is taken
 * only when it is plain text, never a variable or a quoted expression. */
const SCRIPT_NAME = /^[\w:.@/-]+$/;

function tokens(segment: string): string[] {
  return [...segment.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]!);
}

/** The words of one simple command with environment assignments and wrappers
 * removed, so `CI=1 npx tsx x.ts` reads as `tsx x.ts`. */
function commandWords(segment: string): string[] {
  const words = tokens(segment);
  let i = 0;
  while (i < words.length && (/^[A-Za-z_]\w*=/.test(words[i]!) || WRAPPERS.has(words[i]!.toLowerCase()))) i++;
  return words.slice(i);
}

function scriptOf(words: string[]): string | null {
  const tool = words[0]!.toLowerCase();
  if (tool !== "npm" && tool !== "yarn" && tool !== "pnpm") return null;
  const rest = words.slice(1);
  if (rest.some((w) => OTHER_PACKAGE_FLAGS.test(w))) return null;
  const args = rest.filter((w) => !w.startsWith("-"));
  const sub = args[0];
  if (sub === undefined) return null;
  if (sub === "run" || (tool === "npm" && sub === "run-script")) {
    const name = args[1];
    return name !== undefined && SCRIPT_NAME.test(name) ? name : null;
  }
  return NPM_SCRIPT_COMMANDS[sub] ?? null;
}

function pathOf(words: string[]): string | null {
  const cmd = words[0]!;
  if (/[\\/]/.test(cmd) && SCRIPT_EXT.test(cmd)) return cmd;
  if (!INTERPRETERS.has(cmd.toLowerCase().replace(/\.exe$/, ""))) return null;
  for (const w of words.slice(1)) {
    if (INLINE_CODE_FLAGS.has(w.toLowerCase())) return null;
    if (w.startsWith("-")) continue;
    if (SCRIPT_EXT.test(w) && !/[$*?{}]/.test(w)) return w;
  }
  return null;
}

/** The script and file references in `text`, in order. */
export function commandRefs(text: string): CommandRef[] {
  const out: CommandRef[] = [];
  const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));
  for (let line = 0; line < lines.length; line++) {
    // One logical line: a trailing `\` (or PowerShell's backtick) continues it, and
    // the reference is reported on the line the command starts on.
    let logical = lines[line]!;
    const start = line;
    while (/[\\`]$/.test(logical) && line + 1 < lines.length) logical = `${logical.slice(0, -1)} ${lines[++line]!}`;
    // A comment starts at `#` at the start or after whitespace.
    const code = logical.replace(/(?:^|\s)#.*$/, "");
    for (const segment of code.split(/&&|\|\||[;|]/)) {
      const words = commandWords(segment);
      if (words.length === 0) continue;
      if (CHANGES_DIRECTORY.test(words[0]!)) return out;
      const script = scriptOf(words);
      if (script !== null) {
        out.push({ kind: "script", target: script, line: start });
        continue;
      }
      const path = pathOf(words);
      if (path !== null) out.push({ kind: "path", target: path, line: start });
    }
  }
  return out;
}

/** Raw edges for the references in `text`, which runs in one shell. `ownerOf`
 * maps a 0-based line of `text` to the node the reference hangs off. A script
 * resolves to the nearest package.json's `scripts` key, a path to the one file it
 * can mean (resolve-structured.ts). */
export function commandEdges(rel: string, text: string, ownerOf: (line: number) => string): RawEdge[] {
  return commandRefs(text).map((r): RawEdge =>
    r.kind === "script"
      ? { source: ownerOf(r.line), relation: "references", name: r.target, ref: "script", file: rel }
      : { source: ownerOf(r.line), relation: "references", specifier: r.target, ref: "path", file: rel },
  );
}
