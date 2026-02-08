---
summary: "하트비트 폴링 메시지 및 알림 규칙"
read_when:
  - 하트비트 주기 또는 메시징을 조정할 때
  - 예약 작업에서 하트비트와 cron 중 무엇을 쓸지 결정할 때
title: "하트비트"
x-i18n:
  source_path: gateway/heartbeat.md
  source_hash: 27db9803263a5f2d
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:52Z
---

# 하트비트 (Gateway(게이트웨이))

> **하트비트 vs Cron?** 각각을 언제 사용해야 하는지에 대한 안내는 [Cron vs Heartbeat](/automation/cron-vs-heartbeat)를 참고하십시오.

하트비트는 메인 세션에서 **주기적인 에이전트 턴**을 실행하여, 모델이 주의를 기울여야 할 사항을 사용자에게 스팸처럼 보내지 않으면서도 드러낼 수 있게 합니다.

## 빠른 시작 (초보자)

1. 하트비트를 활성화된 상태로 두십시오(기본값은 `30m`, 또는 Anthropic OAuth/setup-token의 경우 `1h`) 또는 원하는 주기를 설정하십시오.
2. 에이전트 작업공간에 작은 `HEARTBEAT.md` 체크리스트를 만드십시오(선택 사항이지만 권장).
3. 하트비트 메시지가 어디로 가야 하는지 결정하십시오(`target: "last"`가 기본값).
4. 선택 사항: 투명성을 위해 하트비트 추론 전달을 활성화하십시오.
5. 선택 사항: 하트비트를 활성 시간(로컬 시간)으로 제한하십시오.

예시 설정:

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
        // activeHours: { start: "08:00", end: "24:00" },
        // includeReasoning: true, // optional: send separate `Reasoning:` message too
      },
    },
  },
}
```

## 기본값

- 간격: `30m` (또는 Anthropic OAuth/setup-token이 감지된 인증 모드일 때는 `1h`). `agents.defaults.heartbeat.every` 또는 에이전트별 `agents.list[].heartbeat.every`을 설정하십시오. 비활성화하려면 `0m`을 사용하십시오.
- 프롬프트 본문(`agents.defaults.heartbeat.prompt`로 설정 가능):
  `Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`
- 하트비트 프롬프트는 사용자 메시지로 **그대로** 전송됩니다. 시스템 프롬프트에는 "Heartbeat" 섹션이 포함되며, 실행은 내부적으로 플래그 처리됩니다.
- 활성 시간(`heartbeat.activeHours`)은 설정된 타임존에서 확인됩니다. 해당 창 밖에서는, 다음 틱이 창 안에 들어올 때까지 하트비트가 건너뛰어집니다.

## 하트비트 프롬프트의 목적

기본 프롬프트는 의도적으로 포괄적입니다:

- **백그라운드 작업**: "Consider outstanding tasks"는 에이전트가 후속 작업(수신함, 캘린더, 리마인더, 대기 중인 작업)을 검토하고 긴급한 항목을 드러내도록 유도합니다.
- **사용자 체크인**: "Checkup sometimes on your human during day time"는 가벼운 "필요한 것 있나요?" 메시지를 가끔 보내도록 유도하되, 설정한 로컬 타임존을 사용하여 야간 스팸을 피합니다([/concepts/timezone](/concepts/timezone) 참조).

하트비트가 매우 구체적인 일을 하게 하고 싶다면(예: "check Gmail PubSub stats" 또는 "verify gateway health"), `agents.defaults.heartbeat.prompt`(또는 `agents.list[].heartbeat.prompt`)을 커스텀 본문(그대로 전송됨)으로 설정하십시오.

## 응답 계약

- 주의를 기울일 일이 없다면 **`HEARTBEAT_OK`**로 응답하십시오.
- 하트비트 실행 중 OpenClaw는 응답의 **시작 또는 끝**에 나타나는 `HEARTBEAT_OK`를 ack로 취급합니다. 해당 토큰은 제거되며, 남은 콘텐츠가 **≤ `ackMaxChars`**(기본값: 300)인 경우 응답은 드롭됩니다.
- `HEARTBEAT_OK`가 응답 **중간**에 나타나면 특별 취급되지 않습니다.
- 알림의 경우 `HEARTBEAT_OK`를 **포함하지 마십시오**. 알림 텍스트만 반환하십시오.

하트비트 외 상황에서는, 메시지 시작/끝의 불필요한 `HEARTBEAT_OK`는 제거되어 로그에 기록되며, 메시지가 `HEARTBEAT_OK`만으로 이루어져 있으면 드롭됩니다.

## 설정

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m", // default: 30m (0m disables)
        model: "anthropic/claude-opus-4-6",
        includeReasoning: false, // default: false (deliver separate Reasoning: message when available)
        target: "last", // last | none | <channel id> (core or plugin, e.g. "bluebubbles")
        to: "+15551234567", // optional channel-specific override
        accountId: "ops-bot", // optional multi-account channel id
        prompt: "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.",
        ackMaxChars: 300, // max chars allowed after HEARTBEAT_OK
      },
    },
  },
}
```

### 범위 및 우선순위

- `agents.defaults.heartbeat`은 전역 하트비트 동작을 설정합니다.
- `agents.list[].heartbeat`이 그 위에 병합됩니다. 어떤 에이전트든 `heartbeat` 블록을 갖고 있으면 **그 에이전트들만** 하트비트를 실행합니다.
- `channels.defaults.heartbeat`은 모든 채널에 대한 가시성 기본값을 설정합니다.
- `channels.<channel>.heartbeat`는 채널 기본값을 오버라이드합니다.
- `channels.<channel>.accounts.<id>.heartbeat`(다중 계정 채널)은 채널별 설정을 오버라이드합니다.

### 에이전트별 하트비트

어떤 `agents.list[]` 항목이든 `heartbeat` 블록을 포함하면, **그 에이전트들만** 하트비트를 실행합니다. 에이전트별 블록은 `agents.defaults.heartbeat` 위에 병합됩니다(공유 기본값을 한 번만 설정하고 에이전트별로 오버라이드할 수 있습니다).

예: 에이전트 2개 중 두 번째 에이전트만 하트비트를 실행합니다.

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
      },
    },
    list: [
      { id: "main", default: true },
      {
        id: "ops",
        heartbeat: {
          every: "1h",
          target: "whatsapp",
          to: "+15551234567",
          prompt: "Read HEARTBEAT.md if it exists (workspace context). Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.",
        },
      },
    ],
  },
}
```

### 활성 시간 예시

특정 타임존에서 하트비트를 업무 시간으로 제한합니다:

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "30m",
        target: "last",
        activeHours: {
          start: "09:00",
          end: "22:00",
          timezone: "America/New_York", // optional; uses your userTimezone if set, otherwise host tz
        },
      },
    },
  },
}
```

이 창 밖(동부 시간 기준 오전 9시 이전 또는 오후 10시 이후)에서는 하트비트가 건너뛰어집니다. 창 안에서 예정된 다음 틱은 정상적으로 실행됩니다.

### 다중 계정 예시

Telegram 같은 다중 계정 채널에서 특정 계정을 대상으로 하려면 `accountId`를 사용하십시오:

```json5
{
  agents: {
    list: [
      {
        id: "ops",
        heartbeat: {
          every: "1h",
          target: "telegram",
          to: "12345678",
          accountId: "ops-bot",
        },
      },
    ],
  },
  channels: {
    telegram: {
      accounts: {
        "ops-bot": { botToken: "YOUR_TELEGRAM_BOT_TOKEN" },
      },
    },
  },
}
```

### 필드 노트

- `every`: 하트비트 간격(지속시간 문자열, 기본 단위 = 분).
- `model`: 하트비트 실행에 대한 선택적 모델 오버라이드(`provider/model`).
- `includeReasoning`: 활성화 시, 가능할 때 별도의 `Reasoning:` 메시지도 함께 전달합니다(`/reasoning on`와 동일한 형태).
- `session`: 하트비트 실행에 대한 선택적 세션 키.
  - `main`(기본값): 에이전트 메인 세션.
  - 명시적 세션 키(`openclaw sessions --json` 또는 [sessions CLI](/cli/sessions)에서 복사).
  - 세션 키 형식: [Sessions](/concepts/session) 및 [Groups](/concepts/groups) 참고.
- `target`:
  - `last`(기본값): 마지막으로 사용한 외부 채널로 전달합니다.
  - 명시적 채널: `whatsapp` / `telegram` / `discord` / `googlechat` / `slack` / `msteams` / `signal` / `imessage`.
  - `none`: 하트비트를 실행하되, 외부로는 **전달하지 않습니다**.
- `to`: 선택적 수신자 오버라이드(채널별 id, 예: WhatsApp의 경우 E.164 또는 Telegram 채팅 id).
- `accountId`: 다중 계정 채널을 위한 선택적 계정 id. `target: "last"`일 때, 계정 id는 계정을 지원하는 경우 해석된 마지막 채널에 적용되며, 그렇지 않으면 무시됩니다. 계정 id가 해석된 채널에 대해 설정된 계정과 일치하지 않으면 전달이 건너뛰어집니다.
- `prompt`: 기본 프롬프트 본문을 오버라이드합니다(병합되지 않음).
- `ackMaxChars`: `HEARTBEAT_OK` 이후 전달되기 전에 허용되는 최대 문자 수.
- `activeHours`: 하트비트 실행을 시간 창으로 제한합니다. `start`(HH:MM, 포함), `end`(HH:MM, 제외; 종료 시각으로 `24:00` 허용), 선택적 `timezone`을 갖는 객체입니다.
  - 생략 또는 `"user"`: `agents.defaults.userTimezone`가 설정되어 있으면 이를 사용하고, 그렇지 않으면 호스트 시스템 타임존으로 폴백합니다.
  - `"local"`: 항상 호스트 시스템 타임존을 사용합니다.
  - 모든 IANA 식별자(예: `America/New_York`): 직접 사용되며, 유효하지 않으면 위의 `"user"` 동작으로 폴백합니다.
  - 활성 창 밖에서는, 다음 틱이 창 안에 들어올 때까지 하트비트가 건너뛰어집니다.

## 전달 동작

- 하트비트는 기본적으로 에이전트의 메인 세션에서 실행되며(`agent:<id>:<mainKey>`), `session.scope = "global"`일 때는 `global`에서 실행됩니다. 특정 채널 세션(Discord/WhatsApp 등)으로 오버라이드하려면 `session`를 설정하십시오.
- `session`은 실행 컨텍스트에만 영향을 주며, 전달은 `target` 및 `to`로 제어됩니다.
- 특정 채널/수신자로 전달하려면 `target` + `to`를 설정하십시오. `target: "last"`가 있으면, 전달은 해당 세션의 마지막 외부 채널을 사용합니다.
- 메인 큐가 바쁘면 하트비트는 건너뛰어지고 나중에 재시도됩니다.
- `target`가 외부 목적지로 해석되지 않으면, 실행은 계속 이루어지지만 발신 메시지는 전송되지 않습니다.
- 하트비트 전용 응답은 세션을 **유지하지 않습니다**. 마지막 `updatedAt`이 복원되어 유휴 만료가 정상적으로 동작합니다.

## 가시성 제어

기본적으로 `HEARTBEAT_OK` 확인 응답은 억제되고, 알림 콘텐츠는 전달됩니다. 채널별 또는 계정별로 이를 조정할 수 있습니다:

```yaml
channels:
  defaults:
    heartbeat:
      showOk: false # Hide HEARTBEAT_OK (default)
      showAlerts: true # Show alert messages (default)
      useIndicator: true # Emit indicator events (default)
  telegram:
    heartbeat:
      showOk: true # Show OK acknowledgments on Telegram
  whatsapp:
    accounts:
      work:
        heartbeat:
          showAlerts: false # Suppress alert delivery for this account
```

우선순위: 계정별 → 채널별 → 채널 기본값 → 내장 기본값.

### 각 플래그의 동작

- `showOk`: 모델이 OK-only 응답을 반환할 때 `HEARTBEAT_OK` 확인 응답을 전송합니다.
- `showAlerts`: 모델이 non-OK 응답을 반환할 때 알림 콘텐츠를 전송합니다.
- `useIndicator`: UI 상태 표면을 위한 표시기 이벤트를 방출합니다.

**세 가지가 모두** false이면 OpenClaw는 하트비트 실행을 완전히 건너뜁니다(모델 호출 없음).

### 채널별 vs 계정별 예시

```yaml
channels:
  defaults:
    heartbeat:
      showOk: false
      showAlerts: true
      useIndicator: true
  slack:
    heartbeat:
      showOk: true # all Slack accounts
    accounts:
      ops:
        heartbeat:
          showAlerts: false # suppress alerts for the ops account only
  telegram:
    heartbeat:
      showOk: true
```

### 일반 패턴

| 목표                                | 설정                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| 기본 동작(조용한 OK, 알림 켜짐)     | _(설정 불필요)_                                                                          |
| 완전 무음(메시지 없음, 표시기 없음) | `channels.defaults.heartbeat: { showOk: false, showAlerts: false, useIndicator: false }` |
| 표시기 전용(메시지 없음)            | `channels.defaults.heartbeat: { showOk: false, showAlerts: false, useIndicator: true }`  |
| 한 채널에서만 OK                    | `channels.telegram.heartbeat: { showOk: true }`                                          |

## HEARTBEAT.md (선택 사항)

작업공간에 `HEARTBEAT.md` 파일이 존재하면, 기본 프롬프트는 에이전트에게 이를 읽으라고 지시합니다. 이를 "하트비트 체크리스트"로 생각하십시오. 작고, 안정적이며, 30분마다 포함해도 안전한 내용이어야 합니다.

`HEARTBEAT.md`이 존재하지만 사실상 비어 있는 경우(빈 줄과 `# Heading` 같은 markdown 헤더만 있음), OpenClaw는 API 호출을 절약하기 위해 하트비트 실행을 건너뜁니다. 파일이 없으면 하트비트는 여전히 실행되며, 모델이 무엇을 할지 결정합니다.

프롬프트 비대화를 피하려면 작게 유지하십시오(짧은 체크리스트 또는 리마인더).

`HEARTBEAT.md` 예시:

```md
# Heartbeat checklist

- Quick scan: anything urgent in inboxes?
- If it’s daytime, do a lightweight check-in if nothing else is pending.
- If a task is blocked, write down _what is missing_ and ask Peter next time.
```

### 에이전트가 HEARTBEAT.md를 업데이트할 수 있나요?

예 — 요청하면 가능합니다.

`HEARTBEAT.md`은 에이전트 작업공간의 일반 파일일 뿐이므로, 일반 채팅에서 에이전트에게 다음과 같이 말할 수 있습니다:

- "`HEARTBEAT.md`을 업데이트하여 매일 캘린더 확인을 추가해 주세요."
- "`HEARTBEAT.md`을 더 짧게, 수신함 후속에 집중하도록 다시 작성해 주세요."

이를 사전에 일어나게 하고 싶다면, 하트비트 프롬프트에 "체크리스트가 오래되면, 더 나은 것으로 HEARTBEAT.md를 업데이트하라" 같은 명시적 한 줄을 포함할 수도 있습니다.

안전 참고: 비밀 정보(API 키, 전화번호, 프라이빗 토큰)를 `HEARTBEAT.md`에 넣지 마십시오 — 프롬프트 컨텍스트의 일부가 됩니다.

## 수동 깨우기(온디맨드)

다음으로 시스템 이벤트를 큐에 넣고 즉시 하트비트를 트리거할 수 있습니다:

```bash
openclaw system event --text "Check for urgent follow-ups" --mode now
```

여러 에이전트에 `heartbeat`가 설정되어 있으면, 수동 깨우기는 그 에이전트 하트비트를 각각 즉시 실행합니다.

다음 예약된 틱을 기다리려면 `--mode next-heartbeat`를 사용하십시오.

## 추론 전달(선택 사항)

기본적으로 하트비트는 최종 "answer" 페이로드만 전달합니다.

투명성을 원한다면 다음을 활성화하십시오:

- `agents.defaults.heartbeat.includeReasoning: true`

활성화하면 하트비트는 `Reasoning:` 접두사가 붙은 별도 메시지도 함께 전달합니다(`/reasoning on`와 동일한 형태). 에이전트가 여러 세션/codex를 관리하고 있고 왜 사용자를 핑했는지 보고 싶을 때 유용할 수 있지만, 원치 않는 내부 디테일이 더 많이 노출될 수도 있습니다. 그룹 채팅에서는 꺼 두는 것을 권장합니다.

## 비용 인식

하트비트는 전체 에이전트 턴을 실행합니다. 간격이 짧을수록 더 많은 토큰을 소모합니다. `HEARTBEAT.md`을 작게 유지하고, 내부 상태 업데이트만 원한다면 더 저렴한 `model` 또는 `target: "none"`을 고려하십시오.
