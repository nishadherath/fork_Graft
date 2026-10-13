/**
 * GRAFT_REASONING and deep-pass token usage.
 *
 * The reasoning level reaches the wire on both transports, a server that refuses
 * a forced tool call in thinking mode still gets the call through with reasoning
 * off (and the response says so), a refused value is reported against the
 * variable that set it, and every call's usage is summed by the metering
 * decorator the engine wraps around its model. Stub SDK clients, no network.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import OpenAI from "openai";
import type Anthropic from "@anthropic-ai/sdk";
import { OpenAIChatModel } from "../src/ai/llm/openai.js";
import { AnthropicChatModel } from "../src/ai/llm/anthropic.js";
import { createChatModel } from "../src/ai/llm/factory.js";
import { MeteredChatModel, formatUsageLine } from "../src/ai/llm/metered.js";
import type { ChatModel, ChatRequest, ChatResponse } from "../src/ai/llm/types.js";
import { resolveConfig } from "../src/ai/providers.js";
import { terminalReason } from "../src/ai/failure.js";
import { recordDeepUsage, readManifest, writeManifest, MANIFEST_VERSION } from "../src/context/node-file.js";
import { Graft } from "../src/engine.js";

const THINKING_REFUSAL = "Thinking mode does not support this tool_choice";

function openAiResp(over: Record<string, unknown> = {}): any {
  return {
    choices: [{ message: { content: "ok", tool_calls: [] }, finish_reason: "stop" }],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 40,
      prompt_tokens_details: { cached_tokens: 30 },
      completion_tokens_details: { reasoning_tokens: 25 },
    },
    ...over,
  };
}

function recordingOpenAI(handler: (params: any, n: number) => unknown) {
  const calls: any[] = [];
  const client = {
    chat: {
      completions: {
        create: async (params: any) => {
          calls.push(params);
          return handler(params, calls.length);
        },
      },
    },
  } as unknown as OpenAI;
  return { client, calls };
}

const apiError = (message: string) => new OpenAI.APIError(400, { message }, message, new Headers());

const forcedTool: ChatRequest = {
  messages: [{ role: "user", content: "go" }],
  tools: [{ name: "record", description: "d", parameters: { type: "object" } }],
  responseFormat: { kind: "tool", name: "record" },
};

// --- configuration ----------------------------------------------------------

test("resolveConfig: GRAFT_REASONING is read, trimmed and lower-cased; config wins over env", () => {
  const saved = process.env.GRAFT_REASONING;
  try {
    process.env.GRAFT_REASONING = " High ";
    assert.equal(resolveConfig({}).reasoning, "high");
    assert.equal(resolveConfig({ reasoning: "low" }).reasoning, "low");
    process.env.GRAFT_REASONING = "";
    assert.equal(resolveConfig({}).reasoning, undefined);
    delete process.env.GRAFT_REASONING;
    assert.equal(resolveConfig({}).reasoning, undefined);
  } finally {
    if (saved === undefined) delete process.env.GRAFT_REASONING;
    else process.env.GRAFT_REASONING = saved;
  }
});

test("createChatModel: a reasoning value that is not a single word is refused, naming the variable", () => {
  assert.throws(
    () => createChatModel({ provider: "openai", apiKey: "x", model: "m", reasoning: "very high" }),
    /GRAFT_REASONING="very high"/,
  );
  // A well-formed value is passed through; the server owns the vocabulary.
  assert.doesNotThrow(() => createChatModel({ provider: "openai", apiKey: "x", model: "m", reasoning: "ultra" }));
});

// --- OpenAI-compatible wire -------------------------------------------------

test("openai: a reasoning level is sent as reasoning_effort; unset sends nothing", async () => {
  const set = recordingOpenAI(() => openAiResp());
  await new OpenAIChatModel({ apiKey: "x", model: "m", client: set.client, reasoning: "high" }).create({
    messages: [{ role: "user", content: "hi" }],
  });
  assert.equal(set.calls[0].reasoning_effort, "high");

  const unset = recordingOpenAI(() => openAiResp());
  await new OpenAIChatModel({ apiKey: "x", model: "m", client: unset.client }).create({
    messages: [{ role: "user", content: "hi" }],
  });
  assert.equal("reasoning_effort" in unset.calls[0], false);
});

test("openai: reasoning tokens are reported inside output", async () => {
  const { client } = recordingOpenAI(() => openAiResp());
  const res = await new OpenAIChatModel({ apiKey: "x", model: "m", client }).create({
    messages: [{ role: "user", content: "hi" }],
  });
  assert.deepEqual(res.usage, { input: 70, output: 40, cacheRead: 30, cacheCreate: 0, reasoning: 25 });
});

test("openai: a forced tool refused in thinking mode retries with reasoning off, even when the user set a level", async () => {
  const { client, calls } = recordingOpenAI((_p, n) => {
    if (n === 1) throw apiError(THINKING_REFUSAL);
    return openAiResp({
      choices: [
        {
          message: { content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "record", arguments: "{}" } }] },
          finish_reason: "tool_calls",
        },
      ],
    });
  });
  const res = await new OpenAIChatModel({ apiKey: "x", model: "m", client, reasoning: "high" }).create(forcedTool);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].reasoning_effort, "high");
  assert.equal(calls[1].reasoning_effort, "none");
  assert.equal(res.reasoningOff, true);
  assert.equal(res.toolCalls[0]?.name, "record");
});

test("openai: a reasoning value the server refuses is reported against GRAFT_REASONING", async () => {
  const refusal = "reasoning_effort: unknown variant `bogus`, expected one of `none`, `low`, `high`";
  const { client, calls } = recordingOpenAI(() => {
    throw apiError(refusal);
  });
  const m = new OpenAIChatModel({ apiKey: "x", model: "m", client, reasoning: "bogus" });
  await assert.rejects(
    () => m.create({ messages: [{ role: "user", content: "hi" }] }),
    (err: Error) => /GRAFT_REASONING="bogus"/.test(err.message) && err.message.includes("unknown variant") && /openai:m/.test(err.message),
  );
  assert.equal(calls.length, 1); // no retry loop on a value the server will never accept
  assert.ok(terminalReason(`GRAFT_REASONING="bogus" was refused`), "a refused reasoning value stops the pass at once");
});

test("openai: a 422 refusal of the reasoning value (DeepSeek's status, seen live) is reported the same way", async () => {
  const refusal =
    "Failed to deserialize the JSON body into the target type: reasoning_effort: unknown variant `bogus`";
  const { client } = recordingOpenAI(() => {
    throw new OpenAI.APIError(422, { message: refusal }, refusal, new Headers());
  });
  const m = new OpenAIChatModel({ apiKey: "x", model: "m", client, reasoning: "bogus" });
  await assert.rejects(
    () => m.create({ messages: [{ role: "user", content: "hi" }] }),
    (err: Error) => /GRAFT_REASONING="bogus" was refused/.test(err.message),
  );
});

// --- Anthropic wire ---------------------------------------------------------

function recordingAnthropic() {
  const box: { params?: any } = {};
  const client = {
    messages: {
      create: async (params: any) => (
        (box.params = params),
        { content: [{ type: "text", text: "hi" }], stop_reason: "end_turn", usage: { input_tokens: 5, output_tokens: 2 } }
      ),
    },
  } as unknown as Anthropic;
  return { client, box };
}

test("anthropic: a reasoning level is sent as output_config.effort; none disables thinking", async () => {
  const high = recordingAnthropic();
  await new AnthropicChatModel({ apiKey: "x", model: "c", client: high.client, reasoning: "high" }).create({
    messages: [{ role: "user", content: "hi" }],
  });
  assert.deepEqual(high.box.params.output_config, { effort: "high" });
  assert.equal(high.box.params.thinking, undefined);

  const none = recordingAnthropic();
  await new AnthropicChatModel({ apiKey: "x", model: "c", client: none.client, reasoning: "none" }).create({
    messages: [{ role: "user", content: "hi" }],
  });
  assert.deepEqual(none.box.params.thinking, { type: "disabled" });
  assert.equal(none.box.params.output_config, undefined);

  const unset = recordingAnthropic();
  await new AnthropicChatModel({ apiKey: "x", model: "c", client: unset.client }).create({
    messages: [{ role: "user", content: "hi" }],
  });
  assert.equal(unset.box.params.output_config, undefined);
  assert.equal(unset.box.params.thinking, undefined);
});

test("anthropic: thinking tokens are reported inside output", async () => {
  const client = {
    messages: {
      create: async () => ({
        content: [{ type: "text", text: "hi" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 5, output_tokens: 9, output_tokens_details: { thinking_tokens: 6 } },
      }),
    },
  } as unknown as Anthropic;
  const res = await new AnthropicChatModel({ apiKey: "x", model: "c", client }).create({
    messages: [{ role: "user", content: "hi" }],
  });
  assert.deepEqual(res.usage, { input: 5, output: 9, cacheRead: 0, cacheCreate: 0, reasoning: 6 });
});

// --- metering ---------------------------------------------------------------

function scripted(responses: Array<Partial<ChatResponse>>): ChatModel {
  let i = 0;
  return {
    label: "stub:model",
    async create(): Promise<ChatResponse> {
      const r = responses[i++ % responses.length]!;
      return {
        text: "",
        toolCalls: [],
        stopReason: "stop",
        assistant: { role: "assistant", content: "" },
        usage: { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 },
        ...r,
      };
    },
  };
}

test("MeteredChatModel: sums every call's usage and counts the calls that ran with reasoning off", async () => {
  const m = new MeteredChatModel(
    scripted([
      { usage: { input: 100, output: 40, cacheRead: 30, cacheCreate: 0, reasoning: 25 } },
      { usage: { input: 10, output: 5, cacheRead: 0, cacheCreate: 7 }, reasoningOff: true },
    ]),
  );
  assert.equal(m.label, "stub:model");
  await m.create({ messages: [] });
  await m.create({ messages: [] });
  await m.create({ messages: [] });
  assert.deepEqual(m.totals(), {
    calls: 3,
    inputTokens: 210,
    cachedInputTokens: 60,
    cacheWriteTokens: 7,
    outputTokens: 85,
    reasoningTokens: 50,
    reasoningOffCalls: 1,
  });
});

test("formatUsageLine: one line, digits grouped, the model and the reasoning level named", () => {
  const line = formatUsageLine({
    model: "openai:deepseek-flash",
    reasoningEffort: "high",
    calls: 14,
    inputTokens: 12345,
    cachedInputTokens: 2100,
    cacheWriteTokens: 0,
    outputTokens: 3456,
    reasoningTokens: 1200,
    reasoningOffCalls: 4,
  });
  assert.equal(line.includes("\n"), false);
  assert.match(line, /14 calls/);
  assert.match(line, /12,345 input/);
  assert.match(line, /2,100 cached/);
  assert.match(line, /3,456 output \(1,200 reasoning\)/);
  assert.match(line, /openai:deepseek-flash/);
  assert.match(line, /reasoning high/);
  assert.match(line, /4 forced-tool calls ran with reasoning off/);
  assert.doesNotMatch(line, /cache write/); // zero cache writes are not printed

  const dflt = formatUsageLine({
    model: "m", reasoningEffort: null, calls: 1, inputTokens: 1, cachedInputTokens: 0,
    cacheWriteTokens: 0, outputTokens: 1, reasoningTokens: 0, reasoningOffCalls: 0,
  });
  assert.match(dflt, /reasoning: provider default/);
  assert.doesNotMatch(dflt, /reasoning off/);
});

// --- manifest and engine ----------------------------------------------------

test("recordDeepUsage: adds deepUsage to an existing manifest and leaves the rest alone", () => {
  const dir = mkdtempSync(join(tmpdir(), "graft-usage-"));
  try {
    assert.equal(recordDeepUsage(dir, usageFixture()), false, "no manifest, nothing to record into");
    writeManifest(dir, { version: MANIFEST_VERSION, model: "openai:m", repoDigest: "d", files: [], nodes: [] });
    assert.equal(recordDeepUsage(dir, usageFixture()), true);
    const m = readManifest(dir)!;
    assert.equal(m.model, "openai:m");
    assert.equal(m.repoDigest, "d");
    assert.deepEqual(m.deepUsage, usageFixture());
    assert.ok(readFileSync(join(dir, "manifest.json"), "utf8").endsWith("\n"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Graft.usage: the engine meters the calls its deep pass makes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "graft-usage-engine-"));
  try {
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "a.ts"), "export function add(a: number, b: number) { return a + b; }\n");
    const stub = scripted([{ usage: { input: 11, output: 3, cacheRead: 0, cacheCreate: 0 } }]);
    const engine = new Graft({ chatModel: stub, reasoning: "low" });
    assert.equal(engine.usage().calls, 0);
    await engine.graph(dir, { llm: true, reuse: false });
    const u = engine.usage();
    assert.ok(u.calls > 0, `expected metered calls, got ${u.calls}`);
    assert.equal(u.inputTokens, 11 * u.calls);
    assert.equal(u.model, "stub:model");
    assert.equal(u.reasoningEffort, "low");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function usageFixture() {
  return {
    model: "openai:m",
    reasoningEffort: "high",
    calls: 2,
    inputTokens: 10,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 4,
    reasoningTokens: 1,
    reasoningOffCalls: 0,
  };
}
