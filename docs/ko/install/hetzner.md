---
summary: "저렴한 Hetzner VPS(Docker)에서 내구성 있는 상태와 이미지에 포함된 바이너리로 OpenClaw Gateway(게이트웨이)를 24/7 실행합니다"
read_when:
  - 클라우드 VPS(노트북이 아님)에서 OpenClaw 를 24/7 실행하려는 경우
  - 자신의 VPS 에서 프로덕션급, 항상 켜져 있는 Gateway(게이트웨이)를 원하는 경우
  - 영속성, 바이너리, 재시작 동작을 완전히 제어하려는 경우
  - Hetzner 또는 유사한 프로바이더에서 Docker 로 OpenClaw 를 실행 중인 경우
title: "Hetzner"
x-i18n:
  source_path: install/hetzner.md
  source_hash: 84d9f24f1a803aa1
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:40:39Z
---

# Hetzner 에서 OpenClaw (Docker, 프로덕션 VPS 가이드)

## 목표

Hetzner VPS 에서 Docker 를 사용해 내구성 있는 상태, 이미지에 포함된 바이너리, 안전한 재시작 동작을 갖춘 영속적인 OpenClaw Gateway(게이트웨이)를 실행합니다.

"~$5 로 OpenClaw 24/7"을 원한다면, 이것이 가장 단순하면서도 신뢰할 수 있는 설정입니다.  
Hetzner 요금은 변경될 수 있으니, 가장 작은 Debian/Ubuntu VPS 를 선택하고 OOM 이 발생하면 확장하십시오.

## 우리가 하는 일(쉽게 설명)

- 작은 Linux 서버(Hetzner VPS) 임대
- Docker 설치(격리된 앱 런타임)
- Docker 에서 OpenClaw Gateway(게이트웨이) 시작
- 호스트에 `~/.openclaw` + `~/.openclaw/workspace` 를 영속화(재시작/재빌드에도 유지)
- SSH 터널을 통해 노트북에서 Control UI 에 접속

Gateway(게이트웨이)는 다음 방식으로 접속할 수 있습니다:

- 노트북에서 SSH 포트 포워딩
- 방화벽과 토큰을 직접 관리한다면 포트를 직접 노출

이 가이드는 Hetzner 의 Ubuntu 또는 Debian 을 가정합니다.  
다른 Linux VPS 를 사용 중이라면 패키지를 이에 맞게 매핑하십시오.  
일반적인 Docker 흐름은 [Docker](/install/docker)를 참고하십시오.

---

## 빠른 경로(숙련된 운영자)

1. Hetzner VPS 프로비저닝
2. Docker 설치
3. OpenClaw 리포지토리 클론
4. 영속적인 호스트 디렉토리 생성
5. `.env` 및 `docker-compose.yml` 구성
6. 필요한 바이너리를 이미지에 포함(베이크)
7. `docker compose up -d`
8. 영속성과 Gateway(게이트웨이) 접근 확인

---

## 준비물

- root 접근이 가능한 Hetzner VPS
- 노트북에서의 SSH 접근
- SSH + 복사/붙여넣기에 대한 기본 숙련도
- 약 20 분
- Docker 및 Docker Compose
- 모델 인증 자격 증명
- 선택 사항: 프로바이더 자격 증명
  - WhatsApp QR
  - Telegram bot token
  - Gmail OAuth

---

## 1) VPS 프로비저닝

Hetzner 에서 Ubuntu 또는 Debian VPS 를 생성합니다.

root 로 연결합니다:

```bash
ssh root@YOUR_VPS_IP
```

이 가이드는 VPS 가 상태를 보존하는(stateful) 것으로 가정합니다.  
소모성 인프라로 취급하지 마십시오.

---

## 2) Docker 설치(VPS 에서)

```bash
apt-get update
apt-get install -y git curl ca-certificates
curl -fsSL https://get.docker.com | sh
```

확인:

```bash
docker --version
docker compose version
```

---

## 3) OpenClaw 리포지토리 클론

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
```

이 가이드는 바이너리 영속성을 보장하기 위해 커스텀 이미지를 빌드한다고 가정합니다.

---

## 4) 영속적인 호스트 디렉토리 생성

Docker 컨테이너는 일시적입니다.  
수명이 긴 모든 상태는 호스트에 있어야 합니다.

```bash
mkdir -p /root/.openclaw
mkdir -p /root/.openclaw/workspace

# Set ownership to the container user (uid 1000):
chown -R 1000:1000 /root/.openclaw
chown -R 1000:1000 /root/.openclaw/workspace
```

---

## 5) 환경 변수 구성

리포지토리 루트에 `.env` 를 생성합니다.

```bash
OPENCLAW_IMAGE=openclaw:latest
OPENCLAW_GATEWAY_TOKEN=change-me-now
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_GATEWAY_PORT=18789

OPENCLAW_CONFIG_DIR=/root/.openclaw
OPENCLAW_WORKSPACE_DIR=/root/.openclaw/workspace

GOG_KEYRING_PASSWORD=change-me-now
XDG_CONFIG_HOME=/home/node/.openclaw
```

강력한 시크릿을 생성합니다:

```bash
openssl rand -hex 32
```

**이 파일을 커밋하지 마십시오.**

---

## 6) Docker Compose 설정

`docker-compose.yml` 를 생성하거나 업데이트합니다.

```yaml
services:
  openclaw-gateway:
    image: ${OPENCLAW_IMAGE}
    build: .
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - HOME=/home/node
      - NODE_ENV=production
      - TERM=xterm-256color
      - OPENCLAW_GATEWAY_BIND=${OPENCLAW_GATEWAY_BIND}
      - OPENCLAW_GATEWAY_PORT=${OPENCLAW_GATEWAY_PORT}
      - OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}
      - GOG_KEYRING_PASSWORD=${GOG_KEYRING_PASSWORD}
      - XDG_CONFIG_HOME=${XDG_CONFIG_HOME}
      - PATH=/home/linuxbrew/.linuxbrew/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
    volumes:
      - ${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw
      - ${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace
    ports:
      # Recommended: keep the Gateway loopback-only on the VPS; access via SSH tunnel.
      # To expose it publicly, remove the `127.0.0.1:` prefix and firewall accordingly.
      - "127.0.0.1:${OPENCLAW_GATEWAY_PORT}:18789"

      # Optional: only if you run iOS/Android nodes against this VPS and need Canvas host.
      # If you expose this publicly, read /gateway/security and firewall accordingly.
      # - "18793:18793"
    command:
      [
        "node",
        "dist/index.js",
        "gateway",
        "--bind",
        "${OPENCLAW_GATEWAY_BIND}",
        "--port",
        "${OPENCLAW_GATEWAY_PORT}",
      ]
```

---

## 7) 필요한 바이너리를 이미지에 포함(베이크)하기(중요)

실행 중인 컨테이너 내부에 바이너리를 설치하는 것은 함정입니다.  
런타임에 설치한 것은 재시작 시 사라집니다.

Skills 에 필요한 모든 외부 바이너리는 이미지 빌드 시점에 설치해야 합니다.

아래 예시는 흔한 바이너리 3가지만 보여줍니다:

- Gmail 접근을 위한 `gog`
- Google Places 를 위한 `goplaces`
- WhatsApp 을 위한 `wacli`

이는 예시이며, 완전한 목록이 아닙니다.  
같은 패턴을 사용해 필요한 만큼 많은 바이너리를 설치할 수 있습니다.

나중에 추가 바이너리에 의존하는 새로운 Skills 를 추가한다면, 다음을 해야 합니다:

1. Dockerfile 업데이트
2. 이미지 재빌드
3. 컨테이너 재시작

**예시 Dockerfile**

```dockerfile
FROM node:22-bookworm

RUN apt-get update && apt-get install -y socat && rm -rf /var/lib/apt/lists/*

# Example binary 1: Gmail CLI
RUN curl -L https://github.com/steipete/gog/releases/latest/download/gog_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/gog

# Example binary 2: Google Places CLI
RUN curl -L https://github.com/steipete/goplaces/releases/latest/download/goplaces_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/goplaces

# Example binary 3: WhatsApp CLI
RUN curl -L https://github.com/steipete/wacli/releases/latest/download/wacli_Linux_x86_64.tar.gz \
  | tar -xz -C /usr/local/bin && chmod +x /usr/local/bin/wacli

# Add more binaries below using the same pattern

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY scripts ./scripts

RUN corepack enable
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN pnpm ui:install
RUN pnpm ui:build

ENV NODE_ENV=production

CMD ["node","dist/index.js"]
```

---

## 8) 빌드 및 실행

```bash
docker compose build
docker compose up -d openclaw-gateway
```

바이너리 확인:

```bash
docker compose exec openclaw-gateway which gog
docker compose exec openclaw-gateway which goplaces
docker compose exec openclaw-gateway which wacli
```

예상 출력:

```
/usr/local/bin/gog
/usr/local/bin/goplaces
/usr/local/bin/wacli
```

---

## 9) Gateway(게이트웨이) 확인

```bash
docker compose logs -f openclaw-gateway
```

성공:

```
[gateway] listening on ws://0.0.0.0:18789
```

노트북에서:

```bash
ssh -N -L 18789:127.0.0.1:18789 root@YOUR_VPS_IP
```

열기:

`http://127.0.0.1:18789/`

게이트웨이 토큰을 붙여넣습니다.

---

## 무엇이 어디에 영속화되는가(단일 진실 공급원)

OpenClaw 는 Docker 에서 실행되지만, Docker 가 단일 진실 공급원(source of truth)은 아닙니다.  
수명이 긴 모든 상태는 재시작, 재빌드, 재부팅을 견뎌야 합니다.

| 구성 요소                | 위치                              | 영속화 메커니즘        | 비고                            |
| ------------------------ | --------------------------------- | ---------------------- | ------------------------------- |
| Gateway(게이트웨이) 설정 | `/home/node/.openclaw/`           | 호스트 볼륨 마운트     | `openclaw.json`, 토큰 포함      |
| 모델 인증 프로필         | `/home/node/.openclaw/`           | 호스트 볼륨 마운트     | OAuth 토큰, API 키              |
| Skill 설정               | `/home/node/.openclaw/skills/`    | 호스트 볼륨 마운트     | Skill 수준 상태                 |
| 에이전트 작업공간        | `/home/node/.openclaw/workspace/` | 호스트 볼륨 마운트     | 코드 및 에이전트 산출물         |
| WhatsApp 세션            | `/home/node/.openclaw/`           | 호스트 볼륨 마운트     | QR 로그인 보존                  |
| Gmail 키링               | `/home/node/.openclaw/`           | 호스트 볼륨 + 비밀번호 | `GOG_KEYRING_PASSWORD` 필요     |
| 외부 바이너리            | `/usr/local/bin/`                 | Docker 이미지          | 빌드 시점에 포함(베이크)해야 함 |
| Node 런타임              | 컨테이너 파일시스템               | Docker 이미지          | 이미지 빌드마다 재빌드됨        |
| OS 패키지                | 컨테이너 파일시스템               | Docker 이미지          | 런타임에 설치하지 마십시오      |
| Docker 컨테이너          | 일시적                            | 재시작 가능            | 삭제해도 안전                   |
