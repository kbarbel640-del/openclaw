---
summary: "OpenClaw에서 Kilo Gateway의 통합 API를 사용하여 많은 모델에 접근"
read_when:
  - 많은 LLM에 단일 API 키를 원할 때
  - OpenClaw에서 Kilo Gateway를 통해 모델을 실행하고 싶을 때
---

# Kilo Gateway

Kilo Gateway는 단일 엔드포인트와 API 키 뒤에서 많은 모델로 요청을 라우팅하는 **통합 API**를 제공합니다. OpenAI 호환이므로 대부분의 OpenAI SDK가 기본 URL만 변경하면 작동합니다.

## API 키 발급

1. [app.kilo.ai](https://app.kilo.ai) 로 이동
2. 로그인하거나 계정을 생성
3. API Keys로 이동하여 새 키를 생성

## CLI 설정

```bash
openclaw onboard --kilocode-api-key <key>
```

또는 환경 변수를 설정하세요:

```bash
export KILOCODE_API_KEY="your-api-key"
```

## 설정 스니펫

```json5
{
  env: { KILOCODE_API_KEY: "sk-..." },
  agents: {
    defaults: {
      model: { primary: "kilocode/anthropic/claude-opus-4.6" },
    },
  },
}
```

## 제공되는 모델 참조

내장된 Kilo Gateway 카탈로그에서 현재 제공하는 모델 참조:

- `kilocode/anthropic/claude-opus-4.6` (기본값)
- `kilocode/z-ai/glm-5:free`
- `kilocode/minimax/minimax-m2.5:free`
- `kilocode/anthropic/claude-sonnet-4.5`
- `kilocode/openai/gpt-5.2`
- `kilocode/google/gemini-3-pro-preview`
- `kilocode/google/gemini-3-flash-preview`
- `kilocode/x-ai/grok-code-fast-1`
- `kilocode/moonshotai/kimi-k2.5`

## 참고사항

- 모델 참조는 `kilocode/<provider>/<model>` 형식입니다 (예: `kilocode/anthropic/claude-opus-4.6`).
- 기본 모델: `kilocode/anthropic/claude-opus-4.6`
- 기본 URL: `https://api.kilo.ai/api/gateway/`
- 더 많은 모델/프로바이더 옵션은 [/개념/모델-프로바이더](/ko-KR/concepts/model-providers) 를 참조하세요.
- Kilo Gateway는 내부적으로 API 키와 함께 Bearer 토큰을 사용합니다.
