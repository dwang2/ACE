---
name: release-engineering
description: Cut a release for an open source project. Use whenever the task involves deciding the next version number, generating or updating the CHANGELOG, creating a GitHub Release, tagging a commit, or publishing to a package registry (PyPI, npm, crates.io, pkg.go.dev). Use even when phrased casually ("ship a release", "bump the version", "publish to PyPI", "tag this").
---

# Release Engineering

This skill is the canonical way to cut a release on this team. It covers versioning, changelog, tagging, GitHub Releases, and registry publishing.

## Prerequisites

```bash
gh auth status          # authenticated
git status              # clean working tree
git log --oneline -10   # confirm commits since last release look right
git tag --sort=-v:refname | head -5   # find current latest tag
```

## Step 1 — Decide the version number

Follow **Semantic Versioning** (semver.org):

| Change type | Bump |
|---|---|
| Breaking change to public API | MAJOR (`x.0.0`) |
| New backward-compatible feature | MINOR (`0.x.0`) |
| Backward-compatible bug fix | PATCH (`0.0.x`) |
| Pre-release / alpha / beta | Suffix: `1.0.0-alpha.1`, `1.0.0-beta.2` |

Rules:
- While on `0.x.y`, breaking changes may appear in MINOR bumps — document this in `CHANGELOG.md`.
- The first stable release is `1.0.0`. Don't stay on `0.x` forever.
- If unsure between MINOR and MAJOR: ask architect to review public API changes.

## Step 2 — Update CHANGELOG.md

Use **Keep a Changelog** format (keepachangelog.com/en/1.1.0).

```markdown
## [1.2.0] - 2026-06-04

### Added
- Support for X feature (#42)

### Changed
- Y now returns Z instead of W — **BREAKING** for users on <1.2.0; migrate by doing ... (#38)

### Fixed
- Crash when input is empty string (#45)

### Security
- Updated dependency foo to 2.3.1 to address CVE-2026-XXXX
```

Rules:
- Entries describe the **user-visible effect**, not the diff.
- Every entry links to a PR or issue: `(#42)`.
- `**BREAKING**` label on any breaking change; include the migration path inline.
- Move the `## [Unreleased]` section to the new version; add a fresh `## [Unreleased]` at top.

## Step 3 — Bump the version in source

Update the version string in the project's canonical location:

| Ecosystem | File | Field |
|---|---|---|
| Python (pyproject.toml) | `pyproject.toml` | `version = "1.2.0"` |
| Python (setup.py) | `setup.py` or `src/<pkg>/__init__.py` | `__version__` |
| Node / npm | `package.json` | `"version": "1.2.0"` |
| Rust | `Cargo.toml` | `version = "1.2.0"` |
| Go | `git tag` only — no in-source version file needed |

```bash
# Verify there are no other hardcoded version references
grep -r "1\.1\.0" --include="*.toml" --include="*.json" --include="*.py" --include="*.rs" .
```

## Step 4 — Commit, tag, push

```bash
git add CHANGELOG.md pyproject.toml   # (or whichever files changed)
git commit -m "chore: release v1.2.0"
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin main --follow-tags
```

## Step 5 — Create the GitHub Release

Extract the relevant CHANGELOG section into a temp file, then:

```bash
gh release create v1.2.0 \
  --title "v1.2.0" \
  --notes-file /tmp/release-notes.md \
  --latest
```

For a pre-release:
```bash
gh release create v1.2.0-beta.1 --title "v1.2.0-beta.1" --notes-file /tmp/release-notes.md --prerelease
```

The release notes file should be the CHANGELOG section for this version, verbatim.

## Step 6 — Publish to registry (if applicable)

### Python (PyPI)

```bash
uv build           # or: python -m build
uv publish         # or: twine upload dist/*
# Verify: pip install mypackage==1.2.0
```

Requires `PYPI_API_TOKEN` set as a GitHub secret if publishing from CI.

### npm / Node

```bash
npm publish --access public   # for scoped packages (@org/pkg)
# or for a dry-run first:
npm publish --dry-run
# Verify: npm info mypackage version
```

### Rust (crates.io)

```bash
cargo publish
# Verify: cargo add mypackage@1.2.0
```

### Go

Go modules are published by tagging — no registry push needed. The tag from Step 4 is sufficient. `pkg.go.dev` indexes automatically within ~30 minutes.

## Automating releases with GitHub Actions

If the project wants automated publishing on tag push, use the `ci-pipeline` skill to add a release workflow. The pattern:

```yaml
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write   # for gh release create
      id-token: write   # for trusted publishing (PyPI/npm OIDC)
```

Prefer **trusted publishing** (OIDC) over long-lived API tokens where supported (PyPI supports it; npm supports it via Provenance).

## Common pitfalls

- **Tagging before the version commit is pushed.** Always push the commit first; then tag.
- **Forgetting to move `[Unreleased]` in CHANGELOG.** Releases without a corresponding CHANGELOG section are confusing.
- **Publishing a dirty tree.** `git status` must be clean before `cargo publish` or `uv publish`.
- **Skipping the pre-release for major versions.** For MAJOR bumps, cut a `-rc.1` first; let it bake for a few days before `vX.0.0`.
