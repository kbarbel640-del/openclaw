---
summary: "Use Mistral AI models via API keys in OpenClaw"
read_when:
  - You want to use Mistral models in OpenClaw
  - You want to use Codestral or Devstral for coding
title: "Mistral"
---

# Mistral AI

Mistral AI builds high-performance language models including Mistral Large, Codestral (code-specialized), and Devstral (developer-focused). OpenClaw supports Mistral via API key authentication.

## Available models

| Model ID                                  | Description                   | Input           | Context | Best for                    |
| ----------------------------------------- | ----------------------------- | --------------- | ------- | --------------------------- |
| `mistral-large-latest`                    | Flagship model with reasoning | text, image     | 256K    | General-purpose, multimodal |
| `mistral-medium-latest`                   | Balanced performance          | text, image     | 128K    | Cost-effective tasks        |
| `mistral-small-latest`                    | Fast and efficient            | text, image     | 128K    | Quick responses             |
| `codestral-latest`                        | Code-specialized              | text            | 128K    | Code generation             |
| `devstral-latest`                         | Developer-focused             | text            | 256K    | Development workflows       |
| `voxtral-mini-latest`                     | Audio transcription           | audio           | 32K     | Speech-to-text              |
| `voxtral-mini-transcribe-realtime-latest` | Realtime transcription        | audio           | 32K     | Live transcription          |
| `mistral-ocr-latest`                      | Document OCR                  | image, document | 128K    | Text extraction             |

## Setup

Get your API key from the [Mistral Console](https://console.mistral.ai/api-keys).

### CLI setup

```bash
openclaw onboard
# choose: Mistral API key

# or non-interactive
openclaw onboard --auth-choice mistral-api-key --mistral-api-key "$MISTRAL_API_KEY"
```

### Config snippet

```json5
{
  env: { MISTRAL_API_KEY: "..." },
  agents: { defaults: { model: { primary: "mistral/mistral-large-latest" } } },
}
```

## Using specific models

Switch models by updating the primary model reference:

```json5
{
  agents: {
    defaults: {
      model: { primary: "mistral/codestral-latest" },
    },
  },
}
```

## Notes

- Model refs always use `provider/model` (see [/concepts/models](/concepts/models)).
- Mistral uses an OpenAI-compatible API, so familiar patterns apply.
- Codestral has a 256K context window, ideal for large codebases.

## Troubleshooting

**401 errors / invalid API key**

- Verify your API key at [console.mistral.ai](https://console.mistral.ai/api-keys).
- Re-run `openclaw onboard --auth-choice mistral-api-key` with a fresh key.

**No API key found for provider "mistral"**

- Auth is **per agent**. New agents don't inherit the main agent's keys.
- Re-run onboarding for that agent, or set `MISTRAL_API_KEY` in your environment.

More: [/gateway/troubleshooting](/gateway/troubleshooting) and [/help/faq](/help/faq).
