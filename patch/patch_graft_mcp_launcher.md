# patch/patch_graft_mcp_launcher.py

Idempotent maintenance script that applies option C of the MCP launcher fix to a stock graft 0.21.1 install, so `graft init` and the session-start refresh always write `graft mcp` and never `npx -y @nanonets/graft mcp`.

- find_dist · function · Locates the dist directory to patch, either from an explicit argv[1] path or by resolving the global npm root so it follows nvm4w node switches, failing loudly if not found.
- patch_mcp_config · function · Replaces the shell-less `spawnSync('graft', ...)` probe and the `GRAFT_MCP_NPX` and `onPath` logic in `dist/hosts/mcp-config.js` with a filesystem `findOnPath` (PATHEXT on Windows, executable bit on POSIX) and a constant `serverEntry()`.
- patch_cli · function · Adds one warning to the `graft init` epilogue in `dist/cli.js` when no `graft` is on PATH.
- verify · function · Guards against a broken patch with `node --check` and, for `mcp-config.js`, a dynamic import; a failure restores both files.
- main · function · Skips an install that is already option C (the fork's own build, or a patched one), otherwise patches both files and verifies.

Fork builds from this repository already carry the fix in source (`src/hosts/mcp-config.ts`); the script is for a fresh `npm i -g @nanonets/graft`. Rewrite each repository's existing `.mcp.json` afterwards by running `graft init` or starting a session there.
