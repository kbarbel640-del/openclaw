# OpenClaw-MABOS: Gateway and Channel Integration System

> **Document type:** Definitive Technical Reference
> **Subsystem:** Gateway Server & Channel Integration Architecture
> **Source scope:** `src/gateway/` (141 TypeScript source files), `src/channels/` (88 TypeScript source files), `extensions/` (25+ channel extensions)
> **Last updated:** 2026-02-24
> **Status:** Canonical

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Server Core](#3-server-core)
4. [Authentication Architecture](#4-authentication-architecture)
5. [WebSocket Protocol](#5-websocket-protocol)
6. [Role and Scope System](#6-role-and-scope-system)
7. [HTTP API Surface](#7-http-api-surface)
8. [OpenAI Compatibility Layer](#8-openai-compatibility-layer)
9. [OpenResponses API](#9-openresponses-api)
10. [RPC Method Catalog](#10-rpc-method-catalog)
11. [Channel Integration Architecture](#11-channel-integration-architecture)
12. [Channel Lifecycle Management](#12-channel-lifecycle-management)
13. [Channel Health Monitoring](#13-channel-health-monitoring)
14. [Channel Plugin Architecture](#14-channel-plugin-architecture)
15. [Per-Channel Normalizers](#15-per-channel-normalizers)
16. [Per-Channel Outbound](#16-per-channel-outbound)
17. [Channel Onboarding](#17-channel-onboarding)
18. [Message Flow](#18-message-flow)
19. [Chat System](#19-chat-system)
20. [Webhook System](#20-webhook-system)
21. [Control UI](#21-control-ui)
22. [Exec Approval System](#22-exec-approval-system)
23. [Node Device Management](#23-node-device-management)
24. [Config Hot-Reload](#24-config-hot-reload)
25. [Security Architecture](#25-security-architecture)
26. [Event Broadcasting](#26-event-broadcasting)
27. [Networking](#27-networking)
28. [Protocol Schema](#28-protocol-schema)
29. [Bundled Channel Extensions Catalog](#29-bundled-channel-extensions-catalog)
30. [File Inventory](#30-file-inventory)
31. [References to Companion Documents](#31-references-to-companion-documents)

---

## 1. Executive Summary

The OpenClaw-MABOS Gateway is the central communication hub that mediates all external interaction between the outside world and the OpenClaw agent system. It is a single-process server built on Express 5.2 and the `ws` WebSocket library, exposing a unified surface for:

- **WebSocket RPC** -- Real-time bidirectional communication with CLI clients, control UIs, and device nodes. All RPC methods are multiplexed over a single WebSocket connection using a custom framing protocol with UUID-correlated request/response pairs.
- **HTTP REST APIs** -- OpenAI-compatible `/v1/chat/completions`, OpenResponses `/v1/responses`, webhook ingestion (`/hooks`), control UI static serving, health probes, and canvas capability URLs.
- **Channel integrations** -- 25+ messaging platforms (Discord, Slack, Telegram, WhatsApp, Signal, Matrix, LINE, iMessage, IRC, Nostr, Feishu, Google Chat, MS Teams, Mattermost, and more) connected through a two-layer architecture: the gateway-level channel manager handles lifecycle, health, and restart logic; the channel plugin system handles per-platform normalization, outbound delivery, onboarding, and actions.
- **Device nodes** -- Mobile (iOS, Android) and desktop (macOS, Linux, Windows) device endpoints that expose platform-native capabilities (camera, contacts, calendar, location, system commands) to the agent system through a gated command policy.

The gateway is the only process that holds open connections to external platforms. All agent logic runs behind it. Every inbound message -- whether from a WebSocket client, an HTTP request, a webhook, or a channel platform -- is normalized into a common internal format, routed to the appropriate agent, and the agent's response is delivered back through the originating channel's outbound adapter.

Key design invariants:

- **Single process, in-memory state.** The gateway runs as one Node.js process. All rate-limit counters, channel runtime snapshots, exec approval records, and broadcast sequence numbers live in memory. This simplifies consistency at the cost of requiring restart for certain configuration changes.
- **Defense in depth.** Four authentication strategies, Ed25519 device identity signatures, sliding-window rate limiting, CSRF origin checking, TLS fingerprint pinning, capability tokens, and platform-specific command allowlists.
- **Graceful degradation.** Channels auto-restart with exponential backoff. A background health monitor detects stuck or crashed channels and restarts them within bounds. Slow WebSocket consumers are detected and either dropped or force-closed.

---

## 2. Architecture Overview

The following ASCII diagram illustrates the major subsystems and data flows within the gateway:

```
                                     EXTERNAL CLIENTS
                    ┌─────────────────────────────────────────────────┐
                    │  CLI   Control UI   Mobile App   Third-Party   │
                    └────┬───────┬──────────┬──────────────┬─────────┘
                         │       │          │              │
                    WebSocket  HTTP/WS    WebSocket      HTTP
                         │       │          │              │
    ═════════════════════╪═══════╪══════════╪══════════════╪═══════════════
                         │       │          │              │
                    ┌────▼───────▼──────────▼──────────────▼─────────┐
                    │              GATEWAY SERVER                      │
                    │  ┌──────────────────────────────────────────┐   │
                    │  │           Authentication Layer            │   │
                    │  │  Token │ Password │ Tailscale │ Proxy    │   │
                    │  │  Rate Limiter │ Device Identity (Ed25519) │   │
                    │  └──────────────────┬───────────────────────┘   │
                    │                     │                           │
                    │  ┌──────────────────▼───────────────────────┐   │
                    │  │         Transport Demultiplexer           │   │
                    │  │                                           │   │
                    │  │  ┌──────────┐ ┌───────────┐ ┌─────────┐  │   │
                    │  │  │WebSocket │ │  HTTP API  │ │ Webhook │  │   │
                    │  │  │  RPC     │ │ /v1/chat   │ │ /hooks  │  │   │
                    │  │  │Protocol  │ │ /v1/resp   │ │         │  │   │
                    │  │  └────┬─────┘ └─────┬──────┘ └────┬────┘  │   │
                    │  └───────┼─────────────┼─────────────┼──────┘   │
                    │          │             │             │           │
                    │  ┌───────▼─────────────▼─────────────▼──────┐   │
                    │  │             RPC Method Router              │   │
                    │  │  agent │ chat │ channels │ sessions │ ... │   │
                    │  └───────────────────┬──────────────────────┘   │
                    │                      │                          │
                    │  ┌───────────────────▼──────────────────────┐   │
                    │  │           Chat Run Lifecycle              │   │
                    │  │  Registry │ Abort │ Attachments │ Stream  │   │
                    │  └───────────────────┬──────────────────────┘   │
                    │                      │                          │
                    │  ┌───────────────────▼──────────────────────┐   │
                    │  │         Event Broadcasting                │   │
                    │  │  Scope-gated │ Seq numbers │ Slow detect  │   │
                    │  └───────────────────┬──────────────────────┘   │
                    │                      │                          │
                    │  ┌───────────────────▼──────────────────────┐   │
                    │  │         Channel Manager                   │   │
                    │  │  Lifecycle │ Multi-account │ Auto-restart  │   │
                    │  │  Health Monitor │ Runtime Snapshots        │   │
                    │  └───────┬───────────┬───────────┬──────────┘   │
                    └──────────┼───────────┼───────────┼──────────────┘
                               │           │           │
               ┌───────────────▼──┐ ┌──────▼─────┐ ┌──▼──────────────┐
               │  Channel Plugin  │ │  Channel   │ │  Channel Plugin │
               │  (Discord)       │ │  Plugin    │ │  (WhatsApp)     │
               │  normalize       │ │  (Slack)   │ │  normalize      │
               │  outbound        │ │  normalize │ │  outbound       │
               │  onboarding      │ │  outbound  │ │  onboarding     │
               │  actions         │ │  onboard   │ │  actions        │
               └────────┬─────────┘ └─────┬──────┘ └──┬──────────────┘
                        │                 │            │
                   ┌────▼────┐    ┌───────▼──┐   ┌────▼───────┐
                   │ Discord │    │  Slack   │   │  WhatsApp  │
                   │   API   │    │   API    │   │   API      │
                   └─────────┘    └──────────┘   └────────────┘
                        ... (25+ platforms total)
```

Data flow summary:

1. **Inbound path:** External message arrives via WebSocket frame, HTTP request, webhook POST, or channel platform callback. The gateway authenticates the source, normalizes the payload, routes it to the agent system, and tracks the resulting chat run.
2. **Outbound path:** The agent produces a response (streamed or final). The gateway broadcasts delta events to WebSocket subscribers, converts the response to the originating platform's format via the outbound adapter, and delivers it.
3. **Control path:** Configuration changes, channel start/stop, device pairing, exec approvals, and cron management flow through the RPC method router with role and scope checks.

---

## 3. Server Core

### 3.1 Server Factory

The gateway server is created by `startGatewayServer()` in `server.impl.ts`. This function:

1. Creates an Express 5.2 application instance.
2. Attaches a Node.js HTTP server (or HTTPS if TLS is configured).
3. Creates a `ws` WebSocket server bound to the same HTTP server.
4. Mounts all HTTP routes (OpenAI, OpenResponses, webhooks, control UI, health probes).
5. Initializes the channel manager, health monitor, cron scheduler, and event broadcaster.
6. Returns a `GatewayServer` object with lifecycle methods.

**Source files:**

- `src/gateway/server.ts` -- Re-exports `startGatewayServer` and `GatewayServer`/`GatewayServerOptions` types.
- `src/gateway/server.impl.ts` -- Full implementation of the server factory.

### 3.2 Bootstrap Sequence

The startup sequence is orchestrated by `server-startup.ts` with two companion modules:

- `server-startup-memory.ts` -- Initializes the memory subsystem at startup. This ensures session stores, agent state, and any persistent memory backends are loaded before the server begins accepting connections.
- `server-startup-log.ts` -- Emits startup diagnostics including the resolved bind address, authentication mode, active channels, loaded plugins, and any configuration warnings.

### 3.3 Boot-Once System

The boot-once system (`boot.ts`) provides a mechanism for running a one-time agent task when the gateway starts for the first time (or after a clean restart). It works as follows:

1. On startup, the gateway checks for a `BOOT.md` file in the workspace directory.
2. If found and non-empty, the file content is wrapped in a boot prompt and sent to the agent system.
3. A unique boot session ID is generated in the format `boot-YYYY-MM-DD_HH-MM-SS-<8-char-uuid>`.
4. The agent executes the instructions in `BOOT.md` (e.g., sending startup notifications, running health checks).
5. The result is one of three statuses: `skipped` (file missing or empty), `ran` (success), or `failed` (with reason).

The boot prompt instructs the agent to follow BOOT.md instructions exactly, use the message tool for sending messages (with the `target` field, not `to`), and reply with only the silent reply token when nothing needs attention.

### 3.4 Server Constants and Shared State

- `server-constants.ts` -- Defines server-wide constants including `MAX_BUFFERED_BYTES` for WebSocket backpressure detection.
- `server-shared.ts` -- Shared mutable server state accessible across subsystems.
- `server-utils.ts` -- General-purpose server utility functions.
- `server-runtime-state.ts` -- Runtime state container for the server process.

---

## 4. Authentication Architecture

The gateway implements a layered authentication system with four distinct strategies, device identity verification, and sliding-window rate limiting. All auth logic is centralized in `auth.ts` with supporting modules for rate limiting, device identity, and startup initialization.

### 4.1 Authentication Strategies

The function `resolveGatewayAuth()` resolves the active authentication configuration from the config file and environment variables. The function `authorizeGatewayConnect()` evaluates a connection attempt against the resolved auth config.

**Strategy 1: Token Authentication**

- Source: `OPENCLAW_GATEWAY_TOKEN` environment variable or `gateway.token` config field.
- Mechanism: The client provides a bearer token that must match the configured token exactly (constant-time comparison via `safeEqualSecret()`).
- Use case: CLI clients, API integrations, automated scripts.

**Strategy 2: Password Authentication**

- Source: `OPENCLAW_GATEWAY_PASSWORD` environment variable or `gateway.password` config field.
- Mechanism: The client provides a password that must match the configured password exactly.
- Use case: Human operators accessing the control UI, simpler setups where token management is overhead.

**Strategy 3: Tailscale Whois Verification**

- Source: Enabled when the gateway detects it is running on a Tailscale network.
- Mechanism: The gateway calls the Tailscale whois API to verify the identity of the connecting IP address. The whois response includes the Tailscale user's login name, display name, and profile picture. The login is normalized (trimmed, lowercased) for matching.
- Trusted proxies for Tailscale are hardcoded to `["127.0.0.1", "::1"]`.
- Auth surface control: Tailscale forwarded-header auth is disabled for plain HTTP requests but enabled for WebSocket control UI connections (for tokenless trusted-host login).

**Strategy 4: Trusted Proxy Authentication**

- Source: `gateway.trustedProxy` config section.
- Mechanism: The gateway validates that the request originates from an IP in the trusted proxy list (supports both individual IPs and CIDR ranges via `isTrustedProxyAddress()`). If trusted, it extracts the user identity from a configurable header (typically `X-Forwarded-User` or similar).
- Use case: Running behind a reverse proxy (nginx, Caddy, Traefik) that handles authentication.

**Resolved auth types:**

```typescript
export type ResolvedGatewayAuthMode = "none" | "token" | "password" | "trusted-proxy";

export type GatewayAuthResult = {
  ok: boolean;
  method?: "none" | "token" | "password" | "tailscale" | "device-token" | "trusted-proxy";
  user?: string;
  reason?: string;
  rateLimited?: boolean;
  retryAfterMs?: number;
};
```

### 4.2 Rate Limiting

The rate limiter (`auth-rate-limit.ts`) implements a sliding-window algorithm with per-scope, per-IP tracking:

**Configuration defaults:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxAttempts` | 10 | Maximum failed attempts before lockout |
| `windowMs` | 60,000 ms (1 min) | Sliding window duration |
| `lockoutMs` | 300,000 ms (5 min) | Lockout duration after exceeding limit |
| `exemptLoopback` | true | Localhost addresses are never rate-limited |
| `pruneIntervalMs` | 60,000 ms | Background cleanup interval |

**Four independent scopes:**

1. `default` -- General-purpose scope.
2. `shared-secret` -- For token/password authentication attempts.
3. `device-token` -- For device token authentication attempts.
4. `hook-auth` -- For webhook authentication attempts.

Each scope maintains independent counters, so a brute-force attack against the token endpoint does not affect device token authentication. Loopback addresses (`127.0.0.1`, `::1`, `::ffff:127.*`) are exempt by default to prevent local CLI sessions from being locked out.

The `AuthRateLimiter` interface provides:

- `check(ip, scope)` -- Returns whether the IP is allowed, remaining attempts, and retry-after time.
- `recordFailure(ip, scope)` -- Records a failed attempt.
- `reset(ip, scope)` -- Resets state after successful login.
- `prune()` -- Removes expired entries.
- `dispose()` -- Cancels periodic cleanup timers.

### 4.3 Device Identity (Ed25519)

Every gateway client (CLI, mobile app, control UI) has a persistent device identity based on an Ed25519 keypair. The device auth system (`device-auth.ts`) provides cryptographic proof of client identity during the WebSocket handshake.

**Payload format:**

```
v2|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce
```

The fields are pipe-delimited. The `v2` prefix indicates the payload version. The payload is signed with the device's Ed25519 private key, and the server verifies the signature using the device's registered public key.

**Key management:**

- `loadOrCreateDeviceIdentity()` -- Loads an existing Ed25519 keypair from disk or generates a new one.
- `publicKeyRawBase64UrlFromPem()` -- Extracts the raw public key in base64url encoding from PEM format.
- `signDevicePayload()` -- Signs the concatenated payload string.
- `storeDeviceAuthToken()` / `loadDeviceAuthToken()` / `clearDeviceAuthToken()` -- Persist device auth tokens across sessions.

### 4.4 Auth Startup

`startup-auth.ts` initializes the authentication subsystem during server startup:

- Resolves the gateway auth configuration from config + environment.
- Creates the rate limiter instance.
- Logs the active authentication mode.

### 4.5 Probe Auth

`probe-auth.ts` handles health probe authentication credentials, allowing monitoring systems to authenticate with the gateway's health endpoints without requiring full operator credentials.

---

## 5. WebSocket Protocol

The gateway uses a custom WebSocket protocol for all real-time communication. The protocol supports request/response RPC with UUID correlation, server-pushed events with sequential numbering, and a challenge/response authentication handshake.

### 5.1 Connection Handshake

The WebSocket connection flow is a two-phase handshake:

**Phase 1: Challenge**

The server sends a `connect.challenge` frame immediately after the WebSocket connection is established:

```json
{
  "type": "connect.challenge",
  "nonce": "<random-nonce>"
}
```

The nonce is a server-generated random value that the client must include in its signed device identity payload. This prevents replay attacks.

**Phase 2: Connect Response**

The client responds with its authentication credentials and signed device identity:

```json
{
  "type": "connect",
  "params": {
    "token": "<bearer-token>",
    "clientName": "cli",
    "clientVersion": "1.2.3",
    "platform": "darwin",
    "mode": "interactive",
    "role": "operator",
    "scopes": [
      "operator.admin",
      "operator.read",
      "operator.write",
      "operator.approvals",
      "operator.pairing"
    ],
    "deviceIdentity": {
      "deviceId": "<uuid>",
      "publicKey": "<base64url-ed25519-pubkey>",
      "signature": "<base64url-signature>",
      "signedPayload": "v2|deviceId|clientId|mode|role|scopes|timestamp|token|nonce"
    }
  }
}
```

The server verifies:

1. The token/password matches the configured auth (or Tailscale/trusted-proxy is valid).
2. The Ed25519 signature is valid for the signed payload.
3. The nonce in the signed payload matches the challenge nonce.
4. The role and scopes are permitted for the device.

On success, the server sends a `hello.ok` frame containing the negotiated protocol version and server capabilities. On failure, the connection is closed with a policy violation code (1008).

**Source files:**

- `server/ws-connection.ts` -- WebSocket connection handling.
- `server/ws-connection/auth-messages.ts` -- Auth message protocol.
- `server/ws-connection/connect-policy.ts` -- Connection acceptance policy.
- `server/ws-connection/message-handler.ts` -- Message routing.

### 5.2 Frame Types

The protocol defines three frame types:

**Request frame (client to server):**

```json
{
  "type": "request",
  "id": "<uuid>",
  "method": "chat.send",
  "params": { ... }
}
```

**Response frame (server to client):**

```json
{
  "type": "response",
  "id": "<uuid>",
  "result": { ... }
}
```

Or on error:

```json
{
  "type": "response",
  "id": "<uuid>",
  "error": { "code": "...", "message": "..." }
}
```

**Event frame (server to client, broadcast):**

```json
{
  "type": "event",
  "event": "agent.delta",
  "payload": { ... },
  "seq": 42,
  "stateVersion": { "presence": 5, "health": 12 }
}
```

Events carry a monotonically increasing sequence number (`seq`) for gap detection. Targeted events (sent to specific connection IDs) omit the sequence number.

### 5.3 Keepalive and Timeout

- **Tick interval:** The server sends periodic tick frames at the interval specified in the connection policy (default 30 seconds).
- **Gap detection:** The client tracks the last tick timestamp. If no tick is received within 2x the expected interval, the client considers the connection stale and initiates reconnection.
- **Max payload size:** 25 MB. Messages exceeding this are rejected.

### 5.4 Reconnection Strategy

The `GatewayClient` class implements exponential backoff reconnection:

| Parameter       | Value                   |
| --------------- | ----------------------- |
| Initial backoff | 1,000 ms                |
| Maximum backoff | 30,000 ms               |
| Strategy        | Exponential with jitter |

The client maintains a `closed` flag to distinguish intentional disconnects from transient failures. Reconnection is only attempted when `closed` is false.

### 5.5 Security: Plaintext Blocking

The `GatewayClient` implements a critical security control (CWE-319 mitigation, CVSS 9.8): all plaintext `ws://` connections to non-loopback addresses are blocked. Only `wss://` (TLS) is permitted for remote connections. Additionally, the client supports TLS fingerprint pinning for `wss://` connections, verifying the server's certificate fingerprint against a known value.

```typescript
// From client.ts -- connection URL validation
if (!isSecureWebSocketUrl(url) && !isLoopbackAddress(host)) {
  // Block plaintext ws:// to non-loopback -- CWE-319
  throw new Error("Plaintext WebSocket connections to non-loopback addresses are blocked");
}
```

### 5.6 WebSocket Logging

- `ws-logging.ts` -- General WebSocket logging utilities.
- `ws-log.ts` -- Structured logging for WebSocket events with `formatForLog()` and `summarizeAgentEventForWsLog()` helpers. Includes a `shouldLogWs()` guard for conditional logging.

### 5.7 WebSocket Type Definitions

`server/ws-types.ts` defines the `GatewayWsClient` type representing a connected WebSocket client with its connection metadata, role, scopes, device identity, and buffered state.

---

## 6. Role and Scope System

The gateway enforces a two-tier authorization model: roles define the broad category of a client, and scopes provide fine-grained method access within a role.

### 6.1 Roles

Two roles are defined in `role-policy.ts`:

```typescript
export const GATEWAY_ROLES = ["operator", "node"] as const;
```

| Role       | Description                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `operator` | Human operators and CLI clients. Can access all operator-scoped methods based on their scopes. Operators authenticated via shared secret (token/password) may skip device identity verification. |
| `node`     | Device nodes (iOS, Android, macOS, etc.). Can only access node-specific methods: `node.invoke.result`, `node.event`, `skills.bins`.                                                              |

Role authorization is checked by `isRoleAuthorizedForMethod()`:

- If the method is in the `NODE_ROLE_METHODS` set, only `node` role is authorized.
- For all other methods, only `operator` role is authorized.

### 6.2 Operator Scopes

Five scopes are defined in `method-scopes.ts`:

```typescript
export const ADMIN_SCOPE = "operator.admin";
export const READ_SCOPE = "operator.read";
export const WRITE_SCOPE = "operator.write";
export const APPROVALS_SCOPE = "operator.approvals";
export const PAIRING_SCOPE = "operator.pairing";
```

The CLI default grants all five scopes:

```typescript
export const CLI_DEFAULT_OPERATOR_SCOPES: OperatorScope[] = [
  ADMIN_SCOPE,
  READ_SCOPE,
  WRITE_SCOPE,
  APPROVALS_SCOPE,
  PAIRING_SCOPE,
];
```

### 6.3 Method-to-Scope Mapping

Each operator scope grants access to a specific set of RPC methods:

**`operator.approvals` scope:**

- `exec.approval.request`
- `exec.approval.waitDecision`
- `exec.approval.resolve`

**`operator.pairing` scope:**

- `node.pair.request`, `node.pair.list`, `node.pair.approve`, `node.pair.reject`, `node.pair.verify`
- `device.pair.list`, `device.pair.approve`, `device.pair.reject`, `device.pair.remove`
- `device.token.rotate`, `device.token.revoke`
- `node.rename`

**`operator.read` scope:**

- `health`, `logs.tail`, `channels.status`, `status`, `usage.status`, `usage.cost`
- `tts.status`, `tts.providers`, `models.list`, `agents.list`, `agent.identity.get`
- `skills.status`, `voicewake.get`
- `sessions.list`, `sessions.preview`, `sessions.resolve`, `sessions.usage`, `sessions.usage.timeseries`, `sessions.usage.logs`
- `cron.list`, `cron.status`, `cron.runs`
- `system-presence`, `last-heartbeat`
- `node.list`, `node.describe`
- `chat.history`, `config.get`, `talk.config`
- `agents.files.list`, `agents.files.get`

**`operator.write` scope (includes all read methods):**

- `send`, `poll`, `agent`, `agent.wait`, `wake`
- `talk.mode`, `tts.enable`, `tts.disable`, `tts.convert`, `tts.setProvider`
- `voicewake.set`, `node.invoke`
- `chat.send`, `chat.abort`, `browser.request`, `push.test`

**`operator.admin` scope (includes everything):**

- `channels.logout`
- `agents.create`, `agents.update`, `agents.delete`
- `skills.install`, and all other administrative operations
- The admin scope is a superset: a client with `operator.admin` can invoke any operator method.

### 6.4 Scope Resolution in Broadcasting

The event broadcasting system also uses scopes to gate which clients receive which events:

```typescript
const EVENT_SCOPE_GUARDS: Record<string, string[]> = {
  "exec.approval.requested": [APPROVALS_SCOPE],
  "exec.approval.resolved": [APPROVALS_SCOPE],
  "device.pair.requested": [PAIRING_SCOPE],
  "device.pair.resolved": [PAIRING_SCOPE],
  "node.pair.requested": [PAIRING_SCOPE],
  "node.pair.resolved": [PAIRING_SCOPE],
};
```

Clients with `operator.admin` scope bypass all scope guards.

---

## 7. HTTP API Surface

The gateway exposes several HTTP endpoints alongside the WebSocket server. All HTTP handling is built on Express 5.2 with a consistent set of response helpers and security headers.

### 7.1 Route Mounting

- `server-http.ts` -- Mounts all HTTP routes on the Express application.
- `server/http-listen.ts` -- Binds the HTTP server to the configured address and port.
- `server/plugins-http.ts` -- Mounts plugin-provided HTTP routes.

### 7.2 Response Helpers

`http-common.ts` provides standardized response functions:

| Helper                                | Purpose                                                  |
| ------------------------------------- | -------------------------------------------------------- |
| `sendJson(res, status, body)`         | Send JSON response with `Content-Type: application/json` |
| `sendText(res, status, text)`         | Send plaintext response                                  |
| `sendUnauthorized(res, reason?)`      | Send 401 with optional reason                            |
| `sendRateLimited(res, retryAfterMs?)` | Send 429 with `Retry-After` header                       |
| `setSseHeaders(res)`                  | Set headers for Server-Sent Events streaming             |
| `writeDone(res)`                      | Write the SSE `[DONE]` terminator and end the response   |

### 7.3 Security Headers

All HTTP responses include:

| Header                   | Value         | Purpose                    |
| ------------------------ | ------------- | -------------------------- |
| `X-Content-Type-Options` | `nosniff`     | Prevent MIME type sniffing |
| `Referrer-Policy`        | `no-referrer` | Prevent referrer leakage   |

The control UI adds additional headers (see Section 21).

### 7.4 Auth Helpers

`http-auth-helpers.ts` provides bearer token extraction and validation from HTTP requests:

- Extracts `Authorization: Bearer <token>` headers.
- Validates against the resolved gateway auth configuration.
- Integrates with the rate limiter for failed attempts.

### 7.5 Endpoint Helpers

`http-endpoint-helpers.ts` provides a reusable `handleGatewayPostJsonEndpoint()` function that encapsulates the common pattern for POST JSON endpoints:

1. Validate HTTP method (POST only).
2. Read and parse JSON body with size limit.
3. Authenticate the request.
4. Check rate limits.
5. Call the handler function.
6. Handle errors consistently.

### 7.6 HTTP Utilities

`http-utils.ts` provides:

- `resolveAgentIdForRequest(req)` -- Extracts agent ID from `X-Openclaw-Agent-Id` header or the model string.
- `resolveSessionKey(req)` -- Extracts session key from request headers or generates one.

---

## 8. OpenAI Compatibility Layer

The gateway implements the OpenAI Chat Completions API at `/v1/chat/completions`, allowing any OpenAI-compatible client or SDK to communicate with OpenClaw agents.

**Source file:** `openai-http.ts`

### 8.1 Request Format

The endpoint accepts the standard OpenAI chat completion request:

```json
{
  "model": "openclaw/my-agent",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Hello!" }
  ],
  "stream": true,
  "user": "user-123"
}
```

### 8.2 Agent Resolution

The agent ID is resolved from:

1. The `X-Openclaw-Agent-Id` HTTP header (highest priority).
2. The `model` field if it follows the `openclaw/{id}` convention.
3. The default agent ID from configuration.

### 8.3 Message Conversion

OpenAI messages are converted to OpenClaw conversation entries using `buildAgentMessageFromConversationEntries()` from `agent-prompt.ts`. The conversion handles:

- `system` messages become extra system prompt content.
- `user` messages become the agent's input.
- `assistant` messages provide conversation context.
- Multi-part content (text + image) is supported via the array content format.

### 8.4 Session Key Management

Session keys follow the pattern:

- `openai:user:{user}` when the `user` field is provided.
- `openai:{uuid}` when no user field is present (generates a new UUID per request).

### 8.5 Streaming Response

When `stream: true`, the endpoint uses Server-Sent Events (SSE):

1. Sets SSE headers via `setSseHeaders()`.
2. Sends an initial chunk with `role: "assistant"` delta.
3. Listens for agent events and sends `chat.completion.chunk` objects with content deltas.
4. Sends a final chunk with `finish_reason: "stop"`.
5. Writes `data: [DONE]` and ends the response.

```json
data: {"id":"run-uuid","object":"chat.completion.chunk","created":1708789200,"model":"openclaw/default","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}
```

### 8.6 Non-Streaming Response

When `stream: false` (or omitted), the endpoint collects the full agent response and returns a standard chat completion object:

```json
{
  "id": "run-uuid",
  "object": "chat.completion",
  "created": 1708789200,
  "model": "openclaw/default",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "Hello! How can I help you?" },
      "finish_reason": "stop"
    }
  ]
}
```

---

## 9. OpenResponses API

The gateway also implements the OpenResponses specification at `/v1/responses`, providing a richer API with structured input/output, tool support, and file/image handling.

**Source files:**

- `openresponses-http.ts` -- HTTP handler implementation.
- `open-responses.schema.ts` -- Complete Zod schema definitions.

### 9.1 Request Validation

All requests are validated against a comprehensive Zod schema (`CreateResponseBodySchema`). The schema covers:

- **Input types:** String input (simple prompt) or structured items array.
- **Item types:** `message`, `function_call`, `function_call_output`, `reasoning`, `item_reference`.
- **Content parts:** `input_text`, `output_text`, `input_image` (URL or base64), `input_file` (URL or base64 with PDF rendering).
- **Tool definitions:** Full tool schema support for function calling.

### 9.2 Input Processing

The handler processes diverse input formats:

**String input:**

```json
{
  "input": "What is the weather?",
  "model": "openclaw/default"
}
```

**Structured items:**

```json
{
  "input": [
    {
      "type": "message",
      "role": "user",
      "content": [
        { "type": "input_text", "text": "Describe this image" },
        { "type": "input_image", "image_url": "https://example.com/photo.jpg" }
      ]
    }
  ]
}
```

**Image handling:**

- URL-based images are fetched with configurable timeouts, redirect limits, and hostname allowlists.
- Base64-encoded images are validated and decoded.
- MIME types are validated against configurable allowlists (default: standard image types).
- Maximum image size defaults to `DEFAULT_INPUT_IMAGE_MAX_BYTES`.

**File handling:**

- URL-based files are fetched with the same limits as images.
- Base64-encoded files are decoded.
- PDF files are rendered for agent consumption.
- File size limits are configurable via `resolveInputFileLimits()`.

### 9.3 Tool Support

The OpenResponses endpoint supports tool definitions in the request, allowing function calling:

```json
{
  "input": "...",
  "tools": [
    {
      "type": "function",
      "name": "get_weather",
      "description": "Get weather for a location",
      "parameters": { ... }
    }
  ]
}
```

Tool definitions are converted to `ClientToolDefinition` objects and passed to the agent system.

### 9.4 Session Key Management

Session keys follow the pattern `openresponses:user:{user}` when the `user` field is provided.

### 9.5 Streaming Protocol

The OpenResponses streaming protocol is more structured than the OpenAI SSE format, using typed events:

| Event Type                    | Description               |
| ----------------------------- | ------------------------- |
| `response.created`            | Response resource created |
| `response.in_progress`        | Processing has begun      |
| `response.output_item.added`  | New output item added     |
| `response.content_part.added` | New content part added    |
| `response.output_text.delta`  | Incremental text delta    |
| `response.output_text.done`   | Text output complete      |
| `response.content_part.done`  | Content part complete     |
| `response.output_item.done`   | Output item complete      |
| `response.completed`          | Full response complete    |
| `error`                       | Error occurred            |

Each event is written as a typed SSE:

```
event: response.output_text.delta
data: {"type":"response.output_text.delta","item_id":"item-1","output_index":0,"content_index":0,"delta":"Hello"}
```

### 9.6 Limits Configuration

| Parameter                | Default                         |
| ------------------------ | ------------------------------- |
| Max body size            | 20 MB                           |
| Max URL parts            | 8                               |
| Image fetch timeout      | `DEFAULT_INPUT_TIMEOUT_MS`      |
| Image max redirects      | `DEFAULT_INPUT_MAX_REDIRECTS`   |
| Image max size           | `DEFAULT_INPUT_IMAGE_MAX_BYTES` |
| Allowed image MIME types | `DEFAULT_INPUT_IMAGE_MIMES`     |

All limits are configurable via the `GatewayHttpResponsesConfig` type.

---

## 10. RPC Method Catalog

The gateway exposes a comprehensive set of RPC methods, each implemented in a dedicated module under `server-methods/`. Methods are invoked via the WebSocket RPC protocol or internally by HTTP handlers.

### 10.1 Agent Management

| Method               | Module      | Description                       |
| -------------------- | ----------- | --------------------------------- |
| `agent`              | `agent.ts`  | Run agent with prompt             |
| `agent.wait`         | `agent.ts`  | Run agent and wait for completion |
| `agents.list`        | `agents.ts` | List all configured agents        |
| `agents.create`      | `agents.ts` | Create a new agent                |
| `agents.update`      | `agents.ts` | Update agent configuration        |
| `agents.delete`      | `agents.ts` | Delete an agent                   |
| `agent.identity.get` | `agents.ts` | Get agent identity (name, avatar) |
| `agents.files.list`  | `agents.ts` | List agent-associated files       |
| `agents.files.get`   | `agents.ts` | Get agent-associated file content |

### 10.2 Chat Operations

| Method         | Module    | Description                      |
| -------------- | --------- | -------------------------------- |
| `chat.send`    | `chat.ts` | Send a message in a chat session |
| `chat.abort`   | `chat.ts` | Abort an active chat run         |
| `chat.history` | `chat.ts` | Retrieve chat history            |
| `send`         | `send.ts` | Send a message through a channel |
| `poll`         | `send.ts` | Poll for pending messages        |

### 10.3 Channel Operations

| Method            | Module        | Description                                                   |
| ----------------- | ------------- | ------------------------------------------------------------- |
| `channels.status` | `channels.ts` | Get channel status with probing, audit, and activity tracking |
| `channels.logout` | `channels.ts` | Logout from a channel account                                 |

### 10.4 Session Management

| Method                      | Module        | Description                    |
| --------------------------- | ------------- | ------------------------------ |
| `sessions.list`             | `sessions.ts` | List all sessions              |
| `sessions.preview`          | `sessions.ts` | Preview session content        |
| `sessions.resolve`          | `sessions.ts` | Resolve session key to session |
| `sessions.usage`            | `sessions.ts` | Get session usage statistics   |
| `sessions.usage.timeseries` | `sessions.ts` | Get usage time series data     |
| `sessions.usage.logs`       | `sessions.ts` | Get usage log entries          |

### 10.5 Configuration

| Method       | Module      | Description               |
| ------------ | ----------- | ------------------------- |
| `config.get` | `config.ts` | Get current configuration |
| `config.set` | `config.ts` | Update configuration      |

### 10.6 Device and Node Management

| Method               | Module     | Description                     |
| -------------------- | ---------- | ------------------------------- |
| `node.list`          | `nodes.ts` | List connected nodes            |
| `node.describe`      | `nodes.ts` | Get node details                |
| `node.invoke`        | `nodes.ts` | Invoke a command on a node      |
| `node.rename`        | `nodes.ts` | Rename a node                   |
| `node.invoke.result` | `nodes.ts` | Node-side: report invoke result |
| `node.event`         | `nodes.ts` | Node-side: emit event           |

### 10.7 Device Pairing

| Method                | Module       | Description                |
| --------------------- | ------------ | -------------------------- |
| `node.pair.request`   | `devices.ts` | Request node pairing       |
| `node.pair.list`      | `devices.ts` | List pending pair requests |
| `node.pair.approve`   | `devices.ts` | Approve a pair request     |
| `node.pair.reject`    | `devices.ts` | Reject a pair request      |
| `node.pair.verify`    | `devices.ts` | Verify a pairing           |
| `device.pair.list`    | `devices.ts` | List paired devices        |
| `device.pair.approve` | `devices.ts` | Approve device pairing     |
| `device.pair.reject`  | `devices.ts` | Reject device pairing      |
| `device.pair.remove`  | `devices.ts` | Remove a paired device     |
| `device.token.rotate` | `devices.ts` | Rotate device auth token   |
| `device.token.revoke` | `devices.ts` | Revoke device auth token   |

### 10.8 Exec Approvals

| Method                       | Module              | Description                 |
| ---------------------------- | ------------------- | --------------------------- |
| `exec.approval.request`      | `exec-approvals.ts` | Request exec approval       |
| `exec.approval.waitDecision` | `exec-approval.ts`  | Wait for approval decision  |
| `exec.approval.resolve`      | `exec-approvals.ts` | Resolve an approval request |

### 10.9 System and Monitoring

| Method            | Module      | Description                      |
| ----------------- | ----------- | -------------------------------- |
| `health`          | `health.ts` | Health check                     |
| `logs.tail`       | `logs.ts`   | Tail log output                  |
| `models.list`     | `models.ts` | List available models            |
| `skills.status`   | `skills.ts` | Get skill installation status    |
| `skills.install`  | `skills.ts` | Install a skill                  |
| `skills.bins`     | `skills.ts` | Node-side: report skill binaries |
| `system-presence` | `system.ts` | Get system presence info         |
| `last-heartbeat`  | `system.ts` | Get last heartbeat time          |
| `status`          | `system.ts` | Get system status                |

### 10.10 Voice and TTS

| Method            | Module         | Description            |
| ----------------- | -------------- | ---------------------- |
| `talk.mode`       | `talk.ts`      | Set talk/voice mode    |
| `talk.config`     | `talk.ts`      | Get talk configuration |
| `tts.status`      | `tts.ts`       | Get TTS status         |
| `tts.providers`   | `tts.ts`       | List TTS providers     |
| `tts.enable`      | `tts.ts`       | Enable TTS             |
| `tts.disable`     | `tts.ts`       | Disable TTS            |
| `tts.convert`     | `tts.ts`       | Convert text to speech |
| `tts.setProvider` | `tts.ts`       | Set TTS provider       |
| `voicewake.get`   | `voicewake.ts` | Get voice wake word    |
| `voicewake.set`   | `voicewake.ts` | Set voice wake word    |

### 10.11 Other

| Method            | Module          | Description                |
| ----------------- | --------------- | -------------------------- |
| `cron.list`       | `cron.ts`       | List cron jobs             |
| `cron.status`     | `cron.ts`       | Get cron status            |
| `cron.runs`       | `cron.ts`       | Get cron run history       |
| `connect`         | `connect.ts`    | Client connection handling |
| `push.test`       | `push.ts`       | Test push notification     |
| `usage.status`    | `usage.ts`      | Get usage status           |
| `usage.cost`      | `usage.ts`      | Get usage cost data        |
| `update.check`    | `update.ts`     | Check for updates          |
| `browser.request` | `web.ts`        | Browser proxy request      |
| `wake`            | `validation.ts` | Wake the system            |
| `wizard.*`        | `wizard.ts`     | Setup wizard methods       |

---

## 11. Channel Integration Architecture

The channel integration system uses a two-layer design that separates lifecycle management from platform-specific logic.

### 11.1 Layer 1: Gateway Channel Manager

The gateway-level channel manager (`server-channels.ts`) handles:

- **Lifecycle orchestration:** Starting, stopping, and restarting channels.
- **Multi-account support:** Each channel can have multiple accounts running simultaneously.
- **Auto-restart with backoff:** Failed channels are automatically restarted with exponential backoff.
- **Runtime snapshots:** Each channel/account pair has a `ChannelAccountSnapshot` tracking its current state.
- **Manual stop tracking:** Channels manually stopped by the operator are not auto-restarted.

### 11.2 Layer 2: Channel Plugin System

The channel plugin system (`src/channels/plugins/`) handles:

- **Platform abstraction:** Each channel plugin implements a common interface for its platform.
- **Message normalization:** Converting platform-specific message formats to the internal format.
- **Outbound delivery:** Converting internal messages to platform API calls.
- **Onboarding:** Platform-specific setup and pairing flows.
- **Actions:** Platform-specific interactive actions (reactions, buttons, slash commands).
- **Status reporting:** Health and configuration status per channel.

### 11.3 Layer 3: Channel Extensions

Channel extensions (`extensions/`) register channel plugins with the gateway. Each extension follows the standard plugin registration pattern:

```typescript
export default {
  id: "channel-name",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setChannelRuntime(api.runtime);
    api.registerChannel({ plugin: channelPlugin });
  },
};
```

This three-layer separation allows:

- The gateway manager to handle lifecycle uniformly for all channels.
- Each plugin to encapsulate platform-specific complexity.
- Extensions to be loaded lazily and registered dynamically.

---

## 12. Channel Lifecycle Management

### 12.1 Channel Manager

`createChannelManager()` in `server-channels.ts` creates the central channel lifecycle manager. It returns a `ChannelManager` object with the following interface:

```typescript
export type ChannelManager = {
  getRuntimeSnapshot: () => ChannelRuntimeSnapshot;
  startChannels: () => Promise<void>;
  startChannel: (channel: ChannelId, accountId?: string) => Promise<void>;
  stopChannel: (channel: ChannelId, accountId?: string) => Promise<void>;
  markChannelLoggedOut: (channelId: ChannelId, cleared: boolean, accountId?: string) => void;
  isManuallyStopped: (channelId: ChannelId, accountId: string) => boolean;
  resetRestartAttempts: (channelId: ChannelId, accountId: string) => void;
};
```

### 12.2 Internal State

The channel manager maintains three data structures per channel:

```typescript
type ChannelRuntimeStore = {
  aborts: Map<string, AbortController>; // Per-account abort controllers
  tasks: Map<string, Promise<unknown>>; // Per-account running tasks
  runtimes: Map<string, ChannelAccountSnapshot>; // Per-account runtime state
};
```

Additional state:

- `restartAttempts: Map<string, number>` -- Restart attempt counter keyed by `channelId:accountId`.
- `manuallyStopped: Set<string>` -- Set of `channelId:accountId` keys that were manually stopped.

### 12.3 Multi-Account Support

Each channel supports multiple simultaneous accounts. Account IDs default to `DEFAULT_ACCOUNT_ID` from the routing system. The manager resolves per-account configuration from the config, and each account has its own:

- Runtime snapshot
- Abort controller
- Task promise
- Restart attempt counter

Account enablement is checked via `isAccountEnabled()`, which returns `true` unless `enabled` is explicitly set to `false`.

### 12.4 Auto-Restart with Exponential Backoff

When a channel fails, the manager automatically restarts it using an exponential backoff policy:

```typescript
const CHANNEL_RESTART_POLICY: BackoffPolicy = {
  initialMs: 5_000, // 5 seconds initial delay
  maxMs: 5 * 60_000, // 5 minutes maximum delay
  factor: 2, // Double the delay each attempt
  jitter: 0.1, // 10% random jitter
};
const MAX_RESTART_ATTEMPTS = 10; // Give up after 10 attempts
```

The backoff is computed by `computeBackoff()` from the infra backoff module. The sleep between attempts is interruptible via `sleepWithAbort()`, so channel stops take effect immediately.

Restart attempts are tracked per `channelId:accountId` and reset on successful start. The `resetRestartAttempts()` method allows external callers (e.g., the health monitor) to reset the counter.

### 12.5 Manual Stop Tracking

When an operator manually stops a channel via `stopChannel()`, the `channelId:accountId` key is added to the `manuallyStopped` set. The auto-restart logic checks this set and skips restarting manually stopped channels. The `isManuallyStopped()` method exposes this for external queries.

### 12.6 Runtime Snapshots

The `getRuntimeSnapshot()` method returns a `ChannelRuntimeSnapshot` containing the current state of all channels:

```typescript
export type ChannelRuntimeSnapshot = {
  channels: Partial<Record<ChannelId, ChannelAccountSnapshot>>;
  channelAccounts: Partial<Record<ChannelId, Record<string, ChannelAccountSnapshot>>>;
};
```

The `channels` field provides the primary account snapshot per channel, while `channelAccounts` provides per-account snapshots for multi-account channels. `ChannelAccountSnapshot` includes 25+ fields covering running status, connection state, configuration state, error details, and activity timestamps.

---

## 13. Channel Health Monitoring

The channel health monitor (`channel-health-monitor.ts`) is a background process that periodically checks all channel accounts and restarts unhealthy ones within configurable bounds.

### 13.1 Configuration

```typescript
const DEFAULT_CHECK_INTERVAL_MS = 5 * 60_000; // Check every 5 minutes
const DEFAULT_STARTUP_GRACE_MS = 60_000; // 60s grace period after startup
const DEFAULT_COOLDOWN_CYCLES = 2; // 2 cycles between restarts
const DEFAULT_MAX_RESTARTS_PER_HOUR = 3; // Max 3 restarts/hour/channel:account
```

### 13.2 Health Check Logic

The monitor runs on a `setInterval` timer. Each check cycle:

1. **Startup grace:** Skips checking if the server started less than `startupGraceMs` ago.
2. **Snapshot acquisition:** Gets the current runtime snapshot from the channel manager.
3. **Per-account check:** For each `channelId:accountId` pair:
   a. Skips accounts that are not managed (disabled or unconfigured).
   b. Evaluates health using `isChannelHealthy()`:
   - **Healthy:** `running === true` AND `connected !== false` (connected is allowed to be undefined).
   - **Unhealthy:** not running, or running but disconnected.
     c. If unhealthy, checks restart constraints before acting.

### 13.3 Health Detection Categories

The monitor detects three unhealthy states:

| State     | Condition                                 | Description                                                     |
| --------- | ----------------------------------------- | --------------------------------------------------------------- |
| `gave-up` | 10+ restart attempts                      | The channel manager's auto-restart exhausted its attempts       |
| `stopped` | `running === false`                       | The channel is not running                                      |
| `stuck`   | `running === true`, `connected === false` | The channel process is alive but disconnected from the platform |

### 13.4 Restart Constraints

Before restarting, the monitor checks:

1. **Cooldown:** At least `cooldownCycles * checkIntervalMs` must have passed since the last restart of this channel:account pair.
2. **Rate limit:** No more than `maxRestartsPerHour` restarts in the last hour. Old restart records are pruned using `pruneOldRestarts()`.

### 13.5 Restart Records

Each channel:account pair has a `RestartRecord`:

```typescript
type RestartRecord = {
  lastRestartAt: number;
  restartsThisHour: { at: number }[];
};
```

Records are keyed by `${channelId}:${accountId}` and stored in a `Map`. Old entries (older than 1 hour) are pruned on each check cycle.

### 13.6 Lifecycle

```typescript
export type ChannelHealthMonitor = {
  stop: () => void;
};
```

The monitor is started by `startChannelHealthMonitor()` and can be stopped by calling `stop()`. It also respects an optional `AbortSignal` for external cancellation.

---

## 14. Channel Plugin Architecture

The channel plugin system (`src/channels/plugins/`) provides the abstraction layer for integrating messaging platforms.

### 14.1 Plugin Registry

- `index.ts` -- Exports `getChannelPlugin()`, `listChannelPlugins()`, `normalizeChannelId()`, and the `ChannelId` type.
- `load.ts` -- Lazy plugin loading via registry lookup. Plugins are loaded on first access.
- `registry-loader.ts` -- Registry-based plugin loader that discovers and instantiates channel plugins.

### 14.2 Plugin Type System

The type system is spread across four files:

- `types.ts` -- Main type exports.
- `types.core.ts` -- Core channel types (message, conversation, user).
- `types.plugin.ts` -- Plugin interface contract.
- `types.adapters.ts` -- Adapter interfaces for normalization, outbound, and actions.

### 14.3 Plugin Contract

Each channel plugin must implement:

1. **Normalization adapter** -- Converts platform-specific inbound messages to the internal format.
2. **Outbound adapter** -- Converts internal messages to platform API calls.
3. **Onboarding** -- Platform-specific setup, pairing, and login flows.
4. **Actions** (optional) -- Platform-specific interactive actions.
5. **Status** -- Reports current health, configuration state, and provides a default runtime snapshot.

### 14.4 Plugin Configuration

- `config-helpers.ts` -- Shared configuration helpers for reading and validating channel configs.
- `config-schema.ts` -- Configuration schema definitions for channel plugins.
- `config-writes.ts` -- Config write operations for channel setup.
- `directory-config.ts` -- Directory-based channel configuration (for channels that use filesystem config).

### 14.5 Plugin Catalog

`catalog.ts` builds the UI catalog of available channels, including:

- Channel name, display name, and icon.
- Configuration status (configured, enabled, running).
- Supported features.

### 14.6 Media Limits

`media-limits.ts` defines per-channel media size limits. Different platforms have different constraints on file sizes, image dimensions, and supported media types.

### 14.7 Message Actions

- `message-actions.ts` -- Dispatches message actions (reactions, edits, deletions) to the appropriate platform adapter.
- `message-action-names.ts` -- Constants for action type names.

### 14.8 Group Mentions

`group-mentions.ts` handles the normalization and routing of @-mentions in group conversations across platforms.

### 14.9 Pairing Flows

- `pairing.ts` -- Implements the channel pairing flow (connecting an OpenClaw instance to a platform account).
- `pairing-message.ts` -- Generates pairing confirmation messages.

### 14.10 WhatsApp Heartbeat

`whatsapp-heartbeat.ts` implements a WhatsApp-specific heartbeat mechanism to maintain the connection with the WhatsApp Web API, which has stricter session requirements than other platforms.

### 14.11 Account Management

- `account-action-gate.ts` -- Gates certain actions based on account state (e.g., preventing sends on disconnected accounts).
- `account-helpers.ts` -- Account resolution and management utilities.
- `setup-helpers.ts` -- Setup utilities for channel onboarding.

### 14.12 Platform-Specific Action Handlers

- `slack.actions.ts` -- Slack-specific action handling (interactive components, slash commands).
- `bluebubbles-actions.ts` -- BlueBubbles (iMessage bridge) action handling.

---

## 15. Per-Channel Normalizers

Normalizers live in `src/channels/plugins/normalize/` and convert platform-specific inbound messages to the common internal message format.

### 15.1 Available Normalizers

| File          | Platform | Key Conversions                                                                                          |
| ------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `discord.ts`  | Discord  | Markdown, embeds, attachments, stickers, reactions, threads                                              |
| `slack.ts`    | Slack    | mrkdwn to markdown, blocks, attachments, threads, unfurls                                                |
| `telegram.ts` | Telegram | HTML entities, inline keyboard, photos, documents, stickers, voice, video notes, polls, locations        |
| `whatsapp.ts` | WhatsApp | Protocol buffers, media messages (image, video, audio, document), contacts, locations, template messages |
| `signal.ts`   | Signal   | Attachments, quotes, mentions, reactions, stickers                                                       |
| `imessage.ts` | iMessage | Tapbacks, attachments, rich links, group naming events                                                   |
| `shared.ts`   | Shared   | Common normalization utilities used by multiple normalizers                                              |

### 15.2 Normalization Pipeline

Each normalizer follows the same general pipeline:

1. **Extract metadata:** Sender identity, conversation ID, timestamp, platform-specific metadata.
2. **Normalize text:** Convert platform-specific markup (Slack mrkdwn, Discord Markdown, Telegram HTML) to the internal plain-text or standard Markdown format.
3. **Handle media:** Extract images, files, voice notes, and other media. Generate internal `ChatImageContent` blocks or attachment references.
4. **Handle special types:** Reactions, replies/threads, edits, deletions, system events.
5. **Produce internal message:** Return a normalized message object with all platform-specific details abstracted away.

### 15.3 Shared Utilities

`shared.ts` provides common functions used across normalizers:

- Text truncation and sanitization.
- Media type detection.
- Common attachment handling.
- Timestamp normalization.

---

## 16. Per-Channel Outbound

Outbound adapters live in `src/channels/plugins/outbound/` and convert internal agent responses to platform-specific API calls.

### 16.1 Available Outbound Adapters

| File                   | Platform | Key Capabilities                                                                    |
| ---------------------- | -------- | ----------------------------------------------------------------------------------- |
| `discord.ts`           | Discord  | Markdown, embeds, files, reactions, thread replies, message editing                 |
| `slack.ts`             | Slack    | Block Kit, mrkdwn, files, reactions, thread replies, ephemeral messages             |
| `telegram.ts`          | Telegram | HTML formatting, inline keyboards, photos, documents, message editing, reply markup |
| `whatsapp.ts`          | WhatsApp | Text, media messages, template messages, reaction messages, location messages       |
| `signal.ts`            | Signal   | Text, attachments, quotes, reactions, mentions                                      |
| `imessage.ts`          | iMessage | Text, tapbacks, attachments, rich links                                             |
| `direct-text-media.ts` | Generic  | Direct text and media delivery for simpler platforms                                |
| `load.ts`              | Loader   | Dynamic outbound adapter loading                                                    |

### 16.2 Outbound Pipeline

Each outbound adapter follows the same general pipeline:

1. **Receive internal message:** The agent's response in the internal format.
2. **Format text:** Convert internal Markdown or plain text to the platform's markup format.
3. **Handle media:** Upload files/images to the platform or convert to inline content.
4. **Handle special features:** Reactions, thread replies, message edits, interactive components.
5. **Send via platform API:** Make the API call(s) to deliver the message.
6. **Return delivery result:** Report success/failure and any platform-specific metadata (message ID, timestamp).

### 16.3 Draft Streaming

For platforms that support message editing (Discord, Slack, Telegram), the outbound system supports draft streaming:

- `draft-stream-controls.ts` -- Controls for starting, updating, and finalizing draft messages.
- `draft-stream-loop.ts` -- The streaming loop that sends periodic edits to update the message as the agent generates content.

This allows users to see the agent's response being typed in real-time, similar to how ChatGPT shows streaming responses.

---

## 17. Channel Onboarding

Onboarding modules live in `src/channels/plugins/onboarding/` and implement the setup flow for each platform.

### 17.1 Available Onboarding Modules

| File          | Platform | Setup Flow                                                        |
| ------------- | -------- | ----------------------------------------------------------------- |
| `discord.ts`  | Discord  | Bot token configuration, guild selection, permission verification |
| `slack.ts`    | Slack    | OAuth flow, workspace selection, bot user creation                |
| `telegram.ts` | Telegram | Bot token via BotFather, webhook URL configuration                |
| `whatsapp.ts` | WhatsApp | QR code scanning, session persistence                             |
| `signal.ts`   | Signal   | Phone number registration, device linking                         |
| `imessage.ts` | iMessage | BlueBubbles server configuration, API key setup                   |

### 17.2 Shared Onboarding Infrastructure

- `channel-access.ts` -- Channel access control during onboarding.
- `channel-access-configure.ts` -- Interactive channel access configuration.
- `helpers.ts` -- Shared onboarding utilities.
- `onboarding-types.ts` -- Type definitions for the onboarding flow.

### 17.3 Onboarding Flow

The general onboarding flow:

1. **Credential collection:** The operator provides platform-specific credentials (token, API key, phone number).
2. **Validation:** The onboarding module validates the credentials against the platform API.
3. **Configuration:** Valid credentials are written to the config file.
4. **Connection test:** The module attempts to connect using the new credentials.
5. **Access configuration:** The operator configures allowlists, mention gating, and other access controls.
6. **Activation:** The channel is started by the channel manager.

---

## 18. Message Flow

This section traces the complete lifecycle of a message from ingestion to response delivery.

### 18.1 Inbound Message Flow

```
Platform Event (e.g., Discord message)
    │
    ▼
Channel Plugin (gateway lifecycle hook)
    │
    ▼
Normalizer (platform → internal format)
    │
    ▼
Allowlist Check (allow-from.ts, allowlist-match.ts)
    │
    ▼
Mention Gating (mention-gating.ts)
    │
    ▼
Command Gating (command-gating.ts)
    │
    ▼
Session Resolution (session.ts)
    │
    ▼
Model Override Resolution (model-overrides.ts)
    │
    ▼
Agent Prompt Construction (agent-prompt.ts)
    │
    ▼
Chat Run Creation (server-chat.ts)
    │
    ▼
Agent Execution
    │
    ▼
Response Broadcasting (server-broadcast.ts)
    │
    ▼
Outbound Adapter (internal → platform format)
    │
    ▼
Platform API Call (deliver message)
```

### 18.2 Allowlist Processing

The allowlist system controls which senders and conversations are permitted to interact with the agent:

- `allow-from.ts` -- Core allowlist evaluation. Checks sender identity against the channel's allowlist.
- `allowlist-match.ts` -- Pattern matching logic for allowlist entries (exact match, wildcard, regex).
- `src/channels/allowlists/` -- Allowlist data storage.

Allowlist decisions are nested: a channel can have top-level allowlists and per-account allowlists.

### 18.3 Message Gating

Two gating mechanisms filter messages before they reach the agent:

**Mention gating** (`mention-gating.ts`):

- In group conversations, only messages that mention the bot (or reply to the bot) are processed.
- Direct messages bypass mention gating.
- Configurable per channel.

**Command gating** (`command-gating.ts`):

- Restricts which slash commands or command prefixes are available per channel.
- Used to prevent certain channels from accessing administrative commands.

### 18.4 Session Resolution

`session.ts` resolves the session key for an incoming message based on:

- The channel and account ID.
- The conversation ID (group chat or DM).
- The sender identity.
- The configured routing rules.

### 18.5 Model Overrides

`model-overrides.ts` allows per-channel model overrides, so different channels can use different LLM models. For example, a Telegram channel might use a faster, cheaper model while Discord uses a more capable one.

### 18.6 Typing Indicators

`typing.ts` manages typing indicator signals. When the agent begins processing a message, the gateway sends a typing indicator to the originating platform. The indicator is maintained until the response is delivered.

### 18.7 Acknowledgment Reactions

`ack-reactions.ts` controls acknowledgment reactions -- the bot's immediate reaction (e.g., a thumbs-up emoji) when it receives a message. Scoping options:

| Scope      | Behavior                                    |
| ---------- | ------------------------------------------- |
| `all`      | React to all messages                       |
| `direct`   | React only to direct messages               |
| `group`    | React only to group messages                |
| `mentions` | React only to messages that mention the bot |
| `off`      | Never react                                 |

### 18.8 Status Reactions

`status-reactions.ts` handles status-based reactions that indicate the agent's processing state (e.g., a "thinking" emoji while processing, replaced by a "done" emoji when complete).

### 18.9 Sender Identity

- `sender-identity.ts` -- Resolves the sender's identity from the platform's user data.
- `sender-label.ts` -- Generates human-readable sender labels (e.g., "John Doe via Discord").

### 18.10 Conversation Labeling

`conversation-label.ts` generates labels for conversations (e.g., "Discord #general", "Telegram DM with Alice").

### 18.11 Reply Prefix

`reply-prefix.ts` handles reply prefix logic for platforms that show reply context (e.g., "Replying to John:").

---

## 19. Chat System

The chat system manages the lifecycle of agent runs triggered by incoming messages.

### 19.1 Chat Run Registry

`server-chat.ts` implements the `ChatRunRegistry`, a queue-based system for tracking active chat runs:

```typescript
export type ChatRunEntry = {
  sessionKey: string;
  clientRunId: string;
  // ... additional metadata
};
```

The registry ensures that:

- Only one run is active per session key at a time.
- New runs are queued if a run is already active.
- Completed runs are removed and the next queued run starts.

### 19.2 Chat Run State

`ChatRunState` tracks per-run state:

- **Buffers:** Accumulated text for streaming delivery.
- **Delta timestamps:** Timing information for delta events.
- **Abort tracking:** Whether the run has been aborted and by whom.

### 19.3 Tool Event Recipients

`ToolEventRecipientRegistry` tracks which WebSocket connections should receive tool execution events for a given run:

- TTL: 10 minutes (tool events stop being sent after this).
- Grace period: 30 seconds (connections that disconnect and reconnect within this window continue receiving events).

### 19.4 Chat Abort

`chat-abort.ts` handles run abortion:

- **`/stop` recognition:** The system recognizes `/stop` as a universal abort command.
- **Run expiration:** Runs expire with a 60-second grace period, minimum 2 minutes, maximum 24 hours.
- **Abort by run ID:** Specific runs can be aborted by their UUID.
- **Abort by session key:** All runs for a session can be aborted.

### 19.5 Chat Attachments

`chat-attachments.ts` handles image extraction from incoming messages:

- Extracts images as `ChatImageContent` blocks.
- Validates base64 encoding.
- Performs MIME type sniffing.
- Enforces a maximum decoded size of 5 MB.
- Only retains `image/*` MIME types (discards non-image attachments).

### 19.6 Chat Sanitization

`chat-sanitize.ts` strips internal metadata from messages before they are sent to the agent. This prevents internal routing information, session keys, or system tags from leaking into the agent's context.

### 19.7 Heartbeat Integration

The chat system integrates with the heartbeat subsystem:

- Heartbeat runs (automated periodic check-ins) are identified by the run context.
- Heartbeat output can be suppressed from interactive chat surfaces based on configuration.
- Heartbeat acknowledgment text is stripped and truncated according to `ackMaxChars`.

---

## 20. Webhook System

The webhook system allows external services to send messages to OpenClaw agents via HTTP POST requests.

### 20.1 Configuration

`hooks.ts` defines the webhook endpoint configuration:

```typescript
const DEFAULT_HOOKS_PATH = "/hooks";
const DEFAULT_HOOKS_MAX_BODY_BYTES = 256 * 1024; // 256 KB
```

Requirements:

- Hooks must be explicitly enabled (`hooks.enabled: true`).
- A token must be configured (`hooks.token`). Requests without a valid token are rejected.
- The path cannot be `/` (root).

### 20.2 Agent Policy

The hook agent policy controls which agents can be invoked via webhooks:

```typescript
export type HookAgentPolicyResolved = {
  defaultAgentId: string;
  knownAgentIds: Set<string>;
  allowedAgentIds?: Set<string>; // If set, only these agents are accessible
};
```

When `allowedAgentIds` is configured, webhooks can only target agents in the allowlist. Otherwise, any known agent can be targeted.

### 20.3 Session Policy

The hook session policy controls session key assignment:

```typescript
export type HookSessionPolicyResolved = {
  defaultSessionKey?: string;
  allowRequestSessionKey: boolean;
  allowedSessionKeyPrefixes?: string[];
};
```

When `allowedSessionKeyPrefixes` is configured, the request-provided session key must match one of the prefixes. The default session key must also match the prefix constraints.

### 20.4 Hook Mapping and Routing

`hooks-mapping.ts` maps incoming webhook requests to agent invocations:

**Template rendering:** Webhook mappings support `{{expression}}` templates with access to:

- `path` -- The request path.
- `now` -- The current timestamp.
- `headers` -- Request headers.
- `query` -- URL query parameters.
- `payload` -- The parsed JSON request body.

**Preset mappings:** Built-in mapping presets exist for common services (e.g., Gmail).

**Custom transforms:** Custom JavaScript/TypeScript transform files can be placed in `hooks/transforms/`. These files export a function that receives the webhook request and returns an agent invocation payload.

**Security:** The template engine blocks prototype chain traversal (e.g., `{{payload.__proto__}}`) to prevent prototype pollution attacks.

### 20.5 Hook Channels

Webhook configuration supports channel associations, allowing webhook-triggered agent responses to be delivered through specific channels.

---

## 21. Control UI

The control UI (`control-ui.ts`) serves the OpenClaw web management interface as a single-page application (SPA).

### 21.1 Static File Serving

The control UI serves static files from a resolved root directory:

```typescript
export type ControlUiRootState =
  | { kind: "resolved"; path: string } // Root directory found
  | { kind: "invalid"; path: string } // Root exists but is invalid
  | { kind: "missing" }; // Root not found
```

**TOCTOU safety:** The file server validates each served file using `realpath` and inode verification to prevent time-of-check/time-of-use race conditions. The pipeline:

1. Resolve the requested path within the root directory.
2. Check `isWithinDir()` (from `path-safety.ts`) to ensure the path is contained within the root.
3. Call `realpath()` to resolve symlinks.
4. Verify the resolved path is still within the root.
5. Read the file's inode via `stat()`.
6. Serve the file.

### 21.2 SPA Fallback

For paths that do not match a static file or a recognized static asset extension, the server returns `index.html` (SPA fallback). Static asset extensions (`.js`, `.css`, `.json`, `.map`, `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.ico`, `.txt`, `.woff`, `.woff2`) return 404 if not found.

### 21.3 Avatar Endpoint

The control UI provides an avatar endpoint at the `CONTROL_UI_AVATAR_PREFIX` path for serving assistant avatars. Avatar URLs are resolved by `resolveAssistantAvatarUrl()` and `buildControlUiAvatarUrl()`.

### 21.4 Bootstrap Configuration

The path `/__openclaw/control-ui-config.json` serves the bootstrap configuration for the SPA, providing the client with server capabilities, agent identity, and feature flags.

### 21.5 Content Security Policy

`control-ui-csp.ts` builds the Content Security Policy header:

| Directive         | Value             | Rationale                                      |
| ----------------- | ----------------- | ---------------------------------------------- |
| `frame-ancestors` | `'none'`          | Prevent framing (clickjacking)                 |
| `script-src`      | (no inline)       | Block inline script injection                  |
| `style-src`       | `'unsafe-inline'` | Allow inline styles (required by UI framework) |

Additional security headers set by the control UI:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`

---

## 22. Exec Approval System

The exec approval system (`exec-approval-manager.ts`) provides an interactive approval workflow for sensitive operations, primarily `system.run` commands executed by the agent.

### 22.1 Approval Flow

```
Agent wants to run: system.run("rm -rf /tmp/old")
    │
    ▼
exec.approval.request (creates record)
    │
    ▼
Broadcast: exec.approval.requested (to APPROVALS_SCOPE clients)
    │
    ▼
Operator reviews in CLI/UI
    │
    ▼
exec.approval.resolve (approve/deny)
    │
    ▼
Broadcast: exec.approval.resolved
    │
    ▼
Agent proceeds (or aborts)
```

### 22.2 ExecApprovalManager

The `ExecApprovalManager` class manages the approval lifecycle:

```typescript
export class ExecApprovalManager {
  create(request, timeoutMs, id?): ExecApprovalRecord;
  register(record, timeoutMs): Promise<ExecApprovalDecision | null>;
  // resolve(), awaitDecision(), etc.
}
```

**Key properties:**

- **Idempotent registration:** Registering the same approval ID twice returns the existing promise (if still pending) or throws (if already resolved).
- **Timeout:** Returns `null` on timeout.
- **Grace period:** 15 seconds after resolution, late `awaitDecision()` calls still receive the decision.
- **Double-resolve prevention:** Once resolved, subsequent resolve calls are rejected.

### 22.3 Approval Record

```typescript
export type ExecApprovalRecord = {
  id: string;
  request: ExecApprovalRequestPayload;
  createdAtMs: number;
  expiresAtMs: number;
  requestedByConnId?: string | null;
  requestedByDeviceId?: string | null;
  requestedByClientId?: string | null;
  resolvedAtMs?: number;
  decision?: ExecApprovalDecision;
  resolvedBy?: string | null;
};
```

The `requestedBy*` fields track the originating client to prevent other clients from replaying an approval ID.

### 22.4 System.run Gating

`node-invoke-system-run-approval.ts` gates `system.run` commands behind exec approval records:

- Every `system.run` invocation must have a corresponding approved exec approval record.
- The approval ID must match the invocation parameters.
- This prevents approval bypass injection (a malicious agent cannot craft an approval ID to bypass the workflow).

---

## 23. Node Device Management

The gateway manages connections to device nodes -- mobile phones, desktops, and other devices that expose platform-native capabilities to the agent.

### 23.1 Mobile Node Management

`server-mobile-nodes.ts` manages mobile device node connections, tracking their capabilities, connection state, and pairing status.

### 23.2 Node Events

- `server-node-events.ts` -- Handles events emitted by connected nodes.
- `server-node-events-types.ts` -- Type definitions for node events.
- `server-node-subscriptions.ts` -- Manages subscriptions to node events (e.g., a CLI client subscribing to camera events from a specific phone).

### 23.3 Platform Command Policy

`node-command-policy.ts` defines per-platform command allowlists. Each platform has a default set of allowed commands:

**iOS:**

- Canvas commands: `canvas.present`, `canvas.hide`, `canvas.navigate`, `canvas.eval`, `canvas.snapshot`, `canvas.a2ui.push`, `canvas.a2ui.pushJSONL`, `canvas.a2ui.reset`
- Camera: `camera.list`
- Location: `location.get`
- Device: `device.info`, `device.status`
- Contacts: `contacts.search`
- Calendar: `calendar.events`
- Reminders: `reminders.list`
- Photos: `photos.latest`
- Motion: `motion.activity`, `motion.pedometer`
- System: `system.notify`

**Android:**

- Same as iOS except without `system.notify`.

**macOS:**

- Everything iOS has, plus:
- Full system commands: `system.run`, `system.which`, `system.notify`, `browser.proxy`

**Dangerous commands** (require explicit opt-in via `gateway.nodes.allowCommands`):

- `camera.snap`, `camera.clip`
- `screen.record`
- `contacts.add`
- `calendar.add`
- `reminders.add`
- `sms.send`

### 23.4 Invoke Sanitization

`node-invoke-sanitize.ts` sanitizes `node.invoke` parameters before they are sent to the device:

- Strips unexpected fields.
- Validates parameter types.
- Prevents injection of control characters or excessive payloads.

---

## 24. Config Hot-Reload

The gateway supports hot-reloading of configuration changes without restarting the server process.

### 24.1 File Watching

`config-reload.ts` uses `chokidar` to watch configuration files for changes. Default settings:

```typescript
const DEFAULT_RELOAD_SETTINGS: GatewayReloadSettings = {
  mode: "hybrid", // Default reload mode
  debounceMs: 300, // 300ms debounce
};
```

### 24.2 Reload Modes

| Mode               | Behavior                                                |
| ------------------ | ------------------------------------------------------- |
| `off`              | No automatic reload                                     |
| `restart`          | Full gateway restart on any config change               |
| `hot`              | Hot-reload applicable changes, ignore others            |
| `hybrid` (default) | Hot-reload what's possible, restart only when necessary |

### 24.3 Reload Plan

When a config change is detected, the system builds a `GatewayReloadPlan`:

```typescript
export type GatewayReloadPlan = {
  changedPaths: string[]; // Config paths that changed
  restartGateway: boolean; // Whether a full restart is needed
  restartReasons: string[]; // Why restart is needed
  hotReasons: string[]; // What can be hot-reloaded
  reloadHooks: boolean; // Reload webhook config
  restartGmailWatcher: boolean; // Restart Gmail watcher
  restartBrowserControl: boolean; // Restart browser control
  restartCron: boolean; // Restart cron scheduler
  restartHeartbeat: boolean; // Restart heartbeat
  restartChannels: Set<ChannelKind>; // Channels to restart
  noopPaths: string[]; // Paths that don't require action
};
```

### 24.4 Hot-Reloadable vs Restart-Required

**Hot-reloadable (no restart needed):**
| Config Path Prefix | Action |
|-------------------|--------|
| `hooks.gmail` | Restart Gmail watcher |
| `hooks` | Reload hooks configuration |
| `agents.defaults.heartbeat` | Restart heartbeat |
| `agent.heartbeat` | Restart heartbeat |
| `cron` | Restart cron scheduler |
| `browser` | Restart browser control |
| Channel-specific paths | Restart specific channel |

**No-op changes (ignored):**

- `meta`, `identity`, `wizard`, `logging`, `models`, `agents`, `tools`, `bindings`, `audio`, `agent`, `routing`, `messages`, `session`
- `gateway.remote`, `gateway.reload`

**Restart-required (full gateway restart):**

- `gateway.plugins` -- Plugin changes
- `gateway` settings (other than remote/reload) -- Server settings
- `gateway.discovery` -- Service discovery
- `gateway.canvas.host` -- Canvas host

### 24.5 Deep Comparison

The reload system uses `isDeepStrictEqual()` from Node.js `util` to compare the previous and new configuration. Only genuinely changed paths trigger reload actions.

### 24.6 Reload Handlers

`server-reload-handlers.ts` implements the actual reload logic for each hot-reloadable subsystem.

---

## 25. Security Architecture

The gateway implements defense in depth across multiple layers.

### 25.1 CSRF Protection

`origin-check.ts` validates the `Origin` header on WebSocket upgrade requests and HTTP requests to prevent cross-site request forgery. Requests with unexpected origins are rejected.

### 25.2 Authentication Rate Limiting

As detailed in Section 4.2, the sliding-window rate limiter protects against brute-force attacks across four independent scopes.

### 25.3 Control Plane Rate Limiting

`control-plane-rate-limit.ts` implements a separate rate limiter for write operations on the control plane:

- **Rate:** 3 requests per 60 seconds per device|IP.
- **Purpose:** Prevents abuse of administrative operations.

### 25.4 Control Plane Audit

`control-plane-audit.ts` tracks the actor (device ID, client ID, user, IP) for all control plane operations, providing an audit trail.

### 25.5 TLS Configuration

`server/tls.ts` handles TLS configuration for the gateway server:

- Certificate and private key loading.
- TLS version constraints.
- Cipher suite configuration.

The WebSocket client (`client.ts`) enforces TLS for all non-loopback connections and supports TLS fingerprint pinning.

### 25.6 Path Safety

`path-safety.ts` (in plugins) provides path containment checks to prevent directory traversal attacks. The `isWithinDir()` function verifies that a resolved path is contained within an expected base directory.

### 25.7 Origin Checking

`origin-check.ts` validates the `Origin` header against expected origins, preventing cross-origin WebSocket hijacking.

### 25.8 Capability Tokens

`canvas-capability.ts` implements secure scoped URLs with capability tokens:

- **Token generation:** 18 random bytes, base64url-encoded.
- **TTL:** 10 minutes.
- **Use case:** Granting time-limited access to canvas resources without requiring authentication headers.

### 25.9 Node Invoke Protections

Multiple layers protect the node invocation path:

1. **Command policy:** Platform-specific allowlists (Section 23.3).
2. **Invoke sanitization:** Parameter sanitization (Section 23.4).
3. **System.run approval:** Interactive approval workflow (Section 22.4).
4. **Approval bypass injection prevention:** The system verifies approval IDs cannot be crafted by malicious agents.

### 25.10 Secret Comparison

All secret comparisons use `safeEqualSecret()` for constant-time comparison, preventing timing-based side-channel attacks.

### 25.11 WebSocket Security

- **Plaintext blocking:** `ws://` to non-loopback addresses is blocked (CWE-319, CVSS 9.8).
- **TLS fingerprint pinning:** Client can verify server certificate fingerprint.
- **Max payload size:** 25 MB limit prevents memory exhaustion.
- **Slow consumer detection:** Connections that cannot keep up with broadcast events are detected and handled.

### 25.12 Webhook Security

- **Token authentication:** All webhook requests must include a valid token.
- **Prototype chain traversal blocking:** Template rendering prevents `__proto__` access.
- **Body size limit:** 256 KB default maximum.
- **Session key prefix restrictions:** Configurable prefix allowlists for session keys.

---

## 26. Event Broadcasting

The gateway's event broadcasting system (`server-broadcast.ts`) distributes events to connected WebSocket clients with scope-gating and reliability features.

### 26.1 Broadcaster Creation

```typescript
export function createGatewayBroadcaster(params: { clients: Set<GatewayWsClient> }) {
  let seq = 0;
  // ...
}
```

The broadcaster maintains a monotonically increasing sequence counter.

### 26.2 Scope-Gated Events

Before sending an event to a client, the broadcaster checks `hasEventScope()`:

1. Look up the event name in `EVENT_SCOPE_GUARDS`.
2. If no guard exists, all clients receive the event.
3. If a guard exists, check the client's role and scopes:
   - Only `operator` role clients are eligible.
   - `operator.admin` scope bypasses all guards.
   - Otherwise, the client must have at least one of the required scopes.

### 26.3 Event Frame Format

```json
{
  "type": "event",
  "event": "agent.delta",
  "payload": { "text": "Hello" },
  "seq": 42,
  "stateVersion": { "presence": 5, "health": 12 }
}
```

- `seq` -- Monotonically increasing for untargeted broadcasts. Omitted for targeted events.
- `stateVersion` -- Optional versioning for state synchronization (presence, health).

### 26.4 Targeted Events

Events can be targeted to specific connection IDs using `broadcastToConnIds()`. Targeted events do not increment the global sequence counter and omit `seq` from the frame.

### 26.5 Slow Consumer Detection

The broadcaster detects clients that are falling behind by checking `MAX_BUFFERED_BYTES` from `server-constants.ts`. When a client's WebSocket buffer exceeds this threshold:

- If `dropIfSlow` is set, the event is silently dropped for that client.
- Otherwise, the client's connection is force-closed.

### 26.6 WebSocket Logging

When `shouldLogWs()` returns true, the broadcaster logs event details including the event name and a summarized payload (via `summarizeAgentEventForWsLog()`).

---

## 27. Networking

The gateway's networking module (`net.ts`) provides comprehensive IP address handling, proxy chain resolution, and bind host configuration.

### 27.1 Primary LAN IP Detection

```typescript
export function pickPrimaryLanIPv4(): string | undefined;
```

Prefers common interface names (`en0` on macOS, `eth0` on Linux), then falls back to any external IPv4 address. Skips internal (loopback) interfaces.

### 27.2 Loopback Detection

```typescript
export function isLoopbackAddress(ip: string | undefined): boolean;
```

Recognizes:

- `127.0.0.1` and the entire `127.0.0.0/8` range.
- `::1` (IPv6 loopback).
- `::ffff:127.*` (IPv4-mapped IPv6 loopback).

### 27.3 Private/Loopback Detection

```typescript
export function isPrivateOrLoopbackAddress(ip: string | undefined): boolean;
```

Recognizes all loopback addresses plus:

- **RFC1918:** `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.
- **Link-local:** `169.254.0.0/16`.
- **CGNAT:** `100.64.0.0/10` (commonly used by Tailscale).
- **IPv6 ULA:** `fc00::/7`.
- **IPv6 link-local:** `fe80::/10`.

### 27.4 Proxy Chain Resolution

```typescript
export function resolveClientIp(params: {
  remoteAddr: string;
  xForwardedFor?: string;
  xRealIp?: string;
  trustedProxies?: string[];
  allowRealIpFallback?: boolean;
}): string;
```

Walks the `X-Forwarded-For` proxy chain from right to left, trusting only addresses that match the trusted proxy list. The first untrusted address is the client's real IP. `X-Real-IP` is only used as a fallback when explicitly enabled.

### 27.5 Trusted Proxy Matching

```typescript
export function isTrustedProxyAddress(ip: string, trustedProxies: string[]): boolean;
```

Supports both individual IP addresses and CIDR notation (e.g., `10.0.0.0/8`).

### 27.6 Bind Host Modes

```typescript
export function resolveGatewayBindHost(mode: string): string;
```

| Mode       | Bind Address  | Description                              |
| ---------- | ------------- | ---------------------------------------- |
| `loopback` | `127.0.0.1`   | Localhost only                           |
| `lan`      | `0.0.0.0`     | All LAN interfaces                       |
| `tailnet`  | Tailscale IP  | Tailscale network only                   |
| `auto`     | Auto-detected | Uses heuristics to pick the best address |
| Custom     | As specified  | Bind to a specific IP or hostname        |

### 27.7 Dual-Stack Support

The gateway supports dual-stack IPv4+IPv6 operation. The `pickPrimaryLanIPv4()` function handles the IPv4 side, while IPv6 is supported through the network interface enumeration and bind host resolution.

### 27.8 Host Header Normalization

```typescript
export function normalizeHostHeader(hostHeader?: string): string;
export function resolveHostName(hostHeader?: string): string;
```

Handles:

- Bracketed IPv6 addresses (`[::1]:8080` -> `::1`).
- Unbracketed IPv6 addresses.
- IPv4 addresses with ports.
- Hostname with ports.

### 27.9 Secure WebSocket URL Validation

```typescript
export function isSecureWebSocketUrl(url: string): boolean;
```

Returns true only for `wss://` URLs. Used by the client to enforce TLS for non-loopback connections.

---

## 28. Protocol Schema

The gateway protocol uses TypeBox schemas for runtime validation of all RPC messages. The schemas are organized in `src/gateway/protocol/`.

### 28.1 Schema Organization

| File                             | Contents                                                        |
| -------------------------------- | --------------------------------------------------------------- |
| `index.ts`                       | Barrel export for the protocol module                           |
| `client-info.ts`                 | Client info types (name, version, platform, capabilities)       |
| `schema.ts`                      | Schema barrel export                                            |
| `schema/primitives.ts`           | Primitive type schemas (string, number, boolean, UUID)          |
| `schema/types.ts`                | Shared type definitions                                         |
| `schema/frames.ts`               | WebSocket frame schemas (request, response, event)              |
| `schema/error-codes.ts`          | Error code definitions and schemas                              |
| `schema/agents-models-skills.ts` | Combined agent/model/skill listing schemas                      |
| `schema/agent.ts`                | Agent-specific schemas                                          |
| `schema/channels.ts`             | Channel schemas including `ChannelAccountSnapshot` (25+ fields) |
| `schema/config.ts`               | Configuration schemas                                           |
| `schema/cron.ts`                 | Cron job schemas                                                |
| `schema/devices.ts`              | Device and pairing schemas                                      |
| `schema/exec-approvals.ts`       | Exec approval schemas                                           |
| `schema/logs-chat.ts`            | Log and chat message schemas                                    |
| `schema/nodes.ts`                | Node device schemas                                             |
| `schema/push.ts`                 | Push notification schemas                                       |
| `schema/sessions.ts`             | Session schemas                                                 |
| `schema/snapshot.ts`             | System snapshot schemas                                         |
| `schema/wizard.ts`               | Setup wizard schemas                                            |
| `schema/protocol-schemas.ts`     | Registry mapping method names to request/response schemas       |

### 28.2 Protocol Version

The protocol module exports `PROTOCOL_VERSION`, a numeric version used during the WebSocket handshake. Clients declare their `minProtocol` and `maxProtocol`, and the server negotiates the highest mutually supported version.

### 28.3 Frame Validation

Three validation functions are exported:

- `validateRequestFrame(data)` -- Validates incoming client request frames.
- `validateResponseFrame(data)` -- Validates server response frames (used by the client).
- `validateEventFrame(data)` -- Validates server event frames (used by the client).

### 28.4 Connect Params

```typescript
export type ConnectParams = {
  token?: string;
  password?: string;
  clientName: GatewayClientName;
  clientDisplayName?: string;
  clientVersion?: string;
  platform?: string;
  mode?: GatewayClientMode;
  role?: string;
  scopes?: string[];
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  deviceIdentity?: { ... };
  minProtocol?: number;
  maxProtocol?: number;
};
```

### 28.5 ChannelAccountSnapshot Schema

The `ChannelAccountSnapshot` schema in `schema/channels.ts` captures the full runtime state of a channel account with 25+ fields including:

- `accountId`, `channelId` -- Identity.
- `running`, `connected`, `enabled`, `configured` -- State flags.
- `error`, `errorAt` -- Error tracking.
- `startedAt`, `connectedAt`, `disconnectedAt` -- Timestamps.
- `restartAttempts`, `lastRestartAt` -- Restart tracking.
- `lastMessageAt`, `lastActivityAt` -- Activity tracking.
- Platform-specific metadata fields.

---

## 29. Bundled Channel Extensions Catalog

The following table catalogs all 25+ channel extensions bundled with OpenClaw-MABOS. Each extension lives in `extensions/<name>/` and registers a channel plugin with the gateway.

### 29.1 Extensions Overview

| Extension          | Directory                    | Registration Pattern      | Notable Features                                                                            |
| ------------------ | ---------------------------- | ------------------------- | ------------------------------------------------------------------------------------------- |
| **Discord**        | `extensions/discord/`        | Standard + subagent hooks | `registerDiscordSubagentHooks` for Discord-specific agent behaviors. Guild admin actions.   |
| **Slack**          | `extensions/slack/`          | Standard                  | Slack-specific action handling via `slack.actions.ts`. Block Kit support.                   |
| **Telegram**       | `extensions/telegram/`       | Standard (type-cast)      | Plugin type-cast as `ChannelPlugin`. Rich API integration (inline keyboards, bot commands). |
| **WhatsApp**       | `extensions/whatsapp/`       | Standard                  | WhatsApp-specific heartbeat. QR code pairing. Media message support.                        |
| **Signal**         | `extensions/signal/`         | Standard                  | Signal protocol integration. Attachment and reaction support.                               |
| **Matrix**         | `extensions/matrix/`         | Standard                  | Matrix protocol (Element, etc.). End-to-end encryption support.                             |
| **LINE**           | `extensions/line/`           | Standard + card commands  | `registerLineCardCommand` for LINE-specific rich message cards.                             |
| **iMessage**       | `extensions/imessage/`       | Standard                  | Via BlueBubbles bridge. Tapback and attachment support.                                     |
| **IRC**            | `extensions/irc/`            | Standard                  | Internet Relay Chat integration. Multi-channel support.                                     |
| **Nostr**          | `extensions/nostr/`          | Standard                  | Decentralized social protocol. Relay-based messaging.                                       |
| **Feishu**         | `extensions/feishu/`         | Standard                  | Feishu/Lark enterprise messaging (ByteDance).                                               |
| **Google Chat**    | `extensions/googlechat/`     | Standard                  | Google Workspace Chat integration.                                                          |
| **MS Teams**       | `extensions/msteams/`        | Standard                  | Microsoft Teams integration.                                                                |
| **Mattermost**     | `extensions/mattermost/`     | Standard                  | Open-source Slack alternative.                                                              |
| **Nextcloud Talk** | `extensions/nextcloud-talk/` | Standard                  | Nextcloud communication platform.                                                           |
| **Synology Chat**  | `extensions/synology-chat/`  | Standard                  | Synology NAS chat application.                                                              |
| **Tlon**           | `extensions/tlon/`           | Standard                  | Urbit-based messaging.                                                                      |
| **Twitch**         | `extensions/twitch/`         | Standard                  | Twitch chat integration.                                                                    |
| **Zalo**           | `extensions/zalo/`           | Standard                  | Vietnamese messaging platform (Official Account API).                                       |
| **Zalo User**      | `extensions/zalouser/`       | Standard                  | Zalo personal user account integration.                                                     |
| **BlueBubbles**    | `extensions/bluebubbles/`    | Standard                  | iMessage bridge server. Status issue detection.                                             |
| **Lobster**        | `extensions/lobster/`        | Standard                  | Lobster messaging platform.                                                                 |
| **Voice Call**     | `extensions/voice-call/`     | Standard                  | Voice call channel for phone integration.                                                   |
| **Talk Voice**     | `extensions/talk-voice/`     | Standard                  | Voice-based conversational interface.                                                       |

### 29.2 Registration Pattern

All extensions follow the same registration pattern:

```typescript
import { emptyPluginConfigSchema, setChannelRuntime } from "shared";
import { channelPlugin } from "./plugin.js";

export default {
  id: "channel-name",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    setChannelRuntime(api.runtime);
    api.registerChannel({ plugin: channelPlugin });
  },
};
```

**Notable variations:**

- **Discord** adds subagent hooks:

  ```typescript
  register(api) {
    setChannelRuntime(api.runtime);
    api.registerChannel({ plugin: channelPlugin });
    registerDiscordSubagentHooks(api);
  }
  ```

- **LINE** adds card commands:

  ```typescript
  register(api) {
    setChannelRuntime(api.runtime);
    api.registerChannel({ plugin: channelPlugin });
    registerLineCardCommand(api);
  }
  ```

- **Telegram** uses a type cast:
  ```typescript
  api.registerChannel({ plugin: channelPlugin as ChannelPlugin });
  ```

### 29.3 Status Issue Detection

Several channels have dedicated status issue detection modules in `plugins/status-issues/`:

| Channel     | Module           | Detected Issues                                        |
| ----------- | ---------------- | ------------------------------------------------------ |
| BlueBubbles | `bluebubbles.ts` | Server connectivity, API key validity                  |
| Discord     | `discord.ts`     | Token validity, gateway connection, intents            |
| Telegram    | `telegram.ts`    | Bot token validity, webhook configuration              |
| WhatsApp    | `whatsapp.ts`    | Session validity, QR code expiry, connection stability |
| Shared      | `shared.ts`      | Common issue detection utilities                       |

### 29.4 Per-Channel Actions

Platform-specific action handlers live in `plugins/actions/`:

| Channel  | Module                                                                           | Supported Actions                                   |
| -------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| Discord  | `discord/handle-action.ts`, `discord/handle-action.guild-admin.ts`, `discord.ts` | Reactions, guild administration, message management |
| Signal   | `signal.ts`                                                                      | Reactions, message deletion                         |
| Telegram | `telegram.ts`                                                                    | Inline keyboard callbacks, message editing          |
| Shared   | `shared.ts`                                                                      | Common action utilities                             |

---

## 30. File Inventory

### 30.1 Gateway Core (src/gateway/) -- 141 Source Files

**Server Core (10 files):**

```
server.ts                    -- Re-export of startGatewayServer
server.impl.ts               -- Server factory implementation
server-startup.ts             -- Bootstrap sequence
server-startup-memory.ts      -- Memory subsystem init
server-startup-log.ts         -- Startup diagnostics
server-constants.ts           -- Server constants (MAX_BUFFERED_BYTES, etc.)
server-shared.ts              -- Shared server state
server-utils.ts               -- Server utilities
server-runtime-state.ts       -- Runtime state container
boot.ts                       -- Boot-once system (BOOT.md)
```

**Authentication (5 files):**

```
auth.ts                       -- Core auth: resolveGatewayAuth, authorizeGatewayConnect
auth-rate-limit.ts            -- Sliding-window rate limiter
startup-auth.ts               -- Auth initialization
device-auth.ts                -- Ed25519 device identity payload
probe-auth.ts                 -- Health probe auth
```

**WebSocket Protocol (8 files):**

```
server/ws-connection.ts       -- WebSocket connection handling
server/ws-connection/auth-messages.ts    -- Auth message protocol
server/ws-connection/connect-policy.ts   -- Connection acceptance policy
server/ws-connection/message-handler.ts  -- Message routing
server/ws-types.ts            -- WebSocket type definitions
server-ws-runtime.ts          -- WebSocket runtime state
ws-logging.ts                 -- WebSocket logging
ws-log.ts                     -- Structured WS logging
```

**Client (2 files):**

```
client.ts                     -- GatewayClient class (WebSocket client)
call.ts                       -- RPC client: callGateway, callGatewayCli, etc.
```

**HTTP Layer (7 files):**

```
server-http.ts                -- HTTP route mounting
server/http-listen.ts         -- HTTP listen binding
server/plugins-http.ts        -- Plugin HTTP routes
http-auth-helpers.ts          -- Bearer token extraction
http-common.ts                -- Response/SSE helpers, security headers
http-endpoint-helpers.ts      -- Reusable POST JSON endpoint handler
http-utils.ts                 -- Agent ID and session key resolution
```

**OpenAI/OpenResponses (3 files):**

```
openai-http.ts                -- /v1/chat/completions endpoint
openresponses-http.ts         -- /v1/responses endpoint
open-responses.schema.ts      -- Zod schemas for OpenResponses
```

**Channel Management (2 files):**

```
server-channels.ts            -- Channel lifecycle manager
channel-health-monitor.ts     -- Background health monitor
```

**Chat System (4 files):**

```
server-chat.ts                -- Chat run lifecycle, registries
chat-abort.ts                 -- Run abort handling
chat-attachments.ts           -- Image extraction
chat-sanitize.ts              -- Message sanitization
```

**RPC Methods (server-methods/) (24 files):**

```
agent.ts                      -- Agent management
agents.ts                     -- Agent listing/CRUD
chat.ts                       -- Chat operations
channels.ts                   -- Channel status/logout
config.ts                     -- Config get/set
connect.ts                    -- Client connection
cron.ts                       -- Cron management
devices.ts                    -- Device management
exec-approvals.ts             -- Exec approval workflow
exec-approval.ts              -- Exec approval wait
health.ts                     -- Health check
logs.ts                       -- Log tailing
models.ts                     -- Model listing
nodes.ts                      -- Node management
push.ts                       -- Push notifications
send.ts                       -- Message sending
sessions.ts                   -- Session management
skills.ts                     -- Skill management
system.ts                     -- System info
talk.ts                       -- Voice mode
tts.ts                        -- Text-to-speech
update.ts                     -- Update management
usage.ts                      -- Usage statistics
validation.ts                 -- Request validation
voicewake.ts                  -- Voice wake word
web.ts                        -- Web interface
wizard.ts                     -- Setup wizard
```

**Role and Scope (2 files):**

```
role-policy.ts                -- 2 roles: operator, node
method-scopes.ts              -- 5 scopes + method mapping
```

**Security (6 files):**

```
origin-check.ts               -- CSRF protection
control-plane-audit.ts        -- Audit tracking
control-plane-rate-limit.ts   -- Write op rate limiting
node-command-policy.ts         -- Platform command allowlists
node-invoke-sanitize.ts        -- Invoke param sanitization
node-invoke-system-run-approval.ts -- system.run gating
```

**Config and Reload (3 files):**

```
config-reload.ts              -- Hot reload with chokidar
server-runtime-config.ts      -- Runtime config state
server-reload-handlers.ts     -- Reload event handlers
```

**Control UI (4 files):**

```
control-ui.ts                 -- SPA serving, TOCTOU safety
control-ui-contract.ts        -- Bootstrap config path
control-ui-csp.ts             -- Content Security Policy
control-ui-shared.ts          -- Avatar URL resolution
```

**Canvas and Capabilities (2 files):**

```
canvas-capability.ts          -- Scoped URLs with capability tokens
live-image-probe.ts           -- PNG rendering with pixel font
```

**Networking (1 file):**

```
net.ts                        -- IP resolution, proxy chains, bind hosts
```

**Events and Broadcasting (5 files):**

```
events.ts                     -- Gateway event types
server-broadcast.ts           -- Scope-gated broadcasting
server-node-events.ts         -- Node device events
server-node-events-types.ts   -- Node event types
server-node-subscriptions.ts  -- Node event subscriptions
```

**Webhooks (2 files):**

```
hooks.ts                      -- Webhook endpoint config
hooks-mapping.ts              -- Webhook-to-agent routing
```

**Exec Approval (1 file):**

```
exec-approval-manager.ts      -- ExecApprovalManager class
```

**Agent/Assistant (3 files):**

```
agent-event-assistant-text.ts  -- Extract text from agent events
agent-prompt.ts               -- Build agent messages
assistant-identity.ts         -- Name/avatar/emoji resolution
```

**Sessions (6 files):**

```
server-session-key.ts         -- Session key management
sessions-patch.ts             -- Session patching
sessions-resolve.ts           -- Session resolution
session-utils.ts              -- Session utilities
session-utils.fs.ts           -- Filesystem session utilities
session-utils.types.ts        -- Session utility types
```

**Misc Server Subsystems (14 files):**

```
server-browser.ts             -- Lazy browser control
server-cron.ts                -- Cron scheduling
server-discovery.ts           -- Service discovery
server-discovery-runtime.ts   -- Discovery runtime state
server-lanes.ts               -- Lane/threading
server-maintenance.ts         -- Maintenance mode
server-methods.ts             -- Method router
server-mobile-nodes.ts        -- Mobile node management
server-model-catalog.ts       -- Model catalog
server-plugins.ts             -- Plugin integration
server-restart-sentinel.ts    -- Restart sentinel
server-tailscale.ts           -- Tailscale integration
server/tls.ts                 -- TLS configuration
server/health-state.ts        -- Health state
server/presence-events.ts     -- Presence events
server-wizard-sessions.ts     -- Setup wizard sessions
tools-invoke-http.ts          -- HTTP-based tool invocation
```

**Protocol Schema (src/gateway/protocol/) (20 files):**

```
index.ts                      -- Barrel export
client-info.ts                -- Client info types
schema.ts                     -- Schema barrel
schema/agents-models-skills.ts -- Agent/model/skill schemas
schema/agent.ts               -- Agent schema
schema/channels.ts            -- Channel schemas
schema/config.ts              -- Config schemas
schema/cron.ts                -- Cron schemas
schema/devices.ts             -- Device schemas
schema/error-codes.ts         -- Error codes
schema/exec-approvals.ts      -- Exec approval schemas
schema/frames.ts              -- Frame schemas
schema/logs-chat.ts           -- Log/chat schemas
schema/nodes.ts               -- Node schemas
schema/primitives.ts          -- Primitive types
schema/protocol-schemas.ts    -- Protocol schema registry
schema/push.ts                -- Push notification schemas
schema/sessions.ts            -- Session schemas
schema/snapshot.ts            -- Snapshot schemas
schema/types.ts               -- Type definitions
schema/wizard.ts              -- Wizard schemas
```

### 30.2 Channel System (src/channels/) -- 88 Source Files

**Core Infrastructure (21 files):**

```
channel-config.ts             -- Channel key resolution, match config
registry.ts                   -- Channel registry
session.ts                    -- Channel session management
dock.ts                       -- Channel docking/lifecycle
targets.ts                    -- Outbound target resolution
allow-from.ts                 -- Allowlist management
allowlist-match.ts            -- Allowlist matching logic
mention-gating.ts             -- Mention-based gating
command-gating.ts             -- Command access control
model-overrides.ts            -- Per-channel model overrides
typing.ts                     -- Typing indicator support
ack-reactions.ts              -- Acknowledgment reactions
draft-stream-controls.ts      -- Streaming draft controls
draft-stream-loop.ts          -- Streaming draft loop
sender-identity.ts            -- Sender identification
sender-label.ts               -- Sender labels
conversation-label.ts         -- Conversation labeling
reply-prefix.ts               -- Reply prefix handling
account-summary.ts            -- Account snapshots
status-reactions.ts           -- Status reaction handling
chat-type.ts                  -- Chat type classification
location.ts                   -- Location handling
logging.ts                    -- Channel logging
```

**Plugin Architecture (src/channels/plugins/) (21 files):**

```
index.ts                      -- Plugin registry exports
types.ts                      -- Main type exports
types.core.ts                 -- Core channel types
types.plugin.ts               -- Plugin interface contract
types.adapters.ts             -- Adapter interfaces
catalog.ts                    -- UI catalog builder
load.ts                       -- Lazy plugin loading
registry-loader.ts            -- Registry-based loader
helpers.ts                    -- Shared helpers
config-helpers.ts             -- Config helpers
config-schema.ts              -- Config schema definitions
config-writes.ts              -- Config write operations
directory-config.ts           -- Directory-based config
status.ts                     -- Status building
pairing.ts                    -- Pairing flows
pairing-message.ts            -- Pairing messages
media-limits.ts               -- Per-channel media limits
message-actions.ts            -- Action dispatch
message-action-names.ts       -- Action name constants
group-mentions.ts             -- Group mention handling
allowlist-match.ts            -- Plugin-level allowlist matching
whatsapp-heartbeat.ts         -- WhatsApp heartbeat
account-action-gate.ts        -- Account action gating
account-helpers.ts            -- Account helpers
setup-helpers.ts              -- Setup utilities
slack.actions.ts              -- Slack action handling
bluebubbles-actions.ts        -- BlueBubbles action handling
```

**Per-Channel Normalizers (plugins/normalize/) (7 files):**

```
discord.ts                    -- Discord normalizer
slack.ts                      -- Slack normalizer
telegram.ts                   -- Telegram normalizer
whatsapp.ts                   -- WhatsApp normalizer
signal.ts                     -- Signal normalizer
imessage.ts                   -- iMessage normalizer
shared.ts                     -- Shared normalization utilities
```

**Per-Channel Outbound (plugins/outbound/) (8 files):**

```
discord.ts                    -- Discord outbound
slack.ts                      -- Slack outbound
telegram.ts                   -- Telegram outbound
whatsapp.ts                   -- WhatsApp outbound
signal.ts                     -- Signal outbound
imessage.ts                   -- iMessage outbound
direct-text-media.ts          -- Generic text/media outbound
load.ts                       -- Dynamic outbound loading
```

**Per-Channel Onboarding (plugins/onboarding/) (10 files):**

```
discord.ts                    -- Discord onboarding
slack.ts                      -- Slack onboarding
telegram.ts                   -- Telegram onboarding
whatsapp.ts                   -- WhatsApp onboarding
signal.ts                     -- Signal onboarding
imessage.ts                   -- iMessage onboarding
channel-access.ts             -- Channel access control
channel-access-configure.ts   -- Access configuration
helpers.ts                    -- Shared onboarding utilities
onboarding-types.ts           -- Onboarding type definitions
```

**Per-Channel Actions (plugins/actions/) (6 files):**

```
discord/handle-action.ts      -- Discord action handler
discord/handle-action.guild-admin.ts -- Discord guild admin actions
discord.ts                    -- Discord action registry
signal.ts                     -- Signal actions
telegram.ts                   -- Telegram actions
shared.ts                     -- Shared action utilities
```

**Per-Channel Status Issues (plugins/status-issues/) (5 files):**

```
bluebubbles.ts                -- BlueBubbles issue detection
discord.ts                    -- Discord issue detection
telegram.ts                   -- Telegram issue detection
whatsapp.ts                   -- WhatsApp issue detection
shared.ts                     -- Shared issue detection utilities
```

**Platform-Specific (5 files):**

```
telegram/allow-from.ts        -- Telegram-specific allowlist
telegram/api.ts               -- Telegram API client
web/index.ts                  -- Web channel
plugins/agent-tools/whatsapp-login.ts -- WhatsApp login tool
```

### 30.3 Channel Extensions (extensions/) -- 25+ Directories

```
extensions/discord/           -- Discord channel extension
extensions/slack/             -- Slack channel extension
extensions/telegram/          -- Telegram channel extension
extensions/whatsapp/          -- WhatsApp channel extension
extensions/signal/            -- Signal channel extension
extensions/matrix/            -- Matrix channel extension
extensions/line/              -- LINE channel extension
extensions/imessage/          -- iMessage channel extension
extensions/irc/               -- IRC channel extension
extensions/nostr/             -- Nostr channel extension
extensions/feishu/            -- Feishu/Lark channel extension
extensions/googlechat/        -- Google Chat channel extension
extensions/msteams/           -- MS Teams channel extension
extensions/mattermost/        -- Mattermost channel extension
extensions/nextcloud-talk/    -- Nextcloud Talk channel extension
extensions/synology-chat/     -- Synology Chat channel extension
extensions/tlon/              -- Tlon (Urbit) channel extension
extensions/twitch/            -- Twitch channel extension
extensions/zalo/              -- Zalo Official Account extension
extensions/zalouser/          -- Zalo personal user extension
extensions/bluebubbles/       -- BlueBubbles (iMessage bridge) extension
extensions/lobster/           -- Lobster channel extension
extensions/voice-call/        -- Voice call channel extension
extensions/talk-voice/        -- Talk voice channel extension
```

**Non-channel extensions also present in the extensions directory:**

```
extensions/copilot-proxy/     -- Copilot proxy integration
extensions/device-pair/       -- Device pairing extension
extensions/diagnostics-otel/  -- OpenTelemetry diagnostics
extensions/google-antigravity-auth/ -- Google auth extension
extensions/google-gemini-cli-auth/  -- Gemini CLI auth extension
extensions/llm-task/          -- LLM task extension
extensions/mabos/             -- MABOS core extension
extensions/memory-core/       -- Memory core extension
extensions/memory-lancedb/    -- LanceDB memory extension
extensions/minimax-portal-auth/ -- Minimax auth extension
extensions/open-prose/        -- Open prose extension
extensions/phone-control/     -- Phone control extension
extensions/qwen-portal-auth/  -- Qwen auth extension
extensions/shared/            -- Shared extension utilities
extensions/thread-ownership/  -- Thread ownership extension
```

---

## 31. References to Companion Documents

This document covers the gateway and channel integration subsystems in isolation. For the broader OpenClaw-MABOS system, refer to these companion documents:

| Document                                | Scope                                                           |
| --------------------------------------- | --------------------------------------------------------------- |
| `openclaw-mabos-system-architecture.md` | Full system architecture covering all subsystems                |
| `plugin-extension-architecture.md`      | Plugin and extension system design, registration, and lifecycle |
| `multi-agent-coordination.md`           | Multi-agent coordination, subagent hooks, and agent routing     |
| `reasoning-inference-engine.md`         | Reasoning and inference engine internals                        |
| `bdi-sbvr-framework.md`                 | BDI-SBVR agent framework                                        |
| `sbvr-ontology-system.md`               | SBVR ontology system                                            |
| `rlm-memory-enhancements.md`            | RLM memory system enhancements                                  |

### Internal Cross-References

| Topic                    | Section in This Document |
| ------------------------ | ------------------------ |
| Authentication           | Section 4                |
| WebSocket Protocol       | Section 5                |
| Role/Scope Authorization | Section 6                |
| OpenAI Compatibility     | Section 8                |
| Channel Lifecycle        | Section 12               |
| Health Monitoring        | Section 13               |
| Message Flow             | Section 18               |
| Security                 | Section 25               |
| Networking               | Section 27               |

---

## Appendix A: Gateway Client Close Codes

| Code | Meaning                           |
| ---- | --------------------------------- |
| 1000 | Normal closure                    |
| 1006 | Abnormal closure (no close frame) |
| 1008 | Policy violation (auth failure)   |
| 1012 | Service restart                   |

## Appendix B: Rate Limit Scopes

| Scope Constant                        | String Value      | Used For            |
| ------------------------------------- | ----------------- | ------------------- |
| `AUTH_RATE_LIMIT_SCOPE_DEFAULT`       | `"default"`       | General purpose     |
| `AUTH_RATE_LIMIT_SCOPE_SHARED_SECRET` | `"shared-secret"` | Token/password auth |
| `AUTH_RATE_LIMIT_SCOPE_DEVICE_TOKEN`  | `"device-token"`  | Device token auth   |
| `AUTH_RATE_LIMIT_SCOPE_HOOK_AUTH`     | `"hook-auth"`     | Webhook auth        |

## Appendix C: Channel Restart Backoff Parameters

| Parameter      | Value              |
| -------------- | ------------------ |
| Initial delay  | 5,000 ms           |
| Maximum delay  | 300,000 ms (5 min) |
| Backoff factor | 2                  |
| Jitter         | 10%                |
| Max attempts   | 10                 |

## Appendix D: Health Monitor Parameters

| Parameter         | Default            |
| ----------------- | ------------------ |
| Check interval    | 300,000 ms (5 min) |
| Startup grace     | 60,000 ms (1 min)  |
| Cooldown cycles   | 2                  |
| Max restarts/hour | 3                  |

## Appendix E: Node Command Categories

| Category              | Commands                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Canvas                | `canvas.present`, `canvas.hide`, `canvas.navigate`, `canvas.eval`, `canvas.snapshot`, `canvas.a2ui.push`, `canvas.a2ui.pushJSONL`, `canvas.a2ui.reset` |
| Camera (safe)         | `camera.list`                                                                                                                                          |
| Camera (dangerous)    | `camera.snap`, `camera.clip`                                                                                                                           |
| Screen (dangerous)    | `screen.record`                                                                                                                                        |
| Location              | `location.get`                                                                                                                                         |
| Device                | `device.info`, `device.status`                                                                                                                         |
| Contacts (safe)       | `contacts.search`                                                                                                                                      |
| Contacts (dangerous)  | `contacts.add`                                                                                                                                         |
| Calendar (safe)       | `calendar.events`                                                                                                                                      |
| Calendar (dangerous)  | `calendar.add`                                                                                                                                         |
| Reminders (safe)      | `reminders.list`                                                                                                                                       |
| Reminders (dangerous) | `reminders.add`                                                                                                                                        |
| Photos                | `photos.latest`                                                                                                                                        |
| Motion                | `motion.activity`, `motion.pedometer`                                                                                                                  |
| SMS (dangerous)       | `sms.send`                                                                                                                                             |
| System (iOS)          | `system.notify`                                                                                                                                        |
| System (full)         | `system.run`, `system.which`, `system.notify`, `browser.proxy`                                                                                         |

## Appendix F: OpenResponses Streaming Event Types

| Event Type                    | Payload                              |
| ----------------------------- | ------------------------------------ |
| `response.created`            | Full response resource               |
| `response.in_progress`        | Response resource with status update |
| `response.output_item.added`  | Output item added to response        |
| `response.content_part.added` | Content part added to output item    |
| `response.output_text.delta`  | Incremental text delta               |
| `response.output_text.done`   | Final text for content part          |
| `response.content_part.done`  | Completed content part               |
| `response.output_item.done`   | Completed output item                |
| `response.completed`          | Full completed response resource     |
| `error`                       | Error details                        |

## Appendix G: Config Reload Rules

| Config Path Prefix          | Classification | Action                                 |
| --------------------------- | -------------- | -------------------------------------- |
| `gateway.remote`            | no-op          | None                                   |
| `gateway.reload`            | no-op          | None                                   |
| `hooks.gmail`               | hot            | Restart Gmail watcher                  |
| `hooks`                     | hot            | Reload hooks config                    |
| `agents.defaults.heartbeat` | hot            | Restart heartbeat                      |
| `agent.heartbeat`           | hot            | Restart heartbeat                      |
| `cron`                      | hot            | Restart cron                           |
| `browser`                   | hot            | Restart browser control                |
| `channels.<id>`             | hot            | Restart specific channel               |
| `meta`                      | no-op          | None                                   |
| `identity`                  | no-op          | None                                   |
| `wizard`                    | no-op          | None                                   |
| `logging`                   | no-op          | None                                   |
| `models`                    | no-op          | None                                   |
| `agents`                    | no-op          | None                                   |
| `tools`                     | no-op          | None                                   |
| `bindings`                  | no-op          | None                                   |
| `audio`                     | no-op          | None                                   |
| `agent`                     | no-op          | None                                   |
| `routing`                   | no-op          | None                                   |
| `messages`                  | no-op          | None                                   |
| `session`                   | no-op          | None                                   |
| `gateway.plugins`           | restart        | Plugin changes require restart         |
| `gateway.*` (other)         | restart        | Server setting changes require restart |

---

_End of document._
