---
summary: "OpenClaw 가 타이핑 인디케이터를 표시하는 시점과 이를 조정하는 방법"
read_when:
  - 타이핑 인디케이터 동작 또는 기본값을 변경할 때
title: "타이핑 인디케이터"
x-i18n:
  source_path: concepts/typing-indicators.md
  source_hash: 8ee82d02829c4ff5
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:29:12Z
---

# 타이핑 인디케이터

타이핑 인디케이터는 실행이 활성 상태인 동안 채팅 채널로 전송됩니다. 타이핑이 **언제** 시작되는지 제어하려면
`agents.defaults.typingMode` 를 사용하고, **얼마나 자주** 갱신되는지 제어하려면 `typingIntervalSeconds`
를 사용합니다.

## 기본값

`agents.defaults.typingMode` 가 **설정되지 않은** 경우, OpenClaw 는 기존 동작을 유지합니다:

- **다이렉트 채팅**: 모델 루프가 시작되면 즉시 타이핑을 시작합니다.
- **멘션이 있는 그룹 채팅**: 즉시 타이핑을 시작합니다.
- **멘션이 없는 그룹 채팅**: 메시지 텍스트 스트리밍이 시작될 때만 타이핑을 시작합니다.
- **하트비트 실행**: 타이핑이 비활성화됩니다.

## 모드

`agents.defaults.typingMode` 를 다음 중 하나로 설정합니다:

- `never` — 타이핑 인디케이터를 절대 표시하지 않습니다.
- `instant` — 실행이 나중에 무음 응답 토큰만 반환하더라도, **모델 루프가 시작되는 즉시** 타이핑을 시작합니다.
- `thinking` — **첫 번째 추론 델타**에서 타이핑을 시작합니다(실행에 대해 `reasoningLevel: "stream"` 가 필요합니다).
- `message` — **첫 번째 비-무음 텍스트 델타**에서 타이핑을 시작합니다(`NO_REPLY` 무음 토큰을 무시합니다).

"얼마나 빨리 트리거되는지" 순서:
`never` → `message` → `thinking` → `instant`

## 구성

```json5
{
  agent: {
    typingMode: "thinking",
    typingIntervalSeconds: 6,
  },
}
```

세션별로 모드 또는 주기를 재정의할 수 있습니다:

```json5
{
  session: {
    typingMode: "message",
    typingIntervalSeconds: 4,
  },
}
```

## 참고

- `message` 모드는 무음 전용 응답(예: 출력을 억제하는 데 사용되는 `NO_REPLY` 토큰)에는 타이핑을 표시하지 않습니다.
- `thinking` 는 실행이 추론을 스트리밍하는 경우에만 트리거됩니다(`reasoningLevel: "stream"`). 모델이 추론 델타를 내보내지 않으면 타이핑이 시작되지 않습니다.
- 하트비트는 모드와 관계없이 타이핑을 절대 표시하지 않습니다.
- `typingIntervalSeconds` 는 시작 시간이 아니라 **갱신 주기**를 제어합니다.
  기본값은 6초입니다.
