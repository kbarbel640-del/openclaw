# Phase 2: Reproduction (ARC Protocol)

Goal: Verify bug reproduces and create Automated Reproduction Case (ARC).

## The ARC Protocol

```
┌─────────────────────────────────────────────────────────┐
│  AUTOMATED REPRODUCTION CASE (ARC)                      │
│                                                         │
│  An AI agent CANNOT guess. It must BEGIN by             │
│  programmatically PROVING the bug exists in a           │
│  controlled environment.                                │
│                                                         │
│  NO ARC = NO FIX                                        │
└─────────────────────────────────────────────────────────┘
```

## Step 1: Follow Reproduction Steps Exactly

Execute the steps from the bug report in a clean environment:

```bash
# Create clean test environment
cd /path/to/project
git stash  # Save any local changes
git checkout main
pnpm install  # Fresh dependencies

# Follow steps exactly as documented
{step_1_command}
{step_2_command}
...
```

## Step 2: Verify Bug Occurs

**Expected outcome:** Bug reproduces with same error.

```bash
# Run the trigger
{trigger_command}

# Compare output
# Expected error: {expected_error_from_report}
# Actual error:   {observed_error}
```

### If Bug Does NOT Reproduce:

1. Check environment differences
2. Check data/state differences
3. Check timing (race conditions)
4. Check permissions
5. Ask user for more details

**Mark as:** `NOT_REPRODUCIBLE` (cannot proceed without reproduction)

## Step 3: Create Reproduction Script

Create automated script that reproduces the bug:

```bash
#!/bin/bash
# reproduce-BUG-YYYY-MM-DD-NNN.sh

set -e

echo "=== Reproducing BUG-YYYY-MM-DD-NNN ==="

# Setup
{setup_commands}

# Trigger
{trigger_command}

# Check for expected error
if grep -q "{error_pattern}" output.log; then
    echo "BUG REPRODUCED"
    exit 1  # Non-zero = bug exists
else
    echo "BUG NOT REPRODUCED"
    exit 0  # Zero = bug fixed
fi
```

## Step 4: Measure Reproduction Rate

Run reproduction script multiple times:

```bash
SUCCESS=0
TOTAL=10

for i in $(seq 1 $TOTAL); do
    if ./reproduce-bug.sh 2>/dev/null; then
        echo "Run $i: NOT reproduced"
    else
        echo "Run $i: REPRODUCED"
        SUCCESS=$((SUCCESS + 1))
    fi
done

RATE=$((SUCCESS * 100 / TOTAL))
echo "Reproduction rate: $RATE%"
```

### Reproduction Rate Guidelines

| Rate | Status | Action |
|------|--------|--------|
| 90-100% | VERIFIED | Proceed with fix |
| 70-89% | MOSTLY_REPRODUCIBLE | Proceed, note flakiness |
| 50-69% | FLAKY | Investigate timing/race conditions |
| <50% | UNRELIABLE | Need more investigation |

## Step 5: Document Environment Sensitivity

Check if bug is sensitive to:

- [ ] **OS-specific**: Only on Linux? Mac? Windows?
- [ ] **Config-specific**: Only with certain settings?
- [ ] **Data-specific**: Only with certain input data?
- [ ] **Timing-specific**: Race condition? Order-dependent?
- [ ] **Version-specific**: Only in certain versions?

## 30-Second Transparency Rule

If reproduction takes longer than 30 seconds:

```bash
echo "[0:00] Starting reproduction..."
echo "[0:15] Setting up environment..."
echo "[0:30] Executing trigger..."
echo "[0:45] Checking results..."
echo "[1:00] Reproduction complete"
```

Never leave user waiting without progress updates.

## Output

Create `reproduction-case.md` with:
- Minimal reproduction steps
- Reproduction script
- Reproduction rate
- Environment sensitivity

Template: `TEMPLATES/reproduction-case.template.md`

## Completion Gate

Only proceed to Phase 3 when:
- [ ] Bug is verified as reproducible
- [ ] Reproduction script created
- [ ] Reproduction rate ≥70%
- [ ] Environment sensitivity documented

## Critical Rule

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  DO NOT PROCEED TO ROOT CAUSE WITHOUT REPRODUCTION!    │
│                                                         │
│  If bug cannot be reproduced:                           │
│  1. Ask for more information                            │
│  2. Check different environments                        │
│  3. Mark as NOT_REPRODUCIBLE                           │
│  4. STOP - cannot fix what cannot be proven            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
