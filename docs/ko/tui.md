---
summary: "터미널 UI (TUI): 어떤 머신에서든 Gateway에 연결"
read_when:
  - TUI에 대한 초보자 친화적인 단계별 안내가 필요합니다.
  - TUI 기능, 명령, 단축키의 전체 목록이 필요합니다.
title: "TUI"
x-i18n:
  source_path: tui.md
  source_hash: 1eb111456fe0aab6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:59Z
---

# TUI (터미널 UI)

## 빠른 시작

1. Gateway를 시작합니다.

```bash
openclaw gateway
```

2. TUI를 엽니다.

```bash
openclaw tui
```

3. 메시지를 입력하고 Enter를 누릅니다.

원격 Gateway:

```bash
openclaw tui --url ws://<host>:<port> --token <gateway-token>
```

Gateway가 비밀번호 인증을 사용하는 경우 `--password`을 사용합니다.

## 화면 구성

- 헤더: 연결 URL, 현재 에이전트, 현재 세션.
- 채팅 로그: 사용자 메시지, 어시스턴트 응답, 시스템 알림, 도구 카드.
- 상태 줄: 연결/실행 상태 (연결 중, 실행 중, 스트리밍 중, 유휴, 오류).
- 푸터: 연결 상태 + 에이전트 + 세션 + 모델 + 생각/상세/추론 + 토큰 수 + 전달.
- 입력창: 자동 완성을 지원하는 텍스트 편집기.

## 개념 모델: 에이전트 + 세션

- 에이전트는 고유한 슬러그입니다 (예: `main`, `research`). Gateway가 목록을 제공합니다.
- 세션은 현재 에이전트에 속합니다.
- 세션 키는 `agent:<agentId>:<sessionKey>`로 저장됩니다.
  - `/session main`을 입력하면 TUI가 이를 `agent:<currentAgent>:main`로 확장합니다.
  - `/session agent:other:main`을 입력하면 해당 에이전트 세션으로 명시적으로 전환합니다.
- 세션 범위:
  - `per-sender` (기본값): 각 에이전트는 여러 세션을 가집니다.
  - `global`: TUI는 항상 `global` 세션을 사용합니다 (선택기가 비어 있을 수 있습니다).
- 현재 에이전트 + 세션은 항상 푸터에 표시됩니다.

## 전송 + 전달

- 메시지는 Gateway로 전송되며, 프로바이더로의 전달은 기본적으로 꺼져 있습니다.
- 전달을 켭니다:
  - `/deliver on`
  - 또는 설정 패널
  - 또는 `openclaw tui --deliver`로 시작

## 선택기 + 오버레이

- 모델 선택기: 사용 가능한 모델 목록을 표시하고 세션 오버라이드를 설정합니다.
- 에이전트 선택기: 다른 에이전트를 선택합니다.
- 세션 선택기: 현재 에이전트의 세션만 표시합니다.
- 설정: 전달, 도구 출력 확장, 생각 표시를 토글합니다.

## 키보드 단축키

- Enter: 메시지 전송
- Esc: 활성 실행 중단
- Ctrl+C: 입력 지우기 (두 번 누르면 종료)
- Ctrl+D: 종료
- Ctrl+L: 모델 선택기
- Ctrl+G: 에이전트 선택기
- Ctrl+P: 세션 선택기
- Ctrl+O: 도구 출력 확장 토글
- Ctrl+T: 생각 표시 토글 (히스토리 다시 로드)

## 슬래시 명령

코어:

- `/help`
- `/status`
- `/agent <id>` (또는 `/agents`)
- `/session <key>` (또는 `/sessions`)
- `/model <provider/model>` (또는 `/models`)

세션 제어:

- `/think <off|minimal|low|medium|high>`
- `/verbose <on|full|off>`
- `/reasoning <on|off|stream>`
- `/usage <off|tokens|full>`
- `/elevated <on|off|ask|full>` (별칭: `/elev`)
- `/activation <mention|always>`
- `/deliver <on|off>`

세션 수명주기:

- `/new` 또는 `/reset` (세션 초기화)
- `/abort` (활성 실행 중단)
- `/settings`
- `/exit`

다른 Gateway 슬래시 명령 (예: `/context`)은 Gateway로 전달되며 시스템 출력으로 표시됩니다. [Slash commands](/tools/slash-commands)를 참고하세요.

## 로컬 셸 명령

- 한 줄 앞에 `!`을 붙이면 TUI 호스트에서 로컬 셸 명령을 실행합니다.
- TUI는 세션당 한 번 로컬 실행을 허용할지 묻습니다. 거부하면 해당 세션에서 `!`이 비활성화됩니다.
- 명령은 TUI 작업 디렉토리에서 새 비대화형 셸로 실행됩니다 (영구적인 `cd`/env 없음).
- 단독 `!`은 일반 메시지로 전송되며, 앞의 공백은 로컬 실행을 트리거하지 않습니다.

## 도구 출력

- 도구 호출은 인수 + 결과가 포함된 카드로 표시됩니다.
- Ctrl+O로 접힘/확장 보기를 전환합니다.
- 도구 실행 중에는 부분 업데이트가 동일한 카드로 스트리밍됩니다.

## 히스토리 + 스트리밍

- 연결 시 TUI는 최신 히스토리를 로드합니다 (기본값 200개 메시지).
- 스트리밍 응답은 완료될 때까지 제자리에서 업데이트됩니다.
- TUI는 더 풍부한 도구 카드를 위해 에이전트 도구 이벤트도 수신합니다.

## 연결 세부 정보

- TUI는 Gateway에 `mode: "tui"`로 등록됩니다.
- 재연결 시 시스템 메시지가 표시되며, 이벤트 누락은 로그에 표시됩니다.

## 옵션

- `--url <url>`: Gateway WebSocket URL (기본값은 설정 또는 `ws://127.0.0.1:<port>`)
- `--token <token>`: Gateway 토큰 (필요한 경우)
- `--password <password>`: Gateway 비밀번호 (필요한 경우)
- `--session <key>`: 세션 키 (기본값: `main`, 또는 범위가 전역일 때 `global`)
- `--deliver`: 어시스턴트 응답을 프로바이더로 전달 (기본값: 꺼짐)
- `--thinking <level>`: 전송 시 생각 수준 오버라이드
- `--timeout-ms <ms>`: 에이전트 타임아웃 (ms) (기본값: `agents.defaults.timeoutSeconds`)

참고: `--url`을 설정하면 TUI는 설정이나 환경 변수 자격 증명으로 폴백하지 않습니다.
`--token` 또는 `--password`를 명시적으로 전달하세요. 명시적 자격 증명이 없으면 오류입니다.

## 문제 해결

메시지를 보낸 후 출력이 없는 경우:

- TUI에서 `/status`을 실행하여 Gateway가 연결되어 있고 유휴/바쁜 상태인지 확인합니다.
- Gateway 로그를 확인합니다: `openclaw logs --follow`.
- 에이전트가 실행 가능한지 확인합니다: `openclaw status` 및 `openclaw models status`.
- 채널에서 메시지를 기대한다면 전달을 활성화합니다 (`/deliver on` 또는 `--deliver`).
- `--history-limit <n>`: 로드할 히스토리 항목 수 (기본값 200)

## 문제 해결

- `disconnected`: Gateway가 실행 중인지, `--url/--token/--password`가 올바른지 확인합니다.
- 선택기에 에이전트가 없는 경우: `openclaw agents list`와 라우팅 설정을 확인합니다.
- 세션 선택기가 비어 있는 경우: 전역 범위에 있거나 아직 세션이 없을 수 있습니다.
