# Handoffs

One Markdown file per stage, named `YYYY-MM-DD-<stage-slug>.md`. The
newest file by name is the active handoff; `.claude/helpers/operator-protocol.cjs`
announces it at session start. Rules and the projection method:
`docs/operator-protocol.md`.

## Front matter

```yaml
---
stage: "<short stage name>"
model: claude-sonnet-5-5        # exact model id the stage should run on
effort: medium                  # low | medium | high | xhigh | max
status: ready                   # ready | in-progress | done | blocked
created: 2026-10-11
from: "<session or stage that wrote this>"
---
```

A session that takes over a handoff first reads its own configuration
(session tool, `self`) and stops if `model` or `effort` differ from the
front matter, naming the value to pick in the model menu. It sets
`status: in-progress` on starting and `status: done` (with the harness
counts) on finishing, in the same file.

## Body template

```markdown
# <stage name>

## Goal
One paragraph. What done looks like, observably.

## Decisions already made
Bullets. Each with the one-line reason. Do not reopen these.

## Files and links that matter
Bullets with paths and, where useful, line spans. Graft nodes by name.

## Verified facts
Bullets. Each with the command that verified it and the date.

## Work completed
Bullets. Commits by hash.

## Unresolved questions
Bullets. Each with who can answer it (operator, maintainer, a later stage).

## Exact next action
The first command or edit the new session performs. One item.

## Cost projection
Model, assumed turns and context, the arithmetic, the number. API list price.

## Time projection
Wall clock for the stage, and the operator review time separately.
```

Under 120 lines. No conversation history, no dead ends, no repeated
explanations.
