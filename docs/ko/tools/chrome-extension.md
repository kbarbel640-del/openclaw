---
summary: "Chrome 확장 프로그램: OpenClaw 가 기존 Chrome 탭을 제어하도록 합니다"
read_when:
  - 에이전트가 기존 Chrome 탭을 제어하도록 하려는 경우 (툴바 버튼)
  - Tailscale 를 통해 원격 Gateway + 로컬 브라우저 자동화가 필요한 경우
  - 브라우저 장악의 보안 영향을 이해하려는 경우
title: "Chrome 확장 프로그램"
x-i18n:
  source_path: tools/chrome-extension.md
  source_hash: 3b77bdad7d3dab6a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:53Z
---

# Chrome 확장 프로그램 (브라우저 릴레이)

OpenClaw Chrome 확장 프로그램을 사용하면 별도의 openclaw 관리 Chrome 프로필을 실행하는 대신 **기존 Chrome 탭**(일반 Chrome 창)을 에이전트가 제어할 수 있습니다.

연결/해제는 **단일 Chrome 툴바 버튼**으로 이루어집니다.

## 개요 (개념)

구성 요소는 세 가지입니다:

- **브라우저 제어 서비스** (Gateway 또는 노드): 에이전트/도구가 (Gateway 를 통해) 호출하는 API
- **로컬 릴레이 서버** (loopback CDP): 제어 서버와 확장 프로그램 사이를 브리지함 (기본값: `http://127.0.0.1:18792`)
- **Chrome MV3 확장 프로그램**: `chrome.debugger` 를 사용해 활성 탭에 연결하고 CDP 메시지를 릴레이로 전달함

이후 OpenClaw 는 정상적인 `browser` 도구 표면을 통해 연결된 탭을 제어합니다 (올바른 프로필 선택).

## 설치 / 로드 (언팩)

1. 안정적인 로컬 경로에 확장 프로그램을 설치합니다:

```bash
openclaw browser extension install
```

2. 설치된 확장 프로그램 디렉토리 경로를 출력합니다:

```bash
openclaw browser extension path
```

3. Chrome → `chrome://extensions`

- “개발자 모드” 활성화
- “압축해제된 확장 프로그램 로드” → 위에서 출력된 디렉토리 선택

4. 확장 프로그램을 고정합니다.

## 업데이트 (빌드 단계 없음)

확장 프로그램은 OpenClaw 릴리스 (npm 패키지) 내부에 정적 파일로 포함되어 있습니다. 별도의 “빌드” 단계는 없습니다.

OpenClaw 업그레이드 후:

- `openclaw browser extension install` 를 다시 실행하여 OpenClaw 상태 디렉토리 아래의 설치 파일을 새로 고칩니다.
- Chrome → `chrome://extensions` → 확장 프로그램에서 “다시 로드”를 클릭합니다.

## 사용 방법 (추가 설정 없음)

OpenClaw 에는 기본 포트의 확장 프로그램 릴레이를 대상으로 하는 `chrome` 이라는 내장 브라우저 프로필이 포함되어 있습니다.

사용 방법:

- CLI: `openclaw browser --browser-profile chrome tabs`
- 에이전트 도구: `browser` 에서 `profile="chrome"` 사용

다른 이름이나 다른 릴레이 포트를 원한다면, 사용자 정의 프로필을 생성하십시오:

```bash
openclaw browser create-profile \
  --name my-chrome \
  --driver extension \
  --cdp-url http://127.0.0.1:18792 \
  --color "#00AA00"
```

## 연결 / 해제 (툴바 버튼)

- OpenClaw 가 제어할 탭을 엽니다.
- 확장 프로그램 아이콘을 클릭합니다.
  - 연결되면 배지에 `ON` 가 표시됩니다.
- 다시 클릭하면 해제됩니다.

## 어떤 탭을 제어하나요?

- 보고 있는 “어떤 탭이든 자동으로” 제어하지 않습니다.
- 툴바 버튼을 클릭하여 **명시적으로 연결한 탭만** 제어합니다.
- 전환하려면 다른 탭을 열고 해당 탭에서 확장 프로그램 아이콘을 클릭하십시오.

## 배지 + 일반적인 오류

- `ON`: 연결됨; OpenClaw 가 해당 탭을 제어할 수 있습니다.
- `…`: 로컬 릴레이에 연결 중입니다.
- `!`: 릴레이에 연결할 수 없습니다 (가장 흔한 원인: 이 머신에서 브라우저 릴레이 서버가 실행 중이 아님).

`!` 이 보이면:

- Gateway 가 로컬에서 실행 중인지 확인하십시오 (기본 설정). Gateway 가 다른 곳에서 실행 중이라면 이 머신에서 노드 호스트를 실행하십시오.
- 확장 프로그램 옵션 페이지를 여십시오. 릴레이 도달 가능 여부가 표시됩니다.

## 원격 Gateway (노드 호스트 사용)

### 로컬 Gateway (Chrome 과 동일한 머신) — 보통 **추가 단계 없음**

Gateway 가 Chrome 과 같은 머신에서 실행 중이면, loopback 에서 브라우저 제어 서비스를 시작하고 릴레이 서버를 자동으로 시작합니다. 확장 프로그램은 로컬 릴레이와 통신하고, CLI/도구 호출은 Gateway 로 전달됩니다.

### 원격 Gateway (Gateway 가 다른 머신에서 실행) — **노드 호스트 실행**

Gateway 가 다른 머신에서 실행 중이라면, Chrome 이 실행되는 머신에서 노드 호스트를 시작하십시오.
Gateway 는 브라우저 작업을 해당 노드로 프록시하며, 확장 프로그램 + 릴레이는 브라우저 머신에 로컬로 유지됩니다.

여러 노드가 연결된 경우, `gateway.nodes.browser.node` 로 하나를 고정하거나 `gateway.nodes.browser.mode` 를 설정하십시오.

## 샌드박스 처리 (도구 컨테이너)

에이전트 세션이 샌드박스 처리된 경우 (`agents.defaults.sandbox.mode != "off"`), `browser` 도구가 제한될 수 있습니다:

- 기본적으로 샌드박스 처리된 세션은 호스트 Chrome 이 아니라 **샌드박스 브라우저** (`target="sandbox"`) 를 대상으로 하는 경우가 많습니다.
- Chrome 확장 프로그램 릴레이 장악은 **호스트** 브라우저 제어 서버를 제어해야 합니다.

옵션:

- 가장 쉬운 방법: **비샌드박스** 세션/에이전트에서 확장 프로그램을 사용하십시오.
- 또는 샌드박스 세션에서 호스트 브라우저 제어를 허용하십시오:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        browser: {
          allowHostControl: true,
        },
      },
    },
  },
}
```

그런 다음 도구 정책에 의해 도구가 거부되지 않는지 확인하고, 필요하다면 `target="host"` 와 함께 `browser` 를 호출하십시오.

디버깅: `openclaw sandbox explain`

## 원격 액세스 팁

- Gateway 와 노드 호스트를 동일한 tailnet 에 유지하고, 릴레이 포트를 LAN 이나 공용 인터넷에 노출하지 마십시오.
- 노드를 의도적으로 페어링하고, 원격 제어를 원치 않는 경우 브라우저 프록시 라우팅을 비활성화하십시오 (`gateway.nodes.browser.mode="off"`).

## “확장 프로그램 경로”의 동작 방식

`openclaw browser extension path` 는 확장 프로그램 파일이 포함된 **설치된** 디스크 상의 디렉토리를 출력합니다.

CLI 는 의도적으로 `node_modules` 경로를 출력하지 않습니다. 항상 `openclaw browser extension install` 를 먼저 실행하여 OpenClaw 상태 디렉토리 아래의 안정적인 위치로 확장 프로그램을 복사하십시오.

해당 설치 디렉토리를 이동하거나 삭제하면, 유효한 경로에서 다시 로드할 때까지 Chrome 은 확장 프로그램을 손상된 것으로 표시합니다.

## 보안 영향 (반드시 읽으십시오)

이는 강력하지만 위험합니다. 모델에게 “브라우저를 직접 다룰 수 있는 손”을 주는 것과 동일하게 취급하십시오.

- 확장 프로그램은 Chrome 의 디버거 API (`chrome.debugger`) 를 사용합니다. 연결되면 모델은 다음을 수행할 수 있습니다:
  - 해당 탭에서 클릭/입력/탐색
  - 페이지 콘텐츠 읽기
  - 해당 탭의 로그인된 세션이 접근할 수 있는 모든 항목에 접근
- 전용 openclaw 관리 프로필과 달리 **격리되어 있지 않습니다**.
  - 일상적으로 사용하는 프로필/탭에 연결하면 해당 계정 상태에 대한 접근을 허용하게 됩니다.

권장 사항:

- 확장 프로그램 릴레이 사용을 위해 개인 브라우징과 분리된 전용 Chrome 프로필을 사용하십시오.
- Gateway 와 모든 노드 호스트를 tailnet 전용으로 유지하고, Gateway 인증 + 노드 페어링에 의존하십시오.
- 릴레이 포트를 LAN (`0.0.0.0`) 이나 Funnel (공용)에 노출하지 마십시오.
- 릴레이는 확장 프로그램이 아닌 출처를 차단하며, CDP 클라이언트에 대해 내부 인증 토큰을 요구합니다.

관련 문서:

- 브라우저 도구 개요: [Browser](/tools/browser)
- 보안 감사: [Security](/gateway/security)
- Tailscale 설정: [Tailscale](/gateway/tailscale)
