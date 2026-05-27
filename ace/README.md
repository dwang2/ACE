# ACE — Agentic Collaborative Engineering

A Claude Code-native development team of specialized subagents that collaborate on software delivery through GitHub. Designed to be **Pro-survivable** — token discipline is built into every agent and KB.

**ACE** = **A**gentic **C**ollaborative **E**ngineering. The agents are the specialists; GitHub is the shared workspace; you are the orchestrator who decides what happens when.

## Read first

**`kb/USAGE.md`** explains how to use ACE without burning your Pro budget. Request tags (`[lite]`, `[design]`, `[hotfix]`), when to `/compact`, when to use Sonnet vs Opus, and rough budget math.

## Team Composition

| Agent | Role | Primary Outputs |
|-------|------|-----------------|
| **product-manager** | Discovery, requirements, prioritization | PRDs, user stories, GitHub Issues, roadmap |
| **architect** | System design, technical decisions | ADRs, design docs, API contracts, threat models |
| **developer** | Implementation, testing, code review | Pull requests, unit/integration tests |
| **ux-designer** | Information architecture, UX flows, accessibility | UX specs, wireframe descriptions, a11y reviews |
| **devops** | CI/CD, infrastructure, observability | GitHub Actions workflows, IaC, runbooks |

## How It Works

1. **You drive the conversation.** You ask Claude Code to do something ("plan a new feature", "implement issue #42", "set up CI").
2. **Claude Code delegates to the right agent.** Agents are invoked automatically based on the `description` field in their frontmatter, or you can explicitly request one (`use the architect to review this design`).
3. **Agents read the shared KB.** Every agent loads the relevant files from `kb/` to stay aligned on conventions, tech stack, and process.
4. **Agents use shared skills.** Cross-cutting capabilities (GitHub Issues, ADRs, PR workflow) live in `.claude/skills/` so every agent invokes them the same way.
5. **GitHub is the source of truth.** Issues track work, PRs track changes, Projects track flow, Actions run CI/CD.

## Directory Layout

```
.
├── README.md                              # This file
├── kb/                                    # Shared knowledge base (read by all agents)
│   ├── USAGE.md                           # Token discipline — read first
│   ├── 00-team-charter.md                 # Mission, ways of working
│   ├── 01-tech-stack.md                   # Languages, frameworks, services
│   ├── 02-github-conventions.md           # Branches, labels, PR/issue templates
│   ├── 03-definition-of-ready-done.md     # Quality gates
│   ├── 04-coding-standards.md             # Style, testing, review
│   ├── 05-security-and-compliance.md      # Threat modeling, secrets, SAST
│   ├── 06-glossary.md                     # Shared vocabulary
│   ├── languages/                         # Per-language deep references
│   │   ├── README.md                      # Index + when to read each
│   │   ├── python.md                      # Idioms, testing, async, layout
│   │   ├── go.md                          # Idioms, testing, concurrency, layout
│   │   ├── typescript.md                  # Idioms, testing, async, layout
│   │   └── rust.md                        # Idioms, testing, async, layout
│   └── principles/                        # Cross-cutting design principles
│       ├── README.md                      # Index + when to read each
│       ├── solid.md                       # SRP, OCP, LSP, ISP, DIP
│       ├── domain-driven-design.md        # Ubiquitous language, contexts, aggregates
│       ├── clean-architecture.md          # Layering, dependency rule
│       ├── twelve-factor.md               # 12-factor app methodology
│       ├── api-design.md                  # HTTP/REST, gRPC, async APIs
│       └── distributed-systems.md         # Idempotency, retries, sagas, consistency
├── .claude/
│   ├── agents/                            # Subagent definitions
│   │   ├── product-manager.md
│   │   ├── architect.md
│   │   ├── developer.md
│   │   ├── ux-designer.md
│   │   └── devops.md
│   └── skills/                            # Cross-cutting skills
│       ├── github-issues/SKILL.md
│       ├── adr-authoring/SKILL.md
│       ├── pr-workflow/SKILL.md
│       └── ci-pipeline/SKILL.md
└── .github/
    └── workflows/
        └── ci.yml                         # Reference CI workflow
```

## Quick Start

1. **Drop this folder into the root of your repo** (or copy `.claude/`, `kb/`, and `.github/` into your existing repo).
2. **Open Claude Code** in that repo.
3. **Tell it what you want.** Examples:
   - `Have the product-manager draft a PRD for an account statement export feature.`
   - `Architect, propose an approach for idempotent ACH retry handling.`
   - `Developer, implement issue #42 and open a PR.`
   - `DevOps, add a CodeQL scan to the CI workflow.`
   - `UX designer, review the user flow for the wire transfer screen.`

## Customizing for Your Project

- **Update `kb/01-tech-stack.md`** with your actual languages, frameworks, and services.
- **Update `kb/02-github-conventions.md`** with your org's branch naming, labels, and templates.
- **Tune agent prompts** in `.claude/agents/*.md` if your team has specific role boundaries.
- **Add domain skills** under `.claude/skills/` for anything specific (e.g., a `database-migration` skill).
