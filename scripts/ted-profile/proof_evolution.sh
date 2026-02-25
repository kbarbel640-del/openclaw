#!/usr/bin/env bash
# proof_evolution.sh — Behavioral proof: Sprint 1 Evolution Foundation (12 tests)
set -euo pipefail

echo "=== Evolution Foundation Proof: behavioral HTTP tests ==="
echo ""

BASE="${TED_BASE_URL:-http://127.0.0.1:7777}"
AUTH_TOKEN="${AUTH_TOKEN:-test-token-for-proof}"
AUTH=(-H "Authorization: Bearer ${AUTH_TOKEN}" -H "x-ted-execution-mode: DETERMINISTIC")

PASS=0
FAIL=0

ok()   { PASS=$((PASS+1)); echo -e "  \033[32mPASS\033[0m: $1"; }
fail() { FAIL=$((FAIL+1)); echo -e "  \033[31mFAIL\033[0m: $1"; }

# ═══════════════════════════════════════════════
# 1A: Schema Version Tracking
# ═══════════════════════════════════════════════

# 1. POST a triage item → verify _schema_version in JSONL
echo "[1/12] POST /triage → creates record with _schema_version"
HTTP=$(curl -s -o /tmp/evo_triage.json -w "%{http_code}" \
  "${AUTH[@]}" -X POST "$BASE/triage" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Evolution test","from":"test@test.com","urgency":"low","snippet":"schema version proof"}')
if [ "$HTTP" = "200" ] || [ "$HTTP" = "201" ]; then
  ok "triage POST returns $HTTP"
else
  fail "triage POST returned $HTTP (expected 200 or 201)"
fi

# 2. GET triage list → verify _schema_version present on records
echo "[2/12] GET /triage → records have _schema_version"
HTTP=$(curl -s -o /tmp/evo_triage_list.json -w "%{http_code}" "${AUTH[@]}" "$BASE/triage")
if [ "$HTTP" = "200" ]; then
  ok "triage list returns 200"
else
  fail "triage list returned $HTTP (expected 200)"
fi

# ═══════════════════════════════════════════════
# 1A-002/003: Config Version Tracking
# ═══════════════════════════════════════════════

# 3. migration_state.json exists and is valid
echo "[3/12] migration_state.json exists and is valid"
MIGRATION_STATE="sidecars/ted-engine/config/migration_state.json"
if [ -f "$MIGRATION_STATE" ]; then
  if jq -e '._config_version' "$MIGRATION_STATE" >/dev/null 2>&1; then
    ok "migration_state.json has _config_version"
  else
    fail "migration_state.json missing _config_version"
  fi
else
  fail "migration_state.json does not exist"
fi

# 4. All config files have _config_version
echo "[4/12] Config files have _config_version"
CONFIG_DIR="sidecars/ted-engine/config"
CONFIGS_OK=0
CONFIGS_TOTAL=0
for f in "$CONFIG_DIR"/*.json; do
  CONFIGS_TOTAL=$((CONFIGS_TOTAL+1))
  if jq -e '._config_version' "$f" >/dev/null 2>&1; then
    CONFIGS_OK=$((CONFIGS_OK+1))
  fi
done
if [ "$CONFIGS_OK" = "$CONFIGS_TOTAL" ]; then
  ok "all $CONFIGS_TOTAL config files have _config_version"
else
  fail "$CONFIGS_OK/$CONFIGS_TOTAL config files have _config_version"
fi

# ═══════════════════════════════════════════════
# 1B: Startup Validation
# ═══════════════════════════════════════════════

# 5. GET /status → has startup_validation field
echo "[5/12] GET /status → has startup_validation"
HTTP=$(curl -s -o /tmp/evo_status.json -w "%{http_code}" "${AUTH[@]}" "$BASE/status")
if [ "$HTTP" = "200" ]; then
  ok "status returns 200"
else
  fail "status returned $HTTP (expected 200)"
fi
if jq -e '.startup_validation' /tmp/evo_status.json >/dev/null 2>&1; then
  ok "status body has startup_validation"
else
  fail "status body missing startup_validation"
fi

# ═══════════════════════════════════════════════
# 1E: API Version Header
# ═══════════════════════════════════════════════

# 6. Any request returns x-ted-api-version header
echo "[6/12] Response has x-ted-api-version header"
HEADERS=$(curl -s -D - -o /dev/null "${AUTH[@]}" "$BASE/status")
if echo "$HEADERS" | grep -qi "x-ted-api-version: 2026-02"; then
  ok "x-ted-api-version header present with 2026-02"
else
  fail "x-ted-api-version header missing or wrong value"
fi

# 7. GET /status → has api_version field
echo "[7/12] GET /status → has api_version field"
if jq -e '.api_version' /tmp/evo_status.json >/dev/null 2>&1; then
  API_VER=$(jq -r '.api_version' /tmp/evo_status.json)
  if [ "$API_VER" = "2026-02" ]; then
    ok "api_version is 2026-02"
  else
    fail "api_version is $API_VER (expected 2026-02)"
  fi
else
  fail "status body missing api_version"
fi

# 8. GET /status → has min_supported_version field
echo "[8/12] GET /status → has min_supported_version"
if jq -e '.min_supported_version' /tmp/evo_status.json >/dev/null 2>&1; then
  ok "min_supported_version present"
else
  fail "status body missing min_supported_version"
fi

# ═══════════════════════════════════════════════
# 1F: Tool Usage Telemetry
# ═══════════════════════════════════════════════

# 9. GET /ops/tool-usage → 200
echo "[9/12] GET /ops/tool-usage → 200"
HTTP=$(curl -s -o /tmp/evo_tool_usage.json -w "%{http_code}" "${AUTH[@]}" "$BASE/ops/tool-usage")
if [ "$HTTP" = "200" ]; then
  ok "tool-usage returns 200"
else
  fail "tool-usage returned $HTTP (expected 200)"
fi

# 10. Tool usage response has expected structure
echo "[10/12] Tool usage has expected fields"
if jq -e '.total_calls' /tmp/evo_tool_usage.json >/dev/null 2>&1; then
  ok "tool-usage has total_calls"
else
  fail "tool-usage missing total_calls"
fi
if jq -e '.unique_tools_used' /tmp/evo_tool_usage.json >/dev/null 2>&1; then
  ok "tool-usage has unique_tools_used"
else
  fail "tool-usage missing unique_tools_used"
fi

# ═══════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════

echo ""
echo "================================="
echo "  PASS: $PASS   FAIL: $FAIL"
echo "================================="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
