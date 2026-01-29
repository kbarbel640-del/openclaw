# CLI

Moltbot command-line interface implementation. The CLI provides commands for:

- Managing the gateway daemon
- Configuring agents and channels
- Sending messages and interacting with sessions
- Browser automation
- Node management

## Entry Point

The main program is built in `program.ts` using Commander.js. Run with:

```bash
moltbot --help
moltbot <command> --help
```

## Key Files

| File | Purpose |
|------|---------|
| `program.ts` | Main CLI program builder |
| `run-main.ts` | Entry point and error handling |
| `deps.ts` | Dependency injection for testability |
| `gateway-cli.ts` | Gateway commands (run, status) |
| `channels-cli.ts` | Channel commands (status, start, stop) |
| `config-cli.ts` | Config commands (get, set, unset) |

## Command Modules

| Module | Commands |
|--------|----------|
| `daemon-cli/` | `daemon start/stop/status/install` |
| `browser-cli*.ts` | `browser navigate/click/type/screenshot` |
| `nodes-cli/` | `nodes list/status/invoke/camera/screen` |
| `cron-cli.ts` | `cron list/run/enable/disable` |
| `program/message/` | `message send/read/edit/delete` |

## Patterns

### Progress Indicators

Use `src/cli/progress.ts` for spinners and progress bars:

```typescript
import { withSpinner } from "./progress.js";
await withSpinner("Loading...", async () => { /* work */ });
```

### Gateway RPC

Most commands communicate with the gateway via WebSocket RPC:

```typescript
import { createGatewayClient } from "../gateway/client.js";
const client = await createGatewayClient({ port });
const result = await client.call("method.name", params);
```

## See Also

- `src/gateway/` - Gateway server implementation
- `docs/cli/` - User documentation
- `src/terminal/` - Terminal formatting utilities
