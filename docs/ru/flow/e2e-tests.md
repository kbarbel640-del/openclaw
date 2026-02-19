# E2E тесты: проверка через Telegram

Ручные E2E сценарии для проверки полного стека OpenClaw через Telegram бота.

> Предусловия: см. [prerequisites.md](./prerequisites.md)

## Тест 1: FM models через proxy (happy path)

**Цель:** Проверить, что сообщения проходят через весь стек: Telegram → Gateway → claude-cli → Cloud.ru FM Proxy → Foundation Models API.

**Шаги:**

1. Убедиться, что proxy запущен:

   ```bash
   pnpm openclaw proxy-status
   # или: docker compose -f ~/.openclaw/docker-compose.cloudru-fm.yml ps
   ```

2. Отправить в Telegram бот простое сообщение:

   ```
   Привет! Расскажи кратко, что ты умеешь.
   ```

3. Дождаться ответа (до 60 секунд, возможен cold start).

**Ожидаемый результат:**

- Бот отвечает осмысленным текстом
- В логах gateway видно маршрутизацию через `claude-cli` провайдер
- В логах proxy видно обращение к Foundation Models API

**Проверка логов:**

```bash
# Gateway логи (dev mode)
pnpm gateway:dev --claude-cli-logs

# Proxy логи
docker compose -f ~/.openclaw/docker-compose.cloudru-fm.yml logs -f
```

**Если не работает:**

- Proxy не запущен → `docker compose -f ~/.openclaw/docker-compose.cloudru-fm.yml up -d`
- Ошибка 401 от FM API → проверить `CLOUDRU_FM_API_KEY` в `.env`
- Timeout → проверить сетевое подключение к `api.cloud.ru`

---

## Тест 2: Статус AI Fabric агентов (`/status-agents`)

**Цель:** Проверить, что skill `/status-agents` корректно получает статус агентов из Cloud.ru API.

**Шаги:**

1. Убедиться, что AI Fabric настроен:

   ```bash
   cat ~/.openclaw/openclaw.json | grep -A5 '"aiFabric"'
   ```

2. Отправить в Telegram:

   ```
   /status-agents
   ```

3. Для конкретного агента:
   ```
   /status-agents code-reviewer
   ```

**Ожидаемый результат:**

- Таблица со статусом всех агентов (name, status, health, configured, drift)
- Summary строка: `N agents — X healthy, Y degraded, Z failed`
- При фильтре по имени — детальная карточка одного агента

**Если не работает:**

- "AI Fabric is not enabled" → добавить `aiFabric.enabled: true` в `openclaw.json`
- "Authentication failed" → проверить `aiFabric.keyId` и `CLOUDRU_IAM_SECRET`
- "Network error" → проверить доступность `https://api.cloud.ru`

---

## Тест 3: Отправка сообщения AI Fabric агенту (`/ask-agent`)

**Цель:** Проверить полный A2A flow: resolve агента → IAM auth → JSON-RPC `tasks/send` → отображение ответа.

**Шаги:**

1. Убедиться, что есть хотя бы один агент в конфиге:

   ```bash
   cat ~/.openclaw/openclaw.json | grep -A10 '"agents"'
   ```

2. Отправить в Telegram (точное имя агента):

   ```
   /ask-agent code-reviewer Проверь этот код на баги: function add(a,b) { return a - b; }
   ```

3. Проверить частичный матч:

   ```
   /ask-agent code Проверь код
   ```

4. Проверить несуществующий агент:
   ```
   /ask-agent nonexistent-agent hello
   ```

**Ожидаемый результат:**

- (шаг 2) Ответ агента с заголовком `Agent: code-reviewer`, текстом, taskId и sessionId
- (шаг 3) Если один матч — ответ агента. Если несколько — список для disambiguation
- (шаг 4) Сообщение "Agent not found" со списком доступных агентов

**Проверки в ответе:**

- [ ] Имя агента отображается
- [ ] Текст ответа осмысленный
- [ ] taskId присутствует
- [ ] sessionId присутствует (или "n/a")

---

## Тест 4: MCP инструменты

**Цель:** Проверить, что claude-cli загружает MCP tools и может их вызывать.

**Предусловия:**

- `aiFabric.mcpConfigPath` указан в `openclaw.json`
- MCP сервер настроен при onboarding

**Шаги:**

1. Проверить наличие MCP конфига:

   ```bash
   cat $(cat ~/.openclaw/openclaw.json | jq -r '.aiFabric.mcpConfigPath // empty')
   ```

2. Отправить в Telegram запрос, который должен вызвать MCP tool:
   ```
   Используй инструмент для получения информации о проекте
   ```

**Ожидаемый результат:**

- claude-cli обнаруживает доступные MCP tools
- При необходимости вызывает tool и включает результат в ответ

**Если не работает:**

- MCP config не найден → запустить `openclaw onboard` заново
- MCP сервер не отвечает → проверить, что сервер запущен

---

## Тест 5: Error paths

### 5a. Ошибка аутентификации

**Шаги:**

1. Временно установить неверный `CLOUDRU_IAM_SECRET` в `.env`:

   ```bash
   # Сохранить текущий
   cp ~/.openclaw/.env ~/.openclaw/.env.bak
   # Установить неверный
   sed -i 's/CLOUDRU_IAM_SECRET=.*/CLOUDRU_IAM_SECRET=invalid/' ~/.openclaw/.env
   ```

2. Отправить в Telegram:

   ```
   /ask-agent code-reviewer hello
   ```

3. Восстановить:
   ```bash
   cp ~/.openclaw/.env.bak ~/.openclaw/.env
   ```

**Ожидаемый результат:**

- Сообщение об ошибке аутентификации с рекомендацией проверить credentials

### 5b. Агент не найден

**Шаги:**

1. Отправить в Telegram:
   ```
   /ask-agent definitely-nonexistent-agent hello
   ```

**Ожидаемый результат:**

- "Agent not found" со списком доступных агентов

### 5c. Proxy не запущен

**Шаги:**

1. Остановить proxy:

   ```bash
   docker compose -f ~/.openclaw/docker-compose.cloudru-fm.yml down
   ```

2. Отправить в Telegram обычное сообщение:

   ```
   Привет!
   ```

3. Запустить proxy обратно:
   ```bash
   docker compose -f ~/.openclaw/docker-compose.cloudru-fm.yml up -d
   ```

**Ожидаемый результат:**

- Сообщение об ошибке подключения или timeout
- После перезапуска proxy — нормальная работа

---

## Чеклист прохождения

| #   | Тест                           | Статус |
| --- | ------------------------------ | ------ |
| 1   | FM models через proxy          | [ ]    |
| 2   | `/status-agents`               | [ ]    |
| 3a  | `/ask-agent` (exact match)     | [ ]    |
| 3b  | `/ask-agent` (substring match) | [ ]    |
| 3c  | `/ask-agent` (not found)       | [ ]    |
| 4   | MCP tools                      | [ ]    |
| 5a  | Auth error                     | [ ]    |
| 5b  | Agent not found                | [ ]    |
| 5c  | Proxy down                     | [ ]    |
