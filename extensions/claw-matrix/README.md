# claw-matrix

OpenClaw channel plugin for [Matrix](https://matrix.org/) with E2E encryption via [`@matrix-org/matrix-sdk-crypto-nodejs`](https://github.com/nicktomlin/matrix-rust-sdk-crypto-nodejs) (Rust FFI).

## Status

**Phase 1** — text messaging with full end-to-end encryption.

### Working

- Inbound: receive and decrypt Matrix messages, dispatch to OpenClaw agents
- Outbound: encrypt and send agent replies back to Matrix
- DM and group room support
- Access control (allowlist, open, disabled policies)
- Proactive sends via message tool (room ID, user ID, alias targets)
- Actions: `send`, `read`, `channel-list`
- Crypto: OlmMachine with SQLite store, Megolm key sharing, UTD retry queue
- Sync: long-poll with exponential backoff, soft/hard logout handling

### Phase 2 (planned)

- Auto-join invited rooms
- Media messages (images, files)
- Reply threading
- Reactions, editing, unsend
- Display name resolution
- Typing indicators

## Installation

Copy to your OpenClaw extensions directory:

```bash
cp -r claw-matrix ~/.openclaw/extensions/claw-matrix
cd ~/.openclaw/extensions/claw-matrix
npm install
```

## Configuration

Add to `openclaw.json` under `channels.matrix`:

```json
{
  "channels": {
    "matrix": {
      "enabled": true,
      "homeserver": "https://matrix.example.com",
      "userId": "@bot:example.com",
      "accessToken": "syt_...",
      "password": "optional-for-soft-logout-reauth",
      "encryption": true,
      "deviceName": "OpenClaw",
      "dm": {
        "policy": "allowlist",
        "allowFrom": ["@alice:example.com", "@bob:example.com"]
      },
      "groupPolicy": "allowlist",
      "groups": {
        "!roomid:example.com": {
          "allow": true,
          "requireMention": false
        }
      },
      "groupAllowFrom": ["@alice:example.com"],
      "trustMode": "tofu"
    }
  }
}
```

Add to `plugins.allow` in `openclaw.json`:

```json
{
  "plugins": {
    "allow": ["claw-matrix"]
  }
}
```

Then restart the gateway:

```bash
systemctl --user restart openclaw-gateway
```

## Architecture

```
index.ts                    Entry point — registers channel with OpenClaw
src/runtime.ts              Module-level PluginRuntime store
src/channel.ts              ChannelPlugin contract (all OpenClaw adapters)
src/monitor.ts              Sync loop lifecycle + inbound message dispatch
src/config.ts               Zod schema + ResolvedMatrixAccount resolver
src/actions.ts              Agent tool actions (send/read/channel-list)
src/types.ts                Matrix event/response TypeScript interfaces
src/client/http.ts          Authenticated Matrix API client
src/client/sync.ts          Long-poll /sync, decrypt, dispatch
src/client/send.ts          Encrypt + send (markdown to HTML)
src/client/rooms.ts         In-memory room state tracking
src/client/targets.ts       Target resolution (@user → DM room, #alias → room ID)
src/crypto/machine.ts       OlmMachine init/close, crypto store path
src/crypto/outgoing.ts      Process outgoing crypto requests (key upload/query/claim/share)
```

## Dependencies

- `@matrix-org/matrix-sdk-crypto-nodejs` ^0.4.0 — Rust crypto FFI
- `markdown-it` 14.1.0 — Markdown rendering
- `sanitize-html` ^2.13.0 — HTML sanitization
- `zod` ^4.3.6 — Config validation

## License

MIT
