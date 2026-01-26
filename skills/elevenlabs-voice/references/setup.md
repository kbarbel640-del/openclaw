# ElevenLabs Voice Setup Guide

Complete guide to setting up ElevenLabs Conversational AI with Twilio telephony for Clawdbot.

## Prerequisites

- Clawdbot running with webhooks enabled
- ElevenLabs account (Creator+ plan for phone features)
- Twilio account with phone number
- Tunnel solution (Cloudflare, ngrok, or similar)

## Step 1: Configure Clawdbot Webhooks

Ensure your `~/.clawdbot/clawdbot.json` has webhooks enabled:

```json
{
  "hooks": {
    "enabled": true,
    "token": "your-secure-token-here",
    "path": "/hooks"
  }
}
```

Restart Clawdbot gateway after changes:
```bash
clawdbot gateway restart
```

## Step 2: Set Up Twilio

### Get a Phone Number

1. Sign up at [twilio.com](https://www.twilio.com)
2. Buy a phone number with Voice capabilities
3. Note your Account SID and Auth Token from the dashboard

### Configure Environment

```bash
export TWILIO_ACCOUNT_SID="ACxxxxxxxxxx"
export TWILIO_AUTH_TOKEN="your-auth-token"
export TWILIO_PHONE_NUMBER="+14155551234"
```

Add to your shell profile or `.env` file.

## Step 3: Create ElevenLabs Conversational AI Agent

### Create the Agent

1. Go to [ElevenLabs Conversational AI](https://elevenlabs.io/conversational-ai)
2. Create a new agent
3. Configure:
   - **Name**: Your assistant name
   - **Voice**: Choose a voice
   - **LLM**: Gemini 2.0 Flash (fast) or Claude (smart)
   - **System prompt**: Keep it minimal - the real brain is Clawdbot

Example system prompt:
```
You are a voice assistant. For any question requiring real information, memory, or actions, use the ask_agent tool. Keep responses brief and conversational.
```

### Add the Tool

Create a tool to route queries to Clawdbot:

**Name:** `ask_agent`

**Description:** Ask the AI agent a question. Use this for ANY query that needs real data, context, memory, calendar, messages, web search, or any action.

**Webhook URL:** `https://your-tunnel-domain.com/tool/ask-agent`

**Method:** POST

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

### Connect Phone Number

1. In ElevenLabs, go to agent settings → Phone
2. Click "Connect Twilio"
3. Enter your Twilio Account SID and Auth Token
4. Select your phone number
5. Save

## Step 4: Set Up Tunnel

The bridge needs to be reachable from the internet. Choose one:

### Option A: Cloudflare Tunnel (Recommended)

Best for production - stable, free, custom domains.

```bash
# Install
brew install cloudflared

# Quick tunnel (temporary URL)
cloudflared tunnel --url http://localhost:3001

# Or create named tunnel for permanent domain
cloudflared tunnel create voice
cloudflared tunnel route dns voice your-subdomain.yourdomain.com
```

Create `~/.cloudflared/config.yml`:
```yaml
tunnel: your-tunnel-id
credentials-file: ~/.cloudflared/your-tunnel-id.json

ingress:
  - hostname: voice.yourdomain.com
    service: http://localhost:3001
  - service: http_status:404
```

Run: `cloudflared tunnel run voice`

### Option B: ngrok

Quick setup, but URLs expire on free tier.

```bash
# Install
brew install ngrok

# Run
ngrok http 3001
```

Use the generated URL (e.g., `https://abc123.ngrok.io`)

### Option C: Tailscale Funnel

Good if you already use Tailscale.

```bash
tailscale funnel 3001
```

## Step 5: Start the Bridge

```bash
# Basic
node path/to/skills/elevenlabs-voice/scripts/bridge.js

# With custom port
node bridge.js --port 3001

# With environment
CLAWDBOT_URL=http://127.0.0.1:18789 node bridge.js
```

### Run as Service (macOS)

Create `~/Library/LaunchAgents/com.clawdbot.voice-bridge.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.clawdbot.voice-bridge</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/path/to/skills/elevenlabs-voice/scripts/bridge.js</string>
        <string>--port</string>
        <string>3001</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/voice-bridge.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/voice-bridge.log</string>
</dict>
</plist>
```

Load: `launchctl load ~/Library/LaunchAgents/com.clawdbot.voice-bridge.plist`

### Run as Service (Linux/systemd)

Create `/etc/systemd/user/voice-bridge.service`:
```ini
[Unit]
Description=Clawdbot Voice Bridge
After=network.target

[Service]
ExecStart=/usr/bin/node /path/to/bridge.js --port 3001
Restart=always
Environment=CLAWDBOT_URL=http://127.0.0.1:18789

[Install]
WantedBy=default.target
```

Enable: `systemctl --user enable --now voice-bridge`

## Step 6: Test

### Test Bridge Health
```bash
curl http://localhost:3001/health
```

### Test Webhook
```bash
curl -X POST https://your-tunnel-domain.com/tool/ask-agent \
  -H "Content-Type: application/json" \
  -d '{"question": "What time is it?", "conversation_id": "test"}'
```

### Make a Test Call

Call your Twilio number and talk to your agent!

## Making Outbound Calls

### Via ElevenLabs API (Recommended)

```bash
curl -X POST "https://api.elevenlabs.io/v1/convai/twilio/outbound_call" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "your-agent-id",
    "agent_phone_number_id": "your-phone-number-id",
    "to_number": "+14155551234"
  }'
```

Get your agent_id and phone_number_id from the ElevenLabs dashboard.

### Via Direct Twilio (Simple TTS)

```bash
node scripts/call.js --to "+14155551234" --message "Hello, this is a reminder"
```

## Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Yes | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Yes | Your Twilio phone number |
| `ELEVENLABS_API_KEY` | For outbound | ElevenLabs API key |
| `CLAWDBOT_URL` | No | Clawdbot gateway URL (default: http://127.0.0.1:18789) |
| `ELEVENLABS_WEBHOOK_SECRET` | No | HMAC secret for webhook verification |
