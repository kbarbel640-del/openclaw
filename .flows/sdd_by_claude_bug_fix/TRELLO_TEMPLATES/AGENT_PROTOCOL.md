# Agent Protocol - State Management & Git Flow

> Reference from KICKOFF.md when needed
> This document provides state update patterns and git flow management

## Git Flow Tools

### smart_commit.sh - Smart Commit Tool

**Purpose:** Intelligent git commit with proper message generation

```bash
# Use for all commits (auto mode)
./smart_commit.sh --feature "{BUG_ID}"

# With custom message prefix
./smart_commit.sh --feature "{BUG_ID}" "test"
```

**Features:**
- Auto-generates commit messages
- Stages all changes
- Shows commit hash after success
- Copies hash to clipboard if possible

### auto-commit-daemon.sh - Auto-Commit Daemon

**Purpose:** Periodically auto-commits changes (background subagent)

```bash
# Start daemon (5-minute intervals)
nohup ./auto-commit-daemon.sh --feature "{BUG_ID}" &

# Start with custom interval
nohup ./auto-commit-daemon.sh --feature "{BUG_ID}" --interval 600 &

# Check status
ps aux | grep auto-commit-daemon

# Stop daemon
./auto-commit-daemon.sh --stop
```

**Why use:**
- Never lose work
- Incremental commit history
- Zero cognitive overhead
- Forceful git compliance

## State File: state.json

The `state.json` file tracks execution progress. Update it after EACH card.

### State Structure

```json
{
  "bug_id": "WEB-SEARCH-INTERMITTENT",
  "overall_status": "IN_PROGRESS",
  "tdd_phase": "RED|GREEN|VERIFY|COMPLETE",
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
      "test_result": null,
      "error": null
    },
    "02": { ... },
    "03": { ... }
  },
  "execution_log": [
    {
      "timestamp": "2026-01-06T10:05:00Z",
      "level": "INFO|WARNING|ERROR",
      "message": "Card 01 started",
      "card": "01",
      "tdd_phase": "RED"
    }
  ]
}
```

## State Update Patterns

### Pattern 1: Initialize State

```bash
# Create initial state
cat > state.json << 'EOF'
{
  "bug_id": "{BUG_ID}",
  "overall_status": "IN_PROGRESS",
  "tdd_phase": "RED",
  "started_at": "$(date -Iseconds)",
  "completed_at": null,
  "current_card": "01",
  "cards": {
    "01": { "status": "pending", "title": "Regression Test (TDD RED)", "tdd_phase": "RED" },
    "02": { "status": "pending", "title": "Implement Fix (TDD GREEN)", "tdd_phase": "GREEN" },
    "03": { "status": "pending", "title": "Verify & PR", "tdd_phase": "VERIFY" }
  },
  "execution_log": [
    {
      "timestamp": "$(date -Iseconds)",
      "level": "INFO",
      "message": "Bug fix initialized",
      "card": null,
      "tdd_phase": null
    }
  ]
}
EOF
```

### Pattern 2: Start a Card

```bash
# Update card status to "in_progress"
jq '.cards."01".status = "in_progress" | .cards."01".started_at = "'$(date -Iseconds)'" | .tdd_phase = "RED" | .current_card = "01"' state.json > state.json.tmp && mv state.json.tmp state.json

# Add to execution log
jq --arg now "$(date -Iseconds)" \
   '.execution_log += [{timestamp: $now, level: "INFO", message: "Card 01 started", card: "01", tdd_phase: "RED"}]' \
   state.json > state.json.tmp && mv state.json.tmp state.json
```

### Pattern 3: Complete a Card

```bash
# Mark card 01 as completed
jq '.cards."01".status = "completed" | .cards."01".completed_at = "'$(date -Iseconds)'" | .tdd_phase = "GREEN" | .current_card = "02"' state.json > state.json.tmp && mv state.json.tmp state.json

# Add to execution log
jq --arg now "$(date -Iseconds)" \
   '.execution_log += [{timestamp: $now, level: "INFO", message: "Card 01 completed", card: "01", tdd_phase: "RED"}]' \
   state.json > state.json.tmp && mv state.json.tmp state.json
```

### Pattern 4: Complete All Cards (Final Step)

```bash
# Update overall status
jq '.overall_status = "COMPLETE" | .completed_at = "'$(date -Iseconds)'" | .tdd_phase = "COMPLETE"' state.json > state.json.tmp && mv state.json.tmp state.json

# Add completion to log
jq --arg now "$(date -Iseconds)" \
   '.execution_log += [{timestamp: $now, level: "INFO", message: "All cards completed - PR created", card: null, tdd_phase: "COMPLETE"}]' \
   state.json > state.json.tmp && mv state.json.tmp state.json
```

### Pattern 5: Fail a Card

```bash
# Mark card as failed
jq '.cards."01".status = "failed" | .cards."01".error = "Error description" | .overall_status = "FAILED"' state.json > state.json.tmp && mv state.json.tmp state.json

# Add error to log
jq --arg now "$(date -Iseconds)" \
   '.execution_log += [{timestamp: $now, level: "ERROR", message: "Card 01 failed: Error description", card: "01", tdd_phase: "RED"}]' \
   state.json > state.json.tmp && mv state.json.tmp state.json
```

## TDD Phase Transitions

| Current | Next | Trigger |
|---------|------|---------|
| RED | GREEN | Card 01 completed (test fails → passes) |
| GREEN | VERIFY | Card 02 completed (fix applied) |
| VERIFY | COMPLETE | Card 03 completed (PR created) |

## Quick Commands

### Check Current Status

```bash
# Show overall status
cat state.json | jq '.overall_status, .tdd_phase, .current_card'

# Show all card statuses
cat state.json | jq -r '.cards | to_entries[] | "\(.key): \(.value.status)"'

# Show completed count
cat state.json | jq '[.cards | to_entries[] | select(.value.status == "completed")] | length'
```

### View Execution Log

```bash
# Show recent log entries
cat state.json | jq -r '.execution_log[-5:] | reverse[] | "[\(.timestamp)] [\(.level)] \(.message)"'

# Show errors only
cat state.json | jq -r '.execution_log[] | select(.level == "ERROR") | "[\(.timestamp)] \(.message)"'
```

## Auto-Commit Subagent Protocol

**Spawn independent subagent for continuous commits:**

```bash
# At start of implementation
spawn_auto_commit() {
  nohup ./auto-commit-daemon.sh --feature "{BUG_ID}" --interval 300 &
  echo $! > /tmp/auto-commit-daemon.pid
  echo "Auto-commit subagent spawned (PID: $(cat /tmp/auto-commit-daemon.pid))"
}

# Call this first
spawn_auto_commit
```

**Subagent Management:**
```bash
# Check if running
ps aux | grep auto-commit-daemon

# Stop when done
./auto-commit-daemon.sh --stop
```

## Troubleshooting

### Error: "jq: command not found"

```bash
# Install jq
sudo apt-get install jq    # Ubuntu/Debian
brew install jq            # macOS
```

### Error: "Cannot iterate over null"

Recreate state.json from template.

### Git error after smart_commit

Check git status:
```bash
git status
git log --oneline -3
```

---

**Protocol Version:** 2.0 (with Git Flow Enforcement)
**Required Tools:** jq, smart_commit.sh, auto-commit-daemon.sh
