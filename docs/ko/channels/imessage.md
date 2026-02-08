---
summary: "imsg(stdio 상의 JSON-RPC)를 통한 레거시 iMessage 지원. 신규 설정에는 BlueBubbles 사용을 권장합니다."
read_when:
  - iMessage 지원 설정하기
  - iMessage 송수신 디버깅
title: iMessage
x-i18n:
  source_path: channels/imessage.md
  source_hash: 7c8c276701528b8d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:26Z
---

# iMessage (레거시: imsg)

> **권장:** 신규 iMessage 설정에는 [BlueBubbles](/channels/bluebubbles)를 사용하십시오.
>
> `imsg` 채널은 레거시 외부 CLI 통합이며, 향후 릴리스에서 제거될 수 있습니다.

상태: 레거시 외부 CLI 통합. Gateway(게이트웨이)는 `imsg rpc`(stdio 상의 JSON-RPC)를 스폰합니다.

## 빠른 설정 (초보자)

1. 이 Mac 에서 메시지(Messages)에 로그인되어 있는지 확인합니다.
2. `imsg` 설치:
   - `brew install steipete/tap/imsg`
3. `channels.imessage.cliPath` 및 `channels.imessage.dbPath`로 OpenClaw 를 구성합니다.
4. 게이트웨이를 시작하고 macOS 프롬프트(자동화 + 전체 디스크 접근)를 승인합니다.

최소 구성:

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: "/usr/local/bin/imsg",
      dbPath: "/Users/<you>/Library/Messages/chat.db",
    },
  },
}
```

## 개요

- macOS 에서 `imsg`로 구동되는 iMessage 채널입니다.
- 결정적 라우팅: 응답은 항상 iMessage 로 되돌아갑니다.
- 다이렉트 메시지(DM)는 에이전트의 메인 세션을 공유하며, 그룹은 분리됩니다(`agent:<agentId>:imessage:group:<chat_id>`).
- `is_group=false`가 포함된 다중 참여자 스레드가 도착하더라도, `channels.imessage.groups`을 사용하여 `chat_id`로 분리할 수 있습니다(아래 “그룹 유사 스레드” 참조).

## 구성 쓰기

기본적으로 iMessage 는 `/config set|unset`에 의해 트리거된 구성 업데이트 쓰기를 허용합니다(`commands.config: true` 필요).

비활성화하려면:

```json5
{
  channels: { imessage: { configWrites: false } },
}
```

## 요구 사항

- 메시지(Messages)에 로그인된 macOS.
- OpenClaw + `imsg`에 대한 전체 디스크 접근(Messages DB 접근).
- 전송 시 자동화 권한.
- `channels.imessage.cliPath`는 stdin/stdout 을 프록시하는 임의의 명령을 가리킬 수 있습니다(예: 다른 Mac 으로 SSH 하여 `imsg rpc`을 실행하는 래퍼 스크립트).

## 설정 (빠른 경로)

1. 이 Mac 에서 메시지(Messages)에 로그인되어 있는지 확인합니다.
2. iMessage 를 구성하고 게이트웨이를 시작합니다.

### 전용 봇 macOS 사용자(격리된 아이덴티티)

봇이 **별도의 iMessage 아이덴티티**로 전송하도록(개인 메시지를 깔끔하게 유지) 하려면, 전용 Apple ID + 전용 macOS 사용자를 사용하십시오.

1. 전용 Apple ID 생성(예: `my-cool-bot@icloud.com`).
   - Apple 은 인증/2FA 를 위해 전화번호를 요구할 수 있습니다.
2. macOS 사용자 생성(예: `openclawhome`) 후 로그인합니다.
3. 해당 macOS 사용자에서 메시지(Messages)를 열고 봇 Apple ID 로 iMessage 에 로그인합니다.
4. 원격 로그인 활성화(시스템 설정 → 일반 → 공유 → 원격 로그인).
5. `imsg` 설치:
   - `brew install steipete/tap/imsg`
6. `ssh <bot-macos-user>@localhost true`가 비밀번호 없이 동작하도록 SSH 를 설정합니다.
7. `channels.imessage.accounts.bot.cliPath`가 봇 사용자로 `imsg`을 실행하는 SSH 래퍼를 가리키도록 설정합니다.

첫 실행 참고: 송수신에는 *봇 macOS 사용자*에서 GUI 승인(자동화 + 전체 디스크 접근)이 필요할 수 있습니다. `imsg rpc`가 멈춘 것처럼 보이거나 종료되면, 해당 사용자로 로그인(화면 공유가 유용함)하여 일회성 `imsg chats --limit 1` / `imsg send ...`을 실행하고 프롬프트를 승인한 다음 재시도하십시오.

예제 래퍼(`chmod +x`). `<bot-macos-user>`을 실제 macOS 사용자 이름으로 바꾸십시오:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Run an interactive SSH once first to accept host keys:
#   ssh <bot-macos-user>@localhost true
exec /usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=5 -T <bot-macos-user>@localhost \
  "/usr/local/bin/imsg" "$@"
```

예제 구성:

```json5
{
  channels: {
    imessage: {
      enabled: true,
      accounts: {
        bot: {
          name: "Bot",
          enabled: true,
          cliPath: "/path/to/imsg-bot",
          dbPath: "/Users/<bot-macos-user>/Library/Messages/chat.db",
        },
      },
    },
  },
}
```

단일 계정 설정의 경우, `accounts` 맵 대신 평면 옵션(`channels.imessage.cliPath`, `channels.imessage.dbPath`)을 사용하십시오.

### 원격/SSH 변형(선택 사항)

다른 Mac 에서 iMessage 를 사용하려면, `channels.imessage.cliPath`를 SSH 를 통해 원격 macOS 호스트에서 `imsg`을 실행하는 래퍼로 설정하십시오. OpenClaw 는 stdio 만 필요합니다.

예제 래퍼:

```bash
#!/usr/bin/env bash
exec ssh -T gateway-host imsg "$@"
```

**원격 첨부 파일:** `cliPath`가 SSH 를 통해 원격 호스트를 가리키면, Messages 데이터베이스의 첨부 파일 경로는 원격 머신의 파일을 참조합니다. `channels.imessage.remoteHost`를 설정하면 OpenClaw 가 SCP 를 통해 이를 자동으로 가져올 수 있습니다:

```json5
{
  channels: {
    imessage: {
      cliPath: "~/imsg-ssh", // SSH wrapper to remote Mac
      remoteHost: "user@gateway-host", // for SCP file transfer
      includeAttachments: true,
    },
  },
}
```

`remoteHost`이 설정되지 않으면, OpenClaw 는 래퍼 스크립트의 SSH 명령을 파싱하여 자동 감지를 시도합니다. 신뢰성을 위해 명시적 구성을 권장합니다.

#### Tailscale 를 통한 원격 Mac(예시)

Gateway(게이트웨이)가 Linux 호스트/VM 에서 실행되지만 iMessage 는 Mac 에서 실행되어야 한다면, Tailscale 이 가장 간단한 브리지입니다. 게이트웨이는 tailnet 을 통해 Mac 과 통신하고, SSH 로 `imsg`을 실행하며, SCP 로 첨부 파일을 되가져옵니다.

아키텍처:

```
┌──────────────────────────────┐          SSH (imsg rpc)          ┌──────────────────────────┐
│ Gateway host (Linux/VM)      │──────────────────────────────────▶│ Mac with Messages + imsg │
│ - openclaw gateway           │          SCP (attachments)        │ - Messages signed in     │
│ - channels.imessage.cliPath  │◀──────────────────────────────────│ - Remote Login enabled   │
└──────────────────────────────┘                                   └──────────────────────────┘
              ▲
              │ Tailscale tailnet (hostname or 100.x.y.z)
              ▼
        user@gateway-host
```

구체적인 구성 예(Tailscale 호스트명):

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: "~/.openclaw/scripts/imsg-ssh",
      remoteHost: "bot@mac-mini.tailnet-1234.ts.net",
      includeAttachments: true,
      dbPath: "/Users/bot/Library/Messages/chat.db",
    },
  },
}
```

예제 래퍼(`~/.openclaw/scripts/imsg-ssh`):

```bash
#!/usr/bin/env bash
exec ssh -T bot@mac-mini.tailnet-1234.ts.net imsg "$@"
```

참고 사항:

- Mac 이 메시지(Messages)에 로그인되어 있고 원격 로그인이 활성화되어 있는지 확인하십시오.
- `ssh bot@mac-mini.tailnet-1234.ts.net`가 프롬프트 없이 동작하도록 SSH 키를 사용하십시오.
- `remoteHost`은 SCP 가 첨부 파일을 가져올 수 있도록 SSH 대상과 일치해야 합니다.

다중 계정 지원: 계정별 구성과 선택적 `name`를 사용하여 `channels.imessage.accounts`을 활용하십시오. 공유 패턴은 [`gateway/configuration`](/gateway/configuration#telegramaccounts--discordaccounts--slackaccounts--signalaccounts--imessageaccounts)을 참조하십시오. `~/.openclaw/openclaw.json`는 커밋하지 마십시오(토큰이 포함되는 경우가 많음).

## 접근 제어(DM + 그룹)

DM:

- 기본값: `channels.imessage.dmPolicy = "pairing"`.
- 알 수 없는 발신자는 페어링 코드를 받으며, 승인될 때까지 메시지는 무시됩니다(코드는 1시간 후 만료).
- 승인 방법:
  - `openclaw pairing list imessage`
  - `openclaw pairing approve imessage <CODE>`
- 페어링은 iMessage DM 의 기본 토큰 교환 방식입니다. 자세한 내용은 [Pairing](/start/pairing)을 참조하십시오.

그룹:

- `channels.imessage.groupPolicy = open | allowlist | disabled`.
- `allowlist`이 설정된 경우, `channels.imessage.groupAllowFrom`가 그룹에서 트리거할 수 있는 사용자를 제어합니다.
- iMessage 에는 네이티브 멘션 메타데이터가 없으므로, 멘션 게이팅은 `agents.list[].groupChat.mentionPatterns`(또는 `messages.groupChat.mentionPatterns`)를 사용합니다.
- 다중 에이전트 오버라이드: `agents.list[].groupChat.mentionPatterns`에 에이전트별 패턴을 설정하십시오.

## 동작 방식(행동)

- `imsg`가 메시지 이벤트를 스트리밍하며, 게이트웨이는 이를 공유 채널 봉투로 정규화합니다.
- 응답은 항상 동일한 채팅 ID 또는 핸들로 라우팅됩니다.

## 그룹 유사 스레드(`is_group=false`)

일부 iMessage 스레드는 여러 참여자를 가질 수 있지만, 메시지에서 채팅 식별자를 저장하는 방식에 따라 `is_group=false`로 도착할 수 있습니다.

`channels.imessage.groups` 아래에 `chat_id`을 명시적으로 구성하면, OpenClaw 는 해당 스레드를 다음 용도의 “그룹”으로 처리합니다:

- 세션 분리(별도의 `agent:<agentId>:imessage:group:<chat_id>` 세션 키)
- 그룹 허용 목록 / 멘션 게이팅 동작

예제:

```json5
{
  channels: {
    imessage: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15555550123"],
      groups: {
        "42": { requireMention: false },
      },
    },
  },
}
```

이는 특정 스레드에 대해 격리된 성격/모델을 원할 때 유용합니다([Multi-agent routing](/concepts/multi-agent) 참조). 파일시스템 격리에 대해서는 [Sandboxing](/gateway/sandboxing)을 참조하십시오.

## 미디어 + 제한

- `channels.imessage.includeAttachments`를 통한 선택적 첨부 파일 인제스트.
- `channels.imessage.mediaMaxMb`를 통한 미디어 한도.

## 제한 사항

- 발신 텍스트는 `channels.imessage.textChunkLimit`(기본값 4000)로 청크 분할됩니다.
- 선택적 줄바꿈 청크 분할: 길이 기준 분할 전에 빈 줄(문단 경계)에서 분할하려면 `channels.imessage.chunkMode="newline"`을 설정하십시오.
- 미디어 업로드는 `channels.imessage.mediaMaxMb`(기본값 16)로 제한됩니다.

## 주소 지정 / 전달 대상

안정적인 라우팅을 위해 `chat_id`를 우선 사용하십시오:

- `chat_id:123`(권장)
- `chat_guid:...`
- `chat_identifier:...`
- 직접 핸들: `imessage:+1555` / `sms:+1555` / `user@example.com`

채팅 목록 조회:

```
imsg chats --limit 20
```

## 구성 참조(iMessage)

전체 구성: [Configuration](/gateway/configuration)

프로바이더 옵션:

- `channels.imessage.enabled`: 채널 시작 활성화/비활성화.
- `channels.imessage.cliPath`: `imsg` 경로.
- `channels.imessage.dbPath`: Messages DB 경로.
- `channels.imessage.remoteHost`: `cliPath`이 원격 Mac 을 가리킬 때 첨부 파일 SCP 전송을 위한 SSH 호스트(예: `user@gateway-host`). 설정되지 않은 경우 SSH 래퍼에서 자동 감지됩니다.
- `channels.imessage.service`: `imessage | sms | auto`.
- `channels.imessage.region`: SMS 지역.
- `channels.imessage.dmPolicy`: `pairing | allowlist | open | disabled`(기본값: 페어링).
- `channels.imessage.allowFrom`: DM 허용 목록(핸들, 이메일, E.164 번호 또는 `chat_id:*`). `open`에는 `"*"`가 필요합니다. iMessage 에는 사용자명이 없으므로 핸들이나 채팅 대상을 사용하십시오.
- `channels.imessage.groupPolicy`: `open | allowlist | disabled`(기본값: 허용 목록).
- `channels.imessage.groupAllowFrom`: 그룹 발신자 허용 목록.
- `channels.imessage.historyLimit` / `channels.imessage.accounts.*.historyLimit`: 컨텍스트에 포함할 최대 그룹 메시지 수(0 은 비활성화).
- `channels.imessage.dmHistoryLimit`: 사용자 턴 기준 DM 기록 한도. 사용자별 오버라이드: `channels.imessage.dms["<handle>"].historyLimit`.
- `channels.imessage.groups`: 그룹별 기본값 + 허용 목록(전역 기본값에는 `"*"` 사용).
- `channels.imessage.includeAttachments`: 첨부 파일을 컨텍스트로 인제스트.
- `channels.imessage.mediaMaxMb`: 수신/발신 미디어 한도(MB).
- `channels.imessage.textChunkLimit`: 발신 청크 크기(문자).
- `channels.imessage.chunkMode`: 길이 청크 분할 전에 빈 줄(문단 경계)에서 분할하려면 `length`(기본값) 또는 `newline`.

관련 전역 옵션:

- `agents.list[].groupChat.mentionPatterns`(또는 `messages.groupChat.mentionPatterns`).
- `messages.responsePrefix`.
