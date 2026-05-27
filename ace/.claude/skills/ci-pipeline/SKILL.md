---
name: ci-pipeline
description: Design, create, or modify GitHub Actions CI/CD workflows. Use whenever the task involves building, testing, scanning, packaging, or deploying via GitHub Actions; setting up matrix builds; configuring caching; managing secrets and environments; adding security scans (SAST, SCA, container, secrets); or troubleshooting failing workflows. Use even when phrased casually ("add CI to this repo", "the build is broken", "set up deploys").
---

# CI/CD Pipeline (GitHub Actions)

This skill encodes the team's canonical CI/CD shape and the rules for modifying it. Workflows live in `.github/workflows/`.

## Read first

- `kb/01-tech-stack.md` — for the right language versions and tools
- `kb/02-github-conventions.md` — for branch protections and PR rules
- `kb/05-security-and-compliance.md` — for what must scan and what blocks

## The canonical CI shape

Every repo has these workflows. Each is its own file for clarity.

```
.github/workflows/
├── ci.yml          # On PR + push to main: lint, typecheck, test, scan
├── release.yml     # On tag or manual dispatch: build artifact, publish
├── deploy.yml      # On push to main or manual: deploy to envs (gated)
└── nightly.yml     # On schedule: heavier scans, DAST, dependency review
```

### `ci.yml` skeleton (annotated)

```yaml
name: CI

# Run on PRs and on pushes to main. PRs from forks should NOT have access to
# secrets; this default (pull_request, not pull_request_target) ensures that.
on:
  pull_request:
  push:
    branches: [main]

# Least-privilege default. Each job grants what it needs.
permissions: {}

# Cancel in-progress runs on new pushes to the same PR/branch.
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@<sha>  # pin by SHA, comment the version
      - uses: actions/setup-python@<sha>
        with:
          python-version: '3.12'
          cache: 'pip'
      - run: pip install -e '.[dev]'
      - run: ruff check .
      - run: ruff format --check .

  typecheck:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@<sha>
      - uses: actions/setup-python@<sha>
        with:
          python-version: '3.12'
          cache: 'pip'
      - run: pip install -e '.[dev]'
      - run: mypy --strict src

  test:
    runs-on: ubuntu-latest
    needs: [lint, typecheck]   # fail fast on cheap checks
    permissions:
      contents: read
    strategy:
      fail-fast: false
      matrix:
        python-version: ['3.12']
    steps:
      - uses: actions/checkout@<sha>
      - uses: actions/setup-python@<sha>
        with:
          python-version: ${{ matrix.python-version }}
          cache: 'pip'
      - run: pip install -e '.[dev]'
      - run: pytest --cov=src --cov-report=xml --cov-report=term
      - uses: actions/upload-artifact@<sha>
        if: always()
        with:
          name: coverage-${{ matrix.python-version }}
          path: coverage.xml

  sast:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write   # to upload SARIF
    steps:
      - uses: actions/checkout@<sha>
      - uses: github/codeql-action/init@<sha>
        with:
          languages: python
      - uses: github/codeql-action/analyze@<sha>

  sca:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@<sha>
      - uses: actions/dependency-review-action@<sha>
        if: github.event_name == 'pull_request'

  secrets-scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@<sha>
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@<sha>
```

> Replace `<sha>` with the actual commit SHA of the action at the version you want. Tags are mutable; SHAs are not. Use Dependabot to keep them updated.

## Rules

### Action pinning
- **Pin every third-party action by commit SHA**, not tag.
- Comment the human-readable version next to the SHA.
- Dependabot config (`.github/dependabot.yml`) updates these on a schedule.

### Permissions
- Set `permissions: {}` at the workflow level.
- Grant each job exactly what it needs (`contents: read`, `pull-requests: write`, etc.).
- Never `permissions: write-all`.

### Secrets
- Use GitHub Encrypted Secrets at the org or repo level.
- Use GitHub Environments for deploy-scoped secrets with required reviewers.
- **Never** echo secrets, pass them as args (visible in process tables), or write them to files.
- Use `pull_request_target` only when you have audited what runs and understand the supply-chain risk.

### Caching
- Cache by lockfile hash: `key: ${{ runner.os }}-deps-${{ hashFiles('**/uv.lock') }}`.
- Don't cache test results, coverage, or anything that should be re-derived.

### Speed
- Cheap checks (lint, typecheck) gate slow ones (tests, scans) via `needs:`.
- Use `concurrency` to cancel superseded runs.
- Parallelize tests with a matrix when the test suite is large.
- Target: unit tests under 10 min, full CI under 20 min. If you slip, investigate.

### Failure handling
- A "skipped" required check is a passing check by default — verify the workflow can't accidentally skip its real work. Use `if: always()` carefully and never on a step that's a quality gate.
- Upload logs and coverage as artifacts on failure (`if: failure()`).

### Branch protection (set in repo settings, mentioned here for completeness)
- Required checks: lint, typecheck, test, sast, sca, secrets-scan
- Require linear history
- Require 1 approving review
- Dismiss stale approvals on push
- Require branches to be up to date

## Deploys

Deploys live in `deploy.yml` and use **GitHub Environments** for gates:

- `staging`: auto-deploys from `main`
- `production`: requires reviewer approval; deploys via percentage rollout or canary

Each environment has its own secrets and protection rules. Production secrets are not accessible from `staging` jobs.

Rollback path is part of every deploy workflow — usually a `workflow_dispatch` with a `version` input that redeploys a known-good artifact.

## Common workflow troubleshooting

### "It works locally but fails in CI"
- Check OS difference (CI uses Ubuntu; local may be macOS). Path separators, case sensitivity.
- Check environment variables — `.env` is gitignored, may not exist in CI.
- Check timing/ordering — CI tends to be slower, exposing race conditions.
- Re-run with `ACTIONS_STEP_DEBUG=true` (set as a repo secret) for verbose logs.

### "The action keeps failing on a dependency"
- Are you pinning the action by SHA? If so, did the SHA's underlying dependency change?
- Is the lockfile committed?
- Is there a transient registry outage? (Don't add retries that mask flakes; if a step is genuinely flaky, fix the test.)

### "Tests pass but coverage drops"
- Coverage report uploaded? Check the artifact.
- Did the change add code paths but not tests? That's the actual issue.

## When NOT to use this skill

- Application code changes → use the **developer** agent
- Infrastructure as Code → still devops territory but a different skill area (Terraform/Pulumi modules)
- Choosing a CI platform → that's an ADR via the **architect**
