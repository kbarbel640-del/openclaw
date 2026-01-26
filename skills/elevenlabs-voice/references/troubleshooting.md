# Troubleshooting

Common issues and solutions for ElevenLabs Voice integration.

## Bridge Issues

### "Could not load clawdbot.json"

**Cause:** Bridge can't find Clawdbot config.

**Fix:** Ensure `~/.clawdbot/clawdbot.json` exists with `hooks.token` configured:
```json
{
  "hooks": {
    "enabled": true,
    "token": "your-token"
  }
}
```

### Bridge returns "Something went wrong"

**Check:**
1. Clawdbot gateway running: `curl http://127.0.0.1:18789/health`
2. Hook token matches: compare bridge output with clawdbot.json
3. Bridge logs for detailed errors

### Slow responses (>10s)

**Possible causes:**
- Model is slow (try faster model like Gemini Flash)
- Network latency to tunnel
- Clawdbot doing heavy processing

**Mitigations:**
- Add more instant responses to bridge for common queries
- Use faster LLM in ElevenLabs agent for initial processing
- Check `timeoutSeconds` in hook request

## Tunnel Issues

### Cloudflare tunnel not connecting

```bash
# Check tunnel status
cloudflared tunnel list

# Test direct
curl -v http://localhost:3001/health

# Check logs
cloudflared tunnel run voice --loglevel debug
```

### ngrok URL expired

Free ngrok URLs change on restart. For persistent URLs:
- Upgrade to ngrok paid plan
- Use Cloudflare Tunnel instead
- Use Tailscale Funnel

### Webhook returns 502/504

**Cause:** Tunnel can't reach local bridge.

**Fix:**
1. Verify bridge is running: `curl http://localhost:3001/health`
2. Check port matches tunnel config
3. Ensure no firewall blocking localhost

## ElevenLabs Issues

### Tool not being called

**Cause:** Agent responding without using tool.

**Fix in ElevenLabs agent settings:**
1. Make tool description more explicit: "Use this for ANY question"
2. Add to system prompt: "Always use ask_agent for questions requiring real data"
3. Reduce agent's default knowledge so it relies on tool

### "Error calling tool" in ElevenLabs

**Check:**
1. Webhook URL is correct and reachable
2. Tool returns valid JSON: `{"response": "..."}`
3. Response time < 30 seconds (ElevenLabs timeout)

### Voice cuts off mid-response

**Cause:** Response too long for voice.

**Fix:** Bridge already truncates to 500 chars. If still happening:
- Make system prompt request shorter responses
- Adjust `substring(0, 500)` in bridge.js

## Twilio Issues

### Outbound call fails

```bash
# Test Twilio credentials
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  -d "To=+14155551234" \
  -d "From=$TWILIO_PHONE_NUMBER" \
  -d "Body=Test"
```

**Common errors:**
- `21211`: Invalid phone number format (must be E.164: +14155551234)
- `21608`: Number not SMS capable (for SMS)
- `21214`: To number is invalid for your account (trial restrictions)
- `20003`: Authentication failed (check SID/token)

### Inbound calls don't connect to agent

**Check in Twilio console:**
1. Phone number → Voice Configuration
2. Should point to ElevenLabs (configured via ElevenLabs dashboard)
3. If manual: Webhook URL should be ElevenLabs ConvAI endpoint

## Logs

### Bridge logs
```bash
# If running manually
node bridge.js 2>&1 | tee bridge.log

# If running as service (macOS)
tail -f /tmp/voice-bridge.log

# If running as service (Linux)
journalctl --user -u voice-bridge -f
```

### Clawdbot logs
```bash
clawdbot gateway logs
```

### Tunnel logs
```bash
# Cloudflare
tail -f ~/Library/Logs/cloudflared.log

# ngrok
# Check ngrok web interface at http://127.0.0.1:4040
```

## Quick Diagnostics

Run this to check all components:

```bash
#!/bin/bash
echo "=== Voice System Diagnostics ==="

echo -n "Clawdbot gateway: "
curl -s http://127.0.0.1:18789/health | jq -r '.status // "FAILED"' 2>/dev/null || echo "FAILED"

echo -n "Voice bridge: "
curl -s http://localhost:3001/health | jq -r '.status // "FAILED"' 2>/dev/null || echo "FAILED"

echo -n "Tunnel (if configured): "
curl -s https://your-domain.com/health | jq -r '.status // "FAILED"' 2>/dev/null || echo "NOT CONFIGURED"

echo -n "Twilio creds: "
if [ -n "$TWILIO_ACCOUNT_SID" ] && [ -n "$TWILIO_AUTH_TOKEN" ]; then
  echo "SET"
else
  echo "MISSING"
fi
```
