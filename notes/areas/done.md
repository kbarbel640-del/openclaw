# Реализованные фичи Molt ✅

## 2025-01-28 — Первый запуск

- Создал SOUL.md, USER.md, IDENTITY.md, MEMORY.md
- Изучил ~/Projects/ (15 проектов), определил AI Secretar как главный
- Настроил транскрибацию голосовых через Groq Whisper
- Inline кнопки в Telegram — работают

## 2025-01-29

- Исследование Gemini API для видео (бесплатный ключ AI Studio)
- Настроен `compaction.mode: "safeguard"` для защиты от tool_use_id mismatch

## 2026-01-29

- Настроен heartbeat (интервал, модель Sonnet)
- Установлены скиллы: jtbd-analyzer, cross-pollination-engine, reddit-insights
- Выключен contextPruning (mode: off) — только safeguard compaction
- Создана структура `notes/` (PARA: projects, areas, resources, archive)
- Cron напоминания работают

## 2026-01-30

- GitHub репо для AI Secretar: https://github.com/vladdick88/ai-secretar (приватный)
- Фикс OGG binary garbage (аудио/видео MIME → skip text extraction)
- Auto-retry при Anthropic terminated errors (до 2 попыток)
- Перенос данных из бэкапов ClawdBot (memory, DEV_WORKFLOW, HEARTBEAT, TOOLS)
- PREFLIGHT.md создан (короткий чеклист перед каждым ответом)
- `memory/learnings/` создана (global.md, content-factory.md, ai-secretar.md)
- Интеграция паттернов из proactive-agent (memory flush по порогам, self-healing)
- Хук `preflight-inject` — инжектит PREFLIGHT.md в system prompt через agent:bootstrap
- yt-dlp установлен, скачивание и отправка mp3 в Telegram работает
- Brainstorm по Content Factory и философии Влада ("Доктор Осьминог")
- Экосистема "Automation-as-Income" определена (Molt → Content Factory → Telegram Auto Channel)

## 2026-01-31

- **THE LOOP** — эталонный протокол разработки создан как скилл (`skills/the-loop/`)
  - Molt = архитектор, Anthropic harness = конвейер, Claude Code = исполнитель
  - 3-checkpoint doubt protocol, learnings injection, scope discipline
  - Промпты адаптированы из оригинала Anthropic (autonomous-coding harness)
- Ресёрч AI dev tools: изучены Devin, OpenHands, SWE-Agent, Aider и др.
- Фикс Telegram auto-restart каналов после сна мака (commit 61925ac)
- Brainstorm "Империя" — философия Влада раскрыта и записана
- `notes/areas/brainstorm-empire.md` — единый источник правды по философии

## 2026-02-01

- SOUL.md переписан в пошаговый алгоритм (с PRE/POST чеклистом)
- Voyage AI подключён для memory_search (модель voyage-3)
- Фикс terminated: stripping partial toolCalls + auto-retry + rebuild binary
- Правило "memory после КАЖДОГО сообщения" — установлено как критическое

## 2026-02-02

- Фикс: auto-restart каналов после сна мака с exponential backoff (commit 61925ac)
- Фикс: Telegram send retry — 5 попыток, 1с→60с backoff (commit 73e510d)
- Фикс: утренний дайджест — переключён на Sonnet + timeout 600с
- Ресёрч 17 AI dev tools, сравнительный анализ (`notes/resources/ai-dev-tools.md`)
- Оптимальный стек определён: Repomix + Taskmaster AI + THE LOOP

## 2026-02-03

- SOUL.md/PREFLIGHT.md/IDENTITY.md — переписаны с enforcement и видимым маркером `[PRE: ✓] [POST: ✓]`
- Plan `notes/projects/reliable-molt.md` создан
- Checkpoint коммит: `0fc085b11` (96 файлов)
- План на 04.02 записан в `notes/projects/2026-02-04-plan.md`

## 2026-02-04

- Fork создан: vladdick88/openclaw
- **PR #9085** отправлен в openclaw/openclaw (stability fixes)
- Cron hourly check PR #9085
- SOUL.md финализирован: 9 сценариев, PRE/POST checklist, стриминг
- Скиллы установлены: capability-evolver, self-improving-agent
- Двухуровневая система learnings: `.learnings/` (структурированные) → `memory/learnings/` → `MEMORY.md`
- BOOTSTRAP.md создан — автоматический инжект при /new
- Фикс: auto-inject BOOTSTRAP.md при /new или /reset (commit 417fb6db3)
- Roadmap к Джарвису — 17 пунктов (`notes/projects/molt-roadmap.md`)
- Context watchdog cron (каждые 10 мин, flush при >70%)
- `memory/procedures/` — папка для клонирования навыков
- SOUL.md → сценарий "Клонирование навыка" с триггерами

## 2026-02-05

- `/viperr` команда работает — инжектит VIPERR протокол в контекст агента через `replaceBody`
- Фикс: BOOTSTRAP.md инструкция в /new prompt (commit 296423f8c)
- Hooks v2 roadmap записан (`notes/projects/openclaw-hooks-v2.md`)
- PR #9085 пингнут, фиксы адресованы (e279fce6b)

## 2026-02-07

- **OpenClaw Hooks System — реализована и работает!**
  - UserPromptSubmit: shell hook, инжектит preflight checklist
  - PreToolUse: fire-and-forget
  - Stop: analytics/monitoring
  - PreResponse: AI валидация (код готов, конфиг требует доработки)
  - Конфиг: `hooks.agentHooks` в openclaw.json
  - 5 коммитов: f55447d28, 698002f5e, 8c1c05442, b9d56299c, 63181ee6f
- `hooks/preflight.sh` — рабочий shell hook для SOUL enforcement
- Обновление с upstream: `git merge origin/main` (commit fa17b26bf)

## 2026-02-08

- **PreResponse хук — работает!** (валидация ответов через DeepSeek)
- PreResponse v2: retry вместо append (при failed validation → перегенерация)
- OpenRouter интегрирован для дешёвой валидации ($0 DeepSeek free tier)
- Zod-схема обновлена для поддержки apiKey/baseUrl в хуках
- Roadmap улучшений: `notes/projects/molt-improvements-roadmap.md`

## 2026-02-09

- Оптимизация cron'ов — heartbeat на DeepSeek shell вместо Opus
- `hooks/heartbeat-deep.sh` — проверка через DeepSeek API (~$0.002/день)
- Context-check-light: main/Opus каждые 15 мин (минимальный текст)
- PreResponse валидация отключена (false positives дороже пропусков)
- Система нодов для Prompt Engineering — концепт одобрен Владом
  - Classify → Context Inject → Rewrite → Opus
- UserPromptSubmit хук: Llama 3.3 70B через Groq переписывает сообщения в структурированные промпты

---

_Обновлено: 2026-02-12_
