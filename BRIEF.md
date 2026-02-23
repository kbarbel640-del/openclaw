# PR: Add `openclaw session reset` CLI command

## Goal
Allow programmatic session reset from CLI, so agents can trigger /new without user interaction.

## Context
- `/new` and `/reset` are intercepted at the gateway transport layer
- The gateway exposes a WebSocket RPC: `sessions.reset` with `{key: string, reason?: "new" | "reset"}`
- The client method is in `src/tui/gateway-chat.ts`: `async resetSession(key, reason)`
- Current `sessions` command is in `src/commands/sessions.ts` — it only lists sessions
- The `session-memory` hook fires on `command:new` event

## What to implement
1. Add a new CLI subcommand: `openclaw session reset [session-key]`
   - `--session-key <key>` or positional arg: target session (default: "agent:main:main")
   - `--reason <new|reset>`: reason for reset (default: "new")
   - Connects to gateway WebSocket and calls `sessions.reset`
   - Triggers the same hooks as `/new` (command:new event)

2. The implementation should:
   - Reuse `resolveGatewayConnection` from `src/tui/gateway-chat.ts`
   - Create a GatewayChatClient, call resetSession, close connection
   - Handle errors (gateway not running, session not found)
   - Output JSON with `--json` flag

## Key files
- `src/commands/sessions.ts` — existing sessions list command
- `src/tui/gateway-chat.ts` — has resetSession method
- `src/config/sessions/types.ts` — DEFAULT_RESET_TRIGGERS
- `src/tui/tui-command-handlers.ts` — example usage of resetSession

## Testing
- Add a basic test in `src/commands/sessions.test.ts` or new file

## PR title
feat(cli): add `openclaw session reset` command for programmatic session management
