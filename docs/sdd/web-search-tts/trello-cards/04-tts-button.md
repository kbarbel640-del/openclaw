# Card 04: TTS Button Factory

| Field | Value |
|-------|-------|
| **ID** | TTS-04 |
| **Story Points** | 2 |
| **Depends On** | 03 |
| **Sprint** | 2 |

## User Story

> As a developer, I want a button factory for TTS so that I can add inline buttons to Telegram messages.

## Context

Read before starting:
- [../requirements.md#2-button-behavior](../requirements.md) - Button requirements
- [../ui-flow.md](../ui-flow.md) - UI flow details
- [src/deep-research/button.ts](../../../../../src/deep-research/button.ts) - Similar pattern

## Instructions

### Step 1: Create Button Factory

Create `src/tts/button.ts`:

```typescript
import crypto from "node:crypto";
import { InlineKeyboard } from "grammy";

// Callback data prefix for TTS buttons
export const TTS_CALLBACK_PREFIX = "tts:";

const PROGRESS_STAGES = ["0%", "25%", "50%", "75%", "100%"] as const;
const PROGRESS_BAR_FILLED = "▮";
const PROGRESS_BAR_EMPTY = "░";
const PROGRESS_BAR_SEGMENTS = 10;

/**
 * Create hash from text for callback data
 */
function createTextHash(text: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(text);
  return hash.digest("hex").slice(0, 12);
}

/**
 * Create progress bar string
 */
function createProgressBar(percentage: number): string {
  const filled = Math.floor(percentage / 10);
  const empty = PROGRESS_BAR_SEGMENTS - filled;
  return PROGRESS_BAR_FILLED.repeat(filled) + PROGRESS_BAR_EMPTY.repeat(empty);
}

/**
 * Create initial "Озвучить" button
 */
export function createTTSButton(text: string): InlineKeyboard {
  const hash = createTextHash(text);
  const callbackData = `${TTS_CALLBACK_PREFIX}${hash}`;
  return new InlineKeyboard().text("🔊 Озвучить", callbackData);
}

/**
 * Create progress button with percentage
 */
export function createTTSProgressButton(
  stageIndex: number,
  textHash: string
): InlineKeyboard {
  const stage = PROGRESS_STAGES[stageIndex];
  const percentage = parseInt(stage, 10);
  const bar = createProgressBar(percentage);
  const callbackData = `${TTS_CALLBACK_PREFIX}${textHash}`;
  return new InlineKeyboard().text(`⏳ ${stage} ${bar}`, callbackData);
}

/**
 * Parse callback data to extract hash
 */
export function parseTTSCallbackData(data: string): string | null {
  if (!data.startsWith(TTS_CALLBACK_PREFIX)) {
    return null;
  }
  return data.slice(TTS_CALLBACK_PREFIX.length);
}

/**
 * Progress stage type
 */
export type TTSProgressStage = 0 | 1 | 2 | 3 | 4;

/**
 * Get progress percentage from stage
 */
export function getProgressPercentage(stage: TTSProgressStage): number {
  return parseInt(PROGRESS_STAGES[stage], 10);
}
```

## Acceptance Criteria

- [ ] `src/tts/button.ts` exists with all functions
- [ ] `createTTSButton()` creates inline keyboard with "🔊 Озвучить"
- [ ] `createTTSProgressButton()` creates progress buttons
- [ ] Progress bar shows correct visual (▮▮░░░)
- [ ] `parseTTSCallbackData()` extracts hash from callback
- [ ] Type checking passes: `pnpm build`

## Next Steps

After completing this card:
1. Update state.json: set card 04 to "completed"
2. Read next card: [05-tts-callback.md](./05-tts-callback.md)
3. Continue execution
