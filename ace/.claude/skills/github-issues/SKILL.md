---
name: github-issues
description: Create, update, label, link, and triage GitHub Issues using the gh CLI. Use whenever the task involves filing a new Issue, updating an existing one (labels, assignees, milestone, project, status), linking Issues to PRs or other Issues, searching the backlog, or bulk-triaging. Use even when the user describes it casually ("file a ticket", "open a bug", "add this to the backlog").
---

# GitHub Issues

This skill is the canonical way every agent on this team interacts with GitHub Issues. It uses the `gh` CLI (GitHub's official command-line tool) which is assumed to be installed and authenticated.

## Preconditions

Before running any `gh` command:

1. Confirm `gh` is installed: `gh --version`
2. Confirm authentication: `gh auth status`
3. If either fails, tell the user how to fix it and stop. Do not try to work around it.

## Read first

Before creating Issues, read:
- `kb/02-github-conventions.md` — labels, templates, naming
- `kb/03-definition-of-ready-done.md` — DoR checklist

## Creating an Issue

Use the canonical body template:

```markdown
## Context
<2–5 sentences on why this matters>

## Acceptance Criteria
- [ ] Given <state>, when <action>, then <observable outcome>
- [ ] ...

## Out of Scope
- <Excluded item>

## Open Questions
- <Question>

## Links
- Related: #<n>
- ADR: <link>
- Design: <link>
```

Command:

```bash
gh issue create \
  --title "feat(payments): add idempotency key to ACH retry" \
  --body-file /tmp/issue-body.md \
  --label "type:feature,area:payments,p1,effort:m" \
  --milestone "Q2 2026" \
  --project "Platform"
```

If you don't know the right milestone or project, list them first:
```bash
gh project list --owner <org>
gh api repos/{owner}/{repo}/milestones
```

## Updating an Issue

Common operations:

```bash
# Add labels
gh issue edit <number> --add-label "status:blocked,risk:security"

# Remove labels
gh issue edit <number> --remove-label "status:blocked"

# Assign
gh issue edit <number> --add-assignee @me            # self
gh issue edit <number> --add-assignee <username>

# Set milestone
gh issue edit <number> --milestone "Q2 2026"

# Comment
gh issue comment <number> --body-file /tmp/comment.md
```

## Linking Issues

GitHub auto-links `#<n>` mentions. To make one Issue close another, the link goes on the PR, not the Issue. The keywords are:

- `Closes #<n>` / `Fixes #<n>` / `Resolves #<n>` — auto-closes when PR merges

To express a dependency between Issues, use a comment with `Blocked by #<n>` or `Depends on #<n>` (text-only; GitHub does not enforce this — labels do).

## Listing and Searching

```bash
# All open issues in this repo
gh issue list --state open

# By label
gh issue list --label "p0" --state open

# By assignee
gh issue list --assignee @me --state open

# Search syntax (full GitHub query)
gh issue list --search "is:open label:p1 -label:status:blocked sort:updated-desc"

# JSON output for processing
gh issue list --label "p0" --json number,title,labels,assignees
```

## Triage workflow

When asked to triage Issues:

1. List newly-filed Issues (`status:` empty or label `triage`)
2. For each, evaluate:
   - Is it a duplicate? → close with link to original
   - Is the title clear? → propose a better one
   - Are labels right? → propose label changes
   - Is priority justified? → confirm or downgrade
   - Does it meet DoR (`kb/03-definition-of-ready-done.md`)? → if not, comment with the gaps
3. **Present proposed changes to the user before applying them in bulk.** Triage is high-leverage; mistakes are expensive.

## Bulk operations

When applying the same change to many Issues, generate a shell script first, show it to the user, get confirmation, then run it. Do not silently mass-edit.

```bash
# Example: add label to all p0 issues missing area label
for n in $(gh issue list --label p0 --json number -q '.[].number'); do
  if ! gh issue view "$n" --json labels -q '.labels[].name' | grep -q '^area:'; then
    echo "Issue #$n is missing area label"
  fi
done
```

## When NOT to use this skill

- The user wants a PR, not an Issue → use `pr-workflow` skill
- The user wants a decision documented → use `adr-authoring` skill
- The user is asking about CI/CD pipelines → use `ci-pipeline` skill
