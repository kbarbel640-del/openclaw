# Web Search TTS Integration - Functional Requirements

> Status: READY | Last updated: 2025-01-05

## 1. Trigger & Scope

### 1.1 Command Trigger

- System MUST add "Озвучить" button only for `/web <query>` command results
- System MUST NOT add button for agent tool `web_search` usage
- System MUST NOT add button for auto-categorized web intent

### 1.2 Success Condition

- Button MUST only appear when web search succeeds and returns results
- Button MUST NOT appear on error or timeout cases

---

## 2. Button Behavior

### 2.1 Initial Button State

- Button text: "🔊 Озвучить"
- Button MUST be inline button below result message
- Callback data format: `tts:{hash}` where hash = SHA-256 of result text

### 2.2 On Click - Progress Updates

- Button text MUST update to show progress percentage
- Progress stages: 0% → 25% → 50% → 75% → 100%
- Progress format: "⏳ {N}% ▮▮░░░░" (visual bar with filled/empty segments)
- Updates via `editMessageReplyMarkup` (Telegram API)

### 2.3 On Completion

- Button MUST be removed after audio is sent
- Audio file MUST be sent as voice message to chat

---

## 3. TTS Generation

### 3.1 MiniMax TTS 2.6 Integration

- Provider: MiniMax API v1 `/t2a_v2`
- Model: `speech-2.6-hd`
- Voice ID: `English_CalmWoman`
- Emotion: `fluent`
- Speed: `1.0`
- Output format: hex-encoded MP3 in JSON response

### 3.2 Text Processing

- Input: Web search result `response` field text
- Max length: ~9,500 characters (MiniMax limit)
- If text > limit: truncate with "..." suffix
- Russian text support required

### 3.3 Audio Caching

- Cache key: SHA-256 hash of input text
- Cache location: `~/.clawdis/cache/tts/{hash}.mp3`
- Cache TTL: 7 days (604,800 seconds)
- Check cache before calling MiniMax API

---

## 4. Error Handling

### 4.1 TTS API Failure

- Show error message: "✂︎ Озвучка не удалась: {error}"
- Remove button on error
- No retry button (user can re-run `/web` command)

### 4.2 Timeout

- TTS generation timeout: 30 seconds
- Show timeout error if exceeded

### 4.3 Invalid Response

- If MiniMax returns non-JSON or missing audio: show error
- Log detailed error for debugging

---

## 5. Non-Functional Requirements

### 5.1 Performance

- Button click acknowledgment: < 500ms (show progress)
- TTS generation: typically 5-15 seconds
- Cached result: < 100ms

### 5.2 Error Handling

- No automatic retries (one-shot generation)
- Graceful degradation on API failure
- Detailed logging for troubleshooting

### 5.3 Logging

- Log level: `info` for TTS operations
- Log level: `debug` for MiniMax API details
- Log format: `[tts] action: {action} hash: {hash} status: {status}`

---

## 6. Configuration

### 6.1 Config File Section

```json5
{
  tts: {
    enabled: true,
    minimaxApiKey: "your-api-key",     // or MINIMAX_API_KEY env
    minimaxGroupId: "default",          // optional
    model: "speech-2.6-hd",
    voiceId: "English_CalmWoman",
    emotion: "fluent",
    speed: 1.0,
    cacheTtlSec: 604800,                // 7 days
    timeoutSec: 30,
    maxChars: 9500
  }
}
```

### 6.2 Environment Variables

| Env Variable | Config Path | Default |
|--------------|-------------|---------|
| `TTS_ENABLED` | `tts.enabled` | `true` |
| `MINIMAX_API_KEY` | `tts.minimaxApiKey` | (required) |
| `MINIMAX_GROUP_ID` | `tts.minimaxGroupId` | `"default"` |
| `TTS_VOICE_ID` | `tts.voiceId` | `"English_CalmWoman"` |
| `TTS_CACHE_TTL_SEC` | `tts.cacheTtlSec` | `604800` |
| `TTS_TIMEOUT_SEC` | `tts.timeoutSec` | `30` |

---

## 7. Security

### 7.1 API Key Management

- MiniMax API key MUST be stored in config or env var
- Never log API key (mask in logs)
- Support for per-skill API key via `skills.tts.apiKey`

### 7.2 Input Validation

- Sanitize text before sending to TTS API
- Limit text length to prevent abuse
- Validate callback data format

---

## References

- Related to: `src/web-search/`, `src/telegram/bot.ts`
- Similar pattern: `src/deep-research/button.ts` (inline buttons)
- Reference implementation: `/home/almaz/sandboxes/005_epub/core/tts/` (Python)
- MiniMax API docs: https://www.minimaxi.com/document/guides/voice%20synthesis/api%20guide/all
