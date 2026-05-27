# Token Discipline (read this first)

ACE was designed for Claude Pro users where token budget is finite. Every agent and every KB file follows these rules to stay survivable.

## Core rules every agent follows

1. **Read overviews, not full files.** Each KB has a `## TL;DR` section at the top covering the 80% case. Read only that unless the task explicitly needs the deep dive section.
2. **Read only what the task needs.** Never read a KB "just in case." Each agent has a decision table at the top of its prompt that maps task type → files to load.
3. **One agent per artifact when possible.** Don't have three agents read the same PR. Route reviews to one primary reviewer based on what changed.
4. **Trim tool output before it lands in context.** Use `--json` field selection, `head`, `grep`, `--limit`. Never `cat` a file when `head -100` would do.
5. **Cite, don't quote.** When referencing a KB or prior decision, link to it; don't paste it.

## When the user should run `/compact`

`/compact` summarizes conversation history. Use it deliberately, not reactively:

- **Between major phases**: after PM frames an issue and before architect starts; after architect's design accepted and before developer implements
- **When context exceeds ~50K tokens** of accumulated history (Claude Code shows this)
- **Before invoking a fresh agent on a long-running session**

A good rule of thumb: if you can't recall what was discussed three turns ago, `/compact` and proceed.

## Model selection

For Claude Pro:

- **Default to Sonnet.** Use it for PM agent (drafting issues), developer agent (routine fixes, refactors), devops agent (CI tweaks), UX designer.
- **Reserve Opus** for the architect agent on novel designs, complex debugging where you've already failed once on Sonnet, or any task where the cost of being wrong is high.
- **Avoid running all the agents with Opus in one session.** Pro's Opus allocation is small.

## "Lite mode" for trivial tasks

For tasks that don't justify the full team overhead:

- Prefix your request with `[lite]` — the agents will skip KB reads entirely and work from the conversation only.
- Examples: "lite: fix this typo", "lite: rename this variable everywhere", "lite: add a docstring to this function"
- Use `[lite]` aggressively. The default agents are designed for substantial work; many requests are not substantial.

## Tagging your requests

Prefixing requests cues agents on what KBs to load:

| Tag | Meaning | What loads |
|---|---|---|
| `[lite]` | Trivial task | Nothing — just the conversation |
| `[design]` | Architectural work | Architect's design KBs |
| `[security]` | Security-sensitive | Security KB + threat model guidance |
| `[hotfix]` | Production urgent | Minimal — coding standards only |
| (untagged) | Default | Per-agent decision table |

The tags are advisory, not magic. Agents read your tag and decide what to load accordingly.

## Rough budget guide (Claude Pro 5-hour window)

A Pro window comfortably supports:
- **1 medium feature** with full team coordination (PM → Architect → Developer → DevOps validation), OR
- **3–4 small features** in `[lite]` or single-agent mode, OR
- **2–3 deep design sessions** with the architect alone

When you exceed these, you'll hit the rate limit mid-task. Plan accordingly: do the design-heavy work earlier in your window, save routine implementation for later (or for after a `/compact`).

## If you outgrow Pro

The diet in this file roughly halves token spend vs. the original design but Pro is still the floor. If you're using this team for daily work, **Claude Max 5x is the comfortable tier** — the same agents will feel snappy instead of rationed. The behavior is identical; you just get more headroom.
