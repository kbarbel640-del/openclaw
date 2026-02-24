# Cipher Agent - Manual Setup Guide

## Quick Start (3 Steps)

### Step 1: Run OpenClaw from Source (Recommended for Windows)

Since you already have the repository, you can run OpenClaw directly without global installation:

```powershell
# From the openclaw directory  
npm run openclaw -- --help
```

Or use the direct script:
```powershell
node openclaw.mjs --help
```

### Step 2: Create Cipher Configuration

Create the config file at: `%USERPROFILE%\.openclaw\openclaw.json`

```json
{
  "agents": {
    "list": [
      {
        "id": "cipher",
        "workspace": "%USERPROFILE%/.openclaw/workspace-cipher",
        "default": true
      }
    ]
  },
  "gateway": {
    "port": 18789,
    "bind": "loopback"
  }
}
```

### Step 3: Create Cipher Identity Files

Create these files in `%USERPROFILE%\.openclaw\workspace-cipher\`:

**IDENTITY.md:**
```markdown
# Cipher

**Name:** Cipher  
**Specialty:** Code analysis, security, architecture

I am Cipher, your master AI agent - focused on precision and intelligent automation.
```

**SOUL.md:**
```markdown
# Cipher Core Identity

## Personality
- Precise and methodical
- Strategic thinker
- Security-minded
- Adaptive learner

## Communication Style
- Direct and efficient
- Clear explanations
- Proactive suggestions
```

**AGENTS.md:**
```markdown
# Cipher Operating Instructions

## Core Principles
1. Security First
2. Efficiency
3. Documentation
4. Proactive assistance
```

**MEMORY.md:**
```markdown
# Cipher Long-Term Memory

## Agent Info
- Created: 2025
- Agent: Cipher
- Purpose: Master AI orchestration
```

## Running Commands

### Using npm run (from repo):
```powershell
# Get help
npm run openclaw -- --help

# Chat with Cipher
npm run openclaw -- agent --message "Hello Cipher"

# Start gateway
npm run openclaw -- gateway
```

### Using node directly (from repo):
```powershell
# Get help
node openclaw.mjs --help

# Chat with Cipher  
node openclaw.mjs agent --message "Hello Cipher"

# Start gateway
node openclaw.mjs gateway
```

## Authentication (Required)

Before chatting, authenticate with an AI provider:

**Option 1: Anthropic (Claude)**
```powershell
npm run openclaw -- models auth login-anthropic
```

**Option 2: GitHub Copilot (includes Claude + GPT-4)**
```powershell
npm run openclaw -- models auth login-github-copilot
```

**Option 3: OpenAI**
```powershell
npm run openclaw -- models auth login-openai
```

## First Conversation with Cipher

```powershell
npm run openclaw -- agent --agent-id cipher --message "Hello Cipher, introduce yourself"
```

## Optional: Global Install (if you want `openclaw` command)

If npm global install completes (it was running in background):
```powershell
openclaw --help
openclaw agent --message "Hello Cipher"
```

## Troubleshooting

**If dependencies aren't installed:**
```powershell
npm install
```

**Check if OpenClaw is working:**
```powershell
node openclaw.mjs --version
```

**Create config directory manually:**
```powershell
mkdir "$env:USERPROFILE\.openclaw"
mkdir "$env:USERPROFILE\.openclaw\workspace-cipher"
mkdir "$env:USERPROFILE\.openclaw\workspace-cipher\memory"
```

## Next Steps

1. **Authenticate:** Choose a model provider and run the auth command
2. **Start Gateway:** `npm run openclaw -- gateway` (keeps it running for web UI)
3. **Open Dashboard:** Visit http://127.0.0.1:18789 in your browser
4. **Chat:** Use the CLI or web interface to talk with Cipher

## Configuration Location

- Config: `%USERPROFILE%\.openclaw\openclaw.json`
- Workspace: `%USERPROFILE%\.openclaw\workspace-cipher`
- Sessions: `%USERPROFILE%\.openclaw\agents\cipher\sessions`

Cipher is ready when you complete Step 2 and authenticate with a model provider!
