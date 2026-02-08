---
summary: "세션 가지치기: 컨텍스트 팽창을 줄이기 위한 도구 결과 트리밍"
read_when:
  - 도구 출력으로 인한 LLM 컨텍스트 증가를 줄이고자 할 때
  - agents.defaults.contextPruning 을 튜닝할 때
x-i18n:
  source_path: concepts/session-pruning.md
  source_hash: 9b0aa2d1abea7050
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:39:38Z
---

# 세션 가지치기

세션 가지치기는 각 LLM 호출 직전에 메모리 내 컨텍스트에서 **오래된 도구 결과**를 트리밍합니다. 이는 디스크에 저장된 세션 기록을 다시 작성하지는 **않습니다** (`*.jsonl`).

## 실행 시점

- `mode: "cache-ttl"` 가 활성화되어 있고, 세션의 마지막 Anthropic 호출이 `ttl` 보다 오래된 경우.
- 해당 요청에서 모델로 전송되는 메시지에만 영향을 줍니다.
- Anthropic API 호출(및 OpenRouter Anthropic 모델)에만 적용됩니다.
- 최상의 결과를 위해 `ttl` 을 모델의 `cacheControlTtl` 에 맞추십시오.
- 가지치기 이후에는 TTL 윈도우가 재설정되어, 이후 요청은 `ttl` 이 다시 만료될 때까지 캐시를 유지합니다.

## 스마트 기본값 (Anthropic)

- **OAuth 또는 setup-token** 프로필: `cache-ttl` 가지치기를 활성화하고 하트비트를 `1h` 으로 설정합니다.
- **API 키** 프로필: `cache-ttl` 가지치기를 활성화하고, 하트비트를 `30m` 로 설정하며, Anthropic 모델에서 기본 `cacheControlTtl` 을 `1h` 로 설정합니다.
- 이러한 값 중 어떤 것이든 명시적으로 설정하면, OpenClaw 는 이를 **덮어쓰지 않습니다**.

## 개선되는 점 (비용 + 캐시 동작)

- **왜 가지치기하는가:** Anthropic 프롬프트 캐싱은 TTL 내에서만 적용됩니다. 세션이 TTL 을 초과해 유휴 상태가 되면, 다음 요청에서 트리밍하지 않는 한 전체 프롬프트가 다시 캐시됩니다.
- **무엇이 더 저렴해지는가:** 가지치기는 TTL 만료 후 첫 요청에서의 **cacheWrite** 크기를 줄입니다.
- **TTL 재설정이 중요한 이유:** 가지치기가 실행되면 캐시 윈도우가 재설정되므로, 후속 요청은 전체 기록을 다시 캐시하는 대신 새로 캐시된 프롬프트를 재사용할 수 있습니다.
- **하지 않는 것:** 가지치기는 토큰을 추가하거나 비용을 “이중”으로 만들지 않습니다. TTL 이후 첫 요청에서 무엇이 캐시되는지만 변경합니다.

## 가지치기 대상

- `toolResult` 메시지만 대상입니다.
- 사용자 + 어시스턴트 메시지는 **절대** 수정되지 않습니다.
- 마지막 `keepLastAssistants` 개의 어시스턴트 메시지는 보호되며, 해당 컷오프 이후의 도구 결과만 가지치기됩니다.
- 컷오프를 설정하기에 충분한 어시스턴트 메시지가 없으면 가지치기는 건너뜁니다.
- **이미지 블록**을 포함한 도구 결과는 건너뜁니다(트리밍/삭제되지 않음).

## 컨텍스트 윈도우 추정

가지치기는 추정된 컨텍스트 윈도우(문자 수 ≈ 토큰 × 4)를 사용합니다. 기본 윈도우는 다음 순서로 해석됩니다:

1. `models.providers.*.models[].contextWindow` 오버라이드.
2. 모델 정의의 `contextWindow` (모델 레지스트리에서).
3. 기본값 `200000` 토큰.

`agents.defaults.contextTokens` 이 설정되어 있으면, 해석된 윈도우에 대한 상한(min)으로 취급됩니다.

## 모드

### cache-ttl

- 마지막 Anthropic 호출이 `ttl` (기본값 `5m`) 보다 오래된 경우에만 가지치기가 실행됩니다.
- 실행 시: 이전과 동일한 소프트 트림 + 하드 클리어 동작을 수행합니다.

## 소프트 vs 하드 가지치기

- **소프트 트림**: 과도하게 큰 도구 결과에만 적용됩니다.
  - 앞부분 + 뒷부분을 유지하고 `...` 을 삽입하며, 원본 크기에 대한 메모를 추가합니다.
  - 이미지 블록이 있는 결과는 건너뜁니다.
- **하드 클리어**: 전체 도구 결과를 `hardClear.placeholder` 로 교체합니다.

## 도구 선택

- `tools.allow` / `tools.deny` 은 `*` 와일드카드를 지원합니다.
- 거부가 우선합니다.
- 매칭은 대소문자를 구분하지 않습니다.
- 허용 목록이 비어 있으면 => 모든 도구가 허용됩니다.

## 다른 제한과의 상호작용

- 내장 도구는 이미 자체 출력 트렁케이션을 수행합니다. 세션 가지치기는 장시간 실행되는 채팅에서 모델 컨텍스트에 과도한 도구 출력이 누적되는 것을 방지하는 추가 레이어입니다.
- 컴팩션은 별개입니다: 컴팩션은 요약하여 영구 저장하고, 가지치기는 요청별로 일시적으로 적용됩니다. [/concepts/compaction](/concepts/compaction) 을 참고하십시오.

## 기본값 (활성화 시)

- `ttl`: `"5m"`
- `keepLastAssistants`: `3`
- `softTrimRatio`: `0.3`
- `hardClearRatio`: `0.5`
- `minPrunableToolChars`: `50000`
- `softTrim`: `{ maxChars: 4000, headChars: 1500, tailChars: 1500 }`
- `hardClear`: `{ enabled: true, placeholder: "[Old tool result content cleared]" }`

## 예시

기본값(비활성화):

```json5
{
  agent: {
    contextPruning: { mode: "off" },
  },
}
```

TTL 인식 가지치기 활성화:

```json5
{
  agent: {
    contextPruning: { mode: "cache-ttl", ttl: "5m" },
  },
}
```

특정 도구로 가지치기 제한:

```json5
{
  agent: {
    contextPruning: {
      mode: "cache-ttl",
      tools: { allow: ["exec", "read"], deny: ["*image*"] },
    },
  },
}
```

설정 참조 보기: [Gateway Configuration](/gateway/configuration)
