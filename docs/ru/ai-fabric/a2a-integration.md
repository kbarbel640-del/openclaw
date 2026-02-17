# A2A-интеграция с Cloud.ru AI Agents

## Обзор

OpenClaw поддерживает A2A (Agent-to-Agent) протокол для взаимодействия с AI-агентами Cloud.ru AI Fabric. Это позволяет пользователям Telegram, MAX и других каналов отправлять запросы к Cloud.ru агентам через slash-команду `/ask-agent`.

## Архитектура

```
Пользователь (Telegram/MAX)
  → OpenClaw Gateway
    → CloudruA2AClient
      → IAM Token Exchange (keyId + secret → Bearer token)
      → A2A JSON-RPC (tasks/send)
        → Cloud.ru AI Agent
      ← Ответ агента
    ← Форматированный ответ
  ← Сообщение в чат
```

## Настройка

### 1. Получите IAM-ключ

В консоли Cloud.ru создайте сервисный аккаунт и получите:

- **Key ID** — идентификатор ключа
- **Secret** — секрет ключа

### 2. Настройте `.env`

Добавьте секрет IAM в файл `.env`:

```env
CLOUDRU_IAM_SECRET=your-iam-secret-here
```

### 3. Настройте `openclaw.json`

В секции `aiFabric` добавьте `keyId` и список агентов:

```json
{
  "aiFabric": {
    "enabled": true,
    "projectId": "proj-xxxx-xxxx",
    "keyId": "key-xxxx-xxxx",
    "agents": [
      {
        "id": "agent-123",
        "name": "code-reviewer",
        "endpoint": "https://ai-agents.api.cloud.ru/a2a/agent-123"
      },
      {
        "id": "agent-456",
        "name": "data-analyst",
        "endpoint": "https://ai-agents.api.cloud.ru/a2a/agent-456"
      }
    ]
  }
}
```

Альтернативно, запустите мастер настройки:

```bash
pnpm openclaw onboard
```

и выберите "Connect Cloud.ru AI Fabric" на этапе настройки.

### 4. Используйте `/ask-agent`

В Telegram или другом канале:

```
/ask-agent code-reviewer Проверь эту функцию на баги
/ask-agent data-analyst Какие тренды в продажах за последний месяц?
```

## IAM-аутентификация

Cloud.ru AI Agents API использует IAM-токены для авторизации. OpenClaw автоматически:

1. Обменивает `keyId` + `secret` на Bearer-токен через `POST https://iam.api.cloud.ru/api/v1/auth/token`
2. Кэширует токен до истечения срока действия
3. Обновляет токен за 5 минут до истечения
4. Дедуплицирует параллельные запросы обмена

Секрет (`CLOUDRU_IAM_SECRET`) хранится **только** в `.env`, который добавлен в `.gitignore`.

## MCP-серверы

При настройке AI Fabric OpenClaw автоматически обнаруживает MCP-серверы в вашем проекте Cloud.ru и генерирует конфигурацию для claude-cli. Это позволяет Claude Code использовать инструменты, размещённые на Cloud.ru.

## Устранение неполадок

### IAM auth failed (401)

- Проверьте `keyId` в `openclaw.json`
- Проверьте `CLOUDRU_IAM_SECRET` в `.env`
- Убедитесь, что сервисный аккаунт имеет роль `ai-agents.editor` в проекте

### Agent not responding (timeout)

- Агент может быть в состоянии `SUSPENDED` или `COOLED` — первый запрос может вызвать cold start
- Увеличьте таймаут в конфигурации агента на Cloud.ru
- Проверьте статус агента: `GET /api/v1/{projectId}/agents/{agentId}`

### No MCP servers found

- Убедитесь, что MCP-серверы созданы в вашем проекте на консоли Cloud.ru
- Проверьте, что сервисный аккаунт имеет доступ к проекту
- MCP-серверы должны быть в статусе `RUNNING` или `AVAILABLE`
