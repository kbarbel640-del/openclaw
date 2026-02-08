---
summary: "gogcli 経由で Gmail Pub/Sub プッシュを OpenClaw Webhooks に接続"
read_when:
  - Gmail 受信トリガーを OpenClaw に配線する
  - エージェント起動のための Pub/Sub プッシュを設定する
title: "Gmail PubSub"
x-i18n:
  source_path: automation/gmail-pubsub.md
  source_hash: dfb92133b69177e4
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T04:41:52Z
---

# Gmail Pub/Sub -> OpenClaw

目的: Gmail watch -> Pub/Sub push -> `gog gmail watch serve` -> OpenClaw webhook。

## 前提条件

- `gcloud` をインストールし、ログインしていること（[インストールガイド](https://docs.cloud.google.com/sdk/docs/install-sdk)）。
- `gog`（gogcli）をインストールし、Gmail アカウントに対して認可していること（[gogcli.sh](https://gogcli.sh/)）。
- OpenClaw hooks を有効化していること（[Webhooks](/automation/webhook) を参照）。
- `tailscale` にログインしていること（[tailscale.com](https://tailscale.com/)）。サポートされるセットアップは、公開 HTTPS エンドポイントに Tailscale Funnel を使用します。
  ほかのトンネルサービスでも動作する場合がありますが、DIY/非サポートであり、手動の配線が必要です。
  現時点では、Tailscale がサポート対象です。

フック設定例（Gmail プリセットマッピングを有効化）:

```json5
{
  hooks: {
    enabled: true,
    token: "OPENCLAW_HOOK_TOKEN",
    path: "/hooks",
    presets: ["gmail"],
  },
}
```

Gmail の要約をチャットの送信先に配信するには、`deliver` と任意の `channel`/`to` を設定するマッピングでプリセットを上書きしてください:

```json5
{
  hooks: {
    enabled: true,
    token: "OPENCLAW_HOOK_TOKEN",
    presets: ["gmail"],
    mappings: [
      {
        match: { path: "gmail" },
        action: "agent",
        wakeMode: "now",
        name: "Gmail",
        sessionKey: "hook:gmail:{{messages[0].id}}",
        messageTemplate: "New email from {{messages[0].from}}\nSubject: {{messages[0].subject}}\n{{messages[0].snippet}}\n{{messages[0].body}}",
        model: "openai/gpt-5.2-mini",
        deliver: true,
        channel: "last",
        // to: "+15551234567"
      },
    ],
  },
}
```

固定チャンネルにしたい場合は、`channel` と `to` を設定します。そうでなければ `channel: "last"` は直近の配信ルートを使用します（WhatsApp にフォールバックします）。

Gmail 実行に対してより安価なモデルを強制するには、マッピングで `model`（`provider/model` またはエイリアス）を設定します。`agents.defaults.models` を強制する場合は、そこに含めてください。

Gmail hooks 専用にデフォルトのモデルと思考レベルを設定するには、設定に `hooks.gmail.model` / `hooks.gmail.thinking` を追加します:

```json5
{
  hooks: {
    gmail: {
      model: "openrouter/meta-llama/llama-3.3-70b-instruct:free",
      thinking: "off",
    },
  },
}
```

注記:

- マッピング内のフックごとの `model`/`thinking` は、これらのデフォルトを引き続き上書きします。
- フォールバック順序: `hooks.gmail.model` → `agents.defaults.model.fallbacks` → primary（auth/rate-limit/timeouts）。
- `agents.defaults.models` が設定されている場合、Gmail モデルは allowlist に含まれている必要があります。
- Gmail フック内容はデフォルトで外部コンテンツ安全境界でラップされます。
  無効化するには（危険です）、`hooks.gmail.allowUnsafeExternalContent: true` を設定してください。

ペイロード処理をさらにカスタマイズするには、`hooks.mappings` を追加するか、`hooks.transformsDir` 配下に JS/TS の変換モジュールを追加してください（[Webhooks](/automation/webhook) を参照）。

## ウィザード（推奨）

OpenClaw ヘルパーを使ってすべてを配線します（macOS では brew 経由で依存関係をインストールします）:

```bash
openclaw webhooks gmail setup \
  --account openclaw@gmail.com
```

デフォルト:

- 公開プッシュエンドポイントに Tailscale Funnel を使用します。
- `openclaw webhooks gmail run` 向けに `hooks.gmail` 設定を書き込みます。
- Gmail フックプリセット（`hooks.presets: ["gmail"]`）を有効化します。

パスに関する注記: `tailscale.mode` が有効な場合、OpenClaw は自動的に `hooks.gmail.serve.path` を `/` に設定し、公開パスは `hooks.gmail.tailscale.path`（デフォルトは `/gmail-pubsub`）のまま維持します。これは Tailscale がプロキシ前に set-path プレフィックスを取り除くためです。
バックエンドにプレフィックス付きパスを受信させる必要がある場合は、`hooks.gmail.tailscale.target`（または `--tailscale-target`）を `http://127.0.0.1:8788/gmail-pubsub` のような完全な URL に設定し、`hooks.gmail.serve.path` を一致させてください。

カスタムエンドポイントが必要ですか？ `--push-endpoint <url>` または `--tailscale off` を使用してください。

プラットフォーム注記: macOS では、ウィザードが Homebrew 経由で `gcloud`、`gogcli`、`tailscale` をインストールします。Linux では先に手動でインストールしてください。

Gateway（ゲートウェイ）の自動起動（推奨）:

- `hooks.enabled=true` と `hooks.gmail.account` が設定されている場合、Gateway（ゲートウェイ）は起動時に `gog gmail watch serve` を開始し、watch を自動更新します。
- オプトアウトするには `OPENCLAW_SKIP_GMAIL_WATCHER=1` を設定します（デーモンを自分で実行する場合に有用です）。
- 手動デーモンを同時に実行しないでください。実行すると `listen tcp 127.0.0.1:8788: bind: address already in use` に当たります。

手動デーモン（`gog gmail watch serve` を起動 + 自動更新）:

```bash
openclaw webhooks gmail run
```

## 1 回限りのセットアップ

1. `gog` が使用する **OAuth クライアントを所有する** GCP プロジェクトを選択します。

```bash
gcloud auth login
gcloud config set project <project-id>
```

注記: Gmail watch では、Pub/Sub topic は OAuth クライアントと同じプロジェクトに存在する必要があります。

2. API を有効化します:

```bash
gcloud services enable gmail.googleapis.com pubsub.googleapis.com
```

3. topic を作成します:

```bash
gcloud pubsub topics create gog-gmail-watch
```

4. Gmail プッシュが publish できるように許可します:

```bash
gcloud pubsub topics add-iam-policy-binding gog-gmail-watch \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

## watch を開始

```bash
gog gmail watch start \
  --account openclaw@gmail.com \
  --label INBOX \
  --topic projects/<project-id>/topics/gog-gmail-watch
```

出力から `history_id` を保存してください（デバッグ用）。

## プッシュハンドラーを実行

ローカル例（共有トークン認証）:

```bash
gog gmail watch serve \
  --account openclaw@gmail.com \
  --bind 127.0.0.1 \
  --port 8788 \
  --path /gmail-pubsub \
  --token <shared> \
  --hook-url http://127.0.0.1:18789/hooks/gmail \
  --hook-token OPENCLAW_HOOK_TOKEN \
  --include-body \
  --max-bytes 20000
```

注記:

- `--token` はプッシュエンドポイント（`x-gog-token` または `?token=`）を保護します。
- `--hook-url` は OpenClaw の `/hooks/gmail`（マッピング済み。分離実行 + 要約をメインへ）を指します。
- `--include-body` と `--max-bytes` は OpenClaw に送る本文スニペットを制御します。

推奨: `openclaw webhooks gmail run` は同じフローをラップし、watch を自動更新します。

## ハンドラーを公開（高度、非サポート）

Tailscale 以外のトンネルが必要な場合は、手動で配線し、プッシュ subscription に公開 URL を使用してください（非サポート、ガードレールなし）:

```bash
cloudflared tunnel --url http://127.0.0.1:8788 --no-autoupdate
```

生成された URL をプッシュエンドポイントとして使用します:

```bash
gcloud pubsub subscriptions create gog-gmail-watch-push \
  --topic gog-gmail-watch \
  --push-endpoint "https://<public-url>/gmail-pubsub?token=<shared>"
```

本番: 安定した HTTPS エンドポイントを使用し、Pub/Sub OIDC JWT を設定してから、次を実行します:

```bash
gog gmail watch serve --verify-oidc --oidc-email <svc@...>
```

## テスト

監視対象の受信箱へメッセージを送信します:

```bash
gog gmail send \
  --account openclaw@gmail.com \
  --to openclaw@gmail.com \
  --subject "watch test" \
  --body "ping"
```

watch 状態と履歴を確認します:

```bash
gog gmail watch status --account openclaw@gmail.com
gog gmail history --account openclaw@gmail.com --since <historyId>
```

## トラブルシューティング

- `Invalid topicName`: プロジェクト不一致（topic が OAuth クライアントのプロジェクトにありません）。
- `User not authorized`: topic に `roles/pubsub.publisher` がありません。
- 空のメッセージ: Gmail プッシュは `historyId` のみを提供します。`gog gmail history` 経由で取得してください。

## クリーンアップ

```bash
gog gmail watch stop --account openclaw@gmail.com
gcloud pubsub subscriptions delete gog-gmail-watch-push
gcloud pubsub topics delete gog-gmail-watch
```
