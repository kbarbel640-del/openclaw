---
summary: "WhatsApp Call plugin — outbound AI voice calls via WATI or Meta Graph API"
read_when:
  - Working on WhatsApp Call channel features
  - Setting up outbound voice calls via WhatsApp
title: "WhatsApp Call"
---

# WhatsApp Call (plugin)

Make outbound AI voice calls over WhatsApp using WebRTC.

Two backend providers are supported:

| Provider           | Requirement                                     |
| ------------------ | ----------------------------------------------- |
| **WATI**           | WATI account with Calling API enabled           |
| **Meta Graph API** | Business number with 2,000+ daily conversations |

## Plugin required

WhatsApp Call ships as a plugin and is not bundled with the core install.

Install via CLI (npm registry):

```bash
openclaw plugins install @openclaw/whatsapp-call
```

Local checkout (when running from a git repo):

```bash
openclaw plugins install ./extensions/whatsapp-call
```

If you choose WhatsApp Call during configure/onboarding and a git checkout is detected,
OpenClaw will offer the local install path automatically.

Details: [Plugins](/tools/plugin)

## Quick setup

1. Install the WhatsApp Call plugin.
2. Run `openclaw channels add --channel whatsappcall` and follow the prompts.
3. Choose your provider (WATI or Meta Graph API) and enter the credentials.
4. Provide an OpenAI API key (for Realtime voice).
5. Optionally add Twilio TURN server credentials for NAT traversal.
6. Start the gateway.

## Configuration

Minimal config (WATI):

```yaml
channels:
  whatsappcall:
    enabled: true
    provider: wati
    watiTenantId: "YOUR_TENANT_ID"
    watiApiToken: "Bearer YOUR_TOKEN"
    watiBaseUrl: "https://live-mt-server.wati.io"
    openaiApiKey: "sk-..."
```

Minimal config (Meta Graph API):

```yaml
channels:
  whatsappcall:
    enabled: true
    provider: meta
    metaPhoneNumberId: "YOUR_PHONE_NUMBER_ID"
    metaAccessToken: "YOUR_ACCESS_TOKEN"
    openaiApiKey: "sk-..."
```

### All options

| Key                 | Description                            | Required |
| ------------------- | -------------------------------------- | -------- |
| `provider`          | `wati` or `meta`                       | yes      |
| `watiTenantId`      | WATI tenant ID (from dashboard URL)    | WATI     |
| `watiApiToken`      | WATI API token (from Integrations)     | WATI     |
| `watiBaseUrl`       | WATI API base URL                      | WATI     |
| `metaPhoneNumberId` | Meta phone number ID                   | Meta     |
| `metaAccessToken`   | Meta system user access token          | Meta     |
| `openaiApiKey`      | OpenAI API key for Realtime voice      | yes      |
| `openaiModel`       | OpenAI model override                  | no       |
| `voice`             | Voice ID for TTS                       | no       |
| `voiceSpeed`        | Playback speed multiplier              | no       |
| `voiceLanguage`     | Language code (e.g. `en`, `zh`)        | no       |
| `voiceGreeting`     | Greeting spoken when call connects     | no       |
| `voiceInstructions` | System prompt for the AI agent         | no       |
| `twilioAccountSid`  | Twilio SID for TURN servers            | no       |
| `twilioAuthToken`   | Twilio auth token for TURN             | no       |
| `webhookUrl`        | Public URL for Meta webhooks           | Meta     |
| `serviceUrl`        | Remote voice service URL (hosted mode) | no       |

## Remote (hosted) mode

Instead of running the voice service locally, you can point to a remote service:

```yaml
channels:
  whatsappcall:
    enabled: true
    serviceUrl: "https://your-voice-service.example.com"
```

In this mode, the plugin sends HTTP requests to the remote service and does not
start an in-process WebRTC bridge or webhook server.

## Agent tool

Once configured, the agent gains a `whatsapp_call` tool that can initiate outbound
voice calls. The agent can use this tool to call users directly from a conversation.

## How it works

1. The plugin generates a WebRTC SDP offer with ICE candidates.
2. The offer is sent to WhatsApp via WATI or Meta Graph API.
3. WhatsApp rings the recipient and returns an SDP answer via webhook.
4. A peer-to-peer audio connection is established over WebRTC.
5. OpenAI Realtime processes the audio bidirectionally.

## Permissions

WhatsApp requires explicit user consent before a business can call them.
The plugin automatically checks and requests permissions via the provider API.
If permission has not been granted, the user receives a permission request message
on WhatsApp and must accept it before the call can proceed.
