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

echo "2) Graph status endpoints should exist and return fail-closed auth state."
for p in "${PROFILES[@]}"; do
  url="$BASE_URL/graph/$p/status"
  payload="$(curl_json "$url")"
  python3 - "$p" "$payload" <<'PY'
import json
import sys
expected_profile = sys.argv[1]
obj = json.loads(sys.argv[2])
required = [
    "profile_id",
    "configured",
    "tenant_id_present",
    "client_id_present",
    "delegated_scopes",
    "auth_state",
    "next_action",
    "last_error",
]
for key in required:
    if key not in obj:
        raise SystemExit(f"missing key in graph status response: {key}")
if obj["profile_id"] != expected_profile:
    raise SystemExit(f"profile_id mismatch: expected {expected_profile}, got {obj['profile_id']}")
if obj["auth_state"] != "DISCONNECTED":
    raise SystemExit(f"unexpected auth_state: {obj['auth_state']}")
if obj["next_action"] != "RUN_DEVICE_CODE_AUTH":
    raise SystemExit(f"unexpected next_action: {obj['next_action']}")
if not isinstance(obj["delegated_scopes"], list):
    raise SystemExit("delegated_scopes must be a list")
print(f"OK: /graph/{expected_profile}/status returns fail-closed auth state")
PY
done

echo "3) Ensure no plaintext token artifacts exist in SIDE-CAR owned paths (scoped check)"
# Only scan areas we control for secrets: sidecars/, docs/ted-profile/, scripts/ted-profile/
SCAN_PATHS=("sidecars")
PATTERN="(refresh_token|access_token|client_secret|Authorization: Bearer)"
GREP_EXCLUDES=(--exclude="*.md" --exclude="proof_jc003.sh")
FOUND=0
for sp in "${SCAN_PATHS[@]}"; do
  if [ -d "$sp" ]; then
    if grep -RInE "${GREP_EXCLUDES[@]}" "$PATTERN" "$sp" >/dev/null 2>&1; then
      echo "FAIL: token-like strings detected in $sp (scoped)"
      grep -RInE "${GREP_EXCLUDES[@]}" "$PATTERN" "$sp" | sed -n '1,80p'
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
