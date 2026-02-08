---
summary: "SOUL Evil 훅(SOUL.md 를 SOUL_EVIL.md 로 교체)"
read_when:
  - SOUL Evil 훅을 활성화하거나 조정하려고 할 때
  - 제거 창 또는 무작위 확률 페르소나 교체가 필요할 때
title: "SOUL Evil 훅"
x-i18n:
  source_path: hooks/soul-evil.md
  source_hash: cc32c1e207f2b692
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:38:49Z
---

# SOUL Evil 훅

SOUL Evil 훅은 제거 창 동안 또는 무작위 확률에 따라 **주입된** `SOUL.md` 콘텐츠를 `SOUL_EVIL.md` 로 교체합니다. 디스크의 파일은 **수정하지 않습니다**.

## 작동 방식

`agent:bootstrap` 가 실행될 때, 훅은 시스템 프롬프트가 조립되기 전에 메모리에서 `SOUL.md` 콘텐츠를 교체할 수 있습니다. `SOUL_EVIL.md` 가 없거나 비어 있으면, OpenClaw 는 경고를 기록하고 정상 `SOUL.md` 를 유지합니다.

서브 에이전트 실행에는 부트스트랩 파일에 `SOUL.md` 가 포함되지 않으므로, 이 훅은 서브 에이전트에 영향을 주지 않습니다.

## 활성화

```bash
openclaw hooks enable soul-evil
```

그런 다음 설정을 지정합니다:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "soul-evil": {
          "enabled": true,
          "file": "SOUL_EVIL.md",
          "chance": 0.1,
          "purge": { "at": "21:00", "duration": "15m" }
        }
      }
    }
  }
}
```

에이전트 작업 공간 루트(`SOUL.md` 옆)에 `SOUL_EVIL.md` 를 생성합니다.

## 옵션

- `file` (string): 대체 SOUL 파일명(기본값: `SOUL_EVIL.md`)
- `chance` (number 0–1): 실행마다 `SOUL_EVIL.md` 를 사용할 무작위 확률
- `purge.at` (HH:mm): 일일 제거 시작(24시간제)
- `purge.duration` (duration): 창 길이(예: `30s`, `10m`, `1h`)

**우선순위:** 제거 창이 확률보다 우선합니다.

**시간대:** 설정되어 있으면 `agents.defaults.userTimezone` 를 사용하고, 그렇지 않으면 호스트 시간대를 사용합니다.

## 참고

- 디스크에 어떤 파일도 작성하거나 수정하지 않습니다.
- `SOUL.md` 가 부트스트랩 목록에 없으면, 훅은 아무 동작도 하지 않습니다.

## 함께 보기

- [훅](/hooks)
