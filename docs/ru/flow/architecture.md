# Архитектура: E2E message flow

Полная схема обработки сообщений от Telegram до Foundation Models и AI Fabric агентов.

## Основной flow

```
Telegram Bot API
  │
  ▼
extensions/telegram/src/channel.ts    ← Telegram channel adapter
  │
  ▼
src/auto-reply/reply/agent-runner.ts  ← Agent Runner (маршрутизация по провайдеру)
  │
  ├─► HTTP-провайдеры (Anthropic, OpenAI, Gemini, ...)
  │     прямой вызов API
  │
  └─► claude-cli провайдер
        │
        ▼
      src/agents/claude-cli-runner.ts  ← запуск claude subprocess
        │
        ├─► Cloud.ru FM Proxy (Docker)
        │     legard/claude-code-proxy:latest
        │     localhost:18082 → Foundation Models API
        │     (GLM-4.7, Qwen3-Coder, gpt-oss-120b)
        │
        ├─► Skills (skills/*/SKILL.md)
        │     /ask-agent  → A2A вызов к AI Fabric агентам
        │     /status-agents → проверка статуса агентов
        │
        └─► MCP Tools (если настроены)
              claude-cli загружает MCP config
              из aiFabric.mcpConfigPath
```

## Компоненты

### 1. Telegram Channel

| Файл                                 | Назначение                                          |
| ------------------------------------ | --------------------------------------------------- |
| `extensions/telegram/index.ts`       | Точка входа расширения                              |
| `extensions/telegram/src/channel.ts` | Адаптер канала: webhook, polling, обработка updates |
| `extensions/telegram/src/runtime.ts` | Runtime конфигурация                                |

### 2. Gateway

| Файл                                             | Назначение                                         |
| ------------------------------------------------ | -------------------------------------------------- |
| `src/cli/gateway-cli/run.ts`                     | Запуск gateway (dev: порт 19001, prod: порт 18789) |
| `src/auto-reply/reply/agent-runner.ts`           | Главный agent runner — маршрутизация сообщений     |
| `src/auto-reply/reply/agent-runner-execution.ts` | Исполнение turn с fallback                         |
| `src/auto-reply/reply/agent-runner-payloads.ts`  | Формирование payload для провайдеров               |

### 3. Claude CLI Backend

| Файл                              | Назначение                             |
| --------------------------------- | -------------------------------------- |
| `src/agents/claude-cli-runner.ts` | Запуск claude как subprocess           |
| `src/agents/cli-backends.ts`      | Резолв CLI backend (claude-cli, proxy) |
| `src/agents/cli-credentials.ts`   | Управление credentials для CLI         |
| `src/agents/model-selection.ts`   | Выбор модели и провайдера              |

### 4. Cloud.ru FM Proxy

| Файл                                           | Назначение                                    |
| ---------------------------------------------- | --------------------------------------------- |
| `src/config/cloudru-fm.constants.ts`           | Образ, порт, модели (SSoT)                    |
| `src/agents/cloudru-proxy-template.ts`         | Генерация docker-compose.yml                  |
| `src/agents/cloudru-proxy-health.ts`           | Health check прокси                           |
| `src/commands/onboard-cloudru-fm.ts`           | Onboarding (Docker Compose, .env, .gitignore) |
| `src/commands/auth-choice.apply.cloudru-fm.ts` | Wizard выбора аутентификации                  |

### 5. AI Fabric (A2A агенты)

| Файл                                  | Назначение                                         |
| ------------------------------------- | -------------------------------------------------- |
| `src/ai-fabric/cloudru-a2a-client.ts` | A2A клиент (JSON-RPC `tasks/send`)                 |
| `src/ai-fabric/cloudru-auth.ts`       | IAM аутентификация (keyId + secret → Bearer token) |
| `src/ai-fabric/agent-status.ts`       | Получение статуса агентов                          |
| `src/config/types.ai-fabric.ts`       | Типы: `AiFabricConfig`, `AiFabricAgentEntry`       |
| `skills/ask-agent/SKILL.md`           | Skill для отправки сообщений агентам               |
| `skills/status-agents/SKILL.md`       | Skill для проверки статуса агентов                 |

### 6. Конфигурация

| Файл                            | Назначение                              |
| ------------------------------- | --------------------------------------- |
| `src/config/io.ts`              | `loadConfig()` — чтение `openclaw.json` |
| `~/.openclaw/openclaw.json`     | Продакшен конфиг                        |
| `~/.openclaw-dev/openclaw.json` | Dev конфиг (gateway:dev)                |

## Ветка AI Fabric Agents

```
Пользователь в Telegram
  │
  │  "Спроси code-reviewer про этот баг"
  ▼
Gateway → Agent Runner → claude-cli
  │
  │  claude-cli видит skill /ask-agent
  ▼
skills/ask-agent/SKILL.md
  │
  │  loadConfig() → aiFabric.agents[]
  │  resolve agent по имени
  ▼
CloudruA2AClient.sendMessage()
  │
  │  IAM token exchange (keyId + secret)
  │  POST {endpoint} → JSON-RPC tasks/send
  ▼
Cloud.ru AI Fabric Agent
  │
  │  A2A response (taskId, sessionId, text)
  ▼
Ответ пользователю в Telegram
```

## Ветка MCP Tools

```
claude-cli
  │
  │  загружает MCP config из aiFabric.mcpConfigPath
  ▼
MCP Server (настроен при onboarding)
  │
  │  tool calls через MCP протокол
  ▼
Cloud.ru AI Fabric API
```
