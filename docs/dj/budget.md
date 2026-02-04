# DJ Budget System

Resource management and cost control for DJ agent workflows.

## Overview

The budget system provides tiered resource limits that control how much an agent can spend on a single workflow. This prevents runaway costs and ensures predictable usage.

## Budget Profiles

### Cheap

Minimal resource usage for simple queries:

| Limit | Value |
|-------|-------|
| Tool calls | 10 |
| LLM calls | 5 |
| Tokens | 50,000 (~$0.10) |
| Runtime | 1 minute |
| Subagents | 0 (disabled) |
| Web searches | 1 |
| Web fetches | 2 |
| Browser | Disabled |
| Model tier | Local |

**Best for:** Quick questions, simple lookups, agenda checks.

### Normal (Default)

Balanced limits for typical tasks:

| Limit | Value |
|-------|-------|
| Tool calls | 50 |
| LLM calls | 20 |
| Tokens | 200,000 (~$1.00) |
| Runtime | 5 minutes |
| Subagents | 2 |
| Web searches | 5 |
| Web fetches | 10 |
| Browser | Disabled |
| Model tier | Standard |

**Best for:** Task management, calendar work, research tasks.

### Deep

Higher caps for complex research (requires explicit arming):

| Limit | Value |
|-------|-------|
| Tool calls | 200 |
| LLM calls | 100 |
| Tokens | 1,000,000 (~$10.00) |
| Runtime | 30 minutes |
| Subagents | 10 |
| Web searches | 20 |
| Web fetches | 50 |
| Browser | Enabled |
| Model tier | Premium |

**Best for:** Deep research, complex analysis, multi-step workflows.

**Auto-revert behavior:** Deep mode automatically reverts to normal after:
- 30 minutes (default timeout)
- One workflow completion (if armed with `oneRun` flag)

## Commands

### /budget

View or change budget profile.

```
/budget              # Show current profile and usage
/budget status       # Same as above
/budget set cheap    # Switch to cheap profile
/budget set normal   # Switch to normal profile
/budget arm deep     # Arm deep mode for 30 min (requires confirmation)
/budget arm deep 15m # Arm deep mode for 15 minutes
/budget arm deep 1h  # Arm deep mode for 1 hour
/budget arm deep --one-run  # Arm deep mode for one workflow only
```

### /usage

View cost and usage metrics.

```
/usage               # Show current session usage
/usage today         # Show today's total usage
/usage week          # Show this week's usage
```

## Enforcement Behavior

When a limit is hit:

1. **Stop gracefully** - Return best partial output
2. **Report the limit** - Tell user which cap was exceeded
3. **Offer escalation** - Ask if user wants to continue in deep mode

Example output:

```
⚠️ **Budget limit reached**

Limit: maxToolCalls (50)
Current: 50/50

I've completed partial results. To continue with higher limits:
• Reply "continue in deep mode"
• Or adjust limits: `/budget set deep`

**Partial result:**
[... best effort output ...]
```

## Error Loop Detection

If the same error occurs 3 times:

```
⚠️ **Error loop detected**

The same error occurred 3 times:
"API rate limit exceeded"

Stopping to prevent runaway resource usage.
Options:
• Wait and retry later
• Check API credentials
• Report issue if persistent
```

## BudgetGovernor API

The `BudgetGovernor` class enforces limits programmatically.

### Creating a Governor

```typescript
import { createBudgetGovernor, createCheapGovernor, createDeepGovernor } from "openclaw/budget";

// Default (normal profile)
const governor = createBudgetGovernor();

// Cheap profile
const cheapGov = createCheapGovernor();

// Deep profile (must be armed)
const deepGov = createDeepGovernor();

// With overrides
const custom = createBudgetGovernor({
  profileId: "normal",
  limitOverrides: { maxToolCalls: 75, maxCostUsd: 2.00 },
});
```

### Recording Usage

```typescript
// Record a tool call
const result = governor.recordToolCall("web_search");
if (!result.allowed) {
  console.log(`Limit exceeded: ${result.exceededLimit}`);
}

// Record LLM call with tokens
governor.recordLlmCall({
  input: 1000,
  output: 500,
  costUsd: 0.02,
});

// Record subagent spawn
governor.recordSubagentSpawn();

// Record error (for loop detection)
governor.recordError(error);

// Record retry attempt
governor.recordRetry();
```

### Checking Status

```typescript
// Get current usage
const usage = governor.getUsage();
console.log(`Tool calls: ${usage.toolCalls}`);
console.log(`Cost: $${usage.estimatedCostUsd.toFixed(2)}`);

// Get full status with percentages
const status = governor.getStatus();
console.log(`Profile: ${status.profileName}`);
console.log(`Tool calls: ${status.percentages.toolCalls}%`);

// Check if stopped
if (governor.isStopped()) {
  console.log(`Stopped: ${governor.getStopReason()?.message}`);
}
```

### Subscribing to Events

```typescript
const unsubscribe = governor.subscribe((event) => {
  switch (event.type) {
    case "usage_update":
      console.log("Usage updated:", event.usage);
      break;
    case "limit_warning":
      console.log(`Warning: ${event.result.message}`);
      break;
    case "limit_exceeded":
      console.log(`Exceeded: ${event.result.exceededLimit}`);
      break;
    case "error_loop_detected":
      console.log(`Loop: ${event.signature} (${event.count}x)`);
      break;
    case "workflow_complete":
      console.log(`Done in ${event.durationMs}ms`);
      break;
  }
});

// Later: stop listening
unsubscribe();
```

### Completing a Workflow

```typescript
// Mark workflow as complete (emits workflow_complete event)
governor.complete();
```

## Configuration

Add to `~/.openclaw/openclaw.json`:

```json
{
  "budget": {
    "defaultProfile": "normal",
    "agentProfiles": {
      "dj-personal": "normal",
      "dj-worksafe": "cheap"
    },
    "profileOverrides": {
      "normal": {
        "maxToolCalls": 75,
        "maxCostUsd": 2.00
      }
    },
    "autoEscalate": false
  }
}
```

### Configuration Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `defaultProfile` | string | `"normal"` | Default profile for new workflows |
| `agentProfiles` | object | `{}` | Profile overrides per agent ID |
| `profileOverrides` | object | `{}` | Limit overrides per profile |
| `autoEscalate` | boolean | `false` | Auto-escalate to deep mode when limits hit |

## Ops Digest Integration

The [Ops Digest cron job](./cron-jobs.md#ops-digest) includes budget metrics:

```
🔧 Ops Digest — Mon Feb 3, 2026

💰 TODAY'S SPEND
• Tokens: 127,450 (in: 108k, out: 19k)
• Estimated cost: $1.23
• Sessions: 18
• Tool calls: 245

📊 TOP ACTIONS BY COST
1. Deep research: podcast guests ($0.45)
2. Weekly review generation ($0.31)
3. Email draft + revision ($0.18)
...
```

## Best Practices

1. **Start cheap** - Use the cheap profile for quick queries
2. **Escalate deliberately** - Only arm deep mode for complex research
3. **Monitor costs** - Check `/usage` regularly
4. **Set agent defaults** - Configure per-agent profiles in config
5. **Handle limits gracefully** - Design workflows to return partial results

## Spend Sources

The following features consume budget and count against limits:

### LLM Calls (tokens + cost)

| Source | Description | Cost Factor |
|--------|-------------|-------------|
| Chat messages | Direct conversation | Tokens × model pricing |
| Agent reasoning | Multi-step thinking | Higher with extended thinking |
| Subagent prompts | Spawned agents | Each subagent uses tokens |
| Tool result parsing | Processing tool outputs | Input tokens |

### Tool Calls

| Tool | Counts As | Notes |
|------|-----------|-------|
| `web_search` | tool call + web_search | Limited per profile |
| `web_fetch` | tool call + web_fetch | Limited per profile |
| `browser_*` | tool call | Requires deep mode |
| `exec` | tool call | Shell commands |
| `file_*` | tool call | File operations |
| `notion_*` | tool call | Notion API |
| `calendar_*` | tool call | Google Calendar |
| `email_*` | tool call | Gmail |

### Media Understanding

| Feature | Cost | Notes |
|---------|------|-------|
| Image analysis | High token cost | Vision model pricing |
| Audio transcription | API cost | Whisper pricing |
| PDF extraction | Moderate tokens | Per-page processing |
| Video frame analysis | Very high | Multiple frames × vision |

### Embeddings

| Use Case | Cost |
|----------|------|
| Semantic search | Per 1K tokens |
| Memory indexing | Per document |
| RAG retrieval | Per query |

## Troubleshooting

### "Why did it stop early?"

Common reasons workflows stop before completion:

#### Tool Call Limit

```
⚠️ Limit exceeded for maxToolCalls: 50 >= 50
```

**Cause:** Too many tool calls in a single workflow.

**Fix:**
- Switch to `normal` or `deep` profile: `/budget set normal`
- Break complex tasks into smaller steps
- Use batch operations where possible

#### Token Limit

```
⚠️ Limit exceeded for maxTokens: 200000 >= 200000
```

**Cause:** Conversation context + outputs exceeded token cap.

**Fix:**
- Use `/new` to start fresh session
- Arm deep mode for complex research: `/budget arm deep`
- Reduce context by summarizing earlier conversation

#### Runtime Limit

```
⚠️ Limit exceeded for maxRuntimeMs: 300000 >= 300000
```

**Cause:** Workflow took longer than allowed (5 min for normal, 30 min for deep).

**Fix:**
- Break into smaller steps
- Use deep mode for long-running research
- Check for slow external APIs

#### Error Loop Detected

```
⚠️ Detected repeated error (3x): Error:API rate limit exceeded...
```

**Cause:** Same error occurred 3 times, indicating a loop or persistent failure.

**Fix:**
- Wait for rate limits to reset
- Check API credentials
- Verify external service status

#### Cost Limit

```
⚠️ Limit exceeded for maxCostUsd: 1.00 >= 1.00
```

**Cause:** Estimated cost exceeded profile cap.

**Fix:**
- Use cheaper models for simple tasks
- Arm deep mode for expensive research
- Adjust `maxCostUsd` in profile overrides

### Profile Recommendations

| Task Type | Recommended Profile |
|-----------|---------------------|
| Quick question | cheap |
| Task management | normal |
| Calendar/email | normal |
| Deep research | deep (armed) |
| Web scraping | deep (armed) |
| Multi-step analysis | deep (armed) |

## Notes

- Budget limits apply per workflow/request, not globally
- Cost estimates require model pricing in config
- Deep mode auto-reverts after 30 minutes or one run
- Use `/usage` to track spending patterns
- Limits are checked after each tool/LLM call
