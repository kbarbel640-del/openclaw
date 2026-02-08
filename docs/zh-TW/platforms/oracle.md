---
summary: 「在 Oracle Cloud（Always Free ARM）上執行 OpenClaw」
read_when:
  - 設定在 Oracle Cloud 上的 OpenClaw
  - 尋找適合 OpenClaw 的低成本 VPS 主機
  - 想要在小型伺服器上 24/7 執行 OpenClaw
title: 「Oracle Cloud」
x-i18n:
  source_path: platforms/oracle.md
  source_hash: 8ec927ab5055c915
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:24Z
---

# 在 Oracle Cloud（OCI）上執行 OpenClaw

## 目標

在 Oracle Cloud 的 **Always Free** ARM 層級上執行一個持續運作的 OpenClaw Gateway 閘道器。

Oracle 的免費層級非常適合 OpenClaw（尤其是你已經擁有 OCI 帳戶時），但也有一些取捨：

- ARM 架構（大多數功能可用，但部分二進位檔可能僅支援 x86）
- 容量與註冊流程可能較不穩定

## 成本比較（2026）

| 提供者       | 方案            | 規格                  | 每月價格 | 備註               |
| ------------ | --------------- | --------------------- | -------- | ------------------ |
| Oracle Cloud | Always Free ARM | 最多 4 OCPU，24GB RAM | $0       | ARM，容量有限      |
| Hetzner      | CX22            | 2 vCPU，4GB RAM       | 約 $4    | 最便宜的付費選項   |
| DigitalOcean | Basic           | 1 vCPU，1GB RAM       | $6       | 介面友善，文件完善 |
| Vultr        | Cloud Compute   | 1 vCPU，1GB RAM       | $6       | 多個機房地點       |
| Linode       | Nanode          | 1 vCPU，1GB RAM       | $5       | 現為 Akamai 旗下   |

---

## 先決條件

- Oracle Cloud 帳戶（[註冊](https://www.oracle.com/cloud/free/)）— 若遇到問題，請參考 [社群註冊指南](https://gist.github.com/rssnyder/51e3cfedd730e7dd5f4a816143b25dbd)
- Tailscale 帳戶（可於 [tailscale.com](https://tailscale.com) 免費註冊）
- 約 30 分鐘

## 1) 建立 OCI 執行個體

1. 登入 [Oracle Cloud Console](https://cloud.oracle.com/)
2. 前往 **Compute → Instances → Create Instance**
3. 設定：
   - **Name:** `openclaw`
   - **Image:** Ubuntu 24.04（aarch64）
   - **Shape:** `VM.Standard.A1.Flex`（Ampere ARM）
   - **OCPUs:** 2（或最多 4）
   - **Memory:** 12 GB（或最多 24 GB）
   - **Boot volume:** 50 GB（最多 200 GB 免費）
   - **SSH key:** 新增你的公開金鑰
4. 點擊 **Create**
5. 記下公用 IP 位址

**提示：** 若建立執行個體時出現「Out of capacity」，請嘗試不同的可用性網域，或稍後再試。免費層級的容量有限。

## 2) 連線並更新

```bash
# Connect via public IP
ssh ubuntu@YOUR_PUBLIC_IP

# Update system
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential
```

**注意：** `build-essential` 對於某些相依套件的 ARM 編譯是必要的。

## 3) 設定使用者與主機名稱

```bash
# Set hostname
sudo hostnamectl set-hostname openclaw

# Set password for ubuntu user
sudo passwd ubuntu

# Enable lingering (keeps user services running after logout)
sudo loginctl enable-linger ubuntu
```

## 4) 安裝 Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh --hostname=openclaw
```

這會啟用 Tailscale SSH，讓你可以從 tailnet 中的任何裝置，透過 `ssh openclaw` 連線 — 不需要公用 IP。

驗證：

```bash
tailscale status
```

**從現在起，請透過 Tailscale 連線：** `ssh ubuntu@openclaw`（或使用 Tailscale IP）。

## 5) 安裝 OpenClaw

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
source ~/.bashrc
```

當出現提示「How do you want to hatch your bot?」時，選擇 **「Do this later」**。

> 注意：如果遇到 ARM 原生建置問題，請先嘗試系統套件（例如 `sudo apt install -y build-essential`），再考慮使用 Homebrew。

## 6) 設定 Gateway（loopback + token 驗證）並啟用 Tailscale Serve

預設使用 token 驗證。這種方式可預期性高，且不需要任何「不安全驗證」的 Control UI 旗標。

```bash
# Keep the Gateway private on the VM
openclaw config set gateway.bind loopback

# Require auth for the Gateway + Control UI
openclaw config set gateway.auth.mode token
openclaw doctor --generate-gateway-token

# Expose over Tailscale Serve (HTTPS + tailnet access)
openclaw config set gateway.tailscale.mode serve
openclaw config set gateway.trustedProxies '["127.0.0.1"]'

systemctl --user restart openclaw-gateway
```

## 7) 驗證

```bash
# Check version
openclaw --version

# Check daemon status
systemctl --user status openclaw-gateway

# Check Tailscale Serve
tailscale serve status

# Test local response
curl http://localhost:18789
```

## 8) 鎖定 VCN 安全性

在一切正常運作後，鎖定 VCN，只允許 Tailscale 的流量。OCI 的 Virtual Cloud Network 會在網路邊界充當防火牆 — 流量在到達執行個體前即被阻擋。

1. 在 OCI Console 前往 **Networking → Virtual Cloud Networks**
2. 點擊你的 VCN → **Security Lists** → Default Security List
3. **移除** 所有入站規則，僅保留：
   - `0.0.0.0/0 UDP 41641`（Tailscale）
4. 保留預設的出站規則（允許所有對外連線）

這會在網路邊界封鎖 22 埠的 SSH、HTTP、HTTPS，以及其他所有流量。從此之後，你只能透過 Tailscale 連線。

---

## 存取 Control UI

從任何位於你 Tailscale 網路中的裝置：

```
https://openclaw.<tailnet-name>.ts.net/
```

將 `<tailnet-name>` 替換為你的 tailnet 名稱（可在 `tailscale status` 中看到）。

不需要 SSH 通道。Tailscale 提供：

- HTTPS 加密（自動憑證）
- 透過 Tailscale 身分進行驗證
- 從 tailnet 中的任何裝置存取（筆電、手機等）

---

## 安全性：VCN + Tailscale（建議的基準）

在 VCN 鎖定（僅開放 UDP 41641）且 Gateway 綁定於 local loopback 的情況下，你可以獲得強大的縱深防禦：公用流量在網路邊界被阻擋，管理存取則透過你的 tailnet 進行。

這種設定通常可以免除僅為了阻擋全網路 SSH 暴力破解而額外設定主機型防火牆的「需求」— 但你仍應保持作業系統更新、執行 `openclaw security audit`，並確認沒有意外地在公用介面上監聽。

### 已經受到保護的項目

| 傳統步驟            | 是否需要   | 原因                                                 |
| ------------------- | ---------- | ---------------------------------------------------- |
| UFW 防火牆          | 否         | VCN 在流量到達執行個體前即進行阻擋                   |
| fail2ban            | 否         | 若在 VCN 層級封鎖 22 埠，就不會有暴力破解            |
| sshd 強化           | 否         | Tailscale SSH 不使用 sshd                            |
| 停用 root 登入      | 否         | Tailscale 使用 Tailscale 身分，而非系統使用者        |
| 僅允許 SSH 金鑰驗證 | 否         | Tailscale 透過你的 tailnet 進行驗證                  |
| IPv6 強化           | 通常不需要 | 取決於你的 VCN／子網設定；請確認實際指派與暴露的內容 |

### 仍建議執行

- **憑證權限：** `chmod 700 ~/.openclaw`
- **安全稽核：** `openclaw security audit`
- **系統更新：** 定期執行 `sudo apt update && sudo apt upgrade`
- **監控 Tailscale：** 在 [Tailscale 管理主控台](https://login.tailscale.com/admin) 檢視裝置

### 驗證安全狀態

```bash
# Confirm no public ports listening
sudo ss -tlnp | grep -v '127.0.0.1\|::1'

# Verify Tailscale SSH is active
tailscale status | grep -q 'offers: ssh' && echo "Tailscale SSH active"

# Optional: disable sshd entirely
sudo systemctl disable --now ssh
```

---

## 備援方案：SSH 通道

如果 Tailscale Serve 無法運作，請使用 SSH 通道：

```bash
# From your local machine (via Tailscale)
ssh -L 18789:127.0.0.1:18789 ubuntu@openclaw
```

接著開啟 `http://localhost:18789`。

---

## 疑難排解

### 執行個體建立失敗（「Out of capacity」）

免費層級的 ARM 執行個體相當熱門。請嘗試：

- 不同的可用性網域
- 在離峰時段重試（清晨）
- 選擇 shape 時使用「Always Free」篩選器

### Tailscale 無法連線

```bash
# Check status
sudo tailscale status

# Re-authenticate
sudo tailscale up --ssh --hostname=openclaw --reset
```

### Gateway 無法啟動

```bash
openclaw gateway status
openclaw doctor --non-interactive
journalctl --user -u openclaw-gateway -n 50
```

### 無法存取 Control UI

```bash
# Verify Tailscale Serve is running
tailscale serve status

# Check gateway is listening
curl http://localhost:18789

# Restart if needed
systemctl --user restart openclaw-gateway
```

### ARM 二進位檔問題

部分工具可能沒有 ARM 版本。請檢查：

```bash
uname -m  # Should show aarch64
```

大多數 npm 套件都能正常運作。對於二進位檔，請尋找 `linux-arm64` 或 `aarch64` 版本。

---

## 持久性

所有狀態資料都存放於：

- `~/.openclaw/` — 設定、憑證、工作階段資料
- `~/.openclaw/workspace/` — 工作區（SOUL.md、記憶、產出檔案）

請定期備份：

```bash
tar -czvf openclaw-backup.tar.gz ~/.openclaw ~/.openclaw/workspace
```

---

## 另請參閱

- [Gateway 遠端存取](/gateway/remote) — 其他遠端存取模式
- [Tailscale 整合](/gateway/tailscale) — 完整的 Tailscale 文件
- [Gateway 設定](/gateway/configuration) — 所有設定選項
- [DigitalOcean 指南](/platforms/digitalocean) — 若你想要付費方案與更簡單的註冊流程
- [Hetzner 指南](/install/hetzner) — 以 Docker 為基礎的替代方案
