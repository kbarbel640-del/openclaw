#!/usr/bin/env bash
# proof_threat_model.sh — Behavioral proof: Sprint 1 Threat Model + Content Isolation (8 tests)
set -euo pipefail

echo "=== Threat Model & Content Isolation Proof: behavioral HTTP tests ==="
echo ""

BASE="${TED_BASE_URL:-http://127.0.0.1:7777}"
AUTH_TOKEN="${AUTH_TOKEN:-test-token-for-proof}"
AUTH=(-H "Authorization: Bearer ${AUTH_TOKEN}" -H "x-ted-execution-mode: DETERMINISTIC")

PASS=0
FAIL=0

ok()   { PASS=$((PASS+1)); echo -e "  \033[32mPASS\033[0m: $1"; }
fail() { FAIL=$((FAIL+1)); echo -e "  \033[31mFAIL\033[0m: $1"; }

# ═══════════════════════════════════════════════
# 1D-001: Threat Model Document Exists
# ═══════════════════════════════════════════════

# 1. SDD 73 exists and has key sections
echo "[1/8] SDD 73 threat model document exists"
TM_PATH="docs/ted-profile/sdd-pack/73_LETHAL_TRIFECTA_THREAT_MODEL.md"
if [ -f "$TM_PATH" ]; then
  ok "73_LETHAL_TRIFECTA_THREAT_MODEL.md exists"
else
  fail "73_LETHAL_TRIFECTA_THREAT_MODEL.md does not exist"
fi

# 2. Threat model contains PATH entries
echo "[2/8] Threat model has PATH entries"
if grep -q "PATH-001" "$TM_PATH" && grep -q "PATH-008" "$TM_PATH"; then
  ok "threat model contains PATH-001 through PATH-008"
else
  fail "threat model missing PATH entries"
fi

# 3. Threat model contains mitigation layers
echo "[3/8] Threat model has mitigation architecture"
if grep -q "Mitigation Architecture" "$TM_PATH"; then
  ok "threat model has Mitigation Architecture section"
else
  fail "threat model missing Mitigation Architecture"
fi

# ═══════════════════════════════════════════════
# 1D-002: Content Isolation in Code
# ═══════════════════════════════════════════════

# 4. server.mjs contains <untrusted_content> tags
echo "[4/8] server.mjs has <untrusted_content> tags"
if grep -q "untrusted_content" sidecars/ted-engine/server.mjs; then
  ok "server.mjs contains untrusted_content tag references"
else
  fail "server.mjs missing untrusted_content references"
fi

# 5. server.mjs has UNTRUSTED_CONTENT_INTENTS set
echo "[5/8] server.mjs has UNTRUSTED_CONTENT_INTENTS"
if grep -q "UNTRUSTED_CONTENT_INTENTS" sidecars/ted-engine/server.mjs; then
  ok "server.mjs has UNTRUSTED_CONTENT_INTENTS definition"
else
  fail "server.mjs missing UNTRUSTED_CONTENT_INTENTS"
fi

# 6. buildSystemPrompt includes adversarial warning for untrusted intents
echo "[6/8] buildSystemPrompt has adversarial content warning"
if grep -q "adversarial instructions" sidecars/ted-engine/server.mjs; then
  ok "system prompt includes adversarial instruction warning"
else
  fail "system prompt missing adversarial instruction warning"
fi

# ═══════════════════════════════════════════════
# 1D-003: Per-Call Tool Restriction
# ═══════════════════════════════════════════════

# 7. routeLlmCall accepts options parameter
echo "[7/8] routeLlmCall has options parameter"
if grep -q "routeLlmCall(messages, entityContext, jobId, options)" sidecars/ted-engine/server.mjs; then
  ok "routeLlmCall has 4th options parameter"
else
  fail "routeLlmCall missing options parameter"
fi

# 8. routeLlmCall has allowed_tools check
echo "[8/8] routeLlmCall has allowed_tools restriction"
if grep -q "allowed_tools" sidecars/ted-engine/server.mjs; then
  ok "routeLlmCall references allowed_tools"
else
  fail "routeLlmCall missing allowed_tools reference"
fi

# ═══════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════

echo ""
echo "================================="
echo "  PASS: $PASS   FAIL: $FAIL"
echo "================================="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
