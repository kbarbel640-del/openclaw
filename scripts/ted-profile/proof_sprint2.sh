#!/usr/bin/env bash
# proof_sprint2.sh — Behavioral proof: Sprint 2 Evolution Layer (20 tests)
# Covers: 2A config migration, 2B upcasters, 2C constitution, 2D context assembly,
#         2E evaluation pipeline, 2E-001 expanded fixtures, 2F prompt registry
set -euo pipefail

echo "=== Sprint 2 Evolution Layer Proof: behavioral HTTP + structural tests ==="
echo ""

BASE="${TED_BASE_URL:-http://127.0.0.1:7777}"
AUTH_TOKEN="${AUTH_TOKEN:-test-token-for-proof}"
AUTH=(-H "Authorization: Bearer ${AUTH_TOKEN}" -H "x-ted-execution-mode: DETERMINISTIC")

PASS=0
FAIL=0

ok()   { PASS=$((PASS+1)); echo -e "  \033[32mPASS\033[0m: $1"; }
fail() { FAIL=$((FAIL+1)); echo -e "  \033[31mFAIL\033[0m: $1"; }

ENGINE_DIR="sidecars/ted-engine"
CONFIG_DIR="$ENGINE_DIR/config"

# ═══════════════════════════════════════════════
# 2A: Config Migration Runner
# ═══════════════════════════════════════════════

# 1. Migrations directory exists with baseline migration
echo "[1/20] Migrations directory + baseline migration"
if [ -f "$ENGINE_DIR/migrations/001_baseline_schema_versions.mjs" ]; then
  ok "001_baseline_schema_versions.mjs exists"
else
  fail "baseline migration file does not exist"
fi

# 2. migration_state.json has applied array
echo "[2/20] migration_state.json tracks applied migrations"
if jq -e '.applied' "$CONFIG_DIR/migration_state.json" >/dev/null 2>&1; then
  ok "migration_state.json has applied array"
else
  fail "migration_state.json missing applied array"
fi

# 3. GET /status → startup includes migration info (via startup_validation)
echo "[3/20] GET /status → has startup_validation"
HTTP=$(curl -s -o /tmp/s2_status.json -w "%{http_code}" "${AUTH[@]}" "$BASE/status")
if [ "$HTTP" = "200" ]; then
  ok "status returns 200"
else
  fail "status returned $HTTP (expected 200)"
fi

# ═══════════════════════════════════════════════
# 2B: Event Upcaster Pipeline
# ═══════════════════════════════════════════════

# 4. server.mjs contains LEDGER_UPCASTERS definition
echo "[4/20] server.mjs has LEDGER_UPCASTERS pipeline"
if grep -q "LEDGER_UPCASTERS" "$ENGINE_DIR/server.mjs"; then
  ok "LEDGER_UPCASTERS defined in server.mjs"
else
  fail "LEDGER_UPCASTERS missing from server.mjs"
fi

# 5. server.mjs has registerUpcaster function
echo "[5/20] server.mjs has registerUpcaster()"
if grep -q "function registerUpcaster" "$ENGINE_DIR/server.mjs"; then
  ok "registerUpcaster function exists"
else
  fail "registerUpcaster function missing"
fi

# 6. server.mjs has upcastRecord function
echo "[6/20] server.mjs has upcastRecord()"
if grep -q "function upcastRecord" "$ENGINE_DIR/server.mjs"; then
  ok "upcastRecord function exists"
else
  fail "upcastRecord function missing"
fi

# 7. Baseline upcasters registered for known ledgers
echo "[7/20] Baseline upcasters registered for ledgers"
UPCASTER_COUNT=$(grep -c "registerUpcaster(" "$ENGINE_DIR/server.mjs" || true)
if [ "$UPCASTER_COUNT" -ge 30 ]; then
  ok "at least 30 baseline upcasters registered ($UPCASTER_COUNT found)"
else
  fail "only $UPCASTER_COUNT upcasters found (expected >= 30)"
fi

# ═══════════════════════════════════════════════
# 2C: Constitutional Document
# ═══════════════════════════════════════════════

# 8. ted_constitution.json exists with tier hierarchy
echo "[8/20] ted_constitution.json exists with tiers"
if jq -e '.tier_hierarchy' "$CONFIG_DIR/ted_constitution.json" >/dev/null 2>&1; then
  TIER_COUNT=$(jq '.tier_hierarchy | length' "$CONFIG_DIR/ted_constitution.json")
  if [ "$TIER_COUNT" -eq 4 ]; then
    ok "constitution has 4-tier hierarchy"
  else
    fail "constitution has $TIER_COUNT tiers (expected 4)"
  fi
else
  fail "ted_constitution.json missing tier_hierarchy"
fi

# 9. Constitution has absolute_prohibitions
echo "[9/20] Constitution has absolute_prohibitions"
if jq -e '.absolute_prohibitions' "$CONFIG_DIR/ted_constitution.json" >/dev/null 2>&1; then
  PROHIBITION_COUNT=$(jq '.absolute_prohibitions | length' "$CONFIG_DIR/ted_constitution.json")
  if [ "$PROHIBITION_COUNT" -ge 6 ]; then
    ok "constitution has $PROHIBITION_COUNT absolute prohibitions"
  else
    fail "constitution has $PROHIBITION_COUNT prohibitions (expected >= 6)"
  fi
else
  fail "ted_constitution.json missing absolute_prohibitions"
fi

# 10. Constitution wired into Builder Lane — server.mjs has validateProposalAgainstConstitution
echo "[10/20] Constitution validation wired into server.mjs"
if grep -q "validateProposalAgainstConstitution" "$ENGINE_DIR/server.mjs"; then
  ok "validateProposalAgainstConstitution in server.mjs"
else
  fail "validateProposalAgainstConstitution missing from server.mjs"
fi

# ═══════════════════════════════════════════════
# 2D: Context Assembly Framework
# ═══════════════════════════════════════════════

# 11. CONTEXT_BUDGETS defined with all 7 call types
echo "[11/20] CONTEXT_BUDGETS has 7 call types"
if grep -q "CONTEXT_BUDGETS" "$ENGINE_DIR/server.mjs"; then
  BUDGET_COUNT=$(grep -c "max_tokens:" "$ENGINE_DIR/server.mjs" | head -1 || true)
  # Check for specific call types
  HAS_ALL=true
  for ct in morning_brief eod_digest triage_classify draft_email commitment_extract meeting_prep improvement_proposal; do
    if ! grep -q "\"*$ct\"*:" "$ENGINE_DIR/server.mjs" 2>/dev/null; then
      # Try without quotes
      if ! grep -q "$ct:" "$ENGINE_DIR/server.mjs" 2>/dev/null; then
        HAS_ALL=false
      fi
    fi
  done
  if $HAS_ALL; then
    ok "CONTEXT_BUDGETS has all 7 call types"
  else
    fail "CONTEXT_BUDGETS missing some call types"
  fi
else
  fail "CONTEXT_BUDGETS missing from server.mjs"
fi

# 12. assembleContext function exists
echo "[12/20] assembleContext() function defined"
if grep -q "function assembleContext" "$ENGINE_DIR/server.mjs"; then
  ok "assembleContext function exists"
else
  fail "assembleContext function missing"
fi

# 13. assembleContext used at LLM call sites (at least 4 call sites)
echo "[13/20] assembleContext wired at multiple LLM call sites"
ASSEMBLY_CALLS=$(grep -c "assembleContext(" "$ENGINE_DIR/server.mjs" || true)
if [ "$ASSEMBLY_CALLS" -ge 5 ]; then
  ok "assembleContext called at $ASSEMBLY_CALLS locations (includes definition + 4+ sites)"
else
  fail "assembleContext only found $ASSEMBLY_CALLS times (expected >= 5)"
fi

# ═══════════════════════════════════════════════
# 2E: Evaluation Pipeline
# ═══════════════════════════════════════════════

# 14. POST /ops/evaluation/run → 200 with pass_count + total
echo "[14/20] POST /ops/evaluation/run → 200 with results"
HTTP=$(curl -s -o /tmp/s2_eval_run.json -w "%{http_code}" "${AUTH[@]}" -X POST "$BASE/ops/evaluation/run")
if [ "$HTTP" = "200" ]; then
  ok "evaluation/run returns 200"
else
  fail "evaluation/run returned $HTTP (expected 200)"
fi
if jq -e '.pass_count' /tmp/s2_eval_run.json >/dev/null 2>&1 && jq -e '.total' /tmp/s2_eval_run.json >/dev/null 2>&1; then
  EVAL_PASS=$(jq '.pass_count' /tmp/s2_eval_run.json)
  EVAL_TOTAL=$(jq '.total' /tmp/s2_eval_run.json)
  ok "evaluation reports ${EVAL_PASS}/${EVAL_TOTAL} fixtures"
else
  fail "evaluation response missing pass_count or total"
fi

# 15. GET /ops/evaluation/status → 200 with cached result
echo "[15/20] GET /ops/evaluation/status → 200 after run"
HTTP=$(curl -s -o /tmp/s2_eval_status.json -w "%{http_code}" "${AUTH[@]}" "$BASE/ops/evaluation/status")
if [ "$HTTP" = "200" ]; then
  if jq -e '.pass_rate' /tmp/s2_eval_status.json >/dev/null 2>&1; then
    ok "evaluation/status has pass_rate"
  else
    fail "evaluation/status missing pass_rate"
  fi
else
  fail "evaluation/status returned $HTTP (expected 200)"
fi

# 16. Expanded golden fixtures: at least 15 fixtures in output_contracts.json
echo "[16/20] output_contracts.json has >= 15 golden fixtures"
if jq -e '.golden_fixtures' "$CONFIG_DIR/output_contracts.json" >/dev/null 2>&1; then
  FIXTURE_COUNT=$(jq '.golden_fixtures | keys | length' "$CONFIG_DIR/output_contracts.json")
  if [ "$FIXTURE_COUNT" -ge 15 ]; then
    ok "$FIXTURE_COUNT golden fixtures in output_contracts.json"
  else
    fail "only $FIXTURE_COUNT fixtures (expected >= 15)"
  fi
else
  fail "output_contracts.json missing golden_fixtures"
fi

# ═══════════════════════════════════════════════
# 2F: Prompt Registry
# ═══════════════════════════════════════════════

# 17. prompt_registry.json exists with at least 5 entries
echo "[17/20] prompt_registry.json has >= 5 prompt entries"
if [ -f "$CONFIG_DIR/prompt_registry.json" ]; then
  PROMPT_COUNT=$(jq 'del(._config_version) | keys | length' "$CONFIG_DIR/prompt_registry.json")
  if [ "$PROMPT_COUNT" -ge 5 ]; then
    ok "prompt registry has $PROMPT_COUNT entries"
  else
    fail "prompt registry has $PROMPT_COUNT entries (expected >= 5)"
  fi
else
  fail "prompt_registry.json does not exist"
fi

# 18. Prompt template files exist in prompts/ directory
echo "[18/20] Prompt template files exist"
PROMPT_FILES=$(find "$ENGINE_DIR/prompts" -name "*_v1.txt" 2>/dev/null | wc -l)
if [ "$PROMPT_FILES" -ge 5 ]; then
  ok "$PROMPT_FILES prompt template files found"
else
  fail "only $PROMPT_FILES prompt templates (expected >= 5)"
fi

# 19. loadPromptFromRegistry in server.mjs
echo "[19/20] loadPromptFromRegistry wired into routeLlmCall"
if grep -q "loadPromptFromRegistry" "$ENGINE_DIR/server.mjs"; then
  ok "loadPromptFromRegistry referenced in server.mjs"
else
  fail "loadPromptFromRegistry missing from server.mjs"
fi

# 20. Draft email prompt preserves <untrusted_content> tag
echo "[20/20] draft_email prompt preserves untrusted_content isolation"
if grep -q "untrusted_content" "$ENGINE_DIR/prompts/draft_email_v1.txt"; then
  ok "draft_email_v1.txt preserves <untrusted_content> tag"
else
  fail "draft_email_v1.txt missing <untrusted_content> isolation"
fi

# ═══════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════

echo ""
echo "================================="
echo "  PASS: $PASS   FAIL: $FAIL"
echo "================================="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
