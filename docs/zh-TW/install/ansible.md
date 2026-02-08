---
summary: "使用 Ansible、Tailscale VPN 與防火牆隔離的自動化、強化版 OpenClaw 安裝"
read_when:
  - 你想要具備安全強化的自動化伺服器部署
  - 你需要具備 VPN 存取的防火牆隔離設定
  - 你要部署到遠端的 Debian／Ubuntu 伺服器
title: "Ansible"
x-i18n:
  source_path: install/ansible.md
  source_hash: 896807f344d923f0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:41Z
---

# Ansible 安裝

將 OpenClaw 部署到正式環境伺服器的建議方式，是透過 **[openclaw-ansible](https://github.com/openclaw/openclaw-ansible)** —— 一套以安全為優先架構的自動化安裝器。

## 快速開始

一行指令即可安裝：

```bash
curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw-ansible/main/install.sh | bash
```

> **📦 完整指南：[github.com/openclaw/openclaw-ansible](https://github.com/openclaw/openclaw-ansible)**
>
> openclaw-ansible 儲存庫是 Ansible 部署的最終依據。本頁僅提供快速概覽。

## 你將獲得的功能

- 🔒 **防火牆優先的安全設計**：UFW + Docker 隔離（僅允許 SSH + Tailscale 存取）
- 🔐 **Tailscale VPN**：不需公開服務即可進行安全的遠端存取
- 🐳 **Docker**：隔離的沙箱容器，僅綁定 localhost
- 🛡️ **縱深防禦**：4 層安全架構
- 🚀 **一行指令完成設定**：數分鐘內完成完整部署
- 🔧 **Systemd 整合**：開機自動啟動並具備安全強化設定

## 需求條件

- **作業系統**：Debian 11+ 或 Ubuntu 20.04+
- **存取權限**：Root 或 sudo 權限
- **網路**：可連線至網際網路以下載套件
- **Ansible**：2.14+（由快速開始指令碼自動安裝）

## 會安裝的項目

Ansible playbook 會安裝並設定以下元件：

1. **Tailscale**（用於安全遠端存取的 Mesh VPN）
2. **UFW 防火牆**（僅開放 SSH + Tailscale 連接埠）
3. **Docker CE + Compose V2**（用於代理程式沙箱）
4. **Node.js 22.x + pnpm**（執行階段相依套件）
5. **OpenClaw**（直接安裝於主機上，非容器化）
6. **Systemd 服務**（具備安全強化的自動啟動）

注意：Gateway 閘道器是 **直接在主機上執行**（不在 Docker 中），但代理程式沙箱會使用 Docker 進行隔離。詳情請參閱 [Sandboxing](/gateway/sandboxing)。

## 安裝後設定

安裝完成後，切換到 openclaw 使用者：

```bash
sudo -i -u openclaw
```

安裝後指令碼會引導你完成以下步驟：

1. **入門引導精靈**：設定 OpenClaw
2. **提供者登入**：連接 WhatsApp／Telegram／Discord／Signal
3. **Gateway 閘道器測試**：驗證安裝是否成功
4. **Tailscale 設定**：連接到你的 VPN Mesh

### 快速指令

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

## 安全架構

### 4 層防禦

1. **防火牆（UFW）**：僅公開 SSH（22）+ Tailscale（41641/udp）
2. **VPN（Tailscale）**：Gateway 閘道器僅能透過 VPN Mesh 存取
3. **Docker 隔離**：DOCKER-USER iptables 鏈阻止外部連接埠暴露
4. **Systemd 強化**：NoNewPrivileges、PrivateTmp、非特權使用者

### 驗證方式

測試對外的攻擊面：

```bash
nmap -p- YOUR_SERVER_IP
```

結果應該 **只顯示連接埠 22**（SSH）開放。所有其他服務（Gateway、Docker）皆已鎖定。

### Docker 可用性

Docker 僅用於 **代理程式沙箱**（隔離的工具執行環境），而非用來執行 Gateway 閘道器本身。Gateway 僅綁定至 localhost，並透過 Tailscale VPN 存取。

沙箱設定請參閱 [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools)。

## 手動安裝

如果你偏好對自動化流程進行手動控制：

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

## 更新 OpenClaw

Ansible 安裝器會將 OpenClaw 設定為手動更新。標準更新流程請參閱 [Updating](/install/updating)。

若要重新執行 Ansible playbook（例如變更設定）：

```bash
cd openclaw-ansible
./run-playbook.sh
```

注意：此流程具備冪等性，可安全地多次執行。

## 疑難排解

### 防火牆阻擋連線

如果你被鎖在系統外：

- 請先確認你可以透過 Tailscale VPN 存取
- SSH 存取（連接埠 22）始終允許
- Gateway 閘道器 **僅** 設計為透過 Tailscale 存取

### 服務無法啟動

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

### Docker 沙箱問題

```bash
# Verify Docker is running
sudo systemctl status docker

# Check sandbox image
sudo docker images | grep openclaw-sandbox

# Build sandbox image if missing
cd /opt/openclaw/openclaw
sudo -u openclaw ./scripts/sandbox-setup.sh
```

### 提供者登入失敗

請確認你是以 `openclaw` 使用者身分執行：

```bash
sudo -i -u openclaw
openclaw channels login
```

## 進階設定

如需深入了解安全架構與疑難排解：

- [Security Architecture](https://github.com/openclaw/openclaw-ansible/blob/main/docs/security.md)
- [Technical Details](https://github.com/openclaw/openclaw-ansible/blob/main/docs/architecture.md)
- [Troubleshooting Guide](https://github.com/openclaw/openclaw-ansible/blob/main/docs/troubleshooting.md)

## 相關內容

- [openclaw-ansible](https://github.com/openclaw/openclaw-ansible) — 完整部署指南
- [Docker](/install/docker) — 容器化 Gateway 閘道器設定
- [Sandboxing](/gateway/sandboxing) — 代理程式沙箱設定
- [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) — 每個代理程式的隔離設定
