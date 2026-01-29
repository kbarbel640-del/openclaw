---
summary: "Configure Pollinations.ai (Free/Open Source API)"
---

# Pollinations.ai

Pollinations.ai provides AI API access with OpenAI-compatible endpoints. It supports various models including OpenAI's GPT series, Qwen, and Mistral.

## Usage

You can configure Pollinations interactively during onboarding:

```bash
moltbot onboard --auth-choice pollinations
```

Or configure it manually in your `moltbot.json` config file.

## Configuration

Pollinations uses a standard OpenAI-compatible endpoint. While it may offer a limited free tier, obtaining an API key is recommended for reliable access.

### Config snippet

```javascript
// moltbot.json (partial)
{
  env: {
    // Set your Pollinations API key here (sk-...)
    POLLINATIONS_API_KEY: "sk-..." 
  },
  agents: {
    defaults: {
      model: { primary: "pollinations/openai" },
      // Optional: alias for easier switching
      models: {
        "pollinations/openai": { alias: "Pollinations GPT-5 Mini" }
      }
    }
  },
  models: {
    providers: {
      pollinations: {
        baseUrl: "https://gen.pollinations.ai/v1",
        api: "openai-completions",
        apiKey: "${POLLINATIONS_API_KEY}",
        models: [
          {
            id: "openai",
            name: "OpenAI GPT-5 Mini",
            contextWindow: 128000,
            maxTokens: 8192
          },
          // ... other models
        ]
      }
    }
  }
}
```

## Available Models

Pollinations offers a wide range of models. Common ones include:

- `pollinations/openai`: **GPT-5 Mini** (0.15/0.60 Pollen/M)
- `pollinations/openai-large`: **GPT-5.2** (1.75/14.0 Pollen/M)
- `pollinations/openai-fast`: **GPT-5 Nano** (0.06/0.44 Pollen/M)
- `pollinations/claude`: **Claude Sonnet 4.5** (3.0/15.0 Pollen/M)
- `pollinations/claude-large`: **Claude Opus 4.5** (5.0/25.0 Pollen/M)
- `pollinations/claude-fast`: **Claude Haiku 4.5** (1.0/5.0 Pollen/M)
- `pollinations/gemini`: **Gemini 3 Flash** (0.5/3.0 Pollen/M)
- `pollinations/gemini-large`: **Gemini 3 Pro** (2.0/12.0 Pollen/M)
- `pollinations/gemini-fast`: **Gemini 2.5 Flash Lite** (0.1/0.4 Pollen/M)
- `pollinations/qwen-coder`: **Qwen3 Coder 30B** (0.06/0.22 Pollen/M)
- `pollinations/mistral`: **Mistral Small 3.2 24B** (0.15/0.35 Pollen/M)
- `pollinations/deepseek`: **DeepSeek V3.2** (0.57/1.68 Pollen/M)
- `pollinations/grok`: **xAI Grok 4 Fast** (0.2/0.5 Pollen/M)
- `pollinations/perplexity-fast`: **Perplexity Sonar** (1.0/1.0 Pollen/M)
- `pollinations/nova-fast`: **Amazon Nova Micro** (0.04/0.15 Pollen/M)

*Costs are per million tokens (Input/Output). Prices subject to change.*

## Notes

- **API Key**: An API key is required. Get one at [enter.pollinations.ai](https://enter.pollinations.ai/).
- **Cost**: Usage consumes "Pollen" credits, each pollen is equal to 1$ (Temporarily for beta 1 pollen is 0.5$).
- **Privacy**: See [pollinations.ai](https://pollinations.ai) for privacy details.


