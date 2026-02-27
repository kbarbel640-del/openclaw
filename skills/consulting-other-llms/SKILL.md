---
name: consulting-other-llms
description: Consults multiple AI assistants (Codex, Copilot) for second opinions on tough problems. Use when stuck on a bug, fix attempts keep failing, need fresh perspective, or debugging complex issues.
---

# Consulting Other LLMs

Get second opinions from multiple AI assistants when stuck on difficult problems. Tracks fix attempts and escalates to external LLMs after repeated failures.

## Contents

- [Quick Reference](#quick-reference)
- [When to Use](#when-to-use)
- [Attempt Tracking](#attempt-tracking)
- [Non-Interactive Commands](#non-interactive-commands)
- [Multi-Model Strategy](#multi-model-strategy)
- [Prompt Templates](#prompt-templates)
- [Workflow](#workflow)

## Quick Reference

| Tool             | Command                                            | Best For                       |
| ---------------- | -------------------------------------------------- | ------------------------------ |
| Codex            | `codex exec "prompt"`                              | Deep code analysis, debugging  |
| Copilot (Claude) | `copilot -p "prompt" --model claude-opus-4.5`      | Reasoning, architecture        |
| Copilot (GPT)    | `copilot -p "prompt" --model gpt-5.2`              | Pattern recognition, debugging |
| Copilot (Gemini) | `copilot -p "prompt" --model gemini-3-pro-preview` | Alternative perspective        |
| aider            | `aider --message "prompt" file.py`                 | Code editing with git          |
| Cline            | `cline -y "prompt"`                                | Autonomous agent, CI/CD        |

## When to Use

**Trigger this skill when:**

- Fix attempt #2+ has failed for the same issue
- Error message is cryptic or undocumented
- Root cause is unclear after investigation
- Multiple hypotheses exist, need tiebreaker
- Dealing with unfamiliar framework/library

**Do NOT use when:**

- First attempt at a problem (try yourself first)
- Issue is clearly documented
- Simple syntax/typo error
- **Security bugs** (credentials, auth bypass, injection) - keep internal
- **Confidential data** in error logs (PII, tokens, secrets)
- **Unreleased features** under NDA or embargo

## Evidence Gate (Required)

Before consulting external LLMs, you MUST have:

| Evidence           | Required  | Example                                     |
| ------------------ | --------- | ------------------------------------------- |
| Problem statement  | ✅        | "Test crashes with EXC_BAD_ACCESS"          |
| Error output       | ✅        | Full stack trace, compiler error            |
| 2+ failed attempts | ✅        | "Tried X, then Y, both failed"              |
| Hypotheses         | ✅        | "Could be threading, memory, or API misuse" |
| Minimal repro      | Preferred | Smallest code that reproduces issue         |
| Environment        | Preferred | Xcode version, iOS version, device          |

**If you don't have all required evidence, gather it first.** External LLMs can't help without context.

## Attempt Tracking

Track fix attempts in a local file to know when to escalate:

```bash
# Initialize tracking for a problem
PROBLEM_ID="ci-swift-testing-crash"
ATTEMPTS_FILE="/tmp/llm-attempts-$PROBLEM_ID.json"

# Record an attempt
cat > "$ATTEMPTS_FILE" << EOF
{
  "problem": "$PROBLEM_ID",
  "attempts": [
    {
      "timestamp": "$(date -Iseconds)",
      "what_tried": "Added @MainActor to test class",
      "result": "failed",
      "error": "EXC_BAD_ACCESS in withCheckedContinuation"
    }
  ]
}
EOF

# Check attempt count
ATTEMPT_COUNT=$(jq '.attempts | length' "$ATTEMPTS_FILE")
echo "Attempts so far: $ATTEMPT_COUNT"

# Escalate after 2 failed attempts
if [ "$ATTEMPT_COUNT" -ge 2 ]; then
  echo "Escalating to external LLMs..."
fi
```

## Non-Interactive Commands

### Codex CLI

```bash
# Basic non-interactive execution
codex exec "Your detailed prompt here"

# With specific model
codex exec -m o3 "Your prompt"

# Read-only sandbox (safer)
codex exec --sandbox read-only "Analyze this error: ..."

# Full workspace access for fixes
codex exec --sandbox workspace-write "Fix this bug: ..."

# No approval prompts (fully automated)
codex exec --ask-for-approval never "Your prompt"
```

### Copilot CLI

```bash
# Non-interactive with specific model
copilot -p "Your prompt" --model claude-opus-4.5 --allow-all-tools

# Add project directory context
copilot -p "Your prompt" --model gpt-5.2 --add-dir /path/to/project --allow-all-tools

# Multiple models in sequence
for model in claude-opus-4.5 gpt-5.2 gemini-3-pro-preview; do
  echo "=== $model ==="
  copilot -p "Your prompt" --model $model --allow-all-tools 2>/dev/null
done
```

### aider CLI

```bash
# Non-interactive code change
aider --message "fix this bug" myfile.py

# Auto-approve all changes
aider --message "add error handling" myfile.py --yes

# Dry run (preview changes)
aider --message "refactor to async" myfile.py --dry-run

# Read prompt from file
aider --message-file instructions.txt myfile.py
```

### Cline CLI

```bash
# Fully autonomous mode (--yolo or -y)
cline -y "fix this production error"

# Pipe input
echo "Refactor this code" | cline -y

# Autonomous with mode
cline -y --mode act "debug the failing test"
```

## Multi-Model Strategy

**Always use the most powerful, newest models:**

| Provider  | Model                  | Strength                          |
| --------- | ---------------------- | --------------------------------- |
| Anthropic | `claude-opus-4.5`      | Deep reasoning, nuanced analysis  |
| OpenAI    | `gpt-5.2`              | Latest GPT, broad knowledge       |
| OpenAI    | `gpt-5.1-codex-max`    | Code-specialized, high capability |
| Google    | `gemini-3-pro-preview` | Alternative perspective           |

**Run ALL top models** - each has different blind spots:

```bash
PROMPT="Your detailed problem description"
FILE="path/to/relevant/file.swift"

# Parallel consultation (background jobs)
copilot -p "$PROMPT" --model claude-opus-4.5 --allow-all-tools > /tmp/claude-response.txt 2>&1 &
copilot -p "$PROMPT" --model gpt-5.2 --allow-all-tools > /tmp/gpt-response.txt 2>&1 &
copilot -p "$PROMPT" --model gemini-3-pro-preview --allow-all-tools > /tmp/gemini-response.txt 2>&1 &
codex exec "$PROMPT" > /tmp/codex-response.txt 2>&1 &
aider --message "$PROMPT" "$FILE" --yes > /tmp/aider-response.txt 2>&1 &
cline -y "$PROMPT" > /tmp/cline-response.txt 2>&1 &

wait
echo "All responses collected in /tmp/*-response.txt"
```

## Prompt Templates

### For Debugging Failures

```bash
PROMPT=$(cat << 'EOF'
## Problem
CI test failing with Swift Testing + async/await crash.

## Error
```

EXC_BAD_ACCESS in withCheckedContinuation
Thread 1: signal SIGABRT

````

## What I've Tried
1. Added @MainActor to test class - still crashes
2. Used Task { @MainActor in } wrapper - still crashes
3. Disabled parallel testing - still crashes

## Relevant Code
```swift
@Test func testAsyncOperation() async throws {
    let result = await sut.fetchData()
    #expect(result.count > 0)
}
````

## Context

- Xcode 16.2, iOS 18 SDK
- Swift Testing framework (not XCTest)
- Tests pass locally, fail in CI
- CI uses Azure DevOps macOS-15 agent

## Question

What is the root cause and how do I fix it?
EOF
)

copilot -p "$PROMPT" --model claude-opus-4.5 --allow-all-tools

````

### For Architecture Decisions

```bash
PROMPT=$(cat << 'EOF'
## Decision Needed
Should I use actors or locks for thread-safe cache?

## Context
- iOS app with 40+ frameworks
- Cache accessed from multiple queues
- Performance-critical path
- Need to support iOS 15+

## Options Considered
1. Actor with async/await
2. NSLock with sync access
3. DispatchQueue.sync barrier
4. os_unfair_lock

## Constraints
- Must work with existing sync code
- Cannot require async callers everywhere

What's the best approach and why?
EOF
)
````

### For Comparing Approaches

````bash
PROMPT=$(cat << 'EOF'
Two developers proposed different fixes. Evaluate both:

## Fix A (from Alice)
```swift
// Use MainActor isolation
@MainActor
class ViewModel {
    func update() { ... }
}
````

## Fix B (from Bob)

```swift
// Use nonisolated with explicit dispatch
nonisolated class ViewModel {
    func update() {
        DispatchQueue.main.async { ... }
    }
}
```

## Context

- Need to call from both main and background threads
- ViewModel is used in 50+ places

Which is better and why?
EOF
)

````

## Workflow

### Step 1: Exhaust Your Own Attempts First

Don't immediately escalate. Try at least 2 genuine fix attempts.

### Step 2: Document Everything Tried

```bash
# Create comprehensive context
CONTEXT=$(cat << EOF
## Problem Summary
[One sentence description]

## Full Error Output
[Complete error, not truncated]

## Attempts Made
1. [What] - [Result]
2. [What] - [Result]

## Relevant Files
$(cat path/to/relevant/file.swift)

## Environment
- OS: $(sw_vers -productVersion)
- Xcode: $(xcodebuild -version | head -1)
- Swift: $(swift --version | head -1)
EOF
)
````

### Step 3: Consult Multiple Models

```bash
#!/bin/bash
# save as: consult-llms.sh

PROBLEM="$1"
CONTEXT_FILE="$2"

if [ -z "$PROBLEM" ]; then
  echo "Usage: consult-llms.sh 'problem description' [context-file]"
  exit 1
fi

CONTEXT=""
[ -f "$CONTEXT_FILE" ] && CONTEXT=$(cat "$CONTEXT_FILE")

PROMPT="$PROBLEM

$CONTEXT

Provide your analysis and recommended fix."

echo "=== Consulting Claude Opus 4.5 ==="
copilot -p "$PROMPT" --model claude-opus-4.5 --allow-all-tools 2>/dev/null

echo ""
echo "=== Consulting GPT-5.2 ==="
copilot -p "$PROMPT" --model gpt-5.2 --allow-all-tools 2>/dev/null

echo ""
echo "=== Consulting Codex ==="
codex exec "$PROMPT" 2>/dev/null
```

### Step 4: Synthesize Responses

Look for:

- **Consensus**: If all models agree, high confidence
- **Unique insights**: One model may catch what others missed
- **Contradictions**: Investigate further, test both approaches

### Step 5: Apply and Verify

```bash
# After getting suggestions, implement the most promising
# Track this as another attempt
jq '.attempts += [{"timestamp": "'"$(date -Iseconds)"'", "what_tried": "LLM suggestion: ...", "result": "pending"}]' \
  "$ATTEMPTS_FILE" > /tmp/attempts.json && mv /tmp/attempts.json "$ATTEMPTS_FILE"
```

## Integration with CI Green

When using with `/ensuring-ci-green`:

```bash
# In the fix loop, after 2 failed attempts:
if [ "$ATTEMPT_COUNT" -ge 2 ]; then
  echo "Fix attempts exhausted. Consulting external LLMs..."

  # Gather CI failure context
  CONTEXT=$(cat << EOF
## CI Failure
Build ID: $BUILD_ID
Failed Task: $FAILED_TASK

## Error Log
$(az devops invoke --area build --resource logs \
    --route-parameters project=$PROJECT buildId=$BUILD_ID logId=$LOG_ID 2>/dev/null | tail -100)

## Previous Fix Attempts
$(jq -r '.attempts[] | "- \(.what_tried): \(.result)"' "$ATTEMPTS_FILE")
EOF
)

  # Get external perspective
  copilot -p "Help fix this CI failure:\n$CONTEXT" \
    --model claude-opus-4.5 --allow-all-tools
fi
```

## Gotchas

1. **Context limits**: Don't paste entire files. Extract relevant portions.
2. **Model availability**: Some models may be rate-limited. Have fallbacks.
3. **Non-determinism**: Same prompt may give different answers. Run twice if unsure.
4. **Tool permissions**: Use `--allow-all-tools` for Copilot to enable file access.
5. **Timeout**: Long prompts may timeout. Break into smaller questions.

## Verification

After applying LLM suggestions:

```bash
# Verify the fix works
mise run test:quiet || mise run build:quiet

# Update attempt tracking
if [ $? -eq 0 ]; then
  jq '.attempts[-1].result = "success"' "$ATTEMPTS_FILE" > /tmp/a.json && mv /tmp/a.json "$ATTEMPTS_FILE"
  echo "Fix successful!"
else
  jq '.attempts[-1].result = "failed"' "$ATTEMPTS_FILE" > /tmp/a.json && mv /tmp/a.json "$ATTEMPTS_FILE"
  echo "Fix failed. Consider trying another LLM suggestion."
fi
```

## Related Skills

- `/ensuring-ci-green` - CI pipeline debugging (consult when stuck)
- `/reproducing-bugs` - Bug reproduction (consult for fresh perspective)
- `/reviewing-ado-prs` - Code review (get second opinion on complex changes)
