# Team Charter

**ACE — Agentic Collaborative Engineering.** A team of role-specialized AI agents working on a shared blackboard (GitHub + `docs/`), with the human as orchestrator.

**Architecture**: role-based agents, human-orchestrated, communicating through written artifacts rather than direct agent-to-agent calls. There is no controller agent — you decide which specialist acts when (or let Claude Code route via each agent's `description`). Artifacts (Issues, ADRs, PRs, design docs) are the message bus, which is why "write it down" is the team's first principle. This keeps decisions reviewable and attributable, and persists work beyond any single conversation.

## Mission

Deliver high-quality software through a tightly collaborating team of AI agents, each with a clear role, all coordinating through GitHub as the single source of truth.

## Operating Principles

1. **GitHub is the system of record.** If it's not in an Issue, PR, ADR, or Project, it doesn't exist. Conversation context is lost; written artifacts persist.
2. **Smallest valuable increment wins.** Prefer narrow, shippable slices over big-bang features. Every PR should be reviewable in under 30 minutes.
3. **Write it down once, link to it forever.** Decisions go in ADRs. Requirements go in PRDs/issues. Don't repeat — reference.
4. **Tests are part of the feature.** Code without tests is incomplete. Coverage targets are in `04-coding-standards.md`.
5. **Security and accessibility are not phases.** They are checked at every stage by the agents responsible.
6. **Disagree, decide, document.** When agents disagree, the disagreement and resolution go in the relevant ADR or issue comment.

## Roles and Boundaries

The team is intentionally small. Each role owns its lane; overlap happens at the seams via explicit handoffs.

| Role | Owns | Hands off to |
|------|------|--------------|
| Product Manager | Why and what | Architect (technical design), UX designer (user flows) |
| Architect | How (at the system level) | Developer (implementation), DevOps (infra/CI shape) |
| UX Designer | User experience, IA, accessibility | Developer (implementation), PM (validation) |
| Developer | How (at the code level), test coverage | DevOps (deployment), Architect (design review on novel patterns) |
| DevOps | Build/test/deploy pipelines, infra, observability | Developer (test failures, perf), Architect (capacity/runtime concerns) |

## Workflow at a Glance

```
PM defines need ─▶ Architect drafts approach ─▶ UX designs flow ─▶
Developer implements ─▶ DevOps ships ─▶ PM validates ─▶ Loop
```

In practice these overlap. The architect may pair with the developer during implementation. The PM may pull DevOps in early for non-functional requirements (SLOs, cost ceilings). The point is that **every step produces a written artifact** so the next agent (or a human reviewer) can pick up without re-asking.

## Communication Protocol Between Agents

When one agent hands work to another, the handoff must include:

1. **Link to the source artifact** (issue, PR, ADR, design doc).
2. **What is decided / not decided.**
3. **What the receiving agent should produce.**
4. **Acceptance criteria** — how the producer will know the next step is done.

Example handoff (PM → Architect):
> Issue #128 defines the requirements for ACH retry idempotency. Open questions: deduplication window length, durable storage choice. Please produce an ADR proposing an approach, with at least two alternatives weighed. Acceptance: ADR merged to `docs/adr/` and linked back to #128.
