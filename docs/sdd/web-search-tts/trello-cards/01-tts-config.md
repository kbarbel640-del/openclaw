# Card 01: TTS Configuration

| Field | Value |
|-------|-------|
| **ID** | TTS-01 |
| **Story Points** | 2 |
| **Depends On** | - |
| **Sprint** | 1 |

## User Story

> As a developer, I want TTS configuration in the config system so that users can customize TTS settings via `clawdis.json`.

## Context

Read before starting:
- [../requirements.md#6-configuration](../requirements.md) - Config requirements
- [src/config/config.ts](../../../../../src/config/config.ts) - Existing config patterns
- [src/config/config.ts:642-702](../../../../../src/config/config.ts#L642-L702) - WebSearchConfig as reference

## Instructions

### Step 1: Add TTS Config Type

Edit `src/config/config.ts` after the `WebSearchConfig` type definition:

```typescript
export type TTSConfig = {
  /** If false, do not enable TTS features. Default: true. */
  enabled?: boolean;
  /** MiniMax API key (or MINIMAX_API_KEY env var). */
  minimaxApiKey?: string;
  /** MiniMax group ID. Default: "default". */
  minimaxGroupId?: string;
  /** Model: speech-2.6-hd or speech-2.6-turbo. Default: speech-2.6-hd. */
  model?: string;
  /** Voice ID. Default: English_CalmWoman. */
  voiceId?: string;
  /** Emotion: fluent, happy, sad, etc. Default: fluent. */
  emotion?: string;
  /** Speed multiplier. Default: 1.0. */
  speed?: number;
  /** Cache TTL in seconds. Default: 604800 (7 days). */
  cacheTtlSec?: number;
  /** TTS generation timeout in seconds. Default: 30. */
  timeoutSec?: number;
  /** Max characters for TTS. Default: 9500. */
  maxChars?: number;
};
```

### Step 2: Add Defaults and Schema

Add after `WEB_SEARCH_DEFAULTS`:

```typescript
const TTS_DEFAULTS = {
  enabled: true,
  minimaxGroupId: "default",
  model: "speech-2.6-hd",
  voiceId: "English_CalmWoman",
  emotion: "fluent",
  speed: 1.0,
  cacheTtlSec: 604800, // 7 days
  timeoutSec: 30,
  maxChars: 9500,
} as const;
```

Add the Zod schema:

```typescript
const ttsSchema = z
  .object({
    enabled: z.boolean().default(TTS_DEFAULTS.enabled),
    minimaxApiKey: z.string().optional(),
    minimaxGroupId: z.string().default(TTS_DEFAULTS.minimaxGroupId),
    model: z.string().default(TTS_DEFAULTS.model),
    voiceId: z.string().default(TTS_DEFAULTS.voiceId),
    emotion: z.string().default(TTS_DEFAULTS.emotion),
    speed: z.number().positive().default(TTS_DEFAULTS.speed),
    cacheTtlSec: z.number().int().positive().default(TTS_DEFAULTS.cacheTtlSec),
    timeoutSec: z.number().int().positive().default(TTS_DEFAULTS.timeoutSec),
    maxChars: z.number().int().positive().default(TTS_DEFAULTS.maxChars),
  })
  .optional();
```

### Step 3: Add to ClawdisConfig Type

Add `tts?: TTSConfig;` to the `ClawdisConfig` interface (around line 420).

### Step 4: Add to ClawdisSchema

Add `tts: ttsSchema,` to the `ClawdisSchema` object (around line 895).

### Step 5: Add Environment Variable Override Function

Create `applyTTSEnvOverrides` function (similar to `applyWebSearchEnvOverrides`):

```typescript
function applyTTSEnvOverrides(config: ClawdisConfig): ClawdisConfig {
  const envEnabled = process.env.TTS_ENABLED;
  const envApiKey = process.env.MINIMAX_API_KEY;
  const envGroupId = process.env.MINIMAX_GROUP_ID;
  const envVoiceId = process.env.TTS_VOICE_ID;
  const envCacheTtl = process.env.TTS_CACHE_TTL_SEC;
  const envTimeout = process.env.TTS_TIMEOUT_SEC;

  if (!envEnabled && !envApiKey && !envGroupId && !envVoiceId && !envCacheTtl && !envTimeout) {
    return config;
  }

  const tts: TTSConfig = {
    enabled: config.tts?.enabled ?? TTS_DEFAULTS.enabled,
    minimaxApiKey: config.tts?.minimaxApiKey,
    minimaxGroupId: config.tts?.minimaxGroupId ?? TTS_DEFAULTS.minimaxGroupId,
    model: config.tts?.model ?? TTS_DEFAULTS.model,
    voiceId: config.tts?.voiceId ?? TTS_DEFAULTS.voiceId,
    emotion: config.tts?.emotion ?? TTS_DEFAULTS.emotion,
    speed: config.tts?.speed ?? TTS_DEFAULTS.speed,
    cacheTtlSec: config.tts?.cacheTtlSec ?? TTS_DEFAULTS.cacheTtlSec,
    timeoutSec: config.tts?.timeoutSec ?? TTS_DEFAULTS.timeoutSec,
    maxChars: config.tts?.maxChars ?? TTS_DEFAULTS.maxChars,
  };

  if (envEnabled) tts.enabled = envEnabled === "true";
  if (envApiKey) tts.minimaxApiKey = envApiKey.trim();
  if (envGroupId) tts.minimaxGroupId = envGroupId.trim();
  if (envVoiceId) tts.voiceId = envVoiceId.trim();
  if (envCacheTtl) {
    const parsed = parseInt(envCacheTtl, 10);
    if (!Number.isNaN(parsed) && parsed > 0) tts.cacheTtlSec = parsed;
  }
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!Number.isNaN(parsed) && parsed > 0) tts.timeoutSec = parsed;
  }

  return { ...config, tts };
}
```

### Step 6: Wire into loadConfig

Update `loadConfig` to call `applyTTSEnvOverrides` in the chain (after `applyWebSearchEnvOverrides`).

## Acceptance Criteria

- [ ] `TTSConfig` type exists with all required fields
- [ ] `ttsSchema` Zod validation exists
- [ ] `ClawdisConfig` includes `tts` property
- [ ] Environment variable override function exists and is wired
- [ ] Type checking passes: `pnpm build`
- [ ] Config file example works: `{ tts: { enabled: true, voiceId: "English_CalmWoman" } }`

## Next Steps

After completing this card:
1. Update state.json: set card 01 to "completed"
2. Read next card: [02-tts-client.md](./02-tts-client.md)
3. Continue execution
