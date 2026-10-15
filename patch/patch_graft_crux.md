# tools/patch_graft_crux.py · [[graft-cli-crux-id-echo-patch]]

Idempotent maintenance script that re-applies a local patch to graft's dist crux.js so echoed TARGETS descriptor ids are stripped to bare paths, keeping strict id lookups working after a graft upgrade.

- find_crux_js · function · L48-L64 — Locates the crux.js to patch, either from an explicit argv[1] path or by resolving the global npm root so it follows nvm4w node switches, failing loudly if not found.
- graft_version · function · L67-L73 — Reads the installed graft package.json version for logging, degrading to 'unknown' when the package dir is absent or unreadable.
- verify · function · L76-L87 — Guards against writing a broken patch by running node --check and a dynamic import on the patched file, exiting with the error if either fails.
- main · function · L90-L119 — Orchestrates the patch: skips if already patched, otherwise finds the vulnerable 'id: s.id,' near the parseResults anchor and rewrites it with the id-stripping PATCH, then verifies.
