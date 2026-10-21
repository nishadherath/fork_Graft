/**
 * LSP enrichment tier: registry selection + graceful degradation. These run
 * without any language server installed — they assert the OPT-IN promise that
 * `graft build --lsp` is a safe no-op when no server applies (never a crash,
 * never a mutated graph), which is the contract the build relies on.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickServer, LSP_SERVERS } from "../src/graph/lsp/registry.js";
import { enrichWithLsp } from "../src/graph/lsp/enrich.js";
import type { GraphV1 } from "../src/graph/types.js";

test("pickServer: no languages present → no server", () => {
  assert.equal(pickServer(new Set()), null);
});

test("pickServer: a language no registered server covers → null", () => {
  assert.equal(pickServer(new Set(["cobol", "fortran"])), null);
});

test("registry rows are well-formed (languages, command, languageId)", () => {
  for (const s of LSP_SERVERS) {
    assert.ok(s.languages.length > 0 && s.command && s.languageId, `${s.command} row shape`);
    assert.ok(Array.isArray(s.args), `${s.command} args is an array`);
  }
});

test("enrichWithLsp is a no-op when no server matches the repo's languages", async () => {
  // A graph whose only file is an unsupported language → no server is picked →
  // no process spawned, graph returned unchanged.
  const graph: GraphV1 = {
    meta: { version: 1, nodeCount: 1, edgeCount: 0, languages: ["text"], scopes: [] },
    nodes: [
      { id: "notes.txt", name: "notes.txt", kind: "file", path: "notes.txt", span: "L1-L1",
        signature: null, exported: true, origin: "ast", body_hash: "x", summary_state: "pending", summary: null, crux: null },
    ],
    edges: [],
  };
  const before = graph.edges.length;
  const r = await enrichWithLsp(graph, "/tmp/does-not-matter");
  assert.equal(r.server, null, "no server selected for an unsupported language");
  assert.equal(r.added, 0);
  assert.equal(graph.edges.length, before, "graph edges untouched");
});

test("pickServer finds a server by walking PATH, with PATHEXT on Windows (no shell, no `command -v`)", async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "graft-lsp-path-"));
  try {
    writeFileSync(join(dir, "rust-analyzer.exe"), "");
    const found = pickServer(new Set(["rust"]), { PATH: dir, PATHEXT: ".EXE" }, "win32");
    assert.ok(found, "a .exe on PATH is found on win32");
    assert.match(found.command, /rust-analyzer\.exe$/i);
    assert.equal(pickServer(new Set(["rust"]), { PATH: join(dir, "empty"), PATHEXT: ".EXE" }, "win32"), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("LspClient.initialize gives up as soon as the server process exits, not after the 120 s timeout", { timeout: 30_000 }, async () => {
  // A rustup shim whose component is not installed prints an error and exits a
  // moment AFTER the 50 ms spawn check. The client used to wait out the full
  // initialize timeout, which stalled every `graft build` with LSP on by default.
  const { LspClient } = await import("../src/graph/lsp/client.js");
  const { tmpdir } = await import("node:os");
  const started = Date.now();
  const client = new LspClient(process.execPath, ["-e", "setTimeout(() => process.exit(1), 400)"], tmpdir(), "text");
  const ok = await client.initialize();
  await client.dispose();
  assert.equal(ok, false, "a server that exits is not ready");
  assert.ok(Date.now() - started < 15_000, `gave up in ${Date.now() - started} ms, expected well under the 120 s initialize timeout`);
});
