#!/bin/bash
set -euo pipefail

echo "=== OpenClaw Upstream Sync ==="

# Ensure we're in the repo root
cd "$(git rev-parse --show-toplevel)"

# Ensure working tree is clean
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: Working tree is not clean. Commit or stash your changes first."
  exit 1
fi

# Save current branch
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "1/6  Fetching upstream..."
git fetch upstream

echo "2/6  Switching to main..."
git checkout main

echo "3/6  Rebasing main onto upstream/main..."
git rebase upstream/main
# If rebase fails, it will exit here due to set -e.
# User resolves conflicts manually, then re-runs the script.

echo "4/6  Force-pushing main to origin..."
# Temporarily disable branch protection
gh api repos/AlbinB/openclaw/branches/main/protection \
  --method DELETE --silent 2>/dev/null || true

OPENCLAW_SYNC=1 git push origin main --force-with-lease

# Re-enable branch protection
gh api repos/AlbinB/openclaw/branches/main/protection \
  --method PUT --silent --input - <<'GHEOF' 2>/dev/null || true
{
  "required_pull_request_reviews": {
    "required_approving_review_count": 0
  },
  "enforce_admins": true,
  "required_status_checks": null,
  "restrictions": null
}
GHEOF

echo "5/6  Installing dependencies & building..."
pnpm install
pnpm ui:build
pnpm build

echo "6/6  Installing globally..."
pnpm link --global

echo ""
echo "=== Sync complete! ==="
echo "Your commits on top of upstream:"
git log upstream/main..main --oneline

# Return to previous branch
if [ "$CURRENT_BRANCH" != "main" ]; then
  git checkout "$CURRENT_BRANCH"
  echo "Returned to branch: $CURRENT_BRANCH"
fi
