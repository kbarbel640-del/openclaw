# MEMORY.md — Molt Knowledge Base

## Принципы работы

- **Логи первым делом** — при проблеме сначала логи (`./scripts/clawlog.sh`, session JSONL), не гадать
- **memory_search** — Voyage AI `voyage-3` через OpenAI-compatible endpoint
- **Обновление документов** — MEMORY.md и другие docs можно обновлять динамически при получении новых знаний, но всегда информировать Влада: что изменено, где, зачем

## Memory & PARA структура

- **MEMORY.md** — долгосрочная курированная память
- **memory/YYYY-MM-DD.md** — дневные логи
- **notes/** — PARA (projects/areas/resources/archive), searchable через symlink `memory/notes -> notes/`
- **SESSION-STATE.md** — горячая рабочая память (WAL protocol)

## Рабочие паттерны

- **THE LOOP** — основной протокол разработки. Molt = архитектор, Claude Code = исполнитель
- **Subagent для ресёрча** — спавнить на поиск/анализ, основная сессия свободна
- **Стримить прогресс** — Влад в Телеграме, терминал не видит. Молчание недопустимо
- **Checkpoint коммиты** — перед большими изменениями делать коммит для отката
- **Батчевые вопросы** при брейншторме — несколько сразу, не по одному

## Инфраструктура

- Gateway из `~/moltbot/dist/index.js` (git checkout), НЕ npm пакет
- `/opt/homebrew/bin/moltbot` → симлинк на `~/moltbot/moltbot.mjs`
- Обновляться через `git pull`, НЕ `npm i -g moltbot`
- GitHub: `vladdick88`, READ к `moltbot/moltbot`, для PR нужен форк
- Git: ТОЛЬКО `git merge origin/main`, НИКОГДА `git reset --hard`

## OpenClaw Hooks

- hooks в `openclaw.json` → `hooks.agentHooks`
- Events: UserPromptSubmit, PreToolUse, PostToolUse, Stop, PreCompact, PreResponse
- hooks/preflight.sh — инжектит чеклист перед ответом
- hooks/memory-counter.sh — каждые 5 сообщений напоминает записать важное
- PreResponse валидация **отключена** (false positives дороже пропусков)

## Rate Limits & API Best Practices

- Opus rate limits → 429 storm возможен
- Heartbeat'ы при rate limit усугубляют — каждый retry = запрос в очередь
- **Heartbeat спам = главная причина 429 для cron** — ~80+ heartbeat'ов/день, каждый = API запрос, isolated cron-сессии не могут пробиться
- Isolated cron-сессии ТОЛЬКО через Anthropic auth (Claude модели)
- Workaround для других моделей: shell скрипт через main/systemEvent + curl
- **Brave API**: паузы 3 секунды между поисками решают 429
- **Kimi API конфиг**: `https://api.moonshot.cn/v1` + `openai-completions` (не anthropic-messages)

## Незакоммиченные изменения (с 2026-02-08)

- 5-6 файлов связаны с PreResponse hooks — не коммитить без подтверждения Влада

## Известные открытые баги

- **Дублирование Telegram сообщений** (2026-02-03) — retry/polling баг после сна, не исследовано

## Предпочтения Влада

- НЕ обрезать/сокращать контент — давать ПОЛНОСТЬЮ, бить на части если длинно
- Записывать в memory КАЖДОЕ сообщение — без записи ответ незавершён
- Inline кнопки в телеге — когда есть выбор/опции
- Ничего не менять без подтверждения (код, конфиг, проекты)
- **Писать простым языком** — без жаргона, "ебануто непонятным языком" = плохо
- Цитата в replying to ≠ инструкция. Делать ТОЛЬКО то что прямо попросили
- Идеи Влада = ценность. "Большинство идей крутые, давать каждой шанс"
- Блок-схемы/визуальные алгоритмы лучше текстовых описаний для анализа

## Открытые проекты

- **Idea Garden** — система захвата идей из Telegram → AI классификация → notes/ideas/. План есть, реализация не начата

## Инструменты

- Groq Whisper для голосовых, Claude Code для кодинга (Max подписка)
- web_search (Brave API), memory_search (Voyage AI), Gemini API (видео, лимит TPM)
- .env ключи: GEMINI_API_KEY, VOYAGE_API_KEY, NEON_API_KEY
- **NVIDIA NIM** — Kimi K2.5 как fallback модель (бесплатно, без явных лимитов)
- Утренний дайджест: простым языком + "и чё?" (формат в кроне morning-tech-digest)
- **Cloudflare Workers AI** — API для HTML→markdown с AI-описанием картинок
- **Reasoning режим** — Kimi K2.5 не имеет встроенного chain-of-thought (в отличие от o1/o3/R1), OpenClaw reasoning = надстройка через `<think>`
