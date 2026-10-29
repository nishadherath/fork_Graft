/**
 * The fork's three changes to the Trail sign-in, end to end through the CLI:
 *
 * 1. `trail logout` (and `logout --workspace` of the last workspace) also removes the user-level
 *    Codex `[mcp_servers.trail]` table that the sign-in wrote, and nothing else of Codex's.
 * 2. `trail login --code` warns after a sign-in when no `trail` command is on PATH.
 * 3. Every sign-in path refuses unless TRAIL_CLOUD=1, before any network call or file write, and
 *    the offer to sign in is silent while it is off.
 *
 * Every child runs under a scratch HOME, so nothing here can touch the real agent configuration.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { readClouds, writeCloud, type Cloud } from "../src/cloud/workspace.js";
import { teamSignInLine } from "../src/cloud/team-file.js";
import { INIT, INITIALIZED, LIST, builtRepo, byId, envWith, rpc } from "./mcp-connector-helpers.js";

const ENTRY = join(process.cwd(), "src", "bin", "trail.ts");
const CODE = "TRL-ABCD-EFGH-IJKL-MNOP";

const OFF = "✗ sign-in to a Trail workspace is off in this build · set TRAIL_CLOUD=1 in your environment to turn it on, then run the command again";
const INIT_NOTE = " · plain trail init sets the repo up without a workspace";
const AGENT_OFF = "[trail] Tell the user that Trail sign-in is off here and that TRAIL_CLOUD=1 turns it on. Don't run trail login again.";
const NO_TRAIL =
  "· no trail command is on PATH: this build's agent entries start trail itself, so Claude Code, Codex and Cursor get no workspace tools until it is installed · npm install -g @nanonets/graft";

function scratch(tag: string): string {
  return mkdtempSync(join(tmpdir(), `login-fork-${tag}-`));
}

/** A child's environment: a scratch HOME and Trail home, the trail name, nothing from the agent or the sign-in switch. */
function envFor(home: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^(path|trail_cloud|trail_test_server|claudecode|claude_code_.*)$/i.test(k)) env[k] = v;
  env.PATH = process.env.PATH;
  return {
    ...env,
    HOME: home,
    USERPROFILE: home,
    TRAIL_HOME: join(home, ".trail"),
    DO_NOT_TRACK: "1",
    TRAIL_INVOKED_AS: "trail",
    TRAIL_NO_FETCH: "1",
    GRAFT_NO_TRAIL_SWITCH: "1",
    ...extra,
  };
}

/** Async on purpose: the stand-in Trail lives in this process and must answer while the child waits. */
function run(args: string[], env: NodeJS.ProcessEnv): Promise<{ status: number | null; out: string; err: string }> {
  return new Promise((ok) => {
    const child = spawn(process.execPath, ["--import", "tsx", ENTRY, ...args], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    const timer = setTimeout(() => child.kill(), 90_000);
    child.on("close", (status) => {
      clearTimeout(timer);
      ok({ status, out, err });
    });
  });
}

interface StandIn {
  url: string;
  requests: string[];
  close(): void;
}

const open: Server[] = [];
after(() => {
  for (const s of open) s.close();
});

/** A stand-in Trail that answers the code claim and keeps the path of every request it gets. */
async function standIn(): Promise<StandIn> {
  const requests: string[] = [];
  const server = createServer((req, res) => {
    requests.push(req.url ?? "");
    req.resume();
    req.on("end", () => {
      res.writeHead(req.url?.endsWith("/login-codes/claim") ? 200 : 404, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          token: "trl_abc",
          user: { name: "Priya", email: "priya@acme.test" },
          workspace: { id: "w1", name: "Acme", slug: "acme", url: "http://127.0.0.1/app/?w=acme", invite_url: "" },
          repos: [],
        }),
      );
    });
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  open.push(server);
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, requests, close: () => server.close() };
}

function cloud(slug: string, linkedAt: number): Cloud {
  return {
    url: "http://127.0.0.1:9",
    token: `trl_${slug}`,
    user: { name: "Priya", email: "priya@acme.test" },
    workspace: { id: `id-${slug}`, name: slug, slug, url: `http://127.0.0.1:9/app/?w=${slug}`, invite_url: "" },
    repos: [],
    linkedAt,
  };
}

function cloudJson(home: string): string {
  return join(home, ".trail", "cloud.json");
}

// --- 3. sign-in is off unless TRAIL_CLOUD=1 ---

test("signInEnabled: only TRAIL_CLOUD=1 turns a new sign-in on", async () => {
  const { signInEnabled } = await import("../src/cloud/workspace.js");
  assert.equal(typeof signInEnabled, "function");
  assert.equal(signInEnabled({ TRAIL_CLOUD: "1" }), true);
  for (const v of [undefined, "", "0", "true", "yes", " 1", "11"]) assert.equal(signInEnabled({ TRAIL_CLOUD: v }), false, JSON.stringify(v));
});

test("trail login in every form refuses without TRAIL_CLOUD=1: no request, no file, exit 1, and the agent line when piped", async () => {
  const trail = await standIn();
  const dir = scratch("repo");
  const forms: string[][] = [
    ["login", dir],
    ["login", dir, "--workspace", "acme"],
    ["login", dir, "--code", CODE, "--server", trail.url],
  ];
  for (const form of forms) {
    const home = scratch("home");
    const r = await run(form, envFor(home));
    assert.equal(r.status, 1, `${form.join(" ")}\n${r.err}`);
    assert.ok(r.err.includes(OFF), r.err);
    assert.ok(r.out.includes(AGENT_OFF), `agent line on a pipe: ${r.out}`);
    assert.equal(existsSync(cloudJson(home)), false, "no token written");
    assert.deepEqual(readdirSync(home), [], "nothing written under HOME");
  }
  assert.deepEqual(trail.requests, [], "Trail was never asked");
});

test("a value other than 1 is off: empty, 0 and true all refuse", async () => {
  const trail = await standIn();
  const dir = scratch("repo");
  for (const value of ["", "0", "true"]) {
    const home = scratch("home");
    const r = await run(["login", dir, "--code", CODE, "--server", trail.url], envFor(home, { TRAIL_CLOUD: value }));
    assert.equal(r.status, 1, `TRAIL_CLOUD=${JSON.stringify(value)}\n${r.err}`);
    assert.ok(r.err.includes(OFF), r.err);
    assert.equal(existsSync(cloudJson(home)), false);
  }
  assert.deepEqual(trail.requests, []);
});

test("the already-signed-in branch of login refuses too, and the existing connection is left alone", async () => {
  const home = scratch("home");
  const env = envFor(home);
  writeCloud(cloud("acme", 1000), env);
  const before = readFileSync(cloudJson(home), "utf8");
  const r = await run(["login", scratch("repo")], env);
  assert.equal(r.status, 1, r.err);
  assert.ok(r.err.includes(OFF), r.err);
  assert.doesNotMatch(r.err, /already signed in/);
  assert.equal(readFileSync(cloudJson(home), "utf8"), before);
});

test("init --connect and --pair refuse first, say plain init works, and write and send nothing", async () => {
  const trail = await standIn();
  for (const [flag, code] of [["--connect", "TRL-7F2A-K9QD"], ["--pair", "X4GM5OQU4NIA65ZR"]] as const) {
    const home = scratch("home");
    const repo = scratch("repo");
    const r = await run(["init", repo, flag, code, "--server", trail.url, "--no-build", "--agents", "claude"], envFor(home));
    assert.equal(r.status, 1, `${flag}\n${r.err}`);
    assert.ok(r.err.includes(OFF + INIT_NOTE), `${flag}: ${r.err}`);
    assert.ok(r.out.includes(AGENT_OFF), r.out);
    assert.deepEqual(readdirSync(repo), [], `${flag}: the repo is untouched`);
    assert.deepEqual(readdirSync(home), [], `${flag}: HOME is untouched`);
  }
  assert.deepEqual(trail.requests, [], "Trail was never asked");
});

test("a machine already connected keeps its connection: logout still works without TRAIL_CLOUD", async () => {
  const home = scratch("home");
  const env = envFor(home);
  writeCloud(cloud("acme", 1000), env);
  const r = await run(["logout"], env);
  assert.equal(r.status, 0, r.err);
  assert.match(r.err, /disconnected from workspace acme/);
  assert.deepEqual(readClouds(env), []);
});

test("while sign-in is off nobody is told to sign in: the hook line and the MCP line are both silent", async () => {
  const dir = await builtRepo();
  mkdirSync(join(dir, ".trail"), { recursive: true });
  writeFileSync(join(dir, ".trail", "workspace.json"), JSON.stringify({ trail: "https://team.trailhq.com", workspace: "acme", name: "Acme" }));
  const home = scratch("home");
  const off = envFor(home);
  const on = envFor(home, { TRAIL_CLOUD: "1" });
  assert.equal(teamSignInLine(dir, off), "");
  assert.match(teamSignInLine(dir, on), /workspace Acme .* login --workspace acme/);

  const quiet = await rpc([INIT, INITIALIZED, LIST], dir, envWith(null, { TRAIL_CLOUD: undefined }), 2);
  assert.doesNotMatch(byId(quiet.rs, 1).result.instructions, /login --workspace|team uses Trail/);
});

// --- 2. the warning when no trail command is on PATH ---

/** A PATH holding only `bin`: node is started by absolute path, so nothing else is needed. */
function pathOf(bin: string, withTrail: boolean): string {
  if (withTrail) {
    writeFileSync(join(bin, "trail.cmd"), "@echo off\r\n");
    writeFileSync(join(bin, "trail"), "#!/bin/sh\n");
    chmodSync(join(bin, "trail"), 0o755);
  }
  return bin;
}

test("login --code signs in, and warns when no trail command is on PATH", async () => {
  const trail = await standIn();
  const home = scratch("home");
  const bin = scratch("bin-none");
  const r = await run(["login", scratch("repo"), "--code", CODE, "--server", trail.url], envFor(home, { TRAIL_CLOUD: "1", PATH: pathOf(bin, false) }));
  assert.equal(r.status, 0, r.err);
  assert.ok(existsSync(cloudJson(home)), "the sign-in itself succeeded");
  assert.match(r.out, /signed in to Trail workspace Acme/);
  assert.ok(r.err.includes(NO_TRAIL), r.err);
});

test("login --code says nothing about PATH when a trail command is installed", async () => {
  const trail = await standIn();
  const home = scratch("home");
  const bin = scratch("bin-trail");
  const r = await run(["login", scratch("repo"), "--code", CODE, "--server", trail.url], envFor(home, { TRAIL_CLOUD: "1", PATH: pathOf(bin, true) }));
  assert.equal(r.status, 0, r.err);
  assert.ok(existsSync(cloudJson(home)));
  assert.doesNotMatch(r.err, /no trail command is on PATH/);
});

test("a trail only in npx's or a project's node_modules/.bin does not count as installed", async () => {
  const trail = await standIn();
  const home = scratch("home");
  const root = scratch("npx");
  const npxBin = join(root, ".npm", "_npx", "a1b2c3", "node_modules", ".bin");
  mkdirSync(npxBin, { recursive: true });
  pathOf(npxBin, true);
  const r = await run(["login", scratch("repo"), "--code", CODE, "--server", trail.url], envFor(home, { TRAIL_CLOUD: "1", PATH: [npxBin, scratch("empty")].join(delimiter) }));
  assert.equal(r.status, 0, r.err);
  assert.ok(r.err.includes(NO_TRAIL), r.err);
});

// --- 1. logout removes the Codex table ---

const CODEX_TOML = `model = "some-model"

[mcp_servers.other]
command = "other"
args = ["serve"]

[mcp_servers.trail]
command = "trail"
args = ["mcp"]

[features]
codex_hooks = true
`;
const CODEX_HOOKS = `{"hooks":{"SessionStart":[{"hooks":[{"type":"command","command":"trail hook session-start"}]}]}}\n`;

function codexHome(): { home: string; config: string; hooks: string } {
  const home = scratch("home");
  mkdirSync(join(home, ".codex"), { recursive: true });
  const config = join(home, ".codex", "config.toml");
  const hooks = join(home, ".codex", "hooks.json");
  writeFileSync(config, CODEX_TOML);
  writeFileSync(hooks, CODEX_HOOKS);
  return { home, config, hooks };
}

test("trail logout removes the Codex trail table and keeps the rest of Codex's files", async () => {
  const { home, config, hooks } = codexHome();
  const env = envFor(home);
  writeCloud(cloud("acme", 1000), env);
  const r = await run(["logout"], env);
  assert.equal(r.status, 0, r.err);
  const text = readFileSync(config, "utf8");
  assert.doesNotMatch(text, /mcp_servers\.trail/);
  assert.match(text, /\[mcp_servers\.other\]\ncommand = "other"/, "a foreign table stays");
  assert.match(text, /^model = "some-model"/m);
  assert.match(text, /\[features\]\ncodex_hooks = true/);
  assert.equal(readFileSync(hooks, "utf8"), CODEX_HOOKS, "Codex's hook entries are never touched");
});

test("logout --workspace removes the Codex table only with the last workspace", async () => {
  const { home, config } = codexHome();
  const env = envFor(home);
  writeCloud(cloud("acme", 1000), env);
  writeCloud(cloud("client", 2000), env);
  const first = await run(["logout", "--workspace", "client"], env);
  assert.equal(first.status, 0, first.err);
  assert.match(readFileSync(config, "utf8"), /\[mcp_servers\.trail\]/, "another workspace is still signed in");
  const last = await run(["logout", "--workspace", "acme"], env);
  assert.equal(last.status, 0, last.err);
  assert.doesNotMatch(readFileSync(config, "utf8"), /mcp_servers\.trail/);
  assert.match(readFileSync(config, "utf8"), /\[mcp_servers\.other\]/);
});

test("logout makes no Codex file where Codex has none, and a config with only our table goes", async () => {
  const bare = scratch("home");
  const env = envFor(bare);
  writeCloud(cloud("acme", 1000), env);
  assert.equal((await run(["logout"], env)).status, 0);
  assert.equal(existsSync(join(bare, ".codex")), false, "no ~/.codex made");

  const empty = scratch("home");
  mkdirSync(join(empty, ".codex"), { recursive: true });
  const alone = join(empty, ".codex", "config.toml");
  writeFileSync(alone, '[mcp_servers.trail]\ncommand = "trail"\nargs = ["mcp"]\n');
  const env2 = envFor(empty);
  writeCloud(cloud("acme", 1000), env2);
  assert.equal((await run(["logout"], env2)).status, 0);
  assert.equal(existsSync(alone), false, "a file that held only the trail table is removed");
});

test("removeCodexToml drops the trail table alone and says whether it found one", async () => {
  const { removeCodexToml } = await import("../src/hosts/mcp-config.js");
  const home = scratch("home");
  const path = join(home, "config.toml");
  assert.equal(removeCodexToml(path), "absent", "no file");
  writeFileSync(path, '[mcp_servers.graft]\ncommand = "graft"\n\n[mcp_servers.other]\ncommand = "other"\n');
  assert.equal(removeCodexToml(path), "absent", "graft's table is not the trail table");
  assert.match(readFileSync(path, "utf8"), /mcp_servers\.graft/);
  writeFileSync(path, CODEX_TOML);
  assert.equal(removeCodexToml(path), "removed");
  assert.doesNotMatch(readFileSync(path, "utf8"), /mcp_servers\.trail/);
  assert.match(readFileSync(path, "utf8"), /mcp_servers\.other/);
});
