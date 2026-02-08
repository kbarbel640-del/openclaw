---
summary: "하나의 호스트에서 여러 OpenClaw Gateways 를 실행합니다(격리, 포트, 프로필)."
read_when:
  - 동일한 머신에서 두 개 이상의 Gateway 를 실행하는 경우
  - Gateway 별로 격리된 설정/상태/포트가 필요한 경우
title: "여러 Gateways"
x-i18n:
  source_path: gateway/multiple-gateways.md
  source_hash: 09b5035d4e5fb97c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:39:51Z
---

# 여러 Gateways (동일 호스트)

대부분의 설정에서는 하나의 Gateway 를 사용하는 것이 적합합니다. 단일 Gateway 는 여러 메시징 연결과 에이전트를 처리할 수 있기 때문입니다. 더 강한 격리나 중복성(예: 구조용 봇)이 필요하다면, 격리된 프로필/포트를 사용하는 별도의 Gateways 를 실행하십시오.

## 격리 체크리스트(필수)

- `OPENCLAW_CONFIG_PATH` — 인스턴스별 설정 파일
- `OPENCLAW_STATE_DIR` — 인스턴스별 세션, 자격 증명, 캐시
- `agents.defaults.workspace` — 인스턴스별 작업 공간 루트
- `gateway.port` (또는 `--port`) — 인스턴스마다 고유
- 파생 포트(브라우저/캔버스)는 서로 겹치지 않아야 합니다

이 항목들이 공유되면 설정 경쟁 상태와 포트 충돌이 발생합니다.

## 권장: 프로필(`--profile`)

프로필은 `OPENCLAW_STATE_DIR` + `OPENCLAW_CONFIG_PATH` 를 자동으로 범위 지정하고 서비스 이름에 접미사를 추가합니다.

```bash
# main
openclaw --profile main setup
openclaw --profile main gateway --port 18789

# rescue
openclaw --profile rescue setup
openclaw --profile rescue gateway --port 19001
```

프로필별 서비스:

```bash
openclaw --profile main gateway install
openclaw --profile rescue gateway install
```

## 구조용 봇 가이드

동일한 호스트에서 두 번째 Gateway 를 다음 항목을 각각 갖도록 실행하십시오.

- 프로필/설정
- 상태 디렉토리
- 작업 공간
- 기본 포트(및 파생 포트)

이렇게 하면 구조용 봇이 메인 봇과 격리되어, 기본 봇이 중단되었을 때 디버그하거나 설정 변경을 적용할 수 있습니다.

포트 간격: 파생된 브라우저/캔버스/CDP 포트가 절대 충돌하지 않도록 기본 포트 간에 최소 20개의 포트를 비워 두십시오.

### 설치 방법(구조용 봇)

```bash
# Main bot (existing or fresh, without --profile param)
# Runs on port 18789 + Chrome CDC/Canvas/... Ports
openclaw onboard
openclaw gateway install

# Rescue bot (isolated profile + ports)
openclaw --profile rescue onboard
# Notes:
# - workspace name will be postfixed with -rescue per default
# - Port should be at least 18789 + 20 Ports,
#   better choose completely different base port, like 19789,
# - rest of the onboarding is the same as normal

# To install the service (if not happened automatically during onboarding)
openclaw --profile rescue gateway install
```

## 포트 매핑(파생)

기본 포트 = `gateway.port` (또는 `OPENCLAW_GATEWAY_PORT` / `--port`).

- 브라우저 제어 서비스 포트 = 기본 + 2 (local loopback 전용)
- `canvasHost.port = base + 4`
- 브라우저 프로필 CDP 포트는 `browser.controlPort + 9 .. + 108` 에서 자동 할당됩니다

설정이나 환경 변수에서 이들 중 어떤 것이든 재정의하는 경우, 인스턴스별로 고유하게 유지해야 합니다.

## 브라우저/CDP 참고 사항(자주 발생하는 함정)

- 여러 인스턴스에서 `browser.cdpUrl` 을 동일한 값으로 고정하지 마십시오.
- 각 인스턴스에는 자체 브라우저 제어 포트와 CDP 범위가 필요합니다(게이트웨이 포트에서 파생됨).
- 명시적인 CDP 포트가 필요하면 인스턴스별로 `browser.profiles.<name>.cdpPort` 을 설정하십시오.
- 원격 Chrome: `browser.profiles.<name>.cdpUrl` 을 사용하십시오(프로필별, 인스턴스별).

## 수동 환경 변수 예시

```bash
OPENCLAW_CONFIG_PATH=~/.openclaw/main.json \
OPENCLAW_STATE_DIR=~/.openclaw-main \
openclaw gateway --port 18789

OPENCLAW_CONFIG_PATH=~/.openclaw/rescue.json \
OPENCLAW_STATE_DIR=~/.openclaw-rescue \
openclaw gateway --port 19001
```

## 빠른 확인

```bash
openclaw --profile main status
openclaw --profile rescue status
openclaw --profile rescue browser status
```
