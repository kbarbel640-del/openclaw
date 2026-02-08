---
summary: 「在 Raspberry Pi 上的 OpenClaw（低預算自架設方案）」
read_when:
  - 在 Raspberry Pi 上設定 OpenClaw
  - 在 ARM 裝置上執行 OpenClaw
  - 打造便宜、全年無休的個人 AI
title: 「Raspberry Pi」
x-i18n:
  source_path: platforms/raspberry-pi.md
  source_hash: 90b143a2877a4cea
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:25Z
---

# Raspberry Pi 上的 OpenClaw

## 目標

在 Raspberry Pi 上執行一個持久、全年無休的 OpenClaw Gateway 閘道器，一次性成本 **約 $35–80**（無月費）。

非常適合：

- 24/7 個人 AI 助理
- 家庭自動化中樞
- 低功耗、隨時可用的 Telegram / WhatsApp 機器人

## 硬體需求

| Pi 型號         | RAM     | 可用？  | 備註                      |
| --------------- | ------- | ------- | ------------------------- |
| **Pi 5**        | 4GB/8GB | ✅ 最佳 | 最快，建議使用            |
| **Pi 4**        | 4GB     | ✅ 良好 | 多數使用者的甜蜜點        |
| **Pi 4**        | 2GB     | ✅ 尚可 | 可用，需加入 swap         |
| **Pi 4**        | 1GB     | ⚠️ 吃緊 | 可行但需 swap，最小化設定 |
| **Pi 3B+**      | 1GB     | ⚠️ 緩慢 | 可用但反應遲緩            |
| **Pi Zero 2 W** | 512MB   | ❌      | 不建議                    |

**最低規格：** 1GB RAM、1 核心、500MB 磁碟空間  
**建議：** 2GB+ RAM、64 位元 OS、16GB+ SD 卡（或 USB SSD）

## 你需要準備的東西

- Raspberry Pi 4 或 5（建議 2GB+）
- MicroSD 卡（16GB+）或 USB SSD（效能更佳）
- 電源供應器（建議使用官方 Pi PSU）
- 網路連線（Ethernet 或 WiFi）
- 約 30 分鐘

## 1) 燒錄作業系統

使用 **Raspberry Pi OS Lite（64 位元）** — 無需桌面環境，適合無螢幕伺服器。

1. 下載 [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. 選擇 OS：**Raspberry Pi OS Lite（64 位元）**
3. 點擊齒輪圖示（⚙️）進行預先設定：
   - 設定主機名稱：`gateway-host`
   - 啟用 SSH
   - 設定使用者名稱／密碼
   - 設定 WiFi（若未使用 Ethernet）
4. 燒錄到你的 SD 卡／USB 磁碟
5. 插入並啟動 Pi

## 2) 透過 SSH 連線

```bash
ssh user@gateway-host
# or use the IP address
ssh user@192.168.x.x
```

## 3) 系統設定

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y git curl build-essential

# Set timezone (important for cron/reminders)
sudo timedatectl set-timezone America/Chicago  # Change to your timezone
```

## 4) 安裝 Node.js 22（ARM64）

```bash
# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should show v22.x.x
npm --version
```

## 5) 新增 Swap（2GB 或以下非常重要）

Swap 可避免記憶體不足導致的當機：

```bash
# Create 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimize for low RAM (reduce swappiness)
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## 6) 安裝 OpenClaw

### 選項 A：標準安裝（建議）

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

### 選項 B：可駭入安裝（適合折騰）

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
npm install
npm run build
npm link
```

可駭入安裝讓你直接存取日誌與程式碼，對於除錯 ARM 特有問題很有幫助。

## 7) 執行入門引導

```bash
openclaw onboard --install-daemon
```

依照精靈完成設定：

1. **Gateway 模式：** 本機
2. **Auth：** 建議使用 API 金鑰（在無螢幕的 Pi 上 OAuth 可能不穩定）
3. **Channels：** Telegram 最容易上手
4. **Daemon：** 是（systemd）

## 8) 驗證安裝

```bash
# Check status
openclaw status

# Check service
sudo systemctl status openclaw

# View logs
journalctl -u openclaw -f
```

## 9) 存取儀表板

由於 Pi 是無螢幕的，請使用 SSH 通道：

```bash
# From your laptop/desktop
ssh -L 18789:localhost:18789 user@gateway-host

# Then open in browser
open http://localhost:18789
```

或使用 Tailscale 進行全年無休的存取：

```bash
# On the Pi
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Update config
openclaw config set gateway.bind tailnet
sudo systemctl restart openclaw
```

---

## 效能最佳化

### 使用 USB SSD（大幅提升）

SD 卡速度慢且容易耗損。USB SSD 可顯著提升效能：

```bash
# Check if booting from USB
lsblk
```

設定方式請參考 [Pi USB 開機指南](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#usb-mass-storage-boot)。

### 降低記憶體使用量

```bash
# Disable GPU memory allocation (headless)
echo 'gpu_mem=16' | sudo tee -a /boot/config.txt

# Disable Bluetooth if not needed
sudo systemctl disable bluetooth
```

### 監控資源

```bash
# Check memory
free -h

# Check CPU temperature
vcgencmd measure_temp

# Live monitoring
htop
```

---

## ARM 專屬注意事項

### 二進位相容性

大多數 OpenClaw 功能可在 ARM64 上運作，但部分外部二進位檔需要 ARM 版本：

| 工具                | ARM64 狀態 | 備註                                |
| ------------------- | ---------- | ----------------------------------- |
| Node.js             | ✅         | 表現很好                            |
| WhatsApp（Baileys） | ✅         | 純 JS，沒有問題                     |
| Telegram            | ✅         | 純 JS，沒有問題                     |
| gog（Gmail CLI）    | ⚠️         | 請確認是否有 ARM 版本               |
| Chromium（瀏覽器）  | ✅         | `sudo apt install chromium-browser` |

若某個 skill 失敗，請檢查其二進位檔是否有 ARM 版本。許多 Go / Rust 工具都有；有些則沒有。

### 32 位元 vs 64 位元

**務必使用 64 位元 OS。** Node.js 與許多現代工具都需要它。可用以下指令檢查：

```bash
uname -m
# Should show: aarch64 (64-bit) not armv7l (32-bit)
```

---

## 建議的模型設定

由於 Pi 僅作為 Gateway（模型在雲端執行），請使用 API 型模型：

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/claude-sonnet-4-20250514",
        "fallbacks": ["openai/gpt-4o-mini"]
      }
    }
  }
}
```

**不要嘗試在 Pi 上執行本地 LLM** — 即使是小模型也太慢。把重度運算交給 Claude / GPT。

---

## 開機自動啟動

入門引導精靈會自動設定，但可用以下方式驗證：

```bash
# Check service is enabled
sudo systemctl is-enabled openclaw

# Enable if not
sudo systemctl enable openclaw

# Start on boot
sudo systemctl start openclaw
```

---

## 疑難排解

### 記憶體不足（OOM）

```bash
# Check memory
free -h

# Add more swap (see Step 5)
# Or reduce services running on the Pi
```

### 效能緩慢

- 使用 USB SSD 取代 SD 卡
- 停用未使用的服務：`sudo systemctl disable cups bluetooth avahi-daemon`
- 檢查 CPU 降頻：`vcgencmd get_throttled`（應回傳 `0x0`）

### 服務無法啟動

```bash
# Check logs
journalctl -u openclaw --no-pager -n 100

# Common fix: rebuild
cd ~/openclaw  # if using hackable install
npm run build
sudo systemctl restart openclaw
```

### ARM 二進位問題

若某個 skill 以「exec format error」失敗：

1. 檢查是否有 ARM64 版本的二進位檔
2. 嘗試從原始碼編譯
3. 或使用支援 ARM 的 Docker 容器

### WiFi 掉線

針對使用 WiFi 的無螢幕 Pi：

```bash
# Disable WiFi power management
sudo iwconfig wlan0 power off

# Make permanent
echo 'wireless-power off' | sudo tee -a /etc/network/interfaces
```

---

## 成本比較

| 設定            | 一次性成本 | 每月成本 | 備註             |
| --------------- | ---------- | -------- | ---------------- |
| **Pi 4（2GB）** | ~$45       | $0       | + 電力（~$5/年） |
| **Pi 4（4GB）** | ~$55       | $0       | 建議             |
| **Pi 5（4GB）** | ~$60       | $0       | 最佳效能         |
| **Pi 5（8GB）** | ~$80       | $0       | 過度但具前瞻性   |
| DigitalOcean    | $0         | $6/月    | $72/年           |
| Hetzner         | $0         | €3.79/月 | ~$50/年          |

**回本點：** 相較於雲端 VPS，Pi 約在 6–12 個月內回本。

---

## 另請參閱

- [Linux 指南](/platforms/linux) — 一般 Linux 設定
- [DigitalOcean 指南](/platforms/digitalocean) — 雲端替代方案
- [Hetzner 指南](/install/hetzner) — Docker 設定
- [Tailscale](/gateway/tailscale) — 遠端存取
- [Nodes](/nodes) — 將你的筆電／手機與 Pi Gateway 閘道器配對
