---
summary: "Raspberry Pi 上の OpenClaw（低予算のセルフホスト構成）"
read_when:
  - Raspberry Pi で OpenClaw をセットアップする場合
  - ARM デバイスで OpenClaw を実行する場合
  - 安価で常時稼働のパーソナル AI を構築したい場合
title: "Raspberry Pi"
x-i18n:
  source_path: platforms/raspberry-pi.md
  source_hash: 90b143a2877a4cea
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:40Z
---

# Raspberry Pi 上の OpenClaw

## 目的

Raspberry Pi 上で永続的かつ常時稼働の OpenClaw Gateway（ゲートウェイ）を、**約 $35～80** の初期費用のみ（月額費用なし）で実行します。

以下の用途に最適です。

- 24 時間 365 日稼働のパーソナル AI アシスタント
- ホームオートメーションハブ
- 低消費電力で常時利用可能な Telegram / WhatsApp ボット

## ハードウェア要件

| Pi モデル       | RAM     | 動作可否  | 備考                       |
| --------------- | ------- | --------- | -------------------------- |
| **Pi 5**        | 4GB/8GB | ✅ 最適   | 最速、推奨                 |
| **Pi 4**        | 4GB     | ✅ 良好   | 多くのユーザーにとって最適 |
| **Pi 4**        | 2GB     | ✅ 可     | 動作するが swap 追加を推奨 |
| **Pi 4**        | 1GB     | ⚠️ 厳しい | swap と最小構成で可能      |
| **Pi 3B+**      | 1GB     | ⚠️ 遅い   | 動作するが動作は重め       |
| **Pi Zero 2 W** | 512MB   | ❌        | 非推奨                     |

**最小要件:** RAM 1GB、1 コア、ディスク 500MB  
**推奨:** RAM 2GB 以上、64-bit OS、16GB 以上の SD カード（または USB SSD）

## 用意するもの

- Raspberry Pi 4 または 5（2GB 以上を推奨）
- MicroSD カード（16GB 以上）または USB SSD（より高性能）
- 電源アダプタ（公式 Pi PSU を推奨）
- ネットワーク接続（Ethernet または WiFi）
- 約 30 分

## 1) OS を書き込む

ヘッドレスサーバーとして使用するため、デスクトップ不要の **Raspberry Pi OS Lite (64-bit)** を使用します。

1. [Raspberry Pi Imager](https://www.raspberrypi.com/software/) をダウンロード
2. OS を選択: **Raspberry Pi OS Lite (64-bit)**
3. 歯車アイコン（⚙️）をクリックして事前設定:
   - ホスト名を設定: `gateway-host`
   - SSH を有効化
   - ユーザー名 / パスワードを設定
   - WiFi を設定（Ethernet を使用しない場合）
4. SD カード / USB ドライブに書き込む
5. Pi に挿入して起動

## 2) SSH で接続

```bash
ssh user@gateway-host
# or use the IP address
ssh user@192.168.x.x
```

## 3) システム設定

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y git curl build-essential

# Set timezone (important for cron/reminders)
sudo timedatectl set-timezone America/Chicago  # Change to your timezone
```

## 4) Node.js 22（ARM64）をインストール

```bash
# Install Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should show v22.x.x
npm --version
```

## 5) Swap を追加（2GB 以下では重要）

Swap はメモリ不足によるクラッシュを防ぎます。

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

## 6) OpenClaw をインストール

### オプション A: 標準インストール（推奨）

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
```

### オプション B: ハック可能なインストール（試行錯誤向け）

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
npm install
npm run build
npm link
```

ハック可能なインストールでは、ログやコードに直接アクセスできます。ARM 固有の問題をデバッグする際に便利です。

## 7) オンボーディングを実行

```bash
openclaw onboard --install-daemon
```

ウィザードに従って設定します。

1. **Gateway モード:** ローカル
2. **認証:** API キー推奨（OAuth はヘッドレス Pi では不安定な場合があります）
3. **チャンネル:** 最初は Telegram が最も簡単
4. **デーモン:** はい（systemd）

## 8) インストール確認

```bash
# Check status
openclaw status

# Check service
sudo systemctl status openclaw

# View logs
journalctl -u openclaw -f
```

## 9) ダッシュボードにアクセス

Pi はヘッドレスのため、SSH トンネルを使用します。

```bash
# From your laptop/desktop
ssh -L 18789:localhost:18789 user@gateway-host

# Then open in browser
open http://localhost:18789
```

または、常時アクセス用に Tailscale を使用します。

```bash
# On the Pi
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Update config
openclaw config set gateway.bind tailnet
sudo systemctl restart openclaw
```

---

## パフォーマンス最適化

### USB SSD を使用（大幅な改善）

SD カードは低速で消耗しやすいです。USB SSD を使うことで性能が大幅に向上します。

```bash
# Check if booting from USB
lsblk
```

セットアップ方法は [Pi USB ブートガイド](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#usb-mass-storage-boot) を参照してください。

### メモリ使用量を削減

```bash
# Disable GPU memory allocation (headless)
echo 'gpu_mem=16' | sudo tee -a /boot/config.txt

# Disable Bluetooth if not needed
sudo systemctl disable bluetooth
```

### リソースを監視

```bash
# Check memory
free -h

# Check CPU temperature
vcgencmd measure_temp

# Live monitoring
htop
```

---

## ARM 固有の注意点

### バイナリ互換性

OpenClaw のほとんどの機能は ARM64 で動作しますが、外部バイナリの一部は ARM ビルドが必要です。

| ツール             | ARM64 状態 | 備考                                |
| ------------------ | ---------- | ----------------------------------- |
| Node.js            | ✅         | 問題なく動作                        |
| WhatsApp (Baileys) | ✅         | Pure JS、問題なし                   |
| Telegram           | ✅         | Pure JS、問題なし                   |
| gog (Gmail CLI)    | ⚠️         | ARM リリースの有無を確認            |
| Chromium (browser) | ✅         | `sudo apt install chromium-browser` |

Skill が失敗する場合、そのバイナリに ARM ビルドがあるかを確認してください。多くの Go / Rust 製ツールは対応していますが、未対応のものもあります。

### 32-bit と 64-bit

**必ず 64-bit OS を使用してください。** Node.js や多くの最新ツールで必須です。次のコマンドで確認できます。

```bash
uname -m
# Should show: aarch64 (64-bit) not armv7l (32-bit)
```

---

## 推奨モデル構成

Pi は Gateway（ゲートウェイ）のみを担当し、モデルはクラウドで実行するため、API ベースのモデルを使用します。

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

**Pi 上でローカル LLM を実行しないでください。** 小規模なモデルでも遅すぎます。Claude / GPT に重い処理を任せましょう。

---

## 起動時の自動起動

オンボーディングウィザードで設定されますが、確認する場合は以下を実行します。

```bash
# Check service is enabled
sudo systemctl is-enabled openclaw

# Enable if not
sudo systemctl enable openclaw

# Start on boot
sudo systemctl start openclaw
```

---

## トラブルシューティング

### メモリ不足（OOM）

```bash
# Check memory
free -h

# Add more swap (see Step 5)
# Or reduce services running on the Pi
```

### 動作が遅い場合

- SD カードではなく USB SSD を使用
- 未使用サービスを無効化: `sudo systemctl disable cups bluetooth avahi-daemon`
- CPU スロットリングを確認: `vcgencmd get_throttled`（`0x0` が返るはずです）

### サービスが起動しない

```bash
# Check logs
journalctl -u openclaw --no-pager -n 100

# Common fix: rebuild
cd ~/openclaw  # if using hackable install
npm run build
sudo systemctl restart openclaw
```

### ARM バイナリの問題

Skill が「exec format error」で失敗する場合:

1. バイナリに ARM64 ビルドがあるか確認
2. ソースからビルドを試す
3. ARM 対応の Docker コンテナを使用する

### WiFi が切断される

ヘッドレス Pi を WiFi で使用する場合:

```bash
# Disable WiFi power management
sudo iwconfig wlan0 power off

# Make permanent
echo 'wireless-power off' | sudo tee -a /etc/network/interfaces
```

---

## コスト比較

| 構成           | 初期費用 | 月額費用 | 備考                   |
| -------------- | -------- | -------- | ---------------------- |
| **Pi 4 (2GB)** | ~$45     | $0       | + 電気代（約 $5 / 年） |
| **Pi 4 (4GB)** | ~$55     | $0       | 推奨                   |
| **Pi 5 (4GB)** | ~$60     | $0       | 最高のパフォーマンス   |
| **Pi 5 (8GB)** | ~$80     | $0       | 過剰だが将来性あり     |
| DigitalOcean   | $0       | $6/月    | 年間 $72               |
| Hetzner        | $0       | €3.79/月 | 年間 約 $50            |

**損益分岐点:** クラウド VPS と比べて、Pi は約 6～12 か月で元が取れます。

---

## 関連項目

- [Linux ガイド](/platforms/linux) — 一般的な Linux セットアップ
- [DigitalOcean ガイド](/platforms/digitalocean) — クラウド代替案
- [Hetzner ガイド](/install/hetzner) — Docker セットアップ
- [Tailscale](/gateway/tailscale) — リモートアクセス
- [Nodes](/nodes) — ノート PC / スマートフォンを Pi Gateway とペアリング
