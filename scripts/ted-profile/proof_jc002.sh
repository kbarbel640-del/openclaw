#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required"
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required"
  exit 1
fi

bash scripts/ted-profile/jc002_install_autostart.sh

echo "Waiting for ted-engine sidecar health..."
ready=0
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:48080/status" >/dev/null 2>&1 && \
     curl -fsS "http://127.0.0.1:48080/doctor" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.25
done

if [[ "$ready" != "1" ]]; then
  echo "ted sidecar did not become healthy"
  exit 1
fi

status_json="$(curl -fsS "http://127.0.0.1:48080/status")"
doctor_json="$(curl -fsS "http://127.0.0.1:48080/doctor")"
python3 - "$status_json" "$doctor_json" <<'PY'
import json
import sys
for raw in sys.argv[1:]:
    obj = json.loads(raw)
    for key in ("version", "uptime", "profiles_count"):
        if key not in obj:
            raise SystemExit(f"missing key: {key}")
print("ted sidecar payload schema verified")
PY

code="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:48080/not-allowlisted" || true)"
if [[ "$code" != "404" ]]; then
  echo "unexpected non-allowlisted endpoint status: $code"
  exit 1
fi

# Equivalent OpenClaw command-path verification:
# doctor now checks ted sidecar health via the gateway service runtime.
doctor_out="$(node scripts/run-node.mjs doctor --non-interactive 2>&1 || true)"
echo "$doctor_out" | grep -q "Ted sidecar" || {
  echo "doctor output missing Ted sidecar health section"
  echo "$doctor_out"
  exit 1
}

echo "JC-002 proof passed"
echo "- gateway service installed/started via existing daemon framework"
echo "- ted sidecar healthy at /status and /doctor"
echo "- non-allowlisted endpoint blocked"
echo "- OpenClaw doctor reflects sidecar health"
