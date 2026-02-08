---
summary: 「Oracle Cloud（Always Free ARM）での OpenClaw」
read_when:
  - Oracle Cloud で OpenClaw をセットアップする場合
  - OpenClaw 向けの低コスト VPS ホスティングを探している場合
  - 小規模サーバーで 24/7 OpenClaw を動かしたい場合
title: 「Oracle Cloud」
x-i18n:
  source_path: platforms/oracle.md
  source_hash: 8ec927ab5055c915
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:44Z
---

# Oracle Cloud（OCI）での OpenClaw

## 目的

Oracle Cloud の **Always Free** ARM ティア上で、永続的な OpenClaw Gateway（ゲートウェイ）を実行します。

Oracle の無料ティアは OpenClaw に非常に適しています（特に、すでに OCI アカウントをお持ちの場合）が、いくつかのトレードオフがあります。

- ARM アーキテクチャ（多くのものは動作しますが、一部のバイナリは x86 専用の場合があります）
- キャパシティやサインアップが不安定な場合があります

## コスト比較（2026 年）

| プロバイダー | プラン          | スペック              | 月額  | 備考                              |
| ------------ | --------------- | --------------------- | ----- | --------------------------------- |
| Oracle Cloud | Always Free ARM | 最大 4 OCPU、24GB RAM | $0    | ARM、キャパシティ制限             |
| Hetzner      | CX22            | 2 vCPU、4GB RAM       | 約 $4 | 最安の有料オプション              |
| DigitalOcean | Basic           | 1 vCPU、1GB RAM       | $6    | 使いやすい UI、良質なドキュメント |
| Vultr        | Cloud Compute   | 1 vCPU、1GB RAM       | $6    | 多くのロケーション                |
| Linode       | Nanode          | 1 vCPU、1GB RAM       | $5    | 現在は Akamai の一部              |

---

## 前提条件

- Oracle Cloud アカウント（[signup](https://www.oracle.com/cloud/free/)）— 問題が発生した場合は [community signup guide](https://gist.github.com/rssnyder/51e3cfedd730e7dd5f4a816143b25dbd) を参照してください
- Tailscale アカウント（[tailscale.com](https://tailscale.com) で無料）
- 約 30 分

## 1) OCI インスタンスの作成

1. [Oracle Cloud Console](https://cloud.oracle.com/) にログインします
2. **Compute → Instances → Create Instance** に移動します
3. 以下を設定します。
   - **Name:** `openclaw`
   - **Image:** Ubuntu 24.04（aarch64）
   - **Shape:** `VM.Standard.A1.Flex`（Ampere ARM）
   - **OCPUs:** 2（または最大 4）
   - **Memory:** 12 GB（または最大 24 GB）
   - **Boot volume:** 50 GB（最大 200 GB まで無料）
   - **SSH key:** 公開鍵を追加
4. **Create** をクリックします
5. パブリック IP アドレスを控えておきます

**ヒント:** 「Out of capacity」というエラーでインスタンス作成に失敗する場合は、別の可用性ドメインを試すか、時間をおいて再試行してください。無料ティアのキャパシティには制限があります。

## 2) 接続と更新

```bash
# Connect via public IP
ssh ubuntu@YOUR_PUBLIC_IP

# Update system
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential
```

**注意:** 一部の依存関係を ARM でコンパイルするために、`build-essential` が必要です。

## 3) ユーザーとホスト名の設定

```bash
# Set hostname
sudo hostnamectl set-hostname openclaw

# Set password for ubuntu user
sudo passwd ubuntu

# Enable lingering (keeps user services running after logout)
sudo loginctl enable-linger ubuntu
```

## 4) Tailscale のインストール

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --ssh --hostname=openclaw
```

これにより Tailscale SSH が有効になり、tailnet 上の任意のデバイスから `ssh openclaw` 経由で接続できます。パブリック IP は不要です。

確認:

```bash
tailscale status
```

**今後は Tailscale 経由で接続してください:** `ssh ubuntu@openclaw`（または Tailscale IP を使用します）。

## 5) OpenClaw のインストール

```bash
curl -fsSL https://openclaw.ai/install.sh | bash
source ~/.bashrc
```

「How do you want to hatch your bot?」と表示されたら、**「Do this later」** を選択します。

> 注: ARM ネイティブのビルドで問題が発生した場合は、Homebrew を使う前に、まずシステムパッケージ（例: `sudo apt install -y build-essential`）を試してください。

## 6) Gateway（ループバック + トークン認証）の設定と Tailscale Serve の有効化

デフォルトとしてトークン認証を使用します。予測可能で、「insecure auth」の Control UI フラグを有効にする必要がありません。

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

## 7) 確認

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

## 8) VCN セキュリティのロックダウン

すべてが正常に動作していることを確認したら、Tailscale 以外のすべてのトラフィックをブロックするように VCN をロックダウンします。OCI の Virtual Cloud Network はネットワークエッジでファイアウォールとして機能し、トラフィックはインスタンスに到達する前にブロックされます。

1. OCI コンソールで **Networking → Virtual Cloud Networks** に移動します
2. 使用中の VCN → **Security Lists** → Default Security List をクリックします
3. 以下を除き、すべてのインバウンドルールを **削除** します。
   - `0.0.0.0/0 UDP 41641`（Tailscale）
4. デフォルトのアウトバウンドルール（すべて許可）はそのままにします

これにより、ポート 22 の SSH、HTTP、HTTPS、その他すべてがネットワークエッジでブロックされます。今後は Tailscale 経由でのみ接続可能です。

---

## Control UI へのアクセス

Tailscale ネットワーク上の任意のデバイスから:

```
https://openclaw.<tailnet-name>.ts.net/
```

`<tailnet-name>` を、あなたの tailnet 名（`tailscale status` に表示されます）に置き換えてください。

SSH トンネルは不要です。Tailscale は次を提供します。

- HTTPS 暗号化（自動証明書）
- Tailscale アイデンティティによる認証
- tailnet 上の任意のデバイス（ノート PC、スマートフォンなど）からのアクセス

---

## セキュリティ: VCN + Tailscale（推奨ベースライン）

VCN をロックダウン（UDP 41641 のみ開放）し、Gateway（ゲートウェイ）を loopback にバインドすることで、強力な多層防御が実現します。パブリックトラフィックはネットワークエッジで遮断され、管理アクセスは tailnet 経由で行われます。

この構成では、インターネット全体からの SSH ブルートフォースを防ぐ目的だけで、追加のホストベースファイアウォールルールが _不要_ になる場合が多いです。ただし、OS を最新の状態に保ち、`openclaw security audit` を実行し、誤ってパブリックインターフェースで待ち受けていないことを確認してください。

### すでに保護されているもの

| 従来の対策           | 必要？     | 理由                                                                                 |
| -------------------- | ---------- | ------------------------------------------------------------------------------------ |
| UFW ファイアウォール | 不要       | VCN がインスタンス到達前にブロックします                                             |
| fail2ban             | 不要       | VCN でポート 22 がブロックされていればブルートフォースは発生しません                 |
| sshd のハードニング  | 不要       | Tailscale SSH は sshd を使用しません                                                 |
| root ログイン無効化  | 不要       | Tailscale はシステムユーザーではなく Tailscale アイデンティティを使用します          |
| SSH 鍵のみの認証     | 不要       | Tailscale は tailnet 経由で認証します                                                |
| IPv6 のハードニング  | 通常は不要 | VCN/サブネット設定に依存します。実際に何が割り当て・公開されているか確認してください |

### 引き続き推奨される項目

- **認証情報の権限管理:** `chmod 700 ~/.openclaw`
- **セキュリティ監査:** `openclaw security audit`
- **システム更新:** 定期的に `sudo apt update && sudo apt upgrade`
- **Tailscale の監視:** [Tailscale admin console](https://login.tailscale.com/admin) でデバイスを確認

### セキュリティ状態の確認

```bash
# Confirm no public ports listening
sudo ss -tlnp | grep -v '127.0.0.1\|::1'

# Verify Tailscale SSH is active
tailscale status | grep -q 'offers: ssh' && echo "Tailscale SSH active"

# Optional: disable sshd entirely
sudo systemctl disable --now ssh
```

---

## フォールバック: SSH トンネル

Tailscale Serve が動作しない場合は、SSH トンネルを使用します。

```bash
# From your local machine (via Tailscale)
ssh -L 18789:127.0.0.1:18789 ubuntu@openclaw
```

その後、`http://localhost:18789` を開きます。

---

## トラブルシューティング

### インスタンス作成に失敗する（「Out of capacity」）

無料ティアの ARM インスタンスは人気があります。次を試してください。

- 別の可用性ドメインを使用する
- オフピーク時間（早朝など）に再試行する
- シェイプ選択時に「Always Free」フィルターを使用する

### Tailscale が接続できない

```bash
# Check status
sudo tailscale status

# Re-authenticate
sudo tailscale up --ssh --hostname=openclaw --reset
```

### Gateway（ゲートウェイ）が起動しない

```bash
openclaw gateway status
openclaw doctor --non-interactive
journalctl --user -u openclaw-gateway -n 50
```

### Control UI にアクセスできない

```bash
# Verify Tailscale Serve is running
tailscale serve status

# Check gateway is listening
curl http://localhost:18789

# Restart if needed
systemctl --user restart openclaw-gateway
```

### ARM バイナリの問題

一部のツールには ARM ビルドがない場合があります。次を確認してください。

```bash
uname -m  # Should show aarch64
```

ほとんどの npm パッケージは問題なく動作します。バイナリについては、`linux-arm64` または `aarch64` のリリースを探してください。

---

## 永続化

すべての状態は次に保存されます。

- `~/.openclaw/` — 設定、認証情報、セッションデータ
- `~/.openclaw/workspace/` — ワークスペース（SOUL.md、メモリ、アーティファクト）

定期的にバックアップしてください。

```bash
tar -czvf openclaw-backup.tar.gz ~/.openclaw ~/.openclaw/workspace
```

---

## 関連項目

- [Gateway remote access](/gateway/remote) — 他のリモートアクセスパターン
- [Tailscale integration](/gateway/tailscale) — Tailscale の完全なドキュメント
- [Gateway configuration](/gateway/configuration) — すべての設定オプション
- [DigitalOcean guide](/platforms/digitalocean) — 有料だがサインアップが簡単
- [Hetzner guide](/install/hetzner) — Docker ベースの代替案
