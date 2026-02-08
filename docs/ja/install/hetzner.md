---
summary: 「永続的な状態と組み込みバイナリを備え、安価な Hetzner VPS（Docker）で OpenClaw Gateway を 24/7 稼働させます」
read_when:
  - クラウド VPS（自分のラップトップではない）で OpenClaw を 24/7 稼働させたい場合
  - 自分の VPS 上で、本番運用レベルの常時稼働 Gateway（ゲートウェイ）を使いたい場合
  - 永続化、バイナリ、再起動時の挙動を完全に制御したい場合
  - Hetzner または同様のプロバイダーで Docker 上に OpenClaw を実行している場合
title: 「Hetzner」
x-i18n:
  source_path: install/hetzner.md
  source_hash: 84d9f24f1a803aa1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:10Z
---

# Hetzner 上の OpenClaw（Docker、本番 VPS ガイド）

## 目的

耐久性のある状態、組み込みバイナリ、安全な再起動挙動を備えた永続的な OpenClaw Gateway（ゲートウェイ）を、Docker を使用して Hetzner VPS 上で実行します。

「約 $5 で OpenClaw を 24/7 稼働させたい」場合、これが最もシンプルで信頼性の高い構成です。  
Hetzner の価格は変更される可能性があります。最小の Debian/Ubuntu VPS を選び、OOM が発生したらスケールアップしてください。

## 何をするのか（簡単に）

- 小規模な Linux サーバー（Hetzner VPS）をレンタルします
- Docker（分離されたアプリ実行環境）をインストールします
- OpenClaw Gateway（ゲートウェイ）を Docker で起動します
- ホスト上に `~/.openclaw` + `~/.openclaw/workspace` を永続化します（再起動や再ビルド後も維持されます）
- SSH トンネル経由でラップトップから Control UI にアクセスします

Gateway（ゲートウェイ）へのアクセス方法は次のとおりです。

- ラップトップからの SSH ポートフォワーディング
- ファイアウォールとトークン管理を自分で行う場合は、ポートを直接公開

このガイドは、Hetzner 上の Ubuntu または Debian を前提としています。  
別の Linux VPS を使用している場合は、パッケージを適宜読み替えてください。  
汎用的な Docker のフローについては、[Docker](/install/docker) を参照してください。

---

## クイックパス（経験豊富なオペレーター向け）

1. Hetzner VPS をプロビジョニング
2. Docker をインストール
3. OpenClaw リポジトリをクローン
4. 永続的なホストディレクトリを作成
5. `.env` と `docker-compose.yml` を設定
6. 必要なバイナリをイメージに組み込み
7. `docker compose up -d`
8. 永続性と Gateway（ゲートウェイ）へのアクセスを確認

---

## 必要なもの

- root アクセス可能な Hetzner VPS
- ラップトップからの SSH アクセス
- SSH とコピー＆ペーストの基本的な操作に慣れていること
- 約 20 分
- Docker および Docker Compose
- モデル認証情報
- 任意のプロバイダー認証情報
  - WhatsApp QR
  - Telegram bot トークン
  - Gmail OAuth

---

## 1) VPS のプロビジョニング

Hetzner で Ubuntu または Debian の VPS を作成します。

root として接続します。

```bash
ssh root@YOUR_VPS_IP
```

このガイドでは、VPS がステートフルであることを前提としています。  
使い捨てインフラとして扱わないでください。

---

## 2) Docker のインストール（VPS 上）

```bash
apt-get update
apt-get install -y git curl ca-certificates
curl -fsSL https://get.docker.com | sh
```

確認します。

```bash
docker --version
docker compose version
```

---

## 3) OpenClaw リポジトリをクローン

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
```

このガイドでは、バイナリの永続性を保証するためにカスタムイメージをビルドすることを前提としています。

---

## 4) 永続的なホストディレクトリの作成

Docker コンテナはエフェメラルです。  
すべての長期的な状態はホスト上に存在する必要があります。

```bash
mkdir -p /root/.openclaw
mkdir -p /root/.openclaw/workspace

# Set ownership to the container user (uid 1000):
chown -R 1000:1000 /root/.openclaw
chown -R 1000:1000 /root/.openclaw/workspace
```

---

## 5) 環境変数の設定

リポジトリのルートに `.env` を作成します。

```bash
OPENCLAW_IMAGE=openclaw:latest
OPENCLAW_GATEWAY_TOKEN=change-me-now
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_GATEWAY_PORT=18789

OPENCLAW_CONFIG_DIR=/root/.openclaw
OPENCLAW_WORKSPACE_DIR=/root/.openclaw/workspace

GOG_KEYRING_PASSWORD=change-me-now
XDG_CONFIG_HOME=/home/node/.openclaw
```

強力なシークレットを生成します。

```bash
openssl rand -hex 32
```

**このファイルをコミットしないでください。**

---

## 6) Docker Compose の設定

`docker-compose.yml` を作成または更新します。

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
      # Recommended: keep the Gateway loopback-only on the VPS; access via SSH tunnel.
      # To expose it publicly, remove the `127.0.0.1:` prefix and firewall accordingly.
      - "127.0.0.1:${OPENCLAW_GATEWAY_PORT}:18789"

      # Optional: only if you run iOS/Android nodes against this VPS and need Canvas host.
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

## 7) 必要なバイナリをイメージに組み込む（重要）

実行中のコンテナ内でバイナリをインストールするのは罠です。  
実行時にインストールされたものは、再起動時にすべて失われます。

Skills に必要な外部バイナリは、すべてイメージのビルド時にインストールする必要があります。

以下の例では、一般的な 3 つのバイナリのみを示しています。

- Gmail アクセス用の `gog`
- Google Places 用の `goplaces`
- WhatsApp 用の `wacli`

これらは例であり、完全な一覧ではありません。  
同じパターンを使用して、必要なだけバイナリをインストールできます。

後から追加のバイナリに依存する新しい Skills を追加した場合は、次を行う必要があります。

1. Dockerfile を更新
2. イメージを再ビルド
3. コンテナを再起動

**Dockerfile の例**

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

## 8) ビルドと起動

```bash
docker compose build
docker compose up -d openclaw-gateway
```

バイナリを確認します。

```bash
docker compose exec openclaw-gateway which gog
docker compose exec openclaw-gateway which goplaces
docker compose exec openclaw-gateway which wacli
```

期待される出力。

```
/usr/local/bin/gog
/usr/local/bin/goplaces
/usr/local/bin/wacli
```

---

## 9) Gateway（ゲートウェイ）の確認

```bash
docker compose logs -f openclaw-gateway
```

成功時。

```
[gateway] listening on ws://0.0.0.0:18789
```

ラップトップから。

```bash
ssh -N -L 18789:127.0.0.1:18789 root@YOUR_VPS_IP
```

開きます。

`http://127.0.0.1:18789/`

Gateway（ゲートウェイ）トークンを貼り付けてください。

---

## どこに何が永続化されるか（信頼できる情報源）

OpenClaw は Docker 上で実行されますが、Docker 自体は信頼できる情報源ではありません。  
すべての長期的な状態は、再起動、再ビルド、再起動（reboot）後も維持される必要があります。

| コンポーネント             | 場所                              | 永続化の仕組み                | 備考                            |
| -------------------------- | --------------------------------- | ----------------------------- | ------------------------------- |
| Gateway 設定               | `/home/node/.openclaw/`           | ホストボリュームマウント      | `openclaw.json`、トークンを含む |
| モデル認証プロファイル     | `/home/node/.openclaw/`           | ホストボリュームマウント      | OAuth トークン、API キー        |
| Skill 設定                 | `/home/node/.openclaw/skills/`    | ホストボリュームマウント      | Skill レベルの状態              |
| エージェントワークスペース | `/home/node/.openclaw/workspace/` | ホストボリュームマウント      | コードおよびエージェント成果物  |
| WhatsApp セッション        | `/home/node/.openclaw/`           | ホストボリュームマウント      | QR ログインを保持               |
| Gmail キーリング           | `/home/node/.openclaw/`           | ホストボリューム + パスワード | `GOG_KEYRING_PASSWORD` が必要   |
| 外部バイナリ               | `/usr/local/bin/`                 | Docker イメージ               | ビルド時に組み込む必要あり      |
| Node ランタイム            | コンテナファイルシステム          | Docker イメージ               | 各イメージビルドごとに再構築    |
| OS パッケージ              | コンテナファイルシステム          | Docker イメージ               | 実行時にインストールしない      |
| Docker コンテナ            | エフェメラル                      | 再起動可能                    | 破棄しても安全                  |
