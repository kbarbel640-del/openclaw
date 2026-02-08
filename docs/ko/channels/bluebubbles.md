---
summary: "BlueBubbles macOS 서버를 통한 iMessage (REST 송수신, 타이핑, 반응, 페어링, 고급 작업)."
read_when:
  - BlueBubbles 채널 설정
  - 웹훅 페어링 문제 해결
  - macOS 에서 iMessage 구성
title: "BlueBubbles"
x-i18n:
  source_path: channels/bluebubbles.md
  source_hash: 1414cf657d347ee7
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:29Z
---

# BlueBubbles (macOS REST)

상태: HTTP 를 통해 BlueBubbles macOS 서버와 통신하는 번들 플러그인입니다. 레거시 imsg 채널과 비교해 API 가 더 풍부하고 설정이 쉬워 **iMessage 통합에 권장**됩니다.

## 개요

- macOS 에서 BlueBubbles 헬퍼 앱으로 실행됩니다 ([bluebubbles.app](https://bluebubbles.app)).
- 권장/테스트됨: macOS Sequoia (15). macOS Tahoe (26) 도 동작하지만, 현재 편집은 Tahoe 에서 깨져 있으며 그룹 아이콘 업데이트는 성공으로 보고되더라도 동기화되지 않을 수 있습니다.
- OpenClaw 는 REST API 를 통해 통신합니다 (`GET /api/v1/ping`, `POST /message/text`, `POST /chat/:id/*`).
- 수신 메시지는 웹훅으로 도착하며, 발신 응답, 타이핑 표시, 읽음 확인, 탭백은 REST 호출입니다.
- 첨부파일과 스티커는 인바운드 미디어로 수집되며 (가능한 경우) 에이전트에 노출됩니다.
- 페어링/허용 목록은 다른 채널과 동일한 방식으로 동작합니다 (`/start/pairing` 등), `channels.bluebubbles.allowFrom` + 페어링 코드를 사용합니다.
- 반응은 Slack/Telegram 과 동일하게 시스템 이벤트로 노출되어, 에이전트가 응답 전에 이를 "멘션"할 수 있습니다.
- 고급 기능: 편집, 되돌리기(unsend), 답글 스레딩, 메시지 효과, 그룹 관리.

## 빠른 시작

1. Mac 에 BlueBubbles 서버를 설치합니다 ([bluebubbles.app/install](https://bluebubbles.app/install) 의 지침을 따르세요).
2. BlueBubbles 설정에서 웹 API 를 활성화하고 비밀번호를 설정합니다.
3. `openclaw onboard` 를 실행하고 BlueBubbles 를 선택하거나, 수동으로 구성합니다:
   ```json5
   {
     channels: {
       bluebubbles: {
         enabled: true,
         serverUrl: "http://192.168.1.100:1234",
         password: "example-password",
         webhookPath: "/bluebubbles-webhook",
       },
     },
   }
   ```
4. BlueBubbles 웹훅을 Gateway(게이트웨이) 로 지정합니다 (예: `https://your-gateway-host:3000/bluebubbles-webhook?password=<password>`).
5. Gateway(게이트웨이) 를 시작하면 웹훅 핸들러를 등록하고 페어링을 시작합니다.

## Messages.app 활성 유지 (VM / 헤드리스 설정)

일부 macOS VM / 상시 실행 설정에서는 Messages.app 이 “유휴” 상태로 전환되어 (앱을 열거나 포그라운드로 전환하기 전까지) 수신 이벤트가 중단될 수 있습니다. 간단한 해결책은 AppleScript + LaunchAgent 를 사용해 **5분마다 Messages 를 깨우는 것**입니다.

### 1) AppleScript 저장

다음 이름으로 저장합니다:

- `~/Scripts/poke-messages.scpt`

예제 스크립트 (비대화식; 포커스를 빼앗지 않음):

```applescript
try
  tell application "Messages"
    if not running then
      launch
    end if

    -- Touch the scripting interface to keep the process responsive.
    set _chatCount to (count of chats)
  end tell
on error
  -- Ignore transient failures (first-run prompts, locked session, etc).
end try
```

### 2) LaunchAgent 설치

다음 이름으로 저장합니다:

- `~/Library/LaunchAgents/com.user.poke-messages.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.user.poke-messages</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>/usr/bin/osascript &quot;$HOME/Scripts/poke-messages.scpt&quot;</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>StartInterval</key>
    <integer>300</integer>

    <key>StandardOutPath</key>
    <string>/tmp/poke-messages.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/poke-messages.err</string>
  </dict>
</plist>
```

참고:

- **300초마다** 그리고 **로그인 시** 실행됩니다.
- 첫 실행 시 macOS **자동화** 프롬프트가 표시될 수 있습니다 (`osascript` → Messages). LaunchAgent 를 실행하는 동일한 사용자 세션에서 승인하세요.

로드:

```bash
launchctl unload ~/Library/LaunchAgents/com.user.poke-messages.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.user.poke-messages.plist
```

## 온보딩

BlueBubbles 는 대화형 설정 마법사에서 사용할 수 있습니다:

```
openclaw onboard
```

마법사는 다음을 요청합니다:

- **서버 URL** (필수): BlueBubbles 서버 주소 (예: `http://192.168.1.100:1234`)
- **비밀번호** (필수): BlueBubbles Server 설정의 API 비밀번호
- **웹훅 경로** (선택): 기본값은 `/bluebubbles-webhook`
- **DM 정책**: 페어링, 허용 목록, 열림, 또는 비활성화
- **허용 목록**: 전화번호, 이메일, 또는 채팅 대상

CLI 로 BlueBubbles 를 추가할 수도 있습니다:

```
openclaw channels add bluebubbles --http-url http://192.168.1.100:1234 --password <password>
```

## 접근 제어 (다이렉트 메시지 + 그룹)

다이렉트 메시지:

- 기본값: `channels.bluebubbles.dmPolicy = "pairing"`.
- 알 수 없는 발신자는 페어링 코드를 받으며, 승인될 때까지 메시지는 무시됩니다 (코드는 1시간 후 만료).
- 승인 방법:
  - `openclaw pairing list bluebubbles`
  - `openclaw pairing approve bluebubbles <CODE>`
- 페어링은 기본 토큰 교환 방식입니다. 자세한 내용: [Pairing](/start/pairing)

그룹:

- `channels.bluebubbles.groupPolicy = open | allowlist | disabled` (기본값: `allowlist`).
- `channels.bluebubbles.groupAllowFrom` 는 `allowlist` 가 설정되었을 때 그룹에서 누가 트리거할 수 있는지를 제어합니다.

### 멘션 게이팅 (그룹)

BlueBubbles 는 iMessage/WhatsApp 동작과 동일한 그룹 채팅용 멘션 게이팅을 지원합니다:

- `agents.list[].groupChat.mentionPatterns` (또는 `messages.groupChat.mentionPatterns`) 를 사용해 멘션을 감지합니다.
- 그룹에 대해 `requireMention` 가 활성화되면, 에이전트는 멘션될 때만 응답합니다.
- 권한 있는 발신자의 제어 명령은 멘션 게이팅을 우회합니다.

그룹별 구성:

```json5
{
  channels: {
    bluebubbles: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15555550123"],
      groups: {
        "*": { requireMention: true }, // default for all groups
        "iMessage;-;chat123": { requireMention: false }, // override for specific group
      },
    },
  },
}
```

### 명령 게이팅

- 제어 명령 (예: `/config`, `/model`) 은 권한이 필요합니다.
- 명령 권한을 판단하기 위해 `allowFrom` 와 `groupAllowFrom` 를 사용합니다.
- 권한 있는 발신자는 그룹에서 멘션 없이도 제어 명령을 실행할 수 있습니다.

## 타이핑 + 읽음 확인

- **타이핑 표시**: 응답 생성 전과 생성 중에 자동으로 전송됩니다.
- **읽음 확인**: `channels.bluebubbles.sendReadReceipts` 로 제어됩니다 (기본값: `true`).
- **타이핑 표시**: OpenClaw 가 타이핑 시작 이벤트를 전송하며, BlueBubbles 는 전송 또는 타임아웃 시 자동으로 해제합니다 (DELETE 로 수동 중지는 신뢰성이 낮음).

```json5
{
  channels: {
    bluebubbles: {
      sendReadReceipts: false, // disable read receipts
    },
  },
}
```

## 고급 작업

BlueBubbles 는 설정에서 활성화된 경우 고급 메시지 작업을 지원합니다:

```json5
{
  channels: {
    bluebubbles: {
      actions: {
        reactions: true, // tapbacks (default: true)
        edit: true, // edit sent messages (macOS 13+, broken on macOS 26 Tahoe)
        unsend: true, // unsend messages (macOS 13+)
        reply: true, // reply threading by message GUID
        sendWithEffect: true, // message effects (slam, loud, etc.)
        renameGroup: true, // rename group chats
        setGroupIcon: true, // set group chat icon/photo (flaky on macOS 26 Tahoe)
        addParticipant: true, // add participants to groups
        removeParticipant: true, // remove participants from groups
        leaveGroup: true, // leave group chats
        sendAttachment: true, // send attachments/media
      },
    },
  },
}
```

사용 가능한 작업:

- **react**: 탭백 반응 추가/제거 (`messageId`, `emoji`, `remove`)
- **edit**: 보낸 메시지 편집 (`messageId`, `text`)
- **unsend**: 메시지 되돌리기 (`messageId`)
- **reply**: 특정 메시지에 답글 (`messageId`, `text`, `to`)
- **sendWithEffect**: iMessage 효과와 함께 전송 (`text`, `to`, `effectId`)
- **renameGroup**: 그룹 채팅 이름 변경 (`chatGuid`, `displayName`)
- **setGroupIcon**: 그룹 채팅 아이콘/사진 설정 (`chatGuid`, `media`) — macOS 26 Tahoe 에서 불안정함 (API 는 성공을 반환하지만 아이콘이 동기화되지 않을 수 있음).
- **addParticipant**: 그룹에 참가자 추가 (`chatGuid`, `address`)
- **removeParticipant**: 그룹에서 참가자 제거 (`chatGuid`, `address`)
- **leaveGroup**: 그룹 채팅 나가기 (`chatGuid`)
- **sendAttachment**: 미디어/파일 전송 (`to`, `buffer`, `filename`, `asVoice`)
  - 음성 메모: **MP3** 또는 **CAF** 오디오를 iMessage 음성 메시지로 보내려면 `asVoice: true` 를 설정합니다. BlueBubbles 는 음성 메모 전송 시 MP3 → CAF 로 변환합니다.

### 메시지 ID (짧은 ID vs 전체 ID)

OpenClaw 는 토큰 절약을 위해 _짧은_ 메시지 ID (예: `1`, `2`) 를 노출할 수 있습니다.

- `MessageSid` / `ReplyToId` 는 짧은 ID 일 수 있습니다.
- `MessageSidFull` / `ReplyToIdFull` 는 프로바이더의 전체 ID 를 포함합니다.
- 짧은 ID 는 메모리 내에만 존재하며, 재시작이나 캐시 축출 시 만료될 수 있습니다.
- 작업은 짧은 ID 또는 전체 `messageId` 를 허용하지만, 더 이상 사용할 수 없는 경우 짧은 ID 는 오류가 발생합니다.

지속적인 자동화와 저장에는 전체 ID 를 사용하세요:

- 템플릿: `{{MessageSidFull}}`, `{{ReplyToIdFull}}`
- 컨텍스트: 인바운드 페이로드의 `MessageSidFull` / `ReplyToIdFull`

템플릿 변수는 [Configuration](/gateway/configuration) 을 참고하세요.

## 블록 스트리밍

응답을 단일 메시지로 보낼지, 블록으로 스트리밍할지 제어합니다:

```json5
{
  channels: {
    bluebubbles: {
      blockStreaming: true, // enable block streaming (off by default)
    },
  },
}
```

## 미디어 + 제한

- 인바운드 첨부파일은 다운로드되어 미디어 캐시에 저장됩니다.
- 미디어 상한은 `channels.bluebubbles.mediaMaxMb` 로 설정합니다 (기본값: 8 MB).
- 아웃바운드 텍스트는 `channels.bluebubbles.textChunkLimit` 까지 분할됩니다 (기본값: 4000자).

## 구성 참조

전체 구성: [Configuration](/gateway/configuration)

프로바이더 옵션:

- `channels.bluebubbles.enabled`: 채널 활성화/비활성화.
- `channels.bluebubbles.serverUrl`: BlueBubbles REST API 기본 URL.
- `channels.bluebubbles.password`: API 비밀번호.
- `channels.bluebubbles.webhookPath`: 웹훅 엔드포인트 경로 (기본값: `/bluebubbles-webhook`).
- `channels.bluebubbles.dmPolicy`: `pairing | allowlist | open | disabled` (기본값: `pairing`).
- `channels.bluebubbles.allowFrom`: DM 허용 목록 (핸들, 이메일, E.164 번호, `chat_id:*`, `chat_guid:*`).
- `channels.bluebubbles.groupPolicy`: `open | allowlist | disabled` (기본값: `allowlist`).
- `channels.bluebubbles.groupAllowFrom`: 그룹 발신자 허용 목록.
- `channels.bluebubbles.groups`: 그룹별 구성 (`requireMention` 등).
- `channels.bluebubbles.sendReadReceipts`: 읽음 확인 전송 (기본값: `true`).
- `channels.bluebubbles.blockStreaming`: 블록 스트리밍 활성화 (기본값: `false`; 스트리밍 응답에 필요).
- `channels.bluebubbles.textChunkLimit`: 아웃바운드 청크 크기 (문자 수 기준, 기본값: 4000).
- `channels.bluebubbles.chunkMode`: `length` (기본값) 은 `textChunkLimit` 를 초과할 때만 분할; `newline` 는 길이 분할 전에 빈 줄 (문단 경계) 에서 분할.
- `channels.bluebubbles.mediaMaxMb`: 인바운드 미디어 상한 (MB, 기본값: 8).
- `channels.bluebubbles.historyLimit`: 컨텍스트용 최대 그룹 메시지 수 (0 은 비활성화).
- `channels.bluebubbles.dmHistoryLimit`: DM 기록 제한.
- `channels.bluebubbles.actions`: 특정 작업 활성화/비활성화.
- `channels.bluebubbles.accounts`: 다중 계정 구성.

관련 전역 옵션:

- `agents.list[].groupChat.mentionPatterns` (또는 `messages.groupChat.mentionPatterns`).
- `messages.responsePrefix`.

## 주소 지정 / 전송 대상

안정적인 라우팅을 위해 `chat_guid` 사용을 권장합니다:

- `chat_guid:iMessage;-;+15555550123` (그룹에 권장)
- `chat_id:123`
- `chat_identifier:...`
- 직접 핸들: `+15555550123`, `user@example.com`
  - 직접 핸들에 기존 DM 채팅이 없는 경우, OpenClaw 는 `POST /api/v1/chat/new` 를 통해 생성합니다. 이를 위해 BlueBubbles Private API 가 활성화되어야 합니다.

## 보안

- 웹훅 요청은 `guid`/`password` 쿼리 파라미터 또는 헤더를 `channels.bluebubbles.password` 와 비교하여 인증됩니다. `localhost` 에서의 요청도 허용됩니다.
- API 비밀번호와 웹훅 엔드포인트는 비밀로 유지하세요 (자격 증명처럼 취급).
- 로컬호스트 신뢰로 인해 동일 호스트의 리버스 프록시가 의도치 않게 비밀번호를 우회할 수 있습니다. Gateway(게이트웨이) 를 프록시하는 경우 프록시에서 인증을 요구하고 `gateway.trustedProxies` 를 구성하세요. [Gateway 보안](/gateway/security#reverse-proxy-configuration) 을 참고하세요.
- LAN 외부로 노출하는 경우 BlueBubbles 서버에 HTTPS + 방화벽 규칙을 활성화하세요.

## 문제 해결

- 타이핑/읽음 이벤트가 중단되면 BlueBubbles 웹훅 로그를 확인하고 Gateway(게이트웨이) 경로가 `channels.bluebubbles.webhookPath` 와 일치하는지 검증하세요.
- 페어링 코드는 1시간 후 만료됩니다; `openclaw pairing list bluebubbles` 와 `openclaw pairing approve bluebubbles <code>` 를 사용하세요.
- 반응에는 BlueBubbles private API (`POST /api/v1/message/react`) 가 필요합니다; 서버 버전에서 노출되는지 확인하세요.
- 편집/되돌리기는 macOS 13+ 및 호환되는 BlueBubbles 서버 버전이 필요합니다. macOS 26 (Tahoe) 에서는 private API 변경으로 인해 현재 편집이 깨져 있습니다.
- 그룹 아이콘 업데이트는 macOS 26 (Tahoe) 에서 불안정할 수 있습니다: API 가 성공을 반환하더라도 새 아이콘이 동기화되지 않을 수 있습니다.
- OpenClaw 는 BlueBubbles 서버의 macOS 버전에 따라 알려진 문제의 작업을 자동으로 숨깁니다. macOS 26 (Tahoe) 에서도 편집이 표시된다면 `channels.bluebubbles.actions.edit=false` 로 수동 비활성화하세요.
- 상태/헬스 정보: `openclaw status --all` 또는 `openclaw status --deep`.

일반적인 채널 워크플로 참조는 [Channels](/channels) 와 [Plugins](/plugins) 가이드를 참고하세요.
