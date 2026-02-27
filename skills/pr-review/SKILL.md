---
name: pr-review
description: "Automated PR review workflow: fetch PR details, analyze changes, provide structured feedback. Use when: (1) reviewing pull requests, (2) providing code review comments, (3) checking CI status before review, (4) summarizing PR changes. NOT for: creating PRs (use github skill), merging PRs (use github skill), or local git operations (use git directly). Requires gh CLI authenticated."
metadata:
  {
    "openclaw":
      {
        "emoji": "🔍",
        "requires": { "bins": ["gh"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "gh",
              "bins": ["gh"],
              "label": "Install GitHub CLI (brew)",
            },
          ],
      },
  }
---

# PR Review Skill

Structured workflow for reviewing pull requests with consistent, thorough feedback.

## Quick Start

```bash
# Review a PR by number
gh pr view 123 --repo owner/repo
gh pr diff 123 --repo owner/repo

# Check CI status first
gh pr checks 123 --repo owner/repo
```

## Review Workflow

### Step 1: Gather Context

```bash
# Get PR overview
gh pr view $PR --repo $REPO --json title,body,author,baseRefName,headRefName,additions,deletions,changedFiles

# Check CI/workflow status
gh pr checks $PR --repo $REPO

# List changed files
gh pr diff $PR --repo $REPO --name-only
```

### Step 2: Analyze Changes

```bash
# Get full diff
gh pr diff $PR --repo $REPO

# For large PRs, review file by file
gh pr diff $PR --repo $REPO -- path/to/file.ts
```

### Step 3: Provide Feedback

Structure your review with these categories:

#### 🔴 Critical Issues

- Security vulnerabilities
- Data loss risks
- Breaking changes without migration

#### 🟡 Suggestions

- Code improvements
- Performance optimizations
- Better patterns

#### 🟢 Positive Feedback

- Good practices observed
- Clean implementations

### Step 4: Submit Review

```bash
# Approve
gh pr review $PR --repo $REPO --approve --body "LGTM! Great work."

# Request changes
gh pr review $PR --repo $REPO --request-changes --body "Please address the issues noted."

# Comment only
gh pr review $PR --repo $REPO --comment --body "Some thoughts for consideration."
```

## Review Checklist

### Code Quality

- [ ] Code follows project conventions
- [ ] No obvious bugs or logic errors
- [ ] Error handling is appropriate
- [ ] No hardcoded secrets or credentials

### Testing

- [ ] Tests added/updated for changes
- [ ] All tests passing (check CI)
- [ ] Edge cases considered

### Documentation

- [ ] Code comments where needed
- [ ] README updated if applicable
- [ ] API docs updated if applicable

### Security

- [ ] Input validation present
- [ ] No SQL injection risks
- [ ] No XSS vulnerabilities
- [ ] Secrets not exposed

## Adding Review Comments

```bash
# Add a comment to the PR
gh pr comment $PR --repo $REPO --body "Comment text here"

# Add inline comment (via API)
gh api repos/$REPO/pulls/$PR/comments \
  --method POST \
  -f body="Inline comment" \
  -f path="file.ts" \
  -f line=42 \
  -f side="RIGHT"
```

## Templates

### Approval Template

```
## ✅ Approved

**Summary:** [Brief description of what was reviewed]

### What I Checked
- [ ] Code quality and style
- [ ] Test coverage
- [ ] Security considerations
- [ ] Documentation

### Notes
[Any additional observations]

Great work! 🎉
```

### Request Changes Template

```
## 🔄 Changes Requested

**Summary:** [Brief description of concerns]

### Critical Issues
1. [Issue description with file:line reference]

### Suggestions
1. [Optional improvement suggestions]

### Questions
1. [Clarifying questions]

Please address the critical issues before merging.
```

## Advanced: Automated Review with Coding Agent

For deep code analysis, spawn a coding agent:

```bash
# Clone PR branch for local analysis
SCRATCH=$(mktemp -d)
cd $SCRATCH
gh pr checkout $PR --repo $REPO

# Spawn coding agent for review
bash pty:true workdir:$SCRATCH command:"codex exec 'Review this codebase for bugs, security issues, and improvements. Focus on recently changed files.'"
```

## CI Integration

Always check CI before reviewing:

```bash
# Wait for CI to complete
gh pr checks $PR --repo $REPO --watch

# View failed run logs
gh run view $RUN_ID --repo $REPO --log-failed
```

## Notes

- Always be constructive in feedback
- Focus on the code, not the author
- Ask questions when unclear
- Acknowledge good work
- Consider the PR's scope and goals
