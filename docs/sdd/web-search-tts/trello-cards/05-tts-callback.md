# Card 05: TTS Callback Handler

| Field | Value |
|-------|-------|
| **ID** | TTS-05 |
| **Story Points** | 2 |
| **Depends On** | 04 |
| **Sprint** | 2 |

## User Story

> As the Telegram bot, I want to handle TTS button clicks so that I can generate audio for users.

## Context

Read before starting:
- [../ui-flow.md](../ui-flow.md) - User flow with progress
- [../requirements.md#2-button-behavior](../requirements.md) - Button behavior
- [src/telegram/bot.ts:380-385](../../../../../src/telegram/bot.ts#L380-L385) - Existing callback handler entry
- [src/telegram/bot.ts:740-926](../../../../../src/telegram/bot.ts#L740-L926) - Deep research callback pattern

## Instructions

### Step 1: Add TTS Callback Handler

In `src/telegram/bot.ts`, add imports at top:

```typescript
import {
  createTTSProgressButton,
  parseTTSCallbackData,
  TTS_CALLBACK_PREFIX,
  type TTSProgressStage,
} from "../tts/button.js";
import { synthesize } from "../tts/provider.js";
```

### Step 2: Add TTS In-Flight Set

Add near line 47 (after `webSearchInFlight`):

```typescript
const ttsInFlight = new Set<string>();
```

### Step 3: Create TTS Callback Handler Function

Add after `handleDeepResearchCallback` function:

```typescript
async function handleTTSCallback(
  ctx: Context,
  runtime: RuntimeEnv,
): Promise<boolean> {
  const data = ctx.callbackQuery?.data;
  if (!data || !data.startsWith(TTS_CALLBACK_PREFIX)) {
    return false;
  }

  const textHash = parseTTSCallbackData(data);
  if (!textHash) {
    await ctx.answerCallbackQuery({ text: "Invalid TTS callback" });
    return true;
  }

  const callerId = ctx.from?.id;
  if (callerId === undefined) {
    await ctx.answerCallbackQuery({ text: "Invalid user" });
    return true;
  }

  // Check if already processing
  const flightKey = `${callerId}:${textHash}`;
  if (ttsInFlight.has(flightKey)) {
    await ctx.answerCallbackQuery({ text: "Уже генерирую..." });
    return true;
  }

  ttsInFlight.add(flightKey);

  try {
    await ctx.answerCallbackQuery({ text: "Генерирую аудио..." });

    // Get original message to extract result text
    const msg = ctx.callbackQuery.message;
    if (!msg || !("text" in msg)) {
      await ctx.reply("Ошибка: не найден оригинальный результат");
      return true;
    }

    // Extract web search result text from message
    const resultText = msg.text
      .replace(/^○ Результат поиска:\n\n/, "")
      .trim();

    if (!resultText) {
      await ctx.reply("Ошибка: пустой результат");
      return true;
    }

    const chatId = ctx.chat?.id;
    const messageId = msg.message_id;

    if (!chatId || !messageId) {
      await ctx.reply("Ошибка: не получен ID чата");
      return true;
    }

    // Progress update function
    let currentStage: TTSProgressStage = 0;
    const updateProgress = async (stage: TTSProgressStage) => {
      if (stage === currentStage) return;
      currentStage = stage;
      try {
        const button = createTTSProgressButton(stage, textHash);
        await ctx.api.editMessageReplyMarkup(chatId, messageId, button);
      } catch (err) {
        console.warn(`[tts] Failed to update progress: ${err}`);
      }
    };

    // Generate audio
    const result = await synthesize(resultText, async (percentage) => {
      if (percentage >= 100) await updateProgress(4);
      else if (percentage >= 75) await updateProgress(3);
      else if (percentage >= 50) await updateProgress(2);
      else if (percentage >= 25) await updateProgress(1);
      else await updateProgress(0);
    });

    if (result.success && result.audioPath) {
      // Send audio file
      const audioFile = await import("node:fs");
      if (audioFile.existsSync(result.audioPath)) {
        const { InputFile } = await import("grammy");
        const file = new InputFile(result.audioPath, "tts.mp3");

        await ctx.api.sendVoice(chatId, file, {
          caption: result.cached ? "🎙️ (из кэша)" : "🎙️",
        });
      }
      // Remove button
      await ctx.api.editMessageReplyMarkup(chatId, messageId);
    } else {
      // Show error, remove button
      await ctx.api.editMessageText(
        chatId,
        messageId,
        `✂︎ Озвучка не удалась:\n\n${result.error || "Неизвестная ошибка"}`,
      );
    }
  } finally {
    ttsInFlight.delete(flightKey);
  }

  return true;
}
```

### Step 4: Wire into Callback Handler

Update the `callback_query:data` handler (line 380-385):

```typescript
bot.on("callback_query:data", async (ctx, next) => {
  const handled = await handleDeepResearchCallback(ctx, runtime);
  if (!handled) {
    await handleTTSCallback(ctx, runtime);
  }
  if (next) await next();
});
```

## Acceptance Criteria

- [ ] `handleTTSCallback` function exists
- [ ] Callback handler checks for `tts:` prefix
- [ ] Progress updates work (0% → 25% → 50% → 75% → 100%)
- [ ] Audio file sent on success
- [ ] Button removed after completion
- [ ] Error message shown on failure
- [ ] `ttsInFlight` set prevents duplicate processing
- [ ] Type checking passes: `pnpm build`

## Next Steps

After completing this card:
1. Update state.json: set card 05 to "completed"
2. Read next card: [06-websearch-integration.md](./06-websearch-integration.md)
3. Continue execution
