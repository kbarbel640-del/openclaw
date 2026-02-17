#!/usr/bin/env bash
set -euo pipefail

# Set up GitHub Pages deployment via GitHub Actions
# Creates a workflow file and configures the repo for Pages
# Usage: setup-gh-pages.sh [--dir dist] [--branch main]

BUILD_DIR="dist"
BRANCH="main"

while [[ $# -gt 0 ]]; do
  case $1 in
    --dir) BUILD_DIR="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

WORKFLOW_DIR=".github/workflows"
WORKFLOW_FILE="$WORKFLOW_DIR/deploy-pages.yml"

mkdir -p "$WORKFLOW_DIR"

cat > "$WORKFLOW_FILE" << YAML
name: Deploy to GitHub Pages

on:
  push:
    branches: ["$BRANCH"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: "$BUILD_DIR"

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
YAML

echo "Created $WORKFLOW_FILE"
echo "Commit and push to '$BRANCH' to trigger deployment."

# Enable GitHub Pages via API if gh CLI is available
if command -v gh &> /dev/null; then
  REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || true)
  if [[ -n "$REPO" ]]; then
    echo "Enabling GitHub Pages for $REPO..."
    gh api "repos/$REPO/pages" \
      --method POST \
      -f "build_type=workflow" 2>/dev/null || echo "(Pages may already be configured)"
  fi
fi
