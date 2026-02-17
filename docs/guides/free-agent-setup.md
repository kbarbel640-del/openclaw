---
title: "Free Agent Setup"
description: "Run OpenClaw agents without paid APIs using Kimi K2.5, DeepSeek, and other free models"
---

# Free Agent Setup

Run powerful AI agents without paying for API access. OpenClaw supports several free or zero-cost model providers out of the box.

## Free Model Providers

| Provider        | Model            | Context Window | API Key Required | Cost  |
| --------------- | ---------------- | -------------- | ---------------- | ----- |
| **Moonshot**    | Kimi K2.5        | 256k tokens    | Yes (free tier)  | $0    |
| **Qwen Portal** | Qwen Coder      | 128k tokens    | OAuth (free)     | $0    |
| **Xiaomi**      | MiMo V2 Flash   | 262k tokens    | Yes (free tier)  | $0    |
| **Qianfan**     | DeepSeek V3.2   | 98k tokens     | Yes (free tier)  | $0    |
| **Ollama**      | Any local model  | 128k tokens    | No               | $0    |

## Quick Start: Kimi K2.5

Kimi K2.5 offers the best balance of capability and cost (free) with a massive 256k context window.

### 1. Get a free API key

Sign up at [platform.moonshot.ai](https://platform.moonshot.ai) and create an API key.

### 2. Configure the agent

Add to `~/.openclaw/openclaw.json`:

```json5
{
  agents: {
    list: [
      {
        id: "free-agent",
        name: "Free Agent",
        model: {
          primary: "moonshot/kimi-k2.5",
          fallbacks: ["qianfan/deepseek-v3.2", "xiaomi/mimo-v2-flash"]
        },
        skills: [
          "blog-publisher",
          "site-deployer",
          "voice-clone",
          "coding-agent",
          "github",
          "canvas"
        ]
      }
    ]
  }
}
```

### 3. Set the API key

```bash
export MOONSHOT_API_KEY="your-key-here"

# Or use auth profiles for persistence:
openclaw auth add moonshot --api-key "your-key-here"
```

### 4. Route a channel to the free agent

```json5
{
  agents: {
    bindings: [
      {
        agentId: "free-agent",
        match: { channel: "telegram" }
      }
    ]
  }
}
```

## Multi-Agent Setup (Free + Paid)

Use free models for routine tasks and paid models for complex reasoning:

```json5
{
  agents: {
    defaults: {
      model: "moonshot/kimi-k2.5"  // default: free
    },
    list: [
      {
        id: "daily",
        name: "Daily Assistant",
        model: "moonshot/kimi-k2.5",
        skills: ["blog-publisher", "site-deployer", "weather", "github"]
      },
      {
        id: "power",
        name: "Power Agent",
        model: {
          primary: "anthropic/claude-opus-4-6",
          fallbacks: ["moonshot/kimi-k2.5"]
        },
        skills: ["coding-agent", "voice-clone", "canvas"]
      }
    ]
  }
}
```

## Local-Only Setup (Ollama)

For fully offline operation with zero API costs:

```json5
{
  agents: {
    list: [
      {
        id: "local",
        name: "Local Agent",
        model: "ollama/llama3.1:70b",
        skills: ["blog-publisher", "site-deployer", "coding-agent"]
      }
    ]
  }
}
```

Requires [Ollama](https://ollama.ai) running locally on port 11434.

## Automation Examples

### Auto-publish blogs with free agent

```bash
# Via Telegram/WhatsApp/Discord:
"Write a blog post about AI agents and publish it to my Hugo site"

# The agent will:
# 1. Generate the content using Kimi K2.5 (free)
# 2. Create the markdown file with proper frontmatter
# 3. Build and verify the site
# 4. Git push to trigger deployment
```

### Deploy a website

```bash
# Via any channel:
"Deploy my project at ~/my-site to Vercel"

# The agent will:
# 1. Detect the framework
# 2. Build the project
# 3. Deploy to the target platform
# 4. Return the live URL
```

### Clone a voice and use it

```bash
# Via any channel:
"Clone the voice from this audio sample and use it for TTS"

# The agent will:
# 1. Upload the sample to ElevenLabs
# 2. Create the voice clone
# 3. Configure OpenClaw to use it for all TTS
```
