---
summary: "ログの概要: ファイルログ、コンソール出力、CLI での tail、および Control UI"
read_when:
  - ログの初心者向け概要が必要なとき
  - ログレベルや形式を設定したいとき
  - トラブルシューティングでログをすばやく見つける必要があるとき
title: "ログ"
x-i18n:
  source_path: logging.md
  source_hash: 884fcf4a906adff3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:24Z
---

# ログ

OpenClaw は 2 つの場所にログを出力します。

- **ファイルログ**（JSON lines）: Gateway によって書き込まれます。
- **コンソール出力**: ターミナルおよび Control UI に表示されます。

このページでは、ログの保存場所、読み方、ログレベルや形式の設定方法を説明します。

## ログの保存場所

デフォルトでは、Gateway は次の場所にローテーションするログファイルを書き込みます。

`/tmp/openclaw/openclaw-YYYY-MM-DD.log`

日付は Gateway ホストのローカルタイムゾーンを使用します。

これは `~/.openclaw/openclaw.json` で上書きできます。

```json
{
  "logging": {
    "file": "/path/to/openclaw.log"
  }
}
```

## ログの読み方

### CLI: ライブ tail（推奨）

CLI を使用して、RPC 経由で Gateway のログファイルを tail します。

```bash
openclaw logs --follow
```

出力モード:

- **TTY セッション**: 見やすく、カラー表示された構造化ログ行。
- **非 TTY セッション**: プレーンテキスト。
- `--json`: 行区切り JSON（1 行につき 1 つのログイベント）。
- `--plain`: TTY セッションでプレーンテキストを強制。
- `--no-color`: ANSI カラーを無効化。

JSON モードでは、CLI は `type` タグ付きのオブジェクトを出力します。

- `meta`: ストリームメタデータ（ファイル、カーソル、サイズ）
- `log`: 解析済みログエントリ
- `notice`: 切り詰め／ローテーションのヒント
- `raw`: 未解析のログ行

Gateway に到達できない場合、CLI は次を実行するための短いヒントを表示します。

```bash
openclaw doctor
```

### Control UI（Web）

Control UI の **Logs** タブは、`logs.tail` を使用して同じファイルを tail します。
開き方は [/web/control-ui](/web/control-ui) を参照してください。

### チャンネル限定ログ

チャンネルのアクティビティ（WhatsApp/Telegram など）をフィルタリングするには、次を使用します。

```bash
openclaw channels logs --channel whatsapp
```

## ログ形式

### ファイルログ（JSONL）

ログファイルの各行は JSON オブジェクトです。CLI と Control UI はこれらの
エントリを解析し、構造化された出力（時刻、レベル、サブシステム、メッセージ）を描画します。

### コンソール出力

コンソールログは **TTY 対応** で、可読性を重視して整形されます。

- サブシステムのプレフィックス（例: `gateway/channels/whatsapp`）
- レベルごとのカラー表示（info/warn/error）
- 省スペース表示または JSON モード（オプション）

コンソールの書式は `logging.consoleStyle` で制御されます。

## ロギングの設定

すべてのロギング設定は、`~/.openclaw/openclaw.json` 内の `logging` 配下にあります。

```json
{
  "logging": {
    "level": "info",
    "file": "/tmp/openclaw/openclaw-YYYY-MM-DD.log",
    "consoleLevel": "info",
    "consoleStyle": "pretty",
    "redactSensitive": "tools",
    "redactPatterns": ["sk-.*"]
  }
}
```

### ログレベル

- `logging.level`: **ファイルログ**（JSONL）のレベル。
- `logging.consoleLevel`: **コンソール** の詳細度レベル。

`--verbose` はコンソール出力にのみ影響し、ファイルログのレベルは変更しません。

### コンソールスタイル

`logging.consoleStyle`:

- `pretty`: 人に優しい表示、カラー付き、タイムスタンプあり。
- `compact`: より簡潔な出力（長時間セッションに最適）。
- `json`: 1 行ごとの JSON（ログ処理向け）。

### マスキング（Redaction）

ツールの要約は、コンソールに出力される前に機密トークンをマスクできます。

- `logging.redactSensitive`: `off` | `tools`（デフォルト: `tools`）
- `logging.redactPatterns`: デフォルトセットを上書きする正規表現文字列のリスト

マスキングは **コンソール出力のみに** 影響し、ファイルログは変更しません。

## 診断 + OpenTelemetry

診断は、モデル実行 **および** メッセージフローテレメトリ（Webhook、キューイング、セッション状態）のための、
構造化された機械可読イベントです。ログを置き換えるものではなく、メトリクス、トレース、
その他のエクスポーターに供給するために存在します。

診断イベントはプロセス内で生成されますが、エクスポーターは
診断とエクスポータープラグインが有効な場合にのみ接続されます。

### OpenTelemetry と OTLP の違い

- **OpenTelemetry（OTel）**: トレース、メトリクス、ログのためのデータモデルと SDK。
- **OTLP**: OTel データをコレクター／バックエンドへエクスポートするためのワイヤープロトコル。
- OpenClaw は現在 **OTLP/HTTP（protobuf）** でエクスポートします。

### エクスポートされるシグナル

- **メトリクス**: カウンター + ヒストグラム（トークン使用量、メッセージフロー、キューイング）。
- **トレース**: モデル使用量 + Webhook／メッセージ処理のスパン。
- **ログ**: `diagnostics.otel.logs` が有効な場合に OTLP 経由でエクスポートされます。ログ量は多くなる可能性があるため、
  `logging.level` とエクスポーターのフィルターを考慮してください。

### 診断イベントカタログ

モデル使用量:

- `model.usage`: トークン、コスト、所要時間、コンテキスト、プロバイダー／モデル／チャンネル、セッション ID。

メッセージフロー:

- `webhook.received`: チャンネルごとの Webhook 受信。
- `webhook.processed`: Webhook 処理完了 + 所要時間。
- `webhook.error`: Webhook ハンドラーエラー。
- `message.queued`: 処理のためにメッセージをキューへ投入。
- `message.processed`: 結果 + 所要時間 + 任意のエラー。

キュー + セッション:

- `queue.lane.enqueue`: コマンドキューのレーン投入 + 深さ。
- `queue.lane.dequeue`: コマンドキューのレーン取り出し + 待機時間。
- `session.state`: セッション状態遷移 + 理由。
- `session.stuck`: セッション停滞の警告 + 経過時間。
- `run.attempt`: 実行リトライ／試行のメタデータ。
- `diagnostic.heartbeat`: 集計カウンター（Webhook／キュー／セッション）。

### 診断を有効化（エクスポーターなし）

プラグインやカスタムシンクで診断イベントを利用したい場合に使用します。

```json
{
  "diagnostics": {
    "enabled": true
  }
}
```

### 診断フラグ（対象限定ログ）

`logging.level` を引き上げることなく、追加の対象限定デバッグログを有効にするにはフラグを使用します。
フラグは大文字小文字を区別せず、ワイルドカードをサポートします（例: `telegram.*` または `*`）。

```json
{
  "diagnostics": {
    "flags": ["telegram.http"]
  }
}
```

環境変数での上書き（単発）:

```
OPENCLAW_DIAGNOSTICS=telegram.http,telegram.payload
```

注意:

- フラグによるログは、標準のログファイル（`logging.file` と同じ）に出力されます。
- 出力は `logging.redactSensitive` に従って引き続きマスキングされます。
- 完全なガイド: [/diagnostics/flags](/diagnostics/flags)。

### OpenTelemetry へエクスポート

診断は `diagnostics-otel` プラグイン（OTLP/HTTP）を介してエクスポートできます。
OTLP/HTTP を受け付ける任意の OpenTelemetry コレクター／バックエンドで動作します。

```json
{
  "plugins": {
    "allow": ["diagnostics-otel"],
    "entries": {
      "diagnostics-otel": {
        "enabled": true
      }
    }
  },
  "diagnostics": {
    "enabled": true,
    "otel": {
      "enabled": true,
      "endpoint": "http://otel-collector:4318",
      "protocol": "http/protobuf",
      "serviceName": "openclaw-gateway",
      "traces": true,
      "metrics": true,
      "logs": true,
      "sampleRate": 0.2,
      "flushIntervalMs": 60000
    }
  }
}
```

注意:

- `openclaw plugins enable diagnostics-otel` でもプラグインを有効化できます。
- `protocol` は現在 `http/protobuf` のみをサポートします。`grpc` は無視されます。
- メトリクスには、トークン使用量、コスト、コンテキストサイズ、実行時間、
  およびメッセージフローのカウンター／ヒストグラム（Webhook、キューイング、セッション状態、キュー深度／待機）が含まれます。
- トレース／メトリクスは `traces` / `metrics` で切り替えできます（デフォルト: 有効）。
  トレースには、モデル使用量のスパンに加え、有効時は Webhook／メッセージ処理のスパンが含まれます。
- コレクターで認証が必要な場合は `headers` を設定してください。
- サポートされる環境変数: `OTEL_EXPORTER_OTLP_ENDPOINT`、
  `OTEL_SERVICE_NAME`、`OTEL_EXPORTER_OTLP_PROTOCOL`。

### エクスポートされるメトリクス（名前 + 型）

モデル使用量:

- `openclaw.tokens`（カウンター、属性: `openclaw.token`、`openclaw.channel`、
  `openclaw.provider`、`openclaw.model`）
- `openclaw.cost.usd`（カウンター、属性: `openclaw.channel`、`openclaw.provider`、
  `openclaw.model`）
- `openclaw.run.duration_ms`（ヒストグラム、属性: `openclaw.channel`、
  `openclaw.provider`、`openclaw.model`）
- `openclaw.context.tokens`（ヒストグラム、属性: `openclaw.context`、
  `openclaw.channel`、`openclaw.provider`、`openclaw.model`）

メッセージフロー:

- `openclaw.webhook.received`（カウンター、属性: `openclaw.channel`、
  `openclaw.webhook`）
- `openclaw.webhook.error`（カウンター、属性: `openclaw.channel`、
  `openclaw.webhook`）
- `openclaw.webhook.duration_ms`（ヒストグラム、属性: `openclaw.channel`、
  `openclaw.webhook`）
- `openclaw.message.queued`（カウンター、属性: `openclaw.channel`、
  `openclaw.source`）
- `openclaw.message.processed`（カウンター、属性: `openclaw.channel`、
  `openclaw.outcome`）
- `openclaw.message.duration_ms`（ヒストグラム、属性: `openclaw.channel`、
  `openclaw.outcome`）

キュー + セッション:

- `openclaw.queue.lane.enqueue`（カウンター、属性: `openclaw.lane`）
- `openclaw.queue.lane.dequeue`（カウンター、属性: `openclaw.lane`）
- `openclaw.queue.depth`（ヒストグラム、属性: `openclaw.lane` または
  `openclaw.channel=heartbeat`）
- `openclaw.queue.wait_ms`（ヒストグラム、属性: `openclaw.lane`）
- `openclaw.session.state`（カウンター、属性: `openclaw.state`、`openclaw.reason`）
- `openclaw.session.stuck`（カウンター、属性: `openclaw.state`）
- `openclaw.session.stuck_age_ms`（ヒストグラム、属性: `openclaw.state`）
- `openclaw.run.attempt`（カウンター、属性: `openclaw.attempt`）

### エクスポートされるスパン（名前 + 主な属性）

- `openclaw.model.usage`
  - `openclaw.channel`、`openclaw.provider`、`openclaw.model`
  - `openclaw.sessionKey`、`openclaw.sessionId`
  - `openclaw.tokens.*`（input/output/cache_read/cache_write/total）
- `openclaw.webhook.processed`
  - `openclaw.channel`、`openclaw.webhook`、`openclaw.chatId`
- `openclaw.webhook.error`
  - `openclaw.channel`、`openclaw.webhook`、`openclaw.chatId`、
    `openclaw.error`
- `openclaw.message.processed`
  - `openclaw.channel`、`openclaw.outcome`、`openclaw.chatId`、
    `openclaw.messageId`、`openclaw.sessionKey`、`openclaw.sessionId`、
    `openclaw.reason`
- `openclaw.session.stuck`
  - `openclaw.state`、`openclaw.ageMs`、`openclaw.queueDepth`、
    `openclaw.sessionKey`、`openclaw.sessionId`

### サンプリング + フラッシュ

- トレースサンプリング: `diagnostics.otel.sampleRate`（0.0–1.0、ルートスパンのみ）。
- メトリクスのエクスポート間隔: `diagnostics.otel.flushIntervalMs`（最小 1000ms）。

### プロトコルに関する注意

- OTLP/HTTP エンドポイントは `diagnostics.otel.endpoint` または
  `OTEL_EXPORTER_OTLP_ENDPOINT` で設定できます。
- エンドポイントに既に `/v1/traces` または `/v1/metrics` が含まれている場合は、そのまま使用されます。
- エンドポイントに既に `/v1/logs` が含まれている場合、ログ用としてそのまま使用されます。
- `diagnostics.otel.logs` は、メインロガー出力の OTLP ログエクスポートを有効化します。

### ログエクスポートの挙動

- OTLP ログは、`logging.file` に書き込まれるものと同じ構造化レコードを使用します。
- `logging.level`（ファイルログレベル）を尊重します。コンソールのマスキングは
  OTLP ログには **適用されません**。
- 高ボリュームの環境では、OTLP コレクター側でのサンプリング／フィルタリングを推奨します。

## トラブルシューティングのヒント

- **Gateway に到達できませんか？** まず `openclaw doctor` を実行してください。
- **ログが空ですか？** Gateway が実行中で、`logging.file` に指定された
  ファイルパスへ書き込みが行われているか確認してください。
- **より詳細が必要ですか？** `logging.level` を `debug` または `trace` に設定して再試行してください。
