# ACE — Agentic Collaborative Engineering

[![npm](https://img.shields.io/npm/v/ace-agents)](https://www.npmjs.com/package/ace-agents)
[![node](https://img.shields.io/node/v/ace-agents)](https://www.npmjs.com/package/ace-agents)
[![license](https://img.shields.io/npm/l/ace-agents)](LICENSE)

A Claude Code-native development team of specialized subagents that collaborate on software delivery through GitHub. Designed to be **Pro-survivable** — token discipline is built into every agent and KB.

**ACE** = **A**gentic **C**ollaborative **E**ngineering. The agents are the specialists; GitHub is the shared workspace; you are the orchestrator who decides what happens when.

## Read first

**`kb/USAGE.md`** explains how to use ACE without burning your Pro budget. Request tags (`[lite]`, `[design]`, `[hotfix]`), when to `/compact`, when to use Sonnet vs Opus, and rough budget math.

## Team Composition

| Agent | Role | Primary Outputs |
|-------|------|-----------------|
| **maintainer** | Community health, issue triage, contributor experience | Issues, CONTRIBUTING.md, ROADMAP.md, SECURITY.md |
| **architect** | System design, technical decisions, public API stability | ADRs, design docs, API contracts, threat models |
| **developer** | Implementation, testing, code review | Pull requests, unit/integration tests |
| **tech-writer** | Documentation, API reference, changelogs | README, guides, CHANGELOG, release notes, docstrings |
| **devops** | CI/CD, release automation, dependency hygiene | GitHub Actions workflows, release pipeline, Dependabot config |

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
│   │   ├── maintainer.md
│   │   ├── architect.md
│   │   ├── developer.md
│   │   ├── tech-writer.md
│   │   └── devops.md
│   └── skills/                            # Cross-cutting skills
│       ├── github-issues/SKILL.md
│       ├── adr-authoring/SKILL.md
│       ├── pr-workflow/SKILL.md
│       ├── ci-pipeline/SKILL.md
│       └── release-engineering/SKILL.md
└── .github/
    └── workflows/
        └── ci.yml                         # Reference CI workflow
```

## Install

```bash
npx ace-agents@latest init
```

Run inside any project directory. ACE copies `.claude/`, `kb/`, and `.github/workflows/ci.yml` into the current directory and prints what it did.

```bash
ace init --no-ci        # skip the CI workflow
ace init --force        # overwrite existing files
ace update              # re-sync after upgrading ace-agents; skips locally modified files
ace update --force      # overwrite everything including locally modified files
ace --version
```

<details>
<summary>Manual install (no Node.js required)</summary>

Clone the repo and copy the three directories into your project root:

```bash
git clone --depth 1 https://github.com/dwang2/ACE /tmp/ace
cp -r /tmp/ace/ace/.claude /tmp/ace/ace/kb /tmp/ace/ace/.github YOUR_PROJECT/
```

</details>

## Quick Start

1. **Run `npx ace-agents@latest init`** in your project root.
2. **Open Claude Code** in that repo.
3. **Tell it what you want.** Examples:
   - `Maintainer, triage the three open issues and label any good first issues.`
   - `Architect, propose an approach for idempotent retry handling and note the semver implications.`
   - `Developer, implement issue #42 and open a PR.`
   - `Tech writer, update the README and write a getting-started guide for the new CLI.`
   - `DevOps, add a multi-OS CI matrix and a release workflow that publishes to PyPI.`

## Example Workflows

### Calling an agent explicitly

Address the agent by role and give it enough context to act:

```
Architect, we need to add rate limiting to the public API. Propose an approach,
note the semver implications, and write an ADR if you decide on an approach.
```

```
Developer, implement issue #34. Write tests, open a PR, and request my review.
```

```
DevOps, our test suite takes 8 minutes. Add parallelism and caching to the CI
workflow to get it under 3 minutes.
```

### Letting Claude Code route automatically

You don't have to name an agent. Describe the task and Claude Code picks the right
one based on each agent's `description` field:

```
Triage the open issues, label any good first issues, and close anything that's
clearly a duplicate.
```
→ routes to **maintainer** (issue triage matches its description)

```
The auth middleware is storing session tokens insecurely. Review the threat surface
and recommend fixes.
```
→ routes to **architect** (threat model / security review)

### Multi-agent handoff

Design-then-implement is the most common multi-agent flow. Run `/compact` between
phases to keep context clean:

```
[design] Architect, design the pagination strategy for the search API. Produce an
ADR with your recommendation.
```
*(review and approve the ADR)*
```
/compact
```
```
Developer, implement the cursor-based pagination from ADR-005. Write integration
tests and open a PR.
```

### Lite mode for small tasks

Skip KB loading for tasks that don't need it — saves tokens and runs faster:

```
[lite] Rename UserService to AccountService everywhere.
```

```
[lite] Add a docstring to the parse_config function.
```

```
[lite] Fix the typo in the error message on line 42 of auth.py.
```

### Hotfix mode

For production-urgent changes, `[hotfix]` tells the agent to skip design overhead
and load only the minimum:

```
[hotfix] Developer, fix the null pointer crash in /api/orders reported in #89.
Patch, test, and open a PR against main.
```

## Customizing for Your Project

- **Update `kb/01-tech-stack.md`** with your actual languages, frameworks, and services.
- **Update `kb/02-github-conventions.md`** with your org's branch naming, labels, and templates.
- **Tune agent prompts** in `.claude/agents/*.md` if your team has specific role boundaries.
- **Add domain skills** under `.claude/skills/` for anything specific (e.g., a `database-migration` skill).
