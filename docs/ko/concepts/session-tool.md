---
summary: "세션을 나열하고, 기록을 가져오며, 세션 간 메시지를 전송하기 위한 에이전트 세션 도구"
read_when:
  - 세션 도구를 추가하거나 수정할 때
title: "세션 도구"
x-i18n:
  source_path: concepts/session-tool.md
  source_hash: cb6e0982ebf507bc
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:29:52Z
---

# 세션 도구

목표: 에이전트가 세션을 나열하고, 기록을 가져오며, 다른 세션으로 전송할 수 있도록 하는 작고 오용하기 어려운 도구 세트입니다.

## 도구 이름

- `sessions_list`
- `sessions_history`
- `sessions_send`
- `sessions_spawn`

## 키 모델

- 메인 다이렉트 채팅 버킷은 항상 리터럴 키 `"main"` 입니다(현재 에이전트의 메인 키로 해석됨).
- 그룹 채팅은 `agent:<agentId>:<channel>:group:<id>` 또는 `agent:<agentId>:<channel>:channel:<id>` 를 사용합니다(전체 키를 전달).
- 크론 작업은 `cron:<job.id>` 를 사용합니다.
- 훅은 명시적으로 설정되지 않는 한 `hook:<uuid>` 를 사용합니다.
- 노드 세션은 명시적으로 설정되지 않는 한 `node-<nodeId>` 를 사용합니다.

`global` 및 `unknown` 는 예약된 값이며 절대 나열되지 않습니다. `session.scope = "global"` 인 경우, 호출자가 `global` 을(를) 보지 않도록 모든 도구에서 이를 `main` 로 별칭 처리합니다.

## sessions_list

세션을 행 배열로 나열합니다.

매개변수:

- `kinds?: string[]` 필터: `"main" | "group" | "cron" | "hook" | "node" | "other"` 중 하나
- `limit?: number` 최대 행 수(기본값: 서버 기본값, 예: 200 으로 클램프)
- `activeMinutes?: number` 최근 N 분 이내에 업데이트된 세션만
- `messageLimit?: number` 0 = 메시지 없음(기본 0); >0 = 마지막 N 개 메시지 포함

동작:

- `messageLimit > 0` 는 세션별로 `chat.history` 를 가져오고 마지막 N 개 메시지를 포함합니다.
- 도구 결과는 목록 출력에서 필터링됩니다. 도구 메시지에는 `sessions_history` 를 사용합니다.
- **샌드박스 처리된** 에이전트 세션에서 실행할 때, 세션 도구는 기본적으로 **spawned-only 가시성**(아래 참조)으로 동작합니다.

행 형태(JSON):

- `key`: 세션 키(string)
- `kind`: `main | group | cron | hook | node | other`
- `channel`: `whatsapp | telegram | discord | signal | imessage | webchat | internal | unknown`
- `displayName` (가능한 경우 그룹 표시 레이블)
- `updatedAt` (ms)
- `sessionId`
- `model`, `contextTokens`, `totalTokens`
- `thinkingLevel`, `verboseLevel`, `systemSent`, `abortedLastRun`
- `sendPolicy` (설정된 경우 세션 오버라이드)
- `lastChannel`, `lastTo`
- `deliveryContext` (가능한 경우 정규화된 `{ channel, to, accountId }`)
- `transcriptPath` (스토어 디렉토리 + sessionId 에서 파생된 best-effort 경로)
- `messages?` (`messageLimit > 0` 인 경우에만)

## sessions_history

하나의 세션에 대한 트랜스크립트를 가져옵니다.

매개변수:

- `sessionKey` (필수; 세션 키 또는 `sessions_list` 의 `sessionId` 를 허용)
- `limit?: number` 최대 메시지 수(서버가 클램프)
- `includeTools?: boolean` (기본 false)

동작:

- `includeTools=false` 는 `role: "toolResult"` 메시지를 필터링합니다.
- 원시 트랜스크립트 형식으로 메시지 배열을 반환합니다.
- `sessionId` 이 주어지면, OpenClaw 가 이를 해당 세션 키로 해석합니다(존재하지 않는 id 오류).

## sessions_send

다른 세션으로 메시지를 보냅니다.

매개변수:

- `sessionKey` (필수; 세션 키 또는 `sessions_list` 의 `sessionId` 를 허용)
- `message` (필수)
- `timeoutSeconds?: number` (기본 >0; 0 = fire-and-forget)

동작:

- `timeoutSeconds = 0`: 큐에 넣고 `{ runId, status: "accepted" }` 를 반환합니다.
- `timeoutSeconds > 0`: 완료될 때까지 최대 N 초 대기한 뒤 `{ runId, status: "ok", reply }` 를 반환합니다.
- 대기가 타임아웃되면: `{ runId, status: "timeout", error }`. 실행은 계속되며, 나중에 `sessions_history` 를 호출합니다.
- 실행이 실패하면: `{ runId, status: "error", error }`.
- 전달 알림 실행은 기본 실행이 완료된 뒤 best-effort 로 수행되며, `status: "ok"` 는 알림이 전달되었음을 보장하지 않습니다.
- 대기는 gateway `agent.wait` (서버 측)로 수행되므로 재연결이 대기를 중단시키지 않습니다.
- 기본 실행에 대해 에이전트-대-에이전트 메시지 컨텍스트가 주입됩니다.
- 기본 실행이 완료된 뒤, OpenClaw 는 **reply-back 루프**를 실행합니다:
  - 2 라운드+는 요청자 에이전트와 대상 에이전트가 번갈아 수행합니다.
  - 핑퐁을 중단하려면 정확히 `REPLY_SKIP` 로 답변합니다.
  - 최대 턴 수는 `session.agentToAgent.maxPingPongTurns` (0–5, 기본 5)입니다.
- 루프가 끝나면, OpenClaw 는 **에이전트-대-에이전트 알림 단계**(대상 에이전트만)를 실행합니다:
  - 침묵을 유지하려면 정확히 `ANNOUNCE_SKIP` 로 답변합니다.
  - 그 외의 모든 답변은 대상 채널로 전송됩니다.
  - 알림 단계에는 원래 요청 + 1 라운드 답변 + 최신 핑퐁 답변이 포함됩니다.

## 채널 필드

- 그룹의 경우, `channel` 는 세션 엔트리에 기록된 채널입니다.
- 다이렉트 채팅의 경우, `channel` 는 `lastChannel` 에서 매핑됩니다.
- cron/hook/node 의 경우, `channel` 는 `internal` 입니다.
- 누락된 경우, `channel` 는 `unknown` 입니다.

## 보안 / 전송 정책

채널/채팅 유형별(세션 id 별이 아님) 정책 기반 차단입니다.

```json
{
  "session": {
    "sendPolicy": {
      "rules": [
        {
          "match": { "channel": "discord", "chatType": "group" },
          "action": "deny"
        }
      ],
      "default": "allow"
    }
  }
}
```

런타임 오버라이드(세션 엔트리별):

- `sendPolicy: "allow" | "deny"` (미설정 = 설정 상속)
- `sessions.patch` 또는 소유자 전용 `/send on|off|inherit` (독립 메시지)로 설정할 수 있습니다.

강제 적용 지점:

- `chat.send` / `agent` (gateway)
- 자동 응답 전달 로직

## sessions_spawn

격리된 세션에서 서브 에이전트 실행을 생성하고, 결과를 요청자 채팅 채널로 다시 알립니다.

매개변수:

- `task` (필수)
- `label?` (선택; 로그/UI 에 사용)
- `agentId?` (선택; 허용되는 경우 다른 에이전트 id 아래로 spawn)
- `model?` (선택; 서브 에이전트 모델을 오버라이드; 유효하지 않은 값 오류)
- `runTimeoutSeconds?` (기본 0; 설정 시 N 초 후 서브 에이전트 실행을 중단)
- `cleanup?` (`delete|keep`, 기본 `keep`)

허용 목록:

- `agents.list[].subagents.allowAgents`: `agentId` 를 통해 허용되는 에이전트 id 목록(`["*"]` 는 모든 항목을 허용). 기본값: 요청자 에이전트만.

디바이스 검색:

- `sessions_spawn` 에 대해 어떤 에이전트 id 가 허용되는지 확인하려면 `agents_list` 를 사용합니다.

동작:

- `deliver: false` 로 새로운 `agent:<agentId>:subagent:<uuid>` 세션을 시작합니다.
- 서브 에이전트는 기본적으로 전체 도구 세트에서 **세션 도구를 제외한** 구성을 사용합니다(`tools.subagents.tools` 로 구성 가능).
- 서브 에이전트는 `sessions_spawn` 을 호출할 수 없습니다(서브 에이전트 → 서브 에이전트 spawning 불가).
- 항상 비차단: 즉시 `{ status: "accepted", runId, childSessionKey }` 를 반환합니다.
- 완료 후, OpenClaw 는 서브 에이전트 **알림 단계**를 실행하고 결과를 요청자 채팅 채널에 게시합니다.
- 알림 단계 중 침묵을 유지하려면 정확히 `ANNOUNCE_SKIP` 로 답변합니다.
- 알림 답변은 `Status`/`Result`/`Notes` 로 정규화되며, `Status` 는 런타임 결과에서 오며(모델 텍스트가 아님).
- 서브 에이전트 세션은 `agents.defaults.subagents.archiveAfterMinutes` 이후 자동 아카이브됩니다(기본: 60).
- 알림 답변에는 통계 라인(런타임, 토큰, sessionKey/sessionId, 트랜스크립트 경로, 선택적 비용)이 포함됩니다.

## 샌드박스 세션 가시성

샌드박스 처리된 세션은 세션 도구를 사용할 수 있지만, 기본적으로 `sessions_spawn` 를 통해 자신이 spawn 한 세션만 볼 수 있습니다.

설정:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        // default: "spawned"
        sessionToolsVisibility: "spawned", // or "all"
      },
    },
  },
}
```
