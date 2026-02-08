---
summary: "로깅 표면, 파일 로그, WS 로그 스타일, 콘솔 서식"
read_when:
  - 로깅 출력 또는 형식을 변경할 때
  - CLI 또는 게이트웨이 출력을 디버깅할 때
title: "로깅"
x-i18n:
  source_path: gateway/logging.md
  source_hash: efb8eda5e77e3809
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:39:55Z
---

# 로깅

사용자 관점의 개요 (CLI + Control UI + 설정)는 [/logging](/logging)을 참고하십시오.

OpenClaw 에는 두 가지 로그 '표면'이 있습니다:

- **콘솔 출력** (터미널 / Debug UI 에서 보이는 내용)
- **파일 로그** (JSON 라인), 게이트웨이 로거가 기록합니다.

## 파일 기반 로거

- 기본 롤링 로그 파일은 `/tmp/openclaw/` 아래에 있습니다 (하루당 파일 1개): `openclaw-YYYY-MM-DD.log`
  - 날짜는 게이트웨이 호스트의 로컬 타임존을 사용합니다.
- 로그 파일 경로와 레벨은 `~/.openclaw/openclaw.json` 를 통해 설정할 수 있습니다:
  - `logging.file`
  - `logging.level`

파일 형식은 한 줄에 하나의 JSON 객체입니다.

Control UI 의 Logs 탭은 게이트웨이를 통해 이 파일을 tail 합니다 (`logs.tail`).
CLI 도 동일하게 수행할 수 있습니다:

```bash
openclaw logs --follow
```

**Verbose 와 로그 레벨**

- **파일 로그**는 오직 `logging.level` 에 의해 제어됩니다.
- `--verbose` 는 **콘솔 상세도** (및 WS 로그 스타일)에만 영향을 주며,
  파일 로그 레벨을 올리지는 **않습니다**.
- 파일 로그에 verbose 전용 세부 정보를 캡처하려면 `logging.level` 을
  `debug` 또는 `trace` 로 설정하십시오.

## 콘솔 캡처

CLI 는 `console.log/info/warn/error/debug/trace` 을 캡처하여 파일 로그에 기록하면서,
stdout/stderr 로의 출력은 계속 유지합니다.

콘솔 상세도는 다음을 통해 독립적으로 조정할 수 있습니다:

- `logging.consoleLevel` (기본값 `info`)
- `logging.consoleStyle` (`pretty` | `compact` | `json`)

## 도구 요약 마스킹

Verbose 도구 요약 (예: `🛠️ Exec: ...`)은 콘솔 스트림에 도달하기 전에
민감한 토큰을 마스킹할 수 있습니다. 이는 **도구 전용**이며 파일 로그는 변경하지 않습니다.

- `logging.redactSensitive`: `off` | `tools` (기본값: `tools`)
- `logging.redactPatterns`: 정규식 문자열 배열 (기본값을 재정의)
  - 원시 정규식 문자열을 사용하십시오 (자동 `gi`), 또는 사용자 정의 플래그가 필요하면 `/pattern/flags` 를 사용하십시오.
  - 매칭된 값은 처음 6자 + 마지막 4자를 유지하여 마스킹합니다 (길이 >= 18). 그 외에는 `***` 처리합니다.
  - 기본값은 일반적인 키 할당, CLI 플래그, JSON 필드, bearer 헤더, PEM 블록, 그리고 널리 쓰이는 토큰 접두사를 포함합니다.

## Gateway WebSocket 로그

게이트웨이는 WebSocket 프로토콜 로그를 두 가지 모드로 출력합니다:

- **일반 모드 (`--verbose` 없음)**: '흥미로운' RPC 결과만 출력합니다:
  - 오류 (`ok=false`)
  - 느린 호출 (기본 임계값: `>= 50ms`)
  - 파싱 오류
- **Verbose 모드 (`--verbose`)**: 모든 WS 요청/응답 트래픽을 출력합니다.

### WS 로그 스타일

`openclaw gateway` 는 게이트웨이별 스타일 전환을 지원합니다:

- `--ws-log auto` (기본값): 일반 모드는 최적화되며, verbose 모드는 간결한 출력
- `--ws-log compact`: verbose 시 간결한 출력 (요청/응답 쌍)
- `--ws-log full`: verbose 시 프레임별 전체 출력
- `--compact`: `--ws-log compact` 의 별칭

예시:

```bash
# optimized (only errors/slow)
openclaw gateway

# show all WS traffic (paired)
openclaw gateway --verbose --ws-log compact

# show all WS traffic (full meta)
openclaw gateway --verbose --ws-log full
```

## 콘솔 서식 (서브시스템 로깅)

콘솔 포매터는 **TTY 인식**을 하며, 일관된 접두사가 있는 줄을 출력합니다.
서브시스템 로거는 출력을 그룹화하여 스캔하기 쉽게 유지합니다.

동작:

- 모든 줄에 **서브시스템 접두사** (예: `[gateway]`, `[canvas]`, `[tailscale]`)
- **서브시스템 색상** (서브시스템별로 고정) + 레벨 색상
- **출력이 TTY 이거나 풍부한 터미널로 보이는 환경일 때 색상 적용** (`TERM`/`COLORTERM`/`TERM_PROGRAM`), `NO_COLOR` 를 존중
- **축약된 서브시스템 접두사**: 선행 `gateway/` + `channels/` 를 제거하고 마지막 2개 세그먼트만 유지 (예: `whatsapp/outbound`)
- **서브시스템별 하위 로거** (자동 접두사 + 구조화 필드 `{ subsystem }`)
- QR/UX 출력용 **`logRaw()`** (접두사 없음, 서식 없음)
- **콘솔 스타일** (예: `pretty | compact | json`)
- **콘솔 로그 레벨**은 파일 로그 레벨과 분리됨 (파일은 `logging.level` 가 `debug`/`trace` 로 설정되어 있을 때 전체 세부 정보를 유지)
- **WhatsApp 메시지 본문**은 `debug` 레벨로 기록됩니다 (`--verbose` 를 사용하여 확인)

이를 통해 기존 파일 로그의 안정성을 유지하면서, 상호작용형 출력은 스캔하기 쉬워집니다.
