# OpenClaw Kakao Channel Plugin

This plugin wires a KakaoTalk Skill webhook to OpenClaw. It extracts `userRequest.utterance`, sends it to the agent, and replies using Kakao's callback URL.

**Prereqs**
1. OpenClaw gateway running locally.
1. A public HTTPS URL (ngrok, Cloudflare Tunnel, etc.) that forwards to the gateway port.
1. A Google Gemini API key in the shell where you run the gateway: `export GEMINI_API_KEY="..."`.

**1) Enable the plugin**
```bash
pnpm openclaw plugins enable kakao
```

**2) Configure the Kakao channel**
Use either the default webhook path or provide your own.

Default path (recommended):
```bash
pnpm openclaw config set channels.kakao.webhookPath "/kakao/webhook"
```

Allow all users (skip pairing/allowlist):
```bash
pnpm openclaw config set channels.kakao.dmPolicy "open"
pnpm openclaw config set channels.kakao.allowFrom "[\"*\"]"
```

If you want a stricter policy:
```bash
pnpm openclaw config set channels.kakao.dmPolicy "pairing"
```

**3) Start the gateway**
Pick a port that your tunnel will forward to:
```bash
pnpm openclaw gateway --port 8400 --bind loopback
```

**4) Start a tunnel**
Example with ngrok:
```bash
ngrok http 8400
```

**5) Configure Kakao i Open Builder**
In your Kakao Skill settings:
1. Set the skill webhook URL to `https://<your-tunnel-host>/kakao/webhook`
1. Method: `POST`
1. Content type: `application/json`

**6) Test with curl**
```bash
curl -X POST https://<your-tunnel-host>/kakao/webhook \
  -H "Content-Type: application/json" \
  -d '{"userRequest":{"utterance":"안녕","user":{"id":"test-user"}}}'
```

You should see a JSON response similar to:
```json
{
  "version": "2.0",
  "useCallback": true,
  "data": { "text": "처리중입니다." },
  "template": { "outputs": [] }
}
```
The final reply is delivered to Kakao through the `callbackUrl`.

**Model selection**
Set the gateway default model to Gemini Flash (preview):
```bash
pnpm openclaw config set agents.defaults.model.primary "google/gemini-3-flash-preview"
```
If you use `gemini-2.5-flash`, it is treated as a legacy alias and resolves to the Gemini 3 Flash tier.

**Pairing/allowlist notes**
1. `dmPolicy=pairing` will return a pairing code on first contact.
1. Approve with: `openclaw pairing approve kakao <code>`.
1. `dmPolicy=allowlist` requires `allowFrom` to contain Kakao user IDs.

**Multi-account setup**
```bash
pnpm openclaw config set channels.kakao.accounts.default.botId "YOUR_BOT_ID"
pnpm openclaw config set channels.kakao.defaultAccount "default"
```

**Common logs**
1. `[kakao] inbound utterance="..." userId="..."`
1. `[kakao] deliver payload text len=...`
1. `[kakao] callback response ok`
