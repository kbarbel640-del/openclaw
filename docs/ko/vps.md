---
summary: "OpenClaw 를 위한 VPS 호스팅 허브 (Oracle/Fly/Hetzner/GCP/exe.dev)"
read_when:
  - 클라우드에서 Gateway 를 실행하려는 경우
  - VPS/호스팅 가이드의 빠른 개요가 필요한 경우
title: "VPS 호스팅"
x-i18n:
  source_path: vps.md
  source_hash: 38e3e254853e5839
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:37:51Z
---

# VPS 호스팅

이 허브는 지원되는 VPS/호스팅 가이드로 연결하고 클라우드
배포가 상위 수준에서 어떻게 동작하는지 설명합니다.

## 프로바이더 선택

- **Railway** (원클릭 + 브라우저 설정): [Railway](/install/railway)
- **Northflank** (원클릭 + 브라우저 설정): [Northflank](/install/northflank)
- **Oracle Cloud (Always Free)**: [Oracle](/platforms/oracle) — $0/월 (Always Free, ARM; 용량/가입이 까다로울 수 있음)
- **Fly.io**: [Fly.io](/install/fly)
- **Hetzner (Docker)**: [Hetzner](/install/hetzner)
- **GCP (Compute Engine)**: [GCP](/install/gcp)
- **exe.dev** (VM + HTTPS 프록시): [exe.dev](/install/exe-dev)
- **AWS (EC2/Lightsail/free tier)**: 역시 잘 작동합니다. 영상 가이드:
  https://x.com/techfrenAJ/status/2014934471095812547

## 클라우드 설정 방식

- **Gateway 는 VPS 에서 실행**되며 상태 + 워크스페이스를 소유합니다.
- 노트북/휴대폰에서 **Control UI** 또는 **Tailscale/SSH** 를 통해 연결합니다.
- VPS 를 단일 진실 소스로 간주하고 상태 + 워크스페이스를 **백업**합니다.
- 기본 보안: Gateway 를 loopback 에 유지하고 SSH 터널 또는 Tailscale Serve 로 접근합니다.
  `lan`/`tailnet` 에 바인딩하는 경우 `gateway.auth.token` 또는 `gateway.auth.password` 를 요구합니다.

원격 접근: [Gateway remote](/gateway/remote)  
플랫폼 허브: [Platforms](/platforms)

## VPS 와 함께 노드 사용

Gateway 를 클라우드에 두고 로컬 디바이스
(Mac/iOS/Android/headless)의 **노드**를 페어링할 수 있습니다. 노드는 로컬 화면/카메라/캔버스와 `system.run`
기능을 제공하며 Gateway 는 클라우드에 유지됩니다.

문서: [Nodes](/nodes), [Nodes CLI](/cli/nodes)
