---
summary: "Twitch 채팅 봇 구성 및 설정"
read_when:
  - OpenClaw를 위한 Twitch 채팅 통합 설정
title: "Twitch"
x-i18n:
  source_path: channels/twitch.md
  source_hash: 0dd1c05bef570470
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:29Z
---

# Twitch (plugin)

IRC 연결을 통한 Twitch 채팅 지원입니다. OpenClaw는 Twitch 사용자(봇 계정)로 연결되어 채널에서 메시지를 수신하고 전송합니다.

## Plugin required

Twitch는 플러그인으로 제공되며 코어 설치에 번들되어 있지 않습니다.

CLI로 설치(npm 레지스트리):

```bash
openclaw plugins install @openclaw/twitch
```

로컬 체크아웃(git 리포지토리에서 실행하는 경우):

```bash
openclaw plugins install ./extensions/twitch
```

자세한 내용: [Plugins](/plugin)

## Quick setup (beginner)

1. 봇을 위한 전용 Twitch 계정을 생성합니다(또는 기존 계정을 사용합니다).
2. 자격 증명을 생성합니다: [Twitch Token Generator](https://twitchtokengenerator.com/)
   - **Bot Token**을 선택합니다
   - 스코프 `chat:read` 및 `chat:write` 이 선택되어 있는지 확인합니다
   - **Client ID** 와 **Access Token** 을 복사합니다
3. Twitch 사용자 ID를 찾습니다: https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/
4. 토큰을 구성합니다:
   - Env: `OPENCLAW_TWITCH_ACCESS_TOKEN=...` (기본 계정 전용)
   - 또는 config: `channels.twitch.accessToken`
   - 둘 다 설정된 경우 config가 우선합니다(Env 폴백은 기본 계정 전용).
5. Gateway(게이트웨이)를 시작합니다.

**⚠️ 중요:** 무단 사용자가 봇을 트리거하지 못하도록 액세스 제어(`allowFrom` 또는 `allowedRoles`)를 추가하십시오. `requireMention` 의 기본값은 `true` 입니다.

최소 구성:

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw", // Bot's Twitch account
      accessToken: "oauth:abc123...", // OAuth Access Token (or use OPENCLAW_TWITCH_ACCESS_TOKEN env var)
      clientId: "xyz789...", // Client ID from Token Generator
      channel: "vevisk", // Which Twitch channel's chat to join (required)
      allowFrom: ["123456789"], // (recommended) Your Twitch user ID only - get it from https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/
    },
  },
}
```

## What it is

- Gateway(게이트웨이)가 소유한 Twitch 채널입니다.
- 결정적 라우팅: 응답은 항상 Twitch로 되돌아갑니다.
- 각 계정은 격리된 세션 키 `agent:<agentId>:twitch:<accountName>` 에 매핑됩니다.
- `username` 는 봇의 계정(인증 주체)이고, `channel` 는 참여할 채팅방입니다.

## Setup (detailed)

### Generate credentials

[Twitch Token Generator](https://twitchtokengenerator.com/)를 사용합니다:

- **Bot Token**을 선택합니다
- 스코프 `chat:read` 및 `chat:write` 이 선택되어 있는지 확인합니다
- **Client ID** 와 **Access Token** 을 복사합니다

수동 앱 등록은 필요하지 않습니다. 토큰은 몇 시간 후 만료됩니다.

### Configure the bot

**Env var (기본 계정 전용):**

```bash
OPENCLAW_TWITCH_ACCESS_TOKEN=oauth:abc123...
```

**또는 config:**

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw",
      accessToken: "oauth:abc123...",
      clientId: "xyz789...",
      channel: "vevisk",
    },
  },
}
```

Env 와 config 가 모두 설정된 경우 config 가 우선합니다.

### Access control (recommended)

```json5
{
  channels: {
    twitch: {
      allowFrom: ["123456789"], // (recommended) Your Twitch user ID only
    },
  },
}
```

강력한 허용 목록을 위해 `allowFrom` 사용을 권장합니다. 역할 기반 액세스를 원하면 대신 `allowedRoles` 를 사용하십시오.

**사용 가능한 역할:** `"moderator"`, `"owner"`, `"vip"`, `"subscriber"`, `"all"`.

**왜 사용자 ID인가요?** 사용자명은 변경될 수 있어 사칭이 가능합니다. 사용자 ID는 영구적입니다.

Twitch 사용자 ID 찾기: https://www.streamweasels.com/tools/convert-twitch-username-%20to-user-id/ (Twitch 사용자명을 ID로 변환)

## Token refresh (optional)

[Twitch Token Generator](https://twitchtokengenerator.com/)의 토큰은 자동 갱신할 수 없습니다. 만료 시 재생성하십시오.

자동 토큰 갱신을 위해 [Twitch Developer Console](https://dev.twitch.tv/console)에서 자체 Twitch 애플리케이션을 생성하고 config에 추가하십시오:

```json5
{
  channels: {
    twitch: {
      clientSecret: "your_client_secret",
      refreshToken: "your_refresh_token",
    },
  },
}
```

봇은 만료 전에 토큰을 자동으로 갱신하고 갱신 이벤트를 로그에 기록합니다.

## Multi-account support

계정별 토큰과 함께 `channels.twitch.accounts` 을 사용합니다. 공유 패턴은 [`gateway/configuration`](/gateway/configuration)을 참조하십시오.

예시(두 채널에 하나의 봇 계정):

```json5
{
  channels: {
    twitch: {
      accounts: {
        channel1: {
          username: "openclaw",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "vevisk",
        },
        channel2: {
          username: "openclaw",
          accessToken: "oauth:def456...",
          clientId: "uvw012...",
          channel: "secondchannel",
        },
      },
    },
  },
}
```

**참고:** 각 계정에는 자체 토큰이 필요합니다(채널당 토큰 1개).

## Access control

### Role-based restrictions

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowedRoles: ["moderator", "vip"],
        },
      },
    },
  },
}
```

### Allowlist by User ID (most secure)

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowFrom: ["123456789", "987654321"],
        },
      },
    },
  },
}
```

### Role-based access (alternative)

`allowFrom` 는 강력한 허용 목록입니다. 설정 시 해당 사용자 ID만 허용됩니다.
역할 기반 액세스를 원하면 `allowFrom` 를 설정하지 않고 대신 `allowedRoles` 를 구성하십시오:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowedRoles: ["moderator"],
        },
      },
    },
  },
}
```

### Disable @mention requirement

기본적으로 `requireMention` 는 `true` 입니다. 비활성화하여 모든 메시지에 응답하려면:

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          requireMention: false,
        },
      },
    },
  },
}
```

## Troubleshooting

먼저 진단 명령을 실행하십시오:

```bash
openclaw doctor
openclaw channels status --probe
```

### Bot doesn't respond to messages

**액세스 제어 확인:** 사용자 ID가 `allowFrom` 에 포함되어 있는지 확인하거나, 임시로
`allowFrom` 를 제거하고 `allowedRoles: ["all"]` 를 설정하여 테스트하십시오.

**봇이 채널에 있는지 확인:** 봇은 `channel` 에 지정된 채널에 참여해야 합니다.

### Token issues

**"Failed to connect" 또는 인증 오류:**

- `accessToken` 가 OAuth 액세스 토큰 값인지 확인합니다(일반적으로 `oauth:` 접두사로 시작)
- 토큰에 `chat:read` 및 `chat:write` 스코프가 있는지 확인합니다
- 토큰 갱신을 사용하는 경우 `clientSecret` 및 `refreshToken` 가 설정되어 있는지 확인합니다

### Token refresh not working

**갱신 이벤트에 대한 로그 확인:**

```
Using env token source for mybot
Access token refreshed for user 123456 (expires in 14400s)
```

"token refresh disabled (no refresh token)" 이 표시되면:

- `clientSecret` 가 제공되었는지 확인합니다
- `refreshToken` 가 제공되었는지 확인합니다

## Config

**Account config:**

- `username` - 봇 사용자명
- `accessToken` - `chat:read` 및 `chat:write` 를 포함한 OAuth 액세스 토큰
- `clientId` - Twitch Client ID(Token Generator 또는 자체 앱에서 발급)
- `channel` - 참여할 채널(필수)
- `enabled` - 이 계정 활성화(기본값: `true`)
- `clientSecret` - 선택 사항: 자동 토큰 갱신용
- `refreshToken` - 선택 사항: 자동 토큰 갱신용
- `expiresIn` - 토큰 만료 시간(초)
- `obtainmentTimestamp` - 토큰 획득 타임스탬프
- `allowFrom` - 사용자 ID 허용 목록
- `allowedRoles` - 역할 기반 액세스 제어(`"moderator" | "owner" | "vip" | "subscriber" | "all"`)
- `requireMention` - @mention 필요(기본값: `true`)

**Provider options:**

- `channels.twitch.enabled` - 채널 시작 활성화/비활성화
- `channels.twitch.username` - 봇 사용자명(단순 단일 계정 구성)
- `channels.twitch.accessToken` - OAuth 액세스 토큰(단순 단일 계정 구성)
- `channels.twitch.clientId` - Twitch Client ID(단순 단일 계정 구성)
- `channels.twitch.channel` - 참여할 채널(단순 단일 계정 구성)
- `channels.twitch.accounts.<accountName>` - 다중 계정 구성(위의 모든 계정 필드)

전체 예시:

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw",
      accessToken: "oauth:abc123...",
      clientId: "xyz789...",
      channel: "vevisk",
      clientSecret: "secret123...",
      refreshToken: "refresh456...",
      allowFrom: ["123456789"],
      allowedRoles: ["moderator", "vip"],
      accounts: {
        default: {
          username: "mybot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "your_channel",
          enabled: true,
          clientSecret: "secret123...",
          refreshToken: "refresh456...",
          expiresIn: 14400,
          obtainmentTimestamp: 1706092800000,
          allowFrom: ["123456789", "987654321"],
          allowedRoles: ["moderator"],
        },
      },
    },
  },
}
```

## Tool actions

에이전트는 다음 액션으로 `twitch` 을 호출할 수 있습니다:

- `send` - 채널로 메시지 전송

예시:

```json5
{
  action: "twitch",
  params: {
    message: "Hello Twitch!",
    to: "#mychannel",
  },
}
```

## Safety & ops

- **토큰을 비밀번호처럼 취급** - 토큰을 git 에 커밋하지 마십시오
- 장기 실행 봇에는 **자동 토큰 갱신 사용**
- 액세스 제어에는 사용자명 대신 **사용자 ID 허용 목록 사용**
- 토큰 갱신 이벤트와 연결 상태를 **로그로 모니터링**
- **토큰 스코프 최소화** - `chat:read` 및 `chat:write` 만 요청
- **문제가 지속되면**: 다른 프로세스가 세션을 소유하지 않는지 확인한 후 Gateway(게이트웨이)를 재시작하십시오

## Limits

- 메시지당 **500자**(단어 경계에서 자동 분할)
- 분할 전에 Markdown 제거
- 속도 제한 없음(Twitch 내장 속도 제한 사용)
