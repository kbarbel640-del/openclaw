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

# Model provider keys (see CLOUD_STRATEGY.md for tier details)
ZAI_API_KEY=your-z-ai-key-here          # Code tier: z.ai GLM-5
DEEPSEEK_API_KEY=your-deepseek-key-here  # Bulk tier: DeepSeek V3.2
MOONSHOT_API_KEY=your-moonshot-key-here  # Reasoning tier: Kimi K2 Thinking
OPENAI_API_KEY=your-openai-key-here      # Fallback tier: GPT-4o / o3

# Channel tokens (add as you connect channels)
# TELEGRAM_BOT_TOKEN=

# Discord (see configs/discord_brock.json for full channel config)
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_APPLICATION_ID=your-discord-app-id
DISCORD_GUILD_ID=your-discord-server-id
DISCORD_AUTHORIZED_USERS=comma,separated,user,ids
# Outbound webhooks for scheduled/automated posting
DISCORD_WEBHOOK_ALERTS=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_DEV=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_CONTENT=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_DAILY=https://discord.com/api/webhooks/...
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

#### Gmail

```bash
# Option A: Let openclaw walk you through it (recommended)
openclaw auth add gmail

# Option B: Manual setup
# 1. Go to console.cloud.google.com → APIs & Services → Credentials
# 2. Create OAuth 2.0 Client ID (type: Desktop App)
# 3. Enable the Gmail API (APIs & Services → Library → search "Gmail API" → Enable)
# 4. Download the client credentials JSON
# 5. Run: openclaw auth add gmail --credentials-file ~/Downloads/client_secret_xxx.json
# 6. A browser window opens — sign in with the Gmail account you want Brock to use
# 7. Approve the permissions (read, send, manage labels — whatever you want him to have)
# 8. Token is stored in auth-profiles.json automatically
```

To store the Gmail **password** itself (for services that need it, like IMAP or app-specific logins):

```bash
# Store Gmail credentials in macOS Keychain
security add-generic-password \
  -a "brock@gmail.com" \
  -s "brock-gmail" \
  -l "Brock Gmail" \
  -w
# ↑ The -w flag with no argument prompts you to type the password interactively
#   (it won't appear in terminal history)

# Verify it was saved
security find-generic-password -a "brock@gmail.com" -s "brock-gmail"
```

#### GitHub

```bash
# Option A: Device code flow (recommended — no password stored)
openclaw auth add github
# Follow the prompts: go to github.com/login/device, enter the code shown

# Option B: Personal access token
# 1. Go to github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens
# 2. Create token with the repos/permissions Brock needs
# 3. Store it:
security add-generic-password \
  -a "brock-github" \
  -s "brock-github-pat" \
  -l "Brock GitHub PAT" \
  -w
# Paste the token when prompted

# Also add to .env so openclaw can use it directly:
echo 'GITHUB_TOKEN=ghp_yourTokenHere' >> ~/.openclaw/.env
```

#### iCloud / iMessage

iCloud uses the macOS system Keychain — there's no separate credential to configure.

```bash
# Step 1: Sign into iCloud on the Mac Mini
# System Settings → Apple ID → Sign in with the Apple ID you want Brock to use
# This stores the credentials in the system Keychain automatically

# Step 2: Enable iMessage
# Open Messages.app → Settings → iMessage → Sign in (if not already)
# This registers the Mac Mini for iMessage delivery

# Step 3: Verify openclaw can reach it
# openclaw uses the `imsg` CLI which reads from the system Messages database
# No additional password storage needed — it piggybacks on the signed-in session

# If you want Brock to have his OWN Apple ID (separate from yours):
# 1. Create a new Apple ID at appleid.apple.com
# 2. Sign into that Apple ID on the Mac Mini
# 3. Note: a Mac can only be signed into ONE iCloud account at a time
#    If you need your personal iCloud too, consider using a separate macOS user account
```

To store the iCloud **password** for reference (e.g., if Brock needs to re-auth):

```bash
security add-generic-password \
  -a "brock@icloud.com" \
  -s "brock-icloud" \
  -l "Brock iCloud" \
  -w
# Type the password when prompted
```

#### Storing Any Username / Password / Phone Number

**Rule: NEVER put raw passwords in config files, .env, or git.**

Use macOS Keychain for everything. Here's the pattern:

```bash
# ── Store a credential ──────────────────────────────────────────

# Generic pattern:
security add-generic-password \
  -a "<account-identifier>" \   # e.g., email address, username
  -s "<service-name>" \         # e.g., "brock-gmail", "brock-github"
  -l "<human-readable-label>" \ # e.g., "Brock Gmail Password"
  -w                            # prompts for password (no shell history)

# Examples:

# Gmail password
security add-generic-password -a "brock@gmail.com" -s "brock-gmail" -l "Brock Gmail" -w

# GitHub PAT
security add-generic-password -a "brock-github" -s "brock-github-pat" -l "Brock GitHub" -w

# iCloud password
security add-generic-password -a "brock@icloud.com" -s "brock-icloud" -l "Brock iCloud" -w

# Phone number (for reference — not really a "secret" but keeps it out of configs)
security add-generic-password -a "brock-phone-cn" -s "brock-phone-china" -l "Brock CN Phone" -w
# When prompted, type: +8613812345678

# Any other service (generic pattern)
security add-generic-password -a "brock" -s "brock-<service>" -l "Brock <Service>" -w


# ── Retrieve a credential ──────────────────────────────────────

# Show metadata (no password)
security find-generic-password -a "brock@gmail.com" -s "brock-gmail"

# Show metadata AND password (prints to terminal — careful)
security find-generic-password -a "brock@gmail.com" -s "brock-gmail" -w

# Brock can retrieve these at runtime via openclaw's exec tool:
#   exec: security find-generic-password -a "brock@gmail.com" -s "brock-gmail" -w
# (This is how he accesses credentials when he needs them for a task)


# ── Update a credential ────────────────────────────────────────

# Delete the old one, then add the new one
security delete-generic-password -a "brock@gmail.com" -s "brock-gmail"
security add-generic-password -a "brock@gmail.com" -s "brock-gmail" -l "Brock Gmail" -w


# ── List all of Brock's credentials ────────────────────────────

security dump-keychain | grep -A 5 "brock-"
```

**Summary of what to store:**

| Credential | Account (`-a`) | Service (`-s`) | Notes |
|------------|----------------|----------------|-------|
| Gmail password | `brock@gmail.com` | `brock-gmail` | For IMAP/app-password if needed |
| Gmail app password | `brock@gmail.com` | `brock-gmail-app` | If using 2FA, generate at myaccount.google.com |
| GitHub PAT | `brock-github` | `brock-github-pat` | Fine-grained token |
| iCloud password | `brock@icloud.com` | `brock-icloud` | For re-auth if session expires |
| Chinese phone # | `brock-phone-cn` | `brock-phone-china` | +86 number for SMS relay |
| z.ai API key | `brock-zai` | `brock-zai-api` | Backup; primary is in .env |
| OpenAI API key | `brock-openai` | `brock-openai-api` | Backup; primary is in .env |

**How Brock accesses these at runtime:**

openclaw's `exec` tool can run `security find-generic-password -w` to retrieve any stored credential. This means:
- Brock runs a shell command to fetch the password
- It's never stored in openclaw's config or memory files
- The credential exists only in Keychain (encrypted, locked to the Mac Mini's login)
- If the Mac Mini is locked/rebooted, Keychain access requires the login password

**Important:** In `lobsterBucket/GOVERNANCE.md`, add rules about which credentials Brock can access autonomously vs. which require your approval. For example:
```markdown
## Credential Access Rules
- GitHub PAT: autonomous (for code tasks)
- Gmail: autonomous for reading, ask before sending
- iCloud: ask before any action
- Phone number: receive-only, never share externally
```

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
