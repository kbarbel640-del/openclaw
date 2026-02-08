---
summary: "로컬 LLM(LM Studio, vLLM, LiteLLM, 커스텀 OpenAI 엔드포인트)에서 OpenClaw 실행"
read_when:
  - 자체 GPU 박스에서 모델을 서빙하려는 경우
  - LM Studio 또는 OpenAI 호환 프록시를 연결하는 경우
  - 가장 안전한 로컬 모델 가이드가 필요한 경우
title: "로컬 모델"
x-i18n:
  source_path: gateway/local-models.md
  source_hash: 63a7cc8b114355c6
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:09Z
---

# 로컬 모델

로컬은 가능하지만, OpenClaw 는 큰 컨텍스트 + 프롬프트 인젝션에 대한 강력한 방어를 기대합니다. 작은 카드(모델)는 컨텍스트를 잘라내고 안전이 누수됩니다. 목표를 높게 잡으십시오: **최대 사양의 Mac Studio 2대 이상 또는 동급 GPU 리그(~$30k+)**. 단일 **24 GB** GPU 는 더 가벼운 프롬프트에서만 더 높은 지연으로 작동합니다. 실행할 수 있는 **가장 큰/풀사이즈 모델 변형을 사용**하십시오. 과도하게 양자화되거나 "small" 체크포인트는 프롬프트 인젝션 위험을 높입니다([Security](/gateway/security) 참고).

## 권장: LM Studio + MiniMax M2.1(Responses API, 풀사이즈)

현재 기준 최고의 로컬 스택입니다. LM Studio 에서 MiniMax M2.1 을 로드하고, 로컬 서버(기본값 `http://127.0.0.1:1234`)를 활성화한 뒤, Responses API 를 사용해 추론을 최종 텍스트와 분리합니다.

```json5
{
  agents: {
    defaults: {
      model: { primary: "lmstudio/minimax-m2.1-gs32" },
      models: {
        "anthropic/claude-opus-4-6": { alias: "Opus" },
        "lmstudio/minimax-m2.1-gs32": { alias: "Minimax" },
      },
    },
  },
  models: {
    mode: "merge",
    providers: {
      lmstudio: {
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "lmstudio",
        api: "openai-responses",
        models: [
          {
            id: "minimax-m2.1-gs32",
            name: "MiniMax M2.1 GS32",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 196608,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

**설정 체크리스트**

- LM Studio 설치: https://lmstudio.ai
- LM Studio 에서 사용 가능한 **가장 큰 MiniMax M2.1 빌드**를 다운로드하고("small"/과도하게 양자화된 변형은 피하십시오), 서버를 시작한 다음 `http://127.0.0.1:1234/v1/models` 에 목록으로 표시되는지 확인합니다.
- 모델을 로드된 상태로 유지하십시오. 콜드 로드는 시작 지연을 추가합니다.
- LM Studio 빌드가 다르면 `contextWindow`/`maxTokens` 를 조정하십시오.
- WhatsApp 의 경우, 최종 텍스트만 전송되도록 Responses API 를 사용하십시오.

로컬을 실행할 때에도 호스티드 모델 구성을 유지하십시오. `models.mode: "merge"` 를 사용하면 폴백을 계속 사용할 수 있습니다.

### 하이브리드 설정: 호스티드 기본, 로컬 폴백

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-sonnet-4-5",
        fallbacks: ["lmstudio/minimax-m2.1-gs32", "anthropic/claude-opus-4-6"],
      },
      models: {
        "anthropic/claude-sonnet-4-5": { alias: "Sonnet" },
        "lmstudio/minimax-m2.1-gs32": { alias: "MiniMax Local" },
        "anthropic/claude-opus-4-6": { alias: "Opus" },
      },
    },
  },
  models: {
    mode: "merge",
    providers: {
      lmstudio: {
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "lmstudio",
        api: "openai-responses",
        models: [
          {
            id: "minimax-m2.1-gs32",
            name: "MiniMax M2.1 GS32",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 196608,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

### 로컬 우선 + 호스티드 안전망

기본과 폴백 순서를 바꾸되, 동일한 프로바이더 블록과 `models.mode: "merge"` 를 유지하여 로컬 박스가 다운되었을 때 Sonnet 또는 Opus 로 폴백할 수 있게 하십시오.

### 리전 호스팅 / 데이터 라우팅

- 호스티드 MiniMax/Kimi/GLM 변형도 OpenRouter 에서 리전 고정 엔드포인트(예: US-hosted)로 제공됩니다. 선택한 관할권 내에 트래픽을 유지하려면 그곳에서 리전 변형을 선택하고, Anthropic/OpenAI 폴백에는 계속 `models.mode: "merge"` 를 사용하십시오.
- 로컬 전용이 가장 강력한 프라이버시 경로입니다. 호스티드 리전 라우팅은 프로바이더 기능이 필요하지만 데이터 흐름에 대한 통제를 원할 때의 중간 지점입니다.

## 기타 OpenAI 호환 로컬 프록시

vLLM, LiteLLM, OAI-proxy 또는 커스텀 게이트웨이는 OpenAI 스타일 `/v1` 엔드포인트를 노출한다면 동작합니다. 위의 프로바이더 블록을 여러분의 엔드포인트와 모델 ID 로 교체하십시오:

```json5
{
  models: {
    mode: "merge",
    providers: {
      local: {
        baseUrl: "http://127.0.0.1:8000/v1",
        apiKey: "sk-local",
        api: "openai-responses",
        models: [
          {
            id: "my-local-model",
            name: "Local Model",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 120000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

호스티드 모델이 폴백으로 계속 사용 가능하도록 `models.mode: "merge"` 를 유지하십시오.

## 문제 해결

- Gateway(게이트웨이)가 프록시에 도달할 수 있습니까? `curl http://127.0.0.1:1234/v1/models`.
- LM Studio 모델이 언로드되었습니까? 다시 로드하십시오. 콜드 스타트는 "멈춤"의 흔한 원인입니다.
- 컨텍스트 오류가 있습니까? `contextWindow` 를 낮추거나 서버 제한을 올리십시오.
- 안전: 로컬 모델은 프로바이더 측 필터를 건너뜁니다. 프롬프트 인젝션 영향 범위를 제한하려면 에이전트를 좁게 유지하고 컴팩션을 켠 상태로 두십시오.
