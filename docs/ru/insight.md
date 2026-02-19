# Инсайт: миграция с GLM-4.7 на gpt-oss-120b

> **Дата:** Февраль 2026

## Симптомы

При использовании моделей семейства GLM-4.7 через Cloud.ru FM proxy наблюдались:

| Симптом             | Частота                  | Контекст                                                       |
| ------------------- | ------------------------ | -------------------------------------------------------------- |
| **HTTP 404**        | Регулярно                | Запросы к `zai-org/GLM-4.7`, `GLM-4.7-FlashX`, `GLM-4.7-Flash` |
| **Таймауты**        | Часто                    | Длинные промпты, сложные задачи                                |
| **`content: null`** | Всегда при thinking mode | `DISABLE_THINKING: "false"` + GLM-4.7                          |

Thinking mode (`extended_thinking`) на GLM-4.7 возвращал ответ с `content: null` — Claude Code интерпретировал это как пустой ответ и падал.

## Суть проблемы

Модели семейства GLM-4.7 на Cloud.ru Foundation Models нестабильны:

- Эндпоинты периодически возвращают 404 (модель недоступна)
- Таймауты на сложных запросах (модель не укладывается в лимит)
- Thinking mode не поддерживается корректно — поле `content` приходит `null`

Прокси `claude-code-proxy` передаёт ответ as-is, поэтому Claude Code получает невалидный ответ.

## Решение

Переключить все три tier'а (`BIG_MODEL`, `MIDDLE_MODEL`, `SMALL_MODEL`) на `openai/gpt-oss-120b` и отключить thinking mode.

### Параметры модели `openai/gpt-oss-120b`

| Параметр                               | Значение                                                   |
| -------------------------------------- | ---------------------------------------------------------- |
| Контекст                               | 128K токенов                                               |
| Стоимость (input/output за 1M токенов) | 15.86 / 61                                                 |
| Function calling                       | Поддерживается                                             |
| Thinking mode                          | Не рекомендуется (использовать `DISABLE_THINKING: "true"`) |

### Что менять

#### 1. `docker-compose.cloudru-proxy.yml`

Заменить модели во всех трёх переменных:

```yaml
environment:
  BIG_MODEL: "openai/gpt-oss-120b"
  MIDDLE_MODEL: "openai/gpt-oss-120b"
  SMALL_MODEL: "openai/gpt-oss-120b"
  DISABLE_THINKING: "true"
```

Если файл генерируется wizard'ом — отредактируйте после генерации или пересоздайте вручную.

#### 2. `~/.openclaw/openclaw.json` (при ручной конфигурации)

Если модели прописаны в конфиге gateway, замените их аналогично.

### Применение изменений

```bash
# Пересоздать контейнер
docker compose -f docker-compose.cloudru-proxy.yml up -d --force-recreate

# Проверить здоровье
docker compose -f docker-compose.cloudru-proxy.yml ps
curl -sf http://localhost:8082/health

# Проверить логи
docker compose -f docker-compose.cloudru-proxy.yml logs -f
```

## Сопутствующие фиксы

В этом же коммите исправлены две проблемы с Docker-прокси:

1. **Image tag**: `legard/claude-code-proxy:v1.0.0` → `:latest` — образ публикуется только с тегом `:latest`
2. **Docker security**: убраны `read_only: true` и `user: "1000:1000"` — образ использует `uv run` как entrypoint, которому нужна запись в `/app/.venv` и `/root/.cache`

---

# Инсайт: добавление пресета GPT-OSS-120B в визард

> **Дата:** Февраль 2026

## Симптомы

Бот в Telegram работал в режиме `cloudru-fm/openai/gpt-oss-120b` (direct API) — без tools, без skills. Причина: модель `gpt-oss-120b` отсутствовала в пресетах визарда, конфиг был настроен вручную с direct provider вместо `claude-cli`.

| Что не работало        | Причина                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| Skills (slash-команды) | Direct provider `cloudru-fm/...` не поддерживает tool use через Claude Code |
| Fallback-модели        | Все 3 тира указывали на одну модель `openai/gpt-oss-120b`                   |
| Автоматический onboard | Пресет `cloudru-fm-gpt-oss` отсутствовал в визарде                          |

## Решение

Добавлен пресет `cloudru-fm-gpt-oss` в 4 файла:

| Файл                                  | Что добавлено                                                    |
| ------------------------------------- | ---------------------------------------------------------------- |
| `src/config/cloudru-fm.constants.ts`  | Модель `"gpt-oss-120b": "openai/gpt-oss-120b"` + пресет с тирами |
| `src/commands/onboard-types.ts`       | `"cloudru-fm-gpt-oss"` в union `AuthChoice`                      |
| `src/commands/auth-choice-options.ts` | Пункт в группе `cloudru-fm` + опция меню                         |
| `src/cli/program/register.onboard.ts` | `cloudru-fm-gpt-oss` в help-текст `--auth-choice`                |

### Маппинг тиров

| Tier              | claude-cli alias    | Model ID                |
| ----------------- | ------------------- | ----------------------- |
| big (primary)     | `claude-cli/opus`   | `openai/gpt-oss-120b`   |
| middle (fallback) | `claude-cli/sonnet` | `zai-org/GLM-4.7`       |
| small (fallback)  | `claude-cli/haiku`  | `zai-org/GLM-4.7-Flash` |

## Ключевые инсайты

### 1. Direct provider vs claude-cli

`cloudru-fm/openai/gpt-oss-120b` — direct provider, запросы идут напрямую к модели. **Skills и tools не работают**, потому что Claude Code передаёт tool definitions только через CLI backend.

`claude-cli/opus` — маршрут через CLI backend (прокси). Skills работают, tool use работает. Визард автоматически прописывает `cliBackends` с proxy URL и sentinel key.

### 2. Забытый файл: register.onboard.ts

`src/cli/program/register.onboard.ts:61` содержит **хардкод-список** допустимых значений `--auth-choice` в help-тексте Commander. При добавлении нового `AuthChoice` нужно обновлять **5 файлов**, а не 4:

1. `src/config/cloudru-fm.constants.ts` — модель + пресет
2. `src/commands/onboard-types.ts` — union type
3. `src/commands/auth-choice-options.ts` — группа + опция меню
4. `src/cli/program/register.onboard.ts` — help-текст CLI
5. `auth-choice.apply.cloudru-fm.ts` — не нужно менять (обрабатывает любой ключ из `CLOUDRU_FM_PRESETS`)

### 3. pnpm build перед onboard

`pnpm openclaw` запускает код из `dist/`. Изменения в `src/` не подхватываются до `pnpm build`. Если визард показывает старые опции — забыли пересобрать.

### 4. Dev vs Production конфиг

| Команда                 | Конфиг                          | Порт  |
| ----------------------- | ------------------------------- | ----- |
| `pnpm openclaw onboard` | `~/.openclaw/openclaw.json`     | 18789 |
| `gateway:dev`           | `~/.openclaw-dev/openclaw.json` | 19001 |

`pnpm openclaw onboard` **не пишет** в dev-конфиг. Для обновления `~/.openclaw-dev/openclaw.json` нужно либо вручную скопировать поля `agents.defaults.model` и `models.providers.cloudru-fm.models`, либо использовать отдельный механизм.

## См. также

- [Полная настройка OpenClaw](setup-cloudru-fm-full.md)
- [Установка Cloud.ru FM](foundation-models/installation.md)

---

# Инсайт: Telegram бот не отвечает на сообщения

> **Дата:** Февраль 2026

## Симптомы

| Симптом                                                           | Контекст                                 |
| ----------------------------------------------------------------- | ---------------------------------------- |
| Бот молчит в Telegram                                             | Сообщения доходят до бота, но ответа нет |
| Gateway не запущен                                                | Команда `pnpm gateway` не существует     |
| `pnpm gateway:dev` запускает gateway, но Telegram не подключается | Каналы отключены переменной окружения    |

## Суть проблемы

Три независимые причины, каждая из которых блокирует ответ бота:

### 1. `gateway:dev` отключает все каналы

Скрипт `gateway:dev` в `package.json` устанавливает `OPENCLAW_SKIP_CHANNELS=1`:

```
"gateway:dev": "OPENCLAW_SKIP_CHANNELS=1 CLAWDBOT_SKIP_CHANNELS=1 node scripts/run-node.mjs --dev gateway"
```

В `src/gateway/server-startup.ts:117-118` эта переменная проверяется и **все channel adapters** (Telegram, Slack и т.д.) не запускаются. В логах видно: `skipping channel start (OPENCLAW_SKIP_CHANNELS=1)`.

### 2. `dmPolicy: "pairing"` без `allowFrom`

В `~/.openclaw/openclaw.json` для Telegram стоит `dmPolicy: "pairing"` без списка `allowFrom`. При такой конфигурации бот отправляет код сопряжения при первом DM и не отвечает, пока пользователь не будет одобрен через `openclaw pair approve`.

### 3. Nested Claude Code session

При запуске gateway из сессии Claude Code переменная `CLAUDECODE` установлена. Agent backend (`claude-cli`) при старте проверяет её и отказывается запускаться:

```
FailoverError: Error: Claude Code cannot be launched inside another Claude Code session.
```

## Решение

### Новый скрипт `gateway:dev:tg`

Добавлен в `package.json` скрипт без `OPENCLAW_SKIP_CHANNELS`:

```json
"gateway:dev:tg": "node scripts/run-node.mjs --dev gateway"
```

### Переключение dmPolicy

В `~/.openclaw/openclaw.json` секция `channels.telegram`:

| Параметр    | Было        | Стало    |
| ----------- | ----------- | -------- |
| `dmPolicy`  | `"pairing"` | `"open"` |
| `allowFrom` | отсутствует | `["*"]`  |

### Обход nested session

Запуск gateway с `unset CLAUDECODE`:

```bash
unset CLAUDECODE && node openclaw.mjs gateway run
```

### Верификация

В логах gateway должно быть:

```
[telegram] [default] starting provider (@clawstackcl3_bot)
listening on ws://127.0.0.1:18789
```

Если видно `skipping channel start` — каналы по-прежнему отключены.
