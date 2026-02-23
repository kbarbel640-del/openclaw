#!/bin/bash

# GitHub Fork Creation Script
# This script creates a fork and pushes your branch

set -e

GITHUB_USER="trungutt"
GITHUB_TOKEN="${GITHUB_TOKEN}"  # Set via: export GITHUB_TOKEN="your-token"
UPSTREAM_REPO="openclaw/openclaw"
FORK_REPO="${GITHUB_USER}/openclaw"
BRANCH_NAME="optimize/docker-buildkit-cache"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  GitHub Fork Creation & Branch Push Script                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if token is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ ERROR: GITHUB_TOKEN not set"
    echo ""
    echo "To use this script, set your GitHub token:"
    echo "  export GITHUB_TOKEN='your-github-personal-access-token'"
    echo ""
    echo "To create a token:"
    echo "  1. Go to: https://github.com/settings/tokens"
    echo "  2. Click 'Generate new token' (classic)"
    echo "  3. Select scopes: repo, admin:repo_hook"
    echo "  4. Copy the token and run:"
    echo "     export GITHUB_TOKEN='token-here'"
    echo ""
    exit 1
fi

echo "✓ GitHub token found"
echo ""

# Step 1: Create fork via GitHub API
echo "Step 1: Creating fork for user '$GITHUB_USER'..."
FORK_RESPONSE=$(curl -s -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/$UPSTREAM_REPO/forks \
  -d '{}')

echo "$FORK_RESPONSE" | grep -q '"id"'
if [ $? -eq 0 ]; then
    echo "✓ Fork created successfully!"
else
    echo "✗ Fork creation failed"
    echo "Response: $FORK_RESPONSE"
    exit 1
fi

# Check if fork already exists
if echo "$FORK_RESPONSE" | grep -q '"message": "Validation Failed"'; then
    echo "ℹ Fork already exists (or creation in progress)"
fi

echo ""

# Step 2: Wait for fork to be available
echo "Step 2: Waiting for fork to be available (this may take 30 seconds)..."
for i in {1..30}; do
    FORK_CHECK=$(curl -s \
      -H "Authorization: token $GITHUB_TOKEN" \
      -H "Accept: application/vnd.github.v3+json" \
      https://api.github.com/repos/$FORK_REPO)
    
    if echo "$FORK_CHECK" | grep -q '"id"'; then
        echo "✓ Fork is ready!"
        break
    fi
    
    echo -n "."
    sleep 1
done

echo ""
echo ""

# Step 3: Add fork as remote
echo "Step 3: Adding fork as git remote..."
if git remote | grep -q "^fork$"; then
    echo "ℹ Fork remote already exists"
else
    git remote add fork https://github.com/$FORK_REPO.git
    echo "✓ Fork remote added"
fi

echo ""

# Step 4: Push branch to fork
echo "Step 4: Pushing branch '$BRANCH_NAME' to your fork..."
git push -u fork $BRANCH_NAME 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Branch pushed successfully!"
else
    echo "✗ Failed to push branch"
    exit 1
fi

echo ""
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  ✅ FORK & PUSH COMPLETE!                                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Your branch is now on GitHub:"
echo "  https://github.com/$FORK_REPO/tree/$BRANCH_NAME"
echo ""
echo "Next steps:"
echo ""
echo "1. View your fork:"
echo "   https://github.com/$FORK_REPO"
echo ""
echo "2. Create Pull Request:"
echo "   https://github.com/$FORK_REPO/pull/new/$BRANCH_NAME"
echo ""
echo "   Or use GitHub CLI:"
echo "   gh pr create \\
      --repo $UPSTREAM_REPO \\
      --base main \\
      --head $GITHUB_USER:$BRANCH_NAME"
echo ""
echo "3. (Optional) Use PR template from PR_SUMMARY.md"
echo ""
