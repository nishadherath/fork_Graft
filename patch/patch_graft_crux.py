#!/usr/bin/env python3
"""Re-apply the local graft crux id-echo patch after a graft upgrade.

Why this exists: on `graft build --deep`, any file whose crux TARGETS include the
file node gets back tool-call entries whose `id` is the whole descriptor line
("app/attunement.py | file | lines L1-L36") instead of the bare path. graft's
strict `results.get(node.id)` lookup then matches nothing and the CLI reports a
misleading `[empty-parsed, finish_reason=null]` for a response that was actually
fine. Reproduces on deepseek-chat, gpt-4.1-mini and gpt-4.1, so it is a graft
prompt-format bug, not a provider quirk. Verified present in graft 0.18.0 and
0.21.1 dist. The patch strips the " | ..." suffix from returned ids; real ids
never contain " | ", so it is safe.

Run after `npm i -g @nanonets/graft` or `graft upgrade` replaces dist/:

    python tools/patch_graft_crux.py

The script is idempotent, locates the global install via `npm root -g` (so it
follows nvm4w node switches), anchors on the `parseResults` shape rather than
byte offsets, verifies with `node --check` plus a dynamic import, and fails
loudly instead of guessing when a future graft version changes internals.
Marker written into the file: GRAFT-CRUX-ID-PATCH.

Debug: pass an explicit crux.js path as argv[1] to patch that file instead.
"""

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

MARKER = "GRAFT-CRUX-ID-PATCH"
ANCHOR = re.compile(r"typeof\s+s\.id\s*===\s*[\"']string[\"']")
VULNERABLE = re.compile(r"\bid:\s*s\.id\s*,")
WINDOW = 400  # chars after the anchor in which the vulnerable id line must sit

PATCH = (
    "/*" + MARKER + " models may echo the whole TARGETS descriptor line "
    '("path#sym | kind | lines L..") as the id when the file node is a target; '
    "strip it so strict id lookups match. Re-apply after graft upgrade: "
    "python tools/patch_graft_crux.py*/ "
    'id: s.id.split(" | ")[0].trim(),'
)


def find_crux_js():
    if len(sys.argv) > 1:
        p = Path(sys.argv[1])
        if not p.is_file():
            sys.exit(f"FAIL: argv[1] is not a file: {p}")
        return p, None
    npm = shutil.which("npm")
    if not npm:
        sys.exit("FAIL: npm not found on PATH; pass the crux.js path as argv[1]")
    r = subprocess.run([npm, "root", "-g"], capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        sys.exit(f"FAIL: npm root -g exited {r.returncode}: {r.stderr.strip()[:200]}")
    root = Path(r.stdout.strip().splitlines()[-1].strip())
    p = root / "@nanonets" / "graft" / "dist" / "ai" / "crux.js"
    if not p.is_file():
        sys.exit(f"FAIL: graft crux.js not found at {p}; is @nanonets/graft installed globally?")
    return p, root / "@nanonets" / "graft"


def graft_version(pkg_dir):
    if pkg_dir is None:
        return "unknown"
    try:
        return json.loads((pkg_dir / "package.json").read_text(encoding="utf-8"))["version"]
    except Exception:
        return "unknown"


def verify(path):
    r = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"FAIL: node --check rejected the patched file:\n{r.stderr.strip()[:400]}")
    uri = path.resolve().as_uri()
    imp = subprocess.run(
        ["node", "-e",
         f"import({uri!r}).then(() => console.log('ok')).catch(e => "
         f"{{ console.error(e.message); process.exit(1) }})"],
        capture_output=True, text=True, timeout=60)
    if imp.returncode != 0:
        sys.exit(f"FAIL: patched crux.js failed to import:\n{imp.stderr.strip()[:400]}")


def main():
    path, pkg = find_crux_js()
    with path.open(encoding="utf-8", newline="") as f:
        text = f.read()  # newline="" preserves the file's original line endings
    print(f"graft {graft_version(pkg)} | {path}")

    if MARKER in text or 's.id.split(" | ")' in text:
        verify(path)
        print("OK: already patched; verification passed")
        return

    anchors = list(ANCHOR.finditer(text))
    target = None
    for m in anchors:
        v = VULNERABLE.search(text, m.end(), m.end() + WINDOW)
        if v:
            target = v
            break
    if target is None:
        ctx = text[m.start():m.start() + 220] if anchors else "(anchor absent)"
        sys.exit(
            "FAIL: no vulnerable 'id: s.id,' found near the parseResults anchor; "
            f"graft internals changed. Context near anchor:\n{ctx}\n"
            "Inspect parseResults in the new dist and update this script."
        )
    patched = text[:target.start()] + PATCH + text[target.end():]
    with path.open("w", encoding="utf-8", newline="") as f:
        f.write(patched)
    verify(path)
    print("OK: patch applied; node --check and import verification passed")


if __name__ == "__main__":
    main()
