# Project Context: Web Search TTS Integration

## Project Overview

**Clawdis** is a personal AI assistant Gateway with multi-surface support (WhatsApp, Telegram, Discord, WebChat). It uses Pi agent in RPC mode for AI interactions.

## Current Architecture

### Web Search Flow

```
User: /web <query>
  |
  v
src/telegram/bot.ts (parseWebCommand)
  |
  v
src/web-search/executor.ts (executeWebSearch)
  |
  v
scripts/web_search_with_gemini.sh (CUSTOM SKILL)
  |
  v
Gemini CLI -> Google Gemini API
  |
  v
Result message displayed in Telegram
```

### Key Files

| File | Purpose |
|------|---------|
| `src/telegram/bot.ts` | Telegram bot main handler, `/web` command parsing (line 219-241), `runWebSearch` function (line 616-713) |
| `src/web-search/executor.ts` | Web search executor calling the shell script |
| `src/web-search/messages.ts` | Message templates (acknowledgment, resultDelivery, error) |
| `src/agents/pi-tools.ts` | Pi agent tool `createWebSearchTool` (line 350-419) |
| `scripts/web_search_with_gemini.sh` | SSOT for web search via Gemini |

### Existing Patterns

#### Inline Buttons (Deep Research Pattern)

**Location**: `src/deep-research/button.ts`

- Uses `grammy` InlineKeyboard
- Callback data prefix: `dr:` (deep research)
- Actions: `execute`, `retry`, `cancel`
- Topic encoding: base64 or server-side reference (for >64 bytes)
- Owner ID enforcement for multi-user scenarios

**Example callback handler**: `src/telegram/bot.ts` line 740-926

#### Message Editing Pattern

**Location**: `src/telegram/bot.ts`

1. Send initial status message → store `messageId`
2. Edit message with progress updates
3. Final message state or delete on completion

**Key function**: `editTelegramMessage` (line 716-738)

#### Configuration Pattern

**Location**: `src/config/config.ts`

- Zod schemas for validation
- Environment variable overrides (`applyWebSearchEnvOverrides`)
- Config path: `~/.clawdis/clawdis.json`
- WebSearchConfig type (line 702): `enabled`, `cliPath`, `timeoutMs`, `requireConfirmation`, `geminiModel`

## TTS Reference Implementation

### Source

**Project**: `/home/almaz/sandboxes/005_epub`

**Key Files**:
- `core/minimax_tts_client.py` - HTTP client for MiniMax API
- `core/tts/providers/minimax.py` - Provider abstraction
- `core/tts/base.py` - Base classes
- `core/tts/factory.py` - Factory pattern
- `core/tts/fallback_manager.py` - Circuit breaker failover

### MiniMax TTS 2.6 Details

**Endpoint**: `POST https://api.minimax.io/v1/t2a_v2?GroupId={group_id}`

**Key Parameters**:
- `model`: `speech-2.6-hd` (default) or `speech-2.6-turbo`
- `voice_id`: e.g., `English_Deep-VoicedGentleman`
- `emotion`: `happy`, `sad`, `angry`, `fluent`, etc.
- `speed`: float (default 1.0)
- `output_format`: `"hex"` for hex-encoded audio
- `use_uw_endpoint`: true for faster US-West endpoint

**Response**: Hex-encoded audio in JSON response → decode to MP3 bytes

## Constraints & Dependencies

### Telegram Constraints
- Callback data max: 64 bytes
- Message editing limited after ~48 hours
- Audio files via `sendVoice` or `sendAudio`

### Technical Constraints
- MiniMax API requires authentication (API key)
- Text-to-speech may need chunking for long results
- Progress tracking during async TTS generation
- Russian language support required

### Configuration Needed
- `MINIMAX_API_KEY` environment variable
- Optional: `MINIMAX_GROUP_ID`
- Voice settings (voice_id, emotion, speed)

## Areas Relevant to This Feature

1. **Web Search Result Message** (`src/telegram/bot.ts` line 662-669)
   - Currently: displays result with `resultDelivery` message
   - **Change**: Add inline button under this message

2. **Callback Handler** (`src/telegram/bot.ts` line 380-385)
   - **Add**: New callback prefix `tts:` for TTS button
   - Pattern follows `dr:` deep research implementation

3. **Configuration** (`src/config/config.ts`)
   - **Add**: `TTSConfig` type with MiniMax settings
   - **Add**: `tts` section to `ClawdisConfig`

4. **New Module**: `src/tts/`
   - MiniMax TTS client (TypeScript port from Python reference)
   - Provider factory
   - Audio file handling

## Naming Conventions

- Files: `kebab-case.ts`
- Types: `PascalCase`
- Functions: `camelCase`
- Callback prefixes: lowercase with colon suffix (`tts:`, `dr:`)
- Config keys: `camelCase`

## Dependencies Already Available

- `grammy` for Telegram bot (InlineKeyboard already used)
- `undici` for HTTP fetches
- File system utilities in `src/media/store.ts`
- Zod for config validation
