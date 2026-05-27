# Security and Compliance

Security is continuous. This file is the team's baseline; domain regimes (PCI, SOX, HIPAA, GLBA) extend it.

## TL;DR (read this first; load deep sections only when needed)

- **Threat model** any feature that introduces a new trust boundary, handles sensitive data, changes authn/authz, or adds user input reaching privileged ops. STRIDE table in the ADR or design doc.
- **AuthN**: federated identity via OIDC; no homegrown password storage. **AuthZ**: enforce at the closest layer to the data; principle of least privilege; reviewed quarterly.
- **Secrets**: in a secrets manager (AWS Secrets Manager, Vault, GitHub Encrypted Secrets for CI). **Never** in code or workflow files. Pre-commit + `gitleaks` in CI. Rotate on schedule. `.env.example` checked in; real `.env` gitignored.
- **Data protection**: TLS 1.2+ everywhere (internal too). At-rest encryption with KMS-managed keys. PII fields tagged in code and redacted in logs.
- **Logs never contain** secrets, full PANs, full SSNs, or auth tokens. Redact at the logger.
- **Dependencies**: Dependabot enabled; high/critical CVEs block PRs. SBOM in CI. Lockfiles committed. New dependency = ADR or PR justification.
- **Scans**: SAST (CodeQL/Semgrep) every PR — high findings block. SCA every PR. Container scan (Trivy/Grype) at build. DAST nightly against staging.
- **Per-change checklist**: input validated against explicit schema · output encoded for destination · authz check before privileged op · no new secrets · no high/critical findings · logs don't leak.

**Deep sections below** — read only when designing a specific control or doing a threat model.

---

## Threat Modeling

The architect produces a lightweight threat model for any feature that:

- Introduces a new trust boundary (new service, new external integration)
- Handles sensitive data (PII, financial, health, credentials)
- Changes authentication or authorization
- Adds a user-facing input that reaches a privileged operation

Format: STRIDE table in the ADR or design doc.

| Threat | Component | Mitigation | Residual Risk |
|---|---|---|---|
| Spoofing | ... | ... | ... |
| Tampering | ... | ... | ... |
| ... | ... | ... | ... |

## Authentication and Authorization

- **AuthN**: federated identity via OIDC where possible; no homegrown password storage.
- **AuthZ**: enforce at the closest layer to the data. Don't trust upstream-only checks.
- **Service-to-service**: mTLS or short-lived signed tokens (JWT with ≤ 15min expiry, or AWS SigV4).
- **Principle of least privilege**: each service/role gets only the permissions it needs. Reviewed quarterly.

## Secrets Management

- Secrets live in a dedicated secrets manager (AWS Secrets Manager, HashiCorp Vault, GitHub Encrypted Secrets for CI).
- **Never commit secrets.** A pre-commit hook + `gitleaks` in CI catches accidents.
- Rotate credentials on a defined schedule. Document rotation in the runbook.
- Local dev uses a `.env.example` checked in; the real `.env` is gitignored.

## Data Protection

- **In transit**: TLS 1.2+ everywhere. Internal traffic too.
- **At rest**: storage-level encryption (KMS-managed keys for AWS, equivalent for other clouds).
- **PII tagging**: fields containing PII are annotated in code (`# pii: email`, `// @pii`, etc.) and logged with redaction.
- **Logs never contain secrets, full PANs, full SSNs, or auth tokens.** Redact at the logger.

## Dependency and Supply Chain

- **SCA**: GitHub Dependabot enabled for all repos. High/critical vulns block PRs.
- **SBOM**: generated as part of CI (CycloneDX or SPDX), stored as a build artifact.
- **Pinning**: lockfiles checked in (`uv.lock`, `go.sum`, `pnpm-lock.yaml`).
- **New dependencies** require approval — opened as a PR with a brief justification in the description, reviewed by the architect.

## Static and Dynamic Analysis

- **SAST**: CodeQL (or Semgrep) runs on every PR. High findings block merge.
- **DAST**: where the surface is HTTP, an OWASP ZAP baseline scan runs nightly against staging.
- **Container scanning**: Trivy or Grype on every image at build time.

## Secure Coding Checklist (per change)

- [ ] All untrusted input is validated against an explicit schema
- [ ] Output encoded for its destination (HTML, JSON, SQL, shell, log)
- [ ] AuthZ check present before any privileged operation
- [ ] No new secrets in code or workflow files
- [ ] No new high/critical SAST or SCA findings
- [ ] Logs do not leak secrets or sensitive PII
- [ ] Errors returned to clients do not leak stack traces, paths, or internal IDs

## Incident Response (referenced, not detailed here)

- On suspected incident: page on-call via the documented channel, do not discuss in public channels.
- Preserve evidence: don't roll back without snapshotting state.
- See `runbooks/incident-response.md` (project-specific).

## Compliance Notes (template)

Replace this section with the regimes that apply to your project. Examples:

- **GLBA / FCRA / FACTA** (financial services): non-public personal information handling, audit trails.
- **PCI-DSS** (card data): scope reduction via tokenization; never log full PAN; quarterly ASV scans.
- **SOC 2**: access reviews, change management evidence in PRs, vendor due diligence.
- **GDPR / CCPA**: data subject rights workflows, retention/deletion automation.
