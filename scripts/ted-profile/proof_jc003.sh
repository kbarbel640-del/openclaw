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
if obj["auth_state"] not in ("CONNECTED", "DISCONNECTED"):
    raise SystemExit(f"unexpected auth_state: {obj['auth_state']}")
if not isinstance(obj["delegated_scopes"], list):
    raise SystemExit("delegated_scopes must be a list")
print(f"OK: /graph/{expected_profile}/status schema validated (auth_state={obj['auth_state']})")
PY
done

echo "2a) Ensure draft-required scopes are declared (Mail.ReadWrite)..."
for p in "${PROFILES[@]}"; do
  s=$(curl -fsS -H "Accept: application/json" "$BASE_URL/graph/$p/status")
  echo "$s" | grep -q '"delegated_scopes"' || { echo "FAIL: no delegated_scopes in status for $p"; exit 1; }
  echo "$s" | grep -q '"Mail.ReadWrite"' || { echo "FAIL: $p missing Mail.ReadWrite in delegated_scopes"; exit 1; }
done

echo "2b) Device-code start endpoint should exist and return challenge schema."
start_payload="$(curl -fsS -X POST -H "Accept: application/json" "$BASE_URL/graph/olumie/auth/device/start")"
python3 - "$start_payload" <<'PY'
import json
import sys
obj = json.loads(sys.argv[1])
required = [
    "profile_id",
    "tenant_id",
    "client_id",
    "scopes",
    "verification_uri",
    "user_code",
    "device_code",
    "expires_in",
    "interval",
    "message",
]
for key in required:
    if key not in obj:
        raise SystemExit(f"missing key in device start response: {key}")
if obj["profile_id"] != "olumie":
    raise SystemExit(f"unexpected profile_id: {obj['profile_id']}")
if not isinstance(obj["scopes"], list):
    raise SystemExit("scopes must be a list")
print("OK: /graph/olumie/auth/device/start response schema validated")
PY

echo "2c) Draft-create should fail closed while disconnected."
for p in "${PROFILES[@]}"; do
  curl -fsS -X POST -H "Accept: application/json" "$BASE_URL/graph/$p/auth/revoke" >/dev/null
done
draft_code="$(curl -s -o /tmp/jc003_draft_resp.json -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  "$BASE_URL/graph/olumie/mail/draft/create" \
  -d '{"subject":"JC003 Probe","to":["test@example.com"],"body_text":"probe"}')"
if [ "$draft_code" != "409" ]; then
  echo "FAIL: expected 409 NOT_AUTHENTICATED from draft create, got $draft_code"
  cat /tmp/jc003_draft_resp.json || true
  exit 1
fi
python3 - <<'PY'
import json
from pathlib import Path
obj = json.loads(Path("/tmp/jc003_draft_resp.json").read_text(encoding="utf-8"))
if obj.get("error") != "NOT_AUTHENTICATED":
    raise SystemExit(f"unexpected error payload: {obj}")
if obj.get("next_action") != "RUN_DEVICE_CODE_AUTH":
    raise SystemExit(f"unexpected next_action payload: {obj}")
print("OK: /mail/draft/create fails closed with NOT_AUTHENTICATED")
PY

echo "3) Ensure no plaintext token artifacts exist in SIDE-CAR owned paths (scoped check)"
# Only scan areas we control for secrets: sidecars/, docs/ted-profile/, scripts/ted-profile/
SCAN_PATHS=("sidecars")
PATTERN="(\"(refresh_token|access_token|client_secret)\"[[:space:]]*:[[:space:]]*\"[A-Za-z0-9._~-]{12,}\"|Authorization:[[:space:]]*Bearer[[:space:]]+[A-Za-z0-9._~-]{12,})"
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
