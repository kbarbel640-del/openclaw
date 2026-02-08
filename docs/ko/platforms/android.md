---
summary: "Android 앱 (node): 연결 런북 + Canvas/Chat/Camera"
read_when:
  - Android node 페어링 또는 재연결 시
  - Android Gateway(게이트웨이) 디스커버리 또는 인증 디버깅 시
  - 클라이언트 간 채팅 기록 동기화 일치 여부 확인 시
title: "Android 앱"
x-i18n:
  source_path: platforms/android.md
  source_hash: 9cd02f12065ce2bc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:40:00Z
---

# Android 앱 (Node)

## 지원 스냅샷

- 역할: 컴패니언 node 앱 (Android 는 Gateway 를 호스팅하지 않습니다).
- Gateway 필요: 예 (macOS, Linux, 또는 WSL2 를 통한 Windows 에서 실행).
- 설치: [시작하기](/start/getting-started) + [페어링](/gateway/pairing).
- Gateway: [런북](/gateway) + [구성](/gateway/configuration).
  - 프로토콜: [Gateway 프로토콜](/gateway/protocol) (nodes + 컨트롤 플레인).

## 시스템 제어

시스템 제어 (launchd/systemd) 는 Gateway 호스트에 있습니다. [Gateway](/gateway)를 참조하십시오.

## 연결 런북

Android node 앱 ⇄ (mDNS/NSD + WebSocket) ⇄ **Gateway**

Android 는 Gateway WebSocket (기본값 `ws://<host>:18789`) 에 직접 연결하며, Gateway 소유의 페어링을 사용합니다.

### 사전 요구 사항

- “마스터” 머신에서 Gateway 를 실행할 수 있어야 합니다.
- Android 기기/에뮬레이터가 Gateway WebSocket 에 도달할 수 있어야 합니다:
  - mDNS/NSD 를 사용하는 동일 LAN, **또는**
  - Wide-Area Bonjour / unicast DNS-SD 를 사용하는 동일 Tailscale tailnet (아래 참조), **또는**
  - 수동 Gateway 호스트/포트 (폴백)
- Gateway 머신에서 CLI (`openclaw`) 를 실행할 수 있어야 합니다 (또는 SSH 를 통해).

### 1) Gateway 시작

```bash
openclaw gateway --port 18789 --verbose
```

로그에서 다음과 같은 항목이 보이는지 확인하십시오:

- `listening on ws://0.0.0.0:18789`

tailnet 전용 구성 (비엔나 ⇄ 런던 권장) 의 경우, Gateway 를 tailnet IP 에 바인딩하십시오:

- Gateway 호스트의 `~/.openclaw/openclaw.json` 에서 `gateway.bind: "tailnet"` 를 설정합니다.
- Gateway / macOS 메뉴바 앱을 재시작합니다.

### 2) 디스커버리 확인 (선택 사항)

Gateway 머신에서:

```bash
dns-sd -B _openclaw-gw._tcp local.
```

추가 디버깅 노트: [Bonjour](/gateway/bonjour).

#### unicast DNS-SD 를 통한 Tailnet (비엔나 ⇄ 런던) 디스커버리

Android NSD/mDNS 디스커버리는 네트워크를 넘어가지 않습니다. Android node 와 Gateway 가 서로 다른 네트워크에 있지만 Tailscale 로 연결되어 있다면, Wide-Area Bonjour / unicast DNS-SD 를 대신 사용하십시오:

1. Gateway 호스트에 DNS-SD 존 (예: `openclaw.internal.`) 을 설정하고 `_openclaw-gw._tcp` 레코드를 게시합니다.
2. 선택한 도메인을 해당 DNS 서버로 가리키도록 Tailscale 분할 DNS 를 구성합니다.

자세한 내용 및 CoreDNS 구성 예제: [Bonjour](/gateway/bonjour).

### 3) Android 에서 연결

Android 앱에서:

- 앱은 **포그라운드 서비스** (영구 알림) 를 통해 Gateway 연결을 유지합니다.
- **Settings** 를 엽니다.
- **Discovered Gateways** 아래에서 Gateway 를 선택하고 **Connect** 를 누릅니다.
- mDNS 가 차단된 경우 **Advanced → Manual Gateway** (호스트 + 포트) 를 사용하고 **Connect (Manual)** 을 누릅니다.

첫 번째 페어링이 성공하면 Android 는 실행 시 자동으로 재연결합니다:

- 수동 엔드포인트 (활성화된 경우), 그렇지 않으면
- 마지막으로 발견된 Gateway (최선의 시도).

### 4) 페어링 승인 (CLI)

Gateway 머신에서:

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
```

페어링 세부 정보: [Gateway 페어링](/gateway/pairing).

### 5) node 연결 확인

- nodes 상태를 통해:
  ```bash
  openclaw nodes status
  ```
- Gateway 를 통해:
  ```bash
  openclaw gateway call node.list --params "{}"
  ```

### 6) 채팅 + 기록

Android node 의 Chat 시트는 Gateway 의 **기본 세션 키** (`main`) 를 사용하므로, WebChat 및 다른 클라이언트와 기록과 응답이 공유됩니다:

- 기록: `chat.history`
- 전송: `chat.send`
- 푸시 업데이트 (최선의 시도): `chat.subscribe` → `event:"chat"`

### 7) Canvas + 카메라

#### Gateway Canvas Host (웹 콘텐츠 권장)

에이전트가 디스크의 파일을 편집할 수 있는 실제 HTML/CSS/JS 를 node 에 표시하려면, node 를 Gateway canvas host 로 지정하십시오.

참고: node 는 `canvasHost.port` (기본값 `18793`) 의 독립형 canvas host 를 사용합니다.

1. Gateway 호스트에서 `~/.openclaw/workspace/canvas/index.html` 를 생성합니다.

2. node 를 해당 주소로 이동합니다 (LAN):

```bash
openclaw nodes invoke --node "<Android Node>" --command canvas.navigate --params '{"url":"http://<gateway-hostname>.local:18793/__openclaw__/canvas/"}'
```

Tailnet (선택 사항): 두 기기가 모두 Tailscale 에 있다면, `.local` 대신 MagicDNS 이름 또는 tailnet IP (예: `http://<gateway-magicdns>:18793/__openclaw__/canvas/`) 를 사용하십시오.

이 서버는 HTML 에 라이브 리로드 클라이언트를 주입하고 파일 변경 시 다시 로드합니다.
A2UI 호스트는 `http://<gateway-host>:18793/__openclaw__/a2ui/` 에 있습니다.

Canvas 명령 (포그라운드 전용):

- `canvas.eval`, `canvas.snapshot`, `canvas.navigate` (기본 스캐폴드로 돌아가려면 `{"url":""}` 또는 `{"url":"/"}` 를 사용하십시오). `canvas.snapshot` 는 `{ format, base64 }` (기본값 `format="jpeg"`) 을 반환합니다.
- A2UI: `canvas.a2ui.push`, `canvas.a2ui.reset` (`canvas.a2ui.pushJSONL` 레거시 별칭)

카메라 명령 (포그라운드 전용; 권한 필요):

- `camera.snap` (jpg)
- `camera.clip` (mp4)

매개변수 및 CLI 헬퍼는 [Camera node](/nodes/camera) 를 참조하십시오.
