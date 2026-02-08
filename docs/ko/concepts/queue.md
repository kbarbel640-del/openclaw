---
summary: "인바운드 자동 응답 실행을 직렬화하는 명령 큐 설계"
read_when:
  - 자동 응답 실행 또는 동시성을 변경할 때
title: "명령 큐"
x-i18n:
  source_path: concepts/queue.md
  source_hash: 2104c24d200fb4f9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:39:40Z
---

# 명령 큐 (2026-01-16)

여러 채널의 인바운드 자동 응답 실행을 작은 프로세스 내 큐로 직렬화하여 여러 에이전트 실행이 서로 충돌하는 것을 방지하면서, 세션 간에는 안전한 병렬성을 허용합니다.

## 이유

- 자동 응답 실행은 비용이 클 수 있으며(LLM 호출), 여러 인바운드 메시지가 짧은 간격으로 도착하면 충돌할 수 있습니다.
- 직렬화는 공유 리소스(세션 파일, 로그, CLI stdin)에 대한 경합을 피하고 업스트림 레이트 리밋의 가능성을 줄입니다.

## 작동 방식

- 레인 인지 FIFO 큐가 각 레인을 구성 가능한 동시성 한도로 배출합니다(미구성 레인의 기본값은 1, main 은 4, subagent 는 8).
- `runEmbeddedPiAgent` 은 **세션 키**(레인 `session:<key>`)로 인큐하여 세션당 하나의 활성 실행만 보장합니다.
- 각 세션 실행은 이후 **글로벌 레인**(기본값 `main`)에 큐잉되어 전체 병렬성이 `agents.defaults.maxConcurrent` 로 제한됩니다.
- 상세 로깅이 활성화되면, 시작 전 ~2초 이상 대기한 큐잉된 실행은 짧은 알림을 출력합니다.
- 타이핑 인디케이터는 인큐 시 즉시(채널에서 지원되는 경우) 발화되므로, 순서를 기다리는 동안에도 사용자 경험은 변하지 않습니다.

## 큐 모드 (채널별)

인바운드 메시지는 현재 실행을 조향하거나, 다음 턴을 기다리거나, 둘 다를 수행할 수 있습니다:

- `steer`: 현재 실행에 즉시 주입합니다(다음 도구 경계 이후 대기 중인 도구 호출을 취소). 스트리밍이 아니면 followup 으로 폴백합니다.
- `followup`: 현재 실행이 끝난 뒤 다음 에이전트 턴을 위해 인큐합니다.
- `collect`: 큐에 쌓인 모든 메시지를 **단일** followup 턴으로 병합합니다(기본값). 메시지가 서로 다른 채널/스레드를 대상으로 하면 라우팅을 보존하기 위해 개별적으로 배출됩니다.
- `steer-backlog` (일명 `steer+backlog`): 지금 조향 **그리고** followup 턴을 위해 메시지를 보존합니다.
- `interrupt` (레거시): 해당 세션의 활성 실행을 중단한 다음, 최신 메시지를 실행합니다.
- `queue` (레거시 별칭): `steer` 와 동일합니다.

Steer-backlog 는 조향된 실행 이후 followup 응답을 받을 수 있음을 의미하므로,
스트리밍 표면에서는 중복처럼 보일 수 있습니다. 인바운드 메시지당 하나의 응답을 원한다면
`collect`/`steer` 를 선호하십시오.
세션별 독립 명령으로 `/queue collect` 를 보내거나 `messages.queue.byChannel.discord: "collect"` 을 설정하십시오.

기본값(설정에서 미지정 시):

- 모든 표면 → `collect`

`messages.queue` 를 통해 전역 또는 채널별로 구성합니다:

```json5
{
  messages: {
    queue: {
      mode: "collect",
      debounceMs: 1000,
      cap: 20,
      drop: "summarize",
      byChannel: { discord: "collect" },
    },
  },
}
```

## 큐 옵션

옵션은 `followup`, `collect`, `steer-backlog` (그리고 followup 으로 폴백될 때의 `steer`)에 적용됩니다:

- `debounceMs`: followup 턴을 시작하기 전에 정숙을 대기합니다(“계속, 계속” 방지).
- `cap`: 세션당 최대 큐 메시지 수.
- `drop`: 오버플로 정책(`old`, `new`, `summarize`).

Summarize 는 드롭된 메시지의 짧은 불릿 목록을 유지하고 이를 합성 followup 프롬프트로 주입합니다.
기본값: `debounceMs: 1000`, `cap: 20`, `drop: summarize`.

## 세션별 오버라이드

- 현재 세션의 모드를 저장하려면 독립 명령으로 `/queue <mode>` 를 보내십시오.
- 옵션은 결합할 수 있습니다: `/queue collect debounce:2s cap:25 drop:summarize`
- `/queue default` 또는 `/queue reset` 는 세션 오버라이드를 해제합니다.

## 범위와 보장

- Gateway(게이트웨이) 응답 파이프라인을 사용하는 모든 인바운드 채널의 자동 응답 에이전트 실행에 적용됩니다(WhatsApp web, Telegram, Slack, Discord, Signal, iMessage, webchat 등).
- 기본 레인(`main`)은 인바운드 + main 하트비트를 위한 프로세스 전역 레인입니다. 여러 세션을 병렬로 허용하려면 `agents.defaults.maxConcurrent` 를 설정하십시오.
- 추가 레인(예: `cron`, `subagent`)이 존재할 수 있어, 백그라운드 작업이 인바운드 응답을 막지 않고 병렬로 실행될 수 있습니다.
- 세션별 레인은 특정 세션에 대해 한 번에 하나의 에이전트 실행만 접근하도록 보장합니다.
- 외부 의존성이나 백그라운드 워커 스레드가 없으며, 순수 TypeScript + Promise 로 구성됩니다.

## 문제 해결

- 명령이 멈춘 것처럼 보이면 상세 로그를 활성화하고 큐가 배출되고 있는지 확인하기 위해 “queued for …ms” 라인을 확인하십시오.
- 큐 깊이가 필요하면 상세 로그를 활성화하고 큐 타이밍 라인을 확인하십시오.
