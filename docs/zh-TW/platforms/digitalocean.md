---
summary: "DigitalOcean 上的 OpenClaw（簡單的付費 VPS 選項）"
read_when:
  - 在 DigitalOcean 上設定 OpenClaw
  - 尋找適合 OpenClaw 的便宜 VPS 主機
title: "DigitalOcean"
x-i18n:
  source_path: platforms/digitalocean.md
  source_hash: bacdea3a44bc663d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:07Z
---

# DigitalOcean 上的 OpenClaw

## 目標

在 DigitalOcean 上執行一個持續運作的 OpenClaw Gateway 閘道器，**每月 $6**（或使用保留定價每月 $4）。

如果你想要 $0/月 的選項，且不介意 ARM + 供應商特定的設定，請參閱 [Oracle Cloud 指南](/platforms/oracle)。

## 成本比較（2026）

| 供應商       | 方案            | 規格                  | 價格/月        | 備註                        |
| ------------ | --------------- | --------------------- | -------------- | --------------------------- |
| Oracle Cloud | Always Free ARM | 最多 4 OCPU，24GB RAM | $0             | ARM，容量有限／註冊有些眉角 |
| Hetzner      | CX22            | 2 vCPU，4GB RAM       | €3.79（約 $4） | 最便宜的付費選項            |
| DigitalOcean | Basic           | 1 vCPU，1GB RAM       | $6             | 介面簡單，文件齊全          |
| Vultr        | Cloud Compute   | 1 vCPU，1GB RAM       | $6             | 地點多                      |
| Linode       | Nanode          | 1 vCPU，1GB RAM       | $5             | 現為 Akamai 旗下            |

**選擇供應商：**

- DigitalOcean：最簡單的使用體驗 + 可預期的設定（本指南）
- Hetzner：價格／效能佳（請參閱 [Hetzner 指南](/install/hetzner)）
- Oracle Cloud：可 $0/月，但較為挑剔且僅支援 ARM（請參閱 [Oracle 指南](/platforms/oracle)）

---

## 先決條件

- DigitalOcean 帳號（[註冊可獲得 $200 免費額度](https://m.do.co/c/signup)）
- SSH 金鑰對（或願意使用密碼驗證）
- 約 20 分鐘

## 1) 建立 Droplet

1. 登入 [DigitalOcean](https://cloud.digitalocean.com/)
2. 點擊 **Create → Droplets**
3. 選擇：
   - **Region：** 距離你（或你的使用者）最近
   - **Image：** Ubuntu 24.04 LTS
   - **Size：** Basic → Regular → **$6/mo**（1 vCPU，1GB RAM，25GB SSD）
   - **Authentication：** SSH 金鑰（建議）或密碼
4. 點擊 **Create Droplet**
5. 記下 IP 位址

## 2) 透過 SSH 連線

```bash
ssh root@YOUR_DROPLET_IP
```

## 3) 安裝 OpenClaw

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Install OpenClaw
curl -fsSL https://openclaw.ai/install.sh | bash

# Verify
openclaw --version
```

## 4) 執行入門引導

```bash
openclaw onboard --install-daemon
```

精靈將帶你完成：

- 模型驗證（API 金鑰或 OAuth）
- 頻道設定（Telegram、WhatsApp、Discord 等）
- Gateway 權杖（自動產生）
- 常駐程式安裝（systemd）

## 5) 驗證 Gateway 閘道器

```bash
# Check status
openclaw status

# Check service
systemctl --user status openclaw-gateway.service

# View logs
journalctl --user -u openclaw-gateway.service -f
```

## 6) 存取儀表板

Gateway 預設綁定至 local loopback。若要存取控制介面：

**選項 A：SSH 通道（建議）**

```bash
# From your local machine
ssh -L 18789:localhost:18789 root@YOUR_DROPLET_IP

# Then open: http://localhost:18789
```

**選項 B：Tailscale Serve（HTTPS，僅限 loopback）**

```bash
# On the droplet
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

# Configure Gateway to use Tailscale Serve
openclaw config set gateway.tailscale.mode serve
openclaw gateway restart
```

開啟：`https://<magicdns>/`

注意事項：

- Serve 會讓 Gateway 保持僅限 loopback，並透過 Tailscale 身分標頭進行驗證。
- 若要改為要求權杖／密碼，請設定 `gateway.auth.allowTailscale: false` 或使用 `gateway.auth.mode: "password"`。

**選項 C：Tailnet 綁定（不使用 Serve）**

```bash
openclaw config set gateway.bind tailnet
openclaw gateway restart
```

開啟：`http://<tailscale-ip>:18789`（需要權杖）。

## 7) 連接你的頻道

### Telegram

```bash
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>
```

### WhatsApp

```bash
openclaw channels login whatsapp
# Scan QR code
```

其他提供者請參閱 [Channels](/channels)。

---

## 1GB RAM 的最佳化

$6 的 Droplet 只有 1GB RAM。為了保持順暢運作：

### 新增 swap（建議）

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 使用較輕量的模型

如果你遇到 OOM，請考慮：

- 使用 API 型模型（Claude、GPT），而非本地模型
- 將 `agents.defaults.model.primary` 設定為較小的模型

### 監控記憶體

```bash
free -h
htop
```

---

## 永久性

所有狀態都儲存在：

- `~/.openclaw/` — 設定、憑證、工作階段資料
- `~/.openclaw/workspace/` — 工作區（SOUL.md、記憶等）

這些在重新開機後仍會保留。請定期備份：

```bash
tar -czvf openclaw-backup.tar.gz ~/.openclaw ~/.openclaw/workspace
```

---

## Oracle Cloud 免費替代方案

Oracle Cloud 提供 **Always Free** 的 ARM 執行個體，效能顯著優於此處任何付費選項——每月 $0。

| 你能獲得的內容 | 規格               |
| -------------- | ------------------ |
| **4 OCPUs**    | ARM Ampere A1      |
| **24GB RAM**   | 綽綽有餘           |
| **200GB 儲存** | 區塊磁碟區         |
| **永久免費**   | 不會收取信用卡費用 |

**注意事項：**

- 註冊可能有些挑剔（失敗時請重試）
- ARM 架構——大多數東西可用，但部分二進位檔需要 ARM 版本

完整設定指南請參閱 [Oracle Cloud](/platforms/oracle)。關於註冊技巧與入會流程的疑難排解，請參閱這份 [社群指南](https://gist.github.com/rssnyder/51e3cfedd730e7dd5f4a816143b25dbd)。

---

## 疑難排解

### Gateway 無法啟動

```bash
openclaw gateway status
openclaw doctor --non-interactive
journalctl -u openclaw --no-pager -n 50
```

### 連接埠已被使用

```bash
lsof -i :18789
kill <PID>
```

### 記憶體不足

```bash
# Check memory
free -h

# Add more swap
# Or upgrade to $12/mo droplet (2GB RAM)
```

---

## 另請參閱

- [Hetzner 指南](/install/hetzner) — 更便宜、效能更強
- [Docker 安裝](/install/docker) — 容器化設定
- [Tailscale](/gateway/tailscale) — 安全的遠端存取
- [Configuration](/gateway/configuration) — 完整設定參考
