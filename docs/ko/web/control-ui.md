---
summary: "Gateway(게이트웨이)를 위한 브라우저 기반 제어 UI (채팅, 노드, 설정)"
read_when:
  - 브라우저에서 Gateway(게이트웨이)를 운영하고자 할 때
  - SSH 터널 없이 Tailnet 접근이 필요할 때
title: "Control UI"
x-i18n:
  source_path: web/control-ui.md
  source_hash: ad239e4a4354999a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:38:07Z
---

# Control UI (브라우저)

Control UI 는 Gateway(게이트웨이)에서 제공되는 소형 **Vite + Lit** 싱글 페이지 앱입니다:

- 기본값: `http://<host>:18789/`
- 선택적 접두사: `gateway.controlUi.basePath` 설정 (예: `/openclaw`)

동일한 포트에서 **Gateway WebSocket** 에 **직접** 통신합니다.

## 빠른 열기 (로컬)

Gateway(게이트웨이)가 동일한 컴퓨터에서 실행 중이면 다음을 여세요:

- http://127.0.0.1:18789/ (또는 http://localhost:18789/)

페이지가 로드되지 않으면 먼저 Gateway(게이트웨이)를 시작하세요: `openclaw gateway`.

인증은 WebSocket 핸드셰이크 중 다음을 통해 제공됩니다:

- `connect.params.auth.token`
- `connect.params.auth.password`
  대시보드 설정 패널에서 토큰을 저장할 수 있으며, 비밀번호는 영구 저장되지 않습니다.
  온보딩 마법사는 기본적으로 gateway 토큰을 생성하므로, 최초 연결 시 여기에 붙여넣으세요.

## 디바이스 페어링 (첫 연결)

새 브라우저 또는 디바이스에서 Control UI 에 연결하면, Gateway(게이트웨이)는
동일한 Tailnet 에서 `gateway.auth.allowTailscale: true` 을 사용 중이더라도 **일회성 페어링 승인**을 요구합니다.
이는 무단 접근을 방지하기 위한 보안 조치입니다.

**표시되는 내용:** "disconnected (1008): pairing required"

**디바이스 승인 방법:**

```bash
# List pending requests
openclaw devices list

# Approve by request ID
openclaw devices approve <requestId>
```

승인되면 해당 디바이스는 기억되며, `openclaw devices revoke --device <id> --role <role>` 으로 취소하지 않는 한 재승인이 필요하지 않습니다.
토큰 로테이션 및 취소는 [Devices CLI](/cli/devices)를 참고하세요.

**참고 사항:**

- 로컬 연결(`127.0.0.1`)은 자동 승인됩니다.
- 원격 연결(LAN, Tailnet 등)은 명시적 승인이 필요합니다.
- 각 브라우저 프로필은 고유한 디바이스 ID 를 생성하므로, 브라우저를 전환하거나
  브라우저 데이터를 삭제하면 재페어링이 필요합니다.

## 가능한 작업 (현재)

- Gateway WS 를 통한 모델 채팅 (`chat.history`, `chat.send`, `chat.abort`, `chat.inject`)
- 채팅에서 도구 호출 스트리밍 + 실시간 도구 출력 카드 (에이전트 이벤트)
- 채널: WhatsApp/Telegram/Discord/Slack + 플러그인 채널(Mattermost 등) 상태 + QR 로그인 + 채널별 설정 (`channels.status`, `web.login.*`, `config.patch`)
- 인스턴스: 프레즌스 목록 + 새로 고침 (`system-presence`)
- 세션: 목록 + 세션별 thinking/verbose 오버라이드 (`sessions.list`, `sessions.patch`)
- Cron 작업: 목록/추가/실행/활성화/비활성화 + 실행 이력 (`cron.*`)
- Skills: 상태, 활성화/비활성화, 설치, API 키 업데이트 (`skills.*`)
- 노드: 목록 + 기능(`node.list`)
- Exec 승인: gateway 또는 노드 허용 목록 편집 + `exec host=gateway/node` 에 대한 정책 질의 (`exec.approvals.*`)
- 설정: `~/.openclaw/openclaw.json` 보기/편집 (`config.get`, `config.set`)
- 설정: 검증(`config.apply`)과 함께 적용 + 재시작, 마지막 활성 세션 깨우기
- 설정 쓰기에는 동시 편집 덮어쓰기를 방지하는 base-hash 가드 포함
- 설정 스키마 + 폼 렌더링 (`config.schema`, 플러그인 + 채널 스키마 포함); Raw JSON 편집기는 계속 사용 가능
- 디버그: 상태/헬스/모델 스냅샷 + 이벤트 로그 + 수동 RPC 호출 (`status`, `health`, `models.list`)
- 로그: 필터/내보내기 기능이 있는 gateway 파일 로그의 실시간 테일 (`logs.tail`)
- 업데이트: 패키지/git 업데이트 실행 + 재시작 (`update.run`) 및 재시작 보고서

Cron 작업 패널 참고 사항:

- 격리된 작업의 경우, 기본 전달 방식은 요약 공지입니다. 내부 전용 실행을 원하면 none 으로 전환할 수 있습니다.
- announce 를 선택하면 채널/대상 필드가 표시됩니다.

## 채팅 동작

- `chat.send` 는 **논블로킹**입니다: `{ runId, status: "started" }` 로 즉시 ack 되며, 응답은 `chat` 이벤트로 스트리밍됩니다.
- 동일한 `idempotencyKey` 로 재전송하면 실행 중에는 `{ status: "in_flight" }` 를 반환하고, 완료 후에는 `{ status: "ok" }` 를 반환합니다.
- `chat.inject` 는 세션 트랜스크립트에 어시스턴트 노트를 추가하고, UI 전용 업데이트를 위한 `chat` 이벤트를 브로드캐스트합니다 (에이전트 실행 없음, 채널 전달 없음).
- 중지:
  - **Stop** 클릭 (`chat.abort` 호출)
  - `/stop` (또는 `stop|esc|abort|wait|exit|interrupt`) 입력으로 대역 외 중단
  - `chat.abort` 는 `{ sessionKey }` ( `runId` 없음 )을 지원하여 해당 세션의 모든 활성 실행을 중단합니다

## Tailnet 접근 (권장)

### 통합 Tailscale Serve (권장)

Gateway(게이트웨이)를 loopback 에 유지하고 Tailscale Serve 로 HTTPS 프록시를 사용하세요:

```bash
openclaw gateway --tailscale serve
```

열기:

- `https://<magicdns>/` (또는 설정된 `gateway.controlUi.basePath`)

기본적으로 Serve 요청은 `gateway.auth.allowTailscale` 이 `true` 일 때
Tailscale 아이덴티티 헤더(`tailscale-user-login`)를 통해 인증할 수 있습니다. OpenClaw 는
`x-forwarded-for` 주소를 `tailscale whois` 로 해석해 헤더와 일치하는지 확인하며,
요청이 Tailscale 의 `x-forwarded-*` 헤더와 함께 loopback 에 도달할 때만 이를 허용합니다.
Serve 트래픽에도 토큰/비밀번호를 요구하려면 `gateway.auth.allowTailscale: false` 를 설정하거나
강제로 `gateway.auth.mode: "password"` 을 사용하세요.

### tailnet 바인드 + 토큰

```bash
openclaw gateway --bind tailnet --token "$(openssl rand -hex 32)"
```

그런 다음 열기:

- `http://<tailscale-ip>:18789/` (또는 설정된 `gateway.controlUi.basePath`)

토큰을 UI 설정에 붙여넣으세요 (`connect.params.auth.token` 로 전송됨).

## 비보안 HTTP

일반 HTTP(`http://<lan-ip>` 또는 `http://<tailscale-ip>`)로 대시보드를 열면,
브라우저가 **비보안 컨텍스트**에서 실행되어 WebCrypto 를 차단합니다. 기본적으로
OpenClaw 는 디바이스 아이덴티티가 없는 Control UI 연결을 **차단**합니다.

**권장 해결책:** HTTPS(Tailscale Serve)를 사용하거나 UI 를 로컬에서 여세요:

- `https://<magicdns>/` (Serve)
- `http://127.0.0.1:18789/` (gateway 호스트에서)

**다운그레이드 예시 (HTTP 에서 토큰 전용):**

```json5
{
  gateway: {
    controlUi: { allowInsecureAuth: true },
    bind: "tailnet",
    auth: { mode: "token", token: "replace-me" },
  },
}
```

이는 Control UI 에 대한 디바이스 아이덴티티 + 페어링을 비활성화합니다(HTTPS 에서도 적용).
네트워크를 신뢰하는 경우에만 사용하세요.

HTTPS 설정 가이드는 [Tailscale](/gateway/tailscale)을 참고하세요.

## UI 빌드

Gateway(게이트웨이)는 정적 파일을 `dist/control-ui` 에서 제공합니다. 다음으로 빌드하세요:

```bash
pnpm ui:build # auto-installs UI deps on first run
```

선택적 절대 base(고정 자산 URL 이 필요할 때):

```bash
OPENCLAW_CONTROL_UI_BASE_PATH=/openclaw/ pnpm ui:build
```

로컬 개발(분리된 dev 서버):

```bash
pnpm ui:dev # auto-installs UI deps on first run
```

그런 다음 UI 를 Gateway WS URL 로 지정하세요(예: `ws://127.0.0.1:18789`).

## 디버깅/테스트: dev 서버 + 원격 Gateway(게이트웨이)

Control UI 는 정적 파일이며 WebSocket 대상은 설정 가능하고 HTTP origin 과 달라도 됩니다.
로컬에서 Vite dev 서버를 사용하면서 Gateway(게이트웨이)는 다른 곳에서 실행할 때 유용합니다.

1. UI dev 서버 시작: `pnpm ui:dev`
2. 다음과 같은 URL 열기:

```text
http://localhost:5173/?gatewayUrl=ws://<gateway-host>:18789
```

선택적 일회성 인증(필요한 경우):

```text
http://localhost:5173/?gatewayUrl=wss://<gateway-host>:18789&token=<gateway-token>
```

참고 사항:

- `gatewayUrl` 는 로드 후 localStorage 에 저장되고 URL 에서 제거됩니다.
- `token` 는 localStorage 에 저장되며, `password` 는 메모리에만 유지됩니다.
- `gatewayUrl` 이 설정되면 UI 는 설정 또는 환경 변수 자격 증명으로 폴백하지 않습니다.
  `token` (또는 `password`)를 명시적으로 제공하세요. 명시적 자격 증명이 없으면 오류입니다.
- Gateway(게이트웨이)가 TLS 뒤에 있을 때(Tailscale Serve, HTTPS 프록시 등)는 `wss://` 를 사용하세요.
- `gatewayUrl` 는 클릭재킹 방지를 위해 최상위 창에서만 허용됩니다(임베드 불가).
- 크로스 오리진 개발 구성(예: `pnpm ui:dev` 에서 원격 Gateway(게이트웨이)로)의 경우,
  UI origin 을 `gateway.controlUi.allowedOrigins` 에 추가하세요.

예시:

```json5
{
  gateway: {
    controlUi: {
      allowedOrigins: ["http://localhost:5173"],
    },
  },
}
```

원격 접근 설정 세부 사항: [Remote access](/gateway/remote).
