---
summary: "`openclaw directory`에 대한 CLI 레퍼런스 (self, peers, groups)"
read_when:
  - 채널에 사용할 연락처/그룹/self ID 를 조회하려는 경우
  - 채널 디렉토리 어댑터를 개발하는 경우
title: "directory"
x-i18n:
  source_path: cli/directory.md
  source_hash: 7c878d9013aeaa22
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:24Z
---

# `openclaw directory`

이를 지원하는 채널(연락처/피어, 그룹, 그리고 '나')에 대한 디렉토리 조회입니다.

## 공통 플래그

- `--channel <name>`: 채널 ID/별칭 (여러 채널이 구성된 경우 필수; 하나만 구성된 경우 자동)
- `--account <id>`: 계정 ID (기본값: 채널 기본값)
- `--json`: JSON 출력

## 참고 사항

- `directory` 는 다른 명령(특히 `openclaw message send --target ...`)에 붙여 넣을 수 있는 ID 를 찾는 데 도움을 주기 위한 것입니다.
- 많은 채널에서 결과는 라이브 프로바이더 디렉토리가 아니라 설정 기반(허용 목록 / 구성된 그룹)입니다.
- 기본 출력은 탭으로 구분된 `id` (때로는 `name`)이며, 스크립팅에는 `--json` 를 사용하십시오.

## `message send` 와 함께 결과 사용하기

```bash
openclaw directory peers list --channel slack --query "U0"
openclaw message send --channel slack --target user:U012ABCDEF --message "hello"
```

## ID 형식 (채널별)

- WhatsApp: `+15551234567` (다이렉트 메시지), `1234567890-1234567890@g.us` (그룹)
- Telegram: `@username` 또는 숫자 채팅 ID; 그룹은 숫자 ID 입니다
- Slack: `user:U…` 및 `channel:C…`
- Discord: `user:<id>` 및 `channel:<id>`
- Matrix (플러그인): `user:@user:server`, `room:!roomId:server`, 또는 `#alias:server`
- Microsoft Teams (플러그인): `user:<id>` 및 `conversation:<id>`
- Zalo (플러그인): 사용자 ID (Bot API)
- Zalo Personal / `zalouser` (플러그인): `zca` 에서 가져온 스레드 ID (다이렉트 메시지/그룹) (`me`, `friend list`, `group list`)

## Self ('나')

```bash
openclaw directory self --channel zalouser
```

## 피어 (연락처/사용자)

```bash
openclaw directory peers list --channel zalouser
openclaw directory peers list --channel zalouser --query "name"
openclaw directory peers list --channel zalouser --limit 50
```

## 그룹

```bash
openclaw directory groups list --channel zalouser
openclaw directory groups list --channel zalouser --query "work"
openclaw directory groups members --channel zalouser --group-id <id>
```
