---
summary: "OpenClaw 에서 OpenRouter 의 통합 API 를 사용해 다양한 모델에 접근합니다"
read_when:
  - "여러 LLM 을 하나의 API 키로 사용하고 싶을 때"
  - "OpenClaw 에서 OpenRouter 를 통해 모델을 실행하고 싶을 때"
title: "OpenRouter"
x-i18n:
  source_path: providers/openrouter.md
  source_hash: b7e29fc9c456c64d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:22Z
---

# OpenRouter

OpenRouter 는 단일 엔드포인트와 API 키 뒤에서 여러 모델로 요청을 라우팅하는 **통합 API** 를 제공합니다. OpenAI 호환이므로, 기본 URL 만 전환하면 대부분의 OpenAI SDK 가 작동합니다.

## CLI 설정

```bash
openclaw onboard --auth-choice apiKey --token-provider openrouter --token "$OPENROUTER_API_KEY"
```

## 설정 스니펫

```json5
{
  env: { OPENROUTER_API_KEY: "sk-or-..." },
  agents: {
    defaults: {
      model: { primary: "openrouter/anthropic/claude-sonnet-4-5" },
    },
  },
}
```

## 참고

- 모델 참조는 `openrouter/<provider>/<model>` 입니다.
- 더 많은 모델 및 프로바이더 옵션은 [/concepts/model-providers](/concepts/model-providers) 를 참조하세요.
- OpenRouter 는 내부적으로 API 키를 사용한 Bearer 토큰을 사용합니다.
