---
summary: "ターミナル UI（TUI）: どのマシンからでも Gateway（ゲートウェイ）に接続します"
read_when:
  - TUI の初心者向けウォークスルーが必要です
  - TUI の機能、コマンド、ショートカットの完全な一覧が必要です
title: "TUI"
x-i18n:
  source_path: tui.md
  source_hash: 1eb111456fe0aab6
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:12:45Z
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

Gateway（ゲートウェイ）がパスワード認証を使用している場合は、`--password` を使用します。

## 画面の見方

- ヘッダー: 接続 URL、現在のエージェント、現在のセッション。
- チャットログ: ユーザーメッセージ、アシスタントの返信、システム通知、ツールカード。
- ステータス行: 接続/実行状態（connecting、running、streaming、idle、error）。
- フッター: 接続状態 + エージェント + セッション + モデル + think/verbose/reasoning + トークン数 + deliver。
- 入力: オートコンプリート付きテキストエディター。

## メンタルモデル: エージェント + セッション

- エージェントは一意のスラッグです（例: `main`、`research`）。Gateway（ゲートウェイ）が一覧を公開します。
- セッションは現在のエージェントに属します。
- セッションキーは `agent:<agentId>:<sessionKey>` として保存されます。
  - `/session main` を入力すると、TUI はそれを `agent:<currentAgent>:main` に展開します。
  - `/session agent:other:main` を入力すると、そのエージェントセッションに明示的に切り替わります。
- セッションスコープ:
  - `per-sender`（デフォルト）: 各エージェントは複数のセッションを持ちます。
  - `global`: TUI は常に `global` セッションを使用します（ピッカーが空になる場合があります）。
- 現在のエージェント + セッションは常にフッターに表示されます。

## 送信 + 配信

- メッセージは Gateway（ゲートウェイ）に送信されます。プロバイダーへの配信はデフォルトでオフです。
- 配信をオンにする:
  - `/deliver on`
  - または設定パネル
  - または `openclaw tui --deliver` で起動します

## ピッカー + オーバーレイ

- モデルピッカー: 利用可能なモデルを一覧表示し、セッションのオーバーライドを設定します。
- エージェントピッカー: 別のエージェントを選択します。
- セッションピッカー: 現在のエージェントのセッションのみを表示します。
- 設定: deliver、ツール出力の展開、思考の可視性を切り替えます。

## キーボードショートカット

- Enter: メッセージを送信
- Esc: アクティブな実行を中止
- Ctrl+C: 入力をクリア（2 回押すと終了）
- Ctrl+D: 終了
- Ctrl+L: モデルピッカー
- Ctrl+G: エージェントピッカー
- Ctrl+P: セッションピッカー
- Ctrl+O: ツール出力の展開を切り替え
- Ctrl+T: 思考の可視性を切り替え（履歴を再読み込み）

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
- `/abort`（アクティブな実行を中止）
- `/settings`
- `/exit`

その他の Gateway（ゲートウェイ）のスラッシュコマンド（例: `/context`）は Gateway（ゲートウェイ）に転送され、システム出力として表示されます。[Slash commands](/tools/slash-commands) を参照してください。

## ローカルシェルコマンド

- 行の先頭に `!` を付けると、TUI ホスト上でローカルシェルコマンドを実行します。
- TUI はセッションごとに 1 回、ローカル実行を許可するかどうかを確認します。拒否すると、そのセッションでは `!` が無効のままになります。
- コマンドは TUI の作業ディレクトリで、新規の非対話型シェルとして実行されます（永続的な `cd`/env はありません）。
- 単独の `!` は通常のメッセージとして送信されます。先頭の空白はローカル実行をトリガーしません。

## ツール出力

- ツール呼び出しは、引数 + 結果を含むカードとして表示されます。
- Ctrl+O で、折りたたみ/展開ビューを切り替えます。
- ツールの実行中は、部分的な更新が同じカードにストリーミングされます。

## 履歴 + ストリーミング

- 接続時に、TUI は最新の履歴を読み込みます（デフォルト 200 件のメッセージ）。
- ストリーミング応答は、確定するまでその場で更新されます。
- TUI は、よりリッチなツールカードのために、エージェントのツールイベントもリッスンします。

## 接続の詳細

- TUI は `mode: "tui"` として Gateway（ゲートウェイ）に登録します。
- 再接続はシステムメッセージとして表示されます。イベントの欠落はログに表示されます。

## オプション

- `--url <url>`: Gateway（ゲートウェイ）WebSocket URL（デフォルトは設定または `ws://127.0.0.1:<port>`）
- `--token <token>`: Gateway（ゲートウェイ）トークン（必要な場合）
- `--password <password>`: Gateway（ゲートウェイ）パスワード（必要な場合）
- `--session <key>`: セッションキー（デフォルト: `main`、またはスコープがグローバルの場合は `global`）
- `--deliver`: アシスタントの返信をプロバイダーへ配信します（デフォルトはオフ）
- `--thinking <level>`: 送信時の思考レベルをオーバーライドします
- `--timeout-ms <ms>`: エージェントのタイムアウト（ms）（デフォルトは `agents.defaults.timeoutSeconds`）

注: `--url` を設定すると、TUI は設定や環境変数の認証情報にフォールバックしません。
`--token` または `--password` を明示的に渡してください。明示的な認証情報が不足している場合はエラーになります。

## トラブルシューティング

メッセージ送信後に出力がない場合:

- TUI で `/status` を実行して、Gateway（ゲートウェイ）が接続されており idle/busy であることを確認します。
- Gateway（ゲートウェイ）ログを確認します: `openclaw logs --follow`。
- エージェントが実行できることを確認します: `openclaw status` と `openclaw models status`。
- チャットチャンネルにメッセージが届くはずの場合は、配信を有効化します（`/deliver on` または `--deliver`）。
- `--history-limit <n>`: 読み込む履歴エントリ数（デフォルト 200）

## トラブルシューティング

- `disconnected`: Gateway（ゲートウェイ）が稼働していること、および `--url/--token/--password` が正しいことを確認します。
- ピッカーにエージェントが表示されない: `openclaw agents list` とルーティング設定を確認します。
- セッションピッカーが空: グローバルスコープであるか、まだセッションがない可能性があります。
