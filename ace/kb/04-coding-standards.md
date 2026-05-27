# Coding Standards

Applied by the developer agent on every PR; enforced by the architect on review.

## TL;DR (read this first; load deep sections only when needed)

- **Readability over cleverness.** Functions do one thing. Errors handled explicitly (no silent catches). No magic numbers. Comments explain *why* not *what*. Dead code deleted, not commented out. Public APIs documented.
- **Tests**: ≥80% line coverage on changed lines; near-100% on pure logic. Integration tests at every I/O boundary. Deterministic (no real time/network/random/filesystem). Names describe behavior.
- **Security at the dev level**: no secrets in code. Validate input at trust boundaries. Parameterized queries only. Encode output for its sink. Pin dependency versions.
- **Code review order**: correctness vs AC → tests → security → performance → maintainability → style. Block on 1–4, suggest on 5–6.

For language-specific rules, see `kb/languages/<lang>.md` TL;DR — that's the daily-driver reference.

**Deep sections below** — read only when a specific rule needs the rationale.

---

## Universal Principles

1. **Readability over cleverness.** The next reader is the priority. Prefer explicit over implicit.
2. **Functions should do one thing.** If you need "and" to describe it, split it.
3. **Errors are values.** Handle them explicitly. No silent catches. No empty `except:` blocks.
4. **No magic numbers.** Named constants, or a comment explaining the value.
5. **Comments explain *why*, not *what*.** The code shows what; comments capture intent and tradeoffs.
6. **Dead code is deleted, not commented out.** Git remembers.
7. **Public APIs are documented.** Every exported function/class has a docstring or JSDoc.

## Testing Bar

- **Unit tests**: ≥ 80% line coverage on changed lines. Pure logic should be near 100%.
- **Integration tests**: every external boundary (DB, queue, HTTP) has at least one happy-path + one failure-path test.
- **Property-based tests** for non-trivial pure functions where applicable (Hypothesis in Python, fast-check in TS).
- **Tests must be deterministic.** No real time, no network, no random without a seed. Use fakes or mocks.
- **Test names describe the behavior.** `test_returns_404_when_account_not_found`, not `test_get_account_2`.

## Language-Specific

### Python

- Type hints on every public function. `mypy --strict` clean.
- `ruff` with the team config; format on save.
- Dataclasses or Pydantic models for structured data — no bare dicts crossing module boundaries.
- Async: don't mix sync and async carelessly. If a function is async, all its I/O is async.
- Imports: stdlib → third-party → local, separated by blank lines.

### Go

- `gofmt` + `goimports` always. `golangci-lint` clean.
- Errors wrapped with context: `fmt.Errorf("doing X: %w", err)`.
- Context propagation: every function doing I/O takes `ctx context.Context` as the first argument.
- Interfaces defined on the consumer side, not the producer side.
- Avoid `init()`. Construct explicitly.

### TypeScript

- `strict: true` in `tsconfig.json`. No `any`. Use `unknown` and narrow.
- Prefer `type` aliases for unions, `interface` for object shapes that may be extended.
- React: function components only, hooks for state. No class components in new code.
- No barrel exports (`index.ts` re-exporting everything) — they break tree-shaking.
- Errors thrown are `Error` subclasses, not strings.

## Security Hygiene (developer-level)

- No secrets in code, ever. Use environment variables loaded via a secrets manager.
- Validate input at trust boundaries (HTTP handler, queue consumer, CLI entry).
- Parameterized queries only. No string concatenation into SQL/shell/HTML.
- Encode output appropriately for the sink (HTML escape, JSON encode, etc.).
- Dependencies pinned to specific versions; updates go through Dependabot PRs.

See `05-security-and-compliance.md` for the deeper security playbook.

## Code Review Standards

A reviewer (agent or human) checks, in this order:

1. **Correctness** — does it do what the issue asked?
2. **Tests** — do they cover the change, and would they fail if the change were wrong?
3. **Security** — any new attack surface? Input validation? Authz checks?
4. **Performance** — any obvious N+1, blocking I/O on hot path, unbounded loop?
5. **Maintainability** — naming, structure, readability.
6. **Style** — linter should catch this; only flag what the linter misses.

Block on 1–4. Suggest on 5–6.
