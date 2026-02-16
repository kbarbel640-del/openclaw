---
summary: "MAX Messenger channel support status, capabilities, and configuration"
read_when:
  - Working on MAX features or webhooks
  - Configuring MAX Bot API integration
title: "MAX"
---

# MAX (Bot API)

Status: production-ready for bot DMs + groups via MAX Bot API at `platform-api.max.ru`. Long polling is the default mode; webhook mode requires HTTPS.

<CardGroup cols={3}>
  <Card title="Pairing" icon="link" href="/channels/pairing">
    Default DM policy for MAX is pairing.
  </Card>
  <Card title="Channel troubleshooting" icon="wrench" href="/channels/troubleshooting">
    Cross-channel diagnostics and repair playbooks.
  </Card>
  <Card title="Gateway configuration" icon="settings" href="/gateway/configuration">
    Full channel config patterns and examples.
  </Card>
</CardGroup>

## Quick setup

<Steps>
  <Step title="Create a bot on dev.max.ru">
    Go to [dev.max.ru](https://dev.max.ru) and create a new bot in the developer portal. Copy the bot token.

    <Note>
    Bot publishing requires a verified Russian legal entity. Personal/test bots can be created freely.
    </Note>

  </Step>

  <Step title="Configure token and DM policy">

```json5
{
  channels: {
    max: {
      enabled: true,
      botToken: "your-token-here",
      dmPolicy: "pairing",
      groupPolicy: "allowlist",
    },
  },
}
```

    Env fallback: `MAX_BOT_TOKEN=...` (default account only).

  </Step>

  <Step title="Start gateway and approve first DM">

```bash
openclaw gateway
openclaw pairing list max
openclaw pairing approve max <CODE>
```

    Pairing codes expire after 1 hour.

  </Step>

  <Step title="Add the bot to a group">
    Add the bot to your MAX group, then set `channels.max.groupPolicy` and `groupAllowFrom` to match your access model.
  </Step>
</Steps>

<Note>
Token resolution order: (1) `tokenFile` path, (2) config `botToken`, (3) `MAX_BOT_TOKEN` env var (default account only). Config values win over env fallback.
</Note>

## Runtime model

- **Long polling** (default): the gateway calls `GET /updates?limit=100&timeout=30` in a loop. Safe behind NAT, no public URL needed.
- **Webhook mode**: set `webhookUrl` to an HTTPS endpoint. The gateway calls `POST /subscriptions` to register with MAX. Webhook verification uses a shared secret sent in the `X-Max-Bot-Api-Secret` header.
- **Rate limit**: 30 requests per second per bot token.
- **Max request size**: 10 MB.

## Access control

<Tabs>
  <Tab title="DM policy">
    `channels.max.dmPolicy` controls who can start a direct conversation:

    | Value | Behavior |
    |-------|----------|
    | `"pairing"` (default) | New users must pair with a code via `openclaw pairing approve max <CODE>`. |
    | `"allowlist"` | Only user IDs listed in `allowFrom` may DM the bot. |
    | `"open"` | Anyone can DM. Requires `allowFrom: ["*"]` as explicit opt-in. |

    **Finding MAX user IDs**: user IDs are numeric. They appear in pairing requests and gateway logs.

    ```json5
    {
      channels: {
        max: {
          dmPolicy: "allowlist",
          allowFrom: [123456789, 987654321],
        },
      },
    }
    ```

  </Tab>

  <Tab title="Group policy">
    `channels.max.groupPolicy` controls group message handling:

    | Value | Behavior |
    |-------|----------|
    | `"allowlist"` (default) | Only groups listed in `groupAllowFrom` are served. |
    | `"open"` | All groups where the bot is a member are served. |

    ```json5
    {
      channels: {
        max: {
          groupPolicy: "allowlist",
          groupAllowFrom: [-100123456789],
        },
      },
    }
    ```

  </Tab>

  <Tab title="Mention behavior">
    In groups, the bot only responds when mentioned by default (`requireMention: true`).

    The bot detects `@botname` mentions in group messages. When the bot is not mentioned, the message is silently ignored.

  </Tab>
</Tabs>

## Feature reference

<AccordionGroup>
  <Accordion title="Formatting">
    MAX supports `markdown` and `html` message formats. Default is `markdown`.

    Set `channels.max.format` to change:

    ```json5
    { channels: { max: { format: "html" } } }
    ```

    Text messages are chunked at 4000 characters (configurable via `textChunkLimit`).

  </Accordion>

  <Accordion title="Native commands">
    MAX supports bot commands registered in the developer portal at dev.max.ru. Native commands are enabled by default for MAX.

    Commands appear in the bot's command menu within MAX.

  </Accordion>

  <Accordion title="Inline buttons">
    MAX supports inline keyboards with up to 210 buttons (30 rows, 7 per row). Button types:

    | Type | Description |
    |------|-------------|
    | `callback` | Sends callback data to the bot |
    | `link` | Opens a URL |
    | `request_contact` | Requests user's contact info |
    | `request_geo_location` | Requests user's location |
    | `open_app` | Opens a mini-app |

  </Accordion>

  <Accordion title="Block streaming">
    Block streaming is enabled by default. Long responses are coalesced before sending:

    - `minChars`: 1500 (minimum characters before sending a block)
    - `idleMs`: 1000 (idle time before flushing)

    Disable with `channels.max.blockStreaming: false`.

  </Accordion>

  <Accordion title="Webhook vs long polling">
    **Long polling** (default): no configuration needed, works behind NAT.

    **Webhook mode**: requires an HTTPS URL reachable by MAX servers.

    ```json5
    {
      channels: {
        max: {
          webhookUrl: "https://your-server.example.com/max/webhook",
          webhookSecret: "your-shared-secret",
          webhookPath: "/max/webhook",
        },
      },
    }
    ```

    MAX sends the secret in the `X-Max-Bot-Api-Secret` header for verification.

  </Accordion>

  <Accordion title="Media handling">
    MAX supports photo, video, audio, and file uploads. File upload is a two-step process:

    1. Upload file via `POST /uploads?type={photo|video|audio|file}` (max 10 MB)
    2. Attach the upload token to the message

    Media types are detected automatically from MIME type.

  </Accordion>

  <Accordion title="Multi-account">
    Run multiple MAX bots from a single gateway:

    ```json5
    {
      channels: {
        max: {
          accounts: {
            support: { botToken: "token-1", dmPolicy: "open", allowFrom: ["*"] },
            internal: { botToken: "token-2", dmPolicy: "allowlist", allowFrom: [123] },
          },
        },
      },
    }
    ```

    Per-account config inherits from the base `channels.max` config and can override any field.

  </Accordion>
</AccordionGroup>

## Webhook events

MAX sends the following update types to the bot:

| Event              | Description                              |
| ------------------ | ---------------------------------------- |
| `bot_started`      | User started a conversation with the bot |
| `message_created`  | New message in a chat                    |
| `message_callback` | Inline button callback                   |
| `message_edited`   | Message was edited                       |
| `message_removed`  | Message was deleted                      |
| `bot_added`        | Bot was added to a group                 |
| `bot_removed`      | Bot was removed from a group             |
| `user_added`       | User was added to a group                |
| `user_removed`     | User was removed from a group            |

## Troubleshooting

<AccordionGroup>
  <Accordion title="Bot not responding to messages">
    1. Check that the bot token is valid: `openclaw status max`
    2. Verify `dmPolicy` allows the sender
    3. Check gateway logs for errors
    4. Ensure the bot is running: `openclaw gateway`
  </Accordion>

  <Accordion title="Webhook not receiving events">
    1. Webhook URL must be HTTPS (self-signed certificates are accepted)
    2. Verify the `webhookSecret` matches what was configured during subscription
    3. Check that MAX servers can reach your webhook URL
    4. Try switching to long polling to isolate the issue
  </Accordion>

  <Accordion title="Group messages blocked">
    1. Check `groupPolicy` — default is `allowlist`, which blocks all groups not in `groupAllowFrom`
    2. The bot must be a member of the group
    3. In `allowlist` mode, add the group chat ID to `groupAllowFrom`
    4. Group IDs are negative numbers (e.g., `-100123456789`)
  </Accordion>

  <Accordion title="Rate limit errors">
    MAX enforces 30 requests per second per bot token. If you hit rate limits:

    1. Reduce message frequency
    2. Use block streaming to coalesce responses
    3. Consider using multiple bot accounts for high-traffic scenarios

  </Accordion>
</AccordionGroup>

More help: [Channel troubleshooting](/channels/troubleshooting).

## Configuration reference pointers

Primary reference:

- [Configuration reference - MAX](/gateway/configuration-reference#max)

High-signal MAX fields:

- auth: `botToken`, `tokenFile`, `MAX_BOT_TOKEN` env
- delivery: `webhookUrl`, `webhookSecret`, `webhookPath`
- access: `dmPolicy`, `allowFrom`, `groupPolicy`, `groupAllowFrom`
- formatting: `format`, `textChunkLimit`, `blockStreaming`
- network: `proxy`

## Related

- [Pairing](/channels/pairing)
- [Group messages](/channels/group-messages)
- [Channel routing](/channels/channel-routing)
- [Troubleshooting](/channels/troubleshooting)
- [MAX Developer Portal](https://dev.max.ru)
