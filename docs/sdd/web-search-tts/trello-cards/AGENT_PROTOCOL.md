# Agent Protocol - State Management & Execution

> Reference from KICKOFF.md when needed
> This document provides detailed state update patterns

## State File: state.json

The `state.json` file tracks execution progress. Update it after EACH card.

### State Structure

```json
{
  "overall_status": "IN_PROGRESS|COMPLETE|FAILED",
  "started_at": "2026-01-05T10:00:00Z",
  "completed_at": null,
  "current_card": "01",
  "agent_session_id": "session_xxxxx",
  "cards": {
    "01": {
      "status": "pending|in_progress|completed|failed",
      "title": "TTS Configuration",
      "sp": 2,
      "started_at": null,
      "completed_at": null,
      "execution_time_seconds": null,
      "error": null
    },
    "02": { ... },
    ...
  },
  "execution_log": [
    {
      "timestamp": "2026-01-05T10:05:00Z",
      "level": "INFO|WARNING|ERROR",
      "message": "Started card 01",
      "card": "01"
    }
  ]
}
```

## State Update Commands

### Start a Card

```bash
# Update card status to "in_progress"
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.cards.'$1'.status = "in_progress" | .cards.'$1'.started_at = $now | .current_card = "'$1'"' \
   state.json > state.json.tmp && mv state.json.tmp state.json

# Add to execution log
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.execution_log += [{timestamp: $now, level: "INFO", message: "Card '$1' started", card: "'$1'"}]' \
   state.json > state.json.tmp && mv state.json.tmp state.json
```

### Complete a Card

```bash
# Update card status to "completed"
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.cards.'$1'.status = "completed" | .cards.'$1'.completed_at = $now' \
   state.json > state.json.tmp && mv state.json.tmp state.json

# Add to execution log
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.execution_log += [{timestamp: $now, level: "INFO", message: "Card '$1' completed", card: "'$1'"}]' \
   state.json > state.json.tmp && mv state.json.tmp state.json
```

### Fail a Card

```bash
# Update card status to "failed"
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg msg "$2" \
   '.cards.'$1'.status = "failed" | .cards.'$1'.error = $msg | .overall_status = "FAILED"' \
   state.json > state.json.tmp && mv state.json.tmp state.json

# Add error to execution log
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg msg "$2" \
   '.execution_log += [{timestamp: $now, level: "ERROR", message: "Card '$1' failed: " + $msg, card: "'$1'"}]' \
   state.json > state.json.tmp && mv state.json.tmp state.json
```

### Complete All Cards

When last card is completed:

```bash
# Update overall status
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.overall_status = "COMPLETE" | .completed_at = $now' \
   state.json > state.json.tmp && mv state.json.tmp state.json

# Add completion to log
jq --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.execution_log += [{timestamp: $now, level: "INFO", message: "All cards completed!", card: null}]' \
   state.json > state.json.tmp && mv state.json.tmp state.json
```

## Verification Commands

### Check Current Status

```bash
# Show overall status
echo "Overall: $(jq -r '.overall_status' state.json)"
echo "Current: $(jq -r '.current_card' state.json)"

# Show all card statuses
jq -r '.cards | to_entries[] | "\(.key): \(.value.status)"' state.json

# Show completed cards count
jq -r '[.cards | to_entries[] | select(.value.status == "completed")] | length' state.json
```

---

**Protocol Version:** 1.0
**Required Tool:** jq (JSON processor)
