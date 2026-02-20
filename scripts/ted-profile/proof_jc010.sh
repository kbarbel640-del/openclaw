#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TED_SIDECAR_URL:-http://127.0.0.1:48080}"
echo "JC-010 proof: deterministic learning + bounded affinity"

curl -fsS "$BASE_URL/status" >/dev/null

echo "1) Deterministic modifiers should be stable for same input..."
PAYLOAD='{
  "role_id":"deal_analyst",
  "metrics":{
    "draft_acceptance_rate":0.86,
    "triage_reduction_rate":0.23,
    "recurrence_rate":0.18
  }
}'
CODE_1="$(curl -sS -o /tmp/jc010_mod1.out -w "%{http_code}" \
  -X POST "$BASE_URL/learning/modifiers/evaluate" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" || true)"
CODE_2="$(curl -sS -o /tmp/jc010_mod2.out -w "%{http_code}" \
  -X POST "$BASE_URL/learning/modifiers/evaluate" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" || true)"
[ "$CODE_1" = "200" ] && [ "$CODE_2" = "200" ] || {
  echo "FAIL: expected 200 from modifiers endpoint"
  cat /tmp/jc010_mod1.out
  cat /tmp/jc010_mod2.out
  exit 1
}
SIG_1="$(python3 -c 'import json; print(json.load(open("/tmp/jc010_mod1.out"))["deterministic_signature"])' 2>/dev/null || true)"
SIG_2="$(python3 -c 'import json; print(json.load(open("/tmp/jc010_mod2.out"))["deterministic_signature"])' 2>/dev/null || true)"
[ -n "$SIG_1" ] && [ "$SIG_1" = "$SIG_2" ] || {
  echo "FAIL: deterministic signatures do not match"
  cat /tmp/jc010_mod1.out
  cat /tmp/jc010_mod2.out
  exit 1
}
grep -q '"no_policy_override":true' /tmp/jc010_mod1.out || {
  echo "FAIL: modifiers response missing no_policy_override guard"
  cat /tmp/jc010_mod1.out
  exit 1
}
echo "OK: deterministic learning modifiers verified"

echo "2) Affinity routing cannot override policy blocks..."
AFF_CODE="$(curl -sS -o /tmp/jc010_affinity.out -w "%{http_code}" \
  -X POST "$BASE_URL/learning/affinity/route" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled":true,
    "candidates":[
      {"candidate_id":"brain","base_score":0.5,"policy_blocked":false},
      {"candidate_id":"xalt","base_score":0.6,"policy_blocked":true}
    ],
    "affinities":[
      {"candidate_id":"brain","affinity":0.8},
      {"candidate_id":"xalt","affinity":0.95}
    ]
  }' || true)"
[ "$AFF_CODE" = "200" ] || {
  echo "FAIL: expected 200 from affinity routing, got $AFF_CODE"
  cat /tmp/jc010_affinity.out
  exit 1
}
grep -q '"candidate_id":"xalt","reason_code":"POLICY_BLOCKED"' /tmp/jc010_affinity.out || {
  echo "FAIL: policy-blocked candidate was not excluded"
  cat /tmp/jc010_affinity.out
  exit 1
}
grep -q '"no_policy_override":true' /tmp/jc010_affinity.out || {
  echo "FAIL: affinity response missing no_policy_override"
  cat /tmp/jc010_affinity.out
  exit 1
}
echo "OK: affinity is bounded and policy-safe"

echo "3) Excluded meetings must not be processed..."
MEET_EXCL_CODE="$(curl -sS -o /tmp/jc010_meet_excl.out -w "%{http_code}" \
  -X POST "$BASE_URL/learning/meetings/capture" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id":"m-excl-1",
    "excluded":true,
    "transcript":"ACTION: send update"
  }' || true)"
[ "$MEET_EXCL_CODE" = "200" ] || {
  echo "FAIL: expected 200 for excluded meeting, got $MEET_EXCL_CODE"
  cat /tmp/jc010_meet_excl.out
  exit 1
}
grep -q '"status":"SKIPPED_EXCLUDED"' /tmp/jc010_meet_excl.out || {
  echo "FAIL: excluded meeting was not skipped"
  cat /tmp/jc010_meet_excl.out
  exit 1
}
echo "OK: excluded meeting skipped"

echo "4) Eligible meeting should produce summary and actions..."
MEET_OK_CODE="$(curl -sS -o /tmp/jc010_meet_ok.out -w "%{http_code}" \
  -X POST "$BASE_URL/learning/meetings/capture" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id":"m-ok-1",
    "excluded":false,
    "deal_id":"deal-123",
    "transcript":"Weekly deal review\\nACTION: send revised checklist\\nACTION: confirm diligence owner"
  }' || true)"
[ "$MEET_OK_CODE" = "200" ] || {
  echo "FAIL: expected 200 for meeting capture, got $MEET_OK_CODE"
  cat /tmp/jc010_meet_ok.out
  exit 1
}
grep -q '"processed":true' /tmp/jc010_meet_ok.out || {
  echo "FAIL: expected processed=true for eligible meeting"
  cat /tmp/jc010_meet_ok.out
  exit 1
}
grep -q '"action_items"' /tmp/jc010_meet_ok.out || {
  echo "FAIL: expected action_items in eligible meeting output"
  cat /tmp/jc010_meet_ok.out
  exit 1
}
echo "OK: eligible meeting processed with action capture"

echo "JC-010 proof completed successfully."
