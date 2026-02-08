---
summary: "OpenClaw 가 프롬프트 컨텍스트를 구성하고 토큰 사용량과 비용을 보고하는 방식"
read_when:
  - 토큰 사용량, 비용 또는 컨텍스트 윈도우를 설명할 때
  - 컨텍스트 증가 또는 컴팩션 동작을 디버깅할 때
title: "토큰 사용 및 비용"
x-i18n:
  source_path: reference/token-use.md
  source_hash: f8bfadb36b51830c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:01Z
---

# 토큰 사용 및 비용

OpenClaw 는 문자 수가 아니라 **토큰**을 추적합니다. 토큰은 모델별로 다르지만,
대부분의 OpenAI 스타일 모델에서는 영어 텍스트 기준으로 토큰 1 개당 평균 약 4 자입니다.

## 시스템 프롬프트가 구성되는 방식

OpenClaw 는 매 실행 시 자체 시스템 프롬프트를 조립합니다. 여기에는 다음이 포함됩니다.

- 도구 목록 + 간단한 설명
- Skills 목록 (메타데이터만 포함; 지침은 `read` 로 요청 시 로드됨)
- 자체 업데이트 지침
- 워크스페이스 + 부트스트랩 파일 (`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, `BOOTSTRAP.md` 가 신규일 때). 대용량 파일은 `agents.defaults.bootstrapMaxChars` 에 의해 잘립니다 (기본값: 20000).
- 시간 (UTC + 사용자 시간대)
- 응답 태그 + 하트비트 동작
- 런타임 메타데이터 (호스트/OS/모델/사고 방식)

전체 세부 내역은 [System Prompt](/concepts/system-prompt) 를 참고하십시오.

## 컨텍스트 윈도우에 포함되는 항목

모델이 수신하는 모든 것은 컨텍스트 제한에 포함됩니다.

- 시스템 프롬프트 (위에 나열된 모든 섹션)
- 대화 기록 (사용자 + 어시스턴트 메시지)
- 도구 호출 및 도구 결과
- 첨부 파일/트랜스크립트 (이미지, 오디오, 파일)
- 컴팩션 요약 및 프루닝 산출물
- 프로바이더 래퍼 또는 안전 헤더 (보이지 않지만 계산에는 포함됨)

실무적인 세부 분석 (주입된 파일별, 도구, Skills, 시스템 프롬프트 크기별) 은
`/context list` 또는 `/context detail` 를 사용하십시오. [Context](/concepts/context) 를 참고하십시오.

## 현재 토큰 사용량을 확인하는 방법

채팅에서 다음을 사용하십시오.

- `/status` → 세션 모델, 컨텍스트 사용량,
  마지막 응답의 입력/출력 토큰, **추정 비용** (API 키 사용 시만) 을 보여주는 **이모지 풍부한 상태 카드**.
- `/usage off|tokens|full` → 모든 응답에 **응답별 사용량 푸터** 를 추가합니다.
  - 세션 단위로 유지됩니다 (`responseUsage` 로 저장됨).
  - OAuth 인증에서는 **비용이 숨겨집니다** (토큰만 표시).
- `/usage cost` → OpenClaw 세션 로그에서 로컬 비용 요약을 표시합니다.

기타 화면:

- **TUI/Web TUI:** `/status` + `/usage` 이 지원됩니다.
- **CLI:** `openclaw status --usage` 및 `openclaw channels list` 은
  프로바이더 할당량 윈도우를 표시합니다 (응답별 비용은 아님).

## 비용 추정 (표시되는 경우)

비용은 모델 가격 설정을 기반으로 추정됩니다.

```
models.providers.<provider>.models[].cost
```

이는 `input`, `output`, `cacheRead`, 그리고
`cacheWrite` 에 대해 **토큰 100 만 개당 USD** 기준입니다. 가격 정보가 없으면
OpenClaw 는 토큰만 표시합니다. OAuth 토큰은
달러 비용을 절대 표시하지 않습니다.

## 캐시 TTL 및 프루닝 영향

프로바이더 프롬프트 캐싱은 캐시 TTL 윈도우 내에서만 적용됩니다. OpenClaw 는
선택적으로 **cache-ttl 프루닝** 을 실행할 수 있습니다. 이는 캐시 TTL 이 만료되면
세션을 프루닝한 다음 캐시 윈도우를 재설정하여, 이후 요청이 전체 기록을 다시
캐싱하는 대신 새로 캐시된 컨텍스트를 재사용할 수 있도록 합니다. 이를 통해
세션이 TTL 을 초과하여 유휴 상태가 될 때 캐시 쓰기 비용을 낮출 수 있습니다.

[Gateway configuration](/gateway/configuration) 에서 설정할 수 있으며,
동작 세부 사항은 [Session pruning](/concepts/session-pruning) 에서 확인하십시오.

하트비트는 유휴 간격 동안 캐시를 **웜(warm)** 상태로 유지할 수 있습니다. 모델의
캐시 TTL 이 `1h` 인 경우, 하트비트 간격을 그보다 약간 짧게
(예: `55m`) 설정하면 전체 프롬프트를 다시 캐싱하는 것을 피할 수 있어
캐시 쓰기 비용을 줄일 수 있습니다.

Anthropic API 가격 정책에서는 캐시 읽기가 입력 토큰보다 훨씬 저렴하며,
캐시 쓰기는 더 높은 배율로 청구됩니다. 최신 요율과 TTL 배율은
Anthropic 의 프롬프트 캐싱 가격 문서를 참고하십시오:
[https://docs.anthropic.com/docs/build-with-claude/prompt-caching](https://docs.anthropic.com/docs/build-with-claude/prompt-caching)

### 예시: 하트비트로 1 시간 캐시 유지

```yaml
agents:
  defaults:
    model:
      primary: "anthropic/claude-opus-4-6"
    models:
      "anthropic/claude-opus-4-6":
        params:
          cacheRetention: "long"
    heartbeat:
      every: "55m"
```

## 토큰 압박을 줄이기 위한 팁

- `/compact` 를 사용하여 긴 세션을 요약하십시오.
- 워크플로에서 대용량 도구 출력은 잘라내십시오.
- Skills 설명은 짧게 유지하십시오 (Skills 목록이 프롬프트에 주입됩니다).
- 장황하고 탐색적인 작업에는 더 작은 모델을 선호하십시오.

정확한 스킬 목록 오버헤드 공식은 [Skills](/tools/skills) 를 참고하십시오.
