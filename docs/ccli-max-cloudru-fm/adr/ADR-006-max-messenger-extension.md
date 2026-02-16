# ADR-006: MAX Messenger Extension for OpenClaw

## Status: ACCEPTED

## Date: 2026-02-16 (v2 — implementation complete, 109 unit tests passing)

## Bounded Context: Messenger (Extension)

## Context

MAX (formerly VK Messenger / ICQ New) is a Russian super-app by VK Group, pre-installed on all smartphones sold in Russia since September 2025. It provides a Bot API at `https://platform-api.max.ru` with an official TypeScript SDK `@maxhub/max-bot-api`.

OpenClaw needs a MAX channel extension to serve Russian market users who use MAX as their primary messenger. The extension must follow the established ChannelPlugin pattern (telegram, discord, signal) and integrate with the existing platform architecture.

### Why MAX (from Research)

| Factor                     | Value                                               |
| -------------------------- | --------------------------------------------------- |
| **Pre-installation**       | Mandatory on all Russian smartphones since Sep 2025 |
| **Government integration** | ESIA (Gosuslugi) auth, verified identity            |
| **No blocking risk**       | VK Group is Russian company, servers in RF          |
| **FZ-152 compliant**       | Personal data stored in Russia                      |
| **Bot API**                | RESTful, 30 rps, webhook + long polling             |
| **SDK**                    | `@maxhub/max-bot-api` (TypeScript, MIT, 85+ stars)  |
| **Market gap**             | No VPN needed, Russian payment cards accepted       |

### Platform Readiness

The OpenClaw platform **partially** anticipates MAX:

- `src/messenger/application/rate-limiter.ts` — documents `max: 20 rps, burstSize: 20` in docs (not yet in code)
- `src/streaming/pipeline/types.ts` — documents `max: maxMessageLength 4096` (not yet in code)
- `src/channels/registry.ts` — `CHAT_CHANNEL_ORDER` does **NOT** include `"max"` yet
- `MessengerPlatform` type — planned in docs, not yet in `src/`

### Extension Architecture Pattern (from telegram analysis)

Every messenger extension in OpenClaw follows an identical 5-file structure:

```
extensions/<name>/
  package.json              # @openclaw/<name>, workspace:* devDep
  openclaw.plugin.json      # id, channels[], configSchema
  index.ts                  # register(api): setRuntime + registerChannel
  src/
    runtime.ts              # Module-level PluginRuntime singleton
    channel.ts              # ChannelPlugin<Account, Probe> adapter
```

**Critical insight:** The extension contains **zero direct HTTP calls**. All API communication is delegated to `runtime.channel.<name>.*` methods provided by the OpenClaw runtime. The extension is a pure configuration/adapter layer.

### MAX Bot API Summary (from Research)

| Parameter            | Value                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| **Base URL**         | `https://platform-api.max.ru`                                            |
| **Auth**             | `Authorization: <token>` header                                          |
| **Rate Limit**       | 30 rps per bot token                                                     |
| **Formats**          | JSON, UTF-8, HTTPS (TLS 1.2+)                                            |
| **Max request size** | 10 MB                                                                    |
| **Message format**   | `markdown` or `html`                                                     |
| **Webhooks**         | POST /subscriptions, HTTPS mandatory                                     |
| **Long Polling**     | GET /updates?limit=100&timeout=30                                        |
| **File upload**      | POST /uploads?type={photo\|video\|audio\|file}                           |
| **Inline keyboards** | 210 buttons max, 30 rows, 7 per row                                      |
| **Button types**     | callback, link, request_contact, request_geo_location, open_app, message |

### MAX vs Telegram API Differences

| Aspect             | Telegram                          | MAX                                | Impact                     |
| ------------------ | --------------------------------- | ---------------------------------- | -------------------------- |
| Auth header        | `Authorization: Bot <token>`      | `Authorization: <token>`           | Different header format    |
| Webhook setup      | `setWebhook` method               | `POST /subscriptions`              | Different API surface      |
| Webhook secret     | `X-Telegram-Bot-Api-Secret-Token` | TBD (research needed)              | Verification logic differs |
| Message send       | `sendMessage` method              | `POST /messages`                   | Different endpoint         |
| Edit message       | `editMessageText`                 | `PUT /messages`                    | Different HTTP method      |
| Delete message     | `deleteMessage`                   | `DELETE /messages`                 | Same pattern               |
| Callback answer    | `answerCallbackQuery`             | `POST /answers`                    | Different endpoint         |
| Bot info           | `getMe`                           | `GET /me`                          | Similar                    |
| File upload        | `sendDocument/sendPhoto`          | `POST /uploads` + `POST /messages` | Two-step upload            |
| Updates            | `getUpdates`                      | `GET /updates`                     | Similar                    |
| Max message length | ~4096 chars                       | ~4096 chars (assumed)              | Same                       |

## Decision

### 1. Create Extension `@openclaw/max`

New extension at `extensions/max/` following the exact telegram pattern:

| File                   | Purpose                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| `package.json`         | `@openclaw/max`, devDep `openclaw: workspace:*`                             |
| `openclaw.plugin.json` | `id: "max"`, `channels: ["max"]`                                            |
| `index.ts`             | `setMaxRuntime(api.runtime)` + `api.registerChannel({ plugin: maxPlugin })` |
| `src/runtime.ts`       | `setMaxRuntime()` / `getMaxRuntime()` singleton                             |
| `src/channel.ts`       | `ChannelPlugin<ResolvedMaxAccount, MaxProbe>` with all sections             |

### 2. ChannelPlugin Sections

| Section                     | Implementation                                                                                  | Notes                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **meta**                    | `getChatChannelMeta("max")`                                                                     | Standard chat channel metadata            |
| **capabilities**            | `chatTypes: ["direct", "group"]`, `media: true`, `nativeCommands: true`, `blockStreaming: true` | No threads, no channels (unlike Telegram) |
| **outbound.sendText**       | `runtime.channel.max.sendMessageMax(to, text, opts)`                                            | Via runtime, markdown format              |
| **outbound.sendMedia**      | `runtime.channel.max.sendMessageMax(to, text, { mediaUrl })`                                    | Two-step: upload then send                |
| **outbound.chunker**        | `runtime.channel.text.chunkMarkdownText(text, limit)`                                           | Reuse platform's markdown chunker         |
| **outbound.textChunkLimit** | `4000`                                                                                          | Same as Telegram (conservative)           |
| **gateway.startAccount**    | `runtime.channel.max.monitorMaxProvider(opts)`                                                  | Webhook or Long Polling                   |
| **status.probeAccount**     | `runtime.channel.max.probeMax(token, timeout)`                                                  | GET /me to verify token                   |
| **config**                  | `listMaxAccountIds`, `resolveMaxAccount`, etc.                                                  | Account CRUD in openclaw.json             |
| **setup**                   | Wizard flow: prompt for bot token                                                               | Similar to Telegram setup                 |
| **security**                | DM policy, webhook verification                                                                 | Via runtime                               |
| **pairing**                 | `idLabel: "maxUserId"`                                                                          | User identity mapping                     |

### 3. Platform Registration

Add `"max"` to `CHAT_CHANNEL_ORDER` in `src/channels/registry.ts`:

```typescript
// Before:
["telegram", "whatsapp", "discord", "irc", "googlechat", "slack", "signal", "imessage"][
  // After:
  ("telegram", "max", "whatsapp", "discord", "irc", "googlechat", "slack", "signal", "imessage")
];
```

Position after telegram — both are primary chat platforms, MAX serves Russian market.

### 4. Runtime API Surface

The extension delegates all HTTP calls to runtime. The runtime must expose:

```typescript
// Expected runtime.channel.max interface
interface MaxRuntimeChannel {
  sendMessageMax(chatId: string, text: string, opts?: MaxSendOpts): Promise<SendResult>;
  probeMax(token: string, timeoutMs: number): Promise<MaxProbe>;
  monitorMaxProvider(opts: MaxMonitorOpts): Promise<void>;
  messageActions?: ChannelMessageActionAdapter;
}

interface MaxSendOpts {
  verbose?: boolean;
  mediaUrl?: string;
  replyToMessageId?: string;
  accountId?: string;
  format?: "markdown" | "html";
  attachments?: MaxAttachment[];
}

interface MaxMonitorOpts {
  token: string;
  accountId: string;
  config: OpenClawConfig;
  runtime: object;
  abortSignal: AbortSignal;
  useWebhook: boolean;
  webhookUrl?: string;
  webhookSecret?: string;
  webhookPath?: string;
}
```

### 5. Config Schema

```typescript
// MaxConfigSchema — stored in openclaw.json under channels.max
{
  accounts: {
    [accountId]: {
      token: string;           // Bot token from BotFather/dev.max.ru
      enabled: boolean;
      webhookUrl?: string;     // HTTPS URL for production
      webhookSecret?: string;  // Secret for webhook verification
      webhookPath?: string;    // Custom path suffix
      dmPolicy?: "open" | "pairing" | "closed";
      allowFrom?: string[];    // Allowed user IDs (pairing mode)
      proxy?: string;          // HTTP proxy (for development)
    }
  }
}
```

### 6. Webhook Events to Handle

| MAX Event          | OpenClaw Mapping | Action                     |
| ------------------ | ---------------- | -------------------------- |
| `bot_started`      | Session start    | Create/resume session      |
| `message_created`  | MessageReceived  | Route to agent             |
| `message_callback` | Callback         | Handle inline button press |
| `message_edited`   | MessageEdited    | Update context             |
| `message_removed`  | MessageDeleted   | Log only                   |
| `bot_added`        | GroupJoined      | Register group             |
| `bot_removed`      | GroupLeft        | Cleanup group              |
| `user_added`       | MemberAdded      | Update group members       |
| `user_removed`     | MemberRemoved    | Update group members       |

### 7. Modular Design for Reuse

The extension is designed for reusability across other messenger integrations:

| Module                  | Reusable Pattern                     | Other Use Cases                         |
| ----------------------- | ------------------------------------ | --------------------------------------- |
| `runtime.ts` singleton  | Generic `set*Runtime`/`get*Runtime`  | Any new channel extension               |
| Config schema pattern   | Account CRUD, token storage          | Any bot-based platform                  |
| Webhook/Polling gateway | `useWebhook` flag, `monitorProvider` | Any platform with dual delivery         |
| Inline keyboard builder | Button types, row limits             | Any platform with interactive UI        |
| Message chunker         | Markdown-aware splitting             | Any platform with message length limits |
| Probe pattern           | `GET /me` health check               | Any bot API with self-info endpoint     |

## Consequences

### Positive

- First-class MAX support in OpenClaw (primary channel for Russian market)
- Zero new patterns — follows telegram extension pattern exactly
- No direct HTTP in extension — all API calls via runtime (testable, mockable)
- Modular design allows easy adaptation for other messenger platforms
- Platform already partially anticipates MAX (rate limits, streaming config in docs)

### Negative

- Runtime must implement `channel.max.*` API surface (separate work in OpenClaw core)
- Webhook signature verification format for MAX is not fully documented (research risk)
- `@maxhub/max-bot-api` SDK adds a dependency (85+ stars, MIT, but single-maintainer risk)
- Russian legal entity required for bot publication (business constraint, not technical)
- MAX API rate limit (30 rps) may constrain high-throughput scenarios

### Invariants (DDD)

1. **Token Security**: Bot token stored only in `channels.max.accounts[id].token`, never logged
2. **Webhook Verification**: Every incoming webhook MUST be verified before processing
3. **Rate Compliance**: Outbound messages MUST respect MAX's 30 rps per token limit
4. **Gateway Exclusivity**: Only one gateway mode (webhook OR polling) per account at a time
5. **Graceful Shutdown**: `gateway.startAccount` MUST respect `abortSignal` for clean stop

### Domain Events

| Event                           | Trigger                    | Payload                               |
| ------------------------------- | -------------------------- | ------------------------------------- | ----------- |
| `max.message.received`          | Incoming message from MAX  | `{chatId, userId, text, attachments}` |
| `max.message.sent`              | Outbound message delivered | `{chatId, messageId}`                 |
| `max.message.delivery_failed`   | Send failure               | `{chatId, error, statusCode}`         |
| `max.webhook.received`          | Any webhook event          | `{updateType, timestamp}`             |
| `max.webhook.validation_failed` | Invalid signature          | `{reason, ip}`                        |
| `max.callback.received`         | Inline button pressed      | `{callbackId, payload, userId}`       |
| `max.gateway.started`           | Account listener started   | `{accountId, mode: "webhook"          | "polling"}` |
| `max.gateway.stopped`           | Account listener stopped   | `{accountId, reason}`                 |

## References

- `extensions/telegram/` — Reference implementation (identical pattern)
- `src/channels/registry.ts` — Channel registration (`CHAT_CHANNEL_ORDER`)
- `docs/ccli-max-cloudru-fm/research/max-messenger-integration.md` — Full MAX API research
- `docs/ccli-max-cloudru-fm/PLAN-max-messenger-extension.md` — Implementation plan
- [MAX Bot API](https://platform-api.max.ru) — Official API documentation
- [dev.max.ru](https://dev.max.ru) — Developer portal
- [@maxhub/max-bot-api](https://github.com/max-messenger/max-bot-api-client-ts) — TypeScript SDK
