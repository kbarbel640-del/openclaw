---
summary: "OpenClaw 向けの任意の Docker ベースのセットアップとオンボーディング"
read_when:
  - ローカルインストールではなくコンテナ化されたゲートウェイを使用したい場合
  - Docker フローを検証している場合
title: "Docker"
x-i18n:
  source_path: install/docker.md
  source_hash: 021ec5aa78e1a6eb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:39Z
---

# Docker（任意）

Docker は**任意**です。コンテナ化された Gateway（ゲートウェイ）を使いたい場合、または Docker フローを検証したい場合にのみ使用してください。

## Docker は自分に向いていますか？

- **はい**：分離された使い捨ての Gateway（ゲートウェイ）環境が欲しい、またはローカルインストールなしで OpenClaw をホスト上で実行したい場合。
- **いいえ**：自分のマシンで実行し、最速の開発ループが欲しい場合。通常のインストールフローを使用してください。
- **サンドボックス化の注意**：エージェントのサンドボックス化でも Docker を使用しますが、Gateway（ゲートウェイ）全体を Docker で実行する必要は**ありません**。詳しくは [Sandboxing](/gateway/sandboxing) を参照してください。

このガイドで扱う内容：

- コンテナ化された Gateway（ゲートウェイ）（Docker 内での OpenClaw フル実行）
- セッションごとのエージェントサンドボックス（ホスト上の Gateway（ゲートウェイ）＋ Docker で分離されたエージェントツール）

サンドボックス化の詳細：[Sandboxing](/gateway/sandboxing)

## 要件

- Docker Desktop（または Docker Engine）＋ Docker Compose v2
- イメージ＋ログ用の十分なディスク容量

## コンテナ化された Gateway（ゲートウェイ）（Docker Compose）

### クイックスタート（推奨）

リポジトリのルートから：

```bash
./docker-setup.sh
```

このスクリプトは次を実行します：

- Gateway（ゲートウェイ）イメージをビルド
- オンボーディングウィザードを実行
- 任意のプロバイダー設定ヒントを表示
- Docker Compose で Gateway（ゲートウェイ）を起動
- Gateway（ゲートウェイ）トークンを生成し、`.env` に書き込み

任意の環境変数：

- `OPENCLAW_DOCKER_APT_PACKAGES` — ビルド時に追加の apt パッケージをインストール
- `OPENCLAW_EXTRA_MOUNTS` — 追加のホストバインドマウントを追加
- `OPENCLAW_HOME_VOLUME` — `/home/node` を名前付きボリュームに永続化

完了後：

- ブラウザで `http://127.0.0.1:18789/` を開きます。
- Control UI（設定 → トークン）にトークンを貼り付けます。
- URL を再表示する必要がありますか？`docker compose run --rm openclaw-cli dashboard --no-open` を実行してください。

ホスト上に設定／ワークスペースを書き込みます：

- `~/.openclaw/`
- `~/.openclaw/workspace`

VPS 上で実行していますか？[Hetzner（Docker VPS）](/install/hetzner) を参照してください。

### 手動フロー（compose）

```bash
docker build -t openclaw:local -f Dockerfile .
docker compose run --rm openclaw-cli onboard
docker compose up -d openclaw-gateway
```

注意：リポジトリのルートから `docker compose ...` を実行してください。  
`OPENCLAW_EXTRA_MOUNTS` または `OPENCLAW_HOME_VOLUME` を有効にした場合、セットアップスクリプトは
`docker-compose.extra.yml` を書き込みます。別の場所で Compose を実行する際はこれを含めてください：

```bash
docker compose -f docker-compose.yml -f docker-compose.extra.yml <command>
```

### Control UI のトークン＋ペアリング（Docker）

「unauthorized」または「disconnected（1008）：pairing required」と表示された場合は、
新しいダッシュボードリンクを取得し、ブラウザデバイスを承認してください：

```bash
docker compose run --rm openclaw-cli dashboard --no-open
docker compose run --rm openclaw-cli devices list
docker compose run --rm openclaw-cli devices approve <requestId>
```

詳細：[Dashboard](/web/dashboard)、[Devices](/cli/devices)。

### 追加マウント（任意）

追加のホストディレクトリをコンテナにマウントしたい場合は、
`docker-setup.sh` を実行する前に `OPENCLAW_EXTRA_MOUNTS` を設定してください。  
これは Docker のバインドマウントをカンマ区切りで受け取り、
`openclaw-gateway` と `openclaw-cli` の両方に適用するために
`docker-compose.extra.yml` を生成します。

例：

```bash
export OPENCLAW_EXTRA_MOUNTS="$HOME/.codex:/home/node/.codex:ro,$HOME/github:/home/node/github:rw"
./docker-setup.sh
```

注意：

- macOS／Windows では、パスを Docker Desktop と共有している必要があります。
- `OPENCLAW_EXTRA_MOUNTS` を編集した場合は、`docker-setup.sh` を再実行して
  追加の compose ファイルを再生成してください。
- `docker-compose.extra.yml` は生成物です。手動で編集しないでください。

### コンテナのホーム全体を永続化（任意）

`/home/node` をコンテナ再作成後も保持したい場合は、
`OPENCLAW_HOME_VOLUME` で名前付きボリュームを設定してください。  
これにより Docker ボリュームが作成され、`/home/node` にマウントされます。
標準の設定／ワークスペースのバインドマウントは維持されます。  
ここでは名前付きボリューム（バインドパスではない）を使用してください。  
バインドマウントの場合は `OPENCLAW_EXTRA_MOUNTS` を使用します。

例：

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
./docker-setup.sh
```

追加マウントと組み合わせることもできます：

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
export OPENCLAW_EXTRA_MOUNTS="$HOME/.codex:/home/node/.codex:ro,$HOME/github:/home/node/github:rw"
./docker-setup.sh
```

注意：

- `OPENCLAW_HOME_VOLUME` を変更した場合は、`docker-setup.sh` を再実行して
  追加の compose ファイルを再生成してください。
- 名前付きボリュームは `docker volume rm <name>` で削除されるまで保持されます。

### 追加の apt パッケージをインストール（任意）

イメージ内でシステムパッケージ（例：ビルドツールやメディアライブラリ）が必要な場合は、
`docker-setup.sh` を実行する前に `OPENCLAW_DOCKER_APT_PACKAGES` を設定してください。  
これらはイメージビルド時にインストールされるため、コンテナを削除しても保持されます。

例：

```bash
export OPENCLAW_DOCKER_APT_PACKAGES="ffmpeg build-essential"
./docker-setup.sh
```

注意：

- apt パッケージ名のスペース区切りリストを受け取ります。
- `OPENCLAW_DOCKER_APT_PACKAGES` を変更した場合は、`docker-setup.sh` を再実行して
  イメージを再ビルドしてください。

### パワーユーザー／フル機能コンテナ（オプトイン）

既定の Docker イメージは**セキュリティ重視**で、非 root の `node`
ユーザーとして実行されます。これにより攻撃面は小さくなりますが、次の制限があります：

- 実行時のシステムパッケージインストール不可
- 既定では Homebrew なし
- Chromium／Playwright ブラウザは同梱されません

よりフル機能なコンテナが必要な場合は、次のオプトイン設定を使用してください：

1. **`/home/node` を永続化**して、ブラウザダウンロードやツールキャッシュを保持：

```bash
export OPENCLAW_HOME_VOLUME="openclaw_home"
./docker-setup.sh
```

2. **システム依存関係をイメージに焼き込み**（再現可能＋永続）：

```bash
export OPENCLAW_DOCKER_APT_PACKAGES="git curl jq"
./docker-setup.sh
```

3. **`npx` なしで Playwright ブラウザをインストール**（npm の上書き競合を回避）：

```bash
docker compose run --rm openclaw-cli \
  node /app/node_modules/playwright-core/cli.js install chromium
```

Playwright にシステム依存関係のインストールが必要な場合は、
実行時に `--with-deps` を使うのではなく、`OPENCLAW_DOCKER_APT_PACKAGES` でイメージを再ビルドしてください。

4. **Playwright ブラウザのダウンロードを永続化**：

- `docker-compose.yml` で `PLAYWRIGHT_BROWSERS_PATH=/home/node/.cache/ms-playwright` を設定します。
- `OPENCLAW_HOME_VOLUME` により `/home/node` が永続化されていること、
  もしくは `OPENCLAW_EXTRA_MOUNTS` で `/home/node/.cache/ms-playwright` をマウントしていることを確認します。

### 権限＋ EACCES

イメージは `node`（uid 1000）として実行されます。  
`/home/node/.openclaw` で権限エラーが出る場合は、ホストのバインドマウントが uid 1000 の所有であることを確認してください。

例（Linux ホスト）：

```bash
sudo chown -R 1000:1000 /path/to/openclaw-config /path/to/openclaw-workspace
```

利便性のために root として実行する場合、セキュリティ上のトレードオフを受け入れる必要があります。

### 高速な再ビルド（推奨）

再ビルドを高速化するには、Dockerfile の順序を調整して依存関係レイヤーがキャッシュされるようにします。  
これにより、ロックファイルが変更されない限り `pnpm install` の再実行を回避できます：

```dockerfile
FROM node:22-bookworm

# Install Bun (required for build scripts)
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

RUN corepack enable

WORKDIR /app

# Cache dependencies unless package metadata changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY ui/package.json ./ui/package.json
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build
RUN pnpm ui:install
RUN pnpm ui:build

ENV NODE_ENV=production

CMD ["node","dist/index.js"]
```

### チャンネル設定（任意）

CLI コンテナを使用してチャンネルを設定し、必要に応じて Gateway（ゲートウェイ）を再起動してください。

WhatsApp（QR）：

```bash
docker compose run --rm openclaw-cli channels login
```

Telegram（ボットトークン）：

```bash
docker compose run --rm openclaw-cli channels add --channel telegram --token "<token>"
```

Discord（ボットトークン）：

```bash
docker compose run --rm openclaw-cli channels add --channel discord --token "<token>"
```

ドキュメント：[WhatsApp](/channels/whatsapp)、[Telegram](/channels/telegram)、[Discord](/channels/discord)

### OpenAI Codex OAuth（ヘッドレス Docker）

ウィザードで OpenAI Codex OAuth を選択すると、ブラウザ URL が開き、
`http://127.0.0.1:1455/auth/callback` へのコールバックを取得しようとします。  
Docker やヘッドレス環境では、このコールバックでブラウザエラーが表示されることがあります。  
到達した最終的なリダイレクト URL 全体をコピーし、ウィザードに貼り付けて認証を完了してください。

### ヘルスチェック

```bash
docker compose exec openclaw-gateway node dist/index.js health --token "$OPENCLAW_GATEWAY_TOKEN"
```

### E2E スモークテスト（Docker）

```bash
scripts/e2e/onboard-docker.sh
```

### QR インポート スモークテスト（Docker）

```bash
pnpm test:docker:qr
```

### 注意事項

- Gateway（ゲートウェイ）のバインドは、コンテナ利用向けに既定で `lan` です。
- Dockerfile の CMD は `--allow-unconfigured` を使用します。`gateway.mode` でマウントされた設定（`local` ではない）でも起動します。ガードを強制するには CMD を上書きしてください。
- Gateway（ゲートウェイ）コンテナは、セッション（`~/.openclaw/agents/<agentId>/sessions/`）の単一の正とする情報源です。

## エージェントサンドボックス（ホスト上の Gateway（ゲートウェイ）＋ Docker ツール）

詳細：[Sandboxing](/gateway/sandboxing)

### 何をするか

`agents.defaults.sandbox` を有効にすると、**メイン以外のセッション**は Docker コンテナ内でツールを実行します。  
Gateway（ゲートウェイ）はホスト上に残りますが、ツール実行は分離されます：

- スコープ：既定では `"agent"`（エージェントごとに 1 コンテナ＋ワークスペース）
- スコープ：セッション単位の分離には `"session"`
- スコープごとのワークスペースフォルダが `/workspace` にマウント
- 任意のエージェントワークスペースアクセス（`agents.defaults.sandbox.workspaceAccess`）
- ツールの allow／deny ポリシー（deny が優先）
- 受信メディアはアクティブなサンドボックスワークスペース（`media/inbound/*`）にコピーされ、ツールから読み取れます（`workspaceAccess: "rw"` を使用すると、エージェントワークスペースに配置されます）

警告：`scope: "shared"` はセッション間の分離を無効にします。  
すべてのセッションが 1 つのコンテナと 1 つのワークスペースを共有します。

### エージェントごとのサンドボックスプロファイル（マルチエージェント）

マルチエージェントルーティングを使用する場合、各エージェントはサンドボックス＋ツール設定を上書きできます：
`agents.list[].sandbox` と `agents.list[].tools`（および `agents.list[].tools.sandbox.tools`）。  
これにより、1 つの Gateway（ゲートウェイ）内で混在するアクセスレベルを実行できます：

- フルアクセス（個人用エージェント）
- 読み取り専用ツール＋読み取り専用ワークスペース（家族／業務用エージェント）
- ファイルシステム／シェルツールなし（公開エージェント）

例、優先順位、トラブルシューティングについては
[Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) を参照してください。

### 既定の挙動

- イメージ：`openclaw-sandbox:bookworm-slim`
- エージェントごとに 1 コンテナ
- エージェントワークスペースアクセス：`workspaceAccess: "none"`（既定）は `~/.openclaw/sandboxes` を使用
  - `"ro"`：サンドボックスワークスペースを `/workspace` に保持し、エージェントワークスペースを `/agent` に読み取り専用でマウント（`write`／`edit`／`apply_patch` を無効化）
  - `"rw"`：エージェントワークスペースを `/workspace` に読み書きでマウント
- 自動プルーン：アイドル > 24 時間 OR 経過 > 7 日
- ネットワーク：既定で `none`（外向き通信が必要な場合は明示的にオプトイン）
- 既定の許可：`exec`、`process`、`read`、`write`、`edit`、`sessions_list`、`sessions_history`、`sessions_send`、`sessions_spawn`、`session_status`
- 既定の拒否：`browser`、`canvas`、`nodes`、`cron`、`discord`、`gateway`

### サンドボックス化を有効化

`setupCommand` にパッケージをインストールする予定がある場合、次に注意してください：

- 既定の `docker.network` は `"none"`（外向き通信なし）です。
- `readOnlyRoot: true` はパッケージインストールをブロックします。
- `apt-get` には `user` が root である必要があります（`user` を省略するか `user: "0:0"` を設定してください）。
  OpenClaw は、`setupCommand`（または docker 設定）が変更された際にコンテナを自動再作成します。ただし、**最近使用された**（約 5 分以内）コンテナは除きます。  
  ホットなコンテナは、正確な `openclaw sandbox recreate ...` コマンドを含む警告をログに出力します。

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main", // off | non-main | all
        scope: "agent", // session | agent | shared (agent is default)
        workspaceAccess: "none", // none | ro | rw
        workspaceRoot: "~/.openclaw/sandboxes",
        docker: {
          image: "openclaw-sandbox:bookworm-slim",
          workdir: "/workspace",
          readOnlyRoot: true,
          tmpfs: ["/tmp", "/var/tmp", "/run"],
          network: "none",
          user: "1000:1000",
          capDrop: ["ALL"],
          env: { LANG: "C.UTF-8" },
          setupCommand: "apt-get update && apt-get install -y git curl jq",
          pidsLimit: 256,
          memory: "1g",
          memorySwap: "2g",
          cpus: 1,
          ulimits: {
            nofile: { soft: 1024, hard: 2048 },
            nproc: 256,
          },
          seccompProfile: "/path/to/seccomp.json",
          apparmorProfile: "openclaw-sandbox",
          dns: ["1.1.1.1", "8.8.8.8"],
          extraHosts: ["internal.service:10.0.0.5"],
        },
        prune: {
          idleHours: 24, // 0 disables idle pruning
          maxAgeDays: 7, // 0 disables max-age pruning
        },
      },
    },
  },
  tools: {
    sandbox: {
      tools: {
        allow: [
          "exec",
          "process",
          "read",
          "write",
          "edit",
          "sessions_list",
          "sessions_history",
          "sessions_send",
          "sessions_spawn",
          "session_status",
        ],
        deny: ["browser", "canvas", "nodes", "cron", "discord", "gateway"],
      },
    },
  },
}
```

ハードニングの設定は `agents.defaults.sandbox.docker` 配下にあります：
`network`、`user`、`pidsLimit`、`memory`、`memorySwap`、`cpus`、`ulimits`、
`seccompProfile`、`apparmorProfile`、`dns`、`extraHosts`。

マルチエージェント：`agents.list[].sandbox.{docker,browser,prune}.*` を使ってエージェントごとに `agents.defaults.sandbox.{docker,browser,prune}.*` を上書きできます
（`agents.defaults.sandbox.scope`／`agents.list[].sandbox.scope` が `"shared"` の場合は無視されます）。

### 既定のサンドボックスイメージをビルド

```bash
scripts/sandbox-setup.sh
```

これは `Dockerfile.sandbox` を使用して `openclaw-sandbox:bookworm-slim` をビルドします。

### サンドボックス共通イメージ（任意）

一般的なビルドツール（Node、Go、Rust など）を含むサンドボックスイメージが必要な場合は、共通イメージをビルドします：

```bash
scripts/sandbox-common-setup.sh
```

これは `openclaw-sandbox-common:bookworm-slim` をビルドします。使用するには：

```json5
{
  agents: {
    defaults: {
      sandbox: { docker: { image: "openclaw-sandbox-common:bookworm-slim" } },
    },
  },
}
```

### サンドボックス用ブラウザイメージ

サンドボックス内でブラウザツールを実行するには、ブラウザイメージをビルドします：

```bash
scripts/sandbox-browser-setup.sh
```

これは `Dockerfile.sandbox-browser` を使用して `openclaw-sandbox-browser:bookworm-slim` をビルドします。  
コンテナは CDP を有効にした Chromium と、任意の noVNC オブザーバ（Xvfb によるヘッドフル）を実行します。

注意：

- ヘッドフル（Xvfb）はヘッドレスよりもボットブロックを受けにくくなります。
- `agents.defaults.sandbox.browser.headless=true` を設定すればヘッドレスも使用できます。
- 完全なデスクトップ環境（GNOME）は不要で、Xvfb が表示を提供します。

設定例：

```json5
{
  agents: {
    defaults: {
      sandbox: {
        browser: { enabled: true },
      },
    },
  },
}
```

カスタムブラウザイメージ：

```json5
{
  agents: {
    defaults: {
      sandbox: { browser: { image: "my-openclaw-browser" } },
    },
  },
}
```

有効化すると、エージェントは次を受け取ります：

- サンドボックスのブラウザ制御 URL（`browser` ツール用）
- noVNC URL（有効かつ headless=false の場合）

注意：ツールの allowlist を使用している場合、`browser` を追加（deny から削除）しないとツールはブロックされたままになります。  
プルーンルール（`agents.defaults.sandbox.prune`）はブラウザコンテナにも適用されます。

### カスタムサンドボックスイメージ

独自のイメージをビルドし、設定で指定します：

```bash
docker build -t my-openclaw-sbx -f Dockerfile.sandbox .
```

```json5
{
  agents: {
    defaults: {
      sandbox: { docker: { image: "my-openclaw-sbx" } },
    },
  },
}
```

### ツールポリシー（許可／拒否）

- `deny` は `allow` より優先されます。
- `allow` が空の場合：deny を除くすべてのツールが利用可能です。
- `allow` が空でない場合：`allow` に含まれるツールのみが利用可能です（deny を除く）。

### プルーン戦略

2 つの設定：

- `prune.idleHours`：X 時間使用されていないコンテナを削除（0 = 無効）
- `prune.maxAgeDays`：X 日より古いコンテナを削除（0 = 無効）

例：

- 忙しいセッションは保持しつつ寿命を制限：
  `idleHours: 24`、`maxAgeDays: 7`
- 一切プルーンしない：
  `idleHours: 0`、`maxAgeDays: 0`

### セキュリティに関する注意

- 強固な分離は **ツール**（exec／read／write／edit／apply_patch）のみに適用されます。
- browser／camera／canvas などのホスト専用ツールは既定でブロックされます。
- サンドボックス内で `browser` を許可すると **分離が破られます**（ブラウザがホスト上で実行されます）。

## トラブルシューティング

- イメージが見つからない：[`scripts/sandbox-setup.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/sandbox-setup.sh) でビルドするか、`agents.defaults.sandbox.docker.image` を設定してください。
- コンテナが起動しない：セッションごとにオンデマンドで自動作成されます。
- サンドボックスでの権限エラー：`docker.user` を、マウントしたワークスペースの所有者に一致する UID:GID に設定してください（またはワークスペースフォルダを chown してください）。
- カスタムツールが見つからない：OpenClaw は `sh -lc`（ログインシェル）でコマンドを実行します。これは `/etc/profile` を読み込み、PATH をリセットすることがあります。  
  `docker.env.PATH` を設定してカスタムツールのパス（例：`/custom/bin:/usr/local/share/npm-global/bin`）を先頭に追加するか、
  Dockerfile の `/etc/profile.d/` 配下にスクリプトを追加してください。
