#!/usr/bin/env bash
# check-fly-tools.sh — Local validation script for Fly.io tool configuration
#
# Run this after merging upstream or before deploying to catch regressions.
# Checks that the Dockerfile, fly.toml, and entrypoint are properly configured.
#
# Usage:
#   ./scripts/check-fly-tools.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCKERFILE="$REPO_ROOT/Dockerfile"
FLY_TOML="$REPO_ROOT/fly.toml"
ENTRYPOINT="$REPO_ROOT/scripts/fly-entrypoint.sh"

PASS=0
WARN=0
FAIL=0

ok() {
  echo "  [OK]   $1"
  PASS=$((PASS + 1))
}

warn() {
  echo "  [WARN] $1"
  WARN=$((WARN + 1))
}

fail() {
  echo "  [FAIL] $1"
  FAIL=$((FAIL + 1))
}

# Expected tools — these should appear in both the Dockerfile and entrypoint
EXPECTED_TOOLS=(
  gog
  himalaya
  gh
  slack
  sag
  spotify_player
  jira
)

echo "Checking Fly.io tool configuration..."
echo ""

# ── Check entrypoint exists ────────────────────────────────────────────────
echo "Entrypoint:"
if [ -f "$ENTRYPOINT" ]; then
  ok "scripts/fly-entrypoint.sh exists"
  if [ -x "$ENTRYPOINT" ]; then
    ok "scripts/fly-entrypoint.sh is executable"
  else
    warn "scripts/fly-entrypoint.sh is not executable (chmod +x needed)"
  fi
else
  fail "scripts/fly-entrypoint.sh MISSING — tools will not self-heal!"
fi

echo ""

# ── Check fly.toml references entrypoint ───────────────────────────────────
echo "fly.toml:"
if [ -f "$FLY_TOML" ]; then
  if grep -q "fly-entrypoint.sh" "$FLY_TOML"; then
    ok "fly.toml references fly-entrypoint.sh"
  else
    fail "fly.toml does NOT reference fly-entrypoint.sh — entrypoint will not run!"
  fi
else
  fail "fly.toml not found"
fi

echo ""

# ── Check Dockerfile for each tool ────────────────────────────────────────
echo "Dockerfile tool installs:"
if [ -f "$DOCKERFILE" ]; then
  for tool in "${EXPECTED_TOOLS[@]}"; do
    if grep -qi "$tool" "$DOCKERFILE"; then
      ok "$tool found in Dockerfile"
    else
      warn "$tool NOT found in Dockerfile (entrypoint will download at boot, but slower)"
    fi
  done

  echo ""
  echo "Dockerfile extras:"

  # Check npm globals
  for pkg in trello-cli notion-cli vercel claude-code shopify mcporter; do
    if grep -qi "$pkg" "$DOCKERFILE"; then
      ok "npm package '$pkg' found in Dockerfile"
    else
      warn "npm package '$pkg' NOT found in Dockerfile"
    fi
  done

  # Check entrypoint chmod
  if grep -q "chmod.*fly-entrypoint" "$DOCKERFILE"; then
    ok "Dockerfile has chmod for fly-entrypoint.sh"
  else
    warn "Dockerfile missing chmod for fly-entrypoint.sh"
  fi
else
  fail "Dockerfile not found"
fi

echo ""

# ── Check entrypoint has tool manifest ─────────────────────────────────────
echo "Entrypoint tool manifest:"
if [ -f "$ENTRYPOINT" ]; then
  for tool in "${EXPECTED_TOOLS[@]}"; do
    if grep -q "\"$tool|" "$ENTRYPOINT" || grep -q "ensure_$tool\|# $tool" "$ENTRYPOINT"; then
      ok "$tool in entrypoint manifest"
    else
      warn "$tool NOT in entrypoint manifest — will not self-heal if missing from image"
    fi
  done
fi

echo ""

# ── Summary ────────────────────────────────────────────────────────────────
echo "Summary: $PASS passed, $WARN warnings, $FAIL failures"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "FAILURES detected — tools may not be available on Larry!"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo ""
  echo "Warnings present — tools will still work via entrypoint self-healing,"
  echo "but Dockerfile installs are faster. Consider fixing before deploying."
  exit 0
else
  echo ""
  echo "All checks passed!"
  exit 0
fi
