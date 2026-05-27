# Principles Knowledge Base

Design and engineering principles that span languages and frameworks. Read these when making architectural decisions, designing APIs, or reviewing code for cross-cutting concerns.

## When agents should read these

- **Architect agent**: read the relevant file before writing an ADR or design doc. These are the lenses through which designs get evaluated.
- **Developer agent**: read `solid.md` and `clean-architecture.md` when structuring non-trivial new code. Read `api-design.md` before exposing a new endpoint. Read `distributed-systems.md` when crossing a network boundary.
- **DevOps agent**: read `twelve-factor.md` when adding a service to the deployment pipeline.
- **Product manager**: usually not directly, but useful background.

## Files

| File | Read when |
|---|---|
| `solid.md` | Structuring a module/class/package; reviewing object-oriented design |
| `domain-driven-design.md` | Modeling business logic; defining bounded contexts; naming things |
| `clean-architecture.md` | Layering a non-trivial service; deciding what depends on what |
| `twelve-factor.md` | Building or deploying a service; designing config, logging, processes |
| `api-design.md` | Exposing a new endpoint; versioning; designing error models |
| `distributed-systems.md` | Anything crossing a network: retries, idempotency, consistency |

## Relationship to other KBs

These principles are **language-agnostic**. The `languages/` directory shows how to apply them in a specific language. The `coding-standards.md` file in the root KB enforces the line-by-line rules; this directory captures the bigger-picture rationale.

If a principle here conflicts with what `01-tech-stack.md` says, the tech stack wins for *this team* — but flag the conflict in your response so the architect can decide if the tech stack should change.
