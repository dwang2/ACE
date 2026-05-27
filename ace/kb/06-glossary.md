# Glossary

Shared vocabulary. When agents and humans use these words, they mean the same thing.

| Term | Definition |
|---|---|
| **ADR** | Architectural Decision Record. A short, immutable markdown document capturing one decision, its context, alternatives, and consequences. Lives in `docs/adr/`. |
| **DoR / DoD** | Definition of Ready / Definition of Done. See `03-definition-of-ready-done.md`. |
| **PRD** | Product Requirements Document. PM's primary artifact for a feature larger than a single issue. |
| **Spike** | Time-boxed investigation (usually 1–3 days) producing a written conclusion (ADR or doc), not code. |
| **Trust boundary** | A point where data crosses from one privilege context to another. Each boundary is a validation point. |
| **WIP limit** | Maximum number of items in a column on the Project board. The team enforces small WIP to maximize flow. |
| **Slice** | The smallest end-to-end useful piece of a feature. A slice should be shippable on its own. |
| **Feature flag** | A runtime switch that gates a code path. Used to decouple deploy from release. |
| **Canary** | Initial rollout to a small percentage of traffic to detect regressions before full release. |
| **Runbook** | Operator-facing document describing how to diagnose and fix a specific problem in production. |
| **SLO** | Service Level Objective — a measurable target for system behavior (e.g., 99.9% of requests under 200ms). |
| **Error budget** | The complement of an SLO (e.g., 0.1% allowed error rate over the window). Used to gate risky changes. |
| **Threat model** | Structured analysis of how a system could be attacked, what mitigations exist, and what residual risk remains. STRIDE is the team's default framework. |
| **PII** | Personally Identifiable Information. Treated as sensitive by default. |
| **NPI** | Nonpublic Personal Information. Financial-services specific term under GLBA. |
| **BFF** | Backend For Frontend — a thin server-side adapter tailored to a specific UI, sitting in front of domain services. |
| **IaC** | Infrastructure as Code (Terraform, Pulumi, CloudFormation). |
| **SBOM** | Software Bill of Materials. List of all dependencies in a build, used for vuln tracking. |
| **SAST** | Static Application Security Testing — analyzes source code for vulnerabilities. |
| **DAST** | Dynamic Application Security Testing — probes a running app for vulnerabilities. |
| **SCA** | Software Composition Analysis — finds known vulns in third-party dependencies. |
