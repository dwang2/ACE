---
name: pr-workflow
description: Create, update, and review pull requests using the gh CLI and git. Use whenever the task involves opening a PR, updating a PR description or labels, responding to review comments, marking a PR ready for review or as a draft, merging, or doing a code review. Use even when phrased casually ("open a pull request", "send this for review", "merge that", "review PR #42").
---

# Pull Request Workflow

This skill is the canonical way every agent on this team works with pull requests. It uses `git` and the `gh` CLI.

## Read first

- `kb/02-github-conventions.md` — branch naming, commit format, PR template
- `kb/03-definition-of-ready-done.md` — Definition of Done for a PR
- `kb/04-coding-standards.md` — what reviewers check

## Preconditions

```bash
gh auth status        # authenticated
git status            # clean or have intentional changes
git remote -v         # know which remote we're pushing to
```

## Opening a PR

### 1. Create a branch following the convention

```bash
# feat/<issue>-slug, fix/<issue>-slug, chore/<slug>, docs/<slug>, ci/<slug>
git checkout -b feat/128-ach-retry-idempotency
```

### 2. Make commits using Conventional Commits

```bash
git commit -m "feat(payments): add idempotency key to ACH retry handler

Adds a 24h dedup window keyed on (account_id, request_id) to prevent
duplicate ACH submissions on retry. Storage backed by Redis with a
Postgres fallback for audit.

Refs: #128"
```

### 3. Push and open the PR

```bash
git push -u origin feat/128-ach-retry-idempotency

gh pr create \
  --title "feat(payments): add idempotency key to ACH retry" \
  --body-file /tmp/pr-body.md \
  --base main \
  --label "type:feature,area:payments" \
  --assignee @me \
  --draft     # remove --draft when ready for review
```

### PR body template

```markdown
## Summary
<1–3 sentences: what this PR does, and why now.>

## What Changed
- <Bulleted list of the substantive changes>
- <Test changes>
- <Doc changes>

## How Tested
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual verification: <steps and outcome>

## Risks
<What could break. What's the blast radius. What did you do to mitigate.>

## Rollback
<How to revert if this goes wrong. For most PRs, "revert the commit". For migrations or flagged changes, more detail.>

## Screenshots (if UI)

## Linked Issue
Closes #128
```

Use `Closes #<n>` (or `Fixes #<n>` / `Resolves #<n>`) to auto-close the Issue on merge. Use `Refs #<n>` for related-but-not-closing.

## Mark Ready / Draft

```bash
gh pr ready <number>         # promote from draft to ready
gh pr ready <number> --undo  # back to draft
```

## Updating a PR

```bash
# Edit title or body
gh pr edit <number> --title "..." --body-file /tmp/new-body.md

# Add/remove labels and reviewers
gh pr edit <number> --add-label "status:in-review"
gh pr edit <number> --add-reviewer <user>

# Re-push after changes
git push  # CI re-runs automatically
```

## Reviewing a PR

### Order of review (every reviewer, every time)

1. **Read the PR description.** If it doesn't explain what changed, ask for that first; don't read the diff blind.
2. **Read the linked Issue's AC.** Does the PR meet them?
3. **Read the tests first.** They tell you what the author thinks the change does.
4. **Read the code.** Look for:
   - Correctness vs. AC
   - Test coverage of the change
   - Security (input validation, authz, secrets)
   - Performance (N+1 queries, blocking I/O, unbounded loops)
   - Maintainability (naming, structure, comments where intent is non-obvious)
   - Style (only flag what the linter misses)
5. **Run it locally** if the change is non-trivial or you're unsure.

Block on 1–4. Suggest on 5.

### Leaving review comments

```bash
# Inline comment via web UI is fine for one-off remarks.
# For a full review:
gh pr review <number> --request-changes --body-file /tmp/review.md
gh pr review <number> --comment         --body-file /tmp/review.md
gh pr review <number> --approve         --body "LGTM"
```

### Tone

- Be specific. Reference file:line. "auth.py:42 — this check happens after the data is already loaded; AuthZ should gate the load itself."
- Suggest, don't dictate, on subjective things. "Consider extracting…"
- Assert, with evidence, on objective things. "This is an N+1 — see the loop at line 78 calling `db.get` inside `for u in users`."
- Praise good moves explicitly. Reviews are also a feedback loop on what to keep doing.

## Merging

Pre-merge checklist:
- [ ] All CI green (no skipped jobs masquerading as green)
- [ ] At least one approving review
- [ ] PR body's Definition of Done items checked
- [ ] Branch is up to date with `main` (or auto-merge with required updates is configured)

```bash
# Squash-merge per team convention
gh pr merge <number> --squash --delete-branch

# For releases or specific cases that need merge commits, get explicit approval first
```

## After merge

- Confirm the linked Issue auto-closed (check the Issue page).
- If the PR involved a migration, deployment step, or flag flip, verify the next step happens (devops agent).
- If the PR superseded an ADR or design decision, confirm the ADR status update PR is also open.

## Common pitfalls

- **Squashing a PR that contains a revert.** Verify the squash message is meaningful; otherwise rewrite it.
- **Force-pushing after review.** Reviewers lose their place. Prefer additive commits during review; squash on merge.
- **Merging your own approval.** PRs require an *external* approval (human or another agent acting as a reviewer with the human's sign-off).
- **Skipping the body.** A PR with only a title is not a PR; it's a guess.
