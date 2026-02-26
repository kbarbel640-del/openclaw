#!/usr/bin/env bash
# check-boundary.sh — Audit the openclaw/lobsterBucket boundary
#
# Finds code, configs, or references in openclaw that should live in
# lobsterBucket (operational playbook) instead. Run from the repo root.
#
# Usage:
#   ./scripts/check-boundary.sh          # audit only (default)
#   ./scripts/check-boundary.sh --fix    # audit + prompt to remove violations
#
# What this checks:
#   1. lobsterBucket directory nested inside openclaw (should be separate repo)
#   2. Governance/playbook files that belong in lobsterBucket
#   3. Usage policy embedded in model configs (should be in PLAYBOOK.md)
#   4. Credential values accidentally committed (not just env var references)
#   5. Runtime workspace files committed to the repo
#
# What this does NOT flag:
#   - References to lobsterBucket in docs (SETUP.md, SOUL.md) — those are correct
#   - CLOUD_STRATEGY.md boundary notes — those define the boundary, not violate it
#   - configs/model_config.json — that's openclaw's domain

set -euo pipefail

FIX_MODE=false
if [[ "${1:-}" == "--fix" ]]; then
  FIX_MODE=true
fi

VIOLATIONS=0
WARNINGS=0

red()    { printf '\033[0;31m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
green()  { printf '\033[0;32m%s\033[0m\n' "$1"; }

violation() {
  VIOLATIONS=$((VIOLATIONS + 1))
  red "VIOLATION: $1"
  if [[ -n "${2:-}" ]]; then
    echo "  Location: $2"
  fi
}

warning() {
  WARNINGS=$((WARNINGS + 1))
  yellow "WARNING: $1"
  if [[ -n "${2:-}" ]]; then
    echo "  Location: $2"
  fi
}

echo "=== OpenClaw / lobsterBucket Boundary Audit ==="
echo ""

# 1. Check for nested lobsterBucket directory
if [[ -d "lobsterBucket" ]]; then
  violation "lobsterBucket/ directory found inside openclaw repo" "lobsterBucket/"
  echo "  lobsterBucket should be a separate git repository, not nested here."
  echo "  Add 'lobsterBucket/' to .gitignore (already done if you ran the latest setup)."
  if $FIX_MODE; then
    echo "  Skipping auto-removal — move it manually: mv lobsterBucket ~/brock/lobsterBucket"
  fi
fi

# 2. Check for governance/playbook files that belong in lobsterBucket
for file in PLAYBOOK.md GOVERNANCE.md RUNBOOK.md; do
  if [[ -f "$file" ]]; then
    violation "$file found at repo root — belongs in lobsterBucket" "$file"
  fi
  # Also check docs/ and configs/
  for dir in docs configs; do
    found=$(find "$dir" -name "$file" 2>/dev/null || true)
    if [[ -n "$found" ]]; then
      violation "$file found in $dir/ — belongs in lobsterBucket" "$found"
    fi
  done
done

# 3. Check for job filter configs that belong in lobsterBucket
for pattern in "job-filters" "job_filters" "automation-triggers" "approval-chain"; do
  found=$(grep -rl "$pattern" configs/ 2>/dev/null || true)
  if [[ -n "$found" ]]; then
    warning "Possible lobsterBucket config found (pattern: $pattern)" "$found"
    echo "  Job filters and automation triggers should live in lobsterBucket/configs/"
  fi
done

# 4. Check for hardcoded credential values (not env var references)
# Look for patterns that suggest actual API keys, not ${VAR} references
for pattern in 'sk-[a-zA-Z0-9]{20,}' 'ghp_[a-zA-Z0-9]{36}' 'xoxb-[0-9]' 'glm_[a-zA-Z0-9]{20,}'; do
  found=$(grep -rn --include='*.json' --include='*.ts' --include='*.js' --include='*.md' \
    -E "$pattern" . 2>/dev/null | grep -v node_modules | grep -v '.git/' || true)
  if [[ -n "$found" ]]; then
    violation "Possible hardcoded credential found" ""
    echo "$found" | head -5
    echo "  Credentials should be in ~/.openclaw/.env or macOS Keychain, never in repo files."
  fi
done

# 5. Check for runtime workspace files committed to the repo
for file in BOOTSTRAP.md MEMORY.md workspace-state.json; do
  if git ls-files --error-unmatch "$file" 2>/dev/null; then
    violation "Runtime workspace file tracked by git: $file" "$file"
    echo "  This file is generated at runtime and should be in .gitignore."
    if $FIX_MODE; then
      git rm --cached "$file" 2>/dev/null && echo "  Removed from git tracking (file preserved on disk)."
    fi
  fi
done

# 6. Check for auth-profiles.json tracked by git
found=$(git ls-files '**/auth-profiles.json' 2>/dev/null || true)
if [[ -n "$found" ]]; then
  violation "auth-profiles.json tracked by git — contains credentials" "$found"
  if $FIX_MODE; then
    git rm --cached $found 2>/dev/null && echo "  Removed from git tracking."
  fi
fi

# 7. Check for model weight files
found=$(find . -name '*.gguf' -o -name '*.ggml' -o -name '*.safetensors' 2>/dev/null | grep -v node_modules || true)
if [[ -n "$found" ]]; then
  violation "Model weight files found in repo" "$found"
  echo "  These should not be in the repo. Add to .gitignore and remove."
fi

echo ""
echo "=== Audit Complete ==="
if [[ $VIOLATIONS -eq 0 && $WARNINGS -eq 0 ]]; then
  green "Clean. No boundary violations found."
elif [[ $VIOLATIONS -eq 0 ]]; then
  yellow "$WARNINGS warning(s), 0 violations."
else
  red "$VIOLATIONS violation(s), $WARNINGS warning(s)."
  echo ""
  echo "To auto-fix what's safe to fix: ./scripts/check-boundary.sh --fix"
  exit 1
fi
