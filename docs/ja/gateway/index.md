---
summary: "Gateway サービスのランブック、ライフサイクル、および運用"
read_when:
  - Gateway プロセスを実行またはデバッグする際
title: "Gateway ランブック"
x-i18n:
  source_path: gateway/index.md
  source_hash: 497d58090faaa6bd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:32:22Z
---

# Gateway サービスランブック

最終更新日: 2025-12-09

## 概要

- 単一の Baileys/Telegram 接続と、制御/イベントプレーンを所有する常駐プロセスです。
- レガシーの `gateway` コマンドを置き換えます。CLI エントリポイント: `openclaw gateway`。
- 停止されるまで実行され、致命的なエラー時には非ゼロで終了し、スーパーバイザーが再起動します。

## 実行方法（ローカル）

```bash
openclaw gateway --port 18789
# for full debug/trace logs in stdio:
openclaw gateway --port 18789 --verbose
# if the port is busy, terminate listeners then start:
openclaw gateway --force
# dev loop (auto-reload on TS changes):
pnpm gateway:watch
```

- 設定のホットリロードは `~/.openclaw/openclaw.json`（または `OPENCLAW_CONFIG_PATH`）を監視します。
  - デフォルトモード: `gateway.reload.mode="hybrid"`（安全な変更はホット適用、重大な変更は再起動）。
  - ホットリロードは必要に応じて **SIGUSR1** によるインプロセス再起動を使用します。
  - 無効化するには `gateway.reload.mode="off"` を使用します。
- WebSocket の制御プレーンを `127.0.0.1:<port>`（デフォルト 18789）にバインドします。
- 同一ポートで HTTP（制御 UI、フック、A2UI）も提供します。単一ポートの多重化です。
  - OpenAI Chat Completions（HTTP）: [`/v1/chat/completions`](/gateway/openai-http-api)。
  - OpenResponses（HTTP）: [`/v1/responses`](/gateway/openresponses-http-api)。
  - Tools Invoke（HTTP）: [`/tools/invoke`](/gateway/tools-invoke-http-api)。
- 既定で `canvasHost.port`（デフォルト `18793`）に Canvas ファイルサーバーを起動し、`~/.openclaw/workspace/canvas` から `http://<gateway-host>:18793/__openclaw__/canvas/` を提供します。`canvasHost.enabled=false` または `OPENCLAW_SKIP_CANVAS_HOST=1` で無効化できます。
- stdout にログを出力します。常駐とログローテーションには launchd/systemd を使用してください。
- トラブルシューティング時は `--verbose` を渡すと、ログファイルのデバッグログ（ハンドシェイク、req/res、イベント）を stdio にミラーします。
- `--force` は `lsof` を使用して選択ポート上のリスナーを検出し、SIGTERM を送信して、終了させた内容をログに記録してから Gateway を起動します（`lsof` がない場合は即失敗）。
- スーパーバイザー（launchd/systemd/mac アプリの子プロセスモード）配下で実行している場合、停止/再起動は通常 **SIGTERM** を送信します。古いビルドではこれが `pnpm` `ELIFECYCLE` の終了コード **143**（SIGTERM）として表示されることがありますが、これはクラッシュではなく通常のシャットダウンです。
- **SIGUSR1** は、認可されている場合にインプロセス再起動をトリガーします（gateway のツール/設定の適用/更新、または手動再起動のために `commands.restart` を有効化）。
- Gateway の認証は既定で必須です。`gateway.auth.token`（または `OPENCLAW_GATEWAY_TOKEN`）または `gateway.auth.password` を設定してください。Tailscale Serve identity を使用しない限り、クライアントは `connect.params.auth.token/password` を送信する必要があります。
- ウィザードは、loopback 上でも既定でトークンを生成するようになりました。
- ポートの優先順位: `--port` > `OPENCLAW_GATEWAY_PORT` > `gateway.port` > 既定 `18789`。

## リモートアクセス

- Tailscale/VPN を推奨します。そうでない場合は SSH トンネルを使用します:
  ```bash
  ssh -N -L 18789:127.0.0.1:18789 user@host
  ```
- クライアントはトンネル経由で `ws://127.0.0.1:18789` に接続します。
- トークンが設定されている場合、トンネル経由であってもクライアントは `connect.params.auth.token` に含める必要があります。

## 複数 Gateway（同一ホスト）

通常は不要です。1 つの Gateway で複数のメッセージングチャンネルとエージェントを提供できます。冗長化や厳密な分離（例: レスキューボット）が必要な場合のみ、複数 Gateway を使用してください。

状態と設定を分離し、ユニークなポートを使用すればサポートされます。完全ガイド: [Multiple gateways](/gateway/multiple-gateways)。

サービス名はプロファイル対応です:

- macOS: `bot.molt.<profile>`（レガシーの `com.openclaw.*` が残っている場合があります）
- Linux: `openclaw-gateway-<profile>.service`
- Windows: `OpenClaw Gateway (<profile>)`

インストールメタデータはサービス設定に埋め込まれます:

- `OPENCLAW_SERVICE_MARKER=openclaw`
- `OPENCLAW_SERVICE_KIND=gateway`
- `OPENCLAW_SERVICE_VERSION=<version>`

レスキューボット・パターン: 独自のプロファイル、状態ディレクトリ、ワークスペース、ベースポート間隔を持つ、分離された 2 つ目の Gateway を維持します。完全ガイド: [Rescue-bot guide](/gateway/multiple-gateways#rescue-bot-guide)。

### Dev プロファイル（`--dev`）

高速パス: プライマリ設定に触れずに、完全に分離された dev インスタンス（設定/状態/ワークスペース）を実行します。

```bash
openclaw --dev setup
openclaw --dev gateway --allow-unconfigured
# then target the dev instance:
openclaw --dev status
openclaw --dev health
```

既定値（env/フラグ/設定で上書き可能）:

- `OPENCLAW_STATE_DIR=~/.openclaw-dev`
- `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
- `OPENCLAW_GATEWAY_PORT=19001`（Gateway WS + HTTP）
- ブラウザー制御サービスのポート = `19003`（派生: `gateway.port+2`、loopback のみ）
- `canvasHost.port=19005`（派生: `gateway.port+4`）
- `agents.defaults.workspace` は、`--dev` 配下で `setup`/`onboard` を実行すると既定で `~/.openclaw/workspace-dev` になります。

派生ポート（目安）:

- ベースポート = `gateway.port`（または `OPENCLAW_GATEWAY_PORT` / `--port`）
- ブラウザー制御サービスのポート = ベース + 2（loopback のみ）
- `canvasHost.port = base + 4`（または `OPENCLAW_CANVAS_HOST_PORT` / 設定で上書き）
- ブラウザープロファイルの CDP ポートは `browser.controlPort + 9 .. + 108` から自動割り当て（プロファイルごとに永続化）。

インスタンスごとのチェックリスト:

- ユニークな `gateway.port`
- ユニークな `OPENCLAW_CONFIG_PATH`
- ユニークな `OPENCLAW_STATE_DIR`
- ユニークな `agents.defaults.workspace`
- 別個の WhatsApp 番号（WA を使用する場合）

プロファイルごとのサービスインストール:

```bash
openclaw --profile main gateway install
openclaw --profile rescue gateway install
```

例:

```bash
OPENCLAW_CONFIG_PATH=~/.openclaw/a.json OPENCLAW_STATE_DIR=~/.openclaw-a openclaw gateway --port 19001
OPENCLAW_CONFIG_PATH=~/.openclaw/b.json OPENCLAW_STATE_DIR=~/.openclaw-b openclaw gateway --port 19002
```

## プロトコル（運用者視点）

- 完全なドキュメント: [Gateway protocol](/gateway/protocol) および [Bridge protocol（legacy）](/gateway/bridge-protocol)。
- クライアントからの必須の最初のフレーム: `req {type:"req", id, method:"connect", params:{minProtocol,maxProtocol,client:{id,displayName?,version,platform,deviceFamily?,modelIdentifier?,mode,instanceId?}, caps, auth?, locale?, userAgent? } }`。
- Gateway は `res {type:"res", id, ok:true, payload:hello-ok }`（またはエラー時は `ok:false` を返してクローズ）で応答します。
- ハンドシェイク後:
  - リクエスト: `{type:"req", id, method, params}` → `{type:"res", id, ok, payload|error}`
  - イベント: `{type:"event", event, payload, seq?, stateVersion?}`
- 構造化されたプレゼンスエントリ: `{host, ip, version, platform?, deviceFamily?, modelIdentifier?, mode, lastInputSeconds?, ts, reason?, tags?[], instanceId? }`（WS クライアントでは、`instanceId` は `connect.client.instanceId` から来ます）。
- `agent` のレスポンスは 2 段階です。まず `res` の ack `{runId,status:"accepted"}`、次に実行完了後の最終 `res` `{runId,status:"ok"|"error",summary}`。ストリーミング出力は `event:"agent"` として到着します。

## メソッド（初期セット）

- `health` — 完全なヘルススナップショット（`openclaw health --json` と同一形状）。
- `status` — 短いサマリー。
- `system-presence` — 現在のプレゼンス一覧。
- `system-event` — プレゼンス/システムノートを投稿（構造化）。
- `send` — アクティブなチャンネル経由でメッセージを送信。
- `agent` — エージェントのターンを実行（同一接続でイベントをストリーム）。
- `node.list` — ペアリング済み + 現在接続中のノード一覧（`caps`、`deviceFamily`、`modelIdentifier`、`paired`、`connected`、および広告された `commands` を含む）。
- `node.describe` — ノードを記述（機能 + サポートされる `node.invoke` コマンド。ペアリング済みノードおよび未ペアリングだが現在接続中のノードで動作）。
- `node.invoke` — ノード上のコマンドを実行（例: `canvas.*`、`camera.*`）。
- `node.pair.*` — ペアリングのライフサイクル（`request`、`list`、`approve`、`reject`、`verify`）。

関連項目: プレゼンスがどのように生成/重複排除され、なぜ安定した `client.instanceId` が重要かについては [Presence](/concepts/presence) を参照してください。

## イベント

- `agent` — エージェント実行からのツール/出力イベントのストリーム（シーケンスタグ付き）。
- `presence` — すべての接続クライアントにプッシュされるプレゼンス更新（stateVersion 付きの差分）。
- `tick` — 生存確認のための定期的な keepalive/no-op。
- `shutdown` — Gateway が終了中。ペイロードには `reason` と任意の `restartExpectedMs` が含まれます。クライアントは再接続してください。

## WebChat 連携

- WebChat は、履歴、送信、中断、イベントのために Gateway WebSocket と直接通信するネイティブ SwiftUI UI です。
- リモート利用は同じ SSH/Tailscale トンネルを使用します。Gateway トークンが設定されている場合、クライアントは `connect` 中にそれを含めます。
- macOS アプリは単一の WS（共有接続）で接続します。初期スナップショットからプレゼンスをハイドレートし、UI 更新のために `presence` イベントをリッスンします。

## 型付けと検証

- サーバーは、プロトコル定義から生成された JSON Schema に対して AJV で、すべての受信フレームを検証します。
- クライアント（TS/Swift）は生成された型を使用します（TS は直接、Swift はリポジトリのジェネレーター経由）。
- プロトコル定義が唯一の正とします。次でスキーマ/モデルを再生成してください:
  - `pnpm protocol:gen`
  - `pnpm protocol:gen:swift`

## 接続スナップショット

- `hello-ok` には、`presence`、`health`、`stateVersion`、`uptimeMs`、および `policy {maxPayload,maxBufferedBytes,tickIntervalMs}` を含む `snapshot` が含まれ、追加リクエストなしで即時に描画できます。
- `health`/`system-presence` は手動リフレッシュ用に引き続き利用可能ですが、接続時には必須ではありません。

## エラーコード（res.error 形式）

- エラーは `{ code, message, details?, retryable?, retryAfterMs? }` を使用します。
- 標準コード:
  - `NOT_LINKED` — WhatsApp が未認証です。
  - `AGENT_TIMEOUT` — エージェントが設定された期限内に応答しませんでした。
  - `INVALID_REQUEST` — スキーマ/パラメータ検証に失敗しました。
  - `UNAVAILABLE` — Gateway がシャットダウン中、または依存関係が利用不可です。

## Keepalive の挙動

- `tick` イベント（または WS の ping/pong）が定期的に送出され、トラフィックがない場合でも Gateway の生存が確認できます。
- 送信/エージェントの ack は別個のレスポンスのままにしてください。tick を送信に流用しないでください。

## リプレイ / ギャップ

- イベントはリプレイされません。クライアントはシーケンスの欠落を検出したら、継続前にリフレッシュ（`health` + `system-presence`）してください。WebChat と macOS クライアントは現在、欠落時に自動リフレッシュします。

## 監視（macOS の例）

- launchd を使用してサービスを常駐させます:
  - Program: `openclaw` へのパス
  - Arguments: `gateway`
  - KeepAlive: true
  - StandardOut/Err: ファイルパスまたは `syslog`
- 障害時は launchd が再起動します。致命的な設定不備では、運用者が気付くように終了し続けるべきです。
- LaunchAgents はユーザーごとで、ログイン中のセッションが必要です。ヘッドレス構成ではカスタム LaunchDaemon（未同梱）を使用してください。
  - `openclaw gateway install` は `~/Library/LaunchAgents/bot.molt.gateway.plist` を書き込みます
    （または `bot.molt.<profile>.plist`。レガシーの `com.openclaw.*` はクリーンアップされます）。
  - `openclaw doctor` は LaunchAgent 設定を監査し、現在の既定に更新できます。

## Gateway サービス管理（CLI）

インストール/開始/停止/再起動/ステータスには Gateway CLI を使用します:

```bash
openclaw gateway status
openclaw gateway install
openclaw gateway stop
openclaw gateway restart
openclaw logs --follow
```

注記:

- `gateway status` は既定で、サービスの解決済みポート/設定を使用して Gateway RPC をプローブします（`--url` で上書き可能）。
- `gateway status --deep` はシステムレベルのスキャン（LaunchDaemons/system units）を追加します。
- `gateway status --no-probe` は RPC プローブをスキップします（ネットワーク障害時に有用）。
- `gateway status --json` はスクリプト向けに安定しています。
- `gateway status` は **supervisor runtime**（launchd/systemd が稼働中）と **RPC 到達性**（WS 接続 + status RPC）を別々に報告します。
- `gateway status` は「localhost と LAN バインド」の混乱やプロファイル不一致を避けるため、設定パス + プローブ対象を出力します。
- `gateway status` は、サービスが稼働しているように見えるがポートが閉じている場合、直近の Gateway エラー行を含めます。
- `logs` は RPC 経由で Gateway のファイルログを tail します（手動の `tail`/`grep` は不要）。
- 他の gateway 類似サービスが検出された場合、OpenClaw のプロファイルサービスでない限り CLI は警告します。
  多くの構成では **1 台のマシンに 1 Gateway** を推奨します。冗長化やレスキューボットには、分離したプロファイル/ポートを使用してください。参照: [Multiple gateways](/gateway/multiple-gateways)。
  - クリーンアップ: `openclaw gateway uninstall`（現行サービス）および `openclaw doctor`（レガシー移行）。
- `gateway install` は既にインストール済みの場合は no-op です。再インストール（プロファイル/env/パス変更）には `openclaw gateway install --force` を使用してください。

同梱の mac アプリ:

- OpenClaw.app は Node ベースの gateway リレーを同梱でき、ユーザーごとの LaunchAgent を
  `bot.molt.gateway`（または `bot.molt.<profile>`。レガシーの `com.openclaw.*` ラベルも問題なくアンロード）としてインストールします。
- 正常に停止するには `openclaw gateway stop`（または `launchctl bootout gui/$UID/bot.molt.gateway`）を使用します。
- 再起動するには `openclaw gateway restart`（または `launchctl kickstart -k gui/$UID/bot.molt.gateway`）を使用します。
  - `launchctl` は LaunchAgent がインストールされている場合のみ動作します。未インストールの場合は先に `openclaw gateway install` を使用してください。
  - 名前付きプロファイルを実行する場合は、ラベルを `bot.molt.<profile>` に置き換えてください。

## 監視（systemd ユーザーユニット）

OpenClaw は Linux/WSL2 で既定で **systemd ユーザーサービス** をインストールします。単一ユーザーのマシンでは（環境が簡単、ユーザーごとの設定）ユーザーサービスを推奨します。複数ユーザーまたは常時稼働サーバーでは **システムサービス** を使用してください（lingering 不要、共有監視）。

`openclaw gateway install` はユーザーユニットを書き込みます。`openclaw doctor` は
ユニットを監査し、現在推奨される既定に更新できます。

`~/.config/systemd/user/openclaw-gateway[-<profile>].service` を作成します:

```
[Unit]
Description=OpenClaw Gateway (profile: <profile>, v<version>)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/openclaw gateway --port 18789
Restart=always
RestartSec=5
Environment=OPENCLAW_GATEWAY_TOKEN=
WorkingDirectory=/home/youruser

[Install]
WantedBy=default.target
```

ログアウト/アイドル後もユーザーサービスを存続させるため、lingering を有効化します（必須）:

```
sudo loginctl enable-linger youruser
```

オンボーディングは Linux/WSL2 でこれを実行します（sudo を求められる場合があります。`/var/lib/systemd/linger` を書き込みます）。
その後、サービスを有効化します:

```
systemctl --user enable --now openclaw-gateway[-<profile>].service
```

**代替（システムサービス）** - 常時稼働または複数ユーザーのサーバー向けに、ユーザーユニットの代わりに systemd の **システム** ユニットをインストールできます（lingering 不要）。
`/etc/systemd/system/openclaw-gateway[-<profile>].service` を作成し（上記ユニットをコピーし、
`WantedBy=multi-user.target` を切り替え、`User=` + `WorkingDirectory=` を設定）、次を実行します:

```
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-gateway[-<profile>].service
```

## Windows（WSL2）

Windows のインストールでは **WSL2** を使用し、上記の Linux の systemd セクションに従ってください。

## 運用チェック

- 生存確認: WS を開いて `req:connect` を送信 → `res`（スナップショット付きの `payload.type="hello-ok"`）を期待します。
- レディネス: `health` を呼び出す → `ok: true` と、該当する場合は `linkChannel` にリンクされたチャンネルを期待します。
- デバッグ: `tick` と `presence` のイベントを購読します。`status` がリンク/認証の経過時間を示すこと、プレゼンスエントリに Gateway ホストと接続クライアントが表示されることを確認します。

## 安全性の保証

- 既定では 1 ホストに 1 Gateway を前提とします。複数プロファイルを実行する場合は、ポート/状態を分離し、正しいインスタンスを対象にしてください。
- 直接の Baileys 接続へのフォールバックはありません。Gateway がダウンしている場合、送信は即失敗します。
- 接続時の最初のフレームでないもの、または不正な JSON は拒否され、ソケットはクローズされます。
- グレースフルシャットダウン: クローズ前に `shutdown` イベントを送出します。クライアントはクローズ + 再接続を処理してください。

## CLI ヘルパー

- `openclaw gateway health|status` — Gateway WS 経由でヘルス/ステータスを要求。
- `openclaw message send --target <num> --message "hi" [--media ...]` — Gateway 経由で送信（WhatsApp では冪等）。
- `openclaw agent --message "hi" --to <num>` — エージェントのターンを実行（既定では最終結果を待機）。
- `openclaw gateway call <method> --params '{"k":"v"}'` — デバッグ用の生メソッド呼び出し。
- `openclaw gateway stop|restart` — 監視下の Gateway サービス（launchd/systemd）を停止/再起動。
- Gateway ヘルパーのサブコマンドは、`--url` 上で稼働中の Gateway を前提とします。自動起動は行いません。

## 移行ガイダンス

- `openclaw gateway` およびレガシーの TCP 制御ポートの使用を廃止してください。
- クライアントを更新し、必須の connect と構造化プレゼンスを備えた WS プロトコルを使用してください。
