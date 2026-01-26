---
name: elevenlabs-voice
description: Phone calls via ElevenLabs Conversational AI + Twilio. Use for voice conversations, outbound calls, SMS, and building AI phone assistants that route through Clawdbot.
---

# ElevenLabs Voice

Voice phone integration using ElevenLabs Conversational AI with Twilio telephony.

## Architecture

```
Phone Call → Twilio → ElevenLabs ConvAI Agent → Webhook → Bridge → Clawdbot
```

The bridge (`scripts/bridge.js`) receives tool calls from ElevenLabs and routes them to Clawdbot's webhook API, giving voice callers full access to your agent's capabilities.

## Quick Start

### 1. Start the bridge
```bash
node ~/path/to/skills/elevenlabs-voice/scripts/bridge.js --port 3001
```

### 2. Expose via tunnel (Cloudflare recommended)
```bash
cloudflared tunnel --url http://localhost:3001
```

### 3. Configure ElevenLabs agent to call your webhook
Set tool webhook URL to: `https://your-tunnel.trycloudflare.com/tool/ask-agent`

## Scripts

### bridge.js - Voice-to-Agent Bridge
Routes voice requests through Clawdbot and returns responses.

```bash
node scripts/bridge.js [--port 3001]
```

**Environment:**
- Reads `~/.clawdbot/clawdbot.json` for webhook token
- Optional: `ELEVENLABS_WEBHOOK_SECRET` for post-call verification

**Endpoints:**
- `POST /tool/ask-agent` - Main tool endpoint for ElevenLabs
- `GET /health` - Health check
- `POST /webhook/post-call` - Post-call webhook (optional)

### call.js - Outbound Calls
Make calls via ElevenLabs + Twilio or direct TwiML.

```bash
# Via ElevenLabs ConvAI (recommended)
source ~/.env  # ELEVENLABS_API_KEY
curl -X POST "https://api.elevenlabs.io/v1/convai/twilio/outbound_call" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "YOUR_AGENT_ID",
    "agent_phone_number_id": "YOUR_PHONE_NUMBER_ID",
    "to_number": "+14155551234"
  }'

# Via direct Twilio (simple TTS message)
node scripts/call.js --to "+14155551234" --message "Hello from your agent"
```

**Environment:**
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

### sms.js - Send SMS
```bash
node scripts/sms.js --to "+14155551234" --body "Hello!"
```

Same Twilio environment variables as call.js.

## Setup

See [references/setup.md](references/setup.md) for complete setup guide covering:
- ElevenLabs Conversational AI agent creation
- Twilio phone number configuration
- Tunnel options (Cloudflare, ngrok, Tailscale)
- Clawdbot webhook configuration

## Troubleshooting

See [references/troubleshooting.md](references/troubleshooting.md) for common issues.

## ElevenLabs Agent Tool Configuration

In your ElevenLabs agent, create a tool with:

**Name:** `ask_agent` (or similar)

**Description:** Ask the AI agent a question. Use for any query requiring real data, memory, or actions.

**Webhook URL:** `https://your-domain.com/tool/ask-agent`

**Parameters:**
```json
{
  "type": "object",
  "properties": {
    "question": {
      "type": "string",
      "description": "The user's question or request"
    }
  },
  "required": ["question"]
}
```
