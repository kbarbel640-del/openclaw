# Gateway

The gateway is Moltbot's core server process that:

- Manages WebSocket connections from clients (Control UI, mobile apps, desktop nodes)
- Routes messages between channels and AI agents
- Handles authentication, rate limiting, and session management
- Provides HTTP endpoints for OpenAI-compatible APIs

## Key Files

| File | Purpose |
|------|---------|
| `server.ts` | Entry point, starts HTTP/WS server |
| `server.impl.ts` | Main server implementation and wiring |
| `server-channels.ts` | Channel lifecycle management |
| `server-close.ts` | Graceful shutdown handler |
| `server-methods/` | RPC method handlers (chat, sessions, config, etc.) |
| `protocol/` | TypeScript schemas for gateway protocol |
| `client.ts` | Gateway client for connecting to remote gateways |
| `auth.ts` | Authentication resolution |

## Architecture

```
Client (WS) -> Gateway -> Channel Plugin -> External Service
                |
                v
            AI Agent -> LLM Provider
```

## Configuration

Gateway config lives in `~/.clawdbot/moltbot.json`. Key sections:

- `gateway.bind` - Network binding (localhost, loopback, lan, tailscale)
- `gateway.port` - Server port (default: 18789)
- `gateway.auth` - Authentication settings
- `agents` - Agent definitions and tool permissions

## See Also

- `src/channels/` - Channel plugin implementations
- `src/agents/` - AI agent runner
- `docs/gateway/` - User documentation
