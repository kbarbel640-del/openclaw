#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TED_SIDECAR_URL:-http://127.0.0.1:48080}"
echo "JC-008 proof: escalation + confidence + contradiction controls"

curl -fsS "$BASE_URL/status" >/dev/null

echo "1) Low confidence should escalate to questions..."
CONF_CODE="$(curl -sS -o /tmp/jc008_conf.out -w "%{http_code}" \
  -X POST "$BASE_URL/governance/confidence/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "threshold":0.8,
    "extracted_items":[
      {"item_id":"i-low","confidence":0.61,"source_refs":["email:1"],"risky":true},
      {"item_id":"i-high","confidence":0.93,"source_refs":["email:2"],"risky":false}
    ]
  }' || true)"
[ "$CONF_CODE" = "200" ] || {
  echo "FAIL: expected 200 from confidence evaluator, got $CONF_CODE"
  cat /tmp/jc008_conf.out
  exit 1
}
grep -q '"escalation_required":true' /tmp/jc008_conf.out || {
  echo "FAIL: expected escalation_required=true"
  cat /tmp/jc008_conf.out
  exit 1
}
grep -q '"reason_code":"LOW_CONFIDENCE"' /tmp/jc008_conf.out || {
  echo "FAIL: expected LOW_CONFIDENCE reason code"
  cat /tmp/jc008_conf.out
  exit 1
}
echo "OK: low confidence escalation enforced"

echo "2) Contradiction check should block conflicting commitment..."
CONFLICT_CODE="$(curl -sS -o /tmp/jc008_conflict.out -w "%{http_code}" \
  -X POST "$BASE_URL/governance/contradictions/check" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_commitment":{"field":"close_date","value":"2026-03-12"},
    "prior_commitments":[
      {"field":"close_date","value":"2026-03-20","source_id":"msg-42","citation":"email://msg-42"},
      {"field":"purchase_price","value":"12000000","source_id":"msg-43","citation":"email://msg-43"}
    ]
  }' || true)"
[ "$CONFLICT_CODE" = "409" ] || {
  echo "FAIL: expected 409 on contradiction, got $CONFLICT_CODE"
  cat /tmp/jc008_conflict.out
  exit 1
}
grep -q '"reason_code":"CONTRADICTION_DETECTED"' /tmp/jc008_conflict.out || {
  echo "FAIL: missing CONTRADICTION_DETECTED reason code"
  cat /tmp/jc008_conflict.out
  exit 1
}
grep -q '"citation":"email://msg-42"' /tmp/jc008_conflict.out || {
  echo "FAIL: contradiction response missing citation"
  cat /tmp/jc008_conflict.out
  exit 1
}
echo "OK: contradiction blocked with citation"

echo "3) Non-conflicting commitment should pass..."
NOCONFLICT_CODE="$(curl -sS -o /tmp/jc008_noconflict.out -w "%{http_code}" \
  -X POST "$BASE_URL/governance/contradictions/check" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_commitment":{"field":"close_date","value":"2026-03-20"},
    "prior_commitments":[
      {"field":"close_date","value":"2026-03-20","source_id":"msg-42","citation":"email://msg-42"}
    ]
  }' || true)"
[ "$NOCONFLICT_CODE" = "200" ] || {
  echo "FAIL: expected 200 with no contradiction, got $NOCONFLICT_CODE"
  cat /tmp/jc008_noconflict.out
  exit 1
}
grep -q '"contradictions_found":false' /tmp/jc008_noconflict.out || {
  echo "FAIL: no-contradiction response missing flag"
  cat /tmp/jc008_noconflict.out
  exit 1
}
echo "OK: non-contradictory commitment passed"

echo "4) High-risk escalation must route to approval queue..."
ROUTE_CODE="$(curl -sS -o /tmp/jc008_route.out -w "%{http_code}" \
  -X POST "$BASE_URL/governance/escalations/route" \
  -H "Content-Type: application/json" \
  -d '{
    "item_id":"esc-1",
    "risk_level":"high",
    "reasons":["LOW_CONFIDENCE","NUMERIC_CLAIM_UNVERIFIED"]
  }' || true)"
[ "$ROUTE_CODE" = "200" ] || {
  echo "FAIL: expected 200 from escalation router, got $ROUTE_CODE"
  cat /tmp/jc008_route.out
  exit 1
}
grep -q '"route_target":"approval_queue"' /tmp/jc008_route.out || {
  echo "FAIL: expected approval_queue route target"
  cat /tmp/jc008_route.out
  exit 1
}
grep -q '"no_execute":true' /tmp/jc008_route.out || {
  echo "FAIL: expected no_execute=true safeguard"
  cat /tmp/jc008_route.out
  exit 1
}
echo "OK: escalation route and no-execute safeguard enforced"

echo "JC-008 proof completed successfully."
