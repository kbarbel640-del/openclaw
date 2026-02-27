```markdown
---
summary: "OpenClaw 를 위한 VPS 호스팅 허브 (Oracle/Fly/Hetzner/GCP/exe.dev)"
read_when:
  - 클라우드에서 게이트웨이를 실행하고 싶을 때
  - VPS/호스팅 가이드의 빠른 지도가 필요할 때
title: "VPS 호스팅"
---

# VPS 호스팅

이 허브는 지원되는 VPS/호스팅 가이드로 연결되며, 클라우드 배포가 높은 수준에서 어떻게 작동하는지를 설명합니다.

## 프로바이더 선택

- **Railway** (원클릭 + 브라우저 설정): [Railway](/install/railway)
- **Northflank** (원클릭 + 브라우저 설정): [Northflank](/install/northflank)
- **Oracle Cloud (항상 무료)**: [Oracle](/platforms/oracle) — $0/월 (항상 무료, ARM; 용량/가입이 불안정할 수 있음)
- **Fly.io**: [Fly.io](/install/fly)
- **Hetzner (Docker)**: [Hetzner](/install/hetzner)
- **GCP (Compute Engine)**: [GCP](/install/gcp)
- **exe.dev** (VM + HTTPS 프록시): [exe.dev](/install/exe-dev)
- **AWS (EC2/Lightsail/무료 등급)**: 사용하기 좋습니다. 비디오 가이드:
  [https://x.com/techfrenAJ/status/2014934471095812547](https://x.com/techfrenAJ/status/2014934471095812547)

## 클라우드 설정 작동 방식

- **게이트웨이는 VPS에서 실행**되며 상태 + 작업 공간을 소유합니다.
- **제어 UI** 또는 **Tailscale/SSH**를 통해 노트북/전화기에서 연결합니다.
- VPS를 기준으로 하여 상태 + 작업 공간을 **백업**하세요.
- 기본 보안을 위해 게이트웨이를 루프백에 유지하고 SSH 터널 또는 Tailscale Serve로 접근합니다.
  `lan`/`tailnet`에 바인딩하려면 `gateway.auth.token` 또는 `gateway.auth.password`가 필요합니다.

원격 접근: [게이트웨이 원격](/gateway/remote)
플랫폼 허브: [플랫폼](/platforms)

## VPS의 공유 회사 에이전트

사용자가 하나의 신뢰 경계에 있는 경우 (예: 한 회사 팀), 에이전트가 업무 전용인 경우 유효한 설정입니다.

- 전용 런타임에 유지하세요 (VPS/VM/컨테이너 + 전용 OS 사용자/계정).
- 그 런타임을 개인 Apple/Google 계정이나 개인 브라우저/비밀번호 관리자 프로필에 로그인하지 마세요.
- 사용자들이 서로 신뢰하지 않는 경우, 게이트웨이/호스트/OS 사용자로 분리하세요.

보안 모델 세부 사항: [보안](/ko-KR/gateway/security)

## VPS와 노드를 사용하는 방법

클라우드에 게이트웨이를 유지하면서 로컬 기기 (Mac/iOS/Android/헤드리스)에서 **노드**와 페어링할 수 있습니다.
노드는 로컬 화면/카메라/캔버스와 `system.run` 기능을 제공하며, 게이트웨이는 클라우드에 남아 있습니다.

문서: [노드](/nodes), [노드 CLI](/cli/nodes)
```
