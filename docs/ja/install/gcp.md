---
summary: 「耐久性のある状態を備え、Docker で GCP Compute Engine VM 上に OpenClaw Gateway を 24/7 で実行します」
read_when:
  - GCP 上で OpenClaw を 24/7 稼働させたい場合
  - 自分の VM 上で本番運用レベルの常時稼働 Gateway（ゲートウェイ）が必要な場合
  - 永続化、バイナリ、再起動挙動を完全に制御したい場合
title: 「GCP」
x-i18n:
  source_path: install/gcp.md
  source_hash: abb236dd421505d3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:17Z
---

# GCP Compute Engine 上の OpenClaw（Docker・本番 VPS ガイド）

## 目的

Docker を使用して、GCP Compute Engine VM 上で永続的な OpenClaw Gateway（ゲートウェイ）を実行します。耐久性のある状態、組み込み済みバイナリ、安全な再起動挙動を備えます。

「月額およそ $5～12 で OpenClaw を 24/7 稼働させたい」場合、この構成は Google Cloud 上で信頼性の高いセットアップです。  
料金はマシンタイプとリージョンによって異なります。まずはワークロードに合う最小の VM を選択し、OOM が発生した場合にスケールアップしてください。

## 何をするのか（簡単に）

- GCP プロジェクトを作成し、課金を有効化
- Compute Engine VM を作成
- Docker をインストール（分離されたアプリ実行環境）
- Docker で OpenClaw Gateway（ゲートウェイ）を起動
- ホスト上に `~/.openclaw` と `~/.openclaw/workspace` を永続化（再起動・再ビルド後も保持）
- SSH トンネル経由でノート PC から Control UI にアクセス

Gateway（ゲートウェイ）へのアクセス方法:

- ノート PC からの SSH ポートフォワーディング
- ファイアウォールとトークンを自分で管理する場合の直接ポート公開

このガイドでは、GCP Compute Engine 上の Debian を使用します。  
Ubuntu でも動作しますが、パッケージは適宜読み替えてください。  
汎用的な Docker フローについては [Docker](/install/docker) を参照してください。

---

## クイックパス（経験者向け）

1. GCP プロジェクトを作成し、Compute Engine API を有効化
2. Compute Engine VM を作成（e2-small、Debian 12、20GB）
3. VM に SSH 接続
4. Docker をインストール
5. OpenClaw リポジトリをクローン
6. 永続ホストディレクトリを作成
7. `.env` と `docker-compose.yml` を設定
8. 必要なバイナリを組み込み、ビルドして起動

---

## 必要なもの

- GCP アカウント（e2-micro は無料枠対象）
- gcloud CLI（または Cloud Console）
- ノート PC からの SSH アクセス
- SSH とコピー＆ペーストの基本操作
- 約 20～30 分
- Docker と Docker Compose
- モデル認証情報
- 任意のプロバイダー認証情報
  - WhatsApp QR
  - Telegram ボットトークン
  - Gmail OAuth

---

## 1) gcloud CLI をインストール（または Console を使用）

**オプション A: gcloud CLI**（自動化に推奨）

https://cloud.google.com/sdk/docs/install からインストールします。

初期化と認証を行います:

```bash
gcloud init
gcloud auth login
```

**オプション B: Cloud Console**

すべての手順は https://console.cloud.google.com の Web UI から実行できます。

---

## 2) GCP プロジェクトを作成

**CLI:**

```bash
gcloud projects create my-openclaw-project --name="OpenClaw Gateway"
gcloud config set project my-openclaw-project
```

https://console.cloud.google.com/billing で課金を有効化します（Compute Engine に必須）。

Compute Engine API を有効化します:

```bash
gcloud services enable compute.googleapis.com
```

**Console:**

1. 「IAM と管理」>「プロジェクトを作成」へ移動
2. 名前を付けて作成
3. プロジェクトの課金を有効化
4. 「API とサービス」>「API を有効にする」>「Compute Engine API」を検索して有効化

---

## 3) VM を作成

**マシンタイプ:**

| タイプ   | スペック                | コスト     | メモ                  |
| -------- | ----------------------- | ---------- | --------------------- |
| e2-small | 2 vCPU, 2GB RAM         | 約 $12/月  | 推奨                  |
| e2-micro | 2 vCPU（共有）, 1GB RAM | 無料枠対象 | 負荷時に OOM の可能性 |

**CLI:**

```bash
gcloud compute instances create openclaw-gateway \
  --zone=us-central1-a \
  --machine-type=e2-small \
  --boot-disk-size=20GB \
  --image-family=debian-12 \
  --image-project=debian-cloud
```

**Console:**

1. Compute Engine > VM インスタンス > インスタンスを作成
2. 名前: `openclaw-gateway`
3. リージョン: `us-central1`、ゾーン: `us-central1-a`
4. マシンタイプ: `e2-small`
5. ブートディスク: Debian 12、20GB
6. 作成

---

## 4) VM に SSH 接続

**CLI:**

```bash
gcloud compute ssh openclaw-gateway --zone=us-central1-a
```

**Console:**

Compute Engine ダッシュボードで VM の横にある「SSH」ボタンをクリックします。

注意: VM 作成後、SSH キーの伝播に 1～2 分かかることがあります。接続が拒否された場合は、少し待ってから再試行してください。

---

## 5) Docker をインストール（VM 上）

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

グループ変更を反映させるため、一度ログアウトして再ログインします:

```bash
exit
```

その後、再度 SSH 接続します:

```bash
gcloud compute ssh openclaw-gateway --zone=us-central1-a
```

確認:

```bash
docker --version
docker compose version
```

---

## 6) OpenClaw リポジトリをクローン

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
```

このガイドでは、バイナリの永続性を保証するためにカスタムイメージをビルドする前提です。

---

## 7) 永続ホストディレクトリを作成

Docker コンテナは一時的です。  
すべての長期的な状態はホスト上に置く必要があります。

```bash
mkdir -p ~/.openclaw
mkdir -p ~/.openclaw/workspace
```

---

## 8) 環境変数を設定

リポジトリルートに `.env` を作成します。

```bash
OPENCLAW_IMAGE=openclaw:latest
OPENCLAW_GATEWAY_TOKEN=change-me-now
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_GATEWAY_PORT=18789

OPENCLAW_CONFIG_DIR=/home/$USER/.openclaw
OPENCLAW_WORKSPACE_DIR=/home/$USER/.openclaw/workspace

GOG_KEYRING_PASSWORD=change-me-now
XDG_CONFIG_HOME=/home/node/.openclaw
```

強力なシークレットを生成します:

```bash
openssl rand -hex 32
```

**このファイルはコミットしないでください。**

---

## 9) Docker Compose 設定

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
      # Recommended: keep the Gateway loopback-only on the VM; access via SSH tunnel.
      # To expose it publicly, remove the `127.0.0.1:` prefix and firewall accordingly.
      - "127.0.0.1:${OPENCLAW_GATEWAY_PORT}:18789"

      # Optional: only if you run iOS/Android nodes against this VM and need Canvas host.
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

## 10) 必要なバイナリをイメージに組み込む（重要）

実行中のコンテナ内にバイナリをインストールするのは避けてください。  
実行時にインストールされたものは、再起動時に失われます。

Skills が必要とするすべての外部バイナリは、イメージのビルド時にインストールする必要があります。

以下の例では、一般的な 3 つのバイナリのみを示しています:

- Gmail アクセス用の `gog`
- Google Places 用の `goplaces`
- WhatsApp 用の `wacli`

これらは例であり、完全な一覧ではありません。  
同じパターンで、必要な数だけバイナリをインストールできます。

後から追加のバイナリに依存する新しい Skills を追加した場合は、以下が必要です:

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

## 11) ビルドと起動

```bash
docker compose build
docker compose up -d openclaw-gateway
```

バイナリを確認します:

```bash
docker compose exec openclaw-gateway which gog
docker compose exec openclaw-gateway which goplaces
docker compose exec openclaw-gateway which wacli
```

期待される出力:

```
/usr/local/bin/gog
/usr/local/bin/goplaces
/usr/local/bin/wacli
```

---

## 12) Gateway（ゲートウェイ）を確認

```bash
docker compose logs -f openclaw-gateway
```

成功時:

```
[gateway] listening on ws://0.0.0.0:18789
```

---

## 13) ノート PC からアクセス

Gateway（ゲートウェイ）のポートを転送する SSH トンネルを作成します:

```bash
gcloud compute ssh openclaw-gateway --zone=us-central1-a -- -L 18789:127.0.0.1:18789
```

ブラウザで開きます:

`http://127.0.0.1:18789/`

Gateway トークンを貼り付けてください。

---

## どこに何が永続化されるか（正の情報源）

OpenClaw は Docker で動作しますが、Docker 自体は正の情報源ではありません。  
すべての長期的な状態は、再起動・再ビルド・再起動後も生き残る必要があります。

| コンポーネント         | 場所                              | 永続化方式                    | メモ                            |
| ---------------------- | --------------------------------- | ----------------------------- | ------------------------------- |
| Gateway 設定           | `/home/node/.openclaw/`           | ホストボリューム              | `openclaw.json`、トークンを含む |
| モデル認証プロファイル | `/home/node/.openclaw/`           | ホストボリューム              | OAuth トークン、API キー        |
| Skill 設定             | `/home/node/.openclaw/skills/`    | ホストボリューム              | Skill レベルの状態              |
| エージェント作業領域   | `/home/node/.openclaw/workspace/` | ホストボリューム              | コードとエージェント成果物      |
| WhatsApp セッション    | `/home/node/.openclaw/`           | ホストボリューム              | QR ログインを保持               |
| Gmail キーリング       | `/home/node/.openclaw/`           | ホストボリューム + パスワード | `GOG_KEYRING_PASSWORD` が必要   |
| 外部バイナリ           | `/usr/local/bin/`                 | Docker イメージ               | ビルド時に組み込む必要あり      |
| Node ランタイム        | コンテナファイルシステム          | Docker イメージ               | イメージビルドごとに再構築      |
| OS パッケージ          | コンテナファイルシステム          | Docker イメージ               | 実行時にインストールしない      |
| Docker コンテナ        | 一時的                            | 再起動可能                    | 破棄しても安全                  |

---

## 更新

VM 上の OpenClaw を更新するには:

```bash
cd ~/openclaw
git pull
docker compose build
docker compose up -d
```

---

## トラブルシューティング

**SSH 接続が拒否される**

VM 作成後、SSH キーの伝播に 1～2 分かかることがあります。待ってから再試行してください。

**OS Login の問題**

OS Login プロファイルを確認してください:

```bash
gcloud compute os-login describe-profile
```

アカウントに必要な IAM 権限（Compute OS Login または Compute OS Admin Login）が付与されていることを確認します。

**メモリ不足（OOM）**

e2-micro を使用していて OOM が発生する場合は、e2-small または e2-medium にアップグレードしてください:

```bash
# Stop the VM first
gcloud compute instances stop openclaw-gateway --zone=us-central1-a

# Change machine type
gcloud compute instances set-machine-type openclaw-gateway \
  --zone=us-central1-a \
  --machine-type=e2-small

# Start the VM
gcloud compute instances start openclaw-gateway --zone=us-central1-a
```

---

## サービスアカウント（セキュリティのベストプラクティス）

個人利用であれば、デフォルトのユーザーアカウントで問題ありません。

自動化や CI/CD パイプラインの場合は、最小権限の専用サービスアカウントを作成してください。

1. サービスアカウントを作成:

   ```bash
   gcloud iam service-accounts create openclaw-deploy \
     --display-name="OpenClaw Deployment"
   ```

2. Compute Instance Admin ロール（または、より狭いカスタムロール）を付与:
   ```bash
   gcloud projects add-iam-policy-binding my-openclaw-project \
     --member="serviceAccount:openclaw-deploy@my-openclaw-project.iam.gserviceaccount.com" \
     --role="roles/compute.instanceAdmin.v1"
   ```

自動化に Owner ロールを使用するのは避けてください。最小権限の原則に従ってください。

IAM ロールの詳細については https://cloud.google.com/iam/docs/understanding-roles を参照してください。

---

## 次のステップ

- メッセージングチャンネルを設定: [Channels](/channels)
- ローカルデバイスをノードとしてペアリング: [Nodes](/nodes)
- Gateway（ゲートウェイ）を設定: [Gateway configuration](/gateway/configuration)
