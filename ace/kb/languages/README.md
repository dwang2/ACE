# Language Knowledge Base

Per-language deep references. The high-level stack choices live in `kb/01-tech-stack.md`; this directory is where the *how* lives.

## When agents should read these

- **Developer agent**: read the relevant file before writing or reviewing code in that language. If a PR touches multiple languages, read each.
- **Architect agent**: read the relevant file when designing APIs, choosing patterns, or doing PR review on language-specific idioms.
- **DevOps agent**: read the *Project layout & tooling* section to align CI matrix versions, lint configs, and build commands.
- **Product manager / UX designer**: usually no need to read these.

## Files

| File | When to read |
|---|---|
| `python.md` | Any task touching `.py` files, `pyproject.toml`, or Python services |
| `go.md` | Any task touching `.go` files, `go.mod`, or Go services |
| `typescript.md` | Any task touching `.ts`/`.tsx` files, `package.json`, or Node/React projects |
| `rust.md` | Any task touching `.rs` files, `Cargo.toml`, or Rust crates |

## Structure of each file

All four files follow the same four-section structure so agents can jump to the right section:

1. **Idioms & style** — what good code looks like, common patterns, anti-patterns
2. **Testing patterns** — frameworks, fixtures, mocking, coverage expectations
3. **Concurrency & error handling** — the language's model and the team's rules
4. **Project layout & tooling** — directory structure, package manager, lint/format/typecheck commands

If a section doesn't apply to the language (e.g., Python has no real "ownership" model like Rust), it's still present — with a brief note explaining why.
