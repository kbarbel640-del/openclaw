# Reproduction Case: {BUG_ID}

> ARC Status: {VERIFIED | FLAKY | NOT_REPRODUCIBLE}
> Last Verified: {DATE}

## Minimal Reproduction

### Prerequisites

- [ ] {Prerequisite 1}
- [ ] {Prerequisite 2}
- [ ] {Prerequisite 3}

### Environment Setup

```bash
# Clean environment setup
{setup_commands}
```

### Trigger Steps

```bash
# Step 1: {Description}
{command_1}

# Step 2: {Description}
{command_2}

# Step 3: Trigger bug
{trigger_command}
```

### Expected Output

```
{What output SHOULD look like}
```

### Actual Output (Bug)

```
{What output DOES look like - the error}
```

## Automated Reproduction Script

```bash
#!/bin/bash
# reproduce-{BUG_ID}.sh
# Automated reproduction script for {BUG_ID}

set -e

echo "=== Reproducing {BUG_ID} ==="
echo "Started: $(date)"

# Setup
{setup_commands}

# Trigger
echo "Triggering bug..."
{trigger_command} 2>&1 | tee /tmp/bug-output.log

# Check for bug
if grep -q "{error_pattern}" /tmp/bug-output.log; then
    echo ""
    echo "====================================="
    echo "BUG REPRODUCED"
    echo "====================================="
    echo "Error pattern found: {error_pattern}"
    exit 1  # Non-zero = bug exists
else
    echo ""
    echo "====================================="
    echo "BUG NOT REPRODUCED"
    echo "====================================="
    echo "Error pattern NOT found"
    exit 0  # Zero = bug fixed
fi
```

## Reproduction Statistics

| Metric | Value |
|--------|-------|
| Total Attempts | {TOTAL} |
| Successful Reproductions | {SUCCESS} |
| Reproduction Rate | {RATE}% |
| Average Time to Reproduce | {TIME}s |

### Reproduction Log

| Attempt | Date | Result | Notes |
|---------|------|--------|-------|
| 1 | {DATE} | {PASS/FAIL} | {notes} |
| 2 | {DATE} | {PASS/FAIL} | {notes} |
| ... | ... | ... | ... |

## Environment Sensitivity

### Confirmed Working

- [ ] Linux (Ubuntu 22.04)
- [ ] macOS (Ventura)
- [ ] Windows (11)

### Environment Variables

```bash
# Required for reproduction
{ENV_VAR_1}={VALUE}
{ENV_VAR_2}={VALUE}
```

### Configuration

```json
{
  "setting1": "{VALUE}",
  "setting2": "{VALUE}"
}
```

## Sensitivity Analysis

| Factor | Sensitive | Notes |
|--------|-----------|-------|
| OS | {YES/NO} | {details} |
| Node version | {YES/NO} | {details} |
| Config | {YES/NO} | {details} |
| Data | {YES/NO} | {details} |
| Timing | {YES/NO} | {details} |
| Order | {YES/NO} | {details} |

## Flakiness Analysis

{If reproduction rate < 100%}

**Suspected Cause:** {race condition / timing / external dependency}

**Mitigation for Testing:**
```bash
# Make reproduction more reliable
{mitigation_commands}
```

---

**ARC Created by:** {CREATOR}
**ARC Verified by:** {VERIFIER}
**Last Update:** {DATE}
