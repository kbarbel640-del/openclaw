---
summary: "Complete field-by-field reference for ~/.openclaw/openclaw.json"
read_when:
  - Adding or modifying config fields
  - Looking up exact config key names and accepted values
  - Building or validating a complete configuration
title: "Configuration Reference"
---

# Configuration Reference

Complete field-by-field reference for `~/.openclaw/openclaw.json`. For common tasks and quick setup, see [Configuration](/gateway/configuration).

<Note>
OpenClaw uses **strict validation**. Unknown keys, malformed types, or invalid values cause the Gateway to refuse to start. Run `openclaw doctor` to diagnose and fix issues.
</Note>

## Schema + UI hints

The Gateway exposes a JSON Schema representation of the config via `config.schema` for UI editors.
The Control UI renders a form from this schema, with a **Raw JSON** editor as an escape hatch.

Channel plugins and extensions can register schema + UI hints for their config, so channel settings
stay schema-driven across apps without hard-coded forms.

Hints (labels, grouping, sensitive fields) ship alongside the schema so clients can render
better forms without hard-coding config knowledge.

## Auth storage (OAuth + API keys)

OpenClaw stores **per-agent** auth profiles (OAuth + API keys) in:

- `<agentDir>/auth-profiles.json` (default: `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`)

See also: [OAuth](/concepts/oauth)

Legacy OAuth imports:

- `~/.openclaw/credentials/oauth.json` (or `$OPENCLAW_STATE_DIR/credentials/oauth.json`)

The embedded Pi agent maintains a runtime cache at:

- `<agentDir>/auth.json` (managed automatically; don't edit manually)

Legacy agent dir (pre multi-agent):

- `~/.openclaw/agent/*` (migrated by `openclaw doctor` into `~/.openclaw/agents/<defaultAgentId>/agent/*`)

Overrides:

- OAuth dir (legacy import only): `OPENCLAW_OAUTH_DIR`
- Agent dir (default agent root override): `OPENCLAW_AGENT_DIR` (preferred), `PI_CODING_AGENT_DIR` (legacy)

On first use, OpenClaw imports `oauth.json` entries into `auth-profiles.json`.

### `auth`

Optional metadata for auth profiles. This does **not** store secrets; it maps
profile IDs to a provider + mode (and optional email) and defines the provider
rotation order used for failover.

```json5
{
  auth: {
    profiles: {
      "anthropic:me@example.com": { provider: "anthropic", mode: "oauth", email: "me@example.com" },
      "anthropic:work": { provider: "anthropic", mode: "api_key" },
    },
    order: {
      anthropic: ["anthropic:me@example.com", "anthropic:work"],
    },
  },
}
```

## Agent identity

### `agents.list[].identity`

Optional per-agent identity used for defaults and UX. This is written by the macOS onboarding assistant.

If set, OpenClaw derives defaults (only when you haven't set them explicitly):

- `messages.ackReaction` from the **active agent**'s `identity.emoji` (falls back to 👀)
- `agents.list[].groupChat.mentionPatterns` from the agent's `identity.name`/`identity.emoji` (so "@Samantha" works in groups across Telegram/Slack/Discord/Google Chat/iMessage/WhatsApp)
- `identity.avatar` accepts a workspace-relative image path or a remote URL/data URL. Local files must live inside the agent workspace.

`identity.avatar` accepts:

- Workspace-relative path (must stay within the agent workspace)
- `http(s)` URL
- `data:` URI

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "Samantha",
          theme: "helpful sloth",
          emoji: "🦥",
          avatar: "avatars/samantha.png",
        },
      },
    ],
  },
}
```

### `wizard`

Metadata written by CLI wizards (`onboard`, `configure`, `doctor`).

```json5
{
  wizard: {
    lastRunAt: "2026-01-01T00:00:00.000Z",
    lastRunVersion: "2026.1.4",
    lastRunCommit: "abc1234",
    lastRunCommand: "configure",
    lastRunMode: "local",
  },
}
```

## Logging

- Default log file: `/tmp/openclaw/openclaw-YYYY-MM-DD.log`
- If you want a stable path, set `logging.file` to `/tmp/openclaw/openclaw.log`.
- Console output can be tuned separately via:
  - `logging.consoleLevel` (defaults to `info`, bumps to `debug` when `--verbose`)
  - `logging.consoleStyle` (`pretty` | `compact` | `json`)
- Tool summaries can be redacted to avoid leaking secrets:
  - `logging.redactSensitive` (`off` | `tools`, default: `tools`)
  - `logging.redactPatterns` (array of regex strings; overrides defaults)

```json5
{
  logging: {
    level: "info",
    file: "/tmp/openclaw/openclaw.log",
    consoleLevel: "info",
    consoleStyle: "pretty",
    redactSensitive: "tools",
    redactPatterns: [
      "\\bTOKEN\\b\\s*[=:]\\s*([\"']?)([^\\s\"']+)\\1",
      "/\\bsk-[A-Za-z0-9_-]{8,}\\b/gi",
    ],
  },
}
```

## DM and group access

### `channels.whatsapp.dmPolicy`

Controls how WhatsApp direct chats (DMs) are handled:

- `"pairing"` (default): unknown senders get a pairing code; owner must approve
- `"allowlist"`: only allow senders in `channels.whatsapp.allowFrom` (or paired allow store)
- `"open"`: allow all inbound DMs (**requires** `channels.whatsapp.allowFrom` to include `"*"`)
- `"disabled"`: ignore all inbound DMs

Pairing codes expire after 1 hour; the bot only sends a pairing code when a new request is created. Pending DM pairing requests are capped at **3 per channel** by default.

Pairing approvals:

- `openclaw pairing list whatsapp`
- `openclaw pairing approve whatsapp <code>`

### `channels.whatsapp.allowFrom`

Allowlist of E.164 phone numbers that may trigger WhatsApp auto-replies (**DMs only**).
If empty and `channels.whatsapp.dmPolicy="pairing"`, unknown senders will receive a pairing code.
For groups, use `channels.whatsapp.groupPolicy` + `channels.whatsapp.groupAllowFrom`.

```json5
{
  channels: {
    whatsapp: {
      dmPolicy: "pairing",
      allowFrom: ["+15555550123", "+447700900123"],
      textChunkLimit: 4000,
      chunkMode: "length",
      mediaMaxMb: 50,
    },
  },
}
```

### `channels.whatsapp.sendReadReceipts`

Controls whether inbound WhatsApp messages are marked as read (blue ticks). Default: `true`.

Self-chat mode always skips read receipts, even when enabled.

Per-account override: `channels.whatsapp.accounts.<id>.sendReadReceipts`.

```json5
{
  channels: {
    whatsapp: { sendReadReceipts: false },
  },
}
```

### Multi-account (WhatsApp)

Run multiple WhatsApp accounts in one gateway:

```json5
{
  channels: {
    whatsapp: {
      accounts: {
        default: {},
        personal: {},
        biz: {},
      },
    },
  },
}
```

Notes:

- Outbound commands default to account `default` if present; otherwise the first configured account id (sorted).
- The legacy single-account Baileys auth dir is migrated by `openclaw doctor` into `whatsapp/default`.

### Multi-account (Telegram, Discord, Slack, etc.)

Run multiple accounts per channel (each account has its own `accountId` and optional `name`):

```json5
{
  channels: {
    telegram: {
      accounts: {
        default: { name: "Primary bot", botToken: "123456:ABC..." },
        alerts: { name: "Alerts bot", botToken: "987654:XYZ..." },
      },
    },
  },
}
```

Notes:

- `default` is used when `accountId` is omitted (CLI + routing).
- Env tokens only apply to the **default** account.
- Base channel settings apply to all accounts unless overridden per account.
- Use `bindings[].match.accountId` to route each account to a different agent.

### Group chat mention gating

Group messages default to **require mention** (either metadata mention or regex patterns). Applies to WhatsApp, Telegram, Discord, Google Chat, and iMessage group chats.

**Mention types:**

- **Metadata mentions**: Native platform @-mentions (e.g., WhatsApp tap-to-mention). Ignored in WhatsApp self-chat mode (see `channels.whatsapp.allowFrom`).
- **Text patterns**: Regex patterns defined in `agents.list[].groupChat.mentionPatterns`. Always checked regardless of self-chat mode.
- Mention gating is enforced only when mention detection is possible (native mentions or at least one `mentionPattern`).

```json5
{
  messages: {
    groupChat: { historyLimit: 50 },
  },
  agents: {
    list: [{ id: "main", groupChat: { mentionPatterns: ["@openclaw", "openclaw"] } }],
  },
}
```

`messages.groupChat.historyLimit` sets the global default for group history context. Channels can override with `channels.<channel>.historyLimit` (or `channels.<channel>.accounts.*.historyLimit` for multi-account). Set `0` to disable history wrapping.

#### DM history limits

DM conversations use session-based history managed by the agent. You can limit the number of user turns retained per DM session:

```json5
{
  channels: {
    telegram: {
      dmHistoryLimit: 30,
      dms: {
        "123456789": { historyLimit: 50 },
      },
    },
  },
}
```

Resolution order:

1. Per-DM override: `channels.<provider>.dms[userId].historyLimit`
2. Provider default: `channels.<provider>.dmHistoryLimit`
3. No limit (all history retained)

Supported providers: `telegram`, `whatsapp`, `discord`, `slack`, `signal`, `imessage`, `msteams`.

Per-agent override (takes precedence when set, even `[]`):

```json5
{
  agents: {
    list: [
      { id: "work", groupChat: { mentionPatterns: ["@workbot", "\\+15555550123"] } },
      { id: "personal", groupChat: { mentionPatterns: ["@homebot", "\\+15555550999"] } },
    ],
  },
}
```

Mention gating defaults live per channel (`channels.whatsapp.groups`, `channels.telegram.groups`, `channels.imessage.groups`, `channels.discord.guilds`). When `*.groups` is set, it also acts as a group allowlist; include `"*"` to allow all groups.

To respond **only** to specific text triggers (ignoring native @-mentions):

```json5
{
  channels: {
    whatsapp: {
      allowFrom: ["+15555550123"],
      groups: { "*": { requireMention: true } },
    },
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: { mentionPatterns: ["reisponde", "@openclaw"] },
      },
    ],
  },
}
```

### Group policy (per channel)

Use `channels.*.groupPolicy` to control whether group/room messages are accepted at all:

```json5
{
  channels: {
    whatsapp: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15551234567"],
    },
    telegram: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["tg:123456789", "@alice"],
    },
    signal: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15551234567"],
    },
    imessage: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["chat_id:123"],
    },
    msteams: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["user@org.com"],
    },
    discord: {
      groupPolicy: "allowlist",
      guilds: {
        GUILD_ID: {
          channels: { help: { allow: true } },
        },
      },
    },
    slack: {
      groupPolicy: "allowlist",
      channels: { "#general": { allow: true } },
    },
  },
}
```

Notes:

- `"open"`: groups bypass allowlists; mention-gating still applies.
- `"disabled"`: block all group/room messages.
- `"allowlist"`: only allow groups/rooms that match the configured allowlist.
- `channels.defaults.groupPolicy` sets the default when a provider's `groupPolicy` is unset.
- WhatsApp/Telegram/Signal/iMessage/Microsoft Teams use `groupAllowFrom` (fallback: explicit `allowFrom`).
- Discord/Slack use channel allowlists (`channels.discord.guilds.*.channels`, `channels.slack.channels`).
- Group DMs (Discord/Slack) are still controlled by `dm.groupEnabled` + `dm.groupChannels`.
- Default is `groupPolicy: "allowlist"` (unless overridden by `channels.defaults.groupPolicy`); if no allowlist is configured, group messages are blocked.

## Multi-agent routing

Run multiple isolated agents (separate workspace, `agentDir`, sessions) inside one Gateway.
Inbound messages are routed to an agent via bindings.

- `agents.list[]`: per-agent overrides.
  - `id`: stable agent id (required).
  - `default`: optional; when multiple are set, the first wins and a warning is logged.
    If none are set, the **first entry** in the list is the default agent.
  - `name`: display name for the agent.
  - `workspace`: default `~/.openclaw/workspace-<agentId>` (for `main`, falls back to `agents.defaults.workspace`).
  - `agentDir`: default `~/.openclaw/agents/<agentId>/agent`.
  - `model`: per-agent default model, overrides `agents.defaults.model` for that agent.
    - string form: `"provider/model"`, overrides only `agents.defaults.model.primary`
    - object form: `{ primary, fallbacks }` (fallbacks override `agents.defaults.model.fallbacks`; `[]` disables global fallbacks for that agent)
  - `identity`: per-agent name/theme/emoji (used for mention patterns + ack reactions).
  - `groupChat`: per-agent mention-gating (`mentionPatterns`).
  - `sandbox`: per-agent sandbox config (overrides `agents.defaults.sandbox`).
    - `mode`: `"off"` | `"non-main"` | `"all"`
    - `workspaceAccess`: `"none"` | `"ro"` | `"rw"`
    - `scope`: `"session"` | `"agent"` | `"shared"`
    - `workspaceRoot`: custom sandbox workspace root
    - `docker`: per-agent docker overrides (e.g. `image`, `network`, `env`, `setupCommand`, limits; ignored when `scope: "shared"`)
    - `browser`: per-agent sandboxed browser overrides (ignored when `scope: "shared"`)
    - `prune`: per-agent sandbox pruning overrides (ignored when `scope: "shared"`)
  - `subagents`: per-agent sub-agent defaults.
    - `allowAgents`: allowlist of agent ids for `sessions_spawn` from this agent (`["*"]` = allow any; default: only same agent)
  - `tools`: per-agent tool restrictions (applied before sandbox tool policy).
    - `profile`: base tool profile (applied before allow/deny)
    - `allow`: array of allowed tool names
    - `deny`: array of denied tool names (deny wins)
- `agents.defaults`: shared agent defaults (model, workspace, sandbox, etc.).
- `bindings[]`: routes inbound messages to an `agentId`.
  - `match.channel` (required)
  - `match.accountId` (optional; `*` = any account; omitted = default account)
  - `match.peer` (optional; `{ kind: direct|group|channel, id }`)
  - `match.guildId` / `match.teamId` (optional; channel-specific)

Deterministic match order:

1. `match.peer`
2. `match.guildId`
3. `match.teamId`
4. `match.accountId` (exact, no peer/guild/team)
5. `match.accountId: "*"` (channel-wide, no peer/guild/team)
6. default agent (`agents.list[].default`, else first list entry, else `"main"`)

Within each match tier, the first matching entry in `bindings` wins.

### Per-agent access profiles (multi-agent)

Each agent can carry its own sandbox + tool policy. Use this to mix access
levels in one gateway:

- **Full access** (personal agent)
- **Read-only** tools + workspace
- **No filesystem access** (messaging/session tools only)

See [Multi-Agent Sandbox & Tools](/tools/multi-agent-sandbox-tools) for precedence and
additional examples.

<Accordion title="Full access (no sandbox)">
```json5
{
  agents: {
    list: [
      {
        id: "personal",
        workspace: "~/.openclaw/workspace-personal",
        sandbox: { mode: "off" },
      },
    ],
  },
}
```
</Accordion>

<Accordion title="Read-only tools + read-only workspace">
```json5
{
  agents: {
    list: [
      {
        id: "family",
        workspace: "~/.openclaw/workspace-family",
        sandbox: {
          mode: "all",
          scope: "agent",
          workspaceAccess: "ro",
        },
        tools: {
          allow: [
            "read", "sessions_list", "sessions_history",
            "sessions_send", "sessions_spawn", "session_status",
          ],
          deny: ["write", "edit", "apply_patch", "exec", "process", "browser"],
        },
      },
    ],
  },
}
```
</Accordion>

<Accordion title="No filesystem access (messaging/session tools only)">
```json5
{
  agents: {
    list: [
      {
        id: "public",
        workspace: "~/.openclaw/workspace-public",
        sandbox: {
          mode: "all",
          scope: "agent",
          workspaceAccess: "none",
        },
        tools: {
          allow: [
            "sessions_list", "sessions_history", "sessions_send",
            "sessions_spawn", "session_status",
            "whatsapp", "telegram", "slack", "discord", "gateway",
          ],
          deny: [
            "read", "write", "edit", "apply_patch", "exec",
            "process", "browser", "canvas", "nodes", "cron",
            "gateway", "image",
          ],
        },
      },
    ],
  },
}
```
</Accordion>

<Accordion title="Two WhatsApp accounts → two agents">
```json5
{
  agents: {
    list: [
      { id: "home", default: true, workspace: "~/.openclaw/workspace-home" },
      { id: "work", workspace: "~/.openclaw/workspace-work" },
    ],
  },
  bindings: [
    { agentId: "home", match: { channel: "whatsapp", accountId: "personal" } },
    { agentId: "work", match: { channel: "whatsapp", accountId: "biz" } },
  ],
  channels: {
    whatsapp: {
      accounts: { personal: {}, biz: {} },
    },
  },
}
```
</Accordion>

### `tools.agentToAgent` (optional)

Agent-to-agent messaging is opt-in:

```json5
{
  tools: {
    agentToAgent: {
      enabled: false,
      allow: ["home", "work"],
    },
  },
}
```

## Message queue and inbound

### `messages.queue`

Controls how inbound messages behave when an agent run is already active.

```json5
{
  messages: {
    queue: {
      mode: "collect",
      debounceMs: 1000,
      cap: 20,
      drop: "summarize",
      byChannel: {
        whatsapp: "collect",
        telegram: "collect",
        discord: "collect",
      },
    },
  },
}
```

See [Queue](/concepts/queue) for mode details (`steer`, `followup`, `collect`, `steer-backlog`, `interrupt`).

### `messages.inbound`

Debounce rapid inbound messages from the **same sender** so multiple back-to-back
messages become a single agent turn:

```json5
{
  messages: {
    inbound: {
      debounceMs: 2000,
      byChannel: { whatsapp: 5000, slack: 1500 },
    },
  },
}
```

Notes:

- Debounce batches **text-only** messages; media/attachments flush immediately.
- Control commands (e.g. `/queue`, `/new`) bypass debouncing.

### `commands` (chat command handling)

```json5
{
  commands: {
    native: "auto",
    text: true,
    bash: false,
    bashForegroundMs: 2000,
    config: false,
    debug: false,
    restart: false,
    allowFrom: { "*": ["user1"], discord: ["user:123"] },
    useAccessGroups: true,
  },
}
```

Notes:

- Text commands must be sent as a **standalone** message with leading `/`.
- `commands.native: "auto"` (default) turns on native commands for Discord/Telegram and leaves Slack off.
- Set per channel: `channels.discord.commands.native`, `channels.telegram.commands.native`, `channels.slack.commands.native`.
- `channels.telegram.customCommands` adds extra Telegram bot menu entries.
- `commands.bash: true` enables `! <cmd>` for host shell commands. Requires `tools.elevated.enabled` and sender allowlisting.
- `commands.config: true` enables `/config` (reads/writes `openclaw.json`).
- `channels.<provider>.configWrites` gates config mutations from that channel (default: true).
- `commands.allowFrom` sets per-provider command allowlists. When configured, it is the **only** authorization source.
- Full command list: [Slash commands](/tools/slash-commands).

## Channel-specific config

### `web` (WhatsApp web channel runtime)

WhatsApp runs through the gateway's web channel (Baileys Web). It starts automatically when a linked session exists.

```json5
{
  web: {
    enabled: true,
    heartbeatSeconds: 60,
    reconnect: {
      initialMs: 2000,
      maxMs: 120000,
      factor: 1.4,
      jitter: 0.2,
      maxAttempts: 0,
    },
  },
}
```

### `channels.telegram` (bot transport)

OpenClaw starts Telegram only when a `channels.telegram` config section exists. The bot token is resolved from `channels.telegram.botToken` (or `channels.telegram.tokenFile`), with `TELEGRAM_BOT_TOKEN` as a fallback for the default account.

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "your-bot-token",
      dmPolicy: "pairing",
      allowFrom: ["tg:123456789"],
      groups: {
        "*": { requireMention: true },
        "-1001234567890": {
          allowFrom: ["@admin"],
          systemPrompt: "Keep answers brief.",
          topics: {
            "99": {
              requireMention: false,
              skills: ["search"],
              systemPrompt: "Stay on topic.",
            },
          },
        },
      },
      customCommands: [
        { command: "backup", description: "Git backup" },
        { command: "generate", description: "Create an image" },
      ],
      historyLimit: 50,
      replyToMode: "first",
      linkPreview: true,
      streamMode: "partial",
      draftChunk: { minChars: 200, maxChars: 800, breakPreference: "paragraph" },
      actions: { reactions: true, sendMessage: true },
      reactionNotifications: "own",
      mediaMaxMb: 5,
      retry: { attempts: 3, minDelayMs: 400, maxDelayMs: 30000, jitter: 0.1 },
      network: { autoSelectFamily: false },
      proxy: "socks5://localhost:9050",
      webhookUrl: "https://example.com/telegram-webhook",
      webhookSecret: "secret",
      webhookPath: "/telegram-webhook",
    },
  },
}
```

Draft streaming notes:

- Uses Telegram `sendMessageDraft` (draft bubble, not a real message).
- Requires **private chat topics** (message_thread_id in DMs; bot has topics enabled).
- `/reasoning stream` streams reasoning into the draft, then sends the final answer.
- Retry policy defaults: [Retry policy](/concepts/retry).

### `channels.discord` (bot transport)

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: "your-bot-token",
      mediaMaxMb: 8,
      allowBots: false,
      actions: {
        reactions: true,
        stickers: true,
        polls: true,
        permissions: true,
        messages: true,
        threads: true,
        pins: true,
        search: true,
        memberInfo: true,
        roleInfo: true,
        roles: false,
        channelInfo: true,
        voiceStatus: true,
        events: true,
        moderation: false,
      },
      replyToMode: "off",
      dm: {
        enabled: true,
        policy: "pairing",
        allowFrom: ["1234567890", "steipete"],
        groupEnabled: false,
        groupChannels: ["openclaw-dm"],
      },
      guilds: {
        "123456789012345678": {
          slug: "friends-of-openclaw",
          requireMention: false,
          reactionNotifications: "own",
          users: ["987654321098765432"],
          channels: {
            general: { allow: true },
            help: {
              allow: true,
              requireMention: true,
              users: ["987654321098765432"],
              skills: ["docs"],
              systemPrompt: "Short answers only.",
            },
          },
        },
      },
      historyLimit: 20,
      textChunkLimit: 2000,
      chunkMode: "length",
      maxLinesPerMessage: 17,
      retry: { attempts: 3, minDelayMs: 500, maxDelayMs: 30000, jitter: 0.1 },
    },
  },
}
```

OpenClaw starts Discord only when a `channels.discord` config section exists. Token is resolved from `channels.discord.token`, with `DISCORD_BOT_TOKEN` as fallback. Use `user:<id>` (DM) or `channel:<id>` (guild) for delivery targets; bare numeric IDs are rejected.
Guild slugs are lowercase with spaces replaced by `-`; channel keys use the slugged channel name (no leading `#`). Prefer guild ids.
Reaction notification modes: `off`, `own` (default), `all`, `allowlist`.
Retry policy: [Retry policy](/concepts/retry).

### `channels.googlechat` (Chat API webhook)

Google Chat runs over HTTP webhooks with app-level auth (service account).

```json5
{
  channels: {
    googlechat: {
      enabled: true,
      serviceAccountFile: "/path/to/service-account.json",
      audienceType: "app-url",
      audience: "https://gateway.example.com/googlechat",
      webhookPath: "/googlechat",
      botUser: "users/1234567890",
      dm: {
        enabled: true,
        policy: "pairing",
        allowFrom: ["users/1234567890"],
      },
      groupPolicy: "allowlist",
      groups: { "spaces/AAAA": { allow: true, requireMention: true } },
      actions: { reactions: true },
      typingIndicator: "message",
      mediaMaxMb: 20,
    },
  },
}
```

Notes:

- Service account JSON can be inline (`serviceAccount`) or file-based (`serviceAccountFile`).
- Env fallbacks: `GOOGLE_CHAT_SERVICE_ACCOUNT` or `GOOGLE_CHAT_SERVICE_ACCOUNT_FILE`.
- `audienceType` + `audience` must match the Chat app's webhook auth config.
- Use `spaces/<spaceId>` or `users/<userId|email>` for delivery targets.

### `channels.slack` (socket mode)

Slack runs in Socket Mode with both a bot token and app token:

```json5
{
  channels: {
    slack: {
      enabled: true,
      botToken: "xoxb-...",
      appToken: "xapp-...",
      dm: {
        enabled: true,
        policy: "pairing",
        allowFrom: ["U123", "U456"],
        groupEnabled: false,
        groupChannels: ["G123"],
      },
      channels: {
        C123: { allow: true, requireMention: true, allowBots: false },
        "#general": {
          allow: true,
          requireMention: true,
          allowBots: false,
          users: ["U123"],
          skills: ["docs"],
          systemPrompt: "Short answers only.",
        },
      },
      historyLimit: 50,
      allowBots: false,
      reactionNotifications: "own",
      reactionAllowlist: ["U123"],
      replyToMode: "off",
      thread: { historyScope: "thread", inheritParent: false },
      actions: { reactions: true, messages: true, pins: true, memberInfo: true, emojiList: true },
      slashCommand: {
        enabled: true,
        name: "openclaw",
        sessionPrefix: "slack:slash",
        ephemeral: true,
      },
      textChunkLimit: 4000,
      chunkMode: "length",
      mediaMaxMb: 20,
    },
  },
}
```

OpenClaw starts Slack when both tokens are set (config or `SLACK_BOT_TOKEN` + `SLACK_APP_TOKEN`).
Thread session isolation: `thread.historyScope` (`thread` default, `channel`), `thread.inheritParent` (default false).
Reaction notification modes: `off`, `own` (default), `all`, `allowlist`.

### `channels.mattermost` (bot token)

Mattermost ships as a plugin: `openclaw plugins install @openclaw/mattermost`.

```json5
{
  channels: {
    mattermost: {
      enabled: true,
      botToken: "mm-token",
      baseUrl: "https://chat.example.com",
      dmPolicy: "pairing",
      chatmode: "oncall",
      oncharPrefixes: [">", "!"],
      textChunkLimit: 4000,
      chunkMode: "length",
    },
  },
}
```

Chat modes: `oncall` (default, respond on @mention), `onmessage` (respond to every message), `onchar` (trigger prefix).

### `channels.signal` (signal-cli)

```json5
{
  channels: {
    signal: {
      reactionNotifications: "own",
      reactionAllowlist: ["+15551234567", "uuid:123e4567-e89b-12d3-a456-426614174000"],
      historyLimit: 50,
    },
  },
}
```

Reaction notification modes: `off`, `own` (default), `all`, `allowlist`.

### `channels.imessage` (imsg CLI)

OpenClaw spawns `imsg rpc` (JSON-RPC over stdio). No daemon or port required.

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: "imsg",
      dbPath: "~/Library/Messages/chat.db",
      remoteHost: "user@gateway-host",
      dmPolicy: "pairing",
      allowFrom: ["+15555550123", "user@example.com", "chat_id:123"],
      historyLimit: 50,
      includeAttachments: false,
      mediaMaxMb: 16,
      service: "auto",
      region: "US",
    },
  },
}
```

Notes:

- Requires Full Disk Access to the Messages DB.
- Prefer `chat_id:<id>` targets. Use `imsg chats --limit 20` to list chats.
- `cliPath` can point to an SSH wrapper script; set `remoteHost` to fetch attachments via SCP.

## Agent defaults

### Workspace and bootstrap

- `agents.defaults.workspace`: single global workspace directory (default: `~/.openclaw/workspace`).
- `agents.defaults.repoRoot`: optional repo root shown in system prompt Runtime line.
- `agents.defaults.skipBootstrap`: disable automatic bootstrap file creation (for pre-seeded workspaces).
- `agents.defaults.bootstrapMaxChars`: max chars per bootstrap file before truncation (default: 20000).
- `agents.defaults.userTimezone`: timezone for system prompt context (default: host timezone).
- `agents.defaults.timeFormat`: time format in system prompt (`auto` | `12` | `24`, default: `auto`).

### Messages

```json5
{
  messages: {
    responsePrefix: "🦞",
    ackReaction: "👀",
    ackReactionScope: "group-mentions",
    removeAckAfterReply: false,
  },
}
```

`responsePrefix` is applied to **all outbound replies** across channels unless already present.

Overrides (most specific wins):

1. `channels.<channel>.accounts.<id>.responsePrefix`
2. `channels.<channel>.responsePrefix`
3. `messages.responsePrefix`

Semantics:

- `undefined` falls through to the next level
- `""` explicitly disables the prefix
- `"auto"` derives `[{identity.name}]` for the routed agent

#### Template variables

| Variable          | Description            | Example                     |
| ----------------- | ---------------------- | --------------------------- |
| `{model}`         | Short model name       | `claude-opus-4-6`, `gpt-4o` |
| `{modelFull}`     | Full model identifier  | `anthropic/claude-opus-4-6` |
| `{provider}`      | Provider name          | `anthropic`, `openai`       |
| `{thinkingLevel}` | Current thinking level | `high`, `low`, `off`        |
| `{identity.name}` | Agent identity name    | (same as `"auto"` mode)     |

Variables are case-insensitive. `{think}` is an alias for `{thinkingLevel}`. Unresolved variables remain as literal text.

`ackReaction` sends a best-effort emoji reaction on channels that support reactions (Slack/Discord/Telegram/Google Chat). Defaults to `identity.emoji` when set, otherwise `"👀"`. Set `""` to disable.

`ackReactionScope`: `group-mentions` (default), `group-all`, `direct`, `all`.

`removeAckAfterReply`: remove the ack reaction after reply (default: false).

WhatsApp inbound prefix: `channels.whatsapp.messagePrefix` (deprecated: `messages.messagePrefix`).

#### `messages.tts`

Enable text-to-speech for outbound replies:

```json5
{
  messages: {
    tts: {
      auto: "always",
      mode: "final",
      provider: "elevenlabs",
      summaryModel: "openai/gpt-4.1-mini",
      modelOverrides: { enabled: true },
      maxTextLength: 4000,
      timeoutMs: 30000,
      prefsPath: "~/.openclaw/settings/tts.json",
      elevenlabs: {
        apiKey: "elevenlabs_api_key",
        baseUrl: "https://api.elevenlabs.io",
        voiceId: "voice_id",
        modelId: "eleven_multilingual_v2",
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0.0,
          useSpeakerBoost: true,
          speed: 1.0,
        },
      },
      openai: { apiKey: "openai_api_key", model: "gpt-4o-mini-tts", voice: "alloy" },
    },
  },
}
```

Notes:

- `auto`: `off` | `always` | `inbound` | `tagged`. `/tts off|always|inbound|tagged` sets per-session.
- `summaryModel` overrides `agents.defaults.model.primary` for auto-summary.
- `apiKey` values fall back to `ELEVENLABS_API_KEY`/`XI_API_KEY` and `OPENAI_API_KEY`.

### Talk mode

```json5
{
  talk: {
    voiceId: "elevenlabs_voice_id",
    voiceAliases: { Clawd: "EXAVITQu4vr4xnSDxMaL" },
    modelId: "eleven_v3",
    outputFormat: "mp3_44100_128",
    apiKey: "elevenlabs_api_key",
    interruptOnSpeech: true,
  },
}
```

### `agents.defaults` (model, thinking, runtime)

`agents.defaults.models` defines the configured model catalog and acts as the allowlist for `/model`.
`agents.defaults.model.primary` sets the default model; `agents.defaults.model.fallbacks` are global failovers.
`agents.defaults.imageModel` is optional and is **only used if the primary model lacks image input**.

Each `agents.defaults.models` entry can include:

- `alias` (optional shortcut, e.g. `/opus`)
- `params` (optional provider-specific params: `temperature`, `maxTokens`)

Z.AI GLM-4.x models automatically enable thinking mode unless you set `--thinking off` or define `params.thinking` yourself.

Built-in alias shorthands (apply only when the model is in `agents.defaults.models`):

- `opus` → `anthropic/claude-opus-4-6`
- `sonnet` → `anthropic/claude-sonnet-4-5`
- `gpt` → `openai/gpt-5.2`
- `gpt-mini` → `openai/gpt-5-mini`
- `gemini` → `google/gemini-3-pro-preview`
- `gemini-flash` → `google/gemini-3-flash-preview`

If you configure the same alias name yourself, your value wins.

<Accordion title="Full agents.defaults example">
```json5
{
  agents: {
    defaults: {
      models: {
        "anthropic/claude-opus-4-6": { alias: "Opus" },
        "anthropic/claude-sonnet-4-1": { alias: "Sonnet" },
        "openrouter/deepseek/deepseek-r1:free": {},
        "zai/glm-4.7": {
          alias: "GLM",
          params: { thinking: { type: "enabled", clear_thinking: false } },
        },
      },
      model: {
        primary: "anthropic/claude-opus-4-6",
        fallbacks: [
          "openrouter/deepseek/deepseek-r1:free",
          "openrouter/meta-llama/llama-3.3-70b-instruct:free",
        ],
      },
      imageModel: {
        primary: "openrouter/qwen/qwen-2.5-vl-72b-instruct:free",
        fallbacks: ["openrouter/google/gemini-2.0-flash-vision:free"],
      },
      thinkingDefault: "low",
      verboseDefault: "off",
      elevatedDefault: "on",
      timeoutSeconds: 600,
      mediaMaxMb: 5,
      heartbeat: { every: "30m", target: "last" },
      maxConcurrent: 3,
      subagents: { model: "minimax/MiniMax-M2.1", maxConcurrent: 1, archiveAfterMinutes: 60 },
      exec: { backgroundMs: 10000, timeoutSec: 1800, cleanupMs: 1800000 },
      contextTokens: 200000,
    },
  },
}
```
</Accordion>

#### CLI backends (text-only fallback)

Optional CLI backends for text-only fallback runs (no tool calls):

```json5
{
  agents: {
    defaults: {
      cliBackends: {
        "claude-cli": { command: "/opt/homebrew/bin/claude" },
        "my-cli": {
          command: "my-cli",
          args: ["--json"],
          output: "json",
          modelArg: "--model",
          sessionArg: "--session",
          sessionMode: "existing",
          systemPromptArg: "--system",
          systemPromptWhen: "first",
          imageArg: "--image",
          imageMode: "repeat",
        },
      },
    },
  },
}
```

Notes:

- CLI backends are **text-first**; tools are always disabled.
- Image pass-through supported when `imageArg` is set.
- For `claude-cli`, defaults are wired in.
- See [CLI Backends](/gateway/cli-backends) for details.

#### Context pruning

`agents.defaults.contextPruning` prunes old tool results from in-memory context before LLM calls.
Does **not** modify session history on disk.

- `adaptive` (default when enabled): soft-trim oversized results, then hard-clear oldest when ratios exceeded
- `aggressive`: always replace eligible tool results
- `off`: disable

```json5
{
  agents: {
    defaults: {
      contextPruning: {
        mode: "adaptive",
        keepLastAssistants: 3,
        softTrimRatio: 0.3,
        hardClearRatio: 0.5,
        minPrunableToolChars: 50000,
        softTrim: { maxChars: 4000, headChars: 1500, tailChars: 1500 },
        hardClear: { enabled: true, placeholder: "[Old tool result content cleared]" },
        tools: { deny: ["browser", "canvas"] },
      },
    },
  },
}
```

See [Session Pruning](/concepts/session-pruning) for behavior details.

#### Compaction

`agents.defaults.compaction.mode`: `default` or `safeguard` (chunked summarization). See [Compaction](/concepts/compaction).

`agents.defaults.compaction.reserveTokensFloor`: minimum `reserveTokens` (default: 20000).

`agents.defaults.compaction.memoryFlush`: runs a silent turn before auto-compaction to store durable memories. Skipped when workspace is read-only.

```json5
{
  agents: {
    defaults: {
      compaction: {
        mode: "safeguard",
        reserveTokensFloor: 24000,
        memoryFlush: {
          enabled: true,
          softThresholdTokens: 6000,
        },
      },
    },
  },
}
```

#### Block streaming

- `agents.defaults.blockStreamingDefault`: `"on"` | `"off"` (default off)
- Channel overrides: `*.blockStreaming` per channel/account
- `agents.defaults.blockStreamingBreak`: `"text_end"` | `"message_end"` (default: text_end)
- `agents.defaults.blockStreamingChunk`: `{ minChars, maxChars }` (default: 800–1200)
- `agents.defaults.blockStreamingCoalesce`: `{ idleMs, minChars, maxChars }` (merge streamed blocks)
- `agents.defaults.humanDelay`: randomized pause between block replies. Modes: `off` (default), `natural` (800–2500ms), `custom` (`minMs`/`maxMs`)

See [Streaming + chunking](/concepts/streaming) for details.

#### Typing indicators

- `agents.defaults.typingMode`: `"never"` | `"instant"` | `"thinking"` | `"message"`
- `agents.defaults.typingIntervalSeconds`: refresh cadence (default: 6s)
- Per-session overrides: `session.typingMode`, `session.typingIntervalSeconds`

See [Typing indicators](/concepts/typing-indicators).

#### Model selection notes

- Model refs: `provider/model` format (e.g. `anthropic/claude-opus-4-6`)
- Z.AI: `zai/<model>` (requires `ZAI_API_KEY`)
- If you omit the provider, OpenClaw assumes `anthropic` as a deprecation fallback

#### Heartbeat

- `every`: duration string (default: `30m`, set `0m` to disable)
- `model`: optional override model for heartbeat runs
- `includeReasoning`: deliver reasoning message (default: false)
- `session`: session key (default: `main`)
- `to`: optional recipient override
- `target`: delivery channel (`last`, `whatsapp`, `telegram`, etc.)
- `prompt`: override heartbeat body
- `ackMaxChars`: max chars after `HEARTBEAT_OK` (default: 300)
- Per-agent: `agents.list[].heartbeat` (when set, only those agents run heartbeats)

#### Exec and background

- `tools.exec.backgroundMs`: auto-background delay (default 10000)
- `tools.exec.timeoutSec`: auto-kill timeout (default 1800)
- `tools.exec.cleanupMs`: finished session TTL (default 1800000)
- `tools.exec.notifyOnExit`: system event on background exit (default true)
- `tools.exec.applyPatch.enabled`: experimental apply_patch (default false)
- `tools.exec.applyPatch.allowModels`: optional model allowlist

#### Web search and fetch

- `tools.web.search.enabled`, `.apiKey`, `.maxResults` (1–10), `.timeoutSeconds`, `.cacheTtlMinutes`
- `tools.web.fetch.enabled`, `.maxChars`, `.maxCharsCap`, `.timeoutSeconds`, `.cacheTtlMinutes`, `.userAgent`, `.readability`
- `tools.web.fetch.firecrawl.enabled`, `.apiKey`, `.baseUrl`, `.onlyMainContent`

#### Media understanding

- `tools.media.models`: shared model list (capability-tagged)
- `tools.media.concurrency`: max concurrent runs (default 2)
- Per capability (`image` / `audio` / `video`): `enabled`, `prompt`, `maxChars`, `maxBytes`, `timeoutSeconds`, `language`, `attachments`, `scope`, `models`
- Each `models[]` entry: provider or CLI, with `capabilities`, `maxChars`, `maxBytes`, `timeoutSeconds` overrides
- Provider auth follows standard order (auth profiles, env vars, `models.providers.*.apiKey`)

#### Sub-agents

- `agents.defaults.subagents.model`: default model (string or `{ primary, fallbacks }`)
- `agents.defaults.subagents.maxConcurrent`: max concurrent (default 1)
- `agents.defaults.subagents.archiveAfterMinutes`: auto-archive (default 60, `0` disables)
- Tool policy: `tools.subagents.tools.allow` / `tools.subagents.tools.deny`

See [Sub-Agents](/tools/subagents).

#### Tool profiles

`tools.profile` sets a base allowlist: `minimal`, `coding`, `messaging`, `full` (no restriction).

`tools.byProvider` restricts tools per provider or `provider/model`.

`tools.allow` / `tools.deny`: global policy (deny wins, supports `*` wildcards).

Tool groups: `group:runtime`, `group:fs`, `group:sessions`, `group:memory`, `group:web`, `group:ui`, `group:automation`, `group:messaging`, `group:nodes`, `group:openclaw`.

#### Elevated exec

`tools.elevated`: host exec access.

```json5
{
  tools: {
    elevated: {
      enabled: true,
      allowFrom: {
        whatsapp: ["+15555550123"],
        discord: ["steipete", "1234567890123"],
      },
    },
  },
}
```

- Per-agent override: `agents.list[].tools.elevated` (can only further restrict)
- `/elevated on|off|ask|full` per session

#### Concurrency

`agents.defaults.maxConcurrent`: max parallel agent runs across sessions (default: 1). Each session is still serialized.

## Sandbox

See [Sandboxing](/gateway/sandboxing) for the full guide.

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "agent",
        workspaceAccess: "none",
        workspaceRoot: "~/.openclaw/sandboxes",
        docker: {
          image: "openclaw-sandbox:bookworm-slim",
          containerPrefix: "openclaw-sbx-",
          workdir: "/workspace",
          readOnlyRoot: true,
          tmpfs: ["/tmp", "/var/tmp", "/run"],
          network: "none",
          user: "1000:1000",
          capDrop: ["ALL"],
          env: { LANG: "C.UTF-8" },
          setupCommand: "apt-get update && apt-get install -y git curl jq",
          pidsLimit: 256,
          memory: "1g",
          memorySwap: "2g",
          cpus: 1,
          ulimits: { nofile: { soft: 1024, hard: 2048 }, nproc: 256 },
          seccompProfile: "/path/to/seccomp.json",
          apparmorProfile: "openclaw-sandbox",
          dns: ["1.1.1.1", "8.8.8.8"],
          extraHosts: ["internal.service:10.0.0.5"],
          binds: ["/var/run/docker.sock:/var/run/docker.sock"],
        },
        browser: {
          enabled: false,
          image: "openclaw-sandbox-browser:bookworm-slim",
          cdpPort: 9222,
          vncPort: 5900,
          noVncPort: 6080,
          headless: false,
          enableNoVnc: true,
          allowHostControl: false,
          allowedControlUrls: ["http://10.0.0.42:18791"],
          allowedControlHosts: ["browser.lab.local"],
          allowedControlPorts: [18791],
          autoStart: true,
          autoStartTimeoutMs: 12000,
        },
        prune: { idleHours: 24, maxAgeDays: 7 },
      },
    },
  },
  tools: {
    sandbox: {
      tools: {
        allow: [
          "exec",
          "process",
          "read",
          "write",
          "edit",
          "apply_patch",
          "sessions_list",
          "sessions_history",
          "sessions_send",
          "sessions_spawn",
          "session_status",
        ],
        deny: ["browser", "canvas", "nodes", "cron", "discord", "gateway"],
      },
    },
  },
}
```

Notes:

- `scope: "shared"` = shared container, no cross-session isolation. Prefer `"session"` or `"agent"`.
- `setupCommand` runs once after container creation (inside container via `sh -lc`)
- `docker.binds` mounts additional host directories; global and per-agent binds merge
- `network: "none"` is default; set `"bridge"` for outbound access
- Build images: `scripts/sandbox-setup.sh`, `scripts/sandbox-browser-setup.sh`
- See [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) for the decision guide

## Custom providers and base URLs

Add custom providers (LiteLLM, local servers, etc.) via `models.providers`:

```json5
{
  models: {
    mode: "merge",
    providers: {
      "custom-proxy": {
        baseUrl: "http://localhost:4000/v1",
        apiKey: "LITELLM_KEY",
        api: "openai-completions",
        models: [
          {
            id: "llama-3.1-8b",
            name: "Llama 3.1 8B",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 128000,
            maxTokens: 32000,
          },
        ],
      },
    },
  },
  agents: {
    defaults: {
      model: { primary: "custom-proxy/llama-3.1-8b" },
      models: { "custom-proxy/llama-3.1-8b": {} },
    },
  },
}
```

Supported APIs: `openai-completions`, `openai-responses`, `anthropic-messages`, `google-generative-ai`, `github-copilot`, `bedrock-converse-stream`.

Use `authHeader: true` + `headers` for custom auth. Override agent config root with `OPENCLAW_AGENT_DIR`.

For provider-specific setup, see the dedicated pages:

- [OpenCode Zen](/providers/opencode) — `opencode/<model>`
- [Z.AI (GLM)](/providers/zai) — `zai/<model>`
- [Moonshot AI (Kimi)](/providers/moonshot) — `moonshot/<model>`, `kimi-coding/<model>`
- [MiniMax](/providers/minimax) — `minimax/<model>`
- [Synthetic](/providers/synthetic) — `synthetic/<model>`
- [Local models (LM Studio)](/gateway/local-models)
- [LiteLLM](/providers/litellm)
- Provider overview: [Model Providers](/concepts/model-providers)

<Accordion title="Cerebras (GLM 4.6 / 4.7)">
Use Cerebras via their OpenAI-compatible endpoint:

```json5
{
  env: { CEREBRAS_API_KEY: "sk-..." },
  agents: {
    defaults: {
      model: {
        primary: "cerebras/zai-glm-4.7",
        fallbacks: ["cerebras/zai-glm-4.6"],
      },
      models: {
        "cerebras/zai-glm-4.7": { alias: "GLM 4.7 (Cerebras)" },
        "cerebras/zai-glm-4.6": { alias: "GLM 4.6 (Cerebras)" },
      },
    },
  },
  models: {
    mode: "merge",
    providers: {
      cerebras: {
        baseUrl: "https://api.cerebras.ai/v1",
        apiKey: "${CEREBRAS_API_KEY}",
        api: "openai-completions",
        models: [
          { id: "zai-glm-4.7", name: "GLM 4.7 (Cerebras)" },
          { id: "zai-glm-4.6", name: "GLM 4.6 (Cerebras)" },
        ],
      },
    },
  },
}
```

Notes:

- Use `cerebras/zai-glm-4.7` for Cerebras; use `zai/glm-4.7` for Z.AI direct.
- Set `CEREBRAS_API_KEY` in the environment or config.

</Accordion>

## Session

```json5
{
  session: {
    scope: "per-sender",
    dmScope: "main",
    identityLinks: {
      alice: ["telegram:123456789", "discord:987654321012345678"],
    },
    reset: { mode: "daily", atHour: 4, idleMinutes: 60 },
    resetByType: {
      thread: { mode: "daily", atHour: 4 },
      direct: { mode: "idle", idleMinutes: 240 },
      group: { mode: "idle", idleMinutes: 120 },
    },
    resetTriggers: ["/new", "/reset"],
    store: "~/.openclaw/agents/{agentId}/sessions/sessions.json",
    maintenance: { mode: "warn", pruneAfter: "30d", maxEntries: 500, rotateBytes: "10mb" },
    mainKey: "main",
    agentToAgent: { maxPingPongTurns: 5 },
    sendPolicy: {
      rules: [{ action: "deny", match: { channel: "discord", chatType: "group" } }],
      default: "allow",
    },
  },
}
```

Fields:

- `mainKey`: direct-chat bucket key (default: `"main"`). Sandbox uses this to detect the main session.
- `dmScope`: `main` | `per-peer` | `per-channel-peer` | `per-account-channel-peer`.
- `identityLinks`: map canonical ids to provider-prefixed peers for cross-channel DM sharing.
- `reset`: primary reset policy (default: daily at 4:00 AM). When daily + idle both set, whichever expires first wins.
- `resetByType`: per-type overrides for `direct`, `group`, `thread`.
- `heartbeatIdleMinutes`: optional idle override for heartbeat checks.
- `agentToAgent.maxPingPongTurns`: max reply-back turns (0–5, default 5).
- `sendPolicy`: block delivery by session type. First deny wins.
- `maintenance`: session store pruning/rotation.
  - `mode`: `"warn"` (default) or `"enforce"`
  - `pruneAfter`, `maxEntries`, `rotateBytes`

See [Session Management](/concepts/session) for scoping, lifecycle, and inspecting sessions.

## Skills

```json5
{
  skills: {
    allowBundled: ["gemini", "peekaboo"],
    load: { extraDirs: ["~/Projects/skills"] },
    install: { preferBrew: true, nodeManager: "npm" },
    entries: {
      "nano-banana-pro": { apiKey: "KEY", env: { GEMINI_API_KEY: "KEY" } },
      peekaboo: { enabled: true },
      sag: { enabled: false },
    },
  },
}
```

## Plugins (extensions)

```json5
{
  plugins: {
    enabled: true,
    allow: ["voice-call"],
    load: { paths: ["~/Projects/oss/voice-call-extension"] },
    entries: {
      "voice-call": { enabled: true, config: { provider: "twilio" } },
    },
  },
}
```

See [Plugins](/tools/plugin).

## Browser

```json5
{
  browser: {
    enabled: true,
    evaluateEnabled: true,
    defaultProfile: "chrome",
    profiles: {
      openclaw: { cdpPort: 18800, color: "#FF4500" },
      work: { cdpPort: 18801, color: "#0066CC" },
      remote: { cdpUrl: "http://10.0.0.42:9222", color: "#00AA00" },
    },
    color: "#FF4500",
  },
}
```

Notes:

- Control service: loopback only (port derived from `gateway.port`, default 18791)
- CDP URL default: `http://127.0.0.1:18792`
- Remote profiles: attach-only (start/stop/reset disabled)
- Auto-detect: default browser if Chromium-based; otherwise Chrome → Brave → Edge → Chromium

## UI (Appearance)

```json5
{
  ui: {
    seamColor: "#FF4500",
    assistant: { name: "OpenClaw", avatar: "CB" },
  },
}
```

## Gateway

```json5
{
  gateway: {
    mode: "local",
    port: 18789,
    bind: "loopback",
    auth: { mode: "token", token: "your-token" },
    tailscale: { mode: "off" },
    controlUi: { enabled: true, basePath: "/openclaw" },
    reload: { mode: "hybrid", debounceMs: 300 },
    trustedProxies: [],
  },
}
```

Notes:

- `gateway.port`: single multiplexed port for WS + HTTP
- Precedence: `--port` > `OPENCLAW_GATEWAY_PORT` > `gateway.port` > default `18789`
- Gateway auth is required by default. Non-loopback binds require a shared token/password.
- `gateway.auth.allowTailscale`: allow Tailscale Serve identity headers (default true when `tailscale.mode = "serve"`)
- `gateway.tailscale.mode`: `"off"` | `"serve"` (tailnet only) | `"funnel"` (public)
- OpenAI Chat Completions: disabled by default, enable with `gateway.http.endpoints.chatCompletions.enabled: true`

<Accordion title="Control UI options">
- `gateway.controlUi.basePath`: URL prefix (default: `/`)
- `gateway.controlUi.root`: filesystem root for assets
- `gateway.controlUi.allowInsecureAuth`: token-only auth without device identity (default: false)
- `gateway.controlUi.dangerouslyDisableDeviceAuth`: disable device checks (break-glass only)
</Accordion>

<Accordion title="Remote client defaults">
```json5
{
  gateway: {
    mode: "remote",
    remote: {
      url: "ws://gateway.tailnet:18789",
      transport: "ssh",      // ssh | direct
      token: "your-token",
      password: "your-password",
    },
  },
}
```

- `transport: "direct"` requires `ws://` or `wss://` URL
- macOS app watches config and switches modes live

</Accordion>

<Accordion title="Auth and Tailscale details">
- `gateway.auth.mode`: `token` or `password`
- `gateway.auth.token`: shared token for local access
- `gateway.auth.password`: or via `OPENCLAW_GATEWAY_PASSWORD`
- `gateway.auth.allowTailscale`: verify Tailscale Serve identity via `tailscale whois`
- `gateway.remote.token` / `gateway.remote.password`: for remote CLI calls only
</Accordion>

### Multi-instance isolation

To run multiple gateways on one host, isolate per-instance state + config and use unique ports:

- `OPENCLAW_CONFIG_PATH` (per-instance config)
- `OPENCLAW_STATE_DIR` (sessions/creds)
- `agents.defaults.workspace` (memories)
- `gateway.port` (unique per instance)

Convenience flags: `openclaw --dev …` (uses `~/.openclaw-dev` + port 19001), `openclaw --profile <name> …` (uses `~/.openclaw-<name>`).

See [Multiple gateways](/gateway/multiple-gateways) for details.

## Hooks

```json5
{
  hooks: {
    enabled: true,
    token: "shared-secret",
    path: "/hooks",
    allowedAgentIds: ["hooks", "main"],
    presets: ["gmail"],
    transformsDir: "~/.openclaw/hooks",
    mappings: [
      {
        match: { path: "gmail" },
        action: "agent",
        agentId: "hooks",
        wakeMode: "now",
        name: "Gmail",
        sessionKey: "hook:gmail:{{messages[0].id}}",
        messageTemplate: "From: {{messages[0].from}}\nSubject: {{messages[0].subject}}\n{{messages[0].snippet}}",
        deliver: true,
        channel: "last",
        model: "openai/gpt-5.2-mini",
      },
    ],
  },
}
```

Endpoints:

- `POST /hooks/wake` → `{ text, mode?: "now"|"next-heartbeat" }`
- `POST /hooks/agent` → `{ message, name?, agentId?, sessionKey?, wakeMode?, deliver?, channel?, to?, model?, thinking?, timeoutSeconds? }`
- `POST /hooks/<name>` → resolved via `hooks.mappings`

Auth: `Authorization: Bearer <token>` or `x-openclaw-token: <token>`.

Mapping notes:

- `match.path` matches sub-path after `/hooks`
- `match.source` matches a payload field
- Templates like `{{messages[0].subject}}` read from the payload
- `transform` can point to a JS/TS module
- `deliver: true` sends final reply to a channel; `channel` defaults to `last`
- `model` overrides the LLM for this hook run

<Accordion title="Gmail hooks config">
```json5
{
  hooks: {
    gmail: {
      account: "openclaw@gmail.com",
      topic: "projects/<project-id>/topics/gog-gmail-watch",
      subscription: "gog-gmail-watch-push",
      pushToken: "shared-push-token",
      hookUrl: "http://127.0.0.1:18789/hooks/gmail",
      includeBody: true,
      maxBytes: 20000,
      renewEveryMinutes: 720,
      serve: { bind: "127.0.0.1", port: 8788, path: "/" },
      tailscale: { mode: "funnel", path: "/gmail-pubsub" },
      model: "openrouter/meta-llama/llama-3.3-70b-instruct:free",
      thinking: "off",
    },
  },
}
```

Notes:

- Gateway auto-starts `gog gmail watch serve` on boot when enabled
- Set `OPENCLAW_SKIP_GMAIL_WATCHER=1` to disable
- Avoid running a separate `gog gmail watch serve` alongside the Gateway

</Accordion>

## Canvas host

```json5
{
  canvasHost: {
    root: "~/.openclaw/workspace/canvas",
    port: 18793,
    liveReload: true,
  },
}
```

Notes:

- Serves files over HTTP for iOS/Android nodes
- Injects live-reload client into served HTML
- Also serves A2UI at `/__openclaw__/a2ui/`
- Auto-creates starter `index.html` when directory is empty
- Disable with `canvasHost: { enabled: false }` or `OPENCLAW_SKIP_CANVAS_HOST=1`
- Requires gateway restart on config change

## Bridge (legacy, removed)

<Warning>
The TCP bridge listener has been removed. `bridge.*` config keys are ignored. Nodes connect over the Gateway WebSocket. This section is kept for historical reference only.
</Warning>

Legacy config (no longer functional):

```json5
{
  bridge: {
    enabled: true,
    port: 18790,
    bind: "tailnet",
    tls: { enabled: true },
  },
}
```

Bind modes were: `lan`, `tailnet`, `loopback`, `auto`.

## Discovery

### `discovery.mdns` (Bonjour / mDNS)

```json5
{
  discovery: { mdns: { mode: "minimal" } },
}
```

Modes: `minimal` (default, omit `cliPath` + `sshPort`), `full`, `off`.
Hostname override: `OPENCLAW_MDNS_HOSTNAME` (default: `openclaw`).

### `discovery.wideArea` (unicast DNS-SD)

```json5
{
  discovery: { wideArea: { enabled: true } },
}
```

One-time setup: `openclaw dns setup --apply`. See [Discovery](/gateway/discovery) for details.

## Media model template variables

Template placeholders expanded in `tools.media.*.models[].args`:

| Variable           | Description                                       |
| ------------------ | ------------------------------------------------- |
| `{{Body}}`         | Full inbound message body                         |
| `{{RawBody}}`      | Raw body (no history/sender wrappers)             |
| `{{BodyStripped}}` | Body with group mentions stripped                 |
| `{{From}}`         | Sender identifier                                 |
| `{{To}}`           | Destination identifier                            |
| `{{MessageSid}}`   | Channel message id                                |
| `{{SessionId}}`    | Current session UUID                              |
| `{{IsNewSession}}` | `"true"` when new session created                 |
| `{{MediaUrl}}`     | Inbound media pseudo-URL                          |
| `{{MediaPath}}`    | Local media path                                  |
| `{{MediaType}}`    | Media type (image/audio/document/…)               |
| `{{Transcript}}`   | Audio transcript (when enabled)                   |
| `{{Prompt}}`       | Resolved media prompt for CLI entries             |
| `{{MaxChars}}`     | Resolved max output chars                         |
| `{{ChatType}}`     | `"direct"` or `"group"`                           |
| `{{GroupSubject}}` | Group subject (best effort)                       |
| `{{GroupMembers}}` | Group members preview (best effort)               |
| `{{SenderName}}`   | Sender display name (best effort)                 |
| `{{SenderE164}}`   | Sender phone number (best effort)                 |
| `{{Provider}}`     | Provider hint (whatsapp, telegram, discord, etc.) |

## Cron (Gateway scheduler)

```json5
{
  cron: {
    enabled: true,
    maxConcurrentRuns: 2,
    sessionRetention: "24h",
  },
}
```

See [Cron jobs](/automation/cron-jobs) for the full guide.

---

_Related: [Configuration](/gateway/configuration) · [Configuration Examples](/gateway/configuration-examples) · [Doctor](/gateway/doctor)_
