# Quickstart: запуск всех сервисов с нуля

Пошаговая инструкция для запуска полного стека OpenClaw: прокси Cloud.ru FM + gateway + Telegram-бот + AI Fabric агенты.

---

## Требования

| Компонент | Версия / Требование                  |
| --------- | ------------------------------------ |
| Node.js   | >= 22.12.0                           |
| pnpm      | >= 10.x                              |
| Docker    | Для Cloud.ru FM прокси               |
| Telegram  | Бот-токен от @BotFather              |
| Cloud.ru  | API-ключ FM + IAM-ключ для AI Fabric |

---

## Шаг 1: Клонирование и сборка

```bash
git clone https://github.com/dzhechko/openclaw.git
cd openclaw
pnpm install
pnpm build
```

Проверка сборки:

```bash
pnpm check   # format + types + lint
```

---

## Шаг 2: Онбординг (интерактивный мастер)

```bash
pnpm openclaw onboard
```

Мастер создаст:

| Файл                               | Описание                               |
| ---------------------------------- | -------------------------------------- |
| `~/.openclaw/openclaw.json`        | Основной конфиг                        |
| `~/.openclaw/workspace/.env`       | `CLOUDRU_API_KEY` (права 0600)         |
| `docker-compose.cloudru-proxy.yml` | Docker Compose для Cloud.ru FM прокси  |
| `.gitignore` (дополнение)          | Исключает `.env` и compose из коммитов |

Если мастер не подходит, конфиг можно создать вручную (см. [Шаг 2а](#шаг-2а-ручная-настройка-конфига)).

---

## Шаг 2а: Ручная настройка конфига

<details>
<summary>Развернуть — пример полного <code>~/.openclaw/openclaw.json</code></summary>

```jsonc
{
  "models": {
    "mode": "merge",
    "providers": {
      "cloudru-fm": {
        "baseUrl": "http://127.0.0.1:8082",
        "apiKey": "${CLOUDRU_API_KEY}",
        "api": "anthropic-messages",
        "models": [
          {
            "id": "openai/gpt-oss-120b",
            "name": "GPT OSS 120B (opus)",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0 },
            "contextWindow": 200000,
            "maxTokens": 8192,
          },
          {
            "id": "zai-org/GLM-4.7",
            "name": "GLM-4.7 (sonnet)",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0 },
            "contextWindow": 200000,
            "maxTokens": 8192,
          },
          {
            "id": "zai-org/GLM-4.7-Flash",
            "name": "GLM-4.7-Flash (haiku)",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0 },
            "contextWindow": 200000,
            "maxTokens": 8192,
          },
        ],
      },
    },
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "claude-cli/opus",
        "fallbacks": ["claude-cli/sonnet", "claude-cli/haiku"],
      },
      "workspace": "/home/<user>/.openclaw/workspace",
      "cliBackends": {
        "claude-cli": {
          "command": "claude",
          "env": {
            "ANTHROPIC_BASE_URL": "http://127.0.0.1:8082",
            "ANTHROPIC_API_KEY": "not-a-real-key-proxy-only",
          },
          "clearEnv": ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY", "CLOUDRU_API_KEY"],
        },
      },
    },
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "<TELEGRAM_BOT_TOKEN>",
      "dmPolicy": "open",
      "allowFrom": ["*"],
      "groupPolicy": "allowlist",
      "streamMode": "partial",
    },
  },
  "gateway": {
    "port": 18789,
    "mode": "local",
    "bind": "loopback",
    "auth": {
      "mode": "token",
      "token": "<gateway-auth-token>",
    },
  },
  "plugins": {
    "entries": {
      "telegram": { "enabled": true },
      "status-agents": { "enabled": true },
      "ask-agent": { "enabled": true },
    },
  },
  "aiFabric": {
    "enabled": true,
    "projectId": "<CLOUDRU_PROJECT_ID>",
    "keyId": "<CLOUDRU_KEY_ID>",
  },
}
```

</details>

---

## Шаг 3: Переменные окружения

Экспортируйте секреты (или добавьте в `~/.bashrc` / `.env`):

```bash
# Cloud.ru Foundation Models API key (для прокси)
export CLOUDRU_API_KEY="ваш-ключ-от-cloud-ru-fm"

# Cloud.ru IAM secret (для AI Fabric: агенты, MCP серверы)
export CLOUDRU_IAM_SECRET="ваш-iam-secret"

# Telegram bot token (альтернатива записи в конфиг)
export TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
```

| Переменная           | Обязательна | Для чего                          |
| -------------------- | ----------- | --------------------------------- |
| `CLOUDRU_API_KEY`    | Да          | FM прокси (docker-compose `.env`) |
| `CLOUDRU_IAM_SECRET` | Для Fabric  | AI Fabric агенты и MCP серверы    |
| `TELEGRAM_BOT_TOKEN` | Нет\*       | Telegram-бот (если не в конфиге)  |

\* Токен можно указать либо в переменной окружения, либо в `channels.telegram.botToken` конфига.

---

## Шаг 4: Создание Telegram-бота

1. Откройте Telegram, найдите `@BotFather`
2. Отправьте `/newbot`, следуйте инструкциям
3. Скопируйте токен и запишите в конфиг или `TELEGRAM_BOT_TOKEN`

**Privacy Mode** (по умолчанию включен у ботов):

- Бот видит только сообщения с `/` или упоминания
- Чтобы отключить: `/setprivacy` → Disable в @BotFather
- После отключения удалите бота из группы и добавьте заново

---

## Шаг 5: Запуск Cloud.ru FM прокси

```bash
# Перейти в workspace (где лежит docker-compose)
cd ~/.openclaw/workspace

# Запустить прокси
docker compose -f docker-compose.cloudru-proxy.yml up -d

# Подождать 10 сек и проверить здоровье
sleep 10
curl -sf http://127.0.0.1:8082/health && echo " OK" || echo " FAIL"
```

Прокси слушает на `127.0.0.1:8082` и маршрутизирует запросы Claude CLI → Cloud.ru Foundation Models API.

**Доступные модели** (зависят от выбранного пресета):

| Модель                   | Бесплатная | Описание           |
| ------------------------ | ---------- | ------------------ |
| `zai-org/GLM-4.7`        | Нет        | Основная           |
| `zai-org/GLM-4.7-FlashX` | Нет        | Средняя            |
| `zai-org/GLM-4.7-Flash`  | Да         | Быстрая/бесплатная |
| `Qwen/Qwen3-Coder-480B`  | Нет        | Для кода           |
| `openai/gpt-oss-120b`    | Нет        | GPT OSS            |

---

## Шаг 6: Запуск gateway

```bash
pnpm openclaw gateway --force
```

> **Из Claude Code / Codespace:** обязательно снимите переменную `CLAUDECODE`, иначе gateway будет убит как "вложенная сессия":
>
> ```bash
> env -u CLAUDECODE pnpm openclaw gateway --force &
> ```

Подождите ~8 секунд и проверьте:

```bash
pnpm openclaw health
```

Ожидаемый вывод:

```
Telegram: ok (@your_bot) (300ms)
Agents: main (default)
```

---

## Шаг 7: Подключение AI Fabric агентов

Из Telegram отправьте боту команды:

```
/status_agents     — проверить статус агентов/MCP в облаке
/agents_on         — подключить MCP серверы и агентов к Claude CLI
/new               — сбросить сессию (обязательно после /agents_on)
```

После `/agents_on` бот напишет:

```
AI Fabric connected:
  ✓ 2 MCP servers synced to Claude CLI
  ✓ 1 skill generated

Send /new to start a fresh session with the new agents.
```

Для отключения:

```
/agents_off        — отключить MCP серверы и агентов
/new               — сбросить сессию
```

---

## Проверка полного цикла

| Шаг | Команда / Действие                  | Ожидаемый результат                 |
| --- | ----------------------------------- | ----------------------------------- |
| 1   | `curl http://127.0.0.1:8082/health` | `{"status":"ok"}`                   |
| 2   | `pnpm openclaw health`              | `Telegram: ok (@bot)`               |
| 3   | `/status_agents` в Telegram         | Список агентов и MCP серверов       |
| 4   | `/agents_on` в Telegram             | "AI Fabric connected: ..."          |
| 5   | `/new` в Telegram                   | Новая сессия                        |
| 6   | Вопрос про погоду                   | Ответ через MCP `get_today_weather` |
| 7   | `/agents_off` → `/new`              | MCP отключены, агенты недоступны    |

---

## Диагностика

### Логи

```bash
# Живой поток логов
pnpm openclaw logs --follow

# Или напрямую
tail -f /tmp/openclaw/openclaw-*.log
```

### Команда doctor

```bash
pnpm openclaw doctor        # диагностика
pnpm openclaw doctor --fix  # автоисправление
```

### Статус каналов

```bash
pnpm openclaw channels status --probe
```

### Типичные ошибки

| Ошибка                                | Причина                         | Решение                                                         |
| ------------------------------------- | ------------------------------- | --------------------------------------------------------------- |
| `nested session detected`             | Запуск из Claude Code           | `env -u CLAUDECODE pnpm openclaw gateway --force`               |
| `ECONNREFUSED 127.0.0.1:8082`         | Прокси не запущен               | `docker compose -f docker-compose.cloudru-proxy.yml up -d`      |
| `IAM token exchange failed`           | Нет `CLOUDRU_IAM_SECRET`        | Экспортируйте переменную и перезапустите gateway                |
| `Telegram probe failed: Unauthorized` | Неверный бот-токен              | Проверьте токен в @BotFather                                    |
| MCP tools не вызываются               | Нет permissions в settings.json | `/agents_off` → `/agents_on` → `/new` (перезапишет permissions) |

---

## Порядок остановки

```bash
# 1. Остановить gateway
pnpm openclaw gateway stop
# или: kill $(pgrep -f openclaw-gatewa)

# 2. Остановить прокси
docker compose -f ~/.openclaw/workspace/docker-compose.cloudru-proxy.yml down
```

---

## Полная карта файлов

```
~/.openclaw/
├── openclaw.json                          # Основной конфиг
├── workspace/
│   ├── .env                               # CLOUDRU_API_KEY (права 0600)
│   ├── docker-compose.cloudru-proxy.yml   # Docker Compose для прокси
│   ├── .claude/
│   │   ├── settings.json                  # MCP серверы + permissions
│   │   └── commands/                      # Синхронизированные skill-команды
│   └── skills/
│       └── fabric-*/SKILL.md              # Сгенерированные AI Fabric скиллы
/tmp/openclaw/
└── openclaw-YYYY-MM-DD.log               # Логи gateway
```
