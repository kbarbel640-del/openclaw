# Card 03: TTS Provider with Config

| Field | Value |
|-------|-------|
| **ID** | TTS-03 |
| **Story Points** | 2 |
| **Depends On** | 02 |
| **Sprint** | 2 |

## User Story

> As a system, I want a configured TTS provider that integrates with Clawdis config so that TTS settings are centralized.

## Context

Read before starting:
- [../requirements.md#6-configuration](../requirements.md) - Config requirements
- [src/config/config.ts](../../../../../src/config/config.ts) - Load config function
- [src/tts/client.ts](../../../../../src/tts/client.ts) - TTS client

## Instructions

### Step 1: Create Provider Factory

Create `src/tts/provider.ts`:

```typescript
import type { TTSRequest, TTSResponse, TTSProgressCallback } from "./types.js";
import { MiniMaxTTSClient } from "./client.js";
import { loadConfig } from "../config/config.js";

let cachedClient: MiniMaxTTSClient | null = null;

/**
 * Get or create TTS client from config
 */
export function getTTSClient(): MiniMaxTTSClient | null {
  if (cachedClient) {
    return cachedClient;
  }

  const config = loadConfig();
  const ttsConfig = config.tts;

  if (!ttsConfig?.enabled) {
    return null;
  }

  const apiKey = ttsConfig.minimaxApiKey || process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.warn("[tts] No MiniMax API key configured");
    return null;
  }

  cachedClient = new MiniMaxTTSClient({
    apiKey,
    groupId: ttsConfig.minimaxGroupId,
    cacheTtlSec: ttsConfig.cacheTtlSec,
  });

  return cachedClient;
}

/**
 * Synthesize text using configured TTS provider
 */
export async function synthesize(
  text: string,
  onProgress?: TTSProgressCallback
): Promise<TTSResponse> {
  const client = getTTSClient();
  if (!client) {
    return {
      success: false,
      error: "TTS not enabled or not configured",
    };
  }

  const config = loadConfig();
  const ttsConfig = config.tts!;

  const request: TTSRequest = {
    text,
    model: ttsConfig.model,
    voiceId: ttsConfig.voiceId,
    emotion: ttsConfig.emotion,
    speed: ttsConfig.speed,
  };

  return client.synthesize(request, onProgress);
}

/**
 * Check if TTS is enabled
 */
export function isTTSEnabled(): boolean {
  const config = loadConfig();
  return config.tts?.enabled ?? false;
}
```

### Step 2: Create Index File

Create `src/tts/index.ts`:

```typescript
export * from "./types.js";
export * from "./client.js";
export * from "./provider.js";
```

## Acceptance Criteria

- [ ] `src/tts/provider.ts` exists with `getTTSClient()`, `synthesize()`, `isTTSEnabled()`
- [ ] `src/tts/index.ts` exists with exports
- [ ] Provider reads from Clawdis config
- [ ] Returns null when TTS disabled or no API key
- [ ] Type checking passes: `pnpm build`

## Next Steps

After completing this card:
1. Update state.json: set card 03 to "completed"
2. Read next card: [04-tts-button.md](./04-tts-button.md)
3. Continue execution
