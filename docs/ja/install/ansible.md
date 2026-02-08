---
summary: 「Ansible、Tailscale VPN、ファイアウォール分離による自動化・強化された OpenClaw インストール」
read_when:
  - セキュリティ強化を伴う自動サーバーデプロイを行いたい場合
  - VPN アクセス付きのファイアウォール分離構成が必要な場合
  - リモートの Debian / Ubuntu サーバーにデプロイする場合
title: 「Ansible」
x-i18n:
  source_path: install/ansible.md
  source_hash: 896807f344d923f0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:09Z
---

# Ansible インストール

本番サーバーに OpenClaw をデプロイする推奨方法は、**[openclaw-ansible](https://github.com/openclaw/openclaw-ansible)** を利用することです。これは、セキュリティを最優先に設計された自動インストーラーです。

## クイックスタート

ワンコマンドでインストールできます。

```bash
curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw-ansible/main/install.sh | bash
```

> **📦 完全ガイド: [github.com/openclaw/openclaw-ansible](https://github.com/openclaw/openclaw-ansible)**
>
> openclaw-ansible リポジトリは、Ansible デプロイに関する正本です。このページは概要のみを示しています。

## 得られるもの

- 🔒 **ファイアウォール最優先のセキュリティ**: UFW + Docker 分離（SSH + Tailscale のみアクセス可能）
- 🔐 **Tailscale VPN**: サービスを公開せずに安全なリモートアクセス
- 🐳 **Docker**: 分離されたサンドボックスコンテナ、localhost のみのバインディング
- 🛡️ **多層防御**: 4 層のセキュリティアーキテクチャ
- 🚀 **ワンコマンドセットアップ**: 数分で完全なデプロイが完了
- 🔧 **Systemd 統合**: セキュリティ強化付きで起動時に自動起動

## 要件

- **OS**: Debian 11 以上、または Ubuntu 20.04 以上
- **アクセス権**: root または sudo 権限
- **ネットワーク**: パッケージインストールのためのインターネット接続
- **Ansible**: 2.14 以上（クイックスタートスクリプトにより自動インストール）

## インストールされる内容

Ansible プレイブックは以下をインストールおよび設定します。

1. **Tailscale**（安全なリモートアクセスのためのメッシュ VPN）
2. **UFW ファイアウォール**（SSH + Tailscale ポートのみ許可）
3. **Docker CE + Compose V2**（エージェントサンドボックス用）
4. **Node.js 22.x + pnpm**（ランタイム依存関係）
5. **OpenClaw**（ホスト上で実行、コンテナ化なし）
6. **Systemd サービス**（セキュリティ強化付き自動起動）

注意: Gateway（ゲートウェイ）は **ホスト上で直接実行** されます（Docker 内ではありません）。一方、エージェントのサンドボックスは分離のために Docker を使用します。詳細は [Sandboxing](/gateway/sandboxing) を参照してください。

## インストール後のセットアップ

インストール完了後、openclaw ユーザーに切り替えます。

```bash
sudo -i -u openclaw
```

インストール後スクリプトでは、以下が案内されます。

1. **オンボーディングウィザード**: OpenClaw 設定の構成
2. **プロバイダーログイン**: WhatsApp / Telegram / Discord / Signal の接続
3. **Gateway（ゲートウェイ）のテスト**: インストールの検証
4. **Tailscale 設定**: VPN メッシュへの接続

### クイックコマンド

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

## セキュリティアーキテクチャ

### 4 層防御

1. **ファイアウォール（UFW）**: 公開されるのは SSH（22）と Tailscale（41641/udp）のみ
2. **VPN（Tailscale）**: Gateway（ゲートウェイ）は VPN メッシュ経由でのみアクセス可能
3. **Docker 分離**: DOCKER-USER の iptables チェーンにより外部ポート公開を防止
4. **Systemd 強化**: NoNewPrivileges、PrivateTmp、非特権ユーザー

### 検証

外部からの攻撃対象領域をテストします。

```bash
nmap -p- YOUR_SERVER_IP
```

**ポート 22**（SSH）のみが表示されるはずです。その他のすべてのサービス（Gateway（ゲートウェイ）、Docker）はロックダウンされています。

### Docker の利用範囲

Docker は **エージェントサンドボックス**（分離されたツール実行）のためにインストールされます。Gateway（ゲートウェイ）自体の実行には使用されません。Gateway（ゲートウェイ）は localhost のみにバインドされ、Tailscale VPN 経由でアクセスされます。

サンドボックス設定については、[Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) を参照してください。

## 手動インストール

自動化ではなく手動で制御したい場合は、以下を使用してください。

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

## OpenClaw の更新

Ansible インストーラーは、OpenClaw を手動更新できるように設定します。標準的な更新手順については、[Updating](/install/updating) を参照してください。

設定変更などのために Ansible プレイブックを再実行する場合は、以下を使用します。

```bash
cd openclaw-ansible
./run-playbook.sh
```

注意: これは冪等であり、複数回実行しても安全です。

## トラブルシューティング

### ファイアウォールにより接続がブロックされる

接続できなくなった場合は、以下を確認してください。

- まず Tailscale VPN 経由でアクセスできることを確認してください
- SSH アクセス（ポート 22）は常に許可されています
- Gateway（ゲートウェイ）は設計上、**Tailscale 経由でのみ** アクセス可能です

### サービスが起動しない

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

### Docker サンドボックスの問題

```bash
# Verify Docker is running
sudo systemctl status docker

# Check sandbox image
sudo docker images | grep openclaw-sandbox

# Build sandbox image if missing
cd /opt/openclaw/openclaw
sudo -u openclaw ./scripts/sandbox-setup.sh
```

### プロバイダーログインに失敗する

`openclaw` ユーザーで実行していることを確認してください。

```bash
sudo -i -u openclaw
openclaw channels login
```

## 高度な設定

詳細なセキュリティアーキテクチャおよびトラブルシューティングについては、以下を参照してください。

- [Security Architecture](https://github.com/openclaw/openclaw-ansible/blob/main/docs/security.md)
- [Technical Details](https://github.com/openclaw/openclaw-ansible/blob/main/docs/architecture.md)
- [Troubleshooting Guide](https://github.com/openclaw/openclaw-ansible/blob/main/docs/troubleshooting.md)

## 関連情報

- [openclaw-ansible](https://github.com/openclaw/openclaw-ansible) — 完全なデプロイガイド
- [Docker](/install/docker) — コンテナ化された Gateway（ゲートウェイ）セットアップ
- [Sandboxing](/gateway/sandboxing) — エージェントサンドボックス設定
- [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) — エージェントごとの分離設定
