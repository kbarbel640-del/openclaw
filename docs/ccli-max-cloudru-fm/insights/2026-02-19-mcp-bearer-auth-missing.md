# MCP серверы AI Fabric не аутентифицируются в Claude CLI

**Дата:** 2026-02-19
**Компонент:** `src/ai-fabric/sync-fabric-resources.ts`, `src/commands/write-mcp-config.ts`

## Симптомы

- `openclaw fabric sync` генерирует MCP серверы в `.claude/settings.json`, но Claude CLI не может к ним подключиться
- MCP endpoints Cloud.ru возвращают `401 Unauthorized`
- При этом `openclaw fabric ask` работает нормально (использует A2A клиент с собственным IAM token exchange)

## Суть проблемы

Sync orchestrator записывал MCP серверы в `.claude/settings.json` только с `url` и `transport: "sse"`, без заголовка `Authorization`. Claude CLI при подключении к SSE endpoint отправлял запрос без Bearer токена, и Cloud.ru API отклонял его.

Onboarding wizard (`setup-ai-fabric.ts`) добавлял `--mcp-config` аргументы в CLI backend, но sync orchestrator этот шаг пропускал. Комментарий в `write-mcp-config.ts` утверждал, что "Bearer token is injected via env var in the CLI backend config", но этот механизм никогда не был реализован — env var не передавался.

## Решение

1. **Расширили `McpConfigEntry`** — добавили опциональное поле `headers?: Record<string, string>` для передачи HTTP заголовков

2. **`buildMcpConfig()` принимает Bearer token:**

   ```ts
   buildMcpConfig(servers, { bearerToken });
   // → { url, transport: "sse", headers: { Authorization: "Bearer ..." } }
   ```

3. **Sync orchestrator получает IAM токен перед записью MCP:**

   ```ts
   const tokenProvider = new CloudruTokenProvider(auth);
   const resolved = await tokenProvider.getToken();
   const mcpConfig = buildMcpConfig(mcpServers, { bearerToken: resolved.token });
   ```

4. Токен обновляется при каждом вызове sync (gateway startup, `/status_agents`, `openclaw fabric sync`). Время жизни токена ~1 час — при длительном бездействии нужен повторный sync.

## Ключевые файлы

- `src/commands/write-mcp-config.ts` — `McpConfigEntry.headers`, `buildMcpConfig(servers, { bearerToken })`
- `src/ai-fabric/sync-fabric-resources.ts` — `CloudruTokenProvider` для получения Bearer token перед MCP sync
- `src/ai-fabric/cloudru-auth.ts` — IAM token exchange (keyId + secret → Bearer token)
