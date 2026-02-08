---
summary: "signal-cli(JSON-RPC + SSE)를 통한 Signal 지원, 설정, 번호 모델"
read_when:
  - Signal 지원 설정하기
  - Signal 송수신 디버깅
title: "Signal"
x-i18n:
  source_path: channels/signal.md
  source_hash: ca4de8b3685017f5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:25Z
---

# Signal (signal-cli)

상태: 외부 CLI 통합. Gateway(게이트웨이)는 HTTP JSON-RPC + SSE를 통해 `signal-cli` 와 통신합니다.

## 빠른 설정 (초보자)

1. 봇용으로 **별도의 Signal 번호**를 사용합니다 (권장).
2. `signal-cli` 를 설치합니다 (Java 필요).
3. 봇 디바이스를 연결하고 데몬을 시작합니다:
   - `signal-cli link -n "OpenClaw"`
4. OpenClaw 를 설정하고 게이트웨이를 시작합니다.

최소 설정:

```json5
{
  channels: {
    signal: {
      enabled: true,
      account: "+15551234567",
      cliPath: "signal-cli",
      dmPolicy: "pairing",
      allowFrom: ["+15557654321"],
    },
  },
}
```

## 무엇인가요

- `signal-cli` 를 통한 Signal 채널 (libsignal 내장 라이브러리 아님).
- 결정적 라우팅: 답장은 항상 Signal 로 되돌아갑니다.
- 다이렉트 메시지는 에이전트의 메인 세션을 공유하며, 그룹은 분리됩니다 (`agent:<agentId>:signal:group:<groupId>`).

## 설정 쓰기

기본적으로 Signal 은 `/config set|unset` 에 의해 트리거되는 설정 업데이트를 쓸 수 있습니다 (`commands.config: true` 필요).

비활성화하려면:

```json5
{
  channels: { signal: { configWrites: false } },
}
```

## 번호 모델 (중요)

- 게이트웨이는 **Signal 디바이스**(`signal-cli` 계정)에 연결합니다.
- **개인 Signal 계정**에서 봇을 실행하면, 자신의 메시지는 무시됩니다 (루프 보호).
- "내가 봇에게 문자를 보내면 봇이 답장한다" 시나리오를 원하면 **별도의 봇 번호**를 사용합니다.

## 설정 (빠른 경로)

1. `signal-cli` 를 설치합니다 (Java 필요).
2. 봇 계정을 연결합니다:
   - `signal-cli link -n "OpenClaw"` 실행 후 Signal 에서 QR 을 스캔합니다.
3. Signal 을 설정하고 게이트웨이를 시작합니다.

예시:

```json5
{
  channels: {
    signal: {
      enabled: true,
      account: "+15551234567",
      cliPath: "signal-cli",
      dmPolicy: "pairing",
      allowFrom: ["+15557654321"],
    },
  },
}
```

다중 계정 지원: 계정별 설정과 선택적 `name` 와 함께 `channels.signal.accounts` 를 사용합니다. 공통 패턴은 [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts) 를 참고하세요.

## 외부 데몬 모드 (httpUrl)

`signal-cli` 를 직접 관리하고 싶다면 (느린 JVM 콜드 스타트, 컨테이너 초기화, 또는 공유 CPU 등), 데몬을 별도로 실행하고 OpenClaw 에서 이를 가리키도록 설정합니다:

```json5
{
  channels: {
    signal: {
      httpUrl: "http://127.0.0.1:8080",
      autoStart: false,
    },
  },
}
```

이렇게 하면 OpenClaw 내부의 자동 생성과 시작 대기를 건너뜁니다. 자동 생성 시 느린 시작이 발생한다면 `channels.signal.startupTimeoutMs` 를 설정합니다.

## 접근 제어 (다이렉트 메시지 + 그룹)

다이렉트 메시지:

- 기본값: `channels.signal.dmPolicy = "pairing"`.
- 알 수 없는 발신자는 페어링 코드를 받으며, 승인될 때까지 메시지는 무시됩니다 (코드는 1시간 후 만료).
- 승인 방법:
  - `openclaw pairing list signal`
  - `openclaw pairing approve signal <CODE>`
- 페어링은 Signal 다이렉트 메시지의 기본 토큰 교환 방식입니다. 자세한 내용은 [Pairing](/start/pairing) 을 참고하세요.
- (`sourceUuid` 에서 온) UUID 전용 발신자는 `channels.signal.allowFrom` 에서 `uuid:<id>` 로 저장됩니다.

그룹:

- `channels.signal.groupPolicy = open | allowlist | disabled`.
- `allowlist` 가 설정된 경우, `channels.signal.groupAllowFrom` 가 그룹에서 누가 트리거할 수 있는지 제어합니다.

## 동작 방식 (행동)

- `signal-cli` 는 데몬으로 실행되며, 게이트웨이는 SSE 를 통해 이벤트를 읽습니다.
- 수신 메시지는 공통 채널 엔벨로프로 정규화됩니다.
- 답장은 항상 동일한 번호 또는 그룹으로 라우팅됩니다.

## 미디어 + 제한

- 발신 텍스트는 `channels.signal.textChunkLimit` 로 분할됩니다 (기본값 4000).
- 선택적 줄바꿈 분할: 길이 분할 전에 빈 줄(문단 경계) 기준으로 나누려면 `channels.signal.chunkMode="newline"` 를 설정합니다.
- 첨부 파일 지원 ( `signal-cli` 에서 base64 로 가져옴).
- 기본 미디어 한도: `channels.signal.mediaMaxMb` (기본값 8).
- `channels.signal.ignoreAttachments` 를 사용하면 미디어 다운로드를 건너뜁니다.
- 그룹 히스토리 컨텍스트는 `channels.signal.historyLimit` (또는 `channels.signal.accounts.*.historyLimit`) 를 사용하며, `messages.groupChat.historyLimit` 로 폴백합니다. 비활성화하려면 `0` 를 설정합니다 (기본값 50).

## 타이핑 + 읽음 확인

- **타이핑 표시기**: OpenClaw 는 `signal-cli sendTyping` 를 통해 타이핑 신호를 전송하며, 응답이 실행되는 동안 이를 갱신합니다.
- **읽음 확인**: `channels.signal.sendReadReceipts` 가 true 인 경우, OpenClaw 는 허용된 다이렉트 메시지에 대해 읽음 확인을 전달합니다.
- Signal-cli 는 그룹에 대한 읽음 확인을 노출하지 않습니다.

## 리액션 (메시지 도구)

- `channel=signal` 와 함께 `message action=react` 를 사용합니다.
- 대상: 발신자 E.164 또는 UUID (페어링 출력의 `uuid:<id>` 사용; 순수 UUID 도 사용 가능).
- `messageId` 는 리액션할 메시지의 Signal 타임스탬프입니다.
- 그룹 리액션에는 `targetAuthor` 또는 `targetAuthorUuid` 이 필요합니다.

예시:

```
message action=react channel=signal target=uuid:123e4567-e89b-12d3-a456-426614174000 messageId=1737630212345 emoji=🔥
message action=react channel=signal target=+15551234567 messageId=1737630212345 emoji=🔥 remove=true
message action=react channel=signal target=signal:group:<groupId> targetAuthor=uuid:<sender-uuid> messageId=1737630212345 emoji=✅
```

설정:

- `channels.signal.actions.reactions`: 리액션 동작 활성화/비활성화 (기본값 true).
- `channels.signal.reactionLevel`: `off | ack | minimal | extensive`.
  - `off`/`ack` 는 에이전트 리액션을 비활성화합니다 (메시지 도구 `react` 는 오류 발생).
  - `minimal`/`extensive` 는 에이전트 리액션을 활성화하고 가이드 수준을 설정합니다.
- 계정별 오버라이드: `channels.signal.accounts.<id>.actions.reactions`, `channels.signal.accounts.<id>.reactionLevel`.

## 전송 대상 (CLI/cron)

- 다이렉트 메시지: `signal:+15551234567` (또는 일반 E.164).
- UUID 다이렉트 메시지: `uuid:<id>` (또는 순수 UUID).
- 그룹: `signal:group:<groupId>`.
- 사용자 이름: `username:<name>` (Signal 계정에서 지원되는 경우).

## 설정 참조 (Signal)

전체 설정: [Configuration](/gateway/configuration)

프로바이더 옵션:

- `channels.signal.enabled`: 채널 시작 활성화/비활성화.
- `channels.signal.account`: 봇 계정의 E.164.
- `channels.signal.cliPath`: `signal-cli` 경로.
- `channels.signal.httpUrl`: 전체 데몬 URL (host/port 무시).
- `channels.signal.httpHost`, `channels.signal.httpPort`: 데몬 바인딩 (기본값 127.0.0.1:8080).
- `channels.signal.autoStart`: 데몬 자동 생성 ( `httpUrl` 미설정 시 기본값 true).
- `channels.signal.startupTimeoutMs`: 시작 대기 타임아웃(ms, 최대 120000).
- `channels.signal.receiveMode`: `on-start | manual`.
- `channels.signal.ignoreAttachments`: 첨부 파일 다운로드 건너뛰기.
- `channels.signal.ignoreStories`: 데몬에서 스토리 무시.
- `channels.signal.sendReadReceipts`: 읽음 확인 전달.
- `channels.signal.dmPolicy`: `pairing | allowlist | open | disabled` (기본값: 페어링).
- `channels.signal.allowFrom`: 다이렉트 메시지 허용 목록 (E.164 또는 `uuid:<id>`). `open` 는 `"*"` 가 필요합니다. Signal 에는 사용자 이름이 없으므로 전화번호/UUID ID 를 사용합니다.
- `channels.signal.groupPolicy`: `open | allowlist | disabled` (기본값: 허용 목록).
- `channels.signal.groupAllowFrom`: 그룹 발신자 허용 목록.
- `channels.signal.historyLimit`: 컨텍스트에 포함할 최대 그룹 메시지 수 (0 은 비활성화).
- `channels.signal.dmHistoryLimit`: 다이렉트 메시지 히스토리 한도(사용자 턴 기준). 사용자별 오버라이드: `channels.signal.dms["<phone_or_uuid>"].historyLimit`.
- `channels.signal.textChunkLimit`: 발신 분할 크기(문자 수).
- `channels.signal.chunkMode`: `length` (기본값) 또는 길이 분할 전에 빈 줄(문단 경계) 기준으로 분할하는 `newline`.
- `channels.signal.mediaMaxMb`: 수신/발신 미디어 한도(MB).

관련 전역 옵션:

- `agents.list[].groupChat.mentionPatterns` (Signal 은 네이티브 멘션을 지원하지 않음).
- `messages.groupChat.mentionPatterns` (전역 폴백).
- `messages.responsePrefix`.
