---
summary: "Synology Chat 웹훅 설정 및 OpenClaw 구성"
read_when:
  - Synology Chat을 OpenClaw와 연동할 때
  - Synology Chat 웹훅 라우팅 디버깅 시
title: "Synology Chat"
---

# Synology Chat (플러그인)

상태: 플러그인을 통해 Synology Chat 웹훅을 사용하는 다이렉트 메시지 채널로 지원됩니다.
플러그인은 Synology Chat 발신 웹훅에서 수신 메시지를 받고
Synology Chat 수신 웹훅을 통해 답변을 전송합니다.

## 플러그인 필요

Synology Chat은 플러그인 기반으로, 기본 코어 채널 설치에 포함되지 않습니다.

로컬 체크아웃에서 설치:

```bash
openclaw plugins install ./extensions/synology-chat
```

세부 정보: [Plugins](/tools/plugin)

## 빠른 설정

1. Synology Chat 플러그인을 설치하고 활성화합니다.
2. Synology Chat 통합에서:
   - 수신 웹훅을 생성하고 URL을 복사합니다.
   - 비밀 토큰이 있는 발신 웹훅을 생성합니다.
3. 발신 웹훅 URL을 OpenClaw 게이트웨이로 지정합니다:
   - 기본값: `https://gateway-host/webhook/synology`
   - 또는 커스텀 `channels.synology-chat.webhookPath`.
4. OpenClaw에서 `channels.synology-chat`을 설정합니다.
5. 게이트웨이를 재시작하고 Synology Chat 봇에 DM을 보냅니다.

최소 설정:

```json5
{
  channels: {
    "synology-chat": {
      enabled: true,
      token: "synology-outgoing-token",
      incomingUrl: "https://nas.example.com/webapi/entry.cgi?api=SYNO.Chat.External&method=incoming&version=2&token=...",
      webhookPath: "/webhook/synology",
      dmPolicy: "allowlist",
      allowedUserIds: ["123456"],
      rateLimitPerMinute: 30,
      allowInsecureSsl: false,
    },
  },
}
```

## 환경 변수

기본 계정의 경우 환경 변수를 사용할 수 있습니다:

- `SYNOLOGY_CHAT_TOKEN`
- `SYNOLOGY_CHAT_INCOMING_URL`
- `SYNOLOGY_NAS_HOST`
- `SYNOLOGY_ALLOWED_USER_IDS` (쉼표 구분)
- `SYNOLOGY_RATE_LIMIT`
- `OPENCLAW_BOT_NAME`

설정 값이 환경 변수보다 우선합니다.

## DM 정책 및 접근 제어

- `dmPolicy: "allowlist"`가 권장 기본값입니다.
- `allowedUserIds`는 Synology 사용자 ID 목록(또는 쉼표 구분 문자열)을 허용합니다.
- `allowlist` 모드에서 빈 `allowedUserIds` 목록은 잘못된 설정으로 처리되며 웹훅 경로가 시작되지 않습니다 (전체 허용은 `dmPolicy: "open"` 사용).
- `dmPolicy: "open"`은 모든 발신자를 허용합니다.
- `dmPolicy: "disabled"`는 DM을 차단합니다.
- 페어링 승인:
  - `openclaw pairing list synology-chat`
  - `openclaw pairing approve synology-chat <CODE>`

## 아웃바운드 전송

숫자 Synology Chat 사용자 ID를 대상으로 사용합니다.

예시:

```bash
openclaw message send --channel synology-chat --target 123456 --text "Hello from OpenClaw"
openclaw message send --channel synology-chat --target synology-chat:123456 --text "Hello again"
```

URL 기반 파일 전송을 통한 미디어 전송도 지원됩니다.

## 멀티 계정

`channels.synology-chat.accounts` 아래에서 여러 Synology Chat 계정을 지원합니다.
각 계정은 토큰, 수신 URL, 웹훅 경로, DM 정책, 제한을 재정의할 수 있습니다.

```json5
{
  channels: {
    "synology-chat": {
      enabled: true,
      accounts: {
        default: {
          token: "token-a",
          incomingUrl: "https://nas-a.example.com/...token=...",
        },
        alerts: {
          token: "token-b",
          incomingUrl: "https://nas-b.example.com/...token=...",
          webhookPath: "/webhook/synology-alerts",
          dmPolicy: "allowlist",
          allowedUserIds: ["987654"],
        },
      },
    },
  },
}
```

## 보안 참고사항

- `token`을 비밀로 유지하고 유출 시 교체합니다.
- 자체 서명된 로컬 NAS 인증서를 명시적으로 신뢰하지 않는 한 `allowInsecureSsl: false`를 유지합니다.
- 수신 웹훅 요청은 토큰 검증 및 발신자별 속도 제한이 적용됩니다.
- 프로덕션 환경에서는 `dmPolicy: "allowlist"` 사용을 권장합니다.
