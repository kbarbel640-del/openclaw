# Brock — Mac Mini Setup Guide

Step-by-step setup for running Brock on a Mac Mini with local GLM-5, z.ai API, and OpenAI backup.

## Prerequisites

- Mac Mini (Apple Silicon recommended — GLM-5 is big)
- macOS 14+ (Sonoma or newer)
- Admin access
- Homebrew installed (`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`)

---

## Step 1: Install System Dependencies

```bash
# Node.js 20+ (openclaw runtime)
brew install node@20

# pnpm (openclaw's package manager)
brew install pnpm

# Git (if not already present)
brew install git
```

---

## Step 2: Install Ollama (Local Model Server)

```bash
# Install Ollama
brew install ollama

# Start the Ollama service (runs on http://localhost:11434)
brew services start ollama

# Verify it's running
curl http://localhost:11434/api/tags
```

---

## Step 3: Pull GLM-5 Locally

GLM-5 is 744B parameters (40B active). The quantized versions are more practical for a Mac Mini:

```bash
# Check available VRAM/RAM first
# GLM-5 full: needs ~80GB+ RAM (not practical on most Mac Minis)
# GLM-5 Q4: needs ~25-30GB RAM (works on 32GB+ Mac Mini)

# Option A: Pull a quantized GLM-5 via Ollama (if available)
ollama pull glm-5

# Option B: If GLM-5 isn't in Ollama's registry yet, use GLM-4.7 as local fast tier
# GLM-4.7 is smaller and still strong
ollama pull glm-4.7

# Option C: If neither fits your hardware, use a smaller model for fast tier
# and rely on z.ai API for the heavy lifting
ollama pull qwen2.5:14b
```

**Check what fits your hardware:**

| Mac Mini RAM | Recommended Local Model      | Notes                          |
|--------------|------------------------------|--------------------------------|
| 16GB         | qwen2.5:7b or glm-4.5-air   | Fast tier only, lean on z.ai   |
| 32GB         | glm-4.7 (quantized)         | Good balance                   |
| 64GB+        | glm-5 (quantized)           | Full local capability          |

Verify the model works:
```bash
ollama run glm-4.7 "Say hello in exactly 5 words"
```

---

## Step 4: Get API Keys

You need two (optionally three) API keys:

### z.ai (Strong Tier — Required)
1. Go to [z.ai console](https://console.z.ai)
2. Create an account / log in
3. Subscribe to the **GLM Coding Plan** (this gives cheaper rates for coding tasks)
4. Go to API Keys → Create new key
5. Save the key somewhere safe

### OpenAI (Backup Tier — Recommended)
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create API key under Settings → API Keys
3. Add billing (pay-as-you-go)
4. Save the key

### Anthropic (Optional Fallback)
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create API key
3. Save the key

---

## Step 5: Clone the Repos

```bash
# Pick a home for Brock's repos
mkdir -p ~/brock && cd ~/brock

# Clone openclaw (the agent framework)
git clone <your-openclaw-fork-url> openclaw
cd openclaw

# Install dependencies
pnpm install

# Go back and clone lobsterBucket (the operational playbook)
cd ~/brock
git clone <your-lobsterBucket-url> lobsterBucket
```

---

## Step 6: Set Up the Workspace

```bash
# Create openclaw's config directory
mkdir -p ~/.openclaw

# Create the workspace directory (where Brock's personality files live)
mkdir -p ~/.openclaw/workspace
```

### Copy Brock's personality files into the workspace:

```bash
# Copy your custom SOUL.md BEFORE first run
# This way bootstrap won't overwrite it with the default template
cp ~/brock/openclaw/docs/personality/brock/SOUL.md ~/.openclaw/workspace/SOUL.md
cp ~/brock/openclaw/docs/personality/brock/IDENTITY.md ~/.openclaw/workspace/IDENTITY.md
```

**Important:** Do NOT copy USER.md — let bootstrap create the template so Brock asks you about yourself on first run. Do NOT set `skipBootstrap: true` — you want the first-run ritual.

---

## Step 7: Configure Environment Variables

```bash
# Create the env file
cat > ~/.openclaw/.env << 'EOF'
# Gateway token (generate a random one)
OPENCLAW_GATEWAY_TOKEN=CHANGE_ME_RUN_openssl_rand_hex_32

# Model provider keys
ZAI_API_KEY=your-z-ai-key-here
OPENAI_API_KEY=your-openai-key-here
# ANTHROPIC_API_KEY=your-anthropic-key-here  # uncomment if using

# Channel tokens (add as you connect channels)
# TELEGRAM_BOT_TOKEN=
# DISCORD_BOT_TOKEN=
EOF

# Generate a real gateway token
TOKEN=$(openssl rand -hex 32)
sed -i '' "s/CHANGE_ME_RUN_openssl_rand_hex_32/$TOKEN/" ~/.openclaw/.env

# Lock down permissions
chmod 600 ~/.openclaw/.env
```

---

## Step 8: Configure openclaw.json

Create `~/.openclaw/openclaw.json`:

```json5
{
  // ── Model Providers ──────────────────────────────────────────
  "models": {
    "mode": "merge",
    "providers": {
      // Fast tier: local Ollama
      "local": {
        "baseUrl": "http://localhost:11434/v1",
        "api": "ollama",
        "models": [
          {
            "id": "glm-4.7",            // change to match what you pulled in Step 3
            "name": "GLM-4.7 (local)",
            "reasoning": true,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 131072,
            "maxTokens": 8192
          }
        ]
      },
      // Strong tier: z.ai API
      "zai": {
        "baseUrl": "https://api.z.ai/api/coding/paas/v4",
        "api": "openai-completions",
        "auth": "api-key",
        "apiKey": "${ZAI_API_KEY}",
        "models": [
          {
            "id": "glm-5",
            "name": "GLM-5 (z.ai)",
            "reasoning": true,
            "input": ["text", "image"],
            "cost": { "input": 0.002, "output": 0.006, "cacheRead": 0.001, "cacheWrite": 0.002 },
            "contextWindow": 131072,
            "maxTokens": 16384
          }
        ]
      }
    }
  },

  // ── Agent Defaults ───────────────────────────────────────────
  "agents": {
    "defaults": {
      "workspace": "~/.openclaw/workspace",
      "model": {
        "primary": "zai/glm-5",
        "fallbacks": ["local/glm-4.7", "openai/gpt-4o"]
      },
      "models": {
        "zai/glm-5":    { "alias": "glm5",  "streaming": true },
        "local/glm-4.7": { "alias": "local", "streaming": true },
        "openai/gpt-4o": { "alias": "gpt",   "streaming": true }
      }
    }
  }
}
```

> **Tip:** The reference config at `configs/model_config.json` in this repo has the full version with all three tiers and routing notes. Use it as a reference if you want to customize further.

---

## Step 9: First Run (Bootstrap)

```bash
cd ~/brock/openclaw

# Start openclaw
pnpm start
```

**What happens on first run:**
1. openclaw detects the workspace at `~/.openclaw/workspace/`
2. It finds your pre-placed SOUL.md and IDENTITY.md (keeps them)
3. It creates the missing template files: AGENTS.md, TOOLS.md, USER.md, HEARTBEAT.md
4. It creates BOOTSTRAP.md (the first-run ritual)
5. Brock starts his first session with BOOTSTRAP.md injected into context
6. He'll say something like: *"Hey. I just came online..."*
7. You talk through identity, preferences, and how you want to work together
8. Brock updates USER.md and IDENTITY.md based on the conversation
9. When done, Brock deletes BOOTSTRAP.md — bootstrap is complete

**Your SOUL.md is already there**, so Brock has his personality from the start. The bootstrap ritual fills in the relational details (who you are, how you work, channel preferences).

---

## Step 10: Verify Everything Works

```bash
# Check Ollama is serving
curl -s http://localhost:11434/api/tags | python3 -m json.tool

# Check openclaw gateway is up
curl -s http://localhost:3000/health   # adjust port if different

# Check z.ai connectivity (quick test)
curl -s https://api.z.ai/api/coding/paas/v4/models \
  -H "Authorization: Bearer $ZAI_API_KEY" | python3 -m json.tool
```

---

## Credentials & Account Access

### Where do credentials live?

**openclaw** manages all credential storage and authentication:

| What | Where | How |
|------|-------|-----|
| Model API keys (z.ai, OpenAI, Anthropic) | `~/.openclaw/.env` | Env vars, loaded on startup |
| Gmail OAuth tokens | `~/.openclaw/agents/<id>/agent/auth-profiles.json` | OAuth flow, managed by openclaw |
| GitHub tokens | `auth-profiles.json` | Device code flow or PAT |
| iCloud / iMessage | macOS system Keychain | `imsg` CLI uses system auth |
| Channel tokens (Telegram, Discord, etc.) | `~/.openclaw/.env` | Bot tokens as env vars |

**lobsterBucket** stores the *rules* about when and how Brock uses those accounts (e.g., "only send email during business hours", "never auto-reply in group chats"). It does NOT store credentials.

### How to give Brock access to accounts

**Gmail:**
```bash
# openclaw walks you through Gmail OAuth on first use
# Or configure manually:
# 1. Create OAuth credentials at console.cloud.google.com
# 2. Enable Gmail API
# 3. Run: openclaw auth add gmail
# 4. Complete the browser OAuth flow
# Token is stored in auth-profiles.json automatically
```

**GitHub:**
```bash
# Option A: Device code flow (recommended)
openclaw auth add github

# Option B: Personal access token
# Create at github.com/settings/tokens
# Add to .env: GITHUB_TOKEN=ghp_...
```

**iCloud / iMessage:**
- Uses macOS system credentials — log into iCloud on the Mac Mini normally
- openclaw's `imsg` CLI reads from Keychain
- No separate credential setup needed

**Passwords / Usernames / Phone Numbers:**
- Do NOT put raw passwords in config files
- For services that need username/password (not OAuth), use the macOS Keychain:
  ```bash
  # Store a credential in Keychain
  security add-generic-password -a "brock-gmail" -s "gmail" -w "the-password" -T ""

  # openclaw can access Keychain entries via the exec tool
  ```
- Or store references in `auth-profiles.json` and let Brock look them up at runtime

---

## Phone Number Forwarding (Chinese Number Behind GFW)

### The Problem

You have a Chinese phone number bound to some of Brock's accounts (for 2FA, SMS verification, etc.). Brock needs to receive SMS from that number and potentially use it for verification tasks. The number is behind the Great Firewall.

### Where This Config Lives

- **Forwarding relay config** → **openclaw** (`openclaw.json` plugins section)
- **Rules about when Brock can use the number** → **lobsterBucket** (`GOVERNANCE.md` or `PLAYBOOK.md`)

### Architecture Options

**Option A: SMS-to-Webhook Relay (Recommended)**

Run a lightweight SMS relay inside China that forwards incoming SMS to Brock via webhook:

```
[Chinese Phone] → [SMS Relay App on Chinese Server/Phone]
                         ↓ (HTTPS POST via tunnel)
                   [Brock's Mac Mini / openclaw webhook]
```

Setup:
1. Use an Android phone or cheap cloud instance in China with a SIM reader
2. Run an SMS relay app (e.g., SmsForwarder, Tasker + AutoRemote, or a custom script)
3. Forward SMS to a webhook endpoint on Brock's side
4. Use a tunnel that works behind the GFW (options below)

**Tunnel options that work behind the GFW:**
- **Cloudflare Tunnel** (free tier) — generally works, but can be intermittent
- **Tailscale** — works well if both ends can reach the coordination server
- **WireGuard to a VPS in HK/SG** — most reliable, you control the endpoint
- **frp (fast reverse proxy)** — popular in China, self-hosted, works behind GFW

**Option B: Twilio/Telnyx with Chinese Number**

Some providers can provision Chinese numbers, but:
- Regulatory requirements are strict (business registration, ICP filing)
- Costs are higher
- Probably not worth it for a personal setup

**Option C: Number Porting / Virtual Number**

If you only need the number for receiving 2FA codes:
- Port the Chinese number to a service like DingTalk or WeChat (if supported)
- Use their API to forward verification codes
- Most 2FA services send codes that are short-lived, so latency matters

### openclaw Configuration for SMS Webhook

In `~/.openclaw/openclaw.json`:

```json5
{
  "plugins": {
    "entries": {
      "voice-call": {
        "enabled": true,
        "config": {
          // For outbound (if Brock needs to send SMS)
          "provider": "twilio",  // or "telnyx"
          "twilio": {
            "accountSid": "${TWILIO_ACCOUNT_SID}",
            "authToken": "${TWILIO_AUTH_TOKEN}"
          },
          "fromNumber": "+1XXXXXXXXXX"  // your Twilio number (non-Chinese)
        }
      }
    }
  },

  // For inbound SMS from the Chinese number:
  // Configure a webhook channel or custom hook
  "hooks": {
    "sms-relay": {
      "enabled": true,
      "url": "http://localhost:3000/hooks/sms-inbound",
      "secret": "${SMS_RELAY_SECRET}"
    }
  }
}
```

### lobsterBucket Rules

In `~/lobsterBucket/GOVERNANCE.md` or `PLAYBOOK.md`:

```markdown
## Phone Number Usage

- Chinese number (+86 XXX) is for RECEIVING only — 2FA codes, verification SMS
- Do NOT use it for outbound calls or messages
- If a 2FA code arrives, use it within 60 seconds (they expire)
- If the relay is down, alert the user — do not retry endlessly
- Never share the phone number with external services without approval
```

---

## Directory Layout (After Setup)

```
~/brock/
├── openclaw/              ← Agent framework (this repo)
│   ├── docs/personality/brock/
│   │   ├── SOUL.md        ← Personality source (version controlled)
│   │   ├── IDENTITY.md    ← Identity source (version controlled)
│   │   └── PERSONALITY-GUIDE.md
│   └── configs/
│       └── model_config.json  ← Reference model config
│
├── lobsterBucket/         ← Operational playbook
│   ├── PLAYBOOK.md        ← Decision authority & constraints
│   ├── GOVERNANCE.md      ← Rules, permissions, boundaries
│   ├── skills/            ← Skill definitions
│   ├── runbooks/          ← Operational runbooks
│   └── configs/           ← Job filters, automations
│
~/.openclaw/
├── openclaw.json          ← Main config (active, not version controlled)
├── .env                   ← Secrets (never committed)
├── workspace/             ← Brock's live workspace
│   ├── SOUL.md            ← Active personality (copied from repo, evolves)
│   ├── IDENTITY.md        ← Active identity
│   ├── USER.md            ← Your profile (created during bootstrap)
│   ├── AGENTS.md          ← Operating instructions
│   ├── TOOLS.md           ← Environment notes
│   ├── HEARTBEAT.md       ← Heartbeat checklist
│   ├── MEMORY.md          ← Long-term curated memory (grows over time)
│   ├── memory/            ← Daily logs (YYYY-MM-DD.md)
│   └── skills/            ← Workspace-specific skills
└── agents/
    └── <agentId>/
        └── agent/
            ├── auth-profiles.json  ← Credentials (auto-managed)
            └── sessions/           ← Session transcripts
```

---

## Troubleshooting

**Ollama not responding:**
```bash
brew services restart ollama
# Check logs
tail -f ~/.ollama/logs/server.log
```

**Model too slow / out of memory:**
```bash
# Check memory usage
ollama ps
# Switch to a smaller model in openclaw.json
# Change local/glm-5 → local/qwen2.5:14b (or whatever fits)
```

**z.ai API errors:**
```bash
# Test the key directly
curl https://api.z.ai/api/coding/paas/v4/models \
  -H "Authorization: Bearer $ZAI_API_KEY"
# Common issues: expired key, wrong plan, rate limit
```

**Bootstrap didn't trigger:**
- Check if `~/.openclaw/workspace/.openclaw/workspace-state.json` has `onboardingCompletedAt` set
- If so, delete the state file and restart
- Or manually place BOOTSTRAP.md: `cp docs/reference/templates/BOOTSTRAP.md ~/.openclaw/workspace/BOOTSTRAP.md`

**SOUL.md got overwritten with template:**
- This shouldn't happen (openclaw uses write-exclusive), but if it does:
  ```bash
  cp ~/brock/openclaw/docs/personality/brock/SOUL.md ~/.openclaw/workspace/SOUL.md
  ```

**Brock is too generic / personality drifting (local model):**
- Local models need more reinforcement than cloud APIs
- Make SOUL.md more direct: repeat key rules, add negative examples
- Consider using z.ai as primary and local only for simple tasks
