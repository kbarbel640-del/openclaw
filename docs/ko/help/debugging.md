---
summary: "디버깅 도구: 감시 모드, 원시 모델 스트림, 추론 누출 추적"
read_when:
  - 추론 누출을 확인하기 위해 원시 모델 출력을 검사해야 할 때
  - 반복 작업 중에 Gateway(게이트웨이)를 감시 모드로 실행하고 싶을 때
  - 반복 가능한 디버깅 워크플로가 필요할 때
title: "디버깅"
x-i18n:
  source_path: help/debugging.md
  source_hash: 504c824bff479000
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:50Z
---

# 디버깅

이 페이지는 스트리밍 출력에 대한 디버깅 도우미를 다루며, 특히 프로바이더가 일반 텍스트에 추론을 섞어 보내는 경우를 중심으로 설명합니다.

## 런타임 디버그 오버라이드

채팅에서 `/debug` 를 사용하여 **런타임 전용** 설정 오버라이드(디스크가 아닌 메모리)를 설정합니다.
`/debug` 는 기본적으로 비활성화되어 있으며, `commands.debug: true` 로 활성화합니다.
이는 `openclaw.json` 를 편집하지 않고도 잘 사용되지 않는 설정을 토글해야 할 때 유용합니다.

예시:

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug unset messages.responsePrefix
/debug reset
```

`/debug reset` 는 모든 오버라이드를 지우고 디스크에 저장된 설정으로 되돌립니다.

## Gateway 감시 모드

빠른 반복 작업을 위해 파일 감시자 아래에서 gateway 를 실행합니다:

```bash
pnpm gateway:watch --force
```

이는 다음과 동일합니다:

```bash
tsx watch src/entry.ts gateway --force
```

`gateway:watch` 뒤에 gateway CLI 플래그를 추가하면, 재시작할 때마다 해당 플래그가 전달됩니다.

## 개발 프로필 + 개발 게이트웨이 (--dev)

디버깅을 위해 상태를 분리하고 안전하며 일회용인 설정을 빠르게 구성하려면 개발 프로필을 사용합니다. **두 가지** `--dev` 플래그가 있습니다:

- **전역 `--dev` (프로필):** 상태를 `~/.openclaw-dev` 아래로 분리하고
  gateway 포트를 기본적으로 `19001` 로 설정합니다(파생 포트도 함께 이동).
- **`gateway --dev`: 설정이 없을 경우 기본 설정 +
  워크스페이스를 자동 생성** 하며(BOOTSTRAP.md 를 건너뜁니다).

권장 흐름(개발 프로필 + 개발 부트스트랩):

```bash
pnpm gateway:dev
OPENCLAW_PROFILE=dev openclaw tui
```

아직 전역 설치가 없다면 `pnpm openclaw ...` 를 통해 CLI 를 실행합니다.

이 과정에서 수행되는 작업:

1. **프로필 분리** (전역 `--dev`)
   - `OPENCLAW_PROFILE=dev`
   - `OPENCLAW_STATE_DIR=~/.openclaw-dev`
   - `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
   - `OPENCLAW_GATEWAY_PORT=19001` (브라우저/캔버스도 이에 맞게 이동)

2. **개발 부트스트랩** (`gateway --dev`)
   - 설정이 없을 경우 최소 설정을 작성합니다(`gateway.mode=local`, loopback 바인딩).
   - `agent.workspace` 를 개발 워크스페이스로 설정합니다.
   - `agent.skipBootstrap=true` 를 설정합니다(BOOTSTRAP.md 없음).
   - 워크스페이스 파일이 없을 경우 시드합니다:
     `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`.
   - 기본 아이덴티티: **C3‑PO** (프로토콜 드로이드).
   - 개발 모드에서 채널 프로바이더를 건너뜁니다(`OPENCLAW_SKIP_CHANNELS=1`).

리셋 흐름(완전 초기화):

```bash
pnpm gateway:dev:reset
```

참고: `--dev` 는 **전역** 프로필 플래그이며 일부 러너에서 소모됩니다.
명시적으로 지정해야 하는 경우 환경 변수 형식을 사용합니다:

```bash
OPENCLAW_PROFILE=dev openclaw gateway --dev --reset
```

`--reset` 는 설정, 자격 증명, 세션, 그리고 개발 워크스페이스를 모두 삭제한 뒤
(`trash` 사용, `rm` 아님) 기본 개발 설정을 다시 생성합니다.

팁: 비개발 gateway 가 이미 실행 중이라면(launchd/systemd), 먼저 중지하십시오:

```bash
openclaw gateway stop
```

## 원시 스트림 로깅 (OpenClaw)

OpenClaw 는 필터링/포맷팅 이전의 **원시 어시스턴트 스트림**을 로깅할 수 있습니다.
이는 추론이 일반 텍스트 델타로 도착하는지, 아니면 별도의 thinking 블록으로 도착하는지를 확인하는 가장 좋은 방법입니다.

CLI 를 통해 활성화합니다:

```bash
pnpm gateway:watch --force --raw-stream
```

선택적 경로 오버라이드:

```bash
pnpm gateway:watch --force --raw-stream --raw-stream-path ~/.openclaw/logs/raw-stream.jsonl
```

동등한 환경 변수:

```bash
OPENCLAW_RAW_STREAM=1
OPENCLAW_RAW_STREAM_PATH=~/.openclaw/logs/raw-stream.jsonl
```

기본 파일:

`~/.openclaw/logs/raw-stream.jsonl`

## 원시 청크 로깅 (pi-mono)

블록으로 파싱되기 전의 **원시 OpenAI 호환 청크**를 캡처하기 위해,
pi-mono 는 별도의 로거를 제공합니다:

```bash
PI_RAW_STREAM=1
```

선택적 경로:

```bash
PI_RAW_STREAM_PATH=~/.pi-mono/logs/raw-openai-completions.jsonl
```

기본 파일:

`~/.pi-mono/logs/raw-openai-completions.jsonl`

> 참고: 이는 pi-mono 의
> `openai-completions` 프로바이더를 사용하는 프로세스에서만 출력됩니다.

## 안전 참고 사항

- 원시 스트림 로그에는 전체 프롬프트, 도구 출력, 사용자 데이터가 포함될 수 있습니다.
- 로그는 로컬에만 보관하고 디버깅 후 삭제하십시오.
- 로그를 공유해야 할 경우, 먼저 비밀 정보와 개인 식별 정보(PII)를 제거하십시오.
