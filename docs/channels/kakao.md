---
summary: "Kakao bot webhook support, capabilities, and configuration"
read_when:
  - Working on Kakao channel webhooks
  - Setting up Kakao Skill for OpenClaw
title: "Kakao"
---

# Kakao (Skill Webhook)

Status: experimental. Direct messages only.

## Plugin required

Kakao ships as a plugin and is not bundled with the core install.

- Install via CLI: `openclaw plugins install @openclaw/kakao`
- Or select **Kakao** during onboarding and confirm the install prompt
- Details: [Plugins](/tools/plugin)

## Quick setup (beginner)

1. Install the Kakao plugin:
   - From a source checkout: `openclaw plugins install ./extensions/kakao`
   - From npm (if published): `openclaw plugins install @openclaw/kakao`
   - Or pick **Kakao** in onboarding and confirm the install prompt
2. Set the webhook path (default is `/kakao/webhook`).
3. Expose the gateway HTTP port with your tunnel (ngrok, etc) and set the Kakao Skill URL.
4. DM access is pairing by default; approve the pairing code on first contact.

Minimal config:

```json5
{
  channels: {
    kakao: {
      enabled: true,
      webhookPath: "/kakao/webhook",
      dmPolicy: "pairing",
    },
  },
}
```

## What it is

Kakao Skill Webhook requests are forwarded to OpenClaw. The gateway extracts the
`userRequest.utterance` and uses it as the LLM input. Responses are returned as a
Kakao `simpleText` output payload.

- A Kakao Skill webhook endpoint backed by OpenClaw.
- Deterministic routing: replies go back to Kakao; the model never chooses channels.
- DMs share the agent main session.
- Groups are not supported in this plugin.

## Setup (fast path)

### 1) Configure the Kakao Skill webhook URL

- Use your gateway base URL plus the webhook path.
- Example:
  - `https://<public-host>/kakao/webhook`

### 2) Configure the channel in OpenClaw

```json5
{
  channels: {
    kakao: {
      enabled: true,
      webhookPath: "/kakao/webhook",
      dmPolicy: "open",
    },
  },
}
```

### 3) Restart the gateway

Kakao starts when the gateway starts; no additional polling is needed.

## Request and response

Kakao sends a JSON payload that includes `userRequest.utterance`. The plugin uses that
field only and ignores other fields for model input.

Example response (Kakao Skill 2.0):

```json
{
  "version": "2.0",
  "template": {
    "outputs": [
      {
        "simpleText": {
          "text": "간단한 텍스트 요소입니다."
        }
      }
    ]
  }
}
```

## Access control (DMs)

- Default: `channels.kakao.dmPolicy = "pairing"`. Unknown senders receive a pairing code; messages are ignored until approved (codes expire after 1 hour).
- Approve via:
  - `openclaw pairing list kakao`
  - `openclaw pairing approve kakao <CODE>`
- Pairing is the default token exchange. Details: [Pairing](/channels/pairing)
- `channels.kakao.allowFrom` accepts Kakao user IDs. Use `"*"` with `dmPolicy="open"` to allow all.

## Capabilities

| Feature         | Status                       |
| --------------- | ---------------------------- |
| Direct messages | ✅ Supported                 |
| Groups          | ❌ Not supported             |
| Media           | ❌ Not supported             |
| Reactions       | ❌ Not supported             |
| Threads         | ❌ Not supported             |
| Polls           | ❌ Not supported             |
| Native commands | ❌ Not supported             |
| Streaming       | ⚠️ Blocked (single response) |

## Troubleshooting

**No response from the bot:**

- Verify the webhook URL and path in Kakao Skill settings.
- Check gateway logs: `openclaw logs --follow`
- Ensure the DM sender is approved (pairing or allowFrom).

**Webhook returns 409:**

- Multiple Kakao accounts share the same webhook path without a `botId`.
- Set `channels.kakao.botId` or `channels.kakao.accounts.<id>.botId` for disambiguation.

## Configuration reference (Kakao)

Full configuration: [Configuration](/gateway/configuration)

Provider options:

- `channels.kakao.enabled`: enable/disable channel startup.
- `channels.kakao.webhookPath`: webhook path on the gateway HTTP server (default `/kakao/webhook`).
- `channels.kakao.webhookUrl`: optional full URL; path is derived if set.
- `channels.kakao.botId`: optional Kakao bot ID to disambiguate shared webhook paths.
- `channels.kakao.dmPolicy`: `pairing | allowlist | open | disabled` (default: pairing).
- `channels.kakao.allowFrom`: DM allowlist (user IDs). `open` typically uses `"*"`.
- `channels.kakao.responsePrefix`: per-channel response prefix override.

Multi-account options:

- `channels.kakao.accounts.<id>.name`: display name.
- `channels.kakao.accounts.<id>.enabled`: enable/disable account.
- `channels.kakao.accounts.<id>.webhookPath`: per-account webhook path.
- `channels.kakao.accounts.<id>.webhookUrl`: per-account webhook URL.
- `channels.kakao.accounts.<id>.botId`: per-account bot ID.
- `channels.kakao.accounts.<id>.dmPolicy`: per-account DM policy.
- `channels.kakao.accounts.<id>.allowFrom`: per-account allowlist.
- `channels.kakao.accounts.<id>.responsePrefix`: per-account response prefix override.
