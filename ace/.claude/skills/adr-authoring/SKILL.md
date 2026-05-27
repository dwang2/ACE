---
name: adr-authoring
description: Create or supersede Architectural Decision Records (ADRs). Use whenever the task involves capturing a technical decision in writing — choosing between approaches, adopting a new dependency, defining a system pattern, recording a tradeoff, or formally superseding an earlier decision. Use even when phrased casually ("write up why we picked X", "document this decision", "let's make this official"). ADRs are immutable once merged; this skill enforces that and the standard template.
---

# ADR Authoring

This skill is the canonical way to create Architectural Decision Records on this team. ADRs are short, immutable markdown documents that capture **one decision** along with its context, alternatives, and consequences.

## When to write an ADR

Write an ADR when:

- A decision is hard to reverse (new third-party dependency, public API shape, persistence choice)
- A decision will surprise the next reader (non-obvious tradeoff, going against convention)
- A decision affects multiple services or teams
- A decision supersedes an earlier ADR

Do **not** write an ADR for:

- Routine implementation choices ("use a hashmap here")
- Style/formatting (those live in `kb/04-coding-standards.md`)
- Product/UX decisions (those live in PRDs and UX specs)

If in doubt, write it. ADRs are cheap; lost context is expensive.

## Location and naming

ADRs live in `docs/adr/`. Filename pattern: `<NNNN>-<kebab-case-title>.md` where `NNNN` is a zero-padded monotonic integer.

```bash
# Find next number
ls docs/adr/ 2>/dev/null | grep -E '^[0-9]{4}-' | sort | tail -1
```

If `docs/adr/` does not exist, create it and add an `0000-record-architecture-decisions.md` ADR that establishes the practice itself (you can adapt the template below for that meta-ADR).

## The Template

```markdown
# <NNNN>. <Title in title case, present tense>

- **Status**: Proposed | Accepted | Deprecated | Superseded by [<NNNN>](./<NNNN>-...)
- **Date**: YYYY-MM-DD
- **Deciders**: <names or roles>
- **Consulted**: <names or roles, optional>
- **Informed**: <names or roles, optional>

## Context

<What is the problem? What forces are at play (technical, organizational, regulatory, performance, cost)? Keep to 2–4 paragraphs. The reader in two years needs to understand why this decision was even on the table.>

## Decision

<What did we decide? One paragraph, in active voice. "We will use X for Y because Z." This section is the headline.>

## Alternatives Considered

### Alternative A: <name>
- **Pros**: …
- **Cons**: …
- **Reason not chosen**: …

### Alternative B: <name>
- **Pros**: …
- **Cons**: …
- **Reason not chosen**: …

<At least two alternatives. "We didn't consider any" is almost never true and a red flag.>

## Consequences

### Positive
- …

### Negative
- …

### Neutral / follow-up work
- <Specific tasks created by this decision, ideally linked to Issues>

## References

- Related ADRs: <links>
- Issues / PRDs: <links>
- External docs: <links>
```

## Workflow

1. **Determine the number.** Find the highest existing ADR number and add 1.
2. **Pick a title.** Short, present tense, declarative. "Use Postgres for transactional storage." Not "Postgres vs MySQL discussion."
3. **Draft with status `Proposed`.** Open it as a PR for review.
4. **Capture the discussion in the PR.** If the decision shifts, edit the ADR; that's expected during review.
5. **Merge with status `Accepted`.** Once merged, the ADR is immutable.
6. **To change a past decision: supersede it.** Don't edit the old one. Create a new ADR; set its status to `Accepted` and set the old one's status to `Superseded by <new number>` in a separate small PR.

## Editing rules (immutability)

A merged ADR may only be edited to:
- Fix typos or broken links
- Update its `Status` field (e.g., mark as `Superseded by <NNNN>`)

Substantive changes require a new ADR. This is non-negotiable — the value of ADRs comes from being a stable record.

## Style

- **One decision per ADR.** If you find yourself making two decisions, write two ADRs.
- **Present tense in the title and Decision section.** "Use X." Not "We used X."
- **Be honest about tradeoffs.** Hiding the downsides robs future readers of the context they need.
- **Cite, don't claim.** "Postgres has stronger ACID guarantees than MongoDB for this workload [link to relevant doc]" beats "Postgres is better."
- **Keep it short.** Most ADRs fit on one screen. If you're over two pages, you're probably mixing in design-doc material — split it.

## Example

A minimal good ADR for reference:

```markdown
# 0007. Use Idempotency Keys for ACH Submission

- **Status**: Accepted
- **Date**: 2026-04-15
- **Deciders**: architect, payments-lead

## Context

The ACH submission service is invoked from multiple upstream paths (UI, batch jobs, retries) and a single logical request must not result in duplicate submissions to the bank network. Network and client retries currently risk double-submission. Settlement reversal is expensive and customer-visible.

## Decision

Every ACH submission API call requires an `Idempotency-Key` header (UUID, client-generated). The service deduplicates against a 24-hour Redis window keyed on `(account_id, idempotency_key)`, with a Postgres audit table as the durable record.

## Alternatives Considered

### Alternative A: Server-side dedup on request hash
- **Pros**: No client change required.
- **Cons**: Hash collisions on semantically-identical-but-byte-different requests; harder to debug.
- **Reason not chosen**: Brittle and surprising.

### Alternative B: Database unique constraint on (account_id, request_id)
- **Pros**: Strongly consistent.
- **Cons**: Tightly couples API to schema; requires schema change for every new request shape.
- **Reason not chosen**: Inflexible.

## Consequences

### Positive
- Clear, well-known pattern (RFC-style).
- Decouples retries from correctness.

### Negative
- Clients must generate and persist idempotency keys.
- Redis becomes a hot path for ACH; needs HA setup.

### Follow-up
- Issue #128: implement server-side dedup
- Issue #129: client library helper for key generation
```
