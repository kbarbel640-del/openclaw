---
summary: "내구성 있는 상태로 GCP Compute Engine VM(Docker)에서 OpenClaw Gateway(게이트웨이)를 24/7 실행합니다"
read_when:
  - GCP에서 OpenClaw를 24/7로 실행하고 싶습니다
  - 자체 VM에서 프로덕션급의 항상 켜져 있는 Gateway(게이트웨이)를 원합니다
  - 영속성, 바이너리, 재시작 동작을 완전히 제어하고 싶습니다
title: "GCP"
x-i18n:
  source_path: install/gcp.md
  source_hash: abb236dd421505d3
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:40:53Z
---

# GCP Compute Engine에서 OpenClaw 실행(Docker, 프로덕션 VPS 가이드)

## 목표

Docker를 사용하여 GCP Compute Engine VM에서 내구성 있는 상태, 이미지에 포함된 바이너리, 안전한 재시작 동작을 갖춘 영구 OpenClaw Gateway(게이트웨이)를 실행합니다.

"월 ~$5-12로 OpenClaw 24/7"을 원한다면, 이는 Google Cloud에서 신뢰할 수 있는 설정입니다.
요금은 머신 유형과 리전에 따라 달라집니다. 워크로드에 맞는 가장 작은 VM을 선택하고, OOM이 발생하면 상향 조정하십시오.

## 무엇을 하는 건가요(쉽게 설명)?

- GCP 프로젝트를 만들고 결제를 활성화합니다
- Compute Engine VM을 만듭니다
- Docker를 설치합니다(격리된 앱 런타임)
- Docker에서 OpenClaw Gateway(게이트웨이)를 시작합니다
- 호스트에서 `~/.openclaw` + `~/.openclaw/workspace` 를 영속화합니다(재시작/재빌드에도 유지)
- SSH 터널을 통해 노트북에서 Control UI에 접근합니다

Gateway(게이트웨이)는 다음 방식으로 접근할 수 있습니다:

- 노트북에서 SSH 포트 포워딩
- 방화벽과 토큰을 직접 관리한다면 포트를 직접 노출

이 가이드는 GCP Compute Engine에서 Debian을 사용합니다.
Ubuntu도 동작하며, 패키지를 그에 맞게 매핑하십시오.
일반적인 Docker 흐름은 [Docker](/install/docker)를 참고하십시오.

---

## 빠른 경로(숙련 운영자)

1. GCP 프로젝트 생성 + Compute Engine API 활성화
2. Compute Engine VM 생성(e2-small, Debian 12, 20GB)
3. VM에 SSH 접속
4. Docker 설치
5. OpenClaw 리포지토리 클론
6. 영속적 호스트 디렉토리 생성
7. `.env` 및 `docker-compose.yml` 구성
8. 필요한 바이너리를 포함해 빌드하고 실행

---

## 준비물

- GCP 계정(e2-micro의 무료 티어 사용 가능)
- gcloud CLI 설치(또는 Cloud Console 사용)
- 노트북에서 SSH 접근
- SSH + 복사/붙여넣기에 대한 기본 숙련도
- ~20-30분
- Docker 및 Docker Compose
- 모델 인증 자격 증명
- 선택 사항: 프로바이더 자격 증명
  - WhatsApp QR
  - Telegram 봇 토큰
  - Gmail OAuth

---

## 1) gcloud CLI 설치(또는 Console 사용)

**옵션 A: gcloud CLI**(자동화를 위해 권장)

https://cloud.google.com/sdk/docs/install 에서 설치하십시오.

초기화 및 인증:

```bash
gcloud init
gcloud auth login
```

**옵션 B: Cloud Console**

모든 단계는 https://console.cloud.google.com 의 웹 UI로 수행할 수 있습니다.

---

## 2) GCP 프로젝트 생성

**CLI:**

```bash
gcloud projects create my-openclaw-project --name="OpenClaw Gateway"
gcloud config set project my-openclaw-project
```

https://console.cloud.google.com/billing 에서 결제를 활성화하십시오(Compute Engine에 필요).

Compute Engine API를 활성화하십시오:

```bash
gcloud services enable compute.googleapis.com
```

**Console:**

1. IAM & Admin > Create Project로 이동
2. 이름을 지정하고 생성
3. 프로젝트에 대해 결제 활성화
4. APIs & Services > Enable APIs로 이동 > "Compute Engine API" 검색 > Enable

---

## 3) VM 생성

**머신 유형:**

| Type     | Specs                    | Cost                | Notes                 |
| -------- | ------------------------ | ------------------- | --------------------- |
| e2-small | 2 vCPU, 2GB RAM          | ~$12/mo             | 권장                  |
| e2-micro | 2 vCPU (shared), 1GB RAM | 무료 티어 사용 가능 | 부하 시 OOM 발생 가능 |

**CLI:**

```bash
gcloud compute instances create openclaw-gateway \
  --zone=us-central1-a \
  --machine-type=e2-small \
  --boot-disk-size=20GB \
  --image-family=debian-12 \
  --image-project=debian-cloud
```

**Console:**

1. Compute Engine > VM instances > Create instance로 이동
2. 이름: `openclaw-gateway`
3. 리전: `us-central1`, 존: `us-central1-a`
4. 머신 유형: `e2-small`
5. 부트 디스크: Debian 12, 20GB
6. Create

---

## 4) VM에 SSH 접속

**CLI:**

```bash
gcloud compute ssh openclaw-gateway --zone=us-central1-a
```

**Console:**

Compute Engine 대시보드에서 VM 옆의 "SSH" 버튼을 클릭하십시오.

참고: SSH 키 전파는 VM 생성 후 1-2분이 걸릴 수 있습니다. 연결이 거부되면 기다렸다가 다시 시도하십시오.

---

## 5) Docker 설치(VM에서)

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

그룹 변경이 적용되도록 로그아웃했다가 다시 로그인하십시오:

```bash
exit
```

그다음 다시 SSH로 접속합니다:

```bash
gcloud compute ssh openclaw-gateway --zone=us-central1-a
```

검증:

```bash
docker --version
docker compose version
```

---

## 6) OpenClaw 리포지토리 클론

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
```

이 가이드는 바이너리 영속성을 보장하기 위해 커스텀 이미지를 빌드한다고 가정합니다.

---

## 7) 영속적 호스트 디렉토리 생성

Docker 컨테이너는 일시적입니다.
장기 상태는 모두 호스트에 있어야 합니다.

```bash
mkdir -p ~/.openclaw
mkdir -p ~/.openclaw/workspace
```

---

## 8) 환경 변수 구성

리포지토리 루트에 `.env` 를 생성하십시오.

```bash
OPENCLAW_IMAGE=openclaw:latest
OPENCLAW_GATEWAY_TOKEN=change-me-now
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_GATEWAY_PORT=18789

OPENCLAW_CONFIG_DIR=/home/$USER/.openclaw
OPENCLAW_WORKSPACE_DIR=/home/$USER/.openclaw/workspace

GOG_KEYRING_PASSWORD=change-me-now
XDG_CONFIG_HOME=/home/node/.openclaw
```

강력한 시크릿을 생성하십시오:

```bash
openssl rand -hex 32
```

**이 파일을 커밋하지 마십시오.**

---

## 9) Docker Compose 설정

`docker-compose.yml` 를 생성하거나 업데이트하십시오.

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
      # Recommended: keep the Gateway loopback-only on the VM; access via SSH tunnel.
      # To expose it publicly, remove the `127.0.0.1:` prefix and firewall accordingly.
      - "127.0.0.1:${OPENCLAW_GATEWAY_PORT}:18789"

      # Optional: only if you run iOS/Android nodes against this VM and need Canvas host.
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

## 10) 필요한 바이너리를 이미지에 포함시키기(중요)

실행 중인 컨테이너 내부에 바이너리를 설치하는 것은 함정입니다.
런타임에 설치한 것은 재시작 시 모두 사라집니다.

Skills에 의해 필요한 모든 외부 바이너리는 이미지 빌드 시점에 설치해야 합니다.

아래 예시는 흔한 바이너리 3개만 보여줍니다:

- Gmail 접근을 위한 `gog`
- Google Places를 위한 `goplaces`
- WhatsApp을 위한 `wacli`

이는 예시이며 전체 목록이 아닙니다.
같은 패턴을 사용해 필요한 만큼 바이너리를 설치할 수 있습니다.

나중에 추가 바이너리에 의존하는 새 Skills를 추가한다면, 반드시 다음을 수행해야 합니다:

1. Dockerfile 업데이트
2. 이미지 리빌드
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

## 11) 빌드 및 실행

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

## 12) Gateway(게이트웨이) 확인

```bash
docker compose logs -f openclaw-gateway
```

성공:

```
[gateway] listening on ws://0.0.0.0:18789
```

---

## 13) 노트북에서 접근

Gateway(게이트웨이) 포트를 포워딩하도록 SSH 터널을 생성합니다:

```bash
gcloud compute ssh openclaw-gateway --zone=us-central1-a -- -L 18789:127.0.0.1:18789
```

브라우저에서 열기:

`http://127.0.0.1:18789/`

Gateway(게이트웨이) 토큰을 붙여넣으십시오.

---

## 무엇이 어디에 영속화되나(단일 진실 공급원)

OpenClaw는 Docker에서 실행되지만, Docker는 단일 진실 공급원이 아닙니다.
모든 장기 상태는 재시작, 리빌드, 재부팅을 견뎌야 합니다.

| Component           | Location                          | Persistence mechanism  | Notes                       |
| ------------------- | --------------------------------- | ---------------------- | --------------------------- |
| Gateway config      | `/home/node/.openclaw/`           | 호스트 볼륨 마운트     | `openclaw.json`, 토큰 포함  |
| Model auth profiles | `/home/node/.openclaw/`           | 호스트 볼륨 마운트     | OAuth 토큰, API 키          |
| Skill configs       | `/home/node/.openclaw/skills/`    | 호스트 볼륨 마운트     | Skill 수준 상태             |
| Agent workspace     | `/home/node/.openclaw/workspace/` | 호스트 볼륨 마운트     | 코드 및 에이전트 아티팩트   |
| WhatsApp session    | `/home/node/.openclaw/`           | 호스트 볼륨 마운트     | QR 로그인 유지              |
| Gmail keyring       | `/home/node/.openclaw/`           | 호스트 볼륨 + 비밀번호 | `GOG_KEYRING_PASSWORD` 필요 |
| External binaries   | `/usr/local/bin/`                 | Docker 이미지          | 빌드 시점에 포함돼야 함     |
| Node runtime        | 컨테이너 파일시스템               | Docker 이미지          | 이미지 빌드마다 재구성됨    |
| OS packages         | 컨테이너 파일시스템               | Docker 이미지          | 런타임에 설치하지 마십시오  |
| Docker container    | 일시적                            | 재시작 가능            | 삭제해도 안전함             |

---

## 업데이트

VM에서 OpenClaw를 업데이트하려면:

```bash
cd ~/openclaw
git pull
docker compose build
docker compose up -d
```

---

## 문제 해결

**SSH connection refused**

SSH 키 전파는 VM 생성 후 1-2분이 걸릴 수 있습니다. 기다렸다가 다시 시도하십시오.

**OS Login 문제**

OS Login 프로필을 확인하십시오:

```bash
gcloud compute os-login describe-profile
```

계정에 필요한 IAM 권한(Compute OS Login 또는 Compute OS Admin Login)이 있는지 확인하십시오.

**메모리 부족(OOM)**

e2-micro를 사용 중이며 OOM이 발생한다면 e2-small 또는 e2-medium으로 업그레이드하십시오:

```bash
# Stop the VM first
gcloud compute instances stop openclaw-gateway --zone=us-central1-a

# Change machine type
gcloud compute instances set-machine-type openclaw-gateway \
  --zone=us-central1-a \
  --machine-type=e2-small

# Start the VM
gcloud compute instances start openclaw-gateway --zone=us-central1-a
```

---

## 서비스 계정(보안 모범 사례)

개인 용도라면 기본 사용자 계정으로도 충분합니다.

자동화 또는 CI/CD 파이프라인의 경우, 최소 권한을 가진 전용 서비스 계정을 생성하십시오:

1. 서비스 계정 생성:

   ```bash
   gcloud iam service-accounts create openclaw-deploy \
     --display-name="OpenClaw Deployment"
   ```

2. Compute Instance Admin 역할(또는 더 좁은 커스텀 역할) 부여:
   ```bash
   gcloud projects add-iam-policy-binding my-openclaw-project \
     --member="serviceAccount:openclaw-deploy@my-openclaw-project.iam.gserviceaccount.com" \
     --role="roles/compute.instanceAdmin.v1"
   ```

자동화에 Owner 역할을 사용하지 마십시오. 최소 권한 원칙을 사용하십시오.

IAM 역할의 자세한 내용은 https://cloud.google.com/iam/docs/understanding-roles 를 참고하십시오.

---

## 다음 단계

- 메시징 채널 설정: [Channels](/channels)
- 로컬 디바이스를 노드로 페어링: [Nodes](/nodes)
- Gateway(게이트웨이) 구성: [Gateway configuration](/gateway/configuration)
