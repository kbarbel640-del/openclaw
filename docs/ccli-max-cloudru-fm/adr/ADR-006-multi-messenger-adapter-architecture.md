# ADR-006: Multi-Messenger Adapter Architecture

## Status: PROPOSED

## Date: 2026-02-13

## Bounded Context: Messenger Integration

## Context

OpenClaw is an AI agent orchestration platform that processes user messages through
an agent execution pipeline (see ADR-003). Currently, the platform has **no messenger
adapter abstraction layer**. Users connect to OpenClaw bots through platform-specific
code that is tightly coupled to the core engine. As OpenClaw expands to support
multiple messenger platforms, this coupling becomes a liability.

Two immediate messenger targets have been identified through research:

1. **Telegram Bot API** -- well-established, mature ecosystem, SDKs like `grammy`
   and `telegraf` in TypeScript, supports webhooks and long polling, inline keyboards,
   file uploads up to 50 MB, message editing, and callback queries.

2. **MAX Messenger Bot API** -- Russian enterprise messenger by VK/Mail.ru Group,
   30 RPS rate limit per bot, TypeScript SDK `@maxhub/max-bot-api`, supports
   webhooks and long polling, inline keyboards (limited compared to Telegram),
   file uploads up to 256 MB, message editing, and callback buttons.

Users must be able to connect to an OpenClaw bot through **either** Telegram **or**
MAX (not both simultaneously per conversation, but the system must support both
concurrently for different users). Future platforms (web widget, API clients,
WhatsApp) must be addable without modifying the core engine.

### Problem Forces

- Different messengers have incompatible APIs, authentication, and payload formats
- Rate limits differ per platform (Telegram: 30 msg/sec global, MAX: 30 RPS per bot)
- Capability sets differ (Telegram supports inline keyboards with URL buttons;
  MAX supports simpler button layouts)
- File size limits, supported media types, and message length limits vary
- The core engine must remain messenger-agnostic to preserve testability and
  separation of concerns
- Each adapter must be independently deployable and restartable without affecting
  the core or other adapters

### DDD Aggregate: MessengerConnection

The `MessengerConnection` aggregate manages the lifecycle of a single user's
connection through a specific messenger platform. It is the consistency boundary
for message delivery guarantees and session tracking per platform.

```typescript
interface MessengerConnection {
  readonly id: string;                    // UUID
  readonly platform: MessengerPlatform;   // 'telegram' | 'max' | ...
  readonly platformUserId: string;        // Platform-native user ID
  readonly platformChatId: string;        // Platform-native chat ID
  readonly openclawUserId: string;        // OpenClaw internal user ID
  readonly createdAt: Date;
  readonly lastActivityAt: Date;
  readonly status: ConnectionStatus;
  readonly metadata: Record<string, unknown>;
}

type ConnectionStatus = 'active' | 'paused' | 'disconnected' | 'rate_limited';
```

**Invariants:**
- A MessengerConnection maps exactly one `(platform, platformUserId, platformChatId)`
  tuple to one `openclawUserId`.
- A user may have connections on multiple platforms, but each platform connection
  is independent.
- Connection status transitions follow: `active <-> paused -> disconnected`.
  `rate_limited` is transient and auto-resolves.

### DDD Value Objects

```typescript
/**
 * Platform-agnostic representation of an inbound message.
 * Every adapter MUST normalize raw platform events to this shape
 * before the message reaches the core engine.
 */
interface NormalizedMessage {
  readonly id: string;                     // Adapter-generated UUID
  readonly platform: MessengerPlatform;
  readonly chatId: string;                 // Platform-native chat ID
  readonly userId: string;                 // Platform-native user ID
  readonly text?: string;
  readonly attachments?: ReadonlyArray<Attachment>;
  readonly replyTo?: string;               // ID of message being replied to
  readonly timestamp: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Platform-agnostic representation of a callback (button press,
 * inline keyboard interaction).
 */
interface NormalizedCallback {
  readonly id: string;
  readonly platform: MessengerPlatform;
  readonly chatId: string;
  readonly userId: string;
  readonly data: string;                   // Callback payload
  readonly messageId: string;              // Message the callback originated from
  readonly timestamp: Date;
}

/**
 * Confirmation that a message was delivered to the platform.
 */
interface DeliveryReceipt {
  readonly platform: MessengerPlatform;
  readonly chatId: string;
  readonly messageId: string;              // Platform-assigned message ID
  readonly timestamp: Date;
  readonly success: boolean;
  readonly error?: string;
}

/**
 * Attachment value object -- normalized across platforms.
 */
interface Attachment {
  readonly type: AttachmentType;
  readonly url?: string;
  readonly fileId?: string;                // Platform-native file reference
  readonly mimeType?: string;
  readonly size?: number;                  // Bytes
  readonly filename?: string;
  readonly thumbnail?: string;             // URL or base64
}

type AttachmentType = 'photo' | 'video' | 'audio' | 'document' | 'sticker'
                    | 'voice' | 'contact' | 'location';

/**
 * Outbound message -- what the core engine produces for delivery.
 */
interface OutboundMessage {
  readonly text?: string;
  readonly parseMode?: 'plain' | 'markdown' | 'html';
  readonly attachments?: ReadonlyArray<OutboundAttachment>;
  readonly keyboard?: InlineKeyboard;
  readonly replyTo?: string;
}

interface OutboundAttachment {
  readonly type: AttachmentType;
  readonly source: { url: string } | { buffer: Buffer; filename: string };
  readonly caption?: string;
}

interface InlineKeyboard {
  readonly rows: ReadonlyArray<ReadonlyArray<InlineButton>>;
}

interface InlineButton {
  readonly text: string;
  readonly callbackData?: string;          // Max 64 bytes
  readonly url?: string;                   // Only supported on some platforms
}

type MessengerPlatform = 'telegram' | 'max' | 'web' | 'api';
```

## Decision

Adopt a **Hexagonal Architecture (Ports and Adapters)** pattern for messenger
integration. The core engine defines an **inbound port** (`IMessengerAdapter`)
that all platform adapters must implement. Each adapter is a self-contained
module that translates between the platform-native API and the normalized
message model.

### Port Interface (Hexagonal Architecture)

```typescript
/**
 * Inbound port -- the contract that the core engine expects
 * from any messenger adapter. Each platform implements this
 * interface to plug into the OpenClaw message pipeline.
 *
 * Lifecycle: create -> start() -> [process messages] -> stop()
 */
interface IMessengerAdapter {
  /** Identifies which platform this adapter serves */
  readonly platform: MessengerPlatform;

  /** Human-readable adapter name for logging */
  readonly displayName: string;

  /**
   * Start receiving messages. Adapter chooses its own transport
   * (webhooks, long polling, WebSocket). Resolves when ready.
   */
  start(): Promise<void>;

  /**
   * Gracefully stop. Drain in-flight messages, close connections.
   * Resolves when fully stopped.
   */
  stop(): Promise<void>;

  /** Returns true if the adapter is currently running and healthy */
  isHealthy(): boolean;

  /**
   * Send a message to a chat. Adapter denormalizes OutboundMessage
   * to platform-native format.
   */
  sendMessage(chatId: string, message: OutboundMessage): Promise<DeliveryReceipt>;

  /**
   * Show typing indicator (platform-specific duration/behavior).
   * Best-effort -- may be a no-op on unsupported platforms.
   */
  sendTypingIndicator(chatId: string): Promise<void>;

  /**
   * Edit an existing message. Falls back to delete + resend
   * if the platform does not support editing.
   */
  editMessage(
    chatId: string,
    messageId: string,
    message: OutboundMessage
  ): Promise<void>;

  /**
   * Delete a message. Best-effort -- silently fails if the
   * platform does not support deletion or the message is too old.
   */
  deleteMessage(chatId: string, messageId: string): Promise<void>;

  /** Register handler for incoming normalized messages */
  onMessage(handler: (event: NormalizedMessage) => Promise<void>): void;

  /** Register handler for incoming callback/button events */
  onCallback(handler: (event: NormalizedCallback) => Promise<void>): void;

  /** Register handler for adapter-level errors */
  onError(handler: (error: AdapterError) => void): void;
}

/**
 * Adapter error with platform context for diagnostics.
 */
interface AdapterError {
  readonly platform: MessengerPlatform;
  readonly code: AdapterErrorCode;
  readonly message: string;
  readonly cause?: Error;
  readonly retryable: boolean;
}

type AdapterErrorCode =
  | 'RATE_LIMITED'
  | 'AUTH_FAILED'
  | 'NETWORK_ERROR'
  | 'PLATFORM_ERROR'
  | 'NORMALIZATION_ERROR'
  | 'DELIVERY_FAILED'
  | 'TIMEOUT';
```

### Adapter Factory

```typescript
/**
 * Factory for creating messenger adapters. Supports dynamic
 * registration so new adapters can be added without modifying
 * existing code (Open/Closed Principle).
 */
interface IMessengerAdapterFactory {
  register(platform: MessengerPlatform, factory: AdapterConstructor): void;
  create(platform: MessengerPlatform, config: AdapterConfig): IMessengerAdapter;
  getSupportedPlatforms(): ReadonlyArray<MessengerPlatform>;
}

type AdapterConstructor = (config: AdapterConfig) => IMessengerAdapter;

interface AdapterConfig {
  readonly platform: MessengerPlatform;
  readonly token: string;
  readonly transport: 'webhook' | 'long-polling';
  readonly webhookUrl?: string;
  readonly webhookPath?: string;
  readonly rateLimitRps?: number;
  readonly options?: Readonly<Record<string, unknown>>;
}
```

### Adapter Implementations

#### TelegramAdapter

```typescript
/**
 * Telegram Bot API adapter using grammy SDK.
 *
 * Transport: Webhook (production) or long polling (development).
 * Rate limits: 30 messages/second globally, 1 message/second per chat.
 * Max message length: 4096 characters.
 * File upload: 50 MB (download), 10 MB (photo upload).
 */
class TelegramAdapter implements IMessengerAdapter {
  readonly platform = 'telegram' as const;
  readonly displayName = 'Telegram';

  private bot: Bot;       // grammy Bot instance
  private running = false;

  constructor(private config: AdapterConfig) {
    this.bot = new Bot(config.token);
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    // grammy middleware chain:
    // 1. Error boundary (catches all handler errors)
    // 2. Rate limiter (1 msg/sec per chat)
    // 3. Session (if needed)
    // 4. Message normalization -> onMessage handler
    // 5. Callback normalization -> onCallback handler
  }

  private normalizeMessage(ctx: Context): NormalizedMessage {
    return {
      id: crypto.randomUUID(),
      platform: 'telegram',
      chatId: String(ctx.chat.id),
      userId: String(ctx.from.id),
      text: ctx.message?.text ?? ctx.message?.caption,
      attachments: this.extractAttachments(ctx),
      replyTo: ctx.message?.reply_to_message
        ? String(ctx.message.reply_to_message.message_id)
        : undefined,
      timestamp: new Date(ctx.message.date * 1000),
      metadata: {
        chatType: ctx.chat.type,
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        languageCode: ctx.from?.language_code,
      },
    };
  }

  private denormalizeKeyboard(keyboard?: InlineKeyboard):
    TelegramInlineKeyboard | undefined {
    if (!keyboard) return undefined;
    // Map InlineButton[] to Telegram InlineKeyboardButton[]
    // Telegram supports: callback_data, url, switch_inline_query
    return new InlineKeyboard(
      keyboard.rows.map(row =>
        row.map(btn => {
          if (btn.url) return { text: btn.text, url: btn.url };
          return { text: btn.text, callback_data: btn.callbackData ?? '' };
        })
      )
    );
  }

  async sendMessage(
    chatId: string,
    message: OutboundMessage
  ): Promise<DeliveryReceipt> {
    const sent = await this.bot.api.sendMessage(chatId, message.text ?? '', {
      parse_mode: this.mapParseMode(message.parseMode),
      reply_markup: this.denormalizeKeyboard(message.keyboard),
      reply_to_message_id: message.replyTo
        ? Number(message.replyTo)
        : undefined,
    });

    return {
      platform: 'telegram',
      chatId,
      messageId: String(sent.message_id),
      timestamp: new Date(),
      success: true,
    };
  }

  // ... start(), stop(), editMessage(), deleteMessage(), etc.
}
```

#### MaxAdapter

```typescript
/**
 * MAX Messenger Bot API adapter using @maxhub/max-bot-api SDK.
 *
 * Transport: Webhook (production) or long polling (development).
 * Rate limits: 30 RPS per bot token.
 * Max message length: 4096 characters.
 * File upload: 256 MB.
 *
 * Key differences from Telegram:
 * - Callback buttons use `payload` instead of `callback_data`
 * - No URL buttons in inline keyboards
 * - Different file upload API (multipart with `type` field)
 * - Chat ID is a string UUID, not a numeric ID
 * - No native markdown parse mode (only plain text and some formatting)
 */
class MaxAdapter implements IMessengerAdapter {
  readonly platform = 'max' as const;
  readonly displayName = 'MAX Messenger';

  private client: MaxBotApi;  // @maxhub/max-bot-api instance
  private running = false;
  private poller?: LongPoller;

  constructor(private config: AdapterConfig) {
    this.client = new MaxBotApi(config.token);
  }

  private normalizeMessage(update: MaxUpdate): NormalizedMessage {
    const msg = update.message;
    return {
      id: crypto.randomUUID(),
      platform: 'max',
      chatId: msg.recipient.chatId,
      userId: msg.sender.userId,
      text: msg.body?.text,
      attachments: this.extractAttachments(msg),
      replyTo: msg.link?.type === 'reply' ? msg.link.mid : undefined,
      timestamp: new Date(msg.timestamp),
      metadata: {
        chatType: msg.recipient.chatType,
        senderName: msg.sender.name,
      },
    };
  }

  private denormalizeKeyboard(keyboard?: InlineKeyboard):
    MaxInlineKeyboard | undefined {
    if (!keyboard) return undefined;
    // MAX uses flat buttons array with row separators, no URL buttons
    return keyboard.rows.map(row =>
      row
        .filter(btn => !btn.url)  // MAX does not support URL buttons
        .map(btn => ({
          type: 'callback' as const,
          text: btn.text,
          payload: btn.callbackData ?? '',
        }))
    );
  }

  async sendMessage(
    chatId: string,
    message: OutboundMessage
  ): Promise<DeliveryReceipt> {
    const result = await this.client.sendMessage({
      chatId,
      text: this.stripUnsupportedMarkdown(message.text ?? ''),
      attachments: this.denormalizeKeyboard(message.keyboard)
        ? [{ type: 'inline_keyboard', buttons: /* flattened */ }]
        : undefined,
      replyTo: message.replyTo,
    });

    return {
      platform: 'max',
      chatId,
      messageId: result.message.mid,
      timestamp: new Date(),
      success: true,
    };
  }

  /**
   * MAX does not support markdown parse mode natively.
   * Strip markdown syntax and send plain text.
   */
  private stripUnsupportedMarkdown(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')  // bold -> plain
      .replace(/__(.*?)__/g, '$1')       // underline -> plain
      .replace(/`(.*?)`/g, '$1');        // code -> plain
  }

  // ... start(), stop(), editMessage(), deleteMessage(), etc.
}
```

### Message Router

The `MessageRouter` is an application service that sits between adapters and
the core engine. It is responsible for dispatching normalized messages to the
correct handler and routing outbound responses back through the originating
adapter.

```typescript
/**
 * Routes normalized messages from any adapter to the core engine
 * and responses back to the correct adapter.
 */
class MessageRouter {
  private adapters: Map<MessengerPlatform, IMessengerAdapter> = new Map();
  private messageHandler?: (msg: NormalizedMessage) => Promise<OutboundMessage>;
  private callbackHandler?: (cb: NormalizedCallback) => Promise<OutboundMessage | void>;

  registerAdapter(adapter: IMessengerAdapter): void {
    this.adapters.set(adapter.platform, adapter);

    adapter.onMessage(async (event: NormalizedMessage) => {
      if (!this.messageHandler) return;
      const response = await this.messageHandler(event);
      await adapter.sendMessage(event.chatId, response);
    });

    adapter.onCallback(async (event: NormalizedCallback) => {
      if (!this.callbackHandler) return;
      const response = await this.callbackHandler(event);
      if (response) {
        await adapter.sendMessage(event.chatId, response);
      }
    });

    adapter.onError((error: AdapterError) => {
      console.error(
        `[${error.platform}] Adapter error: ${error.code} - ${error.message}`
      );
      // Adapter errors are isolated -- do not propagate to other adapters
    });
  }

  onMessage(handler: (msg: NormalizedMessage) => Promise<OutboundMessage>): void {
    this.messageHandler = handler;
  }

  onCallback(handler: (cb: NormalizedCallback) => Promise<OutboundMessage | void>): void {
    this.callbackHandler = handler;
  }

  async startAll(): Promise<void> {
    await Promise.all(
      Array.from(this.adapters.values()).map(a => a.start())
    );
  }

  async stopAll(): Promise<void> {
    await Promise.allSettled(
      Array.from(this.adapters.values()).map(a => a.stop())
    );
  }

  getAdapter(platform: MessengerPlatform): IMessengerAdapter | undefined {
    return this.adapters.get(platform);
  }
}
```

### Event Flow

```
Inbound:
  User sends message on Telegram/MAX
    -> Platform webhook/poll delivers raw event
    -> TelegramAdapter/MaxAdapter receives raw event
    -> Adapter normalizes to NormalizedMessage (value object)
    -> MessageRouter dispatches to core engine handler
    -> Core engine processes (agent-runner.ts pipeline)
    -> Core engine returns OutboundMessage

Outbound:
  Core engine produces OutboundMessage
    -> MessageRouter identifies originating adapter by platform
    -> Adapter denormalizes OutboundMessage to platform-native format
    -> Adapter applies platform-specific constraints:
       - Message length truncation
       - Unsupported feature fallback (URL buttons on MAX)
       - Parse mode conversion
    -> Adapter sends via platform SDK
    -> DeliveryReceipt returned to core engine
```

### Capability Matrix

| Feature                  | Telegram                | MAX                     | Fallback Strategy             |
|--------------------------|-------------------------|-------------------------|-------------------------------|
| **Text messages**        | 4096 chars              | 4096 chars              | Truncate with "..." suffix    |
| **Markdown formatting**  | MarkdownV2, HTML        | Plain text only         | Strip markdown on MAX         |
| **Inline keyboards**     | Full (callback + URL)   | Callback only (no URL)  | Drop URL buttons on MAX       |
| **Inline button payload**| 64 bytes callback_data  | 128 bytes payload       | Use 64 bytes (lowest common)  |
| **Message editing**      | Supported               | Supported               | Delete + resend as fallback   |
| **Message deletion**     | Within 48 hours         | Supported               | Silent no-op if unsupported   |
| **Photo upload**         | 10 MB                   | 256 MB                  | Compress on Telegram          |
| **Document upload**      | 50 MB                   | 256 MB                  | Reject if exceeds platform limit |
| **Typing indicator**     | sendChatAction          | POST /chats/{id}/actions| Best-effort, no error on fail |
| **Webhooks**             | HTTPS required, self-signed OK | HTTPS required    | Long polling as dev fallback  |
| **Long polling**         | getUpdates              | GET /updates            | Always available              |
| **Rate limit**           | 30 msg/sec global       | 30 RPS per bot          | Per-adapter token bucket      |
| **Bot commands menu**    | setMyCommands           | Not supported           | Skip on MAX                   |
| **Reply quoting**        | reply_to_message_id     | link.type = "reply"     | Adapter maps to platform field|
| **Stickers**             | WebP/WEBM               | Not supported           | Send as image on MAX          |
| **Voice messages**       | OGG Opus                | Supported               | Transcode if needed           |
| **Location sharing**     | Supported               | Supported               | Normalize lat/lng             |
| **Contact sharing**      | Supported               | Supported               | Normalize to name + phone     |

### Rate Limiting Strategy

Each adapter implements its own rate limiter using a **token bucket** algorithm:

```typescript
interface RateLimiter {
  /** Returns true if a request can proceed; false if rate limited */
  tryAcquire(): boolean;

  /** Wait until a token is available (with timeout) */
  acquire(timeoutMs?: number): Promise<void>;

  /** Current tokens available */
  readonly available: number;
}

// Telegram: 30 tokens/sec global, 1 token/sec per chat
// MAX: 30 tokens/sec per bot
```

When rate limited, the adapter queues outbound messages internally and drains
the queue as tokens become available. The `ConnectionStatus` on the aggregate
transitions to `rate_limited` and auto-resolves when the queue drains.

### Configuration Schema

```typescript
/**
 * Messenger configuration stored in openclaw.json under
 * the "messengers" key.
 */
interface MessengerConfig {
  readonly adapters: ReadonlyArray<AdapterConfig>;
  readonly routing: {
    /** Default platform for new users (used in web onboarding) */
    readonly defaultPlatform: MessengerPlatform;
    /** Whether to allow users on multiple platforms simultaneously */
    readonly multiPlatform: boolean;
  };
}

// Example openclaw.json fragment:
// {
//   "messengers": {
//     "adapters": [
//       {
//         "platform": "telegram",
//         "token": "${TELEGRAM_BOT_TOKEN}",
//         "transport": "webhook",
//         "webhookUrl": "https://bot.example.com/telegram",
//         "webhookPath": "/telegram",
//         "rateLimitRps": 30
//       },
//       {
//         "platform": "max",
//         "token": "${MAX_BOT_TOKEN}",
//         "transport": "long-polling",
//         "rateLimitRps": 30
//       }
//     ],
//     "routing": {
//       "defaultPlatform": "telegram",
//       "multiPlatform": false
//     }
//   }
// }
```

### Error Handling and Resilience

```typescript
/**
 * Each adapter wraps all platform SDK calls in a resilience layer:
 *
 * 1. Timeout: 10s per API call (configurable)
 * 2. Retry: 3 attempts with exponential backoff (1s, 2s, 4s)
 * 3. Circuit breaker: Opens after 5 consecutive failures,
 *    half-opens after 30s, closes after 1 success
 * 4. Bulkhead: Each adapter runs in its own async context;
 *    one adapter failure cannot block another
 */

interface ResilienceConfig {
  readonly timeoutMs: number;          // Default: 10000
  readonly retryAttempts: number;      // Default: 3
  readonly retryBackoffMs: number;     // Default: 1000 (doubles each retry)
  readonly circuitBreakerThreshold: number;  // Default: 5
  readonly circuitBreakerResetMs: number;    // Default: 30000
}
```

### Testing Strategy

```typescript
/**
 * The IMessengerAdapter interface enables clean testing at every level:
 *
 * Unit tests:  Mock IMessengerAdapter, test core engine in isolation.
 * Adapter tests: Use platform SDK test utilities:
 *   - grammy: Built-in test mode (bot.api.config.use(testApi))
 *   - @maxhub/max-bot-api: Mock HTTP responses
 * Integration tests: Full adapter + MessageRouter + mock core engine.
 * E2E tests: Real bot tokens against platform staging environments.
 */

// Example: mock adapter for core engine tests
class MockMessengerAdapter implements IMessengerAdapter {
  readonly platform = 'telegram' as const;
  readonly displayName = 'Mock Telegram';

  private messageHandler?: (event: NormalizedMessage) => Promise<void>;
  private callbackHandler?: (event: NormalizedCallback) => Promise<void>;

  public sentMessages: Array<{ chatId: string; message: OutboundMessage }> = [];

  async start(): Promise<void> { /* no-op */ }
  async stop(): Promise<void> { /* no-op */ }
  isHealthy(): boolean { return true; }

  async sendMessage(
    chatId: string,
    message: OutboundMessage
  ): Promise<DeliveryReceipt> {
    this.sentMessages.push({ chatId, message });
    return {
      platform: this.platform,
      chatId,
      messageId: crypto.randomUUID(),
      timestamp: new Date(),
      success: true,
    };
  }

  async sendTypingIndicator(_chatId: string): Promise<void> { /* no-op */ }
  async editMessage(): Promise<void> { /* no-op */ }
  async deleteMessage(): Promise<void> { /* no-op */ }

  onMessage(handler: (event: NormalizedMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  onCallback(handler: (event: NormalizedCallback) => Promise<void>): void {
    this.callbackHandler = handler;
  }

  onError(_handler: (error: AdapterError) => void): void { /* no-op */ }

  /** Test helper: simulate an incoming message */
  async simulateMessage(msg: NormalizedMessage): Promise<void> {
    await this.messageHandler?.(msg);
  }

  /** Test helper: simulate a callback */
  async simulateCallback(cb: NormalizedCallback): Promise<void> {
    await this.callbackHandler?.(cb);
  }
}
```

## Consequences

### Positive

- **Platform-agnostic core**: The core engine never imports Telegram or MAX SDKs
  directly. It only depends on `IMessengerAdapter` and the normalized value objects.
- **Independent deployability**: Each adapter can be enabled/disabled via config
  without code changes. Adding a new platform requires only a new adapter class.
- **Testability**: Mock adapters enable fast, deterministic unit tests for the
  core engine. Adapter tests are isolated to platform-specific behavior.
- **Graceful degradation**: Platform-specific features (URL buttons, markdown)
  degrade per the capability matrix rather than causing errors.
- **Resilience isolation**: One adapter crashing or being rate-limited does not
  affect other adapters or the core engine.
- **Consistent user experience**: NormalizedMessage provides a uniform data model
  regardless of the originating platform.

### Negative

- **Lowest common denominator**: Rich platform features (Telegram inline queries,
  MAX large file uploads) are either unavailable through the normalized interface
  or require platform-specific escape hatches in the `metadata` field.
- **Normalization overhead**: Every inbound message is copied into a new object.
  For high-throughput scenarios this adds GC pressure (mitigated by object pooling
  if needed).
- **Two SDKs to maintain**: `grammy` and `@maxhub/max-bot-api` are external
  dependencies with their own release cycles and breaking changes.
- **Capability matrix complexity**: The fallback logic for each unsupported feature
  must be tested per platform pair, leading to combinatorial test cases.
- **Configuration surface**: Users must configure tokens and transport per adapter,
  increasing initial setup complexity.

### Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|-----------|
| MAX SDK instability / low maintenance | Medium | High | Pin SDK version, fork if abandoned |
| Telegram API breaking changes | Low | Medium | grammy handles most changes; pin version |
| Rate limit storms (many users, one bot) | Medium | High | Per-adapter token bucket + queue |
| Webhook delivery failures | Medium | Medium | Long-polling fallback for reliability |
| Platform outage (Telegram/MAX down) | Low | High | Circuit breaker + user notification |
| Message normalization data loss | Low | Medium | Preserve raw payload in metadata |

## Invariants (DDD)

1. **Normalization invariant**: Every inbound message from any platform MUST be
   normalized to `NormalizedMessage` before reaching the core engine. Raw platform
   payloads MUST NOT leak into the core.

2. **Adapter isolation invariant**: An adapter failure (crash, rate limit, network
   error) MUST NOT crash the core engine or affect other running adapters. Each
   adapter operates in its own error boundary.

3. **Graceful degradation invariant**: Platform-specific features that are not
   supported on the target platform MUST degrade gracefully (drop, simplify, or
   substitute) rather than throwing errors. The capability matrix defines the
   degradation behavior for each feature/platform pair.

4. **Session identity invariant**: Each `(platform, platformChatId)` tuple maps
   to exactly one OpenClaw conversation session. This mapping is idempotent --
   repeated messages from the same chat always route to the same session.

5. **Delivery receipt invariant**: Every `sendMessage()` call MUST return a
   `DeliveryReceipt`. If delivery fails after all retries, the receipt's
   `success` field is `false` with an error description.

6. **Token security invariant**: Bot tokens MUST be stored in environment
   variables or `.env` files, NEVER in `openclaw.json` or source code.
   Config uses `${ENV_VAR_NAME}` references that are resolved at runtime.

## Module Boundary

This module is **independently reusable** and can be extracted as an npm package:

```
@openclaw/messenger-adapters
  /core
    adapter.interface.ts      -- IMessengerAdapter, IMessengerAdapterFactory
    message.types.ts          -- NormalizedMessage, NormalizedCallback, OutboundMessage
    delivery.types.ts         -- DeliveryReceipt, AdapterError
    router.ts                 -- MessageRouter
    rate-limiter.ts           -- TokenBucket rate limiter
  /adapters
    /telegram
      telegram-adapter.ts     -- TelegramAdapter implements IMessengerAdapter
      telegram-normalizer.ts  -- Raw Telegram -> NormalizedMessage
      telegram-denormalizer.ts-- OutboundMessage -> Telegram API params
    /max
      max-adapter.ts          -- MaxAdapter implements IMessengerAdapter
      max-normalizer.ts       -- Raw MAX -> NormalizedMessage
      max-denormalizer.ts     -- OutboundMessage -> MAX API params
  /testing
    mock-adapter.ts           -- MockMessengerAdapter for tests
    fixtures.ts               -- Test message fixtures
  index.ts                    -- Public API barrel export
```

**Dependency direction**: Adapters depend on core interfaces. Core depends on
nothing external. The OpenClaw application depends on the package but the package
does not depend on OpenClaw internals.

```
openclaw (application)
  -> @openclaw/messenger-adapters/core   (port interfaces)
  -> @openclaw/messenger-adapters/adapters/telegram
  -> @openclaw/messenger-adapters/adapters/max

@openclaw/messenger-adapters/adapters/telegram
  -> @openclaw/messenger-adapters/core   (implements IMessengerAdapter)
  -> grammy                              (external SDK)

@openclaw/messenger-adapters/adapters/max
  -> @openclaw/messenger-adapters/core   (implements IMessengerAdapter)
  -> @maxhub/max-bot-api                 (external SDK)
```

No circular dependencies. All arrows point inward toward the core interfaces.

## Alternatives Considered

1. **Single monolithic bot handler per platform** -- Tightly couples each platform
   to the core engine. Adding a new platform requires modifying the core. Rejected
   for violating Open/Closed Principle.

2. **Message queue-based integration (RabbitMQ/Redis Streams)** -- Each adapter
   publishes to a queue, core consumes. Adds infrastructure complexity (queue
   broker) that is premature for 2-3 adapters. Can be adopted later if scale
   demands it without changing the adapter interface.

3. **Platform abstraction at the HTTP level (webhook proxy)** -- Normalize at
   the HTTP layer before reaching Node.js. Loses access to SDK-level features
   (middleware, session management, built-in retry). Rejected.

4. **Use existing multi-platform bot framework (e.g., Bottender)** -- Adds a
   large dependency with its own opinions on routing, state, and middleware.
   OpenClaw already has its own agent execution pipeline; a full framework would
   conflict. Rejected in favor of lightweight port/adapter pattern.

## References

- ADR-003: Claude Code as Agentic Execution Engine -- defines the agent-runner
  pipeline that adapters feed into
- ADR-001: Cloud.ru FM Proxy Integration -- defines the LLM backend architecture
- [grammy documentation](https://grammy.dev/) -- Telegram Bot API framework
- [telegraf documentation](https://telegraf.js.org/) -- Alternative Telegram SDK
- [@maxhub/max-bot-api](https://www.npmjs.com/package/@maxhub/max-bot-api) -- MAX Messenger SDK
- [MAX Messenger Bot API docs](https://dev.max.ru/docs) -- Official MAX Bot API
- [Hexagonal Architecture (Alistair Cockburn)](https://alistair.cockburn.us/hexagonal-architecture/)
- `src/auto-reply/reply/agent-runner.ts` -- Core message processing pipeline
