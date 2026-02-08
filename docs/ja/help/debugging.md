---
summary: "デバッグツール: ウォッチモード、生のモデルストリーム、推論リークのトレース"
read_when:
  - 推論リークを確認するために生のモデル出力を検査する必要がある場合
  - 反復作業中に Gateway（ゲートウェイ） をウォッチモードで実行したい場合
  - 再現可能なデバッグワークフローが必要な場合
title: "デバッグ"
x-i18n:
  source_path: help/debugging.md
  source_hash: 504c824bff479000
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:51Z
---

# デバッグ

このページでは、ストリーミング出力のデバッグ用ヘルパーを扱います。特に、プロバイダーが通常のテキストに推論を混在させる場合に有用です。

## ランタイムのデバッグ上書き

チャットで `/debug` を使用すると、**ランタイムのみ** の設定上書き（ディスクではなくメモリ）を設定できます。
`/debug` はデフォルトで無効です。`commands.debug: true` で有効化してください。
`openclaw.json` を編集せずに、分かりにくい設定を切り替えたい場合に便利です。

例:

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug unset messages.responsePrefix
/debug reset
```

`/debug reset` は、すべての上書きをクリアしてオンディスクの設定に戻します。

## Gateway（ゲートウェイ）のウォッチモード

高速に反復するため、ファイルウォッチャー配下でゲートウェイを実行します。

```bash
pnpm gateway:watch --force
```

これは次に対応します。

```bash
tsx watch src/entry.ts gateway --force
```

`gateway:watch` の後にゲートウェイの CLI フラグを追加すると、再起動のたびにそれらが引き継がれます。

## Dev プロファイル + dev ゲートウェイ（--dev）

dev プロファイルを使用すると、状態を分離し、デバッグ向けに安全で使い捨て可能なセットアップを立ち上げられます。`--dev` フラグは **2 つ** あります。

- **グローバル `--dev`（プロファイル）:** 状態を `~/.openclaw-dev` 配下に分離し、ゲートウェイのポートを `19001` にデフォルト設定します（派生ポートもそれに合わせて移動します）。
- **`gateway --dev`:** 設定やワークスペースが存在しない場合に、デフォルト設定 + ワークスペースを自動作成します（BOOTSTRAP.md をスキップ）。

推奨フロー（dev プロファイル + dev ブートストラップ）:

```bash
pnpm gateway:dev
OPENCLAW_PROFILE=dev openclaw tui
```

まだグローバルインストールがない場合は、`pnpm openclaw ...` 経由で CLI を実行してください。

これにより実行される内容:

1. **プロファイルの分離**（グローバル `--dev`）
   - `OPENCLAW_PROFILE=dev`
   - `OPENCLAW_STATE_DIR=~/.openclaw-dev`
   - `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
   - `OPENCLAW_GATEWAY_PORT=19001`（ブラウザー / キャンバスもそれに応じて移動）

2. **Dev ブートストラップ**（`gateway --dev`）
   - 不足している場合は最小構成の設定を書き込みます（`gateway.mode=local`、loopback にバインド）。
   - `agent.workspace` を dev ワークスペースに設定します。
   - `agent.skipBootstrap=true` を設定します（BOOTSTRAP.md なし）。
   - 不足している場合はワークスペースファイルをシードします:
     `AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`。
   - デフォルトのアイデンティティ: **C3‑PO**（プロトコル・ドロイド）。
   - dev モードではチャンネルプロバイダーをスキップします（`OPENCLAW_SKIP_CHANNELS=1`）。

リセット手順（クリーンスタート）:

```bash
pnpm gateway:dev:reset
```

注記: `--dev` は **グローバル** なプロファイルフラグであり、一部のランナーでは消費されます。
明示的に指定する必要がある場合は、環境変数形式を使用してください。

```bash
OPENCLAW_PROFILE=dev openclaw gateway --dev --reset
```

`--reset` は、設定、資格情報、セッション、dev ワークスペースを消去し（`trash` を使用、`rm` は使用しません）、その後にデフォルトの dev セットアップを再作成します。

ヒント: すでに非 dev のゲートウェイが起動している場合（launchd/systemd）、先に停止してください。

```bash
openclaw gateway stop
```

## 生ストリームのログ記録（OpenClaw）

OpenClaw は、フィルタリングや整形の前に **生のアシスタントストリーム** をログに記録できます。
推論がプレーンテキストのデルタとして届いているのか（または別個の thinking ブロックとして届いているのか）を確認する最良の方法です。

CLI で有効化します。

```bash
pnpm gateway:watch --force --raw-stream
```

任意のパス指定:

```bash
pnpm gateway:watch --force --raw-stream --raw-stream-path ~/.openclaw/logs/raw-stream.jsonl
```

同等の環境変数:

```bash
OPENCLAW_RAW_STREAM=1
OPENCLAW_RAW_STREAM_PATH=~/.openclaw/logs/raw-stream.jsonl
```

デフォルトのファイル:

`~/.openclaw/logs/raw-stream.jsonl`

## 生チャンクのログ記録（pi-mono）

ブロックに解析される前の **生の OpenAI 互換チャンク** を取得するために、pi-mono は別のロガーを提供します。

```bash
PI_RAW_STREAM=1
```

任意のパス:

```bash
PI_RAW_STREAM_PATH=~/.pi-mono/logs/raw-openai-completions.jsonl
```

デフォルトのファイル:

`~/.pi-mono/logs/raw-openai-completions.jsonl`

> 注記: これは pi-mono の
> `openai-completions` プロバイダーを使用しているプロセスでのみ出力されます。

## セーフティに関する注意

- 生ストリームのログには、完全なプロンプト、ツール出力、ユーザーデータが含まれる場合があります。
- ログはローカルに保持し、デバッグ後に削除してください。
- ログを共有する場合は、事前にシークレットや PII を必ずマスキングしてください。
