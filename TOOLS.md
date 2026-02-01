# TOOLS.md - Local Notes

Skills define *how* tools work. This file is for *your* specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:
- Camera names and locations
- SSH hosts and aliases  
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras
- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH
- home-server → 192.168.1.100, user: admin

### TTS
- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

### Голосовые сообщения (Telegram)
- Транскрибирую через Groq Whisper API
- Endpoint: `https://api.groq.com/openai/v1/audio/transcriptions`
- Модель: `whisper-large-v3`
- Файлы приходят в `~/.clawdbot/media/inbound/` как `.ogg`

### Telethon (Telegram userbot)
- Сессия: `/Users/vladdick/Projects/ai_secretar/tests/session/test_user.session`
- API_ID: 37660671
- API_HASH: в `tests/e2e/config.py`
- Бот для тестов: `@daily_ai_helper_bot`

### .env ключи (из бэкапа)
- GEMINI_API_KEY — AI Studio (бесплатный, лимит TPM)
- VOYAGE_API_KEY — для memory_search embeddings
- NEON_API_KEY — БД AI Secretar

---

Add whatever helps you do your job. This is your cheat sheet.
