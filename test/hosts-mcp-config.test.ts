import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerMcpConfigs, serverEntry } from '../src/hosts/mcp-config.js';
import { findOnPath } from '../src/graph/lsp/registry.js';

function fresh(): string { return mkdtempSync(join(tmpdir(), 'graft-mcpcfg-')); }

test('cursor/gemini/kiro get repo-local JSON entries', () => {
  const repo = fresh(); const home = fresh();
  const w = registerMcpConfigs(repo, ['cursor', 'gemini', 'kiro'], { home });
  assert.deepEqual(w.map((x) => x.action), ['created', 'created', 'created']);
  const cursor = JSON.parse(readFileSync(join(repo, '.cursor', 'mcp.json'), 'utf8'));
  assert.deepEqual(cursor.mcpServers.graft, { command: 'graft', args: ['mcp'] });
  assert.ok(existsSync(join(repo, '.gemini', 'settings.json')));
  assert.ok(existsSync(join(repo, '.kiro', 'settings', 'mcp.json')));
});

test('existing config keys are preserved; re-run is unchanged', () => {
  const repo = fresh(); const home = fresh();
  mkdirSync(join(repo, '.cursor'), { recursive: true });
  writeFileSync(join(repo, '.cursor', 'mcp.json'), JSON.stringify({ mcpServers: { other: { command: 'x' } } }));
  registerMcpConfigs(repo, ['cursor'], { home });
  const cfg = JSON.parse(readFileSync(join(repo, '.cursor', 'mcp.json'), 'utf8'));
  assert.ok(cfg.mcpServers.other, 'foreign server preserved');
  assert.ok(cfg.mcpServers.graft);
  const again = registerMcpConfigs(repo, ['cursor'], { home });
  assert.deepEqual(again.map((x) => x.action), ['unchanged']);
});

test('unparseable JSON is never clobbered', () => {
  const repo = fresh(); const home = fresh();
  mkdirSync(join(repo, '.cursor'), { recursive: true });
  writeFileSync(join(repo, '.cursor', 'mcp.json'), '{ not json');
  const w = registerMcpConfigs(repo, ['cursor'], { home });
  assert.deepEqual(w.map((x) => x.action), ['skipped-unparseable']);
  assert.equal(readFileSync(join(repo, '.cursor', 'mcp.json'), 'utf8'), '{ not json');
});

test('agents id: codex TOML + opencode JSON, gated on home dirs', () => {
  const repo = fresh(); const home = fresh();
  assert.deepEqual(registerMcpConfigs(repo, ['agents'], { home }), [], 'nothing without home dirs');
  mkdirSync(join(home, '.codex'), { recursive: true });
  mkdirSync(join(home, '.config', 'opencode'), { recursive: true });
  const w = registerMcpConfigs(repo, ['agents'], { home });
  assert.equal(w.length, 2);
  const toml = readFileSync(join(home, '.codex', 'config.toml'), 'utf8');
  assert.match(toml, /^\[mcp_servers\.graft\]$/m);
  assert.match(toml, /^command = "graft"\nargs = \["mcp"\]$/m);
  const oc = JSON.parse(readFileSync(join(repo, 'opencode.json'), 'utf8'));
  assert.equal(oc.mcp.graft.type, 'local');
  const again = registerMcpConfigs(repo, ['agents'], { home });
  assert.deepEqual(again.map((x) => x.action).sort(), ['unchanged', 'unchanged']);
});

test('codex TOML append preserves existing content', () => {
  const repo = fresh(); const home = fresh();
  mkdirSync(join(home, '.codex'), { recursive: true });
  writeFileSync(join(home, '.codex', 'config.toml'), 'model = "o3"\n\n[mcp_servers.other]\ncommand = "x"\n');
  registerMcpConfigs(repo, ['agents'], { home });
  const toml = readFileSync(join(home, '.codex', 'config.toml'), 'utf8');
  assert.match(toml, /model = "o3"/);
  assert.match(toml, /\[mcp_servers\.other\]/);
  assert.match(toml, /\[mcp_servers\.graft\]/);
});

test('grok gets a repo-local TOML MCP section', () => {
  const repo = fresh(); const home = fresh();
  const w = registerMcpConfigs(repo, ['grok'], { home });
  assert.deepEqual(w.map((x) => x.action), ['created']);
  const toml = readFileSync(join(repo, '.grok', 'config.toml'), 'utf8');
  assert.match(toml, /^\[mcp_servers\.graft\]$/m);
  assert.match(toml, /^command = "graft"\nargs = \["mcp"\]$/m);
  const again = registerMcpConfigs(repo, ['grok'], { home });
  assert.deepEqual(again.map((x) => x.action), ['unchanged']);
});

test('JSON with non-object mcpServers value is skipped', () => {
  const repo = fresh(); const home = fresh();
  mkdirSync(join(repo, '.cursor'), { recursive: true });
  const badJson = '{"mcpServers": "not-an-object"}';
  writeFileSync(join(repo, '.cursor', 'mcp.json'), badJson);
  const w = registerMcpConfigs(repo, ['cursor'], { home });
  assert.deepEqual(w.map((x) => x.action), ['skipped-unparseable']);
  assert.equal(readFileSync(join(repo, '.cursor', 'mcp.json'), 'utf8'), badJson);
});

// The launch command is always the bare installed binary, whether or not graft is on
// PATH, and never an absolute path: these files are committed and shared between
// machines. The npx form is never written.
test('serverEntry is the bare graft command regardless of PATH or environment', () => {
  const saved = { npx: process.env.GRAFT_MCP_NPX, path: process.env.PATH, Path: process.env.Path };
  const empty = fresh();
  process.env.GRAFT_MCP_NPX = '1';
  process.env.PATH = empty;
  process.env.Path = empty;
  try {
    const e = serverEntry();
    assert.deepEqual(e, { command: 'graft', args: ['mcp'] });
    assert.ok(!/^([/\]|[A-Za-z]:)/.test(e.command), 'never an absolute path: configs get shared');
    // A repo that uses trail gets trail's installed binary, never upstream's npx form.
    assert.deepEqual(serverEntry({ brand: 'trail' }), { command: 'trail', args: ['mcp'] });
  } finally {
    for (const [k, v] of [['GRAFT_MCP_NPX', saved.npx], ['PATH', saved.path], ['Path', saved.Path]] as const) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

// The LSP registry's PATH lookup is a filesystem walk, not a spawn: on Windows a
// global command is a `.cmd` shim that a shell-less spawn cannot see.
test('findOnPath finds a graft.cmd shim on win32 and honours PATHEXT', () => {
  const dir = fresh();
  const empty = fresh();
  writeFileSync(join(dir, 'graft.cmd'), '@echo off\r\n');
  assert.equal(findOnPath('graft', { PATH: dir, PATHEXT: '.CMD' }, 'win32'), join(dir, 'graft.cmd'));
  assert.equal(findOnPath('graft', { PATH: dir, PATHEXT: '.EXE' }, 'win32'), undefined);
  assert.equal(findOnPath('graft', { PATH: empty }, 'win32'), undefined);
  assert.equal(findOnPath('graft', { Path: dir }, 'win32'), join(dir, 'graft.cmd'), 'Windows spells it Path');
});

test('findOnPath requires the executable bit on POSIX', () => {
  const dir = fresh();
  writeFileSync(join(dir, 'graft'), '#!/bin/sh\n');
  chmodSync(join(dir, 'graft'), 0o644);
  assert.equal(findOnPath('graft', { PATH: dir }, 'linux'), undefined, 'not executable');
  chmodSync(join(dir, 'graft'), 0o755);
  // chmod is a no-op on Windows, where every file reads as non-executable here.
  if (process.platform !== 'win32') assert.equal(findOnPath('graft', { PATH: dir }, 'linux'), join(dir, 'graft'));
});
