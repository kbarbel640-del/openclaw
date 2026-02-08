---
summary: "Mattermost 봇 설정 및 OpenClaw 구성"
read_when:
  - Mattermost 설정
  - Mattermost 라우팅 디버깅
title: "Mattermost"
x-i18n:
  source_path: channels/mattermost.md
  source_hash: 57fabe5eb0efbcb8
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:11Z
---

# Mattermost (플러그인)

상태: 플러그인을 통해 지원됨 (봇 토큰 + WebSocket 이벤트). 채널, 그룹 및 다이렉트 메시지가 지원됩니다.
Mattermost 는 자체 호스팅 가능한 팀 메시징 플랫폼입니다. 제품 세부 정보 및 다운로드는 공식 사이트
[mattermost.com](https://mattermost.com) 을 참조하십시오.

## 플러그인 필요

Mattermost 는 플러그인으로 제공되며 코어 설치에 번들되지 않습니다.

CLI 로 설치 (npm 레지스트리):

```bash
openclaw plugins install @openclaw/mattermost
```

로컬 체크아웃 (git 리포지토리에서 실행하는 경우):

```bash
openclaw plugins install ./extensions/mattermost
```

구성/온보딩 중 Mattermost 를 선택하고 git 체크아웃이 감지되면,
OpenClaw 는 로컬 설치 경로를 자동으로 제안합니다.

자세한 내용은 [Plugins](/plugin) 을 참조하십시오.

## 빠른 설정

1. Mattermost 플러그인을 설치합니다.
2. Mattermost 봇 계정을 생성하고 **봇 토큰**을 복사합니다.
3. Mattermost **기본 URL**을 복사합니다 (예: `https://chat.example.com`).
4. OpenClaw 를 구성하고 Gateway(게이트웨이)를 시작합니다.

최소 구성:

```json5
{
  channels: {
    mattermost: {
      enabled: true,
      botToken: "mm-token",
      baseUrl: "https://chat.example.com",
      dmPolicy: "pairing",
    },
  },
}
```

## 환경 변수 (기본 계정)

환경 변수를 선호하는 경우 Gateway(게이트웨이) 호스트에 다음을 설정하십시오:

- `MATTERMOST_BOT_TOKEN=...`
- `MATTERMOST_URL=https://chat.example.com`

환경 변수는 **기본** 계정 (`default`) 에만 적용됩니다. 다른 계정은 구성 값을 사용해야 합니다.

## 채팅 모드

Mattermost 는 다이렉트 메시지에 자동으로 응답합니다. 채널 동작은 `chatmode` 로 제어됩니다:

- `oncall` (기본값): 채널에서 @멘션될 때만 응답합니다.
- `onmessage`: 모든 채널 메시지에 응답합니다.
- `onchar`: 메시지가 트리거 접두사로 시작할 때 응답합니다.

구성 예시:

```json5
{
  channels: {
    mattermost: {
      chatmode: "onchar",
      oncharPrefixes: [">", "!"],
    },
  },
}
```

참고:

- `onchar` 는 명시적인 @멘션에 계속 응답합니다.
- `channels.mattermost.requireMention` 는 레거시 구성에서 존중되지만 `chatmode` 사용이 권장됩니다.

## 접근 제어 (다이렉트 메시지)

- 기본값: `channels.mattermost.dmPolicy = "pairing"` (알 수 없는 발신자는 페어링 코드를 받습니다).
- 승인 방법:
  - `openclaw pairing list mattermost`
  - `openclaw pairing approve mattermost <CODE>`
- 공개 다이렉트 메시지: `channels.mattermost.dmPolicy="open"` 및 `channels.mattermost.allowFrom=["*"]`.

## 채널 (그룹)

- 기본값: `channels.mattermost.groupPolicy = "allowlist"` (멘션 게이트).
- `channels.mattermost.groupAllowFrom` 로 발신자 허용 목록을 설정합니다 (사용자 ID 또는 `@username`).
- 공개 채널: `channels.mattermost.groupPolicy="open"` (멘션 게이트).

## 아웃바운드 전달 대상

`openclaw message send` 또는 cron/웹훅과 함께 다음 대상 형식을 사용하십시오:

- 채널용: `channel:<id>`
- 다이렉트 메시지용: `user:<id>`
- 다이렉트 메시지용 (Mattermost API 를 통해 확인됨): `@username`

단순 ID 는 채널로 처리됩니다.

## 다중 계정

Mattermost 는 `channels.mattermost.accounts` 하위에서 여러 계정을 지원합니다:

```json5
{
  channels: {
    mattermost: {
      accounts: {
        default: { name: "Primary", botToken: "mm-token", baseUrl: "https://chat.example.com" },
        alerts: { name: "Alerts", botToken: "mm-token-2", baseUrl: "https://alerts.example.com" },
      },
    },
  },
}
```

## 문제 해결

- 채널에서 응답이 없는 경우: 봇이 채널에 참여해 있는지 확인하고 멘션(oncall) 하거나, 트리거 접두사(onchar) 를 사용하거나, `chatmode: "onmessage"` 을 설정하십시오.
- 인증 오류: 봇 토큰, 기본 URL, 그리고 계정이 활성화되어 있는지 확인하십시오.
- 다중 계정 문제: 환경 변수는 `default` 계정에만 적용됩니다.
