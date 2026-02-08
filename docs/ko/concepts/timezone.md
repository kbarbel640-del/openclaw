---
summary: "에이전트, 엔벨로프, 프롬프트를 위한 시간대 처리"
read_when:
  - 모델을 위해 타임스탬프가 어떻게 정규화되는지 이해해야 합니다
  - 시스템 프롬프트에서 사용자 시간대를 구성해야 합니다
title: "시간대"
x-i18n:
  source_path: concepts/timezone.md
  source_hash: 9ee809c96897db11
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:29:08Z
---

# 시간대

OpenClaw 는 모델이 **단일 기준 시간**을 보도록 타임스탬프를 표준화합니다.

## 메시지 엔벨로프(기본값: 로컬)

인바운드 메시지는 다음과 같은 엔벨로프로 래핑됩니다:

```
[Provider ... 2026-01-05 16:26 PST] message text
```

엔벨로프의 타임스탬프는 **기본적으로 호스트 로컬**이며, 분 단위 정밀도를 가집니다.

다음으로 이를 재정의할 수 있습니다:

```json5
{
  agents: {
    defaults: {
      envelopeTimezone: "local", // "utc" | "local" | "user" | IANA timezone
      envelopeTimestamp: "on", // "on" | "off"
      envelopeElapsed: "on", // "on" | "off"
    },
  },
}
```

- `envelopeTimezone: "utc"` 는 UTC 를 사용합니다.
- `envelopeTimezone: "user"` 는 `agents.defaults.userTimezone` 를 사용합니다(호스트 시간대로 폴백합니다).
- 고정 오프셋을 위해 명시적 IANA 시간대(예: `"Europe/Vienna"`)를 사용합니다.
- `envelopeTimestamp: "off"` 는 엔벨로프 헤더에서 절대 타임스탬프를 제거합니다.
- `envelopeElapsed: "off"` 는 경과 시간 접미사(`+2m` 스타일)를 제거합니다.

### 예시

**로컬(기본값):**

```
[Signal Alice +1555 2026-01-18 00:19 PST] hello
```

**고정 시간대:**

```
[Signal Alice +1555 2026-01-18 06:19 GMT+1] hello
```

**경과 시간:**

```
[Signal Alice +1555 +2m 2026-01-18T05:19Z] follow-up
```

## 도구 페이로드(원시 프로바이더 데이터 + 정규화된 필드)

도구 호출(`channels.discord.readMessages`, `channels.slack.readMessages` 등)은 **원시 프로바이더 타임스탬프**를 반환합니다.
또한 일관성을 위해 정규화된 필드를 첨부합니다:

- `timestampMs` (UTC 에포크 밀리초)
- `timestampUtc` (ISO 8601 UTC 문자열)

원시 프로바이더 필드는 보존됩니다.

## 시스템 프롬프트를 위한 사용자 시간대

`agents.defaults.userTimezone` 를 설정하여 모델에 사용자의 로컬 시간대를 알려줍니다. 이를
설정하지 않으면 OpenClaw 는 **런타임에 호스트 시간대**를 확인합니다(설정 파일에 쓰지 않음).

```json5
{
  agents: { defaults: { userTimezone: "America/Chicago" } },
}
```

시스템 프롬프트에는 다음이 포함됩니다:

- 로컬 시간과 시간대를 포함하는 `Current Date & Time` 섹션
- `Time format: 12-hour` 또는 `24-hour`

`agents.defaults.timeFormat` (`auto` | `12` | `24`)로 프롬프트 형식을 제어할 수 있습니다.

전체 동작과 예시는 [Date & Time](/date-time)에서 확인하십시오.
