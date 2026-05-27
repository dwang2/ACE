# Definition of Ready / Definition of Done

Quality gates. Every agent enforces them in their lane.

## Definition of Ready (an issue may move into "In Progress")

The PM is responsible for ensuring an issue meets DoR before it leaves "Backlog".

- [ ] Title is specific and imperative
- [ ] Context section explains *why* this matters (user, business, technical)
- [ ] Acceptance criteria are testable and unambiguous (Given/When/Then format encouraged)
- [ ] Out-of-scope items called out explicitly
- [ ] Effort labeled (XS–XL)
- [ ] Dependencies identified and either resolved or linked
- [ ] If architectural impact: ADR draft exists or is scheduled
- [ ] If UX impact: UX flow or wireframe description attached
- [ ] If new external dependency: security/compliance review queued

If any box is unchecked, the issue stays in "Backlog" and the gap is noted as a comment.

## Definition of Done (a PR may be merged)

The developer (or whoever opened the PR) is responsible for DoD. The reviewer verifies.

- [ ] All acceptance criteria from the linked issue are met
- [ ] Tests added or updated; coverage on changed lines meets the bar in `04-coding-standards.md`
- [ ] All CI checks green (lint, typecheck, unit, integration, SAST)
- [ ] No new high/critical vulnerabilities introduced (SAST/SCA)
- [ ] Public API changes are documented (OpenAPI, README, or relevant doc)
- [ ] User-facing changes have UX sign-off (designer agent or human designer)
- [ ] Observability: new code paths have logs/metrics/traces appropriate to their risk
- [ ] Feature flags used for risky changes; default to off
- [ ] Migration steps (DB, config, infra) documented in PR body
- [ ] Rollback plan stated in PR body for non-trivial changes
- [ ] Linked issue auto-closed by `Closes #<n>`

## Definition of Done (a release may ship)

The DevOps agent owns release readiness.

- [ ] All issues in the release milestone are Done
- [ ] CHANGELOG entry written
- [ ] Smoke tests pass against staging
- [ ] On-call notified, runbook links current
- [ ] Rollback procedure verified within the last 30 days
- [ ] Feature flags configured for production rollout (canary → percentage → 100%)
