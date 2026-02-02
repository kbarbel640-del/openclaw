---
summary: "Connect OpenClaw to Lark/Feishu"
read_when:
  - You want to use OpenClaw on Lark/Feishu (飞书)
title: "Lark (飞书)"
---

# Lark (飞书)

OpenClaw can receive and send messages via Lark (飞书), the enterprise collaboration platform by ByteDance.

## Prerequisites

- A Lark/Feishu account (Enterprise or Standard)
- Permission to create custom apps in your Lark tenant

## Setup

### 1. Create a Lark App

1. Go to [Lark Open Platform](https://open.feishu.cn/app)
2. Click **Create App** → **Custom App**
3. Enter app name and description
4. Note down the **App ID** and **App Secret**

### 2. Configure Permissions

Enable the following bot permissions:

- `im:chat:readonly` — Read chat/group information
- `im:message:send` — Send messages
- `im:message.group_msg` — Receive group messages
- `im:message.p2p_msg` — Receive P2P messages

### 3. Configure Event Subscription

1. In your Lark app, go to **Event Subscriptions**
2. Set the request URL to: `https://your-gateway-url/webhook/lark`
3. Add the following event types:
   - `im.message.receive_v1`

### 4. Enable Bot

1. Go to **Features** → **Bot**
2. Enable the bot and set a name/avatar

### 5. Add to OpenClaw

Run the setup wizard:

```bash
openclaw channels add lark
```

Or configure manually:

```bash
openclaw config set channels.lark.appId "cli_xxx"
openclaw config set channels.lark.appSecret "xxx"
openclaw config set channels.lark.enabled true
```

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `appId` | string | Lark App ID (cli_xxx) |
| `appSecret` | string | Lark App Secret |
| `encryptKey` | string | Event encryption key (optional) |
| `verificationToken` | string | Verification token (optional) |
| `enabled` | boolean | Enable this channel |
| `dmPolicy` | string | DM policy: `pairing`, `open`, `allowlist` |
| `groupPolicy` | string | Group policy: `open`, `allowlist` |
| `allowFrom` | string[] | Allowed user OpenIDs |
| `groupAllowFrom` | string[] | Allowed group ChatIDs |

## Environment Variables

For the default account, you can use environment variables:

```bash
export LARK_APP_ID="cli_xxx"
export LARK_APP_SECRET="xxx"
export LARK_ENCRYPT_KEY="xxx"          # optional
export LARK_VERIFICATION_TOKEN="xxx"   # optional
```

## Multi-Account Setup

Configure multiple Lark workspaces:

```json
{
  "channels": {
    "lark": {
      "accounts": {
        "workspace1": {
          "appId": "cli_xxx",
          "appSecret": "xxx",
          "enabled": true
        },
        "workspace2": {
          "appId": "cli_yyy",
          "appSecret": "yyy",
          "enabled": true
        }
      }
    }
  }
}
```

## Features

- ✅ Text messages
- ✅ Group chats
- ✅ @Mentions
- ✅ Rich text / Markdown
- ✅ Interactive cards (via `[[card:...]]`)
- ⚠️ Media (sent as links)
- ❌ Voice messages

## Message Limits

- Max message length: 2000 characters
- Rate limit: Follows Lark Bot API limits (20 msg/s per app)

## Troubleshooting

### Bot not responding

1. Check Gateway is running: `openclaw gateway status`
2. Verify webhook URL is accessible from internet
3. Check Lark app logs in Open Platform

### "Invalid app_id or app_secret"

- Verify credentials are correct
- Ensure no extra spaces in config values

### Events not received

- Confirm event subscription URL is correct
- Check that required events are subscribed
- Verify bot is added to the chat/group

## Security

- Keep `appSecret` confidential
- Use `encryptKey` for production
- Configure `allowFrom` to restrict access
- Review Lark's [security best practices](https://open.feishu.cn/document/home/security)
