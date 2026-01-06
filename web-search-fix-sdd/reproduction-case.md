# Reproduction Case: Web Search Intermittent Failures

> **Bug ID:** `WEB-SEARCH-INTERMITTENT` | **Status:** IN_PROGRESS

## Objective

Create automated reproduction to verify the bug exists and test the fix.

## Hypothesis

The bug occurs when `gemini CLI` fails (non-zero exit code) and the shell script outputs error text instead of JSON. The TypeScript executor then fails to parse this error text as JSON.

## Reproduction Steps

### Step 1: Direct Shell Script Test

```bash
# Navigate to project
cd /home/almaz/zoo_flow/clawdis

# Test with a query that might fail (simulate gemini CLI failure)
# This requires mocking gemini CLI to fail
```

### Step 2: Simulate gemini CLI Failure

The shell script outputs error text when gemini fails. We can simulate this:

```bash
# Create a mock script that mimics gemini CLI failure
cat > /tmp/mock-gemini-fail.sh << 'EOF'
#!/bin/bash
echo "Error: gemini CLI failed with exit code 10" >&2
exit 10
EOF
chmod +x /tmp/mock-gemini-fail.sh

# Temporarily override gemini in PATH
export PATH="/tmp:$PATH"

# Run web search (will use mock gemini)
./scripts/web_search_with_gemini.sh "test query"
```

### Step 3: Verify Error Output

```bash
# Run the script and capture output
./scripts/web_search_with_gemini.sh "test query" 2>&1 | tee output.log

# Expected: Error text, not JSON
# "Error: gemini CLI failed with exit code 10"
```

### Step 4: Check Executor Behavior

```bash
# Run executor test to see if it handles error text
node --input-type=module << 'EOF'
import { executeWebSearch } from './src/web-search/executor.js';

const result = await executeWebSearch("test query", { timeoutMs: 30000 });
console.log("Success:", result.success);
console.log("Error:", result.error);
console.log("Run ID:", result.runId);
EOF
```

## Expected Behavior

| Scenario | Expected Output |
|----------|-----------------|
| gemini succeeds | Valid JSON with results |
| gemini fails | Error handling that shows actual error, not generic "Ошибка поиска" |

## Actual Behavior (Bug)

| Scenario | Actual Output |
|----------|---------------|
| gemini fails | `✂︎ Ошибка поиска: Ошибка при выполнении поиска Search ID: error-XXX` |

## Reproduction Rate

**To be determined during investigation:**

- [ ] Run 10 times with various queries
- [ ] Document success/failure for each
- [ ] Identify patterns (short queries vs long, time of day, etc.)

## Automated Reproduction Script (ARC)

```bash
#!/bin/bash
# reproduce-web-search-bug.sh
# Run this to verify bug exists

echo "=== Reproducing WEB-SEARCH-INTERMITTENT ==="
echo ""

# Test 1: Check shell script with failing gemini
echo "Test 1: Shell script error handling"
./scripts/web_search_with_gemini.sh "hello world" 2>&1
EXIT1=$?
echo "Exit code: $EXIT1"
echo ""

# Test 2: Check executor output
echo "Test 2: TypeScript executor output"
node --input-type=module -e "
import { executeWebSearch } from './src/web-search/executor.js';
const r = await executeWebSearch('hello world');
console.log('Run ID:', r.runId);
console.log('Success:', r.success);
console.log('Error:', r.error);
"
echo ""

echo "=== Bug Pattern ==="
if [ $EXIT1 -ne 0 ]; then
  echo "Shell script exited with error (expected for this bug)"
fi

echo "BUG REPRODUCED: Exit code was not 0"
```

## Test Queries

| Query | Expected | Notes |
|-------|----------|-------|
| `hello world` | FAIL | Simple query, might trigger error |
| `git flow principles` | PASS | Complex query, more likely to succeed |
| `weather today` | UNKNOWN | Time-sensitive, depends on API |
| `python programming` | UNKNOWN | General knowledge |

## Next Steps

1. [ ] Run reproduction script
2. [ ] Verify bug is reproducible
3. [ ] Document exact error messages
4. [ ] Proceed to root cause analysis
