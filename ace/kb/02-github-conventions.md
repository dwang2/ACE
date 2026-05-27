# GitHub Conventions

All work flows through GitHub. These conventions are mandatory for every agent.

## Repository Layout

```
.
├── .claude/             # Agents and skills (this team)
├── .github/
│   ├── workflows/       # CI/CD pipelines
│   ├── ISSUE_TEMPLATE/  # Issue templates per type
│   └── pull_request_template.md
├── docs/
│   └── adr/             # Architectural Decision Records
├── kb/                  # Shared knowledge base
├── src/                 # Source code
├── tests/               # Tests (mirror src/ structure)
└── README.md
```

## Branching

- **`main`** is always deployable. Protected. Requires PR + CI green + 1 review.
- **Feature branches**: `feat/<issue-number>-short-slug` (e.g., `feat/128-ach-retry-idempotency`)
- **Bugfix branches**: `fix/<issue-number>-short-slug`
- **Chore/infra**: `chore/<short-slug>` or `ci/<short-slug>`
- **Docs only**: `docs/<short-slug>`

Squash-merge to `main`. Branch deleted on merge.

## Commit Messages

[Conventional Commits](https://www.conventionalcommits.org/). Format:

```
<type>(<scope>): <subject>

<body, optional>

<footer with refs, optional>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`, `build`, `revert`.

Example:
```
feat(payments): add idempotency key to ACH retry handler

Adds a 24h dedup window keyed on (account_id, request_id) to prevent
duplicate ACH submissions on retry. Storage backed by Redis with a
Postgres fallback for audit.

Refs: #128
```

## Issues

Every unit of work starts as an issue. Use templates in `.github/ISSUE_TEMPLATE/`:

- **Feature** — user-facing capability. Owner: PM.
- **Tech debt** — internal improvement, no user impact. Owner: any agent.
- **Bug** — observed defect. Owner: whoever found it; assigned by PM.
- **Spike** — time-boxed investigation. Outputs an ADR or doc, not code.

### Required fields on every issue

- **Title**: imperative, specific. "Add idempotency key to ACH retry" not "ACH stuff".
- **Body sections**: Context · Acceptance Criteria · Out of Scope · Links
- **Labels**: type (`feature`/`bug`/...), area (`area:payments`, `area:platform`, ...), priority (`p0`/`p1`/`p2`/`p3`).
- **Milestone** if part of a release.
- **Linked to Project** with status column set.

## Labels (canonical set)

| Category | Labels |
|---|---|
| Type | `type:feature`, `type:bug`, `type:tech-debt`, `type:spike`, `type:docs` |
| Priority | `p0` (drop everything), `p1` (this sprint), `p2` (this quarter), `p3` (someday) |
| Status | `status:blocked`, `status:in-review`, `status:needs-info` |
| Area | `area:<domain>` — kept short, e.g., `area:payments` |
| Risk | `risk:security`, `risk:data-loss`, `risk:perf` |
| Effort | `effort:xs`, `effort:s`, `effort:m`, `effort:l`, `effort:xl` |

## Pull Requests

### Required

1. **Linked to an issue** with `Closes #<n>` or `Refs #<n>` in the body.
2. **PR template filled out** (Summary · What changed · How tested · Risks · Screenshots if UI).
3. **CI green.** No exceptions for `main`.
4. **At least one approval** from a reviewer (human or another agent acting as reviewer with the human's sign-off).
5. **Description tells the reviewer what to look at first.** Lead with the riskiest change.

### Size

- Ideal: ≤ 400 lines of diff.
- Hard ceiling: 1000 lines. Beyond this, split.
- Tests count against the budget but documentation does not.

## GitHub Projects

A single project per product/team with these columns:

- **Inbox** — newly filed, not yet triaged
- **Backlog** — triaged, prioritized, ready when capacity allows
- **Ready** — top of backlog, meets Definition of Ready (see `03-definition-of-ready-done.md`)
- **In Progress** — actively being worked on (WIP limit: 1 per developer agent)
- **In Review** — PR open, awaiting review
- **Done** — merged + verified

## GitHub Actions

- Every workflow file lives in `.github/workflows/`.
- Workflows are referenced by reusable [composite actions](https://docs.github.com/en/actions/creating-actions/creating-a-composite-action) where possible.
- Secrets are stored in GitHub Secrets (org or repo level). **Never** in code, never in workflow files.
- Required workflows on every push to a PR: lint, typecheck, unit tests, SAST.
- Required workflows on push to `main`: all of the above + build + publish artifact.

See the `ci-pipeline` skill for the canonical CI shape.
