/**
 * Token metering for a run: a {@link ChatModel} decorator that passes every call
 * through unchanged and adds its {@link Usage} to a running total.
 *
 * Responsible for: the sums `graft build --deep` prints and records in the
 * manifest, and the one-line report of them. Deliberately does not price
 * anything: prices are vendor facts and change, so the report is in tokens and
 * the reader applies their own rate.
 *
 * The non-obvious part: totals are kept per instance, and the engine holds one
 * instance for its whole life, so concept, summary and crux calls land in the
 * same sum whichever pass made them.
 */
import type { ChatModel, ChatRequest, ChatResponse, DeepUsage, UsageTotals } from "./types.js";

export function emptyUsageTotals(): UsageTotals {
  return {
    calls: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    reasoningOffCalls: 0,
  };
}

export class MeteredChatModel implements ChatModel {
  readonly label: string;
  private sum: UsageTotals = emptyUsageTotals();

  constructor(private readonly inner: ChatModel) {
    this.label = inner.label;
  }

  async create(req: ChatRequest): Promise<ChatResponse> {
    const res = await this.inner.create(req);
    const u = res.usage;
    this.sum.calls++;
    this.sum.inputTokens += u.input;
    this.sum.cachedInputTokens += u.cacheRead;
    this.sum.cacheWriteTokens += u.cacheCreate;
    this.sum.outputTokens += u.output;
    this.sum.reasoningTokens += u.reasoning ?? 0;
    if (res.reasoningOff) this.sum.reasoningOffCalls++;
    return res;
  }

  /** A copy of the totals so far. Calls that threw are not counted: no usage came back. */
  totals(): UsageTotals {
    return { ...this.sum };
  }
}

/** `12345` → `12,345`, locale-independent so the line is the same on every machine. */
function grouped(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** The deep pass's usage as one indented line under the build summary. */
export function formatUsageLine(u: DeepUsage): string {
  const parts = [`${grouped(u.inputTokens)} input`, `${grouped(u.cachedInputTokens)} cached`];
  if (u.cacheWriteTokens > 0) parts.push(`${grouped(u.cacheWriteTokens)} cache write`);
  const reasoningOut = u.reasoningTokens > 0 ? ` (${grouped(u.reasoningTokens)} reasoning)` : "";
  parts.push(`${grouped(u.outputTokens)} output${reasoningOut}`);
  const level = u.reasoningEffort === null ? "reasoning: provider default" : `reasoning ${u.reasoningEffort}`;
  const calls = `${u.calls} call${u.calls === 1 ? "" : "s"}`;
  let line = `  tokens: ${calls}, ${parts.join(", ")} · ${u.model}, ${level}`;
  if (u.reasoningOffCalls > 0) {
    line += `; ${u.reasoningOffCalls} forced-tool calls ran with reasoning off (the provider refuses both together)`;
  }
  return line;
}
