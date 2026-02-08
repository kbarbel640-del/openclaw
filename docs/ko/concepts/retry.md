---
summary: "아웃바운드 프로바이더 호출을 위한 재시도 정책"
read_when:
  - 프로바이더 재시도 동작 또는 기본값을 업데이트할 때
  - 프로바이더 전송 오류 또는 레이트 리밋을 디버깅할 때
title: "재시도 정책"
x-i18n:
  source_path: concepts/retry.md
  source_hash: 55bb261ff567f46c
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:29:25Z
---

# 재시도 정책

## 목표

- 다단계 플로우가 아니라 HTTP 요청별로 재시도합니다.
- 현재 단계만 재시도하여 순서를 보장합니다.
- 멱등하지 않은 작업의 중복을 방지합니다.

## 기본값

- 시도 횟수: 3
- 최대 지연 상한: 30000 ms
- 지터: 0.1 (10 퍼센트)
- 프로바이더 기본값:
  - Telegram 최소 지연: 400 ms
  - Discord 최소 지연: 500 ms

## 동작

### Discord

- 레이트 리밋 오류(HTTP 429)에서만 재시도합니다.
- 가능하면 Discord `retry_after`를 사용하고, 그렇지 않으면 지수 백오프를 사용합니다.

### Telegram

- 일시적 오류(429, 타임아웃, connect/reset/closed, 일시적으로 사용 불가)에서 재시도합니다.
- 가능하면 `retry_after`를 사용하고, 그렇지 않으면 지수 백오프를 사용합니다.
- Markdown 파싱 오류는 재시도하지 않으며, 일반 텍스트로 폴백합니다.

## 설정

`~/.openclaw/openclaw.json`에서 프로바이더별 재시도 정책을 설정합니다:

```json5
{
  channels: {
    telegram: {
      retry: {
        attempts: 3,
        minDelayMs: 400,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
    discord: {
      retry: {
        attempts: 3,
        minDelayMs: 500,
        maxDelayMs: 30000,
        jitter: 0.1,
      },
    },
  },
}
```

## 참고

- 재시도는 요청별로 적용됩니다(메시지 전송, 미디어 업로드, 리액션, 투표, 스티커).
- 컴포지트 플로우는 완료된 단계를 재시도하지 않습니다.
