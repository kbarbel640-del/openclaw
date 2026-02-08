---
summary: "Gateway（ゲートウェイ）向けのブラウザベース制御 UI（チャット、ノード、設定）"
read_when:
  - ブラウザから Gateway（ゲートウェイ）を操作したい場合
  - SSH トンネルなしで Tailnet アクセスを利用したい場合
title: "制御 UI"
x-i18n:
  source_path: web/control-ui.md
  source_hash: ad239e4a4354999a
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:13:41Z
---

# 制御 UI（ブラウザ）

制御 UI は、Gateway（ゲートウェイ）によって配信される小さな **Vite + Lit** シングルページアプリです。

- デフォルト: `http://<host>:18789/`
- オプションのプレフィックス: `gateway.controlUi.basePath` を設定します（例: `/openclaw`）

同じポート上の **Gateway（ゲートウェイ）WebSocket** と **直接** 通信します。

## クイックオープン（ローカル）

Gateway（ゲートウェイ）が同じコンピューター上で動作している場合は、次を開きます。

- http://127.0.0.1:18789/（または http://localhost:18789/）

ページの読み込みに失敗する場合は、まず Gateway（ゲートウェイ）を起動します: `openclaw gateway`。

認証は WebSocket ハンドシェイク中に次の方法で提供されます。

- `connect.params.auth.token`
- `connect.params.auth.password`
  ダッシュボードの設定パネルではトークンを保存できます。パスワードは永続化されません。
  オンボーディングウィザードはデフォルトでゲートウェイトークンを生成するため、初回接続時にここへ貼り付けてください。

## デバイスのペアリング（初回接続）

新しいブラウザまたはデバイスから制御 UI に接続すると、Gateway（ゲートウェイ）は
**一度限りのペアリング承認** を要求します。これは、`gateway.auth.allowTailscale: true` を用いて同じ Tailnet 上にいる場合でも同様です。これは不正アクセスを防止するためのセキュリティ対策です。

**表示される内容:** 「disconnected (1008): pairing required」

**デバイスを承認するには:**

```bash
# List pending requests
openclaw devices list

# Approve by request ID
openclaw devices approve <requestId>
```

承認されると、そのデバイスは記憶され、`openclaw devices revoke --device <id> --role <role>` で取り消さない限り再承認は不要です。トークンのローテーションと失効については、[Devices CLI](/cli/devices) を参照してください。

**注記:**

- ローカル接続（`127.0.0.1`）は自動承認されます。
- リモート接続（LAN、Tailnet など）は明示的な承認が必要です。
- 各ブラウザプロファイルは一意のデバイス ID を生成するため、ブラウザを切り替えたりブラウザデータを消去したりすると、再ペアリングが必要になります。

## できること（現時点）

- Gateway WS 経由でモデルとチャット（`chat.history`、`chat.send`、`chat.abort`、`chat.inject`）
- チャットでツール呼び出し + ライブツール出力カードをストリーミング（エージェントイベント）
- チャンネル: WhatsApp/Telegram/Discord/Slack + プラグインチャンネル（Mattermost など）のステータス + QR ログイン + チャンネルごとの設定（`channels.status`、`web.login.*`、`config.patch`）
- インスタンス: プレゼンス一覧 + 更新（`system-presence`）
- セッション: 一覧 + セッションごとの thinking/verbose 上書き（`sessions.list`、`sessions.patch`）
- Cron ジョブ: 一覧/追加/実行/有効化/無効化 + 実行履歴（`cron.*`）
- Skills: ステータス、有効化/無効化、インストール、API キー更新（`skills.*`）
- ノード: 一覧 + caps（`node.list`）
- Exec 承認: ゲートウェイまたはノードの allowlist 編集 + `exec host=gateway/node` 向けの ask ポリシー（`exec.approvals.*`）
- 設定: `~/.openclaw/openclaw.json` の表示/編集（`config.get`、`config.set`）
- 設定: 検証付きの適用 + 再起動（`config.apply`）および最後にアクティブだったセッションのウェイク
- 設定の書き込みには base-hash ガードが含まれ、同時編集の上書きを防止します
- 設定スキーマ + フォームレンダリング（`config.schema`、プラグイン + チャンネルスキーマを含む）; Raw JSON エディターも引き続き利用可能です
- デバッグ: ステータス/ヘルス/モデルのスナップショット + イベントログ + 手動 RPC 呼び出し（`status`、`health`、`models.list`）
- ログ: フィルター/エクスポート付きのゲートウェイファイルログのライブ tail（`logs.tail`）
- 更新: パッケージ/git の更新 + 再起動（`update.run`）と再起動レポート

Cron ジョブパネルの注記:

- 分離されたジョブでは、配信はデフォルトでサマリー通知です。内部のみの実行にしたい場合は none に切り替えられます。
- announce が選択されると、channel/target フィールドが表示されます。

## チャットの挙動

- `chat.send` は **ノンブロッキング** です。`{ runId, status: "started" }` で即時に ack し、レスポンスは `chat` イベント経由でストリーミングされます。
- 同じ `idempotencyKey` で再送すると、実行中は `{ status: "in_flight" }` を返し、完了後は `{ status: "ok" }` を返します。
- `chat.inject` はセッションのトランスクリプトにアシスタントメモを追記し、UI のみ更新向けに `chat` イベントをブロードキャストします（エージェント実行なし、チャンネル配信なし）。
- 停止:
  - **Stop** をクリックします（`chat.abort` を呼び出します）
  - `/stop`（または `stop|esc|abort|wait|exit|interrupt`）を入力してアウトオブバンドで中止します
  - `chat.abort` は `{ sessionKey }`（`runId` なし）をサポートし、そのセッションのすべてのアクティブ実行を中止します

## Tailnet アクセス（推奨）

### 統合 Tailscale Serve（推奨）

Gateway（ゲートウェイ）を loopback に保持し、Tailscale Serve に HTTPS でプロキシさせます。

```bash
openclaw gateway --tailscale serve
```

開く:

- `https://<magicdns>/`（または設定した `gateway.controlUi.basePath`）

デフォルトでは、`gateway.auth.allowTailscale` が `true` の場合、Serve リクエストは Tailscale のアイデンティティヘッダー（`tailscale-user-login`）で認証できます。OpenClaw は、`tailscale whois` で `x-forwarded-for` アドレスを解決してヘッダーと照合することでアイデンティティを検証し、さらにリクエストが loopback に到達し、Tailscale の `x-forwarded-*` ヘッダーが付与されている場合にのみこれらを受け付けます。Serve トラフィックに対してもトークン/パスワードを必須にしたい場合は、`gateway.auth.allowTailscale: false` を設定します（または `gateway.auth.mode: "password"` を強制します）。

### tailnet にバインド + トークン

```bash
openclaw gateway --bind tailnet --token "$(openssl rand -hex 32)"
```

次を開きます。

- `http://<tailscale-ip>:18789/`（または設定した `gateway.controlUi.basePath`）

UI 設定にトークンを貼り付けます（`connect.params.auth.token` として送信されます）。

## 安全でない HTTP

平文 HTTP（`http://<lan-ip>` または `http://<tailscale-ip>`）でダッシュボードを開くと、ブラウザは **非セキュアコンテキスト** で動作し、WebCrypto をブロックします。デフォルトでは、OpenClaw はデバイス ID なしの制御 UI 接続を **ブロック** します。

**推奨の修正:** HTTPS（Tailscale Serve）を使用するか、UI をローカルで開きます。

- `https://<magicdns>/`（Serve）
- `http://127.0.0.1:18789/`（ゲートウェイホスト上）

**ダウングレード例（HTTP 上でトークンのみ）:**

```json5
{
  gateway: {
    controlUi: { allowInsecureAuth: true },
    bind: "tailnet",
    auth: { mode: "token", token: "replace-me" },
  },
}
```

これにより、制御 UI のデバイス ID + ペアリングが無効化されます（HTTPS 上でも同様です）。ネットワークを信頼できる場合にのみ使用してください。

HTTPS セットアップのガイダンスについては、[Tailscale](/gateway/tailscale) を参照してください。

## UI のビルド

Gateway（ゲートウェイ）は `dist/control-ui` から静的ファイルを配信します。次でビルドします。

```bash
pnpm ui:build # auto-installs UI deps on first run
```

オプションの絶対 base（固定のアセット URL が必要な場合）:

```bash
OPENCLAW_CONTROL_UI_BASE_PATH=/openclaw/ pnpm ui:build
```

ローカル開発（別の dev サーバー）:

```bash
pnpm ui:dev # auto-installs UI deps on first run
```

次に、UI が Gateway WS URL を参照するようにします（例: `ws://127.0.0.1:18789`）。

## デバッグ/テスト: dev サーバー + リモート Gateway（ゲートウェイ）

制御 UI は静的ファイルであり、WebSocket のターゲットは設定可能で、HTTP のオリジンとは異なる場合があります。これは、Vite dev サーバーをローカルで動かしつつ、Gateway（ゲートウェイ）を別の場所で実行したい場合に便利です。

1. UI dev サーバーを起動します: `pnpm ui:dev`
2. 次のような URL を開きます。

```text
http://localhost:5173/?gatewayUrl=ws://<gateway-host>:18789
```

オプションの一度限りの認証（必要な場合）:

```text
http://localhost:5173/?gatewayUrl=wss://<gateway-host>:18789&token=<gateway-token>
```

注記:

- `gatewayUrl` は読み込み後に localStorage に保存され、URL からは削除されます。
- `token` は localStorage に保存されます。`password` はメモリ内のみに保持されます。
- `gatewayUrl` が設定されている場合、UI は設定または環境変数の認証情報にフォールバックしません。
  `token`（または `password`）を明示的に指定してください。明示的な認証情報が欠落している場合はエラーになります。
- Gateway（ゲートウェイ）が TLS（Tailscale Serve、HTTPS プロキシなど）の背後にある場合は、`wss://` を使用してください。
- `gatewayUrl` はクリックジャッキング防止のため、トップレベルウィンドウ（埋め込みではない）でのみ受け付けられます。
- クロスオリジンの dev 構成（例: リモート Gateway（ゲートウェイ）への `pnpm ui:dev`）では、UI のオリジンを `gateway.controlUi.allowedOrigins` に追加してください。

例:

```json5
{
  gateway: {
    controlUi: {
      allowedOrigins: ["http://localhost:5173"],
    },
  },
}
```

リモートアクセス設定の詳細: [Remote access](/gateway/remote)。
