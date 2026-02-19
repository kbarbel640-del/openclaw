# Предусловия для E2E тестирования

Что нужно настроить перед запуском E2E тестов через Telegram.

## 1. Telegram бот

### Создание бота

1. Создать бота через [@BotFather](https://t.me/BotFather)
2. Получить `BOT_TOKEN`

### Конфигурация в `openclaw.json`

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "BOT_TOKEN_HERE",
      "allowedUsers": [123456789]
    }
  }
}
```

- `allowedUsers` — массив Telegram user IDs, которым разрешено общаться с ботом
- Узнать свой ID: отправить любое сообщение боту [@userinfobot](https://t.me/userinfobot)

## 2. Cloud.ru FM Proxy

### Переменные окружения (`.env`)

```bash
# ~/.openclaw/.env
CLOUDRU_FM_API_KEY=your-foundation-models-api-key
```

### Docker Compose

Файл `~/.openclaw/docker-compose.cloudru-fm.yml` генерируется автоматически при onboarding:

```bash
pnpm openclaw onboard
# Выбрать "Cloud.ru Foundation Models"
```

### Запуск proxy

```bash
docker compose -f ~/.openclaw/docker-compose.cloudru-fm.yml up -d
```

### Проверка

```bash
pnpm openclaw proxy-status
# или
curl http://localhost:18082/health
```

## 3. AI Fabric (для тестов 2-4)

### Конфигурация

В `openclaw.json` добавить секцию `aiFabric`:

```json
{
  "aiFabric": {
    "enabled": true,
    "projectId": "proj-xxxx",
    "keyId": "key-xxxx",
    "agents": [
      {
        "id": "agent-123",
        "name": "code-reviewer",
        "endpoint": "https://ai-agents.api.cloud.ru/a2a/agent-123"
      }
    ]
  }
}
```

### Переменные окружения

```bash
# ~/.openclaw/.env (добавить к существующим)
CLOUDRU_IAM_SECRET=your-iam-secret-key
```

### Где взять credentials

| Параметр                | Где получить                                           |
| ----------------------- | ------------------------------------------------------ |
| `projectId`             | Cloud.ru Console → AI Fabric → ваш проект              |
| `keyId`                 | Cloud.ru Console → IAM → Service accounts → Keys       |
| `CLOUDRU_IAM_SECRET`    | Генерируется при создании ключа (сохраните сразу!)     |
| Agent `id` и `endpoint` | Cloud.ru Console → AI Fabric → Agents → выбрать агента |

### Автоматическое обнаружение агентов

Вместо ручного добавления можно использовать onboarding wizard:

```bash
pnpm openclaw onboard
# Выбрать "Cloud.ru AI Fabric"
# Wizard автоматически обнаружит доступных агентов
```

## 4. Gateway

### Dev mode

```bash
pnpm gateway:dev
```

- Порт: 19001
- Конфиг: `~/.openclaw-dev/openclaw.json`
- Логи claude-cli: `pnpm gateway:dev --claude-cli-logs`

### Production mode

```bash
pnpm gateway
```

- Порт: 18789
- Конфиг: `~/.openclaw/openclaw.json`

## 5. Модель в конфиге

Для работы через Cloud.ru FM Proxy нужно указать модель:

```json
{
  "agents": {
    "defaults": {
      "defaultModel": "claude-cli/qwen3-coder-32b",
      "cliBackends": {
        "claude-cli": {
          "apiBase": "http://localhost:18082"
        }
      }
    }
  }
}
```

Доступные модели (см. `src/config/cloudru-fm.constants.ts`):

- `qwen3-coder-32b`
- `gpt-oss-120b`

## Быстрый старт

```bash
# 1. Установить зависимости
pnpm install

# 2. Запустить onboarding (настроит proxy, AI Fabric, Telegram)
pnpm openclaw onboard

# 3. Запустить proxy
docker compose -f ~/.openclaw/docker-compose.cloudru-fm.yml up -d

# 4. Запустить gateway
pnpm gateway:dev

# 5. Отправить сообщение боту в Telegram
```
