# Card 03: {BUG_ID} - Verify & Create PR

| Field | Value |
|-------|-------|
| **ID** | {BUG_ID}-03 |
| **Story Points** | 2 |
| **Type** | ✅ VERIFY |
| **Depends On** | 02 |

## Objective

Complete full verification and create Pull Request. This card:
1. Runs all verification checks
2. Confirms bug is fixed
3. **Creates PR for review (MANDATORY)**

## ⚡ Pre-Card Checklist

```bash
# 1. Verify auto-commit daemon is running
ps aux | grep auto-commit-daemon

# 2. Verify state.json shows current card is 03
cat state.json | jq '.current_card'
# Expected: "03"

# 3. Verify Card 02 is completed
cat state.json | jq '.cards."02".status'
# Expected: "completed"
```

## Instructions

### Step 1: Run Reproduction Script

```bash
# Run the original reproduction script
./reproduce-{BUG_ID}.sh

# Expected: Exit 0 (bug NOT reproduced)
```

**Success criteria:**
```
=== Reproducing {BUG_ID} ===
Bug pattern NOT found
BUG NOT REPRODUCED
Exit code: 0
```

### Step 2: Run Full Test Suite

```bash
pnpm test

# Expected: All tests pass
```

Record results:
- Total tests: ___
- Passed: ___
- Failed: 0
- Skipped: ___

### Step 3: Run Type Check

```bash
pnpm type-check

# Expected: No errors
```

### Step 4: Run Lint

```bash
pnpm lint

# Expected: No errors or warnings
```

### Step 5: Run Build

```bash
pnpm build

# Expected: Build succeeds
```

### Step 6: Manual Verification (Optional)

If manual testing is required:

1. [ ] {Manual step 1}
2. [ ] {Manual step 2}
3. [ ] {Manual step 3}

### Step 7: Final Commit

**Use smart_commit.sh to capture all remaining changes:**

```bash
# Option A: Use smart_commit.sh (RECOMMENDED)
./smart_commit.sh --feature "{BUG_ID}"

# Option B: Manual commit
git add .
git commit -m "chore: complete verification for {BUG_ID}

All checks passed:
- [x] Regression test passes
- [x] All tests pass
- [x] Reproduction script confirms fix
- [x] Type check passes
- [x] Lint passes
- [x] Build succeeds

🐛 Ready for PR"
```

### Step 8: Stop Auto-Commit Daemon

```bash
# Stop the daemon (no longer needed)
./auto-commit-daemon.sh --stop
```

### Step 9: Push Branch

```bash
# Get current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Pushing branch: $BRANCH"

# Push to remote
git push -u origin "$BRANCH"
```

### Step 10: Create Pull Request (MANDATORY - THIS IS NOT OPTIONAL)

```bash
# Create PR with proper title and description
gh pr create \
  --title "fix: {BUG_ID} - {SUMMARY}" \
  --body "$(cat <<'EOF'
## Bug Fix: {BUG_ID}

**Severity:** {SEVERITY}
**Summary:** {SUMMARY}

### Root Cause
{ROOT_CAUSE_SUMMARY}

**Location:** `{FILE_PATH}:{LINE_NUMBER}`

### Fix Description
{FIX_DESCRIPTION}

### Changes
- `{FILE_PATH}` - {change_description}
- `{TEST_FILE_PATH}` - Added regression test

### Testing
- [x] Regression test added and passes
- [x] All existing tests pass
- [x] Reproduction script confirms fix
- [x] Type check passes
- [x] Lint passes
- [x] Build succeeds

### Verification Commands
```bash
pnpm test {TEST_FILE_PATH}  # Regression test
./reproduce-{BUG_ID}.sh      # Should exit 0
```

---

🐛 Generated with SDD Bug Fix Flow
EOF
)"

# Get PR URL
PR_URL=$(gh pr view --json url -q .url)
echo ""
echo "============================================"
echo "🎉 PR CREATED: $PR_URL"
echo "============================================"
```

### Step 11: Update state.json

```bash
# Mark all cards complete
jq '.overall_status = "COMPLETE" | .cards."03".status = "completed" | .cards."03".completed_at = "'$(date -Iseconds)'" | .tdd_phase = "COMPLETE" | .completed_at = "'$(date -Iseconds)'" | .pr_url = "'$PR_URL'"' state.json > state.json.tmp && mv state.json.tmp state.json

cat state.json | jq '.overall_status, .pr_url'
```

## Acceptance Criteria

- [ ] Auto-commit daemon stopped
- [ ] Reproduction script exits 0 (bug fixed)
- [ ] All tests pass
- [ ] Type check passes
- [ ] Lint passes
- [ ] Build succeeds
- [ ] Manual verification passed (if applicable)
- [ ] All changes committed
- [ ] Branch pushed to remote
- [ ] **PR created with proper description (MANDATORY)**
- [ ] state.json shows all cards "completed" and PR URL

## Verification Summary

| Check | Status |
|-------|--------|
| Auto-Commit Daemon | Stopped |
| Regression Test | {PASS/FAIL} |
| All Tests | {PASS/FAIL} |
| Reproduction Script | {PASS/FAIL} |
| Type Check | {PASS/FAIL} |
| Lint | {PASS/FAIL} |
| Build | {PASS/FAIL} |
| Manual (if needed) | {PASS/FAIL/N/A} |
| **PR Created** | **YES (MANDATORY)** |

## Completion

After this card:
1. ✅ All cards completed
2. ✅ Bug is verified fixed
3. ✅ PR is ready for review
4. ✅ **Implementation complete!**

---

**TDD Phase:** ✅ VERIFY (Complete)

**🎉 Congratulations!** Bug fix implementation is complete.

**Remember:**
- PR created: YES
- All checks passed: YES
- Auto-commit daemon: Stopped

**NEXT:** Await PR review on GitHub.
