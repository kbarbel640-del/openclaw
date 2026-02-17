# ADR-009: Cloud.ru A2A Integration + MCP IAM Auth Fix

| Field      | Value                                        |
| ---------- | -------------------------------------------- |
| Status     | ACCEPTED                                     |
| Date       | 2026-02-17                                   |
| Depends on | ADR-008 (Cloud.ru AI Fabric Bounded Context) |

## Context

Two problems blocked Telegram-bot users from accessing Cloud.ru AI Fabric resources:

1. **IAM auth broken in `CloudruSimpleClient`**: The simple client used raw API keys as Bearer tokens. Cloud.ru AI Agents API requires IAM-exchanged tokens (keyId + secret → JWT). MCP server discovery returned 401/403.
2. **A2A integration missing**: No way to communicate with Cloud.ru AI Agents from OpenClaw channels (Telegram, MAX, etc.).

## Decision

### Bounded Context: `ai-fabric` (extended)

Extends ADR-008 with two new aggregates and fixes to two existing ones.

### Aggregates

| Aggregate      | Root Entity       | Change                                              |
| -------------- | ----------------- | --------------------------------------------------- |
| `CloudruAuth`  | `ResolvedToken`   | **FIX**: `CloudruSimpleClient` → IAM token exchange |
| `McpDiscovery` | `McpServer`       | **FIX**: Passes IAM token, not raw API key          |
| `A2AClient`    | `A2ATaskResponse` | **NEW**: A2A protocol client for agent messaging    |
| `A2AConfig`    | `AiFabricConfig`  | **EXTEND**: `keyId`, `agents[]` in config           |

### CloudruSimpleClient IAM Fix

**Before**: `CloudruSimpleClient` accepted `apiKey: string` and sent it directly as `Authorization: Bearer <apiKey>`.

**After**: `CloudruSimpleClient` accepts `auth: CloudruAuthConfig` (keyId + secret) and uses `CloudruTokenProvider` for IAM token exchange with automatic caching and refresh.

This aligns `CloudruSimpleClient` with `CloudruClient` in auth approach, while keeping the simpler single-method interface for wizard flows.

### A2A Client

New module `cloudru-a2a-client.ts` implements A2A (Agent-to-Agent) communication:

- Uses JSON-RPC 2.0 with `tasks/send` method per A2A spec
- Authenticates via `CloudruTokenProvider` (IAM tokens)
- Extracts text from response status message or artifacts
- Supports multi-turn conversations via `sessionId`
- Standalone module — only imports from `ai-fabric/` and `infra/`

### Config Extension

`AiFabricConfig` gains two new optional fields:

```typescript
type AiFabricConfig = {
  enabled?: boolean;
  projectId?: string;
  keyId?: string; // NEW: IAM key ID (secret in .env)
  mcpConfigPath?: string;
  agents?: Array<{
    // NEW: A2A agent endpoints
    id: string;
    name: string;
    endpoint: string;
  }>;
};
```

### Wizard Flow Change

The onboarding wizard now:

1. Collects `CLOUDRU_API_KEY` for the FM proxy (unchanged)
2. Asks if user wants AI Fabric integration
3. If yes, collects IAM `keyId` and `secret` separately
4. Uses IAM auth for MCP server discovery
5. Stores `keyId` in config, `secret` in `.env` as `CLOUDRU_IAM_SECRET`

### Security

- IAM secret stored in `.env` only, never in `openclaw.json`
- `.env` is in `.gitignore`
- IAM token cached with auto-refresh at `expiresAt - 5min`
- `keyId` stored in config (not sensitive — only identifies the key, not the secret)

### Module Structure (additions)

```
src/ai-fabric/
  cloudru-a2a-client.ts       — NEW: A2A protocol client
  cloudru-a2a-client.test.ts  — NEW: Unit tests
  cloudru-client-simple.ts    — CHANGED: IAM auth instead of raw API key
```

### Skill

New skill `skills/ask-agent/` provides `/ask-agent` slash command for Telegram/channel users to query Cloud.ru AI Agents.

## Consequences

- MCP server discovery now works with proper IAM authentication
- Users can communicate with Cloud.ru AI Agents via A2A from any OpenClaw channel
- The A2A client is standalone and extractable to `@openclaw/ai-fabric`
- Breaking change: `CloudruSimpleClient` config no longer accepts `apiKey`; callers must provide `auth: { keyId, secret }`
- SSE streaming for A2A is deferred — this ADR covers request-response only
- Agent auto-discovery from Cloud.ru is deferred — agents are manually configured
