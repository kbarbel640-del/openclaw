---
summary: "Ansible, Tailscale VPN 및 방화벽 격리를 통한 자동화되고 강화된 OpenClaw 설치"
read_when:
  - 보안 강화가 적용된 자동 서버 배포를 원합니다
  - VPN 액세스가 있는 방화벽 격리 설정이 필요합니다
  - 원격 Debian/Ubuntu 서버에 배포합니다
title: "Ansible"
x-i18n:
  source_path: install/ansible.md
  source_hash: 896807f344d923f0
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:39:11Z
---

# Ansible 설치

프로덕션 서버에 OpenClaw 를 배포하는 권장 방식은 **[openclaw-ansible](https://github.com/openclaw/openclaw-ansible)** 를 사용하는 것입니다. 이는 보안을 최우선으로 하는 아키텍처를 갖춘 자동 설치 프로그램입니다.

## 빠른 시작

한 줄 명령 설치:

```bash
curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw-ansible/main/install.sh | bash
```

> **📦 전체 가이드: [github.com/openclaw/openclaw-ansible](https://github.com/openclaw/openclaw-ansible)**
>
> openclaw-ansible 저장소가 Ansible 배포의 단일 기준입니다. 이 페이지는 빠른 개요입니다.

## 제공 내용

- 🔒 **방화벽 우선 보안**: UFW + Docker 격리(SSH + Tailscale 만 접근 가능)
- 🔐 **Tailscale VPN**: 서비스를 공개적으로 노출하지 않고도 안전한 원격 액세스
- 🐳 **Docker**: 격리된 샌드박스 컨테이너, localhost 전용 바인딩
- 🛡️ **심층 방어**: 4계층 보안 아키텍처
- 🚀 **원-커맨드 설정**: 수분 내 전체 배포 완료
- 🔧 **Systemd 통합**: 강화 설정과 함께 부팅 시 자동 시작

## 요구 사항

- **OS**: Debian 11+ 또는 Ubuntu 20.04+
- **액세스**: root 또는 sudo 권한
- **네트워크**: 패키지 설치를 위한 인터넷 연결
- **Ansible**: 2.14+ (빠른 시작 스크립트로 자동 설치)

## 설치되는 항목

Ansible 플레이북은 다음을 설치 및 구성합니다:

1. **Tailscale** (안전한 원격 액세스를 위한 메시 VPN)
2. **UFW 방화벽** (SSH + Tailscale 포트만)
3. **Docker CE + Compose V2** (에이전트 샌드박스용)
4. **Node.js 22.x + pnpm** (런타임 의존성)
5. **OpenClaw** (호스트 기반, 컨테이너화하지 않음)
6. **Systemd 서비스** (보안 강화를 포함한 자동 시작)

참고: Gateway(게이트웨이) 는 **호스트에서 직접**(Docker 가 아님) 실행되지만, 에이전트 샌드박스는 격리를 위해 Docker 를 사용합니다. 자세한 내용은 [Sandboxing](/gateway/sandboxing) 을 참고합니다.

## 설치 후 설정

설치가 완료되면 openclaw 사용자로 전환합니다:

```bash
sudo -i -u openclaw
```

설치 후 스크립트가 다음 과정을 안내합니다:

1. **온보딩 마법사**: OpenClaw 설정 구성
2. **프로바이더 로그인**: WhatsApp/Telegram/Discord/Signal 연결
3. **Gateway(게이트웨이) 테스트**: 설치 검증
4. **Tailscale 설정**: VPN 메시 연결

### 빠른 명령

```bash
# Check service status
sudo systemctl status openclaw

# View live logs
sudo journalctl -u openclaw -f

# Restart gateway
sudo systemctl restart openclaw

# Provider login (run as openclaw user)
sudo -i -u openclaw
openclaw channels login
```

## 보안 아키텍처

### 4계층 방어

1. **방화벽(UFW)**: SSH(22) + Tailscale(41641/udp) 만 외부에 공개
2. **VPN(Tailscale)**: Gateway(게이트웨이) 는 VPN 메시를 통해서만 접근 가능
3. **Docker 격리**: DOCKER-USER iptables 체인이 외부 포트 노출을 방지
4. **Systemd 강화**: NoNewPrivileges, PrivateTmp, 비권한 사용자

### 검증

외부 공격 표면을 테스트합니다:

```bash
nmap -p- YOUR_SERVER_IP
```

**포트 22**(SSH) 만 열려 있어야 합니다. 다른 모든 서비스(Gateway(게이트웨이), Docker) 는 잠금 처리되어 있습니다.

### Docker 가용성

Docker 는 Gateway(게이트웨이) 자체를 실행하기 위한 것이 아니라 **에이전트 샌드박스**(격리된 도구 실행)를 위해 설치됩니다. Gateway(게이트웨이) 는 localhost 에만 바인딩되며 Tailscale VPN 을 통해 접근 가능합니다.

샌드박스 구성은 [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) 를 참고합니다.

## 수동 설치

자동화보다 수동 제어를 선호하는 경우:

```bash
# 1. Install prerequisites
sudo apt update && sudo apt install -y ansible git

# 2. Clone repository
git clone https://github.com/openclaw/openclaw-ansible.git
cd openclaw-ansible

# 3. Install Ansible collections
ansible-galaxy collection install -r requirements.yml

# 4. Run playbook
./run-playbook.sh

# Or run directly (then manually execute /tmp/openclaw-setup.sh after)
# ansible-playbook playbook.yml --ask-become-pass
```

## OpenClaw 업데이트

Ansible 설치 프로그램은 OpenClaw 를 수동 업데이트용으로 설정합니다. 표준 업데이트 흐름은 [Updating](/install/updating) 를 참고합니다.

Ansible 플레이북을 다시 실행하려면(예: 구성 변경):

```bash
cd openclaw-ansible
./run-playbook.sh
```

참고: 이는 멱등성이며 여러 번 실행해도 안전합니다.

## 문제 해결

### 방화벽이 연결을 차단합니다

접속이 차단된 경우:

- 먼저 Tailscale VPN 을 통해 접근할 수 있는지 확인합니다
- SSH 액세스(포트 22) 는 항상 허용됩니다
- Gateway(게이트웨이) 는 설계상 Tailscale 를 통해서만 접근 가능합니다

### 서비스가 시작되지 않습니다

```bash
# Check logs
sudo journalctl -u openclaw -n 100

# Verify permissions
sudo ls -la /opt/openclaw

# Test manual start
sudo -i -u openclaw
cd ~/openclaw
pnpm start
```

### Docker 샌드박스 문제

```bash
# Verify Docker is running
sudo systemctl status docker

# Check sandbox image
sudo docker images | grep openclaw-sandbox

# Build sandbox image if missing
cd /opt/openclaw/openclaw
sudo -u openclaw ./scripts/sandbox-setup.sh
```

### 프로바이더 로그인이 실패합니다

`openclaw` 사용자로 실행 중인지 확인합니다:

```bash
sudo -i -u openclaw
openclaw channels login
```

## 고급 구성

자세한 보안 아키텍처 및 문제 해결은 다음을 참고합니다:

- [Security Architecture](https://github.com/openclaw/openclaw-ansible/blob/main/docs/security.md)
- [Technical Details](https://github.com/openclaw/openclaw-ansible/blob/main/docs/architecture.md)
- [Troubleshooting Guide](https://github.com/openclaw/openclaw-ansible/blob/main/docs/troubleshooting.md)

## 관련

- [openclaw-ansible](https://github.com/openclaw/openclaw-ansible) — 전체 배포 가이드
- [Docker](/install/docker) — 컨테이너화된 Gateway(게이트웨이) 설정
- [Sandboxing](/gateway/sandboxing) — 에이전트 샌드박스 구성
- [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) — 에이전트별 격리
