---
summary: "`openclaw channels`에 대한 CLI 참조 (계정, 상태, 로그인/로그아웃, 로그)"
read_when:
  - 채널 계정 (WhatsApp/Telegram/Discord/Google Chat/Slack/Mattermost (플러그인)/Signal/iMessage)을 추가/제거하려는 경우
  - 채널 상태를 확인하거나 채널 로그를 실시간으로 확인하려는 경우
title: "채널"
x-i18n:
  source_path: cli/channels.md
  source_hash: 16ab1642f247bfa9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:24Z
---

# `openclaw channels`

Gateway(게이트웨이)에서 채팅 채널 계정과 해당 런타임 상태를 관리합니다.

관련 문서:

- 채널 가이드: [Channels](/channels/index)
- Gateway(게이트웨이) 설정: [Configuration](/gateway/configuration)

## 공통 명령

```bash
openclaw channels list
openclaw channels status
openclaw channels capabilities
openclaw channels capabilities --channel discord --target channel:123
openclaw channels resolve --channel slack "#general" "@jane"
openclaw channels logs --channel all
```

## 계정 추가 / 제거

```bash
openclaw channels add --channel telegram --token <bot-token>
openclaw channels remove --channel telegram --delete
```

팁: `openclaw channels add --help`은 채널별 플래그 (토큰, 앱 토큰, signal-cli 경로 등)를 표시합니다.

## 로그인 / 로그아웃 (대화형)

```bash
openclaw channels login --channel whatsapp
openclaw channels logout --channel whatsapp
```

## 문제 해결

- 광범위한 점검을 위해 `openclaw status --deep`을 실행합니다.
- 단계별 해결을 위해 `openclaw doctor`을 사용합니다.
- `openclaw channels list`은 `Claude: HTTP 403 ... user:profile`을 출력합니다 → 사용량 스냅샷에는 `user:profile` 범위가 필요합니다. `--no-usage`를 사용하거나, claude.ai 세션 키 (`CLAUDE_WEB_SESSION_KEY` / `CLAUDE_WEB_COOKIE`)를 제공하거나, Claude Code CLI를 통해 다시 인증하십시오.

## 기능 탐색 프로브

가능한 경우 프로바이더 기능 힌트 (의도/범위)와 정적 기능 지원을 가져옵니다:

```bash
openclaw channels capabilities
openclaw channels capabilities --channel discord --target channel:123
```

참고:

- `--channel`는 선택 사항입니다. 이를 생략하면 모든 채널 (확장 포함)을 나열합니다.
- `--target`은 `channel:<id>` 또는 원시 숫자 채널 ID를 허용하며 Discord에만 적용됩니다.
- 프로브는 프로바이더별입니다: Discord 의도 + 선택적 채널 권한; Slack 봇 + 사용자 범위; Telegram 봇 플래그 + 웹훅; Signal 데몬 버전; MS Teams 앱 토큰 + Graph 역할/범위 (알려진 경우 주석). 프로브가 없는 채널은 `Probe: unavailable`을 보고합니다.

## 이름을 ID로 해석

프로바이더 디렉토리를 사용하여 채널/사용자 이름을 ID로 해석합니다:

```bash
openclaw channels resolve --channel slack "#general" "@jane"
openclaw channels resolve --channel discord "My Server/#support" "@someone"
openclaw channels resolve --channel matrix "Project Room"
```

참고:

- 대상 유형을 강제로 지정하려면 `--kind user|group|auto`를 사용합니다.
- 동일한 이름을 공유하는 항목이 여러 개 있는 경우 활성 일치를 우선합니다.
