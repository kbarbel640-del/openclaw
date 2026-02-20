#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TED_SIDECAR_URL:-http://127.0.0.1:48080}"
echo "JC-006 proof: role cards + hard bans + output contract"

curl -fsS "$BASE_URL/status" >/dev/null

echo "1) Invalid role card should fail closed..."
INVALID_ROLE_CODE="$(curl -sS -o /tmp/jc006_invalid_role.out -w "%{http_code}" \
  -X POST "$BASE_URL/governance/role-cards/validate" \
  -H "Content-Type: application/json" \
  -d '{"role_card":{"role_id":"writer"}}' || true)"
[ "$INVALID_ROLE_CODE" = "400" ] || {
  echo "FAIL: expected 400 for invalid role card, got $INVALID_ROLE_CODE"
  cat /tmp/jc006_invalid_role.out
  exit 1
}
grep -q '"reason_code"' /tmp/jc006_invalid_role.out || {
  echo "FAIL: invalid role response missing reason_code"
  cat /tmp/jc006_invalid_role.out
  exit 1
}
grep -q '"next_safe_step"' /tmp/jc006_invalid_role.out || {
  echo "FAIL: invalid role response missing next_safe_step"
  cat /tmp/jc006_invalid_role.out
  exit 1
}
echo "OK: invalid role card blocked with explainability"

echo "2) Valid role card should pass..."
ROLE_PAYLOAD='{
  "role_card":{
    "role_id":"social_drafter",
    "domain":"Draft-only outbound content",
    "inputs":["inbound context","brand guidance"],
    "outputs":["drafts","risk flags"],
    "definition_of_done":["review ready draft","risk flagged"],
    "hard_bans":["no direct posting","no made-up numbers"],
    "escalation":["controversial claims","unverified metrics"]
  }
}'
VALID_ROLE_CODE="$(curl -sS -o /tmp/jc006_valid_role.out -w "%{http_code}" \
  -X POST "$BASE_URL/governance/role-cards/validate" \
  -H "Content-Type: application/json" \
  -d "$ROLE_PAYLOAD" || true)"
[ "$VALID_ROLE_CODE" = "200" ] || {
  echo "FAIL: expected 200 for valid role card, got $VALID_ROLE_CODE"
  cat /tmp/jc006_valid_role.out
  exit 1
}
grep -q '"valid":true' /tmp/jc006_valid_role.out || {
  echo "FAIL: valid role response missing valid=true"
  cat /tmp/jc006_valid_role.out
  exit 1
}
echo "OK: valid role card accepted"

echo "3) Hard-ban match should block candidate output..."
HARD_BAN_BLOCK_CODE="$(curl -sS -o /tmp/jc006_hard_ban_block.out -w "%{http_code}" \
  -X POST "$BASE_URL/governance/hard-bans/check" \
  -H "Content-Type: application/json" \
  -d '{
    "role_card":{
      "role_id":"social_drafter",
      "domain":"Draft-only outbound content",
      "inputs":["inbound context"],
      "outputs":["drafts"],
      "definition_of_done":["review ready draft"],
      "hard_bans":["no direct posting","no made-up numbers"],
      "escalation":["controversial claims"]
    },
    "candidate_output":"We should do no direct posting today."
  }' || true)"
[ "$HARD_BAN_BLOCK_CODE" = "409" ] || {
  echo "FAIL: expected 409 for hard-ban violation, got $HARD_BAN_BLOCK_CODE"
  cat /tmp/jc006_hard_ban_block.out
  exit 1
}
grep -q '"reason_code":"HARD_BAN_VIOLATION"' /tmp/jc006_hard_ban_block.out || {
  echo "FAIL: missing HARD_BAN_VIOLATION reason code"
  cat /tmp/jc006_hard_ban_block.out
  exit 1
}
echo "OK: hard-ban violation blocked"

echo "4) Hard-ban clean candidate should pass..."
HARD_BAN_PASS_CODE="$(curl -sS -o /tmp/jc006_hard_ban_pass.out -w "%{http_code}" \
  -X POST "$BASE_URL/governance/hard-bans/check" \
  -H "Content-Type: application/json" \
  -d '{
    "role_card":{
      "role_id":"social_drafter",
      "domain":"Draft-only outbound content",
      "inputs":["inbound context"],
      "outputs":["drafts"],
      "definition_of_done":["review ready draft"],
      "hard_bans":["no direct posting","no made-up numbers"],
      "escalation":["controversial claims"]
    },
    "candidate_output":"Draft queued for operator review with source notes."
  }' || true)"
[ "$HARD_BAN_PASS_CODE" = "200" ] || {
  echo "FAIL: expected 200 for hard-ban clean output, got $HARD_BAN_PASS_CODE"
  cat /tmp/jc006_hard_ban_pass.out
  exit 1
}
grep -q '"allowed":true' /tmp/jc006_hard_ban_pass.out || {
  echo "FAIL: hard-ban pass response missing allowed=true"
  cat /tmp/jc006_hard_ban_pass.out
  exit 1
}
echo "OK: hard-ban clean output passed"

echo "5) Invalid output contract should fail..."
INVALID_OUTPUT_CODE="$(curl -sS -o /tmp/jc006_invalid_output.out -w "%{http_code}" \
  -X POST "$BASE_URL/governance/output/validate" \
  -H "Content-Type: application/json" \
  -d '{"output":{"title":"t"}}' || true)"
[ "$INVALID_OUTPUT_CODE" = "400" ] || {
  echo "FAIL: expected 400 for invalid output contract, got $INVALID_OUTPUT_CODE"
  cat /tmp/jc006_invalid_output.out
  exit 1
}
grep -q '"reason_code"' /tmp/jc006_invalid_output.out || {
  echo "FAIL: invalid output response missing reason_code"
  cat /tmp/jc006_invalid_output.out
  exit 1
}
echo "OK: invalid output contract blocked"

echo "6) Valid output contract should pass..."
VALID_OUTPUT_CODE="$(curl -sS -o /tmp/jc006_valid_output.out -w "%{http_code}" \
  -X POST "$BASE_URL/governance/output/validate" \
  -H "Content-Type: application/json" \
  -d '{
    "output":{
      "title":"Daily priority draft",
      "summary":"Top actions for today with linked evidence.",
      "recommended_actions":[{"priority":"high","owner":"clint","due_date":"2026-02-21"}],
      "questions":["Should this be escalated to counsel?"],
      "citations":[{"source_type":"email","source_id":"msg-123"}],
      "entity_tag":{"primary_entity":"Everest"},
      "audience":"operator"
    }
  }' || true)"
[ "$VALID_OUTPUT_CODE" = "200" ] || {
  echo "FAIL: expected 200 for valid output contract, got $VALID_OUTPUT_CODE"
  cat /tmp/jc006_valid_output.out
  exit 1
}
grep -q '"valid":true' /tmp/jc006_valid_output.out || {
  echo "FAIL: valid output response missing valid=true"
  cat /tmp/jc006_valid_output.out
  exit 1
}
echo "OK: valid output contract accepted"

echo "JC-006 proof completed successfully."
