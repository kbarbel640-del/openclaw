---
name: using-git-worktrees
description: Creates isolated git worktrees for parallel development with smart directory selection and safety verification. Use when starting feature work, need branch isolation, or before executing implementation plans.
---

# Using Git Worktrees

Git worktrees create isolated workspaces sharing the same repository, allowing work on multiple branches simultaneously without switching.

**Core principle:** Systematic directory selection + safety verification = reliable isolation.

## Contents

- [Directory Selection Process](#directory-selection-process)
- [Safety Verification](#safety-verification)
- [Creation Steps](#creation-steps)
- [Quick Reference](#quick-reference)
- [Common Mistakes](#common-mistakes)
- [Integration](#integration)

## Directory Selection Process

Follow this priority order:

### 1. Check Existing Directories

```bash
# Check in priority order
ls -d .worktrees 2>/dev/null     # Preferred (hidden)
ls -d worktrees 2>/dev/null      # Alternative
```

**If found:** Use that directory. If both exist, `.worktrees` wins.

### 2. Check CLAUDE.md

```bash
grep -i "worktree.*director" CLAUDE.md 2>/dev/null
```

**If preference specified:** Use it without asking.

### 3. Ask User

If no directory exists and no CLAUDE.md preference:

```
No worktree directory found. Where should I create worktrees?

1. .worktrees/ (project-local, hidden)
2. ~/.config/superpowers/worktrees/<project-name>/ (global location)

Which would you prefer?
```

## Safety Verification

### For Project-Local Directories (.worktrees or worktrees)

**MUST verify directory is ignored before creating worktree:**

```bash
# Check if directory is ignored (respects local, global, and system gitignore)
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

**If NOT ignored:**

⛔️ **STOP - On this machine, `.worktrees/` is GLOBALLY ignored.**

Check global gitignore first:

```bash
git config --global core.excludesFile  # Shows global gitignore path
cat "$(git config --global core.excludesFile)" | grep -i worktree
```

**DO NOT modify the repo's `.gitignore`** unless the global ignore is not set.
This has caused repeated PR noise - the user is frustrated about this recurring mistake.

**Only if global ignore is NOT configured**, then add to repo's .gitignore.

**Why critical:** Prevents accidentally committing worktree contents to repository.

### For Global Directory (~/.config/superpowers/worktrees)

No .gitignore verification needed - outside project entirely.

## Creation Steps

### 1. Detect Project Name

```bash
project=$(basename "$(git rev-parse --show-toplevel)")
```

### 2. Create Worktree

```bash
# Determine full path
case $LOCATION in
  .worktrees|worktrees)
    path="$LOCATION/$BRANCH_NAME"
    ;;
  ~/.config/superpowers/worktrees/*)
    path="~/.config/superpowers/worktrees/$project/$BRANCH_NAME"
    ;;
esac

# Create worktree with new branch
git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

### 3. Run Project Setup

Auto-detect and run appropriate setup:

```bash
# Node.js
if [ -f package.json ]; then npm install; fi

# Rust
if [ -f Cargo.toml ]; then cargo build; fi

# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi

# Go
if [ -f go.mod ]; then go mod download; fi
```

### 4. Verify Clean Baseline

Run tests to ensure worktree starts clean:

```bash
# Examples - use project-appropriate command
npm test
cargo test
pytest
go test ./...
```

**If tests fail:** Report failures, ask whether to proceed or investigate.

**If tests pass:** Report ready.

### 5. Report Location

```
Worktree ready at <full-path>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

## Quick Reference

| Situation                  | Action                     |
| -------------------------- | -------------------------- |
| `.worktrees/` exists       | Use it (verify ignored)    |
| `worktrees/` exists        | Use it (verify ignored)    |
| Both exist                 | Use `.worktrees/`          |
| Neither exists             | Check CLAUDE.md → Ask user |
| Directory not ignored      | Add to .gitignore + commit |
| Tests fail during baseline | Report failures + ask      |
| No package.json/Cargo.toml | Skip dependency install    |

## Common Mistakes

### Skipping ignore verification

- **Problem:** Worktree contents get tracked, pollute git status
- **Fix:** Always use `git check-ignore` before creating project-local worktree

### Assuming directory location

- **Problem:** Creates inconsistency, violates project conventions
- **Fix:** Follow priority: existing > CLAUDE.md > ask

### Proceeding with failing tests

- **Problem:** Can't distinguish new bugs from pre-existing issues
- **Fix:** Report failures, get explicit permission to proceed

### Hardcoding setup commands

- **Problem:** Breaks on projects using different tools
- **Fix:** Auto-detect from project files (package.json, etc.)

## Example Workflow

```
You: I'm using the using-git-worktrees skill to set up an isolated workspace.

[Check .worktrees/ - exists]
[Verify ignored - git check-ignore confirms .worktrees/ is ignored]
[Create worktree: git worktree add .worktrees/auth -b feature/auth]
[Run npm install]
[Run npm test - 47 passing]

Worktree ready at /Users/jesse/myproject/.worktrees/auth
Tests passing (47 tests, 0 failures)
Ready to implement auth feature
```

## Red Flags

**Never:**

- Create worktree without verifying it's ignored (project-local)
- Skip baseline test verification
- Proceed with failing tests without asking
- Assume directory location when ambiguous
- Skip CLAUDE.md check

**Always:**

- Follow directory priority: existing > CLAUDE.md > ask
- Verify directory is ignored for project-local
- Auto-detect and run project setup
- Verify clean test baseline

## Integration

**Works with:**

- `/reproducing-bugs` - Bug reproduction in worktrees
- `/reviewing-ado-prs` - Review code in worktree before PR
- Any task needing isolated workspace without switching branches

**Cleanup:**

- After PR merged: `git worktree remove .worktrees/<name>`
- List worktrees: `git worktree list`

## Cleanup & Garbage Collection

### Remove Finished Worktrees

```bash
# List all worktrees
git worktree list

# Remove a specific worktree
git worktree remove .worktrees/my-feature

# Force remove (if directory already deleted)
git worktree remove --force .worktrees/my-feature

# Prune stale worktree entries (orphaned)
git worktree prune
```

### Full Cleanup Routine

```bash
# Clean up ALL merged branches and their worktrees
for wt in $(git worktree list --porcelain | grep "^worktree" | cut -d' ' -f2); do
  branch=$(git -C "$wt" branch --show-current 2>/dev/null)
  if [ -n "$branch" ] && git branch -d "$branch" 2>/dev/null; then
    echo "Removed merged: $wt"
    git worktree remove "$wt" 2>/dev/null
  fi
done

# Prune any orphaned entries
git worktree prune

# Garbage collect
git gc --auto
```

### Disk Space Check

```bash
# Show worktree sizes
du -sh .worktrees/* 2>/dev/null

# Total worktree usage
du -sh .worktrees 2>/dev/null
```

## Common Aliases

Add to `~/.gitconfig`:

```ini
[alias]
    # Worktree shortcuts
    wt = worktree
    wtl = worktree list
    wta = worktree add
    wtr = worktree remove
    wtp = worktree prune

    # Create worktree with new branch
    wtnew = "!f() { git worktree add .worktrees/$1 -b $1; }; f"

    # Remove worktree and branch
    wtdel = "!f() { git worktree remove .worktrees/$1 && git branch -D $1; }; f"

    # List worktrees with status
    wts = "!git worktree list && echo '' && for wt in $(git worktree list --porcelain | grep '^worktree' | cut -d' ' -f2 | tail -n+2); do echo \"$wt:\"; git -C \"$wt\" status -sb 2>/dev/null | head -3; done"
```

**Usage:**

```bash
git wtnew feature/auth    # Create .worktrees/feature/auth with branch
git wtl                    # List worktrees
git wtdel feature/auth    # Remove worktree and branch
git wtp                    # Prune orphaned entries
```

## Conflict Resolution

When worktree has conflicts with main:

```bash
cd .worktrees/my-feature

# Update from main
git fetch origin main
git rebase origin/main

# If conflicts:
# 1. Resolve conflicts in files
# 2. git add <resolved-files>
# 3. git rebase --continue

# Alternative: merge instead of rebase
git merge origin/main
```

## Verification

After creating a worktree:

1. **Verify creation:** `git worktree list` shows the new worktree
2. **Verify ignored:** `git check-ignore -q .worktrees` returns 0 (for project-local)
3. **Verify baseline:** Tests pass in the new worktree
4. **Verify isolation:** Changes in worktree don't affect main repo's `git status`

## Creating PR from Worktree

After completing work in a worktree, create a PR:

```bash
# Set ADO defaults
az devops configure --defaults organization=https://yammer.visualstudio.com project=engineering

# Push branch from worktree
cd .worktrees/my-feature
git push -u origin HEAD

# Create PR with proper settings
az repos pr create \
  --title "Feature: My feature" \
  --description "Description here" \
  --source-branch "$(git branch --show-current)" \
  --target-branch main \
  --auto-complete true \
  --delete-source-branch true

# Get PR ID for follow-up
PR_ID=$(az repos pr list --source-branch "$(git branch --show-current)" --status active --query "[0].pullRequestId" -o tsv)

# Link work item to PR
az repos pr work-item add --id $PR_ID --work-items 12345

# Self-review before requesting reviews
/reviewing-ado-prs --local --base origin/main
```

## Related Skills

- `/reproducing-bugs` - Bug reproduction in isolated worktrees
- `/reviewing-ado-prs` - Review code in worktree before PR
- `/using-azure-cli` - `az repos pr` commands for PR creation
- `/ensuring-ci-green` - Monitor CI after creating PR
