# TUI Module (`src/tui`)

Terminal UI for OpenClaw — a real-time chat interface that connects to the Gateway via WebSocket.

## Overview

The TUI module provides an interactive terminal-based chat client for the OpenClaw Gateway. It renders a full-screen interface with a chat log, input editor, status bar, and overlay pickers (models, agents, sessions, settings). It supports streaming responses, tool-call visualization, slash commands, local shell execution, and multi-agent/multi-session workflows.

**Why it exists:** Operators need a fast, keyboard-driven way to interact with the Gateway from any terminal — local or remote — without a browser. The TUI serves as the primary developer/operator chat surface and is invoked via `openclaw tui`.

## Architecture

```
tui.ts                    ← Entry point: wires components, layout, lifecycle
├── gateway-chat.ts       ← WebSocket client wrapping GatewayClient
├── tui-types.ts          ← Shared types (TuiOptions, TuiStateAccess, events)
├── tui-event-handlers.ts ← Handles chat + agent SSE events from Gateway
├── tui-command-handlers.ts ← Slash command dispatch + message sending
├── tui-session-actions.ts ← Session/agent CRUD (load history, switch, reset)
├── tui-overlays.ts       ← Overlay open/close helpers
├── tui-local-shell.ts    ← `!command` local shell execution (gated)
├── tui-stream-assembler.ts ← Assembles streamed deltas into display text
├── tui-status-summary.ts ← Formats `/status` gateway summary
├── tui-waiting.ts        ← Animated waiting phrases + shimmer effect
├── tui-formatters.ts     ← Text extraction, sanitization, token formatting
├── commands.ts           ← Slash command definitions + help text
├── theme/                ← Color palette, markdown theme, editor theme
└── components/           ← UI components (ChatLog, CustomEditor, selectors)
```

## API

### `startTui(opts: TuiOptions): Promise<void>`

Main entry point. Connects to the Gateway, sets up the full-screen TUI, and blocks until exit.

```ts
import { startTui } from "./tui.js";

await startTui({
  url: "ws://127.0.0.1:18789",
  token: "my-gateway-token",
  session: "main",
  deliver: false,
  thinking: "low",
});
```

### `TuiOptions`

```ts
type TuiOptions = {
  url?: string; // Gateway WebSocket URL (default: from config)
  token?: string; // Gateway auth token
  password?: string; // Gateway password auth
  session?: string; // Initial session key (default: "main" or "global")
  deliver?: boolean; // Deliver replies to provider (default: false)
  thinking?: string; // Thinking level override for sends
  timeoutMs?: number; // Agent timeout in milliseconds
  historyLimit?: number; // Messages to load on connect (default: 200)
  message?: string; // Auto-send message on connect (then interactive)
};
```

### `GatewayChatClient`

WebSocket client for Gateway communication. Wraps `GatewayClient` with typed chat/session/agent methods.

```ts
const client = new GatewayChatClient({ url, token, password });
client.onConnected = () => {
  /* ready */
};
client.onEvent = (evt) => {
  /* chat/agent events */
};
client.onDisconnected = (reason) => {
  /* handle reconnect */
};
client.start();
```

#### Methods

| Method                       | Parameters               | Returns                         | Description                               |
| ---------------------------- | ------------------------ | ------------------------------- | ----------------------------------------- |
| `start()`                    | —                        | `void`                          | Open WebSocket connection                 |
| `stop()`                     | —                        | `void`                          | Close connection                          |
| `waitForReady()`             | —                        | `Promise<void>`                 | Resolves after successful hello handshake |
| `sendChat(opts)`             | `ChatSendOptions`        | `Promise<{ runId }>`            | Send a chat message                       |
| `abortChat(opts)`            | `{ sessionKey, runId }`  | `Promise<{ ok, aborted }>`      | Abort an active run                       |
| `loadHistory(opts)`          | `{ sessionKey, limit? }` | `Promise<...>`                  | Load chat history                         |
| `listSessions(opts?)`        | `SessionsListParams`     | `Promise<GatewaySessionList>`   | List active sessions                      |
| `listAgents()`               | —                        | `Promise<GatewayAgentsList>`    | List available agents                     |
| `patchSession(opts)`         | `SessionsPatchParams`    | `Promise<SessionsPatchResult>`  | Update session settings                   |
| `resetSession(key, reason?)` | `string, "new"\|"reset"` | `Promise<...>`                  | Reset/clear a session                     |
| `getStatus()`                | —                        | `Promise<...>`                  | Gateway status summary                    |
| `listModels()`               | —                        | `Promise<GatewayModelChoice[]>` | List available models                     |

#### `ChatSendOptions`

```ts
type ChatSendOptions = {
  sessionKey: string; // Target session
  message: string; // User message text
  thinking?: string; // Thinking level override
  deliver?: boolean; // Deliver to provider
  timeoutMs?: number; // Agent timeout
  runId?: string; // Idempotency key (auto-generated if omitted)
};
```

### `TuiStreamAssembler`

Accumulates streamed chat deltas into coherent display text, handling thinking blocks, multi-block content, and boundary-drop protection.

```ts
const assembler = new TuiStreamAssembler();

// During streaming:
const text = assembler.ingestDelta(runId, message, showThinking);
if (text) updateDisplay(text);

// On final event:
const finalText = assembler.finalize(runId, message, showThinking);
updateDisplay(finalText);

// On abort/error:
assembler.drop(runId);
```

| Method                                      | Parameters                 | Returns          | Description                                                           |
| ------------------------------------------- | -------------------------- | ---------------- | --------------------------------------------------------------------- |
| `ingestDelta(runId, message, showThinking)` | `string, unknown, boolean` | `string \| null` | Ingest a streaming delta; returns updated text or `null` if unchanged |
| `finalize(runId, message, showThinking)`    | `string, unknown, boolean` | `string`         | Finalize a run, returning the resolved display text                   |
| `drop(runId)`                               | `string`                   | `void`           | Discard state for a run (abort/error cleanup)                         |

### `createEventHandlers(context)`

Factory that returns `{ handleChatEvent, handleAgentEvent }` — the two event dispatch functions wired to `client.onEvent`.

Chat events drive the streaming display (delta → update assistant → finalize). Agent events drive tool-call cards and lifecycle status (start/end/error).

### `createCommandHandlers(context)`

Factory that returns `{ handleCommand, sendMessage, openModelSelector, openAgentSelector, openSessionSelector, openSettings, setAgent }`.

`handleCommand(raw)` dispatches slash commands. Unknown commands are sent as regular messages.

### `createSessionActions(context)`

Factory returning session/agent lifecycle helpers:

| Function                            | Description                                          |
| ----------------------------------- | ---------------------------------------------------- |
| `refreshAgents()`                   | Fetch and apply the agent list from the Gateway      |
| `refreshSessionInfo()`              | Fetch current session metadata (model, tokens, etc.) |
| `loadHistory()`                     | Load and render chat history into the chat log       |
| `setSession(key)`                   | Switch to a different session (reloads history)      |
| `abortActive()`                     | Abort the currently active run                       |
| `applySessionInfoFromPatch(result)` | Update local state from a `sessions.patch` response  |

### `createLocalShellRunner(deps)`

Creates a `{ runLocalShellLine }` handler for `!command` local shell execution. Gated behind an in-session confirmation prompt. Output is capped at 40 KB.

```ts
const { runLocalShellLine } = createLocalShellRunner({
  chatLog,
  tui,
  openOverlay,
  closeOverlay,
});
await runLocalShellLine("!ls -la");
```

### `createOverlayHandlers(host, fallbackFocus)`

Returns `{ openOverlay, closeOverlay }` — simple wrappers around the pi-tui overlay API.

### Slash Commands

Defined in `commands.ts`. Available via `/help` in the TUI.

| Command                          | Description                        |
| -------------------------------- | ---------------------------------- |
| `/help`                          | Show slash command help            |
| `/status`                        | Show gateway status summary        |
| `/agent <id>`                    | Switch agent (or open picker)      |
| `/agents`                        | Open agent picker                  |
| `/session <key>`                 | Switch session (or open picker)    |
| `/sessions`                      | Open session picker                |
| `/model <provider/model>`        | Set model (or open picker)         |
| `/models`                        | Open model picker                  |
| `/think <level>`                 | Set thinking level                 |
| `/verbose <on\|off>`             | Set verbose mode                   |
| `/reasoning <on\|off>`           | Set reasoning mode                 |
| `/usage <off\|tokens\|full>`     | Toggle per-response usage line     |
| `/elevated <on\|off\|ask\|full>` | Set elevated mode (alias: `/elev`) |
| `/activation <mention\|always>`  | Set group activation               |
| `/new`, `/reset`                 | Reset the session                  |
| `/abort`                         | Abort active run                   |
| `/settings`                      | Open settings overlay              |
| `/exit`, `/quit`                 | Exit the TUI                       |

### Formatter Utilities

| Function                    | Signature                            | Description                                                     |
| --------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `extractTextFromMessage`    | `(message: unknown, opts?) → string` | Extract display text from a chat message (user/assistant/error) |
| `resolveFinalAssistantText` | `(params) → string`                  | Resolve final text, preferring streamed text when non-empty     |
| `formatTokens`              | `(total?, context?) → string`        | Format token counts for the status bar                          |
| `formatContextUsageLine`    | `(params) → string`                  | Format detailed context usage (total/context/remaining/%)       |
| `asString`                  | `(value, fallback?) → string`        | Safe coerce to string                                           |
| `isCommandMessage`          | `(message) → boolean`                | Check if a history entry is a command (not chat)                |

### Waiting Animation

```ts
import { buildWaitingStatusMessage, defaultWaitingPhrases } from "./tui-waiting.js";

const status = buildWaitingStatusMessage({
  theme, // { dim, bold, accentSoft }
  tick: 42, // Animation frame counter
  elapsed: "3s", // Elapsed time string
  connectionStatus: "connected",
});
// → "pondering…" with shimmer effect + " • 3s | connected"
```

`shimmerText(theme, text, tick)` applies a sliding highlight window across the text. `pickWaitingPhrase(tick, phrases?)` cycles through whimsical phrases every 10 ticks.

## Configuration

### Gateway Connection Resolution

Connection details resolve in this order:

1. Explicit `--url` / `--token` / `--password` CLI flags
2. Config file (`openclaw.json`): `gateway.mode`, `gateway.remote.token`, `gateway.auth.token`
3. Environment: `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_GATEWAY_PASSWORD`

When `--url` is provided, config/env credentials are **not** used — you must pass `--token` or `--password` explicitly.

### Theme

The TUI uses a warm dark palette defined in `theme/theme.ts`:

| Token        | Hex       | Usage                              |
| ------------ | --------- | ---------------------------------- |
| `text`       | `#E8E3D5` | Default text                       |
| `accent`     | `#F6C453` | Highlights, headings, active items |
| `accentSoft` | `#F2A65A` | Secondary accent                   |
| `dim`        | `#7B7F87` | Muted text, borders                |
| `error`      | `#F97066` | Error messages                     |
| `success`    | `#7DD3A5` | Success indicators, links          |

Syntax highlighting uses `cli-highlight` with a custom syntax theme.

### Defaults

| Option          | Default                                            | Notes                                          |
| --------------- | -------------------------------------------------- | ---------------------------------------------- |
| `session`       | `"main"` (per-sender) or `"global"` (global scope) | Determined by agent scope                      |
| `deliver`       | `false`                                            | Must opt-in to provider delivery               |
| `historyLimit`  | `200`                                              | Messages loaded on connect                     |
| `timeoutMs`     | Agent config default                               | Falls back to `agents.defaults.timeoutSeconds` |
| `toolsExpanded` | `false`                                            | Toggle with Ctrl+O                             |
| `showThinking`  | `false`                                            | Toggle with Ctrl+T                             |

## Error Handling

### Connection Errors

| Scenario               | Behavior                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Gateway unreachable    | Status shows "connecting"; retries automatically via `GatewayClient` reconnect      |
| Auth failure           | `onDisconnected` fires; status shows disconnect reason; pairing hint displayed once |
| Event gap (missed seq) | `onGap` fires; status bar shows `event gap: expected N, got M` for 5s               |
| WebSocket close        | Status shows "disconnected"; reconnects; history reloads on reconnect               |

### Chat Errors

| Scenario             | Behavior                                                                     |
| -------------------- | ---------------------------------------------------------------------------- |
| Send failure         | Chat log shows `send failed: <error>`; activity status set to "error"        |
| Agent error          | Chat event with `state: "error"` renders `errorMessage` in chat log          |
| Agent abort          | Chat event with `state: "aborted"` clears active run; status shows "aborted" |
| Abort failure        | Chat log shows `abort failed: <error>`                                       |
| History load failure | Chat log shows `history failed: <error>`                                     |

### Session/Command Errors

| Scenario                            | Behavior                                   |
| ----------------------------------- | ------------------------------------------ |
| Model set failure                   | Chat log shows `model failed: <error>`     |
| Think/verbose/reasoning set failure | Chat log shows `<setting> failed: <error>` |
| Session reset failure               | Chat log shows `reset failed: <error>`     |
| No active run on `/abort`           | Chat log shows `no active run`             |

### Local Shell Errors

| Scenario                   | Behavior                                                      |
| -------------------------- | ------------------------------------------------------------- |
| User declines shell access | `!` commands show "local shell: not enabled for this session" |
| Command spawn error        | Chat log shows `[local] error: <error>`                       |
| Command exit non-zero      | Chat log shows `[local] exit <code>` with any signal info     |
| Output exceeds 40 KB       | Truncated to last 40 KB of combined stdout+stderr             |

### Keyboard Interrupts

- **Ctrl+C once**: Clears input; shows "press ctrl+c again to exit" for 2 seconds.
- **Ctrl+C twice** (within 2s): Stops client, stops TUI, exits process.
- **Ctrl+D**: Immediate exit.
- **Esc**: Closes active overlay, or aborts active run if no overlay is open.
