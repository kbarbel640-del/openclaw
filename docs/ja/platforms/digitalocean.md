---
summary: "DigitalOcean 上の OpenClaw（シンプルな有料 VPS オプション）"
read_when:
  - DigitalOcean で OpenClaw をセットアップする場合
  - OpenClaw 向けの安価な VPS ホスティングを探している場合
title: "DigitalOcean"
x-i18n:
  source_path: platforms/digitalocean.md
  source_hash: bacdea3a44bc663d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:22Z
---

# DigitalOcean 上の OpenClaw

## 目的

DigitalOcean 上で永続的な OpenClaw Gateway（ゲートウェイ）を **月額 $6**（予約価格で月額 $4）で稼働させます。

月額 $0 のオプションを希望し、ARM + プロバイダー固有のセットアップを気にしない場合は、[Oracle Cloud ガイド](/platforms/oracle) を参照してください。

## コスト比較（2026 年）

| プロバイダー | プラン          | スペック              | 月額価格       | 注記                            |
| ------------ | --------------- | --------------------- | -------------- | ------------------------------- |
| Oracle Cloud | Always Free ARM | 最大 4 OCPU、24GB RAM | $0             | ARM、容量制限 / 登録時の癖あり  |
| Hetzner      | CX22            | 2 vCPU、4GB RAM       | €3.79（約 $4） | 最安の有料オプション            |
| DigitalOcean | Basic           | 1 vCPU、1GB RAM       | $6             | 簡単な UI、充実したドキュメント |
| Vultr        | Cloud Compute   | 1 vCPU、1GB RAM       | $6             | ロケーションが豊富              |
| Linode       | Nanode          | 1 vCPU、1GB RAM       | $5             | 現在は Akamai の一部            |

**プロバイダーの選び方：**

- DigitalOcean：最もシンプルな UX と予測可能なセットアップ（本ガイド）
- Hetzner：価格性能比が良好（[Hetzner ガイド](/install/hetzner) を参照）
- Oracle Cloud：月額 $0 にできるが、やや癖があり ARM 専用（[Oracle ガイド](/platforms/oracle) を参照）

---

## 前提条件

- DigitalOcean アカウント（[登録で $200 の無料クレジット](https://m.do.co/c/signup)）
- SSH キーペア（またはパスワード認証を使用する意思）
- 約 20 分

## 1) Droplet の作成

1. [DigitalOcean](https://cloud.digitalocean.com/) にログインします。
2. **Create → Droplets** をクリックします。
3. 以下を選択します。
   - **Region:** 自分（またはユーザー）に最も近いリージョン
   - **Image:** Ubuntu 24.04 LTS
   - **Size:** Basic → Regular → **$6/mo**（1 vCPU、1GB RAM、25GB SSD）
   - **Authentication:** SSH キー（推奨）またはパスワード
4. **Create Droplet** をクリックします。
5. IP アドレスを控えます。

## 2) SSH で接続

```bash
ssh root@YOUR_DROPLET_IP
```

## 3) OpenClaw をインストール

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

## 4) オンボーディングを実行

```bash
openclaw onboard --install-daemon
```

ウィザードでは以下を案内します。

- モデル認証（API キーまたは OAuth）
- チャンネル設定（Telegram、WhatsApp、Discord など）
- Gateway トークン（自動生成）
- デーモンのインストール（systemd）

## 5) Gateway を確認

```bash
# Check status
openclaw status

# Check service
systemctl --user status openclaw-gateway.service

# View logs
journalctl --user -u openclaw-gateway.service -f
```

## 6) ダッシュボードにアクセス

Gateway（ゲートウェイ）はデフォルトで loopback にバインドされます。Control UI にアクセスするには次のいずれかを使用します。

**オプション A: SSH トンネル（推奨）**

```bash
# From your local machine
ssh -L 18789:localhost:18789 root@YOUR_DROPLET_IP

# Then open: http://localhost:18789
```

**オプション B: Tailscale Serve（HTTPS、loopback のみ）**

```bash
# On the droplet
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

# Configure Gateway to use Tailscale Serve
openclaw config set gateway.tailscale.mode serve
openclaw gateway restart
```

開く：`https://<magicdns>/`

注記：

- Serve は Gateway を loopback のみに保ち、Tailscale のアイデンティティヘッダーで認証します。
- 代わりにトークン / パスワードを必須にするには、`gateway.auth.allowTailscale: false` を設定するか、`gateway.auth.mode: "password"` を使用してください。

**オプション C: Tailnet バインド（Serve なし）**

```bash
openclaw config set gateway.bind tailnet
openclaw gateway restart
```

開く：`http://<tailscale-ip>:18789`（トークン必須）。

## 7) チャンネルを接続

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

他のプロバイダーについては [Channels](/channels) を参照してください。

---

## 1GB RAM 向けの最適化

$6 の Droplet は 1GB RAM のみです。安定して動作させるために以下を検討してください。

### スワップの追加（推奨）

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### より軽量なモデルを使用

OOM が発生する場合は、以下を検討してください。

- ローカルモデルではなく API ベースのモデル（Claude、GPT）を使用する
- `agents.defaults.model.primary` をより小さなモデルに設定する

### メモリの監視

```bash
free -h
htop
```

---

## 永続性

すべての状態は以下に保存されます。

- `~/.openclaw/` — 設定、認証情報、セッションデータ
- `~/.openclaw/workspace/` — ワークスペース（SOUL.md、メモリなど）

これらは再起動後も保持されます。定期的にバックアップしてください。

```bash
tar -czvf openclaw-backup.tar.gz ~/.openclaw ~/.openclaw/workspace
```

---

## Oracle Cloud の無料代替案

Oracle Cloud は **Always Free** の ARM インスタンスを提供しており、ここに挙げたどの有料オプションよりも大幅に高性能です。月額 $0 で利用できます。

| 内容                 | スペック                 |
| -------------------- | ------------------------ |
| **4 OCPU**           | ARM Ampere A1            |
| **24GB RAM**         | 十分すぎる容量           |
| **200GB ストレージ** | ブロックボリューム       |
| **永久無料**         | クレジットカード請求なし |

**注意点：**

- 登録が不安定な場合があります（失敗したら再試行してください）
- ARM アーキテクチャ — 多くは動作しますが、一部のバイナリは ARM ビルドが必要です

完全なセットアップガイドについては [Oracle Cloud](/platforms/oracle) を参照してください。登録のコツや登録プロセスのトラブルシューティングについては、この [コミュニティガイド](https://gist.github.com/rssnyder/51e3cfedd730e7dd5f4a816143b25dbd) を参照してください。

---

## トラブルシューティング

### Gateway が起動しない

```bash
openclaw gateway status
openclaw doctor --non-interactive
journalctl -u openclaw --no-pager -n 50
```

### ポートが既に使用中

```bash
lsof -i :18789
kill <PID>
```

### メモリ不足

```bash
# Check memory
free -h

# Add more swap
# Or upgrade to $12/mo droplet (2GB RAM)
```

---

## 関連項目

- [Hetzner ガイド](/install/hetzner) — より安価で高性能
- [Docker インストール](/install/docker) — コンテナ化されたセットアップ
- [Tailscale](/gateway/tailscale) — 安全なリモートアクセス
- [Configuration](/gateway/configuration) — 完全な設定リファレンス
