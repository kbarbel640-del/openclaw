---
title: "프롬프트 캐싱"
summary: "프롬프트 캐싱 설정, 병합 순서, 프로바이더 동작, 튜닝 패턴"
read_when:
  - 캐시 보존으로 프롬프트 토큰 비용을 줄이고 싶을 때
  - 멀티 에이전트 설정에서 에이전트별 캐시 동작이 필요할 때
  - 하트비트와 cache-ttl 가지치기를 함께 조정할 때
---

# 프롬프트 캐싱

프롬프트 캐싱이란 모델 프로바이더가 매번 다시 처리하는 대신 변경되지 않은 프롬프트 접두사(일반적으로 시스템/개발자 지침 및 기타 안정적인 컨텍스트)를 여러 턴에 걸쳐 재사용할 수 있음을 의미합니다. 첫 번째 일치 요청은 캐시 토큰(`cacheWrite`)을 작성하고, 이후 일치 요청은 이를 읽을 수 있습니다(`cacheRead`).

이것이 중요한 이유: 낮은 토큰 비용, 빠른 응답, 장기 실행 세션에서 더 예측 가능한 성능. 캐싱 없이는 반복 프롬프트가 대부분의 입력이 변경되지 않은 경우에도 매 턴마다 전체 프롬프트 비용을 지불합니다.

이 페이지는 프롬프트 재사용과 토큰 비용에 영향을 미치는 모든 캐시 관련 설정을 다룹니다.

Anthropic 가격 세부 사항은 다음을 참조하세요:
[https://docs.anthropic.com/docs/build-with-claude/prompt-caching](https://docs.anthropic.com/docs/build-with-claude/prompt-caching)

## 기본 설정

### `cacheRetention` (모델 및 에이전트별)

모델 파라미터에 캐시 보존 설정:

```yaml
agents:
  defaults:
    models:
      "anthropic/claude-opus-4-6":
        params:
          cacheRetention: "short" # none | short | long
```

에이전트별 오버라이드:

```yaml
agents:
  list:
    - id: "alerts"
      params:
        cacheRetention: "none"
```

설정 병합 순서:

1. `agents.defaults.models["provider/model"].params`
2. `agents.list[].params` (일치하는 에이전트 id; 키별로 오버라이드)

### 레거시 `cacheControlTtl`

레거시 값은 여전히 허용되며 다음과 같이 매핑됩니다:

- `5m` -> `short`
- `1h` -> `long`

새 설정에는 `cacheRetention` 을 사용하세요.

### `contextPruning.mode: "cache-ttl"`

캐시 TTL 창 이후 오래된 도구 결과 컨텍스트를 가지치기하여 유휴 후 요청이 너무 큰 기록을 재캐시하지 않도록 합니다.

```yaml
agents:
  defaults:
    contextPruning:
      mode: "cache-ttl"
      ttl: "1h"
```

전체 동작은 [세션 가지치기](/ko-KR/concepts/session-pruning) 를 참조하세요.

### 하트비트 웜업

하트비트는 캐시 창을 따뜻하게 유지하고 유휴 간격 이후 반복적인 캐시 쓰기를 줄일 수 있습니다.

```yaml
agents:
  defaults:
    heartbeat:
      every: "55m"
```

에이전트별 하트비트는 `agents.list[].heartbeat` 에서 지원됩니다.

## 프로바이더 동작

### Anthropic (직접 API)

- `cacheRetention` 이 지원됩니다.
- Anthropic API-key 인증 프로필을 사용할 경우, OpenClaw 는 설정되지 않은 경우 Anthropic 모델 참조에 대해 `cacheRetention: "short"` 를 시드합니다.

### Amazon Bedrock

- Anthropic Claude 모델 참조 (`amazon-bedrock/*anthropic.claude*`) 는 명시적 `cacheRetention` 패스스루를 지원합니다.
- Anthropic 이 아닌 Bedrock 모델은 런타임에서 `cacheRetention: "none"` 으로 강제됩니다.

### OpenRouter Anthropic 모델

`openrouter/anthropic/*` 모델 참조의 경우, OpenClaw 는 시스템/개발자 프롬프트 블록에 Anthropic `cache_control` 을 주입하여 프롬프트 캐시 재사용을 개선합니다.

### 기타 프로바이더

프로바이더가 이 캐시 모드를 지원하지 않는 경우, `cacheRetention` 은 효과가 없습니다.

## 튜닝 패턴

### 혼합 트래픽 (권장 기본값)

메인 에이전트에는 장기 기준선을 유지하고, 버스트 알림 에이전트에서는 캐싱을 비활성화하세요:

```yaml
agents:
  defaults:
    model:
      primary: "anthropic/claude-opus-4-6"
    models:
      "anthropic/claude-opus-4-6":
        params:
          cacheRetention: "long"
  list:
    - id: "research"
      default: true
      heartbeat:
        every: "55m"
    - id: "alerts"
      params:
        cacheRetention: "none"
```

### 비용 우선 기준선

- 기준 `cacheRetention: "short"` 설정.
- `contextPruning.mode: "cache-ttl"` 활성화.
- 따뜻한 캐시에서 이익을 얻는 에이전트에 대해서만 하트비트를 TTL 이하로 유지.

## 캐시 진단

OpenClaw 는 임베디드 에이전트 실행에 대한 전용 캐시 추적 진단을 제공합니다.

### `diagnostics.cacheTrace` 설정

```yaml
diagnostics:
  cacheTrace:
    enabled: true
    filePath: "~/.openclaw/logs/cache-trace.jsonl" # 선택 사항
    includeMessages: false # 기본값 true
    includePrompt: false # 기본값 true
    includeSystem: false # 기본값 true
```

기본값:

- `filePath`: `$OPENCLAW_STATE_DIR/logs/cache-trace.jsonl`
- `includeMessages`: `true`
- `includePrompt`: `true`
- `includeSystem`: `true`

### 환경 변수 토글 (일회성 디버깅)

- `OPENCLAW_CACHE_TRACE=1` 캐시 추적을 활성화합니다.
- `OPENCLAW_CACHE_TRACE_FILE=/path/to/cache-trace.jsonl` 출력 경로를 오버라이드합니다.
- `OPENCLAW_CACHE_TRACE_MESSAGES=0|1` 전체 메시지 페이로드 캡처를 토글합니다.
- `OPENCLAW_CACHE_TRACE_PROMPT=0|1` 프롬프트 텍스트 캡처를 토글합니다.
- `OPENCLAW_CACHE_TRACE_SYSTEM=0|1` 시스템 프롬프트 캡처를 토글합니다.

### 검사할 항목

- 캐시 추적 이벤트는 JSONL 형식이며 `session:loaded`, `prompt:before`, `stream:context`, `session:after` 와 같은 단계별 스냅샷을 포함합니다.
- 일반 사용 화면 (`/usage full` 및 세션 사용 요약 등)을 통해 턴별 캐시 토큰 영향을 `cacheRead` 및 `cacheWrite` 로 확인할 수 있습니다.

## 빠른 문제 해결

- 대부분의 턴에서 높은 `cacheWrite`: 휘발성 시스템 프롬프트 입력을 확인하고 모델/프로바이더가 캐시 설정을 지원하는지 확인하세요.
- `cacheRetention` 이 효과 없음: 모델 키가 `agents.defaults.models["provider/model"]` 과 일치하는지 확인하세요.
- 캐시 설정이 있는 Bedrock Nova/Mistral 요청: 런타임에서 `none` 으로 강제되는 것이 예상된 동작입니다.

관련 문서:

- [Anthropic](/ko-KR/providers/anthropic)
- [토큰 사용 및 비용](/ko-KR/reference/token-use)
- [세션 가지치기](/ko-KR/concepts/session-pruning)
- [게이트웨이 구성 참조](/ko-KR/gateway/configuration-reference)
