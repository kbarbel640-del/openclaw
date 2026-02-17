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

## См. также

- [Полная настройка OpenClaw](setup-cloudru-fm-full.md)
- [Установка Cloud.ru FM](foundation-models/installation.md)
