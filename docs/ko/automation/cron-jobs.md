---
summary: "Gateway 스케줄러를 위한 크론 작업 + 웨이크업"
read_when:
  - 백그라운드 작업이나 웨이크업을 스케줄링할 때
  - 하트비트와 함께 또는 하트비트와 연동되어 실행되어야 하는 자동화를 연결할 때
  - 예약 작업에서 하트비트와 크론 중 무엇을 사용할지 결정할 때
title: "Cron Jobs"
x-i18n:
  source_path: automation/cron-jobs.md
  source_hash: 523721a7da2c4e27
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:29Z
---

# Cron jobs (Gateway 스케줄러)

> **Cron vs Heartbeat?** 각각을 언제 사용해야 하는지에 대한 가이드는 [Cron vs Heartbeat](/automation/cron-vs-heartbeat)를 참고하십시오.

Cron 은 Gateway 에 내장된 스케줄러입니다. 작업을 영속적으로 저장하고,
적절한 시점에 에이전트를 깨우며, 선택적으로 출력 결과를 채팅으로 전달할 수 있습니다.

_“매일 아침 실행”_ 이나 _“20분 후에 에이전트를 찌르기”_ 같은 작업을 원한다면,
cron 이 그 메커니즘입니다.

## TL;DR

- Cron 은 **Gateway 내부에서 실행됩니다** (모델 내부가 아님).
- 작업은 `~/.openclaw/cron/` 아래에 저장되므로 재시작해도 스케줄이 사라지지 않습니다.
- 두 가지 실행 스타일:
  - **메인 세션**: 시스템 이벤트를 큐에 넣고 다음 하트비트에서 실행.
  - **격리 실행**: `cron:<jobId>` 에서 전용 에이전트 턴을 실행하며, 전달 방식(기본값은 announce 또는 none)을 선택.
- 웨이크업은 1급 기능입니다. 작업은 “지금 깨우기” 또는 “다음 하트비트”를 요청할 수 있습니다.

## Quick start (실행 가능한 예)

원샷 알림을 생성하고, 존재 여부를 확인한 뒤 즉시 실행합니다:

```bash
openclaw cron add \
  --name "Reminder" \
  --at "2026-02-01T16:00:00Z" \
  --session main \
  --system-event "Reminder: check the cron docs draft" \
  --wake now \
  --delete-after-run

openclaw cron list
openclaw cron run <job-id> --force
openclaw cron runs --id <job-id>
```

전달을 포함한 반복 격리 작업을 스케줄링합니다:

```bash
openclaw cron add \
  --name "Morning brief" \
  --cron "0 7 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize overnight updates." \
  --announce \
  --channel slack \
  --to "channel:C1234567890"
```

## Tool-call equivalents (Gateway cron 도구)

정식 JSON 형태와 예시는 [JSON schema for tool calls](/automation/cron-jobs#json-schema-for-tool-calls)를 참고하십시오.

## 크론 작업이 저장되는 위치

크론 작업은 기본적으로 Gateway 호스트의 `~/.openclaw/cron/jobs.json` 에 저장됩니다.
Gateway 는 파일을 메모리로 로드한 뒤 변경 시 다시 기록하므로,
수동 편집은 Gateway 가 중지된 상태에서만 안전합니다. 변경 시에는
`openclaw cron add/edit` 또는 cron 도구 호출 API 사용을 권장합니다.

## 초보자 친화적 개요

크론 작업은 이렇게 생각할 수 있습니다: **언제 실행할지** + **무엇을 할지**.

1. **스케줄 선택**
   - 원샷 알림 → `schedule.kind = "at"` (CLI: `--at`)
   - 반복 작업 → `schedule.kind = "every"` 또는 `schedule.kind = "cron"`
   - ISO 타임스탬프에 타임존이 없으면 **UTC** 로 처리됩니다.

2. **실행 위치 선택**
   - `sessionTarget: "main"` → 메인 컨텍스트로 다음 하트비트에서 실행.
   - `sessionTarget: "isolated"` → `cron:<jobId>` 에서 전용 에이전트 턴 실행.

3. **페이로드 선택**
   - 메인 세션 → `payload.kind = "systemEvent"`
   - 격리 세션 → `payload.kind = "agentTurn"`

선택 사항: 원샷 작업(`schedule.kind = "at"`)은 기본적으로 성공 후 삭제됩니다.
유지하려면 `deleteAfterRun: false` 를 설정하십시오(성공 후 비활성화됩니다).

## 개념

### Jobs

크론 작업은 다음을 포함하는 저장된 레코드입니다:

- **스케줄** (언제 실행되는지),
- **페이로드** (무엇을 하는지),
- 선택적 **전달 모드** (announce 또는 none).
- 선택적 **에이전트 바인딩** (`agentId`): 특정 에이전트로 실행하며,
  없거나 알 수 없는 경우 Gateway 는 기본 에이전트로 폴백합니다.

작업은 안정적인 `jobId` 로 식별됩니다(CLI/Gateway API 에서 사용).
에이전트 도구 호출에서는 `jobId` 가 정식이며,
레거시 `id` 도 호환을 위해 허용됩니다.
원샷 작업은 기본적으로 성공 후 자동 삭제되며,
유지하려면 `deleteAfterRun: false` 를 설정하십시오.

### Schedules

Cron 은 세 가지 스케줄 유형을 지원합니다:

- `at`: `schedule.at` (ISO 8601) 를 사용하는 원샷 타임스탬프.
- `every`: 고정 간격(ms).
- `cron`: 선택적 IANA 타임존을 포함한 5필드 크론 표현식.

크론 표현식은 `croner` 을 사용합니다. 타임존이 생략되면
Gateway 호스트의 로컬 타임존이 사용됩니다.

### 메인 vs 격리 실행

#### 메인 세션 작업 (시스템 이벤트)

메인 작업은 시스템 이벤트를 큐에 넣고 필요 시 하트비트 러너를 깨웁니다.
`payload.kind = "systemEvent"` 를 사용해야 합니다.

- `wakeMode: "next-heartbeat"` (기본값): 다음 예약된 하트비트를 기다립니다.
- `wakeMode: "now"`: 즉시 하트비트를 트리거합니다.

일반적인 하트비트 프롬프트 + 메인 세션 컨텍스트가 필요할 때 가장 적합합니다.
[Heartbeat](/gateway/heartbeat)를 참고하십시오.

#### 격리 작업 (전용 크론 세션)

격리 작업은 세션 `cron:<jobId>` 에서 전용 에이전트 턴을 실행합니다.

주요 동작:

- 프롬프트 앞에 추적을 위해 `[cron:<jobId> <job name>]` 이 붙습니다.
- 각 실행은 **새로운 세션 id** 로 시작합니다(이전 대화 이어받지 않음).
- 기본 동작: `delivery` 이 생략되면 격리 작업은 요약을 announce 합니다(`delivery.mode = "announce"`).
- `delivery.mode` (격리 전용)으로 동작을 선택합니다:
  - `announce`: 대상 채널로 요약을 전달하고 메인 세션에 간단한 요약을 게시.
  - `none`: 내부 전용(전달 없음, 메인 세션 요약 없음).
- `wakeMode` 는 메인 세션 요약 게시 시점을 제어합니다:
  - `now`: 즉시 하트비트.
  - `next-heartbeat`: 다음 예약된 하트비트까지 대기.

시끄럽거나 빈번한 작업, 또는 메인 채팅 기록을 어지럽히지 말아야 할
“백그라운드 잡무”에는 격리 작업을 사용하십시오.

### 페이로드 형태 (무엇이 실행되는지)

두 가지 페이로드 유형을 지원합니다:

- `systemEvent`: 메인 세션 전용, 하트비트 프롬프트를 통해 라우팅됨.
- `agentTurn`: 격리 세션 전용, 전용 에이전트 턴 실행.

공통 `agentTurn` 필드:

- `message`: 필수 텍스트 프롬프트.
- `model` / `thinking`: 선택적 오버라이드(아래 참고).
- `timeoutSeconds`: 선택적 타임아웃 오버라이드.

전달 설정(격리 작업 전용):

- `delivery.mode`: `none` | `announce`.
- `delivery.channel`: `last` 또는 특정 채널.
- `delivery.to`: 채널별 대상(전화/채팅/채널 id).
- `delivery.bestEffort`: announce 전달 실패 시 작업 실패를 방지.

Announce 전달은 해당 실행 동안 메시징 도구 전송을 억제합니다.
대신 `delivery.channel`/`delivery.to` 를 사용해 채팅을 대상으로 지정하십시오.
`delivery.mode = "none"` 인 경우 메인 세션에 요약이 게시되지 않습니다.

격리 작업에서 `delivery` 이 생략되면 OpenClaw 는 기본값으로 `announce` 를 사용합니다.

#### Announce 전달 흐름

`delivery.mode = "announce"` 인 경우 cron 은 아웃바운드 채널 어댑터를 통해 직접 전달합니다.
메시지를 작성하거나 전달하기 위해 메인 에이전트는 실행되지 않습니다.

동작 상세:

- 콘텐츠: 격리 실행의 아웃바운드 페이로드(텍스트/미디어)를 정상적인 청킹과
  채널 포맷팅으로 전달합니다.
- 하트비트 전용 응답(`HEARTBEAT_OK` 이고 실제 콘텐츠가 없는 경우)은 전달되지 않습니다.
- 격리 실행이 이미 메시지 도구로 동일 대상에 메시지를 보낸 경우,
  중복을 피하기 위해 전달을 건너뜁니다.
- 대상이 없거나 유효하지 않으면 `delivery.bestEffort = true` 가 없는 한 작업이 실패합니다.
- 짧은 요약은 `delivery.mode = "announce"` 인 경우에만 메인 세션에 게시됩니다.
- 메인 세션 요약은 `wakeMode` 를 따릅니다:
  `now` 는 즉시 하트비트를 트리거하고,
  `next-heartbeat` 은 다음 예약된 하트비트를 기다립니다.

### 모델 및 thinking 오버라이드

격리 작업(`agentTurn`)은 모델과 thinking 레벨을 오버라이드할 수 있습니다:

- `model`: 프로바이더/모델 문자열(예: `anthropic/claude-sonnet-4-20250514`) 또는 별칭(예: `opus`)
- `thinking`: Thinking 레벨(`off`, `minimal`, `low`, `medium`, `high`, `xhigh`; GPT-5.2 + Codex 모델 전용)

참고: 메인 세션 작업에서도 `model` 를 설정할 수 있지만,
공유 메인 세션 모델이 변경됩니다. 예기치 않은 컨텍스트 변화를 피하기 위해
모델 오버라이드는 격리 작업에만 사용하는 것을 권장합니다.

해결 우선순위:

1. 작업 페이로드 오버라이드(최상위)
2. 훅별 기본값(예: `hooks.gmail.model`)
3. 에이전트 설정 기본값

### 전달 (채널 + 대상)

격리 작업은 최상위 `delivery` 설정을 통해 채널로 출력을 전달할 수 있습니다:

- `delivery.mode`: `announce` (요약 전달) 또는 `none`.
- `delivery.channel`: `whatsapp` / `telegram` / `discord` / `slack` / `mattermost` (플러그인) / `signal` / `imessage` / `last`.
- `delivery.to`: 채널별 수신 대상.

전달 설정은 격리 작업에만 유효합니다(`sessionTarget: "isolated"`).

`delivery.channel` 또는 `delivery.to` 이 생략되면,
cron 은 메인 세션의 “마지막 라우트”(에이전트가 마지막으로 응답한 위치)로 폴백할 수 있습니다.

대상 형식 유의사항:

- Slack/Discord/Mattermost(플러그인) 대상은 모호성을 피하기 위해
  명시적 접두사(예: `channel:<id>`, `user:<id>`)를 사용해야 합니다.
- Telegram 토픽은 `:topic:` 형식을 사용해야 합니다(아래 참고).

#### Telegram 전달 대상 (토픽 / 포럼 스레드)

Telegram 은 `message_thread_id` 를 통해 포럼 토픽을 지원합니다.
cron 전달 시 `to` 필드에 토픽/스레드를 인코딩할 수 있습니다:

- `-1001234567890` (채팅 id 만)
- `-1001234567890:topic:123` (권장: 명시적 토픽 마커)
- `-1001234567890:123` (축약형: 숫자 접미사)

`telegram:...` / `telegram:group:...` 같은 접두사 대상도 허용됩니다:

- `telegram:group:-1001234567890:topic:123`

## JSON schema for tool calls

Gateway `cron.*` 도구를 직접 호출할 때(에이전트 도구 호출 또는 RPC)
다음 형태를 사용하십시오. CLI 플래그는 `20m` 같은 사람이 읽기 쉬운
duration 을 허용하지만, 도구 호출에서는 `schedule.at` 에 ISO 8601 문자열을,
`schedule.everyMs` 에는 밀리초를 사용해야 합니다.

### cron.add params

원샷, 메인 세션 작업(시스템 이벤트):

```json
{
  "name": "Reminder",
  "schedule": { "kind": "at", "at": "2026-02-01T16:00:00Z" },
  "sessionTarget": "main",
  "wakeMode": "now",
  "payload": { "kind": "systemEvent", "text": "Reminder text" },
  "deleteAfterRun": true
}
```

반복, 전달 포함 격리 작업:

```json
{
  "name": "Morning brief",
  "schedule": { "kind": "cron", "expr": "0 7 * * *", "tz": "America/Los_Angeles" },
  "sessionTarget": "isolated",
  "wakeMode": "next-heartbeat",
  "payload": {
    "kind": "agentTurn",
    "message": "Summarize overnight updates."
  },
  "delivery": {
    "mode": "announce",
    "channel": "slack",
    "to": "channel:C1234567890",
    "bestEffort": true
  }
}
```

참고:

- `schedule.kind`: `at` (`at`), `every` (`everyMs`), 또는
  `cron` (`expr`, 선택적 `tz`).
- `schedule.at` 는 ISO 8601 을 허용합니다(타임존 선택적; 생략 시 UTC 로 처리).
- `everyMs` 는 밀리초입니다.
- `sessionTarget` 는 `"main"` 또는 `"isolated"` 여야 하며,
  `payload.kind` 과 일치해야 합니다.
- 선택적 필드: `agentId`, `description`, `enabled`, `deleteAfterRun`
  (`at` 의 경우 기본값은 true),
  `delivery`.
- `wakeMode` 는 생략 시 `"next-heartbeat"` 로 기본 설정됩니다.

### cron.update params

```json
{
  "jobId": "job-123",
  "patch": {
    "enabled": false,
    "schedule": { "kind": "every", "everyMs": 3600000 }
  }
}
```

참고:

- `jobId` 가 정식이며, `id` 도 호환을 위해 허용됩니다.
- 에이전트 바인딩을 제거하려면 패치에 `agentId: null` 를 사용하십시오.

### cron.run 및 cron.remove params

```json
{ "jobId": "job-123", "mode": "force" }
```

```json
{ "jobId": "job-123" }
```

## 저장소 & 히스토리

- 작업 저장소: `~/.openclaw/cron/jobs.json` (Gateway 관리 JSON).
- 실행 히스토리: `~/.openclaw/cron/runs/<jobId>.jsonl` (JSONL, 자동 정리).
- 저장소 경로 오버라이드: 설정에서 `cron.store`.

## Configuration

```json5
{
  cron: {
    enabled: true, // default true
    store: "~/.openclaw/cron/jobs.json",
    maxConcurrentRuns: 1, // default 1
  },
}
```

cron 을 완전히 비활성화:

- `cron.enabled: false` (config)
- `OPENCLAW_SKIP_CRON=1` (env)

## CLI quickstart

원샷 알림(UTC ISO, 성공 후 자동 삭제):

```bash
openclaw cron add \
  --name "Send reminder" \
  --at "2026-01-12T18:00:00Z" \
  --session main \
  --system-event "Reminder: submit expense report." \
  --wake now \
  --delete-after-run
```

원샷 알림(메인 세션, 즉시 깨우기):

```bash
openclaw cron add \
  --name "Calendar check" \
  --at "20m" \
  --session main \
  --system-event "Next heartbeat: check calendar." \
  --wake now
```

반복 격리 작업(WhatsApp 으로 announce):

```bash
openclaw cron add \
  --name "Morning status" \
  --cron "0 7 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize inbox + calendar for today." \
  --announce \
  --channel whatsapp \
  --to "+15551234567"
```

반복 격리 작업(Telegram 토픽으로 전달):

```bash
openclaw cron add \
  --name "Nightly summary (topic)" \
  --cron "0 22 * * *" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Summarize today; send to the nightly topic." \
  --announce \
  --channel telegram \
  --to "-1001234567890:topic:123"
```

모델 및 thinking 오버라이드를 포함한 격리 작업:

```bash
openclaw cron add \
  --name "Deep analysis" \
  --cron "0 6 * * 1" \
  --tz "America/Los_Angeles" \
  --session isolated \
  --message "Weekly deep analysis of project progress." \
  --model "opus" \
  --thinking high \
  --announce \
  --channel whatsapp \
  --to "+15551234567"
```

에이전트 선택(멀티 에이전트 구성):

```bash
# Pin a job to agent "ops" (falls back to default if that agent is missing)
openclaw cron add --name "Ops sweep" --cron "0 6 * * *" --session isolated --message "Check ops queue" --agent ops

# Switch or clear the agent on an existing job
openclaw cron edit <jobId> --agent ops
openclaw cron edit <jobId> --clear-agent
```

수동 실행(디버그):

```bash
openclaw cron run <jobId> --force
```

기존 작업 편집(필드 패치):

```bash
openclaw cron edit <jobId> \
  --message "Updated prompt" \
  --model "opus" \
  --thinking low
```

실행 히스토리:

```bash
openclaw cron runs --id <jobId> --limit 50
```

작업을 생성하지 않고 즉시 시스템 이벤트 실행:

```bash
openclaw system event --mode now --text "Next heartbeat: check battery."
```

## Gateway API surface

- `cron.list`, `cron.status`, `cron.add`, `cron.update`, `cron.remove`
- `cron.run` (force 또는 due), `cron.runs`
  작업 없이 즉시 시스템 이벤트를 실행하려면 [`openclaw system event`](/cli/system)를 사용하십시오.

## Troubleshooting

### “아무것도 실행되지 않음”

- cron 이 활성화되어 있는지 확인하십시오: `cron.enabled` 및 `OPENCLAW_SKIP_CRON`.
- Gateway 가 지속적으로 실행 중인지 확인하십시오(cron 은 Gateway 프로세스 내부에서 실행됨).
- `cron` 스케줄의 경우 타임존(`--tz`)과 호스트 타임존을 확인하십시오.

### Telegram 이 잘못된 위치로 전달됨

- 포럼 토픽의 경우 `-100…:topic:<id>` 를 사용해 명확하고 모호하지 않게 지정하십시오.
- 로그나 저장된 “last route” 대상에서 `telegram:...` 접두사가 보이는 것은 정상입니다.
  cron 전달은 이를 허용하며 토픽 id 도 올바르게 파싱합니다.
