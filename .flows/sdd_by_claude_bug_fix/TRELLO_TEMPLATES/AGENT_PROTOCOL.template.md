# Agent Protocol - Bug Fix State Management

> Reference from KICKOFF.md when needed
> This document provides state update patterns for bug fixes

## State File: state.json

The `state.json` file tracks fix progress. Update it after EACH card.

### State Structure

```json
{
  "bug_id": "{BUG_ID}",
  "overall_status": "IN_PROGRESS|COMPLETE|FAILED",
  "tdd_phase": "RED|GREEN|VERIFY|DONE",
  "started_at": "2026-01-06T10:00:00Z",
  "completed_at": null,
  "current_card": "01",
  "cards": {
    "01": {
      "status": "pending|in_progress|completed|failed",
      "title": "Regression Test (TDD RED)",
      "tdd_phase": "RED",
      "started_at": null,
      "completed_at": null,
      "test_result": null
    },
    "02": {
      "status": "pending",
      "title": "Implement Fix (TDD GREEN)",
      "tdd_phase": "GREEN",
      "started_at": null,
      "completed_at": null,
      "test_result": null
    },
    "03": {
      "status": "pending",
      "title": "Verify & PR",
      "tdd_phase": "VERIFY",
      "started_at": null,
      "completed_at": null,
      "pr_url": null
    }
  },
  "execution_log": []
}
```

## State Update Patterns

### Pattern 1: Start Card 01 (TDD RED)

```bash
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
  .cards."01".status = "in_progress" |
  .cards."01".started_at = $now |
  .current_card = "01" |
  .tdd_phase = "RED"
' state.json > state.json.tmp && mv state.json.tmp state.json
```

### Pattern 2: Complete Card 01 (Test Written & Failing)

```bash
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
  .cards."01".status = "completed" |
  .cards."01".completed_at = $now |
  .cards."01".test_result = "FAIL (as expected)"
' state.json > state.json.tmp && mv state.json.tmp state.json
```

### Pattern 3: Start Card 02 (TDD GREEN)

```bash
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
  .cards."02".status = "in_progress" |
  .cards."02".started_at = $now |
  .current_card = "02" |
  .tdd_phase = "GREEN"
' state.json > state.json.tmp && mv state.json.tmp state.json
```

### Pattern 4: Complete Card 02 (Fix Applied & Tests Pass)

```bash
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
  .cards."02".status = "completed" |
  .cards."02".completed_at = $now |
  .cards."02".test_result = "PASS"
' state.json > state.json.tmp && mv state.json.tmp state.json
```

### Pattern 5: Start Card 03 (VERIFY)

```bash
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
  .cards."03".status = "in_progress" |
  .cards."03".started_at = $now |
  .current_card = "03" |
  .tdd_phase = "VERIFY"
' state.json > state.json.tmp && mv state.json.tmp state.json
```

### Pattern 6: Complete All (PR Created)

```bash
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg pr "$PR_URL" '
  .cards."03".status = "completed" |
  .cards."03".completed_at = $now |
  .cards."03".pr_url = $pr |
  .overall_status = "COMPLETE" |
  .completed_at = $now |
  .tdd_phase = "DONE"
' state.json > state.json.tmp && mv state.json.tmp state.json
```

### Pattern 7: Fail a Card

```bash
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg err "Error message" '
  .cards.{NN}.status = "failed" |
  .cards.{NN}.error = $err |
  .overall_status = "FAILED"
' state.json > state.json.tmp && mv state.json.tmp state.json
```

## TDD Phase Tracking

The `tdd_phase` field tracks the current TDD phase:

| Phase | Description | Expected Test Result |
|-------|-------------|---------------------|
| RED | Writing failing test | Test should FAIL |
| GREEN | Implementing fix | Test should PASS |
| VERIFY | Final verification | All tests PASS |
| DONE | Complete | PR created |

## Execution Log

Add entries to track progress:

```bash
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
  .execution_log += [{
    timestamp: $now,
    level: "INFO",
    message: "Card 01 completed - test fails as expected",
    card: "01",
    tdd_phase: "RED"
  }]
' state.json > state.json.tmp && mv state.json.tmp state.json
```

## Verification Commands

```bash
# Check overall status
jq -r '.overall_status' state.json

# Check TDD phase
jq -r '.tdd_phase' state.json

# Check current card
jq -r '.current_card' state.json

# Check all card statuses
jq -r '.cards | to_entries[] | "\(.key): \(.value.status)"' state.json

# Check if complete
jq -r 'if .overall_status == "COMPLETE" then "✅ Bug fix complete!" else "⏳ In progress" end' state.json
```

## Helper Script

Create `update-state.sh`:

```bash
#!/bin/bash
# update-state.sh - Helper for bug fix state management

ACTION=$1
CARD=$2

case $ACTION in
  start)
    jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      ".cards.\"$CARD\".status = \"in_progress\" | .cards.\"$CARD\".started_at = \$now | .current_card = \"$CARD\"" \
      state.json > state.json.tmp && mv state.json.tmp state.json
    ;;
  complete)
    jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      ".cards.\"$CARD\".status = \"completed\" | .cards.\"$CARD\".completed_at = \$now" \
      state.json > state.json.tmp && mv state.json.tmp state.json
    ;;
  fail)
    jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg err "$3" \
      ".cards.\"$CARD\".status = \"failed\" | .cards.\"$CARD\".error = \$err | .overall_status = \"FAILED\"" \
      state.json > state.json.tmp && mv state.json.tmp state.json
    ;;
esac

echo "State updated: $ACTION card $CARD"
```

Usage:
```bash
./update-state.sh start 01
./update-state.sh complete 01
./update-state.sh start 02
./update-state.sh complete 02
./update-state.sh start 03
./update-state.sh complete 03
```

---

**Protocol Version:** 1.0 (Bug Fix)
**Required Tool:** jq
