# Implementation Plan: Agent End Hook with Message Injection

## Goal
Allow plugins to intercept agent responses and inject continuation messages (e.g. anti-rationalization gates).

## Current State
- `agent_end` hook exists and fires after agent completes
- Event includes full message array but not the final assistant message
- Hook is fire-and-forget (void return)
- No mechanism to inject messages based on hook results

## Changes Needed

### 1. Update Event Type (src/plugins/types.ts)
```typescript
export type PluginHookAgentEndEvent = {
  messages: unknown[];
  lastAssistantMessage?: string;  // NEW: the final assistant message content
  success: boolean;
  error?: string;
  durationMs?: number;
};
```

### 2. Add Return Type (src/plugins/types.ts)
```typescript
export type PluginHookAgentEndResult = {
  continue?: boolean;
  message?: string;
};

// Update handler map
agent_end: (
  event: PluginHookAgentEndEvent,
  ctx: PluginHookAgentContext,
) => Promise<PluginHookAgentEndResult | void> | PluginHookAgentEndResult | void;
```

### 3. Update Hook Runner (src/plugins/hooks.ts)
Change `runAgentEnd` from fire-and-forget to awaitable with result aggregation:
```typescript
async function runAgentEnd(
  event: PluginHookAgentEndEvent,
  ctx: PluginHookAgentContext,
): Promise<PluginHookAgentEndResult | undefined> {
  // Collect results from all hooks
  // If any hook returns { continue: true }, return that
}
```

### 4. Update Agent Loop (src/agents/pi-embedded-runner/run/attempt.ts)
```typescript
if (hookRunner?.hasHooks("agent_end")) {
  const result = await hookRunner.runAgentEnd(...);
  if (result?.continue) {
    // Inject user message to force continuation
    // Add to session messages and loop again
  }
}
```

### 5. Extract Last Assistant Message
In the agent loop, extract the last assistant message text and add to event:
```typescript
const lastMsg = messagesSnapshot[messagesSnapshot.length - 1];
const lastAssistantMessage = lastMsg?.role === 'assistant' && typeof lastMsg.content === 'string'
  ? lastMsg.content
  : undefined;
```

## Testing Strategy
1. Write unit test for hook return value
2. Write e2e test with mock plugin that forces continuation
3. Test anti-rationalization plugin against known patterns

## Backwards Compatibility
- Existing hooks that return `void` continue to work
- Only hooks that return `{ continue: true }` trigger injection
- Event adds new optional field, doesn't break existing consumers

## Implementation Order
1. ✅ Types (event + result)
2. Hook runner (aggregation logic)
3. Agent loop (message injection)
4. Tests
5. Example plugin (anti-rationalization)
