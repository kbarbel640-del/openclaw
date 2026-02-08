---
summary: "Gateway(게이트웨이) 대시보드를 위한 통합 Tailscale Serve/Funnel"
read_when:
  - localhost 외부로 Gateway(게이트웨이) Control UI 를 노출할 때
  - tailnet 또는 공개 대시보드 액세스를 자동화할 때
title: "Tailscale"
x-i18n:
  source_path: gateway/tailscale.md
  source_hash: c900c70a9301f290
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:41Z
---

# Tailscale (Gateway(게이트웨이) 대시보드)

OpenClaw 는 Gateway(게이트웨이) 대시보드와 WebSocket 포트에 대해 Tailscale **Serve**(tailnet) 또는 **Funnel**(공개)을 자동으로 설정할 수 있습니다. 이렇게 하면 Gateway(게이트웨이)는 loopback 에 바인딩된 상태를 유지하고, Tailscale 이 HTTPS, 라우팅, 그리고(Serve 의 경우) ID 헤더를 제공합니다.

## 모드

- `serve`: `tailscale serve` 를 통한 tailnet 전용 Serve. 게이트웨이는 `127.0.0.1` 에 유지됩니다.
- `funnel`: `tailscale funnel` 를 통한 공개 HTTPS. OpenClaw 는 공유 비밀번호가 필요합니다.
- `off`: 기본값(Tailscale 자동화 없음).

## 인증

핸드셰이크를 제어하려면 `gateway.auth.mode` 을 설정합니다:

- `token` (`OPENCLAW_GATEWAY_TOKEN` 이 설정되면 기본값)
- `password` (`OPENCLAW_GATEWAY_PASSWORD` 또는 설정을 통한 공유 시크릿)

`tailscale.mode = "serve"` 이고 `gateway.auth.allowTailscale` 이 `true` 인 경우, 유효한 Serve 프록시 요청은 토큰/비밀번호를 제공하지 않고도 Tailscale ID 헤더(`tailscale-user-login`)를 통해 인증할 수 있습니다. OpenClaw 는 로컬 Tailscale 데몬(`tailscale whois`)을 통해 `x-forwarded-for` 주소를 확인(resolving)하고, 수락하기 전에 이를 헤더와 매칭하여 ID 를 검증합니다. OpenClaw 는 loopback 에서 도착하고 Tailscale 의 `x-forwarded-for`, `x-forwarded-proto`, `x-forwarded-host` 헤더를 포함하는 경우에만 요청을 Serve 로 취급합니다.
명시적 자격 증명을 요구하려면 `gateway.auth.allowTailscale: false` 를 설정하거나 `gateway.auth.mode: "password"` 를 강제합니다.

## 설정 예시

### Tailnet 전용(Serve)

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "serve" },
  },
}
```

열기: `https://<magicdns>/` (또는 구성된 `gateway.controlUi.basePath`)

### Tailnet 전용(Tailnet IP 에 바인드)

Gateway(게이트웨이)가 Tailnet IP 에 직접 리슨하도록 하려는 경우(Serve/Funnel 없음)에 사용합니다.

```json5
{
  gateway: {
    bind: "tailnet",
    auth: { mode: "token", token: "your-token" },
  },
}
```

다른 Tailnet 디바이스에서 연결:

- Control UI: `http://<tailscale-ip>:18789/`
- WebSocket: `ws://<tailscale-ip>:18789`

참고: 이 모드에서는 loopback(`http://127.0.0.1:18789`)이 **동작하지 않습니다**.

### 공용 인터넷(Funnel + 공유 비밀번호)

```json5
{
  gateway: {
    bind: "loopback",
    tailscale: { mode: "funnel" },
    auth: { mode: "password", password: "replace-me" },
  },
}
```

비밀번호를 디스크에 커밋하는 것보다 `OPENCLAW_GATEWAY_PASSWORD` 을 선호합니다.

## CLI 예시

```bash
openclaw gateway --tailscale serve
openclaw gateway --tailscale funnel --auth password
```

## 참고 사항

- Tailscale Serve/Funnel 을 사용하려면 `tailscale` CLI 가 설치되어 있고 로그인되어 있어야 합니다.
- `tailscale.mode: "funnel"` 는 공개 노출을 방지하기 위해 인증 모드가 `password` 이 아니면 시작을 거부합니다.
- 종료 시 OpenClaw 가 `tailscale serve` 또는 `tailscale funnel` 설정을 되돌리도록 하려면 `gateway.tailscale.resetOnExit` 를 설정합니다.
- `gateway.bind: "tailnet"` 는 직접 Tailnet 바인드입니다(HTTPS 없음, Serve/Funnel 없음).
- `gateway.bind: "auto"` 는 loopback 을 선호합니다. Tailnet 전용을 원하면 `tailnet` 을 사용합니다.
- Serve/Funnel 은 **Gateway(게이트웨이) Control UI + WS** 만 노출합니다. 노드는 동일한 Gateway(게이트웨이) WS 엔드포인트로 연결하므로, Serve 는 노드 액세스에도 동작할 수 있습니다.

## 브라우저 제어(원격 Gateway(게이트웨이) + 로컬 브라우저)

한 머신에서 Gateway(게이트웨이)를 실행하지만 다른 머신에서 브라우저를 구동하려면, 브라우저 머신에서 **노드 호스트**를 실행하고 둘 다 동일한 tailnet 에 유지합니다. Gateway(게이트웨이)는 브라우저 동작을 노드로 프록시하며, 별도의 제어 서버나 Serve URL 이 필요하지 않습니다.

브라우저 제어에는 Funnel 을 피하십시오. 노드 페어링은 운영자 액세스처럼 취급하십시오.

## Tailscale 사전 요구 사항 + 제한

- Serve 는 tailnet 에 대해 HTTPS 가 활성화되어 있어야 하며, 누락된 경우 CLI 가 프롬프트를 표시합니다.
- Serve 는 Tailscale ID 헤더를 주입하지만, Funnel 은 그렇지 않습니다.
- Funnel 은 Tailscale v1.38.3+, MagicDNS, HTTPS 활성화, 그리고 funnel 노드 속성이 필요합니다.
- Funnel 은 TLS 를 통해 포트 `443`, `8443`, `10000` 만 지원합니다.
- macOS 에서 Funnel 을 사용하려면 오픈 소스 Tailscale 앱 변형이 필요합니다.

## 더 알아보기

- Tailscale Serve 개요: https://tailscale.com/kb/1312/serve
- `tailscale serve` 명령: https://tailscale.com/kb/1242/tailscale-serve
- Tailscale Funnel 개요: https://tailscale.com/kb/1223/tailscale-funnel
- `tailscale funnel` 명령: https://tailscale.com/kb/1311/tailscale-funnel
