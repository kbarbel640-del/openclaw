#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TED_SIDECAR_URL:-http://127.0.0.1:48080}"
JC004_ITEM_ID="proof_item_$(date +%s)"
echo "JC-004 proof: Deal ledger + triage queue"

DEAL_ID="jc004-deal-$(date +%s)-$RANDOM"
ITEM_ID="jc004-item-$(date +%s)-$RANDOM"
TRIAGE_LEDGER="sidecars/ted-engine/artifacts/triage/triage.jsonl"

echo "1) Sidecar health..."
curl -fsS "$BASE_URL/status" >/dev/null
echo "OK: sidecar healthy"

echo "2) Create deal..."
create_code="$(curl -sS -o /tmp/jc004-create.out -w "%{http_code}" \
  -X POST "$BASE_URL/deals/create" \
  -H "Content-Type: application/json" \
  -d "{\"deal_id\":\"$DEAL_ID\",\"deal_name\":\"JC004 Test Deal\",\"status\":\"open\"}")"
[ "$create_code" = "200" ] || { echo "FAIL: /deals/create returned $create_code"; cat /tmp/jc004-create.out; exit 1; }
grep -q "\"created\":true" /tmp/jc004-create.out || { echo "FAIL: create response missing created=true"; cat /tmp/jc004-create.out; exit 1; }
echo "OK: deal created ($DEAL_ID)"

echo "3) Verify get deal..."
get_code="$(curl -sS -o /tmp/jc004-get.out -w "%{http_code}" "$BASE_URL/deals/$DEAL_ID")"
[ "$get_code" = "200" ] || { echo "FAIL: /deals/$DEAL_ID returned $get_code"; cat /tmp/jc004-get.out; exit 1; }
grep -q "\"deal_id\":\"$DEAL_ID\"" /tmp/jc004-get.out || { echo "FAIL: get response missing deal_id"; cat /tmp/jc004-get.out; exit 1; }
echo "OK: get deal returned expected record"

echo "4) Verify list contains deal..."
list_code="$(curl -sS -o /tmp/jc004-list.out -w "%{http_code}" "$BASE_URL/deals/list")"
[ "$list_code" = "200" ] || { echo "FAIL: /deals/list returned $list_code"; cat /tmp/jc004-list.out; exit 1; }
grep -q "\"deal_id\":\"$DEAL_ID\"" /tmp/jc004-list.out || { echo "FAIL: deals list missing new deal"; cat /tmp/jc004-list.out; exit 1; }
echo "OK: deals list contains created deal"

echo "5) Seed one unlinked triage item..."
mkdir -p "$(dirname "$TRIAGE_LEDGER")"
printf '%s\n' "{\"kind\":\"TRIAGE_ITEM\",\"item_id\":\"$ITEM_ID\",\"created_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"summary\":\"jc004 seeded item\",\"source\":\"proof_jc004\"}" >> "$TRIAGE_LEDGER"

triage_code="$(curl -sS -o /tmp/jc004-triage.out -w "%{http_code}" "$BASE_URL/triage/list")"
[ "$triage_code" = "200" ] || { echo "FAIL: /triage/list returned $triage_code"; cat /tmp/jc004-triage.out; exit 1; }
grep -q "\"item_id\":\"$ITEM_ID\"" /tmp/jc004-triage.out || { echo "FAIL: triage list missing seeded item"; cat /tmp/jc004-triage.out; exit 1; }
echo "OK: triage list shows unlinked item"

echo "6) Link triage item to deal..."
link_code="$(curl -sS -o /tmp/jc004-link.out -w "%{http_code}" \
  -X POST "$BASE_URL/triage/$ITEM_ID/link" \
  -H "Content-Type: application/json" \
  -d "{\"deal_id\":\"$DEAL_ID\"}")"
[ "$link_code" = "200" ] || { echo "FAIL: triage link returned $link_code"; cat /tmp/jc004-link.out; exit 1; }
grep -q "\"linked\":true" /tmp/jc004-link.out || { echo "FAIL: triage link response missing linked=true"; cat /tmp/jc004-link.out; exit 1; }
echo "OK: triage item linked"

echo "7) Verify triage item no longer open..."
triage_after_code="$(curl -sS -o /tmp/jc004-triage-after.out -w "%{http_code}" "$BASE_URL/triage/list")"
[ "$triage_after_code" = "200" ] || { echo "FAIL: /triage/list (after link) returned $triage_after_code"; cat /tmp/jc004-triage-after.out; exit 1; }
if grep -q "\"item_id\":\"$ITEM_ID\"" /tmp/jc004-triage-after.out; then
  echo "FAIL: linked item still appears open in triage list"
  cat /tmp/jc004-triage-after.out
  exit 1
fi
echo "OK: triage item resolved and no longer listed"

echo "JC-004 proof completed successfully."

echo
echo "=== JC-004 Increment 2: triage ingest endpoint (proof-first) ==="
INGEST_CODE="$(curl -sS -o /tmp/jc004_ingest.out -w "%{http_code}" \
  -X POST "$BASE_URL/triage/ingest" \
  -H "Content-Type: application/json" \
  -d '{"item_id":"'$JC004_ITEM_ID'","source_type":"manual","source_ref":"proof","summary":"proof ingest"}' || true)"

if [ "$INGEST_CODE" = "404" ]; then
  echo "EXPECTED_FAIL_UNTIL_JC004_INC2_IMPLEMENTED: missing /triage/ingest"
  cat /tmp/jc004_ingest.out || true
  exit 1
fi

# After implementation we expect 200/201 with JSON response
if [ "$INGEST_CODE" != "200" ] && [ "$INGEST_CODE" != "201" ]; then
  echo "FAIL: expected 200/201 from /triage/ingest, got $INGEST_CODE"
  cat /tmp/jc004_ingest.out || true
  exit 1
fi

echo "OK: triage ingest endpoint responded ($INGEST_CODE)"

echo
echo "=== JC-004 Increment 3: Pattern learning scaffold (proof-first) ==="

# Expect these endpoints to exist after implementation:
# - GET  /triage/patterns
# - POST /triage/patterns/propose
# - POST /triage/patterns/:pattern_id/approve
PATTERN_LIST_CODE="$(curl -sS -o /tmp/jc004_patterns.out -w "%{http_code}" \
  "$BASE_URL/triage/patterns" || true)"

if [ "$PATTERN_LIST_CODE" = "404" ]; then
  echo "EXPECTED_FAIL_UNTIL_JC004_INC3_IMPLEMENTED: missing /triage/patterns"
  cat /tmp/jc004_patterns.out || true
  exit 1
fi

if [ "$PATTERN_LIST_CODE" != "200" ]; then
  echo "FAIL: expected 200 from /triage/patterns, got $PATTERN_LIST_CODE"
  cat /tmp/jc004_patterns.out || true
  exit 1
fi

# Propose a pattern
PROPOSE_PAYLOAD='{
  "pattern_type":"SENDER_DOMAIN_TO_DEAL",
  "match":{"domain":"example.com"},
  "suggest":{"deal_id":"proof_deal"},
  "notes":"proof propose"
}'
PROPOSE_CODE="$(curl -sS -o /tmp/jc004_propose.out -w "%{http_code}" \
  -X POST "$BASE_URL/triage/patterns/propose" \
  -H "Content-Type: application/json" \
  -d "$PROPOSE_PAYLOAD" || true)"

if [ "$PROPOSE_CODE" = "404" ]; then
  echo "EXPECTED_FAIL_UNTIL_JC004_INC3_IMPLEMENTED: missing /triage/patterns/propose"
  cat /tmp/jc004_propose.out || true
  exit 1
fi

if [ "$PROPOSE_CODE" != "200" ] && [ "$PROPOSE_CODE" != "201" ]; then
  echo "FAIL: expected 200/201 from propose, got $PROPOSE_CODE"
  cat /tmp/jc004_propose.out || true
  exit 1
fi

# Extract pattern_id (very lightweight parse)
PATTERN_ID="$(cat /tmp/jc004_propose.out | python3 -c 'import sys,json; print(json.load(sys.stdin).get("pattern_id",""))' 2>/dev/null || true)"
if [ -z "$PATTERN_ID" ]; then
  echo "FAIL: propose did not return pattern_id"
  cat /tmp/jc004_propose.out || true
  exit 1
fi

# Approve pattern
APPROVE_CODE="$(curl -sS -o /tmp/jc004_approve.out -w "%{http_code}" \
  -X POST "$BASE_URL/triage/patterns/$PATTERN_ID/approve" \
  -H "Content-Type: application/json" \
  -d '{"approved_by":"proof"}' || true)"

if [ "$APPROVE_CODE" = "404" ]; then
  echo "EXPECTED_FAIL_UNTIL_JC004_INC3_IMPLEMENTED: missing /triage/patterns/:id/approve"
  cat /tmp/jc004_approve.out || true
  exit 1
fi

if [ "$APPROVE_CODE" != "200" ]; then
  echo "FAIL: expected 200 from approve, got $APPROVE_CODE"
  cat /tmp/jc004_approve.out || true
  exit 1
fi

echo "OK: pattern propose/approve endpoints responded"

echo
echo "=== JC-004 Increment 4: Apply active patterns as suggestions on ingest (proof-first) ==="

# Step A: Propose + approve a domain->deal pattern
PAT_PAYLOAD='{
  "pattern_type":"SENDER_DOMAIN_TO_DEAL",
  "match":{"domain":"example.com"},
  "suggest":{"deal_id":"proof_deal"},
  "notes":"proof inc4"
}'
PAT_RESP="$(curl -sS -X POST "$BASE_URL/triage/patterns/propose" -H "Content-Type: application/json" -d "$PAT_PAYLOAD")"
PATTERN_ID="$(echo "$PAT_RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("pattern_id",""))' 2>/dev/null || true)"
if [ -z "$PATTERN_ID" ]; then
  echo "FAIL: propose did not return pattern_id"
  echo "$PAT_RESP"
  exit 1
fi

curl -sS -X POST "$BASE_URL/triage/patterns/$PATTERN_ID/approve" -H "Content-Type: application/json" -d '{"approved_by":"proof_inc4"}' >/dev/null

# Step B: Ingest an item that should match the domain pattern
# We simulate a source_ref containing an email domain; implementation will parse it.
JC004_ITEM_ID_INC4="proof_item_inc4_$(date +%s)"
INGEST_PAYLOAD='{
  "item_id":"'"$JC004_ITEM_ID_INC4"'",
  "source_type":"email",
  "source_ref":"from:someone@example.com",
  "summary":"proof inc4 ingest should get suggestion"
}'
INGEST_RESP="$(curl -sS -X POST "$BASE_URL/triage/ingest" -H "Content-Type: application/json" -d "$INGEST_PAYLOAD")"

# Step C: Validate ingest response (or subsequent triage list) includes suggested_deal_id = proof_deal
# Accept either:
# - direct field in ingest response, OR
# - triage/list contains the item with suggested_deal_id
if echo "$INGEST_RESP" | grep -q '"suggested_deal_id"[[:space:]]*:[[:space:]]*"proof_deal"'; then
  echo "OK: ingest response includes suggested_deal_id=proof_deal"
else
  # fall back to triage list check
  TRIAGE="$(curl -sS "$BASE_URL/triage/list")"
  echo "$TRIAGE" | grep -q "$JC004_ITEM_ID_INC4" || { echo "FAIL: ingested item not found in triage list"; echo "$TRIAGE"; exit 1; }
  echo "$TRIAGE" | grep -q '"suggested_deal_id"[[:space:]]*:[[:space:]]*"proof_deal"' || {
    echo "EXPECTED_FAIL_UNTIL_JC004_INC4_IMPLEMENTED: no suggested_deal_id applied by pattern"
    exit 1
  }
  echo "OK: triage item shows suggested_deal_id=proof_deal"
fi
