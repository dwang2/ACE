# Tech Stack

> **Customize this file for your project.** It is read by every agent on every meaningful task. Keep it short, current, and opinionated.

## Languages

- **Python** — backend services, data pipelines, ML/AI tooling. Version: 3.12+. Package manager: `uv` (preferred) or `poetry`.
- **Go** — high-throughput services, CLIs, infra glue. Version: 1.22+. Module-aware.
- **TypeScript** — frontend, BFF (backend-for-frontend), Node.js services. Version: 5.x. Strict mode on. Package manager: `pnpm`.

## Frameworks and Libraries

### Python
- Web: **FastAPI** (HTTP), **Pydantic v2** (validation)
- Testing: **pytest**, **pytest-asyncio**, **httpx** for client tests
- Lint/format: **ruff** (lint + format), **mypy --strict**

### Go
- HTTP: standard library `net/http` with **chi** router unless service requires more
- Testing: standard `testing` + **testify** for assertions
- Lint: **golangci-lint** with the team's config

### TypeScript
- Frontend: **React 18+** with **Vite**. State: minimal — prefer URL state and React Query.
- Node services: **Hono** or **Express** (existing services).
- Testing: **Vitest** for unit, **Playwright** for E2E.
- Lint/format: **ESLint** + **Prettier**, strict TS config.

## Data and Messaging

- **Postgres** (primary OLTP). Migrations via Alembic (Python) or sql-migrate (Go).
- **Redis** for caching and short-lived state.
- **Kafka** or **SQS** for async messaging (project-dependent).
- **S3** (or compatible) for object storage.

## Infrastructure

- **GitHub** — source, issues, projects, Actions for CI/CD.
- **Docker** for containerization. Multi-stage builds, distroless or `-slim` base images.
- **Terraform** for cloud infra (preferred) or **Pulumi** when type-safety in TS/Python matters.
- **AWS** as default cloud (swap if your org differs).

## Observability

- Structured logs (JSON), trace-id propagated via `traceparent`.
- **OpenTelemetry** SDKs for traces/metrics; export to whatever backend the project uses (Datadog/Honeycomb/Grafana).
- Health endpoints: `/healthz` (liveness), `/readyz` (readiness).

## AI Tooling

- **Claude Code** is the primary AI assistant. Agents and skills are in `.claude/`.
- API integrations use the **Anthropic Python or TypeScript SDK** (not raw HTTP unless needed).

---

## How agents should use this file

- Before writing or reviewing code, confirm the language and framework choices here.
- If a task requires a tool not listed here, **flag it as a decision** — propose adding it via an ADR rather than silently introducing a new dependency.
- If this file is out of date with the actual repo, update this file in the same PR.
