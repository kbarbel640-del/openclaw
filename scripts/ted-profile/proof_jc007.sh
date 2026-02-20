#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${TED_SIDECAR_URL:-http://127.0.0.1:48080}"
echo "JC-007 proof: entity/provenance + cross-entity guards"

curl -fsS "$BASE_URL/status" >/dev/null

echo "1) Missing metadata should fail closed..."
MISSING_CODE="$(curl -sS -o /tmp/jc007_missing.out -w "%{http_code}" \
  -X POST "$BASE_URL/governance/entity/check" \
  -H "Content-Type: application/json" \
  -d '{
    "target_entity":"Everest",
    "objects":[{"id":"obj-1","entity_tag":{"primary_entity":"Everest"}}]
  }' || true)"
[ "$MISSING_CODE" = "409" ] || {
  echo "FAIL: expected 409 for missing metadata, got $MISSING_CODE"
  cat /tmp/jc007_missing.out
  exit 1
}
grep -q '"reason_code":"MISSING_ENTITY_OR_PROVENANCE"' /tmp/jc007_missing.out || {
  echo "FAIL: missing MISSING_ENTITY_OR_PROVENANCE reason code"
  cat /tmp/jc007_missing.out
  exit 1
}
echo "OK: missing metadata blocked"

echo "2) Cross-entity render should fail closed..."
CROSS_CODE="$(curl -sS -o /tmp/jc007_cross.out -w "%{http_code}" \
  -X POST "$BASE_URL/governance/entity/check" \
  -H "Content-Type: application/json" \
  -d '{
    "target_entity":"Everest",
    "objects":[
      {
        "id":"obj-everest",
        "entity_tag":{"primary_entity":"Everest"},
        "provenance":{"source_type":"email","source_id":"m1","retrieved_at":"2026-02-20T00:00:00Z"}
      },
      {
        "id":"obj-olumie",
        "entity_tag":{"primary_entity":"Olumie"},
        "provenance":{"source_type":"email","source_id":"m2","retrieved_at":"2026-02-20T00:00:00Z"}
      }
    ]
  }' || true)"
[ "$CROSS_CODE" = "409" ] || {
  echo "FAIL: expected 409 for cross-entity block, got $CROSS_CODE"
  cat /tmp/jc007_cross.out
  exit 1
}
grep -q '"reason_code":"CROSS_ENTITY_BLOCK"' /tmp/jc007_cross.out || {
  echo "FAIL: missing CROSS_ENTITY_BLOCK reason code"
  cat /tmp/jc007_cross.out
  exit 1
}
echo "OK: cross-entity block enforced"

echo "3) Same-entity governed set should pass..."
PASS_CODE="$(curl -sS -o /tmp/jc007_pass.out -w "%{http_code}" \
  -X POST "$BASE_URL/governance/entity/check" \
  -H "Content-Type: application/json" \
  -d '{
    "target_entity":"Everest",
    "objects":[
      {
        "id":"obj-1",
        "entity_tag":{"primary_entity":"Everest"},
        "provenance":{"source_type":"email","source_id":"m3","retrieved_at":"2026-02-20T00:00:00Z"}
      },
      {
        "id":"obj-2",
        "entity_tag":{"primary_entity":"Everest"},
        "provenance":{"source_type":"file","source_id":"f1","retrieved_at":"2026-02-20T00:00:00Z"}
      }
    ]
  }' || true)"
[ "$PASS_CODE" = "200" ] || {
  echo "FAIL: expected 200 for same-entity pass, got $PASS_CODE"
  cat /tmp/jc007_pass.out
  exit 1
}
grep -q '"allowed":true' /tmp/jc007_pass.out || {
  echo "FAIL: same-entity pass missing allowed=true"
  cat /tmp/jc007_pass.out
  exit 1
}
echo "OK: same-entity set passed"

echo "JC-007 proof completed successfully."
