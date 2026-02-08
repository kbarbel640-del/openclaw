---
summary: "Gateway(게이트웨이) WebSocket 프로토콜: 핸드셰이크, 프레임, 버전 관리"
read_when:
  - Gateway(게이트웨이) WS 클라이언트 구현 또는 업데이트 시
  - 프로토콜 불일치 또는 연결 실패 디버깅 시
  - 프로토콜 스키마/모델 재생성 시
title: "Gateway(게이트웨이) 프로토콜"
x-i18n:
  source_path: gateway/protocol.md
  source_hash: bdafac40d5356590
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:28Z
---

# Gateway(게이트웨이) 프로토콜 (WebSocket)

Gateway(게이트웨이) WS 프로토콜은 OpenClaw 를 위한 **단일 제어 플레인 + 노드 전송 계층**입니다. 모든 클라이언트(CLI, 웹 UI, macOS 앱, iOS/Android 노드, 헤드리스 노드)는 WebSocket 으로 연결하고, 핸드셰이크 시점에 자신의 **역할** + **스코프**를 선언합니다.

## 전송

- WebSocket, JSON 페이로드를 포함하는 텍스트 프레임.
- 첫 번째 프레임은 **반드시** `connect` 요청이어야 합니다.

## 핸드셰이크 (연결)

Gateway(게이트웨이) → 클라이언트(사전 연결 챌린지):

```json
{
  "type": "event",
  "event": "connect.challenge",
  "payload": { "nonce": "…", "ts": 1737264000000 }
}
```

클라이언트 → Gateway(게이트웨이):

```json
{
  "type": "req",
  "id": "…",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "cli",
      "version": "1.2.3",
      "platform": "macos",
      "mode": "operator"
    },
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "caps": [],
    "commands": [],
    "permissions": {},
    "auth": { "token": "…" },
    "locale": "en-US",
    "userAgent": "openclaw-cli/1.2.3",
    "device": {
      "id": "device_fingerprint",
      "publicKey": "…",
      "signature": "…",
      "signedAt": 1737264000000,
      "nonce": "…"
    }
  }
}
```

Gateway(게이트웨이) → 클라이언트:

```json
{
  "type": "res",
  "id": "…",
  "ok": true,
  "payload": { "type": "hello-ok", "protocol": 3, "policy": { "tickIntervalMs": 15000 } }
}
```

디바이스 토큰이 발급되면, `hello-ok`에는 다음도 포함됩니다:

```json
{
  "auth": {
    "deviceToken": "…",
    "role": "operator",
    "scopes": ["operator.read", "operator.write"]
  }
}
```

### 노드 예시

```json
{
  "type": "req",
  "id": "…",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "ios-node",
      "version": "1.2.3",
      "platform": "ios",
      "mode": "node"
    },
    "role": "node",
    "scopes": [],
    "caps": ["camera", "canvas", "screen", "location", "voice"],
    "commands": ["camera.snap", "canvas.navigate", "screen.record", "location.get"],
    "permissions": { "camera.capture": true, "screen.record": false },
    "auth": { "token": "…" },
    "locale": "en-US",
    "userAgent": "openclaw-ios/1.2.3",
    "device": {
      "id": "device_fingerprint",
      "publicKey": "…",
      "signature": "…",
      "signedAt": 1737264000000,
      "nonce": "…"
    }
  }
}
```

## 프레이밍

- **요청**: `{type:"req", id, method, params}`
- **응답**: `{type:"res", id, ok, payload|error}`
- **이벤트**: `{type:"event", event, payload, seq?, stateVersion?}`

부작용이 있는 메서드는 **멱등성 키**가 필요합니다(스키마 참고).

## 역할 + 스코프

### 역할

- `operator` = 제어 플레인 클라이언트(CLI/UI/자동화).
- `node` = 기능 호스트(카메라/화면/canvas/system.run).

### 스코프 (오퍼레이터)

공통 스코프:

- `operator.read`
- `operator.write`
- `operator.admin`
- `operator.approvals`
- `operator.pairing`

### 캡/명령/권한 (노드)

노드는 연결 시 기능 클레임을 선언합니다:

- `caps`: 상위 수준 기능 카테고리.
- `commands`: invoke 를 위한 명령 허용 목록.
- `permissions`: 세분화된 토글(예: `screen.record`, `camera.capture`).

Gateway(게이트웨이)는 이를 **클레임**으로 취급하고 서버 측 허용 목록을 강제합니다.

## 프레즌스

- `system-presence`는 디바이스 아이덴티티로 키가 지정된 엔트리를 반환합니다.
- 프레즌스 엔트리에는 `deviceId`, `roles`, `scopes`가 포함되므로, UI 는 **오퍼레이터**와 **노드**로 모두 연결되더라도 디바이스당 단일 행을 표시할 수 있습니다.

### 노드 헬퍼 메서드

- 노드는 `skills.bins`을 호출하여 자동 허용 검사에 사용할 현재 skill 실행 파일 목록을 가져올 수 있습니다.

## 실행 승인

- exec 요청에 승인이 필요하면, 게이트웨이는 `exec.approval.requested`을 브로드캐스트합니다.
- 오퍼레이터 클라이언트는 `exec.approval.resolve`을 호출하여 해결합니다(`operator.approvals` 스코프 필요).

## 버전 관리

- `PROTOCOL_VERSION`은 `src/gateway/protocol/schema.ts`에 있습니다.
- 클라이언트는 `minProtocol` + `maxProtocol`을 전송하며, 서버는 불일치를 거부합니다.
- 스키마 + 모델은 TypeBox 정의로부터 생성됩니다:
  - `pnpm protocol:gen`
  - `pnpm protocol:gen:swift`
  - `pnpm protocol:check`

## 인증

- `OPENCLAW_GATEWAY_TOKEN`(또는 `--token`)이 설정된 경우, `connect.params.auth.token`가 일치해야 하며 그렇지 않으면 소켓이 닫힙니다.
- 페어링 후, Gateway(게이트웨이)는 연결 역할 + 스코프에 범위가 지정된 **디바이스 토큰**을 발급합니다. 이는 `hello-ok.auth.deviceToken`에서 반환되며, 이후 연결을 위해 클라이언트가 영구 저장해야 합니다.
- 디바이스 토큰은 `device.token.rotate` 및 `device.token.revoke`를 통해 로테이션/폐기할 수 있습니다(`operator.pairing` 스코프 필요).

## 디바이스 아이덴티티 + 페어링

- 노드는 키페어 지문에서 파생된 안정적인 디바이스 아이덴티티(`device.id`)를 포함해야 합니다.
- 게이트웨이는 디바이스 + 역할별로 토큰을 발급합니다.
- 로컬 자동 승인 기능이 활성화되어 있지 않으면, 새 디바이스 ID 에는 페어링 승인이 필요합니다.
- **로컬** 연결에는 loopback 및 게이트웨이 호스트 자체의 tailnet 주소가 포함됩니다(따라서 동일 호스트 tailnet 바인딩도 여전히 자동 승인될 수 있습니다).
- 모든 WS 클라이언트는 `connect` 동안 `device` 아이덴티티를 포함해야 합니다(오퍼레이터 + 노드).
  제어 UI 는 `gateway.controlUi.allowInsecureAuth`이 활성화된 경우에만 이를 **오직** 생략할 수 있습니다
  (또는 비상용으로 `gateway.controlUi.dangerouslyDisableDeviceAuth`).
- 비로컬 연결은 서버가 제공한 `connect.challenge` nonce 에 서명해야 합니다.

## TLS + 핀닝

- TLS 는 WS 연결에 대해 지원됩니다.
- 클라이언트는 게이트웨이 인증서 지문을 선택적으로 핀할 수 있습니다(`gateway.tls` 설정 및 `gateway.remote.tlsFingerprint` 또는 CLI `--tls-fingerprint` 참고).

## 범위

이 프로토콜은 **전체 게이트웨이 API**(상태, 채널, 모델, 채팅, 에이전트, 세션, 노드, 승인 등)를 노출합니다. 정확한 표면은 `src/gateway/protocol/schema.ts`의 TypeBox 스키마로 정의됩니다.
