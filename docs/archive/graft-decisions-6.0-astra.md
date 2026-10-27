**Yes, these could improve Graft, chiefly by selecting better context before it reaches the main model. They would not automatically fix Codex’s preloaded instruction or tool-schema overhead.**

## Availability In Codex

As of **8 October 2026**, OpenAI’s Decisions API is already available in **public beta**, launched on 6 October. It currently uses `gpt-6-luna`; OpenAI says general availability is expected “in the coming weeks.” That is an API timeline, not a promised Codex integration date. [API changelog](https://developers.openai.com/api/docs/changelog), [Decisions guide](https://developers.openai.com/api/docs/guides/decisions)

There are two different meanings of “within Codex”:

- **Codex calling Decisions as a tool:** possible now through a script or custom MCP integration, with API credentials and applicable API billing. Codex supports external tools through MCP. [MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- **Codex automatically using Decisions internally:** I found no published switch or rollout date for making it control Codex’s context loading, tool selection, or model routing. Selecting **Sol / medium** does not enable that integration.

## The Options

Cloudflare’s product is **Clef**, without the final “t.”

These services evaluate supplied evidence against predefined choices, conditions, or scoring rubrics. They are not substitutes for a general-purpose model that writes explanations and code.

| Service | Published input price, USD per million tokens | Potential attraction |
|---|---:|---|
| OpenAI Decisions, GPT-6 Luna | **$0.10** | Text/image decisions; straightforward option for an OpenAI-based integration. [Docs](https://developers.openai.com/api/docs/guides/decisions) |
| TypeSafe Jev | **$0.042** | Very low published price for structured decisions; launch pricing should be confirmed against the actual provider used. [TypeSafe announcement](https://typesafe.ai/blog/introducing-system-one-models-and-jev) |
| Cloudflare Clef-flash | **$0.09** | Smaller, latency-oriented multimodal decision model. [Model documentation](https://developers.cloudflare.com/workers-ai/models/clef-flash/) |
| Cloudflare Clef | **$0.24** | Larger multimodal decision model. [Model documentation](https://developers.cloudflare.com/workers-ai/models/clef/) |

OpenAI and TypeSafe state that decision outputs have no output-token charge. OpenAI’s regional and long-context adjustments can still apply. Cloudflare also releases Clef’s weights under Apache 2.0, allowing local hosting, although hardware and operating costs remain. [OpenAI pricing details](https://developers.openai.com/api/docs/guides/decisions#pricing-and-availability), [Cloudflare announcement](https://blog.cloudflare.com/clef-decision-models/)

**Published speed claims are not Graft benchmarks.** OpenAI reports approximately 10× faster decisions than its Responses API; that does not imply a 10× faster indexing or coding workflow.

## Where Graft Benefits

For the structural and deep-semantic layers we inspected, my assessment is:

| Graft operation | Potential improvement | Important limitation |
|---|---|---|
| Parse files, resolve imports, trace calls | Little or none | Existing deterministic code is cheaper and more dependable for these jobs. |
| Rank retrieved snippets | **Strong candidate** | Score a small candidate set, then send only the best evidence to Codex. |
| Decide which changed files need deep analysis | Potentially useful | Graft already reuses hash-based caches; don’t pay a model to rediscover unchanged files. |
| Classify proposed semantic relationships | Useful experiment | Select among defined relation types, including “none/uncertain”; preserve supporting source spans. |
| Write summaries and discover new concepts | Not a replacement | Decision models return bounded answers, not the prose and open-ended extraction this requires. |
| Choose tools or optional instruction packs | Useful in a wrapper we control | Cannot remove material that Codex has already injected into its own prompt. |

The semantic-link distinction matters: a decision model could assess **“Does passage A support claim B?”** when both are supplied. It cannot make that relationship trustworthy merely by returning high confidence. Keep the evidence, distinguish inferred links from parser-proven links, and validate thresholds on real examples.

For this book project, **indexing the manuscript and research material remains the higher-priority prerequisite**. A better reranker cannot retrieve chapters, citations, or research passages absent from the candidate index.

## The Integration I Recommend

Start with **one optional reranking stage**, not a replacement for Graft:

```text
Question ? Graft candidate retrieval ? optional decision scorer
         ? compact evidence with source locations ? Codex
```

Implement it inside a small retrieval wrapper, so Codex receives only the final evidence bundle. Adding separate, verbose decision tools to every conversation could undermine the context savings.

The wrapper should:

1. Use ordinary rules and Graft’s existing caches first.
2. Send only bounded candidate snippets to the decision service.
3. Cache results using content, query, model, and rubric versions.
4. Preserve essential dependencies and provide a fallback when scoring fails or is uncertain.
5. Measure answer quality, missed evidence, end-to-end latency, main-model tokens, and external API cost against unmodified Graft.

A decision call can make retrieval **slower** if it adds a network round trip without avoiding subsequent work. Its net benefit must exceed its own cost, latency, and error-related retries.

For scale, **10,000 billed input tokens cost $0.001 through OpenAI Decisions at its base rate**. That makes experimentation inexpensive, but does not establish how much Codex usage it will save.

**My recommendation:** prototype with OpenAI Decisions if you already have suitable API access; compare Jev and Clef-flash on the same representative tasks before choosing. Keep the adapter provider-neutral. Prioritize document coverage and compact retrieval first, then add decision scoring where measurements show a benefit. None of these requires changing your main Codex model from Sol / medium.