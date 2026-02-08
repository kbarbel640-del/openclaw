---
summary: "OpenClaw 에서 지원하는 모델 프로바이더 (LLM)"
read_when:
  - "모델 프로바이더를 선택하려는 경우"
  - "지원되는 LLM 백엔드의 빠른 개요가 필요한 경우"
title: "모델 프로바이더"
x-i18n:
  source_path: providers/index.md
  source_hash: 84233de8ae3a39e0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:40:17Z
---

# 모델 프로바이더

OpenClaw 는 여러 LLM 프로바이더를 사용할 수 있습니다. 프로바이더를 선택하고 인증한 다음,
기본 모델을 `provider/model` 로 설정합니다.

채팅 채널 문서 (WhatsApp/Telegram/Discord/Slack/Mattermost (plugin)/etc.)를 찾고 계신가요? [Channels](/channels)를 참조하세요.

## 하이라이트: Venice (Venice AI)

Venice 는 프라이버시 우선 추론을 위한 권장 Venice AI 설정이며, 어려운 작업에 Opus 를 사용할 수 있는 옵션을 제공합니다.

- 기본값: `venice/llama-3.3-70b`
- 전반적으로 최고: `venice/claude-opus-45` (Opus 는 여전히 가장 강력합니다)

[Venice AI](/providers/venice)를 참조하세요.

## 빠른 시작

1. 프로바이더로 인증합니다 (일반적으로 `openclaw onboard` 사용).
2. 기본 모델을 설정합니다:

```json5
{
  agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6" } } },
}
```

## 프로바이더 문서

- [OpenAI (API + Codex)](/providers/openai)
- [Anthropic (API + Claude Code CLI)](/providers/anthropic)
- [Qwen (OAuth)](/providers/qwen)
- [OpenRouter](/providers/openrouter)
- [Vercel AI Gateway](/providers/vercel-ai-gateway)
- [Cloudflare AI Gateway](/providers/cloudflare-ai-gateway)
- [Moonshot AI (Kimi + Kimi Coding)](/providers/moonshot)
- [OpenCode Zen](/providers/opencode)
- [Amazon Bedrock](/bedrock)
- [Z.AI](/providers/zai)
- [Xiaomi](/providers/xiaomi)
- [GLM models](/providers/glm)
- [MiniMax](/providers/minimax)
- [Venice (Venice AI, privacy-focused)](/providers/venice)
- [Ollama (local models)](/providers/ollama)

## 전사 프로바이더

- [Deepgram (audio transcription)](/providers/deepgram)

## 커뮤니티 도구

- [Claude Max API Proxy](/providers/claude-max-api-proxy) - Claude Max/Pro 구독을 OpenAI 호환 API 엔드포인트로 사용합니다

전체 프로바이더 카탈로그 (xAI, Groq, Mistral 등)와 고급 설정에 대한 자세한 내용은
[Model providers](/concepts/model-providers)를 참조하세요.
