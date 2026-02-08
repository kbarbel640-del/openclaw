---
summary: "SSH 터널(Gateway WS)과 tailnet을 사용한 원격 액세스"
read_when:
  - 원격 Gateway(게이트웨이) 설정을 실행하거나 문제를 해결할 때
title: "원격 액세스"
x-i18n:
  source_path: gateway/remote.md
  source_hash: 449d406f88c53dcc
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:14Z
---

# 원격 액세스(SSH, 터널, tailnet)

이 리포지토리는 전용 호스트(데스크톱/서버)에서 단일 Gateway(게이트웨이)(마스터)를 실행 상태로 유지하고 클라이언트를 여기에 연결하는 방식으로 'SSH를 통한 원격'을 지원합니다.

- **운영자(사용자/ macOS 앱)**용: SSH 터널링이 범용 폴백입니다.
- **노드(iOS/Android 및 향후 디바이스)**용: 필요에 따라 Gateway(게이트웨이) **WebSocket**(LAN/tailnet 또는 SSH 터널)에 연결합니다.

## 핵심 아이디어

- Gateway(게이트웨이) WebSocket은 설정된 포트(기본값 18789)에서 **loopback**에 바인딩됩니다.
- 원격 사용을 위해, 해당 loopback 포트를 SSH로 포워딩합니다(또는 tailnet/VPN을 사용해 터널 사용을 줄입니다).

## 일반적인 VPN/tailnet 설정(에이전트가 존재하는 위치)

**Gateway(게이트웨이) 호스트**를 '에이전트가 존재하는 위치'로 생각하십시오. 이 호스트가 세션, 인증 프로필, 채널, 상태를 소유합니다.
노트북/데스크톱(및 노드)은 해당 호스트에 연결합니다.

### 1) tailnet에서 항상 켜져 있는 Gateway(게이트웨이)(VPS 또는 홈 서버)

영구 호스트에서 Gateway(게이트웨이)를 실행하고 **Tailscale** 또는 SSH로 접속합니다.

- **최고의 UX:** `gateway.bind: "loopback"`를 유지하고 Control UI에는 **Tailscale Serve**를 사용합니다.
- **폴백:** loopback + 액세스가 필요한 모든 머신에서 SSH 터널을 유지합니다.
- **예시:** [exe.dev](/install/exe-dev)(쉬운 VM) 또는 [Hetzner](/install/hetzner)(프로덕션 VPS).

노트북이 자주 절전 모드로 들어가지만 에이전트는 항상 켜져 있기를 원할 때 이상적입니다.

### 2) 홈 데스크톱이 Gateway(게이트웨이)를 실행, 노트북은 원격 제어

노트북은 에이전트를 실행하지 **않습니다**. 대신 원격으로 연결합니다:

- macOS 앱의 **Remote over SSH** 모드를 사용합니다(설정 → 일반 → "OpenClaw runs").
- 앱이 터널을 열고 관리하므로 WebChat + 헬스 체크가 '그냥 동작'합니다.

Runbook: [macOS 원격 액세스](/platforms/mac/remote).

### 3) 노트북이 Gateway(게이트웨이)를 실행, 다른 머신에서 원격 액세스

Gateway(게이트웨이)는 로컬로 유지하되 안전하게 노출합니다:

- 다른 머신에서 노트북으로 SSH 터널을 열거나,
- Control UI를 Tailscale Serve로 제공하고 Gateway(게이트웨이)는 loopback 전용으로 유지합니다.

가이드: [Tailscale](/gateway/tailscale) 및 [Web 개요](/web).

## 명령 흐름(어디에서 무엇이 실행되는가)

하나의 gateway 서비스가 상태 + 채널을 소유합니다. 노드는 주변 장치입니다.

흐름 예시(Telegram → 노드):

- Telegram 메시지가 **Gateway(게이트웨이)**에 도착합니다.
- Gateway(게이트웨이)가 **에이전트**를 실행하고 노드 도구를 호출할지 결정합니다.
- Gateway(게이트웨이)가 Gateway(게이트웨이) WebSocket(`node.*` RPC)을 통해 **노드**를 호출합니다.
- 노드가 결과를 반환하면, Gateway(게이트웨이)가 Telegram으로 다시 응답합니다.

참고:

- **노드는 gateway 서비스를 실행하지 않습니다.** 의도적으로 격리된 프로필을 실행하지 않는 한, 호스트당 하나의 gateway만 실행해야 합니다([Multiple gateways](/gateway/multiple-gateways) 참고).
- macOS 앱의 '노드 모드'는 Gateway(게이트웨이) WebSocket을 통한 노드 클라이언트일 뿐입니다.

## SSH 터널(CLI + 도구)

원격 Gateway(게이트웨이) WS로의 로컬 터널을 생성합니다:

```bash
ssh -N -L 18789:127.0.0.1:18789 user@host
```

터널이 올라오면:

- `openclaw health` 및 `openclaw status --deep`는 이제 `ws://127.0.0.1:18789`을 통해 원격 gateway에 도달합니다.
- `openclaw gateway {status,health,send,agent,call}`도 필요 시 `--url`을 통해 포워딩된 URL을 대상으로 할 수 있습니다.

참고: `18789`를 설정된 `gateway.port`(또는 `--port`/`OPENCLAW_GATEWAY_PORT`)으로 교체하십시오.
참고: `--url`를 전달하면, CLI는 설정 또는 환경 변수 자격 증명으로 폴백하지 않습니다.
`--token` 또는 `--password`를 명시적으로 포함하십시오. 명시적 자격 증명이 누락되면 오류입니다.

## CLI 원격 기본값

CLI 명령이 기본적으로 이를 사용하도록 원격 대상을 지속적으로 설정할 수 있습니다:

```json5
{
  gateway: {
    mode: "remote",
    remote: {
      url: "ws://127.0.0.1:18789",
      token: "your-token",
    },
  },
}
```

gateway가 loopback 전용일 때는 URL을 `ws://127.0.0.1:18789`으로 유지하고 먼저 SSH 터널을 여십시오.

## SSH를 통한 Chat UI

WebChat은 더 이상 별도의 HTTP 포트를 사용하지 않습니다. SwiftUI 채팅 UI는 Gateway(게이트웨이) WebSocket에 직접 연결합니다.

- SSH로 `18789`을 포워딩한 다음(위 참조), 클라이언트를 `ws://127.0.0.1:18789`에 연결하십시오.
- macOS에서는 터널을 자동으로 관리하는 앱의 'Remote over SSH' 모드를 선호하십시오.

## macOS 앱 'Remote over SSH'

macOS 메뉴 바 앱은 동일한 설정을 종단 간으로 구동할 수 있습니다(원격 상태 체크, WebChat, Voice Wake 포워딩).

Runbook: [macOS 원격 액세스](/platforms/mac/remote).

## 보안 규칙(원격/VPN)

요약: 바인딩이 꼭 필요하다고 확신하지 않는 한 **Gateway(게이트웨이)는 loopback 전용으로 유지**하십시오.

- **Loopback + SSH/Tailscale Serve**가 가장 안전한 기본값입니다(공개 노출 없음).
- **비 loopback 바인딩**(`lan`/`tailnet`/`custom`, 또는 loopback을 사용할 수 없을 때의 `auto`)은 인증 토큰/비밀번호를 사용해야 합니다.
- `gateway.remote.token`는 원격 CLI 호출 전용이며, 로컬 인증을 활성화하지 **않습니다**.
- `gateway.remote.tlsFingerprint`는 `wss://`를 사용할 때 원격 TLS 인증서를 핀ning합니다.
- **Tailscale Serve**는 `gateway.auth.allowTailscale: true`일 때 ID 헤더를 통해 인증할 수 있습니다.
  토큰/비밀번호를 대신 사용하려면 `false`로 설정하십시오.
- 브라우저 제어는 운영자 액세스로 취급하십시오: tailnet 전용 + 의도적인 노드 페어링.

심층 내용: [보안](/gateway/security).
