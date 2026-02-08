---
summary: "채팅을 위한 세션 관리 규칙, 키, 그리고 영속성"
read_when:
  - 세션 처리 또는 저장소를 수정할 때
title: "세션 관리"
x-i18n:
  source_path: concepts/session.md
  source_hash: 1486759a5c2fdced
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:39:58Z
---

# 세션 관리

OpenClaw 는 **에이전트당 하나의 다이렉트 채팅 세션**을 기본으로 취급합니다. 다이렉트 채팅은 `agent:<agentId>:<mainKey>` (기본값 `main`)으로 통합되며, 그룹/채널 채팅은 각자 고유한 키를 가집니다. `session.mainKey` 가 준수됩니다.

**다이렉트 메시지**가 어떻게 그룹화되는지 제어하려면 `session.dmScope` 를 사용합니다.

- `main` (기본값): 모든 DM 이 연속성을 위해 메인 세션을 공유합니다.
- `per-peer`: 채널 전반에서 발신자 id 기준으로 격리합니다.
- `per-channel-peer`: 채널 + 발신자 기준으로 격리합니다 (다중 사용자 인박스에 권장).
- `per-account-channel-peer`: 계정 + 채널 + 발신자 기준으로 격리합니다 (다중 계정 인박스에 권장).
  `per-peer`, `per-channel-peer`, 또는 `per-account-channel-peer` 를 사용할 때 동일 인물이 채널 전반에서 하나의 DM 세션을 공유하도록, 프로바이더 접두사가 붙은 피어 id 를 정규 아이덴티티로 매핑하려면 `session.identityLinks` 를 사용합니다.

### 보안 DM 모드 (다중 사용자 설정에 권장)

> **보안 경고:** 에이전트가 **여러 사람**으로부터 DM 을 받을 수 있다면, 보안 DM 모드를 활성화하는 것을 강력히 권장합니다. 이를 사용하지 않으면 모든 사용자가 동일한 대화 컨텍스트를 공유하게 되어, 사용자 간에 개인 정보가 유출될 수 있습니다.

**기본 설정에서 발생하는 문제의 예:**

- Alice (`<SENDER_A>`)가 개인적인 주제(예: 병원 예약)에 대해 에이전트에게 메시지를 보냅니다.
- Bob (`<SENDER_B>`)가 에이전트에게 "우리가 무슨 얘기를 하고 있었지?"라고 묻습니다.
- 두 DM 이 동일한 세션을 공유하므로, 모델이 Alice 의 이전 컨텍스트를 사용해 Bob 에게 답변할 수 있습니다.

**해결 방법:** 사용자별로 세션을 격리하도록 `dmScope` 를 설정합니다.

```json5
// ~/.openclaw/openclaw.json
{
  session: {
    // Secure DM mode: isolate DM context per channel + sender.
    dmScope: "per-channel-peer",
  },
}
```

**이 기능을 활성화해야 하는 경우:**

- 둘 이상의 발신자에 대한 페어링 승인이 있는 경우
- 여러 항목이 있는 DM 허용 목록을 사용하는 경우
- `dmPolicy: "open"` 를 설정한 경우
- 여러 전화번호 또는 계정에서 에이전트로 메시지를 보낼 수 있는 경우

참고:

- 기본값은 연속성을 위한 `dmScope: "main"` (모든 DM 이 메인 세션을 공유)입니다. 이는 단일 사용자 설정에 적합합니다.
- 동일 채널의 다중 계정 인박스에는 `per-account-channel-peer` 를 권장합니다.
- 동일 인물이 여러 채널에서 연락하는 경우, DM 세션을 하나의 정규 아이덴티티로 통합하려면 `session.identityLinks` 를 사용합니다.
- `openclaw security audit` 로 DM 설정을 확인할 수 있습니다 ([security](/cli/security) 참조).

## Gateway 가 단일 진실의 출처입니다

모든 세션 상태는 **Gateway(게이트웨이)**(“마스터” OpenClaw)가 **소유**합니다. UI 클라이언트(macOS 앱, WebChat 등)는 로컬 파일을 읽는 대신 Gateway 에 세션 목록과 토큰 수를 질의해야 합니다.

- **원격 모드**에서는, 관심 있는 세션 저장소가 Mac 이 아니라 원격 Gateway 호스트에 있습니다.
- UI 에 표시되는 토큰 수는 Gateway 저장소 필드(`inputTokens`, `outputTokens`, `totalTokens`, `contextTokens`)에서 가져옵니다. 클라이언트는 JSONL 트랜스크립트를 파싱하여 합계를 “보정”하지 않습니다.

## 상태 저장 위치

- **Gateway 호스트**:
  - 저장 파일: `~/.openclaw/agents/<agentId>/sessions/sessions.json` (에이전트별).
- 트랜스크립트: `~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl` (Telegram 토픽 세션은 `.../<SessionId>-topic-<threadId>.jsonl` 사용).
- 저장소는 `sessionKey -> { sessionId, updatedAt, ... }` 맵입니다. 항목 삭제는 안전하며, 필요 시 다시 생성됩니다.
- 그룹 항목에는 UI 에서 세션을 라벨링하기 위해 `displayName`, `channel`, `subject`, `room`, `space` 가 포함될 수 있습니다.
- 세션 항목에는 UI 가 세션의 출처를 설명할 수 있도록 `origin` 메타데이터(라벨 + 라우팅 힌트)가 포함됩니다.
- OpenClaw 는 레거시 Pi/Tau 세션 폴더를 **읽지 않습니다**.

## 세션 정리

OpenClaw 는 기본적으로 LLM 호출 직전에 인메모리 컨텍스트에서 **오래된 도구 결과**를 제거합니다.
이는 JSONL 히스토리를 다시 작성하지 않습니다. [/concepts/session-pruning](/concepts/session-pruning)을 참고하십시오.

## 사전 컴팩션 메모리 플러시

세션이 자동 컴팩션에 근접하면, OpenClaw 는 **무음 메모리 플러시** 턴을 실행하여
모델이 내구성 있는 노트를 디스크에 기록하도록 상기시킬 수 있습니다. 이는
워크스페이스가 쓰기 가능할 때만 실행됩니다. [Memory](/concepts/memory) 및
[Compaction](/concepts/compaction)을 참고하십시오.

## 전송 수단 → 세션 키 매핑

- 다이렉트 채팅은 `session.dmScope` (기본값 `main`)을 따릅니다.
  - `main`: `agent:<agentId>:<mainKey>` (디바이스/채널 전반의 연속성).
    - 여러 전화번호와 채널이 동일한 에이전트 메인 키에 매핑될 수 있으며, 하나의 대화로 들어오는 전송 수단처럼 동작합니다.
  - `per-peer`: `agent:<agentId>:dm:<peerId>`.
  - `per-channel-peer`: `agent:<agentId>:<channel>:dm:<peerId>`.
  - `per-account-channel-peer`: `agent:<agentId>:<channel>:<accountId>:dm:<peerId>` (accountId 기본값은 `default`).
  - `session.identityLinks` 이 프로바이더 접두사가 붙은 피어 id(예: `telegram:123`)와 일치하면, 정규 키가 `<peerId>` 를 대체하여 동일 인물이 채널 전반에서 세션을 공유합니다.
- 그룹 채팅은 상태를 격리합니다: `agent:<agentId>:<channel>:group:<id>` (룸/채널은 `agent:<agentId>:<channel>:channel:<id>` 사용).
  - Telegram 포럼 토픽은 격리를 위해 그룹 id 에 `:topic:<threadId>` 를 추가합니다.
  - 레거시 `group:<id>` 키도 마이그레이션을 위해 계속 인식됩니다.
- 인바운드 컨텍스트는 여전히 `group:<id>` 를 사용할 수 있으며, 채널은 `Provider` 에서 추론되어 정규 `agent:<agentId>:<channel>:group:<id>` 형식으로 정규화됩니다.
- 기타 소스:
  - Cron 작업: `cron:<job.id>`
  - Webhook: `hook:<uuid>` (훅에서 명시적으로 설정하지 않은 경우)
  - 노드 실행: `node-<nodeId>`

## 라이프사이클

- 리셋 정책: 세션은 만료될 때까지 재사용되며, 만료 여부는 다음 인바운드 메시지에서 평가됩니다.
- 일일 리셋: 기본값은 **Gateway 호스트의 로컬 시간 기준 오전 4:00**입니다. 마지막 업데이트가 가장 최근의 일일 리셋 시각보다 이전이면 세션은 오래된 것으로 간주됩니다.
- 유휴 리셋(선택 사항): `idleMinutes` 는 슬라이딩 유휴 창을 추가합니다. 일일 리셋과 유휴 리셋이 모두 설정된 경우, **더 먼저 만료되는 쪽**이 새 세션을 강제합니다.
- 레거시 유휴 전용: `session.idleMinutes` 만 설정하고 `session.reset`/`resetByType` 구성이 없는 경우, 하위 호환성을 위해 OpenClaw 는 유휴 전용 모드로 유지됩니다.
- 유형별 재정의(선택 사항): `resetByType` 를 사용하면 `dm`, `group`, `thread` 세션에 대한 정책을 재정의할 수 있습니다 (thread = Slack/Discord 스레드, Telegram 토픽, 커넥터에서 제공되는 경우 Matrix 스레드).
- 채널별 재정의(선택 사항): `resetByChannel` 는 채널에 대한 리셋 정책을 재정의합니다 (해당 채널의 모든 세션 유형에 적용되며 `reset`/`resetByType` 보다 우선합니다).
- 리셋 트리거: 정확한 `/new` 또는 `/reset` (그리고 `resetTriggers` 의 추가 항목)가 수신되면 새 세션 id 를 시작하고 메시지의 나머지를 전달합니다. `/new <model>` 는 모델 별칭, `provider/model`, 또는 프로바이더 이름(퍼지 매칭)을 받아 새 세션 모델을 설정합니다. `/new` 또는 `/reset` 만 단독으로 전송되면, OpenClaw 는 리셋을 확인하기 위해 짧은 “hello” 인사 턴을 실행합니다.
- 수동 리셋: 저장소에서 특정 키를 삭제하거나 JSONL 트랜스크립트를 제거합니다. 다음 메시지가 이를 재생성합니다.
- 격리된 Cron 작업은 실행마다 항상 새로운 `sessionId` 를 발급합니다 (유휴 재사용 없음).

## 전송 정책 (선택 사항)

개별 id 를 나열하지 않고도 특정 세션 유형에 대한 전송을 차단합니다.

```json5
{
  session: {
    sendPolicy: {
      rules: [
        { action: "deny", match: { channel: "discord", chatType: "group" } },
        { action: "deny", match: { keyPrefix: "cron:" } },
      ],
      default: "allow",
    },
  },
}
```

런타임 재정의(소유자 전용):

- `/send on` → 이 세션에 대해 허용
- `/send off` → 이 세션에 대해 거부
- `/send inherit` → 재정의를 해제하고 설정 규칙을 사용
  등록되도록 단독 메시지로 전송하십시오.

## 설정 (선택 사항 이름 변경 예시)

```json5
// ~/.openclaw/openclaw.json
{
  session: {
    scope: "per-sender", // keep group keys separate
    dmScope: "main", // DM continuity (set per-channel-peer/per-account-channel-peer for shared inboxes)
    identityLinks: {
      alice: ["telegram:123456789", "discord:987654321012345678"],
    },
    reset: {
      // Defaults: mode=daily, atHour=4 (gateway host local time).
      // If you also set idleMinutes, whichever expires first wins.
      mode: "daily",
      atHour: 4,
      idleMinutes: 120,
    },
    resetByType: {
      thread: { mode: "daily", atHour: 4 },
      dm: { mode: "idle", idleMinutes: 240 },
      group: { mode: "idle", idleMinutes: 120 },
    },
    resetByChannel: {
      discord: { mode: "idle", idleMinutes: 10080 },
    },
    resetTriggers: ["/new", "/reset"],
    store: "~/.openclaw/agents/{agentId}/sessions/sessions.json",
    mainKey: "main",
  },
}
```

## 검사

- `openclaw status` — 저장소 경로와 최근 세션을 표시합니다.
- `openclaw sessions --json` — 모든 항목을 덤프합니다 (`--active <minutes>` 로 필터링).
- `openclaw gateway call sessions.list --params '{}'` — 실행 중인 Gateway 에서 세션을 가져옵니다 (원격 Gateway 접근에는 `--url`/`--token` 사용).
- 채팅에서 `/status` 를 단독 메시지로 보내면 에이전트의 도달 가능 여부, 사용 중인 세션 컨텍스트의 양, 현재 thinking/verbose 토글, WhatsApp 웹 자격 증명이 마지막으로 갱신된 시각을 확인할 수 있습니다 (재연결 필요 여부 파악에 도움).
- `/context list` 또는 `/context detail` 를 보내면 시스템 프롬프트와 주입된 워크스페이스 파일(그리고 가장 큰 컨텍스트 기여자)을 확인할 수 있습니다.
- `/stop` 를 단독 메시지로 보내면 현재 실행을 중단하고, 해당 세션에 대해 대기 중인 후속 작업을 지우며, 여기서 파생된 모든 서브 에이전트 실행을 중지합니다 (응답에 중지된 개수가 포함됨).
- `/compact` (선택적 지침)을 단독 메시지로 보내면 오래된 컨텍스트를 요약하여 창 공간을 확보합니다. [/concepts/compaction](/concepts/compaction)을 참고하십시오.
- JSONL 트랜스크립트는 전체 턴을 검토하기 위해 직접 열 수 있습니다.

## 팁

- 기본 키는 1:1 트래픽 전용으로 유지하고, 그룹은 각자의 키를 사용하게 하십시오.
- 정리 작업을 자동화할 때는 전체 저장소가 아니라 개별 키를 삭제하여 다른 곳의 컨텍스트를 보존하십시오.

## 세션 출처 메타데이터

각 세션 항목은 최선의 노력 기준으로 `origin` 에 출처를 기록합니다.

- `label`: 사람이 읽을 수 있는 라벨(대화 라벨 + 그룹 주제/채널에서 해석)
- `provider`: 정규화된 채널 id(확장 포함)
- `from`/`to`: 인바운드 봉투의 원시 라우팅 id
- `accountId`: 프로바이더 계정 id(다중 계정인 경우)
- `threadId`: 채널이 지원하는 경우 스레드/토픽 id
  출처 필드는 다이렉트 메시지, 채널, 그룹에 대해 채워집니다. 커넥터가
  전달 라우팅만 업데이트하는 경우(예: DM 메인 세션을 최신 상태로 유지),
  세션이 설명 메타데이터를 유지하도록 인바운드 컨텍스트를 제공해야 합니다.
  확장은 인바운드 컨텍스트에 `ConversationLabel`,
  `GroupSubject`, `GroupChannel`, `GroupSpace`, `SenderName` 를 전송하고
  `recordSessionMetaFromInbound` 를 호출하거나(또는 동일한 컨텍스트를 `updateLastRoute` 에 전달하여)
  이를 수행할 수 있습니다.
