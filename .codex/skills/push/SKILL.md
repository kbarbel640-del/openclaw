---
name: push
description: "Sync current branch with local/fork state, push safely to fork origin, and create/update a draft PR to openclaw/openclaw main. Includes PR template usage and embedding original user prompts/follow-ups (without expanded skill dumps) from .codex/original-user-prompt.txt."
user-invocable: true
metadata:
  { "openclaw": { "requires": { "bins": ["git", "gh"] } } }
---

# push

Use this skill when the user asks to push the current branch from a fork and open a draft PR against the original `openclaw/openclaw` repository.

## Guardrails

- Never force-push.
- Never switch branches unless the user explicitly asks.
- Keep all PR body content in files/heredocs. Do not use inline `gh ... -b "..."` when markdown contains backticks or shell characters.
- Always target upstream base branch `openclaw/openclaw:main`.

## Workflow

### 1. Preflight and detect repos

```bash
branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" = "main" ]; then
  echo "Refusing to open PR from main; create/use a feature branch."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty; commit/stash first."
  exit 1
fi

fork_repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
fork_owner="$(gh repo view --json owner --jq '.owner.login')"
upstream_repo="openclaw/openclaw"

if git remote get-url upstream >/dev/null 2>&1; then
  current_upstream="$(git remote get-url upstream | sed -E 's#(git@github.com:|https://github.com/)##; s#\\.git$##')"
  if [ "$current_upstream" != "$upstream_repo" ]; then
    echo "upstream remote points to '$current_upstream' but expected '$upstream_repo'."
    echo "Update upstream first: git remote set-url upstream https://github.com/${upstream_repo}.git"
    exit 1
  fi
else
  git remote add upstream "https://github.com/${upstream_repo}.git"
fi
```

### 2. Persist the original user prompt and follow-ups (exclude expanded skills)

Write only user-authored prompts in chronological order.

- Keep the original user prompt and each follow-up prompt verbatim.
- If a prompt contains skill invocation output, keep only the invocation/user text (for example `$push`).
- Exclude auto-expanded skill payload blocks like `<skill> ... </skill>` from `.codex/original-user-prompt.txt`.

Use single-quoted heredocs so shell interpolation cannot alter content.

```bash
mkdir -p .codex
cat > .codex/original-user-prompt.txt <<'EOF'
<PASTE THE USER PROMPT VERBATIM HERE>
EOF
```

For each follow-up user prompt in the same request thread, append:

```bash
cat >> .codex/original-user-prompt.txt <<'EOF'

<PASTE FOLLOW-UP USER PROMPT VERBATIM HERE>
EOF
```

If your captured text accidentally includes expanded skill blocks, sanitize before PR creation:

```bash
awk '
BEGIN { in_skill=0 }
/^<skill>$/ { in_skill=1; next }
/^<\/skill>$/ { in_skill=0; next }
!in_skill { print }
' .codex/original-user-prompt.txt > .codex/original-user-prompt.filtered.txt
mv .codex/original-user-prompt.filtered.txt .codex/original-user-prompt.txt
```

Ensure root `.gitignore` contains this exact line:

```text
/.codex/original-user-prompt.txt
```

### 3. Sync local branch with fork and upstream

Fetch latest refs:

```bash
git fetch origin main "$branch" 2>/dev/null || git fetch origin main
git fetch upstream main
```

Rebase local branch on top of your fork branch (if it exists):

```bash
if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
  git pull --rebase origin "$branch"
fi
```

Then rebase onto upstream `main`:

```bash
git rebase upstream/main
```

If conflicts occur:

- Resolve files manually.
- Stage resolved files with `git add <file...>`.
- Continue rebase with `git rebase --continue`.
- Repeat until conflict markers are gone and rebase completes.

### 4. Push current branch safely to fork origin

```bash
if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  git push origin "$branch"
else
  git push -u origin "$branch"
fi
```

If push is rejected because remote moved:

```bash
git pull --rebase origin "$branch"
# resolve conflicts if prompted, then:
git push origin "$branch"
```

### 5. Build PR title/body from template (if present)

Set title from the latest commit subject unless the user specifies a title:

```bash
title="$(git log -1 --pretty=%s)"
body_file="$(mktemp -t pr-body.XXXXXX.md)"
```

If `.github/pull_request_template.md` exists, use its structure and fill it with real content from this branch. Do not leave placeholders empty.

```bash
if [ -f .github/pull_request_template.md ]; then
  cp .github/pull_request_template.md "$body_file"
else
  cat > "$body_file" <<'EOF'
## Summary
- What changed
- Why it changed

## Verification
- Commands/tests run and outcome
EOF
fi
```

### 6. Append original prompts as collapsible section at bottom

Append this block to the PR body file:

```bash
{
  printf '\n\n<details>\n<summary>Original user prompts (including follow-ups)</summary>\n\n'
  printf '``````text\n'
  cat .codex/original-user-prompt.txt
  printf '\n``````\n\n</details>\n'
} >> "$body_file"
```

### 7. Create or update a draft PR to upstream with gh

Set cross-repo head:

```bash
head_ref="${fork_owner}:${branch}"
```

Create or update PR in the upstream repo:

```bash
pr_url="$(gh pr list --repo "$upstream_repo" --head "$head_ref" --base main --state open --json url --jq '.[0].url')"

if [ -n "$pr_url" ] && [ "$pr_url" != "null" ]; then
  gh pr edit "$pr_url" --repo "$upstream_repo" --title "$title" --body-file "$body_file"
  is_draft="$(gh pr view "$pr_url" --repo "$upstream_repo" --json isDraft --jq '.isDraft')"
  if [ "$is_draft" != "true" ]; then
    gh pr ready "$pr_url" --repo "$upstream_repo" --undo
  fi
else
  gh pr create --repo "$upstream_repo" --base main --head "$head_ref" --title "$title" --body-file "$body_file" --draft
  pr_url="$(gh pr list --repo "$upstream_repo" --head "$head_ref" --base main --state open --json url --jq '.[0].url')"
fi

echo "Fork repo: $fork_repo"
echo "Upstream repo: $upstream_repo"
echo "PR: $pr_url"
```

## Output Checklist

- Local branch synced with `origin/<branch>` and `upstream/main`.
- Branch pushed to fork `origin/<branch>` without force.
- Draft PR exists on `openclaw/openclaw` with base `main`.
- PR title/body derived from `.github/pull_request_template.md` when present.
- Collapsible "Original user prompts (including follow-ups)" section appended at the bottom using `.codex/original-user-prompt.txt`.
