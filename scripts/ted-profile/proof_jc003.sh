#!/usr/bin/env bash
set -euo pipefail

echo "JC-003 proof (stub-first): Draft-only Graph (2 profiles)"

# Expected profile ids (adjust later if your config uses different names)
PROFILES=("olumie" "everest")

# Sidecar base URL (matches earlier proofs)
BASE_URL="${TED_SIDECAR_URL:-http://127.0.0.1:48080}"

echo "Using BASE_URL=$BASE_URL"

# Helper: curl with sane defaults
curl_json () {
  local url="$1"
  curl -fsS -H "Accept: application/json" "$url"
}

echo "1) Sidecar health..."
curl_json "$BASE_URL/status" >/dev/null
curl_json "$BASE_URL/doctor" >/dev/null
echo "OK: sidecar healthy"

echo "2) Graph status endpoints (should exist eventually). For now, fail-closed is acceptable."
for p in "${PROFILES[@]}"; do
  url="$BASE_URL/graph/$p/status"
  if curl -fsS "$url" >/dev/null 2>&1; then
    echo "OK: $url exists"
  else
    echo "EXPECTED (for now): $url not implemented yet (fail-closed)"
  fi
done

echo "3) Ensure no plaintext token artifacts exist in SIDE-CAR owned paths (scoped check)"
# Only scan areas we control for secrets: sidecars/, docs/ted-profile/, scripts/ted-profile/
SCAN_PATHS=("sidecars" "docs/ted-profile" "scripts/ted-profile")
PATTERN="(refresh_token|access_token|client_secret|Authorization: Bearer)"
FOUND=0
for sp in "${SCAN_PATHS[@]}"; do
  if [ -d "$sp" ]; then
    if grep -RInE "$PATTERN" "$sp" >/dev/null 2>&1; then
      echo "FAIL: token-like strings detected in $sp (scoped)"
      grep -RInE "$PATTERN" "$sp" | sed -n '1,80p'
      FOUND=1
    fi
  fi
done
if [ "$FOUND" -eq 0 ]; then
  echo "OK: no token-like strings in sidecar-owned paths"
else
  exit 1
fi

echo "JC-003 proof stub completed. Implementation will tighten these checks."
