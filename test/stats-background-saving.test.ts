/**
 * `graft stats` counts the saving of a graft command whose output reached the agent through a
 * file (Stage 27, item 2). The harness moves a long `graft ask` to the background, so the Bash
 * tool's response is a notice with no footer and the footer arrives later in a Read of the output
 * file. That Read is a source read, and a source read's payload was never scanned, so the read
 * counted and the saving was lost.
 *
 * The rule under test: a footer-printing graft shell call that returned no footer leaves one
 * footer owed; a later source read whose payload carries a footer pays it, once; and a footer
 * with nothing owed (an agent reading a transcript) counts for nothing. Driven through the
 * hook's own entry point against a temporary repository and session id.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src/claude/hooks.js";
import { readSession } from "../src/claude/state.js";
import { formatSessionStats } from "../src/claude/session-metrics.js";

const FOOTER = "[graft] tokens saved ≈ 13,964 (90%) — this pack ≈ 1,555 tok vs reading the 6 source file(s) whole ≈ 15,519 tok. Estimate.";
const SECOND_FOOTER = "[graft] tokens saved ≈ 2,000 (80%) — this pack ≈ 500 tok vs reading the 2 source file(s) whole ≈ 2,500 tok. Estimate.";
const NOTICE = "Command running in background with ID: bxk3p2. Output is being written to: tasks/bxk3p2.output";
const ASK = 'graft ask "where is the lock taken" --source';
const SESSION = "bg-1";

interface Repo {
  dir: string;
  post(payload: Record<string, unknown>): Promise<void>;
  state(): ReturnType<typeof readSession>;
}

/** A temporary repository and Trail home, with the hook entry point driven through its stdin seam. */
async function withRepo(fn: (repo: Repo) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "graft-bg-saving-"));
  const trailHome = mkdtempSync(join(tmpdir(), "graft-bg-saving-trail-"));
  const savedDir = process.env.CLAUDE_PROJECT_DIR;
  const savedTrail = process.env.TRAIL_HOME;
  process.env.CLAUDE_PROJECT_DIR = dir;
  process.env.TRAIL_HOME = trailHome;
  const repo: Repo = {
    dir,
    async post(payload) {
      process.env.GRAFT_TEST_STDIN = JSON.stringify({ session_id: SESSION, hook_event_name: "PostToolUse", ...payload });
      try {
        await main("tool-savings");
      } finally {
        delete process.env.GRAFT_TEST_STDIN;
      }
    },
    state: () => readSession(dir, SESSION),
  };
  try {
    await fn(repo);
  } finally {
    if (savedDir === undefined) delete process.env.CLAUDE_PROJECT_DIR; else process.env.CLAUDE_PROJECT_DIR = savedDir;
    if (savedTrail === undefined) delete process.env.TRAIL_HOME; else process.env.TRAIL_HOME = savedTrail;
    rmSync(dir, { recursive: true, force: true });
    rmSync(trailHome, { recursive: true, force: true });
  }
}

const bash = (command: string, stdout: string) => ({ tool_name: "Bash", tool_input: { command }, tool_response: { stdout, stderr: "" } });
const read = (file: string, content: string) => ({ tool_name: "Read", tool_input: { file_path: file }, tool_response: { file: { filePath: file, content } } });

test("(a) a backgrounded graft ask whose output is read later counts its saving, once", async () => {
  await withRepo(async (repo) => {
    await repo.post(bash(ASK, NOTICE));
    assert.equal(repo.state().graftReads, 1);
    assert.equal(repo.state().savedTokens, 0, "the notice carries no footer");

    await repo.post(read("tasks/bxk3p2.output", `${FOOTER}\n\n- src/lock.ts:L10-L40 function takeLock`));
    const s = repo.state();
    assert.equal(s.graftReads, 1);
    assert.equal(s.sourceReads, 1);
    assert.equal(s.savedTokens, 13964);

    // graft stats prints the saving.
    assert.match(formatSessionStats({ id: SESSION, ...s }), /tokens saved:\s+~13,964/);
  });
});

test("(b) a second read of the same file adds nothing but a source read", async () => {
  await withRepo(async (repo) => {
    await repo.post(bash(ASK, NOTICE));
    await repo.post(read("tasks/bxk3p2.output", FOOTER));
    await repo.post(read("tasks/bxk3p2.output", FOOTER));
    const s = repo.state();
    assert.equal(s.graftReads, 1);
    assert.equal(s.sourceReads, 2);
    assert.equal(s.savedTokens, 13964);
  });
});

test("(c) the ordinary case is unchanged: the footer in the Bash response counts once, a later Read of it adds nothing", async () => {
  await withRepo(async (repo) => {
    await repo.post(bash(ASK, `${FOOTER}\n\n- src/lock.ts:L10-L40`));
    assert.equal(repo.state().savedTokens, 13964);
    await repo.post(read("notes/saved-output.txt", FOOTER));
    const s = repo.state();
    assert.equal(s.graftReads, 1);
    assert.equal(s.sourceReads, 1);
    assert.equal(s.savedTokens, 13964);
  });
});

test("(d) a footer in a read, with no graft read waiting on one, records nothing", async () => {
  await withRepo(async (repo) => {
    await repo.post(read("docs/transcript.md", `an old session said:\n${FOOTER}`));
    const s = repo.state();
    assert.equal(s.sourceReads, 1);
    assert.equal(s.graftReads, 0);
    assert.equal(s.savedTokens, 0);
  });
});

test("a graft command that never prints a footer leaves nothing owed", async () => {
  await withRepo(async (repo) => {
    await repo.post(bash("graft build", "built 12 nodes"));
    await repo.post(bash("graft status", "code map ok"));
    await repo.post(read("docs/transcript.md", FOOTER));
    assert.equal(repo.state().savedTokens, 0);
  });
});

test("one owed footer pays one footer: a file quoting several counts the first only", async () => {
  await withRepo(async (repo) => {
    await repo.post(bash(ASK, NOTICE));
    await repo.post(read("tasks/bxk3p2.output", `${FOOTER}\n\nearlier:\n${SECOND_FOOTER}`));
    assert.equal(repo.state().savedTokens, 13964);
  });
});

test("two backgrounded asks owe two footers, read in either order", async () => {
  await withRepo(async (repo) => {
    await repo.post(bash(ASK, NOTICE));
    await repo.post(bash('graft grep "takeLock"', NOTICE));
    await repo.post(read("tasks/one.output", FOOTER));
    await repo.post(read("tasks/two.output", SECOND_FOOTER));
    await repo.post(read("tasks/three.output", FOOTER));
    const s = repo.state();
    assert.equal(s.graftReads, 2);
    assert.equal(s.savedTokens, 13964 + 2000);
  });
});

test("reading the output file through the shell pays the owed footer too, so a later Read cannot count it again", async () => {
  await withRepo(async (repo) => {
    await repo.post(bash(ASK, NOTICE));
    await repo.post(bash("cat tasks/bxk3p2.output", FOOTER));
    const afterCat = repo.state().savedTokens;
    assert.equal(afterCat, 13964);
    await repo.post(read("tasks/bxk3p2.output", FOOTER));
    assert.equal(repo.state().savedTokens, afterCat, "the Read finds nothing owed");
  });
});

test("only the commands that print a footer can owe one", async () => {
  const { commandPrintsFooter } = await import("../src/claude/session-metrics.js");
  for (const c of ['graft ask "x" --source', "graft grep foo", "graft skeleton src/a.ts", "graft callers f --depth all", "graft map", "trail ask x", "npx -y @nanonets/graft ask x", "node dist/cli.js ask x", "cd repo && graft ask x | head -5"]) {
    assert.equal(commandPrintsFooter(c), true, c);
  }
  for (const c of ["graft build", "graft status", "graft check", "graft note add", "ls -la", "./mygraft/ask.sh", "echo graft ask"]) {
    assert.equal(commandPrintsFooter(c), false, c);
  }
});

// Stage 32 acceptance: two shapes of the same hazard the fix above did not cover.

test("(e) the output read back through the harness's own output tool counts the saving and no second graft read", async () => {
  await withRepo(async (repo) => {
    await repo.post(bash(ASK, NOTICE));
    await repo.post({
      tool_name: "BashOutput",
      tool_input: { bash_id: "bxk3p2" },
      tool_response: { stdout: `${FOOTER}\n\n- src/lock.ts:L10-L40 function takeLock`, stderr: "", status: "completed" },
    });
    const s = repo.state();
    assert.equal(s.graftReads, 1, "one graft command is one graft read, whatever tool read its output");
    assert.equal(s.sourceReads ?? 0, 0);
    assert.equal(s.savedTokens, 13964);
    assert.equal(s.footersOwed, undefined, "the footer is paid");
  });
});

test("(f) a global option between the command name and ask still owes a footer", async () => {
  await withRepo(async (repo) => {
    await repo.post(bash('graft --dir D:\\maps\\lock ask "where is the lock taken" --source', NOTICE));
    assert.equal(repo.state().footersOwed, 1);
    await repo.post(read("tasks/bxk3p2.output", FOOTER));
    assert.equal(repo.state().savedTokens, 13964);
  });
  const { commandPrintsFooter } = await import("../src/claude/session-metrics.js");
  for (const c of ["graft --dir D:\\maps\\lock ask x", "graft --no-refresh grep foo", "trail --dir ./m -n 3 skeleton src/a.ts", "node dist/cli.js --dir m ask x"]) {
    assert.equal(commandPrintsFooter(c), true, c);
  }
  for (const c of ["graft build && cat ask.txt", "graft --dir m build"]) {
    assert.equal(commandPrintsFooter(c), false, c);
  }
});
