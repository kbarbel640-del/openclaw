# SkillBoss Provider

Multi-AI gateway providing unified access to 50+ AI models including Claude, GPT-5, Gemini, DeepSeek, image generation (Gemini, Flux, DALL-E), video (Veo, Minimax), and audio (ElevenLabs, Minimax TTS).

## Features

- **50+ Models**: Access Claude, GPT-5, Gemini, DeepSeek, and more through a single API
- **Multi-Modal**: Chat, image generation, video generation, text-to-speech, speech-to-text
- **Cost Optimization**: Competitive pricing with unified billing
- **Developer Tools**: Deploy websites, manage databases, integrate Stripe payments

## Setup

### 1. Get API Key

Visit [skillboss.co/console](https://www.skillboss.co/console) to sign up and get your API key.

### 2. Configure OpenClaw

**Interactive setup:**
```bash
openclaw onboard --auth-choice skillboss-api-key
```

**Non-interactive setup:**
```bash
openclaw onboard \
  --auth-choice apiKey \
  --token-provider skillboss \
  --token "$SKILLBOSS_API_KEY"
```

**Manual config** (`~/.openclaw/openclaw.json`):
```json5
{
  "env": {
    "SKILLBOSS_API_KEY": "sk-..."
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "skillboss/bedrock/claude-4-5-sonnet"
      }
    }
  }
}
```

## Available Models

### Chat Models

| Model ID | Name | Context | Cost (Input/Output) |
|----------|------|---------|---------------------|
| `bedrock/claude-4-5-sonnet` | Claude 4.5 Sonnet | 200K | $3.00 / $15.00 per M tokens |
| `openai/gpt-5` | GPT-5 | 200K | $2.50 / $10.00 per M tokens |
| `vertex/gemini-2.5-flash` | Gemini 2.5 Flash | 1M | $0.075 / $0.30 per M tokens |
| `openrouter/deepseek/deepseek-r1` | DeepSeek R1 (reasoning) | 64K | $0.14 / $0.28 per M tokens |

### Image Models

| Model ID | Use Case | Cost |
|----------|----------|------|
| `mm/img` | General purpose (Minimax) | $0.08/image |
| `vertex/gemini-3-pro-image-preview` | High quality | $0.04/image |
| `flux/flux-schnell` | Fast artistic style | $0.003/image |
| `openai/dall-e-3` | DALL-E 3 | $0.04/image |

### Video Models

| Model ID | Type | Cost |
|----------|------|------|
| `mm/t2v` | Text-to-video (Minimax) | $0.50/video |
| `mm/i2v` | Image-to-video (Minimax) | $0.50/video |
| `vertex/veo-3.1-fast-generate-preview` | Text-to-video (Google) | $0.10/video |

### Audio Models

| Model ID | Use Case | Cost |
|----------|----------|------|
| `minimax/speech-01-turbo` | TTS (Chinese/English) | $0.015/1K chars |
| `elevenlabs/eleven_multilingual_v2` | TTS (29 languages) | $0.30/1K chars |
| `openai/whisper-1` | Speech-to-text | $0.006/minute |

## Usage Examples

### Chat
```bash
openclaw exec --model "skillboss/bedrock/claude-4-5-sonnet" "Explain quantum computing"
```

### Image Generation
```bash
openclaw exec --model "skillboss/mm/img" "Generate a minimalist coffee shop logo"
```

### Switch Default Model
```bash
openclaw model set skillboss/vertex/gemini-2.5-flash
```

## Cost & Credits

SkillBoss uses a **credit-based system**:
- **Subscription**: $24.99/month with 200 credits
- **Pay-as-you-go**: Buy credit packs (200/500/800/1200 credits)
- **Pricing**: Competitive with direct API pricing, often cheaper

View pricing: [skillboss.co/pricing](https://www.skillboss.co/pricing)

## Troubleshooting

### Error: Insufficient Credits (402)
Visit [skillboss.co/console](https://www.skillboss.co/console) to add credits.

### Error: Invalid API Key (401)
Verify your API key:
```bash
curl https://api.heybossai.com/v1/models \
  -H "Authorization: Bearer $SKILLBOSS_API_KEY"
```

### Rate Limiting (429)
SkillBoss implements automatic retry with exponential backoff. Persistent rate limits may require plan upgrade.

## Additional Features

Beyond LLM inference, SkillBoss provides:
- **Website Deployment**: Deploy to Cloudflare Workers
- **Database**: Auto-provisioning D1/KV/R2
- **Payments**: Stripe integration
- **Document Processing**: PDF parsing, data extraction
- **Web Scraping**: Firecrawl, Perplexity integration

For full capabilities, install the [SkillBoss skill from ClawHub](https://clawhub.ai/skills/skillboss):
```bash
npx clawhub install skillboss
```

## Support

- Documentation: [skillboss.co/docs](https://www.skillboss.co/docs)
- GitHub: [github.com/heeyo-life/skillboss](https://github.com/heeyo-life/skillboss)
- API Status: [status.skillboss.co](https://status.skillboss.co)
