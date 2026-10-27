# Retrieval evaluation, 2026-10-27 (Stage 31)

The second round, run with `scripts/retrieval-eval.mjs --root` against clones of `main` at `1d93158`
under the temp folder, so no graft command ran in this checkout. Four graphs of the same tree
(9,934 nodes, 1,029 files): one lexical, and one deep pass per reasoning level. Two question sets:
the Stage 22 set (`retrieval-questions.json`, not blind) and the blind set
(`retrieval-questions-blind.json`). "Before" is the CLI at `1d93158`; "after" adds the `ask` fix of
`012328e` (a singular "test" lifts the test de-rank only when it heads a request).

## Result

hit@1 / hit@3 / file@3, each out of 20. Intervals are omitted: at n = 20 a 95% Wilson interval
on 3/20 is 5% to 36%, and on 15/20 it is 53% to 89%.

| Graph | Stage 22 set, before | after | Blind set, before | after |
|---|---|---|---|---|
| Lexical | 1 / 4 / 13 | 1 / 4 / **14** | 0 / 2 / 12 | 0 / 2 / 12 |
| Deep, reasoning none | 5 / 7 / 15 | 5 / 7 / 15 | 3 / 3 / 13 | 3 / 3 / 13 |
| Deep, provider default | 5 / 8 / 16 | 5 / 8 / 16 | 2 / 3 / 13 | 2 / 3 / 13 |
| Deep, reasoning high | 6 / 9 / 15 | 6 / 9 / **16** | 3 / 3 / 12 | 3 / 3 / 12 |

The deep passes, each in its own clone, ran at the same time (19:08 to 19:46 local), with the frozen
CLI and `openai:deepseek-flash`; each summarised 9,359 nodes with 575 pending (the files the crux
pass leaves alone, as in Stage 19):

| Level | Wall clock | `tokens:` line as printed |
|---|---|---|
| none | 29 min 37 s | `2133 calls, 1,057,174 input, 6,067,491 cached, 1,342,512 output · openai:deepseek-flash, reasoning none` |
| provider default | 36 min 46 s | `2137 calls, 3,416,116 input, 3,799,343 cached, 1,857,147 output (405,778 reasoning) · openai:deepseek-flash, reasoning: provider default; 1108 forced-tool calls ran with reasoning off (the provider refuses both together)` |
| high | 37 min 7 s | `2137 calls, 900,106 input, 6,321,116 cached, 1,891,562 output (435,865 reasoning) · openai:deepseek-flash, reasoning high; 1108 forced-tool calls ran with reasoning off (the provider refuses both together)` |

Price them from the provider's list; the fork keeps no price in source.

## What it says

- **The reasoning level makes no measurable difference.** Paired at hit@3, after the fix: Stage 22
  set none 0 : 2 high (exact sign test p = 0.50), none 0 : 1 default (p = 1.0), default 0 : 1 high
  (p = 1.0); blind set 0 : 0 for every pair. At file@3 every pair is within 2 : 2. A difference
  needs at least 6 : 0 to pass p < 0.05 at this size.
- **Reasoning costs 38 to 41 percent more output** (1.86M and 1.89M against 1.34M) and about 7
  more minutes, and reaches only about half the calls: 1,108 of 2,137 are forced-tool calls, which
  this provider will not take with reasoning on, so they ran with it off at every level.
- **Two passes at the same level differ by as much as the levels do.** Stage 22's pass (reasoning
  none, 9,700 nodes) scored the Stage 22 set at hit@3 9/20; today's at the same level scores 7/20.
- **The deep pass's lead on the Stage 22 set does not carry to the blind set.** Lexical to deep,
  hit@3 goes 4 to 7, 8 or 9 on the Stage 22 set and 2 to 3 on the blind set (lexical 1 : 2 deep,
  p = 1.0). Stage 22 suspected that set's wording borrowed from the summaries; this fits.
- **On the blind set ask finds the file and misses the span.** file@3 is 12 or 13 of 20 on every
  graph, hit@3 2 or 3. In 6 blind questions the answer's file is rank 1 and the top hit is the
  whole-file node (3) or a sibling or enclosing span (3), for example `SECURITY.md:L1-L18` for the
  section at L9-L18. This, not the reasoning level, is the next ranking question.

## The three Stage 22 failures

- `test-path-derank`: `wantsTests` matched the word "test" in "How are test files recognised...",
  so the 0.35 test de-rank was off and test-file nodes took ranks 1, 3, 4 and 5. Fixed in
  `012328e`: file rank 6 to 2 on the lexical graph, and from outside the top eight to 3 (high)
  and 4 (none) on the deep graphs. `isTestPath` itself (L206-L208) is
  still outside the top three: its name and comment share only "test", "files" and "rank" with
  the question.
- `stage-cost-projection`: 38 handoffs carry the template heading `## Cost projection`, each a
  real application of the method with the same words (turns, context, output). Lexically 13 of
  them rank above the protocol's "6. Cost projection method" (rank 14); deep, the protocol reaches
  rank 4 or 5. No ranking change: the handoffs are true matches, and telling a method from its
  instances needs a signal the graph does not carry.
- `test-runner-windows`: `scripts/run-tests.mjs` has only a file node. Its name shares no token
  with the question ("run" and "tests" against "runner" and "test"), and its body, the whole
  4,662-character script, is scored by BM25 against an average symbol body far shorter, so the
  length normalisation buries it at rank 53. The `wantsTests` misfire also put
  `test/test-runner-lib.test.ts` first (fixed). The deep graphs find the file at rank 2 through its
  summary. The recorded answer is also partly stale: Stage 28 moved the chunking into
  `scripts/test-runner-lib.mjs`, which ranks 2 lexically and is not an answer. Not changed here: a
  fix (a module header scored as its own short field) changes the `ask` index format.

## Blindness of the new set

Written by a Sonnet subagent with a brief that named no earlier question, in a clone with `.eval/`,
`docs/handoffs/`, `docs/archive/` and `docs/assessment-*.md` deleted. It built its own lexical
graph, read only source with Read, Grep and Glob, used `wiring.json` only to look up the id and
span of an answer it had already chosen, and ran no `ask`, `find` or MCP graft tool. Two overlaps
with the Stage 22 set: `forward-slash-relative-path` has the same answer (`relPosix`, which
`AGENTS.md` names), and `split-long-file-list` is near the old runner question's topic.

## Rerun

```
git clone -q --no-hardlinks <this checkout> %TEMP%\s31\lexical
cd %TEMP%\s31\lexical && node <checkout>\dist\cli.js build
node scripts/retrieval-eval.mjs --root %TEMP%\s31\lexical [--questions .eval/retrieval-questions-blind.json]
```

A deep graph is the same with `GRAFT_REASONING=<level> node <cli> build --deep` in its own clone.
Each harness run takes about 75 seconds here.
