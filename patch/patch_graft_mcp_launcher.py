#!/usr/bin/env python3
"""Re-apply the graft MCP launcher fix (option C) to a stock graft 0.21.1 install.

Why this exists: stock graft decides between `graft mcp` and `npx -y @nanonets/graft
mcp` for the MCP server entry by spawning `graft --version` without a shell. On
Windows the global `graft` is a `graft.cmd` shim, which a shell-less spawn cannot
start (ENOENT), so the probe always fails and every `graft init` and every
session-start refresh writes the unpinned `npx -y` launcher into `.mcp.json`,
`~/.claude.json` and the other hosts' MCP configs. `npx -y` fetches and runs
whatever the npm registry serves at that moment, on every session start.

The patch makes the launcher always the bare `graft mcp` (the operator's option C),
adds `findOnPath` (a filesystem PATH lookup that honours PATHEXT on Windows and the
executable bit on POSIX), removes the GRAFT_MCP_NPX override, and makes `graft init`
print one warning when no `graft` is on PATH. Verified against the compiled output of
graft 0.21.1: dist/hosts/mcp-config.js and dist/cli.js.

Run after `npm i -g @nanonets/graft` or `graft upgrade` replaces dist/:

    python patch/patch_graft_mcp_launcher.py

Then run `graft init` (or start a session) in each repository so its `.mcp.json` is
rewritten; the patch fixes what graft writes from now on, not files already written.

The script is idempotent, locates the global install via `npm root -g` (so it
follows nvm4w node switches), anchors on code shape rather than byte offsets,
verifies with `node --check` plus a dynamic import, and fails loudly instead of
guessing when a future graft version changes internals. It also recognises an install
built from the operator's fork (already option C) and leaves it alone.
Marker written into the file: GRAFT-MCP-LAUNCHER-PATCH.

Debug: pass the install's dist directory as argv[1] to patch that dist instead.
"""

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

MARKER = "GRAFT-MCP-LAUNCHER-PATCH"

NEW_PATH_IMPORT = "import { dirname, delimiter, join } from 'node:path';"

NEW_CODE = (
    "/*" + MARKER + " option C: never write npx. findOnPath is a filesystem lookup because a\n"
    " shell-less spawn cannot start graft.cmd on Windows. Re-apply after graft upgrade:\n"
    " python patch/patch_graft_mcp_launcher.py*/\n"
    "/** Windows' own default when PATHEXT is unset. */\n"
    "const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';\n"
    "export function findOnPath(name, env = process.env, platform = process.platform) {\n"
    "    const win = platform === 'win32';\n"
    "    const dirs = (win ? (env.PATH ?? env.Path ?? '') : (env.PATH ?? '')).split(win ? ';' : delimiter).filter(Boolean);\n"
    "    const exts = win\n"
    "        ? ['', ...(env.PATHEXT ?? DEFAULT_PATHEXT).split(';').filter(Boolean)].map((e) => e.toLowerCase())\n"
    "        : [''];\n"
    "    for (const dir of dirs) {\n"
    "        for (const ext of exts) {\n"
    "            const candidate = join(dir.replace(/^\"|\"$/g, ''), name + ext);\n"
    "            try {\n"
    "                const s = statSync(candidate);\n"
    "                if (s.isFile() && (win || (s.mode & 0o111) !== 0))\n"
    "                    return candidate;\n"
    "            }\n"
    "            catch { /* not here */ }\n"
    "        }\n"
    "    }\n"
    "    return undefined;\n"
    "}\n"
    "/** JSON hosts: `{ command, args }`. Always the bare installed binary. */\n"
    "export function serverEntry() {\n"
    "    return { command: BIN_LAUNCH.command, args: [...BIN_LAUNCH.args] };\n"
    "}\n"
)

CLI_IMPORT = 'import { findOnPath } from "./hosts/mcp-config.js";\n'
CLI_WARNING = (
    "{indent}// The launcher written above is the bare `graft`; say so when it will not resolve.\n"
    "{indent}if (opts.mcp !== false && findOnPath(\"graft\") === undefined)\n"
    "{indent}    say(\"\\u26a0 graft is not on PATH: the MCP server will not start until it is installed \"\n"
    "{indent}        + \"(npm install -g @nanonets/graft)\");\n"
)


def find_dist():
    if len(sys.argv) > 1:
        p = Path(sys.argv[1])
        if not (p / "hosts" / "mcp-config.js").is_file():
            sys.exit(f"FAIL: argv[1] is not a graft dist directory: {p}")
        return p, None
    npm = shutil.which("npm")
    if not npm:
        sys.exit("FAIL: npm not found on PATH; pass the dist directory as argv[1]")
    r = subprocess.run([npm, "root", "-g"], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        sys.exit(f"FAIL: npm root -g exited {r.returncode}: {r.stderr.strip()[:200]}")
    root = Path(r.stdout.strip().splitlines()[-1].strip())
    pkg = root / "@nanonets" / "graft"
    dist = pkg / "dist"
    if not (dist / "hosts" / "mcp-config.js").is_file():
        sys.exit(f"FAIL: graft dist not found at {dist}; is @nanonets/graft installed globally?")
    return dist, pkg


def graft_version(pkg_dir):
    if pkg_dir is None:
        return "unknown"
    try:
        return json.loads((pkg_dir / "package.json").read_text(encoding="utf-8"))["version"]
    except Exception:
        return "unknown"


def read(path):
    with path.open(encoding="utf-8", newline="") as f:
        return f.read()  # newline="" preserves the file's original line endings


def write(path, text):
    with path.open("w", encoding="utf-8", newline="") as f:
        f.write(text)


def verify(path, check_import=True):
    r = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"FAIL: node --check rejected the patched file {path}:\n{r.stderr.strip()[:400]}")
    if not check_import:
        return  # cli.js runs the CLI on import; syntax-check only
    uri = path.resolve().as_uri()
    imp = subprocess.run(
        ["node", "--input-type=module", "-e",
         f"import({uri!r}).then(() => console.log('ok')).catch(e => "
         f"{{ console.error(e.message); process.exit(1) }})"],
        capture_output=True, text=True, timeout=120)
    if imp.returncode != 0:
        sys.exit(f"FAIL: patched file failed to import {path}:\n{imp.stderr.strip()[:400]}")


def patch_mcp_config(text):
    """Return the patched text, or sys.exit with context when the shape differs."""
    eol = "\r\n" if "\r\n" in text else "\n"
    text = text.replace("\r\n", "\n")

    span = re.search(
        r"function graftOnPath\(\) \{.*?export function serverEntry\([^)]*\) \{.*?\n\}\n",
        text, re.S)
    if not span or "spawnSync" not in span.group(0) or "NPX_LAUNCH" not in span.group(0):
        sys.exit("FAIL: graftOnPath/serverEntry not found in the expected shape in "
                 "hosts/mcp-config.js; graft internals changed. Inspect serverEntry in the "
                 "new dist and update this script.")
    text = text[:span.start()] + NEW_CODE + text[span.end():]

    text, n = re.subn(r"^const NPX_LAUNCH = [^\n]*\n", "", text, flags=re.M)
    if n != 1:
        sys.exit("FAIL: NPX_LAUNCH declaration not found exactly once in hosts/mcp-config.js")
    if "spawnSync(" in text:
        sys.exit("FAIL: spawnSync is still used in hosts/mcp-config.js after the patch")
    text = re.sub(r"^import \{ spawnSync \} from 'node:child_process';\n", "", text, flags=re.M)
    if "import { dirname, join } from 'node:path';" not in text:
        sys.exit("FAIL: expected `import { dirname, join } from 'node:path';` in hosts/mcp-config.js")
    text = text.replace("import { dirname, join } from 'node:path';", NEW_PATH_IMPORT, 1)
    if "statSync" not in text.split("export function findOnPath")[0]:
        sys.exit("FAIL: statSync is not imported in hosts/mcp-config.js")
    return text.replace("\n", eol)


def patch_cli(text):
    eol = "\r\n" if "\r\n" in text else "\n"
    text = text.replace("\r\n", "\n")
    imports = list(re.finditer(r"^import [^\n]*;\n", text, re.M))
    if not imports:
        sys.exit("FAIL: no import statements found in cli.js")
    anchor = re.search(r"^([ \t]*)// Record WHICH graft wrote this repo's agent files", text, re.M)
    if not anchor:
        sys.exit("FAIL: the init epilogue anchor ('Record WHICH graft wrote') was not found in "
                 "cli.js; graft internals changed. Update this script.")
    warning = CLI_WARNING.format(indent=anchor.group(1)) + "\n"
    # Insert the later position first so the earlier offset stays valid.
    text = text[:anchor.start()] + warning + text[anchor.start():]
    last = imports[-1]
    text = text[:last.end()] + CLI_IMPORT + text[last.end():]
    return text.replace("\n", eol)


def already_option_c(mcp_text):
    return MARKER in mcp_text or (
        "NPX_LAUNCH" not in mcp_text and "export function findOnPath" in mcp_text)


def main():
    dist, pkg = find_dist()
    mcp_path = dist / "hosts" / "mcp-config.js"
    cli_path = dist / "cli.js"
    print(f"graft {graft_version(pkg)} | {dist}")

    mcp_text = read(mcp_path)
    cli_text = read(cli_path)
    if already_option_c(mcp_text):
        if "findOnPath(" not in cli_text:
            sys.exit("FAIL: mcp-config.js is patched but cli.js lacks the PATH warning; "
                     "restore a stock dist and re-run.")
        verify(mcp_path)
        verify(cli_path, check_import=False)
        print("OK: already option C; verification passed")
        return

    new_mcp = patch_mcp_config(mcp_text)
    new_cli = patch_cli(cli_text)
    write(mcp_path, new_mcp)
    write(cli_path, new_cli)
    try:
        verify(mcp_path)
        verify(cli_path, check_import=False)
    except SystemExit:
        write(mcp_path, mcp_text)  # never leave a half-patched install behind
        write(cli_path, cli_text)
        raise
    print("OK: patch applied to hosts/mcp-config.js and cli.js; "
          "node --check and import verification passed")


if __name__ == "__main__":
    main()
