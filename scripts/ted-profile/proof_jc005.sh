#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TED_SIDECAR_URL:-http://127.0.0.1:48080}"
echo "JC-005 proof: filing suggestions queue"
SUGGESTION_TEST_ID="jc005_$(date +%s)_$RANDOM"

# Precondition: sidecar must be running
curl -fsS "$BASE_URL/status" >/dev/null

echo "1) Propose a filing suggestion..."
PROPOSE_CODE="$(curl -sS -o /tmp/jc005_propose.out -w "%{http_code}" \
  -X POST "$BASE_URL/filing/suggestions/propose" \
  -H "Content-Type: application/json" \
  -d "{\"source_type\":\"email\",\"source_ref\":\"message:$SUGGESTION_TEST_ID\",\"triage_item_id\":\"ti_$SUGGESTION_TEST_ID\",\"suggested_path\":\"/Deals/Proof/$SUGGESTION_TEST_ID\",\"rationale\":\"proof jc005\"}" || true)"
[ "$PROPOSE_CODE" = "201" ] || { echo "FAIL: expected 201 from propose, got $PROPOSE_CODE"; cat /tmp/jc005_propose.out; exit 1; }
SUGGESTION_ID="$(python3 -c 'import json,sys; print(json.load(open("/tmp/jc005_propose.out")).get("suggestion_id",""))' 2>/dev/null || true)"
[ -n "$SUGGESTION_ID" ] || { echo "FAIL: missing suggestion_id in propose response"; cat /tmp/jc005_propose.out; exit 1; }
echo "OK: proposed $SUGGESTION_ID"

echo "2) Verify it appears in default list as PROPOSED..."
LIST_CODE="$(curl -sS -o /tmp/jc005_list.out -w "%{http_code}" "$BASE_URL/filing/suggestions/list" || true)"
[ "$LIST_CODE" = "200" ] || { echo "FAIL: expected 200 from list, got $LIST_CODE"; cat /tmp/jc005_list.out; exit 1; }
grep -q "\"suggestion_id\":\"$SUGGESTION_ID\"" /tmp/jc005_list.out || { echo "FAIL: suggestion missing in default list"; cat /tmp/jc005_list.out; exit 1; }
grep -q "\"status\":\"PROPOSED\"" /tmp/jc005_list.out || { echo "FAIL: expected PROPOSED status in default list"; cat /tmp/jc005_list.out; exit 1; }
echo "OK: default list shows PROPOSED suggestion"

echo "3) Approve the suggestion..."
APPROVE_CODE="$(curl -sS -o /tmp/jc005_approve.out -w "%{http_code}" \
  -X POST "$BASE_URL/filing/suggestions/$SUGGESTION_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"approved_by":"proof_jc005"}' || true)"
[ "$APPROVE_CODE" = "200" ] || { echo "FAIL: expected 200 from approve, got $APPROVE_CODE"; cat /tmp/jc005_approve.out; exit 1; }
grep -q "\"status\":\"APPROVED\"" /tmp/jc005_approve.out || { echo "FAIL: approve response missing APPROVED status"; cat /tmp/jc005_approve.out; exit 1; }
echo "OK: suggestion approved"

echo "4) Default list should hide approved suggestions..."
LIST_AFTER_CODE="$(curl -sS -o /tmp/jc005_list_after.out -w "%{http_code}" "$BASE_URL/filing/suggestions/list" || true)"
[ "$LIST_AFTER_CODE" = "200" ] || { echo "FAIL: list after approve returned $LIST_AFTER_CODE"; cat /tmp/jc005_list_after.out; exit 1; }
if grep -q "\"suggestion_id\":\"$SUGGESTION_ID\"" /tmp/jc005_list_after.out; then
  echo "FAIL: approved suggestion should not be in default list"
  cat /tmp/jc005_list_after.out
  exit 1
fi
echo "OK: default list excludes approved suggestion"

echo "5) include_approved=true should show APPROVED suggestion..."
LIST_ALL_CODE="$(curl -sS -o /tmp/jc005_list_all.out -w "%{http_code}" "$BASE_URL/filing/suggestions/list?include_approved=true" || true)"
[ "$LIST_ALL_CODE" = "200" ] || { echo "FAIL: include_approved list returned $LIST_ALL_CODE"; cat /tmp/jc005_list_all.out; exit 1; }
grep -q "\"suggestion_id\":\"$SUGGESTION_ID\"" /tmp/jc005_list_all.out || { echo "FAIL: approved suggestion missing from include_approved list"; cat /tmp/jc005_list_all.out; exit 1; }
grep -q "\"status\":\"APPROVED\"" /tmp/jc005_list_all.out || { echo "FAIL: include_approved list missing APPROVED status"; cat /tmp/jc005_list_all.out; exit 1; }
echo "OK: include_approved list shows approved suggestion"

echo "JC-005 proof completed successfully."

echo
echo "=== JC-005 Increment 2: Apply endpoint (dry-run + fail-closed) — proof-first ==="

# We will require an /apply endpoint that:
# - exists
# - refuses to execute when Graph profile is DISCONNECTED
# - supports dry-run mode (returns a plan) once implemented

# Create a unique suggestion
SUGG_RESP="$(curl -sS -X POST "$BASE_URL/filing/suggestions/propose" \
  -H "Content-Type: application/json" \
  -d '{
    "source_type":"email",
    "source_ref":"from:someone@example.com",
    "deal_id":"proof_deal",
    "suggested_path":"/Deals/proof_deal/Emails/",
    "rationale":"proof inc2",
    "profile_id":"olumie"
  }')"

SUGG_ID="$(echo "$SUGG_RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("suggestion_id",""))' 2>/dev/null || true)"
if [ -z "$SUGG_ID" ]; then
  echo "FAIL: propose did not return suggestion_id"
  echo "$SUGG_RESP"
  exit 1
fi

# Approve it
curl -sS -X POST "$BASE_URL/filing/suggestions/$SUGG_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"approved_by":"proof_inc2"}' >/dev/null

# Apply (dry-run). Until implemented, this should 404 and fail the proof-first gate.
APPLY_CODE="$(curl -sS -o /tmp/jc005_apply.out -w "%{http_code}" \
  -X POST "$BASE_URL/filing/suggestions/$SUGG_ID/apply" \
  -H "Content-Type: application/json" \
  -d '{"mode":"dry_run"}' || true)"

if [ "$APPLY_CODE" = "404" ]; then
  echo "EXPECTED_FAIL_UNTIL_JC005_INC2_IMPLEMENTED: missing /filing/suggestions/:id/apply"
  cat /tmp/jc005_apply.out || true
  exit 1
fi

# After implementation, if Graph is DISCONNECTED, we expect fail-closed 409 NOT_AUTHENTICATED
if [ "$APPLY_CODE" = "409" ]; then
  grep -q "NOT_AUTHENTICATED" /tmp/jc005_apply.out && echo "OK: apply fail-closed when not authenticated" || {
    echo "FAIL: expected NOT_AUTHENTICATED body"; cat /tmp/jc005_apply.out; exit 1;
  }
else
  echo "FAIL: expected 404 (pre-impl) or 409 (fail-closed), got $APPLY_CODE"
  cat /tmp/jc005_apply.out || true
  exit 1
fi
