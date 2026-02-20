#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TED_SIDECAR_URL:-http://127.0.0.1:48080}"
echo "JC-009 proof: pause/resume + rate governance"

curl -fsS "$BASE_URL/status" >/dev/null

echo "1) Pause automation..."
PAUSE_CODE="$(curl -sS -o /tmp/jc009_pause.out -w "%{http_code}" \
  -X POST "$BASE_URL/ops/pause" \
  -H "Content-Type: application/json" \
  -d '{"reason":"proof_jc009"}' || true)"
[ "$PAUSE_CODE" = "200" ] || {
  echo "FAIL: expected 200 from /ops/pause, got $PAUSE_CODE"
  cat /tmp/jc009_pause.out
  exit 1
}
grep -q '"paused":true' /tmp/jc009_pause.out || {
  echo "FAIL: pause response missing paused=true"
  cat /tmp/jc009_pause.out
  exit 1
}
echo "OK: pause active"

echo "2) Non-critical dispatch should queue while paused..."
DISPATCH_CODE="$(curl -sS -o /tmp/jc009_dispatch.out -w "%{http_code}" \
  -X POST "$BASE_URL/ops/dispatch/check" \
  -H "Content-Type: application/json" \
  -d '{"priority":"LOW"}' || true)"
[ "$DISPATCH_CODE" = "409" ] || {
  echo "FAIL: expected 409 dispatch block during pause, got $DISPATCH_CODE"
  cat /tmp/jc009_dispatch.out
  exit 1
}
grep -q '"reason_code":"PAUSE_ACTIVE"' /tmp/jc009_dispatch.out || {
  echo "FAIL: dispatch block missing PAUSE_ACTIVE reason"
  cat /tmp/jc009_dispatch.out
  exit 1
}
echo "OK: non-critical dispatch queued"

echo "3) Resume automation should return catch-up summary..."
RESUME_CODE="$(curl -sS -o /tmp/jc009_resume.out -w "%{http_code}" \
  -X POST "$BASE_URL/ops/resume" \
  -H "Content-Type: application/json" \
  -d '{}' || true)"
[ "$RESUME_CODE" = "200" ] || {
  echo "FAIL: expected 200 from /ops/resume, got $RESUME_CODE"
  cat /tmp/jc009_resume.out
  exit 1
}
grep -q '"resumed":true' /tmp/jc009_resume.out || {
  echo "FAIL: resume response missing resumed=true"
  cat /tmp/jc009_resume.out
  exit 1
}
grep -q '"catch_up_summary"' /tmp/jc009_resume.out || {
  echo "FAIL: resume response missing catch_up_summary"
  cat /tmp/jc009_resume.out
  exit 1
}
echo "OK: resume summary returned"

echo "4) Rate policy should defer low priority at high quota..."
RATE_DEFER_CODE="$(curl -sS -o /tmp/jc009_rate_defer.out -w "%{http_code}" \
  -X POST "$BASE_URL/ops/rate/evaluate" \
  -H "Content-Type: application/json" \
  -d '{"quota_percent":91,"priority":"LOW"}' || true)"
[ "$RATE_DEFER_CODE" = "200" ] || {
  echo "FAIL: expected 200 from /ops/rate/evaluate, got $RATE_DEFER_CODE"
  cat /tmp/jc009_rate_defer.out
  exit 1
}
grep -q '"action":"DEFER"' /tmp/jc009_rate_defer.out || {
  echo "FAIL: expected DEFER action at high quota low priority"
  cat /tmp/jc009_rate_defer.out
  exit 1
}
echo "OK: rate defer policy enforced"

echo "5) Rate policy should allow critical at high quota..."
RATE_ALLOW_CODE="$(curl -sS -o /tmp/jc009_rate_allow.out -w "%{http_code}" \
  -X POST "$BASE_URL/ops/rate/evaluate" \
  -H "Content-Type: application/json" \
  -d '{"quota_percent":91,"priority":"CRITICAL"}' || true)"
[ "$RATE_ALLOW_CODE" = "200" ] || {
  echo "FAIL: expected 200 from /ops/rate/evaluate for critical, got $RATE_ALLOW_CODE"
  cat /tmp/jc009_rate_allow.out
  exit 1
}
grep -q '"action":"ALLOW"' /tmp/jc009_rate_allow.out || {
  echo "FAIL: expected ALLOW action for critical at high quota"
  cat /tmp/jc009_rate_allow.out
  exit 1
}
echo "OK: critical bypass preserved under quota pressure"

echo "JC-009 proof completed successfully."
