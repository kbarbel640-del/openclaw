---
summary: "원격 액세스를 위해 exe.dev(VM + HTTPS 프록시)에서 OpenClaw Gateway(게이트웨이) 실행"
read_when:
  - Gateway(게이트웨이)를 위한 저렴한 상시 가동 Linux 호스트를 원할 때
  - 자체 VPS 를 운영하지 않고도 원격 Control UI 액세스를 원할 때
title: "exe.dev"
x-i18n:
  source_path: install/exe-dev.md
  source_hash: 72ab798afd058a76
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:40:06Z
---

# exe.dev

목표: exe.dev VM 에서 실행되는 OpenClaw Gateway(게이트웨이)를 노트북에서 다음을 통해 접근 가능하게 합니다: `https://<vm-name>.exe.xyz`

이 페이지는 exe.dev 기본 **exeuntu** 이미지를 가정합니다. 다른 배포판을 선택했다면 그에 맞게 패키지를 매핑하십시오.

## 초보자 빠른 경로

1. [https://exe.new/openclaw](https://exe.new/openclaw)
2. 필요에 따라 인증 키/토큰을 입력합니다
3. VM 옆의 "Agent"를 클릭하고 기다립니다...
4. ???
5. 이익

## 준비물

- exe.dev 계정
- [exe.dev](https://exe.dev) 가상 머신에 대한 `ssh exe.dev` 액세스(선택 사항)

## Shelley 를 사용한 자동 설치

[exe.dev](https://exe.dev)의 에이전트인 Shelley 는 당사 프롬프트로 OpenClaw 를 즉시 설치할 수 있습니다. 사용된 프롬프트는 다음과 같습니다:

```
Set up OpenClaw (https://docs.openclaw.ai/install) on this VM. Use the non-interactive and accept-risk flags for openclaw onboarding. Add the supplied auth or token as needed. Configure nginx to forward from the default port 18789 to the root location on the default enabled site config, making sure to enable Websocket support. Pairing is done by "openclaw devices list" and "openclaw device approve <request id>". Make sure the dashboard shows that OpenClaw's health is OK. exe.dev handles forwarding from port 8000 to port 80/443 and HTTPS for us, so the final "reachable" should be <vm-name>.exe.xyz, without port specification.
```

## 수동 설치

## 1) VM 생성

기기에서:

```bash
ssh exe.dev new
```

그런 다음 연결합니다:

```bash
ssh <vm-name>.exe.xyz
```

팁: 이 VM 을 **stateful** 로 유지하십시오. OpenClaw 는 `~/.openclaw/` 및 `~/.openclaw/workspace/` 아래에 상태를 저장합니다.

## 2) 사전 요구 사항 설치(VM 에서)

```bash
sudo apt-get update
sudo apt-get install -y git curl jq ca-certificates openssl
```

## 3) OpenClaw 설치

OpenClaw 설치 스크립트를 실행합니다:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

## 4) nginx 를 설정하여 OpenClaw 를 8000 포트로 프록시

다음 내용으로 `/etc/nginx/sites-enabled/default` 을 편집합니다

```
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 8000;
    listen [::]:8000;

    server_name _;

    location / {
        proxy_pass http://127.0.0.1:18789;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout settings for long-lived connections
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

## 5) OpenClaw 에 액세스하고 권한 부여

`https://<vm-name>.exe.xyz/` 에 액세스합니다(온보딩의 Control UI 출력 참조). 인증을 요청하면 VM 의 `gateway.auth.token` 에 있는 토큰을 붙여 넣으십시오(`openclaw config get gateway.auth.token` 로 가져오거나, `openclaw doctor --generate-gateway-token` 로 생성할 수 있습니다). `openclaw devices list` 및
`openclaw devices approve <requestId>` 로 디바이스를 승인하십시오. 확신이 서지 않으면 브라우저에서 Shelley 를 사용하십시오!

## 원격 액세스

원격 액세스는 [exe.dev](https://exe.dev)의 인증으로 처리됩니다. 기본적으로 8000 포트의 HTTP 트래픽은 이메일 인증을 통해 `https://<vm-name>.exe.xyz` 로 포워딩됩니다.

## 업데이트

```bash
npm i -g openclaw@latest
openclaw doctor
openclaw gateway restart
openclaw health
```

가이드: [Updating](/install/updating)
