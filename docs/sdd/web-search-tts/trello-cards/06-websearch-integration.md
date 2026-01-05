# Card 06: Web Search Integration

| Field | Value |
|-------|-------|
| **ID** | TTS-06 |
| **Story Points** | 2 |
| **Depends On** | 05 |
| **Sprint** | 3 |

## User Story

> As a user, I want the "Озвучить" button to appear under web search results so that I can listen to the search results.

## Context

Read before starting:
- [../requirements.md#1-trigger-scope](../requirements.md) - Trigger requirements
- [src/telegram/bot.ts:616-713](../../../../../src/telegram/bot.ts#L616-L713) - `runWebSearch` function
- [src/web-search/executor.ts](../../../../../src/web-search/executor.ts) - Web search executor
- [src/web-search/messages.ts:46-48](../../../../../src/web-search/messages.ts#L46-L48) - `resultDelivery` message

## Instructions

### Step 1: Import Button Factory

In `src/telegram/bot.ts`, add to imports (from card 05):

```typescript
import { createTTSButton } from "../tts/button.js";
import { isTTSEnabled } from "../tts/provider.js";
```

### Step 2: Modify runWebSearch Function

Update the `runWebSearch` function to add TTS button on success.

Find the success case (around line 662-669) and modify:

```typescript
if (result.success && result.result) {
  // Edit the original message with result
  const resultText = webSearchMessages.resultDelivery(result.result);

  // Add TTS button if enabled
  const replyMarkup = isTTSEnabled()
    ? createTTSButton(result.result.response)
    : undefined;

  await ctx.api.editMessageText(
    statusChatId,
    statusMessageId,
    resultText,
    { parse_mode: "MarkdownV2", reply_markup: replyMarkup },
  );
}
```

**Important**: The button should ONLY be added for `/web` command, NOT for:
- Agent tool `web_search` usage
- Auto-categorized web intent

The current `runWebSearch` function is only called from the `/web` command handler (line 240), so this is safe.

### Step 3: Add Error Handling for TTS Button Creation

Wrap button creation in try-catch to prevent breaking web search if TTS has issues:

```typescript
// Add TTS button if enabled
let replyMarkup = undefined;
if (isTTSEnabled()) {
  try {
    replyMarkup = createTTSButton(result.result.response);
  } catch (err) {
    console.warn(`[tts] Failed to create button: ${err}`);
  }
}
```

## Acceptance Criteria

- [ ] TTS button appears under successful `/web` command results
- [ ] Button does NOT appear for agent tool `web_search` usage
- [ ] Button does NOT appear for auto-categorized web intent
- [ ] Web search still works if TTS is disabled or has errors
- [ ] Button click triggers TTS generation (tested with card 05)
- [ ] Type checking passes: `pnpm build`

## Testing

Test manually:
1. Send `/web weather in Moscow`
2. Verify "🔊 Озвучить" button appears below result
3. Click button and verify audio generation

## Next Steps

After completing this card:
1. Update state.json: set card 06 to "completed"
2. Read next card: [07-e2e-tests.md](./07-e2e-tests.md)
3. Continue execution
