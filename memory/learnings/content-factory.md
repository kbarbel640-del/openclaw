# Content Factory — Learnings

## Из LEARNINGS.md проекта:

### Telegram
- TELEGRAM_OWNER_ID критичен для auth — проверять что совпадает с реальным ID
- ChatActionSender: `from aiogram.utils.chat_action import ChatActionSender`
- Message updates rate limiting: минимум 2-3 сек между редактированиями

### TTS
- Silero капризный в настройке — Edge TTS проще и надёжнее
- Edge TTS: `edge_tts.Communicate(text=text, voice="ru-RU-DmitryNeural")`

### Database
- SQLAlchemy default с lambda для мутабельных типов: `default=lambda: [...]`
- Всегда `await session.commit()` — без await не сохраняет

### API
- OpenRouter: 401=обновить ключ, 402=пополнить/бесплатная модель, 429=подождать
- Бесплатная модель: meta-llama/llama-3.3-70b-instruct:free

### FFmpeg
- `-c:v copy` не перекодировать видео (быстрее)
- `-shortest` заканчивать когда короткий поток закончится
- `-movflags +faststart` оптимизация для стриминга

### Паттерны
- Pipeline: dataclasses для контекста, StepResult с success/error
- FSM state — только текущая сессия, для персистентных настроек — БД
- asyncio.create_task: хранить ссылки в словаре для отмены
