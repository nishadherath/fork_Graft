/**
 * A crux reply whose `id` echoes the whole TARGETS descriptor line
 * ("path#sym | kind | lines L1-L3 | sig") instead of the bare id must still
 * match its node. Several models do this when the file node itself is a
 * target (seen on deepseek-chat, gpt-4.1-mini and gpt-4.1); before the fix the
 * strict id lookup matched nothing and the pass reported a misleading
 * `[empty-parsed, finish_reason=null]` for a reply that was fine.
 *
 * Real ids never contain " | " (they are "path#symbol" or a bare path), so
 * cutting at the first " | " is lossless for every genuine id.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ChatCruxSummarizer } from "../src/ai/crux.js";
import type { ChatModel, ChatRequest, ChatResponse, ToolCall } from "../src/ai/llm/types.js";

class EchoingModel implements ChatModel {
  readonly label = "fake:echo";
  constructor(private readonly symbols: unknown[]) {}
  async create(_req: ChatRequest): Promise<ChatResponse> {
    const call: ToolCall = { id: "c1", name: "record_symbols", args: { symbols: this.symbols } };
    return {
      text: "",
      toolCalls: [call],
      usage: { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 },
      stopReason: "tool_use",
      assistant: { role: "assistant", content: "" },
    };
  }
}

const input = {
  path: "app/run.ts",
  source: "export function run() {\n  return 1;\n}\n",
  nodes: [
    { id: "app/run.ts", kind: "file" as const, signature: null, startLine: 1, endLine: 3 },
    { id: "app/run.ts#run", kind: "function" as const, signature: "run()", startLine: 1, endLine: 3 },
  ],
};

test("an id echoed as the whole TARGETS line is cut back to the bare id", async () => {
  const summarizer = new ChatCruxSummarizer(
    new EchoingModel([
      { id: "app/run.ts | file | lines L1-L3", summary: "The file.", crux_start: 0, crux_end: 0 },
      { id: "app/run.ts#run | function | lines L1-L3 | run()", summary: "Returns one.", crux_start: 2, crux_end: 2 },
    ]),
  );
  const parsed = await summarizer.describeFile(input);
  assert.deepEqual(
    parsed.map((p) => p.id),
    ["app/run.ts", "app/run.ts#run"],
  );
  assert.equal(summarizer.lastMiss, null, "a usable reply must not be classified as a miss");
});

test("a bare id is left exactly as sent", async () => {
  const summarizer = new ChatCruxSummarizer(
    new EchoingModel([{ id: "app/run.ts#run", summary: "Returns one.", crux_start: 2, crux_end: 2 }]),
  );
  const parsed = await summarizer.describeFile(input);
  assert.equal(parsed[0]?.id, "app/run.ts#run");
});
