# Channel Message Flow Architecture

This document describes how messages flow through Moltbot's channel system, comparing WhatsApp, Discord, and Gmail to highlight the unified architecture and channel-specific differences.

## Architecture Overview

All channels in Moltbot follow a common pattern:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  External   │    │  Channel    │    │   Shared    │    │  Pi Agent   │
│  Platform   │───▶│  Adapter    │───▶│  Router     │───▶│  Framework  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       ▲                                                        │
       │                                                        │
       └────────────────────────────────────────────────────────┘
                         Response Delivery
```

### Shared Components (All Channels)

| Component | Location | Purpose |
|-----------|----------|---------|
| Agent Router | `src/routing/resolve-route.ts` | Routes messages to agents |
| Reply Dispatcher | `src/auto-reply/reply/reply-dispatcher.ts` | Queues & delivers responses |
| Agent Runner | `src/auto-reply/reply/get-reply.ts` | Sets up agent execution |
| Pi Framework | `src/agents/pi-embedded-runner/` | Executes AI agents |
| Outbound Service | `src/infra/outbound/` | Cross-channel delivery |

### Channel-Specific Components

| Channel | Adapter Location | Protocol |
|---------|------------------|----------|
| WhatsApp | `src/web/` | Baileys (WhatsApp Web) |
| Discord | `src/discord/` | Carbon (@buape/carbon) |
| Gmail | `src/hooks/` | Webhooks + gog CLI |
| Telegram | `src/telegram/` | grammY |
| Slack | `src/slack/` | Bolt |
| Signal | `src/signal/` | signal-cli |
| iMessage | `src/imessage/` | AppleScript/sqlite |

---

## Channel Comparison Matrix

### Connection Method

| Aspect | WhatsApp | Discord | Gmail |
|--------|----------|---------|-------|
| **Protocol** | WebSocket (Baileys) | WebSocket (Gateway) | HTTP Webhooks |
| **Auth** | QR Code scan | Bot Token | OAuth2 (gog CLI) |
| **Connection Type** | Persistent | Persistent | Push notifications |
| **Library** | `@whiskeysockets/baileys` | `@buape/carbon` | `gog` CLI |
| **Reconnect** | Auto with backoff | Auto with backoff | N/A (stateless) |

### Message Reception

| Aspect | WhatsApp | Discord | Gmail |
|--------|----------|---------|-------|
| **Event Source** | `messages.upsert` | `MESSAGE_CREATE` | Pub/Sub push |
| **Debouncing** | Yes (configurable) | Yes (300ms default) | No |
| **Deduplication** | By message ID | By message ID | By message ID |
| **Media Download** | On reception | On demand | Via gog CLI |

### Routing & Gating

| Aspect | WhatsApp | Discord | Gmail |
|--------|----------|---------|-------|
| **Peer Types** | DM, Group | DM, Channel, Thread | Single inbox |
| **Mention Required** | Configurable (groups) | Configurable | N/A |
| **Allowlist** | Phone numbers | Users, Channels, Guilds | N/A |
| **Session Key Format** | `agent:wa:phone:+1234` | `agent:discord:channel:123` | `hook:gmail:msgId` |

### Response Delivery

| Aspect | WhatsApp | Discord | Gmail |
|--------|----------|---------|-------|
| **Max Message Length** | ~65KB | 2000 chars | Unlimited |
| **Chunking** | Markdown-aware | Markdown-aware | N/A |
| **Media Support** | Image, Audio, Video, Doc | Image, Video, File | N/A (use gog) |
| **Typing Indicator** | Yes | Yes | N/A |
| **Reactions** | Limited | Full support | N/A |
| **Threading** | Reply-to | Native threads | N/A |

---

## Detailed Flow Diagrams

### Unified Message Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           MOLTBOT UNIFIED MESSAGE FLOW                      │
└────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │ WhatsApp │   │ Discord  │   │  Gmail   │
  └────┬─────┘   └────┬─────┘   └────┬─────┘
       │              │              │
       ▼              ▼              ▼
  ┌──────────┐   ┌──────────┐   ┌──────────┐
  │ Baileys  │   │  Carbon  │   │   gog    │
  │ Socket   │   │  Client  │   │  watch   │
  └────┬─────┘   └────┬─────┘   └────┬─────┘
       │              │              │
       │   WebSocket  │   WebSocket  │   HTTP POST
       ▼              ▼              ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         CHANNEL ADAPTER LAYER                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ monitorWebInbox │  │ DiscordMessage  │  │ createHooksReq  │             │
│  │      ()         │  │   Listener      │  │   Handler()     │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           ▼                    ▼                    ▼                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Extract:        │  │ Extract:        │  │ Extract:        │             │
│  │ - body          │  │ - content       │  │ - from          │             │
│  │ - sender        │  │ - author        │  │ - subject       │             │
│  │ - media         │  │ - attachments   │  │ - body          │             │
│  │ - group info    │  │ - guild/channel │  │ - snippet       │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
└───────────┼────────────────────┼────────────────────┼───────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           VALIDATION LAYER                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ checkInbound    │  │ preflightDiscord│  │ validateToken   │             │
│  │ AccessControl() │  │    Message()    │  │      ()         │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           ▼                    ▼                    ▼                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ - Allowlist     │  │ - DM Policy     │  │ - Hook token    │             │
│  │ - Group gating  │  │ - Guild access  │  │ - Path matching │             │
│  │ - Mention check │  │ - Mention check │  │                 │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
└───────────┼────────────────────┼────────────────────┼───────────────────────┘
            │                    │                    │
            └────────────────────┼────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           ROUTING LAYER (SHARED)                            │
│                                                                             │
│                      ┌─────────────────────┐                                │
│                      │  resolveAgentRoute  │                                │
│                      │        ()           │                                │
│                      └──────────┬──────────┘                                │
│                                 │                                           │
│                                 ▼                                           │
│                      ┌─────────────────────┐                                │
│                      │ Returns:            │                                │
│                      │ - agentId           │                                │
│                      │ - sessionKey        │                                │
│                      │ - channel           │                                │
│                      └──────────┬──────────┘                                │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           AGENT LAYER (SHARED)                              │
│                                                                             │
│                      ┌─────────────────────┐                                │
│                      │  getReplyFromConfig │                                │
│                      │        ()           │                                │
│                      └──────────┬──────────┘                                │
│                                 │                                           │
│                                 ▼                                           │
│                      ┌─────────────────────┐                                │
│                      │ runEmbeddedPiAgent  │                                │
│                      │        ()           │                                │
│                      └──────────┬──────────┘                                │
│                                 │                                           │
│                                 ▼                                           │
│                      ┌─────────────────────┐                                │
│                      │    LLM Provider     │                                │
│                      │ (Claude/GPT/Gemini) │                                │
│                      └──────────┬──────────┘                                │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           DISPATCH LAYER (SHARED)                           │
│                                                                             │
│                      ┌─────────────────────┐                                │
│                      │ createReplyDispatcher│                               │
│                      │        ()           │                                │
│                      └──────────┬──────────┘                                │
│                                 │                                           │
│                                 ▼                                           │
│                      ┌─────────────────────┐                                │
│                      │ Queue responses:    │                                │
│                      │ - Block replies     │                                │
│                      │ - Tool results      │                                │
│                      │ - Final reply       │                                │
│                      └──────────┬──────────┘                                │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
            ▼                     ▼                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           DELIVERY LAYER                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ deliverWebReply │  │ deliverDiscord  │  │ deliverOutbound │             │
│  │       ()        │  │    Reply()      │  │   Payloads()    │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           ▼                    ▼                    ▼                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ - Chunk text    │  │ - Chunk text    │  │ - Route to last │             │
│  │ - Send via      │  │ - Send via REST │  │   known channel │             │
│  │   Baileys       │  │ - Add reactions │  │ - Or default    │             │
│  │ - Retry logic   │  │ - Threading     │  │   (WhatsApp)    │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
└───────────┼────────────────────┼────────────────────┼───────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
       ┌─────────┐         ┌─────────┐         ┌─────────┐
       │WhatsApp │         │ Discord │         │ Any Chan│
       │ Server  │         │ Server  │         │  nel    │
       └─────────┘         └─────────┘         └─────────┘
```

---

## WhatsApp Flow

### Sequence Diagram

```
┌──────────┐ ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌─────────┐
│ WhatsApp │ │ Baileys │ │ Monitor  │ │ Router │ │ Agent  │ │Dispatcher│
└────┬─────┘ └────┬────┘ └────┬─────┘ └───┬────┘ └───┬────┘ └────┬────┘
     │            │           │           │          │           │
     │  message   │           │           │          │           │
     │───────────▶│           │           │          │           │
     │            │  upsert   │           │          │           │
     │            │──────────▶│           │          │           │
     │            │           │           │          │           │
     │            │           │ debounce  │          │           │
     │            │           │───┐       │          │           │
     │            │           │◀──┘       │          │           │
     │            │           │           │          │           │
     │            │           │  route    │          │           │
     │            │           │──────────▶│          │           │
     │            │           │           │          │           │
     │            │           │  agentId  │          │           │
     │            │           │◀──────────│          │           │
     │            │           │           │          │           │
     │            │           │ (group?) check mention           │
     │            │           │───┐       │          │           │
     │            │           │◀──┘       │          │           │
     │            │           │           │          │           │
     │            │           │  dispatch │          │           │
     │            │           │─────────────────────▶│           │
     │            │           │           │          │           │
     │            │           │           │          │  run Pi   │
     │            │           │           │          │───┐       │
     │            │           │           │          │◀──┘       │
     │            │           │           │          │           │
     │            │           │           │          │  reply    │
     │            │           │           │          │──────────▶│
     │            │           │           │          │           │
     │            │           │  deliver  │          │           │
     │            │◀──────────────────────────────────────────────
     │            │           │           │          │           │
     │   send     │           │           │          │           │
     │◀───────────│           │           │          │           │
     │            │           │           │          │           │
```

### Key Files

| Step | File | Function |
|------|------|----------|
| Connect | `src/web/session.ts` | `createWaSocket()` |
| Receive | `src/web/inbound/monitor.ts` | `monitorWebInbox()` |
| Validate | `src/web/auto-reply/monitor/on-message.ts` | `createWebOnMessageHandler()` |
| Route | `src/routing/resolve-route.ts` | `resolveAgentRoute()` |
| Process | `src/web/auto-reply/monitor/process-message.ts` | `processMessage()` |
| Execute | `src/agents/pi-embedded-runner/run.ts` | `runEmbeddedPiAgent()` |
| Deliver | `src/web/auto-reply/deliver-reply.ts` | `deliverWebReply()` |

### WhatsApp-Specific Features

- **QR Code Auth**: First-time login requires scanning QR code
- **Group Metadata**: Fetches participant list, subject, description
- **Read Receipts**: Sends read receipts on message reception
- **Location Messages**: Extracts latitude/longitude/address
- **Reply Context**: Includes quoted message in context
- **Presence Updates**: Shows "online" status

---

## Discord Flow

### Sequence Diagram

```
┌──────────┐ ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌─────────┐
│ Discord  │ │ Carbon  │ │ Listener │ │Preflight│ │ Agent  │ │ Send    │
│ Gateway  │ │ Client  │ │          │ │        │ │        │ │         │
└────┬─────┘ └────┬────┘ └────┬─────┘ └───┬────┘ └───┬────┘ └────┬────┘
     │            │           │           │          │           │
     │  READY     │           │           │          │           │
     │───────────▶│           │           │          │           │
     │            │           │           │          │           │
     │ MESSAGE_   │           │           │          │           │
     │ CREATE     │           │           │          │           │
     │───────────▶│           │           │          │           │
     │            │  handle   │           │          │           │
     │            │──────────▶│           │          │           │
     │            │           │           │          │           │
     │            │           │ debounce  │          │           │
     │            │           │───┐       │          │           │
     │            │           │◀──┘       │          │           │
     │            │           │           │          │           │
     │            │           │ preflight │          │           │
     │            │           │──────────▶│          │           │
     │            │           │           │          │           │
     │            │           │           │ validate │           │
     │            │           │           │ - DM policy          │
     │            │           │           │ - Guild access       │
     │            │           │           │ - Mention req        │
     │            │           │           │───┐      │           │
     │            │           │           │◀──┘      │           │
     │            │           │           │          │           │
     │            │           │   ok      │          │           │
     │            │           │◀──────────│          │           │
     │            │           │           │          │           │
     │            │           │  dispatch │          │           │
     │            │           │─────────────────────▶│           │
     │            │           │           │          │           │
     │            │           │           │          │  run Pi   │
     │            │           │           │          │───┐       │
     │            │           │           │          │◀──┘       │
     │            │           │           │          │           │
     │            │           │           │          │  reply    │
     │            │           │           │          │──────────▶│
     │            │           │           │          │           │
     │            │           │           │          │           │ chunk
     │            │           │           │          │           │──┐
     │            │           │           │          │           │◀─┘
     │            │           │           │          │           │
     │   REST     │           │           │          │           │
     │◀──────────────────────────────────────────────────────────│
     │            │           │           │          │           │
```

### Key Files

| Step | File | Function |
|------|------|----------|
| Connect | `src/discord/monitor/provider.ts` | `monitorDiscordProvider()` |
| Listen | `src/discord/monitor/listeners.ts` | `DiscordMessageListener` |
| Debounce | `src/discord/monitor/message-handler.ts` | `createDiscordDebouncer()` |
| Validate | `src/discord/monitor/message-handler.preflight.ts` | `preflightDiscordMessage()` |
| Process | `src/discord/monitor/message-handler.process.ts` | `processDiscordMessage()` |
| Execute | `src/agents/pi-embedded-runner/run.ts` | `runEmbeddedPiAgent()` |
| Deliver | `src/discord/monitor/reply-delivery.ts` | `deliverDiscordReply()` |
| Send | `src/discord/send.outbound.ts` | `sendMessageDiscord()` |

### Discord-Specific Features

- **Guilds & Channels**: Multi-server support with per-channel config
- **Threads**: Native thread support (public, private, forum)
- **Reactions**: Add/remove reactions, ack reactions on processing
- **Slash Commands**: Native Discord commands via `deployDiscordCommands()`
- **Presence**: Optional presence/status monitoring
- **Moderation**: Ban, kick, timeout, role management tools
- **Embeds**: Rich embed support for responses
- **2000 Char Limit**: Auto-chunking for long responses

---

## Gmail Flow

### Sequence Diagram

```
┌──────────┐ ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌─────────┐
│  Gmail   │ │  gog    │ │ Webhook  │ │ Hook   │ │ Cron   │ │Outbound │
│  Server  │ │  watch  │ │ Handler  │ │Mapping │ │ Agent  │ │ Deliver │
└────┬─────┘ └────┬────┘ └────┬─────┘ └───┬────┘ └───┬────┘ └────┬────┘
     │            │           │           │          │           │
     │  New email │           │           │          │           │
     │───────────▶│           │           │          │           │
     │            │           │           │          │           │
     │            │ Pub/Sub   │           │          │           │
     │            │ push      │           │          │           │
     │            │──────────▶│           │          │           │
     │            │           │           │          │           │
     │            │           │ POST      │          │           │
     │            │           │ /hooks/   │          │           │
     │            │           │ gmail     │          │           │
     │            │           │───┐       │          │           │
     │            │           │◀──┘       │          │           │
     │            │           │           │          │           │
     │            │           │ validate  │          │           │
     │            │           │ token     │          │           │
     │            │           │───┐       │          │           │
     │            │           │◀──┘       │          │           │
     │            │           │           │          │           │
     │            │           │  match    │          │           │
     │            │           │──────────▶│          │           │
     │            │           │           │          │           │
     │            │           │           │ template │           │
     │            │           │           │ render   │           │
     │            │           │           │───┐      │           │
     │            │           │           │◀──┘      │           │
     │            │           │           │          │           │
     │            │           │           │ dispatch │           │
     │            │           │           │─────────▶│           │
     │            │           │           │          │           │
     │            │           │           │          │  run Pi   │
     │            │           │           │          │  (isolated)
     │            │           │           │          │───┐       │
     │            │           │           │          │◀──┘       │
     │            │           │           │          │           │
     │            │           │           │          │  deliver  │
     │            │           │           │          │──────────▶│
     │            │           │           │          │           │
     │            │           │           │          │           │ route to
     │            │           │           │          │           │ last chan
     │            │           │           │          │           │──┐
     │            │           │           │          │           │◀─┘
     │            │           │           │          │           │
     └─────────────────────────────────────────────────◀─────────│
                  (Response via WhatsApp/Discord/Telegram/etc)
```

### Key Files

| Step | File | Function |
|------|------|----------|
| Watch | `src/hooks/gmail-watcher.ts` | `startGmailWatcher()` |
| Receive | `src/gateway/server-http.ts` | `createHooksRequestHandler()` |
| Match | `src/gateway/hooks-mapping.ts` | `applyHookMappings()` |
| Template | `src/gateway/hooks-mapping.ts` | `renderTemplate()` |
| Dispatch | `src/gateway/server/hooks.ts` | `dispatchAgentHook()` |
| Execute | `src/cron/isolated-agent/run.ts` | `runCronIsolatedAgentTurn()` |
| Deliver | `src/infra/outbound/deliver.ts` | `deliverOutboundPayloads()` |

### Gmail-Specific Features

- **Pub/Sub Push**: Uses Google Cloud Pub/Sub for real-time notifications
- **gog CLI**: External CLI handles Gmail API, OAuth, watch registration
- **Template Rendering**: `{{messages[0].from}}`, `{{messages[0].subject}}`
- **Isolated Sessions**: Each email creates isolated agent session
- **Cross-Channel Delivery**: Responses go to last-used channel (WhatsApp default)
- **No Direct Reply**: Cannot reply to emails (use gog CLI tool if needed)
- **Webhook Auth**: Token-based authentication for security

---

## Similarities Across Channels

### 1. Message Reception Pattern

All channels follow the same pattern:
```typescript
// Pseudocode - common pattern
async function onMessage(rawMessage) {
  // 1. Extract normalized message
  const msg = extractMessage(rawMessage)

  // 2. Debounce (optional)
  await debouncer.enqueue(msg)

  // 3. Validate access
  if (!validateAccess(msg)) return

  // 4. Route to agent
  const route = await resolveAgentRoute(msg)

  // 5. Dispatch
  await dispatchToAgent(msg, route)
}
```

### 2. Shared Routing Logic

All channels use `resolveAgentRoute()` with the same interface:

```typescript
// src/routing/resolve-route.ts
interface RouteInput {
  channel: string           // 'whatsapp' | 'discord' | 'gmail' | ...
  accountId: string         // Account identifier
  peer: {
    kind: 'dm' | 'group' | 'channel' | 'hook'
    id: string              // Phone, user ID, channel ID, etc.
  }
}

interface ResolvedRoute {
  agentId: string
  sessionKey: string
  mainSessionKey: string
  matchedBy: string
}
```

### 3. Shared Agent Execution

All channels ultimately call the same agent runner:

```typescript
// src/agents/pi-embedded-runner/run.ts
const result = await runEmbeddedPiAgent({
  sessionKey,
  message: userMessage,
  model,
  tools,
  onBlockReply,
  onToolResult,
})
```

### 4. Shared Reply Dispatcher

All channels use the same dispatcher pattern:

```typescript
// src/auto-reply/reply/reply-dispatcher.ts
const dispatcher = createReplyDispatcher({
  deliver: (payload) => channelSpecificDeliver(payload),
  onIdle: () => cleanup(),
})

dispatcher.sendBlockReply(chunk)
dispatcher.sendFinalReply(response)
await dispatcher.waitForIdle()
```

### 5. Common Configuration Structure

```json5
{
  channels: {
    whatsapp: { /* channel-specific */ },
    discord: { /* channel-specific */ },
  },
  hooks: {
    gmail: { /* webhook-specific */ },
  },
  routing: {
    bindings: [
      // Shared routing rules
    ],
    default: { agentId: 'main' }
  },
  agents: {
    // Shared agent config
  }
}
```

---

## Key Differences

### 1. Connection Model

| Channel | Model | Implication |
|---------|-------|-------------|
| WhatsApp | Persistent WebSocket | Always connected, real-time |
| Discord | Persistent WebSocket | Always connected, real-time |
| Gmail | HTTP Webhooks | Stateless, push-based |

### 2. Authentication

| Channel | Auth Type | User Action Required |
|---------|-----------|---------------------|
| WhatsApp | QR Code | Scan with phone |
| Discord | Bot Token | Create bot, copy token |
| Gmail | OAuth2 | Create GCP project, authorize |

### 3. Message Threading

| Channel | Threading Model |
|---------|-----------------|
| WhatsApp | Reply-to (quote) |
| Discord | Native threads, forums |
| Gmail | Email threads (not used) |

### 4. Response Delivery

| Channel | Direct Reply | Cross-Channel |
|---------|--------------|---------------|
| WhatsApp | Yes | No |
| Discord | Yes | No |
| Gmail | No | Yes (always) |

### 5. Access Control

| Channel | Allowlist Granularity |
|---------|-----------------------|
| WhatsApp | Phone numbers, groups |
| Discord | Users, channels, guilds, roles |
| Gmail | N/A (single inbox) |

### 6. Rich Features

| Feature | WhatsApp | Discord | Gmail |
|---------|----------|---------|-------|
| Reactions | Limited | Full | No |
| Threads | No | Yes | No |
| Embeds | No | Yes | No |
| Slash Commands | No | Yes | No |
| Typing Indicator | Yes | Yes | No |
| Read Receipts | Yes | No | No |
| Media Upload | Yes | Yes | No |

---

## Data Structure Comparison

### Inbound Message

```typescript
// WhatsApp
interface WebInboundMsg {
  from: string              // JID
  body: string
  chatType: 'dm' | 'group'
  senderE164: string
  groupSubject?: string
  mediaPath?: string
  replyToId?: string
  mentionedJids?: string[]
}

// Discord
interface DiscordInboundMsg {
  author: { id: string, username: string }
  content: string
  channelId: string
  guildId?: string
  attachments: Attachment[]
  referencedMessage?: Message
  mentions: User[]
}

// Gmail (webhook payload)
interface GmailHookPayload {
  messages: [{
    id: string
    from: string
    subject: string
    snippet: string
    body?: string
  }]
}
```

### Session Key Format

| Channel | Format | Example |
|---------|--------|---------|
| WhatsApp | `agent:<agentId>:whatsapp:<accountId>:dm:<phone>` | `agent:main:whatsapp:default:dm:+1234567890` |
| WhatsApp Group | `agent:<agentId>:whatsapp:<accountId>:group:<jid>` | `agent:main:whatsapp:default:group:123@g.us` |
| Discord DM | `agent:<agentId>:discord:<accountId>:user:<userId>` | `agent:main:discord:default:user:123456789` |
| Discord Channel | `agent:<agentId>:discord:<accountId>:channel:<channelId>` | `agent:main:discord:default:channel:987654321` |
| Gmail | `hook:gmail:<messageId>` | `hook:gmail:18a1b2c3d4e5f6` |

---

## Adding a New Channel

To add a new channel, implement these components:

### 1. Channel Adapter (Required)

```typescript
// src/<channel>/monitor.ts
export async function monitor<Channel>Channel(options: Options) {
  // Connect to platform
  const client = await connect()

  // Register message handler
  client.on('message', async (raw) => {
    // Extract normalized message
    const msg = extractMessage(raw)

    // Validate
    if (!validate(msg)) return

    // Route
    const route = await resolveAgentRoute({
      channel: '<channel>',
      accountId: options.accountId,
      peer: { kind: msg.chatType, id: msg.peerId }
    })

    // Dispatch
    await dispatchInboundMessage({
      ctx: buildContext(msg, route),
      deliver: (reply) => deliver<Channel>Reply(msg, reply),
    })
  })
}
```

### 2. Delivery Function (Required)

```typescript
// src/<channel>/deliver.ts
export async function deliver<Channel>Reply(
  msg: InboundMsg,
  reply: ReplyPayload
) {
  // Chunk if needed
  const chunks = chunkText(reply.text, MAX_LENGTH)

  // Send each chunk
  for (const chunk of chunks) {
    await client.send(msg.replyTo, chunk)
  }
}
```

### 3. Channel Plugin (Optional)

```typescript
// extensions/<channel>/src/channel.ts
export const <channel>Plugin: ChannelPlugin = {
  id: '<channel>',
  name: '<Channel>',

  async start(runtime) {
    await monitor<Channel>Channel(runtime.options)
  },

  async stop() {
    await disconnect()
  },

  async send(to, payload) {
    await sendMessage(to, payload)
  }
}
```

### 4. Configuration Schema

```typescript
// Add to config schema
channels: {
  <channel>: {
    enabled: Type.Boolean(),
    token: Type.String(),
    // Channel-specific options
  }
}
```

---

## Related Documentation

- [WhatsApp Message Flow](./whatsapp-message-flow.md)
- [Gateway Architecture](./gateway.md)
- [Agent Configuration](/configuration)
- [Hooks System](/configuration#hooks)
- [Channel Plugins](/extensions)
