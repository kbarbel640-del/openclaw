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
