---
summary: "디버깅 도구: watch 모드, 원시 모델 스트림, 그리고 추론 누출 추적"
read_when:
  - "추론 누출을 확인하기 위해 원시 모델 출력을 검사해야 할 때"
  - "반복 작업 중 Gateway(게이트웨이)를 watch 모드로 실행하고 싶을 때"
  - "재현 가능한 디버깅 워크플로가 필요할 때"
title: "디버깅"
x-i18n:
  source_path: debugging.md
  source_hash: 504c824bff479000
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:39:41Z
---

# 디버깅

이 페이지는 스트리밍 출력에 대한 디버깅 헬퍼를 다루며, 특히 프로바이더가 추론을 일반 텍스트에 섞어 보내는 경우를 대상으로 합니다.

## 런타임 디버그 오버라이드

채팅에서 `/debug` 를 사용해 **런타임 전용** 설정 오버라이드(메모리, 디스크 아님)를 설정합니다.
`/debug` 는 기본적으로 비활성화되어 있으며, `commands.debug: true` 로 활성화합니다.
이는 `openclaw.json` 를 편집하지 않고도 잘 알려지지 않은 설정을 토글해야 할 때 유용합니다.

예시:

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug unset messages.responsePrefix
/debug reset
```

`/debug reset` 는 모든 오버라이드를 지우고 디스크 상의 설정으로 되돌립니다.

## Gateway watch 모드

빠른 반복 작업을 위해 파일 워처 하에서 Gateway(게이트웨이)를 실행합니다:

```bash
pnpm gateway:watch --force
```

이는 다음에 매핑됩니다:

```bash
tsx watch src/entry.ts gateway --force
```

`gateway:watch` 뒤에 어떤 Gateway CLI 플래그든 추가하면, 재시작 시마다 전달됩니다.

## Dev 프로파일 + dev Gateway (--dev)

디버깅을 위해 상태를 격리하고 안전하며 일회용인 설정을 빠르게 띄우려면 dev 프로파일을 사용합니다. `--dev` 플래그는 **두 가지**가 있습니다:

- **전역 `--dev` (프로파일):** 상태를 `~/.openclaw-dev` 아래로 격리하고
  Gateway 포트를 기본값 `19001` 로 설정합니다(파생 포트도 함께 이동).
- **`gateway --dev`: 누락 시 기본 설정 + 워크스페이스를 자동 생성하도록 Gateway(게이트웨이)에 지시**합니다(BOOTSTRAP.md 건너뜀).

권장 흐름(dev 프로파일 + dev 부트스트랩):

```bash
pnpm gateway:dev
OPENCLAW_PROFILE=dev openclaw tui
```

아직 전역 설치가 없다면 `pnpm openclaw ...` 를 통해 CLI 를 실행하세요.

이 작업이 수행하는 내용:

1. **프로파일 격리** (전역 `--dev`)
   - `OPENCLAW_PROFILE=dev`
   - `OPENCLAW_STATE_DIR=~/.openclaw-dev`
   - `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
   - `OPENCLAW_GATEWAY_PORT=19001` (브라우저/캔버스도 이에 맞게 이동)

2. **Dev 부트스트랩** (`gateway --dev`)
   - 누락 시 최소 설정을 작성(`gateway.mode=local`, loopback 바인드).
   - `agent.workspace` 를 dev 워크스페이스로 설정.
   - `agent.skipBootstrap=true` 설정(BOOTSTRAP.md 없음).
   - 누락 시 워크스페이스 파일 시드:
     `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`.
   - 기본 아이덴티티: **C3‑PO** (프로토콜 드로이드).
   - dev 모드에서 채널 프로바이더 건너뜀(`OPENCLAW_SKIP_CHANNELS=1`).

리셋 흐름(새로 시작):

```bash
pnpm gateway:dev:reset
```

참고: `--dev` 는 **전역** 프로파일 플래그이며 일부 러너에서 소모됩니다.
명시해야 한다면 환경 변수 형식을 사용하세요:

```bash
OPENCLAW_PROFILE=dev openclaw gateway --dev --reset
```

`--reset` 는 설정, 자격 증명, 세션, 그리고 dev 워크스페이스를 삭제한 뒤(`trash` 사용, `rm` 아님) 기본 dev 설정을 다시 생성합니다.

팁: 이미 non‑dev Gateway(게이트웨이)가 실행 중이라면(launchd/systemd), 먼저 중지하세요:

```bash
openclaw gateway stop
```

## 원시 스트림 로깅(OpenClaw)

OpenClaw 는 어떤 필터링/포맷팅 이전의 **원시 어시스턴트 스트림**을 로깅할 수 있습니다.
이는 추론이 일반 텍스트 델타로 도착하는지(또는 별도의 thinking 블록으로 오는지) 확인하는 최선의 방법입니다.

CLI 로 활성화:

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

## 원시 청크 로깅(pi-mono)

블록으로 파싱되기 이전의 **원시 OpenAI 호환 청크**를 캡처하려면,
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

## 안전 주의사항

- 원시 스트림 로그에는 전체 프롬프트, 도구 출력, 사용자 데이터가 포함될 수 있습니다.
- 로그는 로컬에 보관하고 디버깅 후 삭제하세요.
- 로그를 공유할 경우, 먼저 비밀 정보와 PII 를 제거하세요.
