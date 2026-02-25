---
summary: "OpenChat bot setup, configuration, and key management"
read_when:
  - Setting up the OpenChat channel
  - Registering an OpenChat bot
title: "OpenChat"
---

# OpenChat (plugin)

[OpenChat](https://oc.app) is a decentralized messaging platform built on the Internet Computer.
OpenClaw connects via a **bot** that users install and talk to directly with the `/prompt` command.

Status: supported via plugin (`@open-ic/openchat-botclient-ts`). Direct messages only.

## Plugin required

OpenChat ships as a plugin and is not bundled with the core install.

Install via CLI (npm registry):

```bash
openclaw plugins install @openclaw/openchat
```

Local checkout (when running from a git repo):

```bash
openclaw plugins install ./extensions/openchat
```

Details: [Plugins](/tools/plugin)

## How it works

Unlike token-polling channels, OpenChat uses a **command/webhook model**:

1. Your gateway exposes two HTTP endpoints at the root of its public URL:
   - `GET /bot_definition` — returns the bot schema (command list, permissions).
   - `POST /execute_command` — receives a signed JWT from the OpenChat **client** (browser)
     whenever a user runs `/prompt`.
2. You register the bot once in OpenChat by entering your gateway's origin URL.
3. Users install the bot into a direct-message chat. Each `/prompt <text>` invocation
   is forwarded to your agent and the reply is sent back via the OpenChat bot API.

Note: the OpenChat servers never call your gateway directly. The requests come from
the user's browser, so the gateway only needs to be reachable by the user, not by
OpenChat's infrastructure.

## Setup

### 1. Generate a bot identity

The bot needs a secp256k1 private key. Its Internet Computer **principal** (derived from
the key) is what you register with OpenChat. Generate one with `openssl`:

```bash
openssl ecparam -name secp256k1 -genkey -noout | openssl ec -outform PEM > ~/.openclaw/openchat-bot.pem
```

To derive the **principal** from the key you will need to use the OpenChat bot SDK or
tooling. If you have a source checkout of the openclaw repo:

```bash
cd extensions/openchat && pnpm generate-key
```

This prints the principal and the key in all supported formats. Otherwise, generate the
key with `openssl` above and obtain the principal separately using the
[Internet Computer SDK](https://internetcomputer.org/docs/current/developer-docs/developer-tools/dev-tools-overview)
or another secp256k1 principal derivation tool.

### 2. Configure the plugin

Set `OC_PUBLIC_KEY` to OpenChat's ES256 public key (used to verify JWTs). Obtain it from the
[OpenChat bot developer docs](https://github.com/open-chat-labs/open-chat-bots/blob/main/README.md). Add it alongside the private key to
`~/.openclaw/.env`:

```bash
OC_PRIVATE_KEY="-----BEGIN EC PRIVATE KEY-----\nMHQCAQEE...\n-----END EC PRIVATE KEY-----"
OC_PUBLIC_KEY="<OpenChat ES256 public key>"
```

Or reference the PEM file in your openclaw config (`~/.openclaw/config.json5`):

```json5
{
  channels: {
    openchat: {
      enabled: true,
      privateKeyFile: "~/.openclaw/openchat-bot.pem",
    },
  },
}
```

### 3. Start the gateway

```bash
openclaw gateway run
```

Or via the OpenClaw Mac app.

### 4. Register the bot with OpenChat

1. Open [https://oc.app](https://oc.app) and use the `/register_bot` command from any chat.
2. Enter your gateway's **origin URL** (e.g. `https://gateway-host`). OpenChat will
   fetch `GET <origin>/bot_definition` from your browser to validate the bot — so the
   gateway must be running and reachable from your browser at this point.
3. Paste the **principal** from step 1.
4. Complete registration.

### 5. Install the bot and send a message

1. In OpenChat, start a direct chat with the bot you registered (find it by the name you gave it).
2. Type `/prompt Hello` — your browser posts the command to your gateway, the agent
   replies, and the response appears in the chat.

## Environment variables

| Variable                    | Description                                                            |
| --------------------------- | ---------------------------------------------------------------------- |
| `OC_PRIVATE_KEY`            | Bot private key PEM (one-liner with `\n`). Takes priority over config. |
| `OC_PUBLIC_KEY`             | OpenChat's ES256 public key for JWT verification. Required at runtime. |
| `OC_IC_HOST`                | Internet Computer API host (default: `https://icp-api.io`).            |
| `OC_USER_INDEX_CANISTER`    | User index canister ID (optional; uses SDK default).                   |
| `OC_STORAGE_INDEX_CANISTER` | Storage index canister ID (default: `nbpzs-kqaaa-aaaar-qaaua-cai`).    |

OpenClaw loads `.env` automatically from `~/.openclaw/.env` (or the repo root when
running from a source checkout).

## Key management

Three ways to supply the bot private key, in priority order:

1. **`OC_PRIVATE_KEY` env var** — one-liner PEM with literal `\n`. Highest priority.
2. **`channels.openchat.privateKeyFile`** — path to a PEM file on disk. Recommended
   because it avoids newline-escaping issues in config files.
3. **`channels.openchat.privateKey`** — raw PEM string inline in config (newlines
   escaped as `\n`). Least preferred.

The key must be in EC format (`-----BEGIN EC PRIVATE KEY-----`), not PKCS#8
(`-----BEGIN PRIVATE KEY-----`). The `openssl` command in step 1 produces the correct format.

## Capabilities

| Feature         | Status                                     |
| --------------- | ------------------------------------------ |
| Direct messages | ✅ Supported                               |
| Group chats     | ❌ Not supported (direct messages only)    |
| Media           | ❌ Not supported                           |
| Markdown        | ✅ Block-level markdown rendered           |
| Streaming       | ❌ Not applicable (command/response model) |

## Troubleshooting

Run the standard ladder first:

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
openclaw channels status --probe
```

Common failures:

- **Bot definition fetch fails during registration**: the gateway is not running or not
  reachable from your browser. Check that `GET <origin>/bot_definition` is accessible.
- **`/prompt` command hangs or errors**: `OC_PUBLIC_KEY` is missing or wrong — JWT
  verification fails. Check gateway logs for JWT errors.
- **`OpenChat bot not configured (missing privateKey)`**: none of the three key sources
  (`OC_PRIVATE_KEY`, `privateKeyFile`, `privateKey`) resolved to a value. Re-check
  config and env.
- **`Could not read privateKeyFile`**: the path in `privateKeyFile` doesn't exist or
  isn't readable. Use an absolute path or a `~`-prefixed path.
- **Wrong key format**: the key must be in EC format (`-----BEGIN EC PRIVATE KEY-----`),
  not PKCS#8 (`-----BEGIN PRIVATE KEY-----`). Re-generate with the `openssl` command in
  the setup steps above.

For triage flow: [/channels/troubleshooting](/channels/troubleshooting).

## Configuration reference (OpenChat)

Full configuration: [Configuration](/gateway/configuration)

- `channels.openchat.enabled`: enable/disable channel startup.
- `channels.openchat.privateKeyFile`: path to the bot's PEM key file on disk.
  Takes priority over `privateKey`. Avoids newline-escaping issues in config files.
- `channels.openchat.privateKey`: raw PEM string with `\n` escaped as `\\n`.
  Use `privateKeyFile` instead when possible.
