---
summary: "ログの表示面、ファイルログ、WS ログスタイル、コンソールの書式設定"
read_when:
  - ログ出力や形式を変更する場合
  - CLI や Gateway（ゲートウェイ）の出力をデバッグする場合
title: "ログ"
x-i18n:
  source_path: gateway/logging.md
  source_hash: efb8eda5e77e3809
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:31:50Z
---

# ログ

ユーザー向けの概要（CLI + Control UI + 設定）については、[/logging](/logging) を参照してください。

OpenClaw には 2 つのログ「表示面」があります。

- **コンソール出力**（ターミナル／Debug UI に表示される内容）
- **ファイルログ**（JSON lines）。Gateway（ゲートウェイ）のロガーによって書き込まれます。

## ファイルベースのロガー

- 既定のローテーションログファイルは `/tmp/openclaw/` 配下にあります（1 日 1 ファイル）：`openclaw-YYYY-MM-DD.log`
  - 日付は Gateway（ゲートウェイ）ホストのローカルタイムゾーンを使用します。
- ログファイルのパスとレベルは `~/.openclaw/openclaw.json` で設定できます。
  - `logging.file`
  - `logging.level`

ファイル形式は 1 行につき 1 つの JSON オブジェクトです。

Control UI の Logs タブは、Gateway（ゲートウェイ）経由でこのファイルを追尾します（`logs.tail`）。
CLI でも同様に行えます。

```bash
openclaw logs --follow
```

**Verbose とログレベルの違い**

- **ファイルログ**は `logging.level` のみによって制御されます。
- `--verbose` は **コンソールの詳細度**（および WS ログスタイル）にのみ影響し、ファイルログのレベルは引き上げません。
- Verbose のみの詳細をファイルログに記録するには、`logging.level` を `debug` または `trace` に設定してください。

## コンソールのキャプチャ

CLI は `console.log/info/warn/error/debug/trace` をキャプチャしてファイルログに書き込みつつ、stdout/stderr への出力も継続します。

コンソールの詳細度は、次の項目で独立して調整できます。

- `logging.consoleLevel`（既定：`info`）
- `logging.consoleStyle`（`pretty` | `compact` | `json`）

## ツール要約のマスキング

Verbose なツール要約（例：`🛠️ Exec: ...`）は、コンソールストリームに出力される前に機密トークンをマスクできます。これは **ツール専用** であり、ファイルログは変更されません。

- `logging.redactSensitive`：`off` | `tools`（既定：`tools`）
- `logging.redactPatterns`：正規表現文字列の配列（既定値を上書き）
  - 生の正規表現文字列（自動 `gi`）を使用するか、カスタムフラグが必要な場合は `/pattern/flags` を使用してください。
  - マッチした部分は、先頭 6 文字 + 末尾 4 文字を残してマスクします（長さ >= 18）。それ以外は `***` になります。
  - 既定では、一般的なキー代入、CLI フラグ、JSON フィールド、Bearer ヘッダー、PEM ブロック、一般的なトークン接頭辞をカバーします。

## Gateway WebSocket ログ

Gateway（ゲートウェイ）は、WebSocket プロトコルのログを 2 つのモードで出力します。

- **通常モード（`--verbose` なし）**：「重要」な RPC 結果のみを出力します。
  - エラー（`ok=false`）
  - 低速な呼び出し（既定のしきい値：`>= 50ms`）
  - パースエラー
- **Verbose モード（`--verbose`）**：すべての WS リクエスト／レスポンスのトラフィックを出力します。

### WS ログスタイル

`openclaw gateway` は Gateway（ゲートウェイ）ごとのスタイル切り替えをサポートします。

- `--ws-log auto`（既定）：通常モードは最適化され、Verbose モードではコンパクトな出力を使用します。
- `--ws-log compact`：Verbose 時にコンパクトな出力（リクエスト／レスポンスをペアで表示）
- `--ws-log full`：Verbose 時にフレーム単位の完全な出力
- `--compact`：`--ws-log compact` のエイリアス

例：

```bash
# optimized (only errors/slow)
openclaw gateway

# show all WS traffic (paired)
openclaw gateway --verbose --ws-log compact

# show all WS traffic (full meta)
openclaw gateway --verbose --ws-log full
```

## コンソールの書式設定（サブシステムのロギング）

コンソールフォーマッターは **TTY 対応** で、一貫した接頭辞付きの行を出力します。
サブシステムのロガーにより、出力はまとまりがあり、スキャンしやすくなります。

動作：

- **サブシステム接頭辞** を各行に付与（例：`[gateway]`、`[canvas]`、`[tailscale]`）
- **サブシステムごとの色分け**（サブシステムごとに安定）に加え、レベルの色分け
- **出力が TTY の場合、またはリッチなターミナルと判断される環境の場合に着色**（`TERM`/`COLORTERM`/`TERM_PROGRAM`）。`NO_COLOR` を尊重します。
- **短縮されたサブシステム接頭辞**：先頭の `gateway/` + `channels/` を省略し、末尾 2 セグメントを保持（例：`whatsapp/outbound`）
- **サブシステム別のサブロガー**（自動接頭辞 + 構造化フィールド `{ subsystem }`）
- **`logRaw()`**：QR/UX 出力用（接頭辞なし、書式設定なし）
- **コンソールスタイル**（例：`pretty | compact | json`）
- **コンソールのログレベル** はファイルのログレベルと分離（`logging.level` を `debug`/`trace` に設定すると、ファイルは完全な詳細を保持）
- **WhatsApp メッセージ本文** は `debug` でログされます（表示するには `--verbose` を使用）

これにより、既存のファイルログを安定させつつ、対話的な出力をスキャンしやすくします。
