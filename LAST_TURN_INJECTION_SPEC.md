# Post-Compaction Last-Turn Injection — Implementation Spec

## Problem

When auto-compaction fires, the conversation summary captures what happened but loses the raw last conversation turn. This causes the agent to repeat itself or lose track of where it was mid-conversation.

## Root Cause

The compaction system (`keepRecentTokens` = 20000 by default) keeps recent messages raw, but when many messages arrive near the compaction boundary (e.g., multiple subagent announcements), the token budget gets consumed by these less-important messages, and the most recent meaningful user↔assistant exchange gets pushed into the summarized portion.

## Architecture

- **pi-coding-agent** (npm dependency `@mariozechner/pi-coding-agent`): Core `compact()`, `prepareCompaction()`, `findCutPoint()`
- **OpenClaw `src/agents/pi-extensions/compaction-safeguard.ts`**: Extension that hooks `session_before_compact` to provide enhanced summarization. **This is where we implement the change.**
- **OpenClaw `src/agents/pi-embedded-runner/compact.ts`**: Orchestrates compaction for embedded sessions (calls `session.compact()`)
- **OpenClaw `src/agents/compaction.ts`**: Utility functions for summarization

## Implementation Plan

### Where to change: `src/agents/pi-extensions/compaction-safeguard.ts`

The `compaction-safeguard.ts` extension already hooks `session_before_compact` and takes full control of the compaction summary via the extension API. It receives `preparation.messagesToSummarize` (messages being discarded) and generates a summary string.

### What to change:

After the summary is generated (the `historySummary` variable, around line 262), extract the last meaningful conversation turn from `messagesToSummarize` and append it verbatim to the summary.

### Algorithm:

```typescript
function extractLastTurn(messages: AgentMessage[]): { user?: string; assistant?: string } {
  let lastUser: string | undefined;
  let lastAssistant: string | undefined;

  // Walk backwards through messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant" && !lastAssistant) {
      lastAssistant = extractTextContent(msg);
    }
    if (msg.role === "user" && !lastUser) {
      lastUser = extractTextContent(msg);
      break; // Found both, stop
    }
  }

  return { user: lastUser, assistant: lastAssistant };
}
```

### Token cap:

- Cap the injected last turn at MAX_LAST_TURN_TOKENS (2000 tokens, ~8000 chars)
- If the last turn exceeds this, truncate with "[...truncated]"
- This prevents a massive last turn from eating the context budget

### Format in summary:

```
## Last Exchange (Verbatim)
> **User:** [raw user message text]
> **Assistant:** [raw assistant response text]
```

### Edge Cases:

1. **Tool-call-heavy last turn**: The last assistant message might be mostly tool calls. Extract text blocks only, skip tool call arguments.
2. **Very long last turn**: Cap at MAX_LAST_TURN_TOKENS.
3. **No user message in summarized portion**: The cut point kept the user message but summarized only older content. In this case, don't inject anything (the last turn is already in the kept portion).
4. **Messages are all tool results**: Skip injection if there's no meaningful user↔assistant exchange.
5. **Image content blocks**: Note "[image]" placeholder instead of binary data.

### Files to modify:

1. `src/agents/pi-extensions/compaction-safeguard.ts` — main implementation
2. `src/agents/pi-extensions/compaction-safeguard.test.ts` — tests (if exists, or create)

### Tests to write (TDD — write these FIRST):

1. `extractLastTurn` returns correct user/assistant from a message list
2. `extractLastTurn` handles tool-call-heavy assistant messages (extracts text only)
3. `extractLastTurn` returns undefined when no user message exists
4. `formatLastTurnSection` produces correct markdown
5. `formatLastTurnSection` truncates at token cap
6. `formatLastTurnSection` returns empty string when both user and assistant are undefined
7. Integration: compaction-safeguard appends last turn section to summary
8. Integration: last turn NOT appended when messages are empty
9. Token cap is respected for very large messages

## Config

Add an optional config key to `agents.defaults.compaction`:

```json
{
  "agents": {
    "defaults": {
      "compaction": {
        "lastTurnInjection": true, // default true
        "lastTurnMaxTokens": 2000 // default 2000
      }
    }
  }
}
```

## Testing

Run tests with: `npx vitest run src/agents/pi-extensions/compaction-safeguard`
