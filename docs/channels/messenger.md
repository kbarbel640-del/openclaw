---
summary: "Facebook Messenger integration status, capabilities, and configuration"
read_when:
  - Working on Messenger features or webhooks
title: "Messenger"
---

# Facebook Messenger

Status: production-ready for page DMs via Facebook Graph API. Webhook-based; requires HTTPS endpoint.

## Quick setup (beginner)

1. Create a Facebook App and Page at [developers.facebook.com](https://developers.facebook.com).
2. Generate a Page Access Token in the Messenger settings.
3. Set the token:
   - Env: `MESSENGER_PAGE_ACCESS_TOKEN=...`
   - Or config: `channels.messenger.pageAccessToken: "..."`.
4. Configure webhook verification token and app secret.
5. Start the gateway and configure the webhook URL in Facebook Developer Console.
6. DM access is pairing by default; approve the pairing code on first contact.

Minimal config:

```json5
{
  channels: {
    messenger: {
      enabled: true,
      pageAccessToken: "EAAG...",
      appSecret: "your_app_secret",
      verifyToken: "your_verify_token",
      dmPolicy: "pairing",
    },
  },
}
```

## What it is

- A Facebook Messenger channel using the Send API and Webhooks.
- Deterministic routing: replies go back to Messenger; the model never chooses channels.
- DMs use the agent's main session (`agent:<agentId>:messenger:dm:<psid>`).
- PSID (Page-Scoped User ID) identifies users uniquely per page.

## Setup (detailed)

### 1) Create a Facebook App

1. Go to [developers.facebook.com](https://developers.facebook.com) and create a new app.
2. Select "Business" type and add the "Messenger" product.
3. Create or link a Facebook Page to your app.

### 2) Generate Page Access Token

1. In App Dashboard, go to Messenger > Settings.
2. Under "Access Tokens", click "Generate Token" for your page.
3. Copy the token (long-lived tokens are recommended for production).

### 3) Configure the token

Example:

```json5
{
  channels: {
    messenger: {
      enabled: true,
      pageAccessToken: "EAAG...",
      appSecret: "abc123...",
      verifyToken: "my_secret_verify_token",
      dmPolicy: "pairing",
    },
  },
}
```

Env option: `MESSENGER_PAGE_ACCESS_TOKEN=...` (works for the default account).
If both env and config are set, config takes precedence.

Multi-account support: use `channels.messenger.accounts` with per-account tokens and optional `name`.

### 4) Configure Webhooks

1. In App Dashboard, go to Messenger > Settings > Webhooks.
2. Set the callback URL to your gateway's webhook endpoint:
   - Default: `https://your-domain.com/webhook/messenger`
3. Set the verify token to match `channels.messenger.verifyToken`.
4. Subscribe to events: `messages`, `messaging_postbacks`, `messaging_optins`.

### 5) Security (App Secret)

The `appSecret` is used to verify webhook request signatures. Without it, signature verification is disabled (not recommended for production).

Find your App Secret in App Dashboard > Settings > Basic.

## How it works (behavior)

- Inbound messages are normalized into the shared channel envelope with reply context and media.
- Replies always route back to the same Messenger conversation.
- Quick replies and button templates are supported via the Send API.
- The 24-hour messaging window applies; use message tags for notifications outside the window.

## DM policies

Control who can message your bot:

| Policy | Behavior |
|--------|----------|
| `pairing` (default) | First message triggers pairing; approve via `openclaw pair approve messenger <code>` |
| `allowlist` | Only PSIDs in `allowFrom` can message |
| `open` | Anyone can message (not recommended for production) |
| `disabled` | DMs are ignored |

Example with allowlist:

```json5
{
  channels: {
    messenger: {
      dmPolicy: "allowlist",
      allowFrom: ["1234567890123456", "9876543210123456"],
    },
  },
}
```

## Templates and Quick Replies

Messenger supports rich message formats:

### Quick Replies (max 13, 20 char titles)

```json5
{
  text: "Choose an option:",
  quick_replies: [
    { content_type: "text", title: "Yes", payload: "YES" },
    { content_type: "text", title: "No", payload: "NO" },
  ],
}
```

### Button Templates (max 3 buttons, 20 char titles)

```json5
{
  attachment: {
    type: "template",
    payload: {
      template_type: "button",
      text: "What would you like to do?",
      buttons: [
        { type: "postback", title: "Help", payload: "HELP" },
        { type: "web_url", title: "Visit Site", url: "https://example.com" },
      ],
    },
  },
}
```

### Generic Templates (max 10 elements)

Carousel-style templates with images, titles, subtitles, and buttons.

## Limits

- Outbound text is chunked to 2000 characters (Messenger limit).
- Quick replies: max 13 per message, 20 character titles.
- Buttons: max 3 per template, 20 character titles.
- Generic template: max 10 elements.
- Media: images, video, audio, and files supported.

## Sender Actions

The bot can show typing indicators:

- `typing_on` - Show typing bubble
- `typing_off` - Hide typing bubble
- `mark_seen` - Mark message as read

These are sent automatically during message processing.

## Troubleshooting

### Webhook verification fails

- Ensure `verifyToken` in config matches the token in Facebook Developer Console.
- Check that your endpoint is accessible via HTTPS.

### Messages not received

- Verify webhook subscriptions include `messages` event.
- Check that the page is published and the app is in live mode (or you're a test user).
- Ensure `appSecret` is set for signature verification.

### API errors

- `(#100) Invalid OAuth access token` - Token expired or invalid; regenerate in App Dashboard.
- Rate limits apply; the bot uses exponential backoff for retries.

### 24-hour window

Messages outside the 24-hour window require a message tag. Supported tags:

- `CONFIRMED_EVENT_UPDATE` - Event reminders
- `POST_PURCHASE_UPDATE` - Order updates
- `ACCOUNT_UPDATE` - Account changes
- `HUMAN_AGENT` - Human agent handoff (requires approval)

More help: [Channel troubleshooting](/channels/troubleshooting).

## Configuration Reference

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable the channel |
| `pageAccessToken` | string | - | Page Access Token from Facebook |
| `tokenFile` | string | - | Path to file containing the token |
| `appSecret` | string | - | App Secret for webhook signature verification |
| `verifyToken` | string | - | Token for webhook verification handshake |
| `pageId` | string | - | Facebook Page ID (optional, for reference) |
| `dmPolicy` | string | `"pairing"` | DM access policy: `pairing`, `allowlist`, `open`, `disabled` |
| `allowFrom` | array | `[]` | PSIDs allowed to message (for `allowlist` policy) |
| `name` | string | - | Display name for the account |
| `accounts` | object | - | Multi-account configuration |

### Multi-account example

```json5
{
  channels: {
    messenger: {
      enabled: true,
      accounts: {
        "main-page": {
          name: "Main Page",
          pageAccessToken: "EAAG...",
          appSecret: "...",
          verifyToken: "...",
        },
        "support-page": {
          name: "Support Page",
          pageAccessToken: "EAAH...",
          appSecret: "...",
          verifyToken: "...",
        },
      },
    },
  },
}
```

## Security Recommendations

1. **Always set `appSecret`** - Enables webhook signature verification.
2. **Use `pairing` or `allowlist`** - Avoid `open` policy in production.
3. **Use tokenFile** - Store tokens in a file rather than config for better security.
4. **Rotate tokens** - Regenerate tokens periodically in Facebook Developer Console.
5. **HTTPS required** - Webhooks must use HTTPS with a valid certificate.
