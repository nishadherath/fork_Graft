/**
 * `--version` must not pay for the commands it does not run.
 *
 * Startup time is module loading: each module the CLI imports statically is read,
 * parsed and evaluated before the first command word is looked at. The LLM SDKs
 * (about 350 modules between them), the MCP server, the Claude hooks, the engine
 * and the graph builder are each needed by one command family only, so `cli.ts`
 * and the modules it touches load them inside that command. A loader hook records
 * every URL the process resolves, so this fails on the import that broke it, with
 * the offending module in the message.
 *
 * The source tree always runs (through tsx, so CI needs no build). The built
 * `dist/cli.js` also runs when it exists, because that is what users start.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { homeEnv } from "./helpers.js";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
// A URL, because `node --import` reads a bare Windows path (D:...) as a URL with scheme "d:".
const registerHook = new URL("./resolve-recorder-register.mjs", import.meta.url).href;
const builtCli = join(repoRoot, "dist", "cli.js");

/** Modules a bare `--version` must never load, each with the reason it is expensive or unrelated. */
const FORBIDDEN: Array<[RegExp, string]> = [
  [/\/node_modules\/openai\//, "the OpenAI SDK"],
  [/\/node_modules\/@anthropic-ai\/sdk\//, "the Anthropic SDK"],
  // tool-names is the zero-import list the hooks read; everything else under mcp/ is the server.
  [/\/(?:src|dist)\/mcp\/(?!tool-names\.)/, "the MCP server"],
  [/\/(?:src|dist)\/claude\/hooks\./, "the Claude hooks"],
  // metered and types are SDK-free; only the factory and the adapters import a vendor package.
  [/\/(?:src|dist)\/ai\/llm\/(?:factory|openai|anthropic|litellm|orcarouter)\./, "the LLM adapters"],
  [/\/(?:src|dist)\/engine\./, "the engine"],
  [/\/(?:src|dist)\/graph\/build\./, "the graph builder"],
];

/** Run `<entry> --version` under the resolve recorder and return the version line and every resolved URL. */
function versionRun(entry: string[]): { stdout: string; resolved: string[] } {
  const scratch = realpathSync.native(mkdtempSync(join(tmpdir(), "graft-startup-")));
  const log = join(scratch, "resolved.log");
  const tsx = import.meta.resolve("tsx");
  const res = spawnSync(process.execPath, ["--import", tsx, "--import", registerHook, ...entry, "--version"], {
    cwd: scratch,
    encoding: "utf8",
    timeout: 120_000,
    env: { ...homeEnv(scratch), DO_NOT_TRACK: "1", GRAFT_RESOLVE_LOG: log },
  });
  assert.equal(res.status, 0, `--version failed\n  stdout: ${res.stdout}\n  stderr: ${res.stderr}`);
  const resolved = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
  assert.ok(resolved.length > 0, "the loader hook recorded nothing, so this test would pass for any import graph");
  return { stdout: res.stdout.trim(), resolved };
}

function assertNoForbidden(resolved: string[]): void {
  for (const [pattern, what] of FORBIDDEN) {
    const hit = resolved.find((url) => pattern.test(decodeURIComponent(url)));
    assert.equal(hit, undefined, `--version loaded ${what}: ${hit}`);
  }
}

test("--version from source loads no SDK, MCP server, hooks, engine or graph builder", () => {
  const { stdout, resolved } = versionRun([join(repoRoot, "src", "cli.ts")]);
  assert.match(stdout, /^\d+\.\d+\.\d+/, "prints a version");
  assertNoForbidden(resolved);
});

test(
  "--version from dist/cli.js loads no SDK, MCP server, hooks, engine or graph builder",
  { skip: existsSync(builtCli) ? false : "dist/cli.js is not built (run npm run build)" },
  () => {
    const { stdout, resolved } = versionRun([builtCli]);
    assert.match(stdout, /^\d+\.\d+\.\d+/, "prints a version");
    assertNoForbidden(resolved);
  },
);

test("the recorder sees SDKs when a command that needs them loads", () => {
  // Guards the guard: if the hook silently stopped recording, the tests above would pass for any graph.
  const scratch = realpathSync.native(mkdtempSync(join(tmpdir(), "graft-startup-")));
  const log = join(scratch, "resolved.log");
  const tsx = import.meta.resolve("tsx");
  const probe = join(scratch, "probe.mjs");
  writeFileSync(probe, `await import(${JSON.stringify(new URL("../src/ai/llm/factory.ts", import.meta.url).href)});
`);
  const res = spawnSync(process.execPath, ["--import", tsx, "--import", registerHook, probe], {
    cwd: scratch,
    encoding: "utf8",
    timeout: 120_000,
    env: { ...homeEnv(scratch), GRAFT_RESOLVE_LOG: log },
  });
  assert.equal(res.status, 0, res.stderr);
  const resolved = readFileSync(log, "utf8");
  assert.match(resolved, /node_modules\/openai\//, "the factory pulls in the OpenAI SDK");
  assert.match(resolved, /node_modules\/@anthropic-ai\/sdk\//, "the factory pulls in the Anthropic SDK");
});
