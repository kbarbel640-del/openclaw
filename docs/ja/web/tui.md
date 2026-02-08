---
summary: "Terminal UI（TUI）：どのマシンからでも Gateway（ゲートウェイ）に接続"
read_when:
  - TUI の初心者向けウォークスルーが必要な場合
  - TUI の機能、コマンド、ショートカットの完全な一覧が必要な場合
title: "TUI"
x-i18n:
  source_path: web/tui.md
  source_hash: 6ab8174870e4722d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:54Z
---

# TUI（Terminal UI）

## クイックスタート

1. Gateway（ゲートウェイ）を起動します。

```bash
openclaw gateway
```

2. TUI を開きます。

```bash
openclaw tui
```

3. メッセージを入力して Enter を押します。

リモート Gateway（ゲートウェイ）:

```bash
openclaw tui --url ws://<host>:<port> --token <gateway-token>
```

Gateway（ゲートウェイ）がパスワード認証を使用している場合は `--password` を使用します。

## 画面の見方

- ヘッダー: 接続 URL、現在のエージェント、現在のセッション。
- チャットログ: ユーザーメッセージ、アシスタントの返信、システム通知、ツールカード。
- ステータス行: 接続／実行状態（connecting、running、streaming、idle、error）。
- フッター: 接続状態 + エージェント + セッション + モデル + think／verbose／reasoning + トークン数 + deliver。
- 入力欄: オートコンプリート付きテキストエディター。

## メンタルモデル: エージェント + セッション

- エージェントは一意のスラッグです（例: `main`、`research`）。Gateway（ゲートウェイ）が一覧を公開します。
- セッションは現在のエージェントに属します。
- セッションキーは `agent:<agentId>:<sessionKey>` として保存されます。
  - `/session main` を入力すると、TUI は `agent:<currentAgent>:main` に展開します。
  - `/session agent:other:main` を入力すると、そのエージェントのセッションに明示的に切り替わります。
- セッションスコープ:
  - `per-sender`（デフォルト）: 各エージェントは複数のセッションを持ちます。
  - `global`: TUI は常に `global` セッションを使用します（ピッカーは空になる場合があります）。
- 現在のエージェント + セッションは常にフッターに表示されます。

## 送信 + デリバリー

- メッセージは Gateway（ゲートウェイ）に送信されます。プロバイダーへのデリバリーはデフォルトでオフです。
- デリバリーを有効化:
  - `/deliver on`
  - または Settings パネル
  - または `openclaw tui --deliver` を付けて起動

## ピッカー + オーバーレイ

- モデルピッカー: 利用可能なモデルを一覧表示し、セッションの上書きを設定します。
- エージェントピッカー: 別のエージェントを選択します。
- セッションピッカー: 現在のエージェントのセッションのみを表示します。
- Settings: deliver、ツール出力の展開、思考表示の切り替え。

## キーボードショートカット

- Enter: メッセージ送信
- Esc: 実行中のランを中止
- Ctrl+C: 入力をクリア（2 回押すと終了）
- Ctrl+D: 終了
- Ctrl+L: モデルピッカー
- Ctrl+G: エージェントピッカー
- Ctrl+P: セッションピッカー
- Ctrl+O: ツール出力の展開を切り替え
- Ctrl+T: 思考表示を切り替え（履歴を再読み込み）

## スラッシュコマンド

コア:

- `/help`
- `/status`
- `/agent <id>`（または `/agents`）
- `/session <key>`（または `/sessions`）
- `/model <provider/model>`（または `/models`）

セッション制御:

- `/think <off|minimal|low|medium|high>`
- `/verbose <on|full|off>`
- `/reasoning <on|off|stream>`
- `/usage <off|tokens|full>`
- `/elevated <on|off|ask|full>`（エイリアス: `/elev`）
- `/activation <mention|always>`
- `/deliver <on|off>`

セッションライフサイクル:

- `/new` または `/reset`（セッションをリセット）
- `/abort`（実行中のランを中止）
- `/settings`
- `/exit`

その他の Gateway（ゲートウェイ）のスラッシュコマンド（例: `/context`）は Gateway（ゲートウェイ）に転送され、システム出力として表示されます。詳細は [Slash commands](/tools/slash-commands) を参照してください。

## ローカルシェルコマンド

- 行頭に `!` を付けると、TUI ホスト上でローカルシェルコマンドを実行します。
- TUI はセッションごとに 1 回、ローカル実行の許可を求めます。拒否すると、そのセッションでは `!` が無効のままになります。
- コマンドは TUI の作業ディレクトリで、新しい非対話型シェルとして実行されます（永続的な `cd`/env はありません）。
- 単独の `!` は通常のメッセージとして送信されます。行頭のスペースはローカル実行をトリガーしません。

## ツール出力

- ツール呼び出しは、引数 + 結果を含むカードとして表示されます。
- Ctrl+O で折りたたみ／展開表示を切り替えます。
- ツール実行中は、部分的な更新が同じカードにストリームされます。

## 履歴 + ストリーミング

- 接続時に、TUI は最新の履歴を読み込みます（デフォルト 200 メッセージ）。
- ストリーミング応答は、確定するまでその場で更新されます。
- TUI はエージェントのツールイベントもリッスンし、よりリッチなツールカードを表示します。

## 接続の詳細

- TUI は Gateway（ゲートウェイ）に `mode: "tui"` として登録されます。
- 再接続時にはシステムメッセージが表示され、イベントの欠落はログに表示されます。

## オプション

- `--url <url>`: Gateway（ゲートウェイ）WebSocket URL（設定または `ws://127.0.0.1:<port>` がデフォルト）
- `--token <token>`: Gateway（ゲートウェイ）トークン（必要な場合）
- `--password <password>`: Gateway（ゲートウェイ）パスワード（必要な場合）
- `--session <key>`: セッションキー（デフォルト: `main`、スコープが global の場合は `global`）
- `--deliver`: アシスタントの返信をプロバイダーにデリバリー（デフォルトはオフ）
- `--thinking <level>`: 送信時の思考レベルを上書き
- `--timeout-ms <ms>`: エージェントのタイムアウト（ミリ秒、デフォルトは `agents.defaults.timeoutSeconds`）

注記: `--url` を設定すると、TUI は設定や環境の認証情報にフォールバックしません。
`--token` または `--password` を明示的に渡してください。明示的な認証情報が欠落している場合はエラーになります。

## トラブルシューティング

メッセージ送信後に出力がない場合:

- TUI で `/status` を実行し、Gateway（ゲートウェイ）が接続され idle／busy であることを確認します。
- Gateway（ゲートウェイ）のログを確認します: `openclaw logs --follow`。
- エージェントが実行可能であることを確認します: `openclaw status` と `openclaw models status`。
- チャットチャンネルにメッセージが届く想定の場合は、デリバリーを有効化します（`/deliver on` または `--deliver`）。
- `--history-limit <n>`: 読み込む履歴エントリー数（デフォルト 200）

## 接続トラブルシューティング

- `disconnected`: Gateway（ゲートウェイ）が実行中で、`--url/--token/--password` が正しいことを確認します。
- ピッカーにエージェントが表示されない: `openclaw agents list` とルーティング設定を確認してください。
- セッションピッカーが空: グローバルスコープであるか、まだセッションがない可能性があります。
