---
summary: "デバッグツール: ウォッチモード、生のモデルストリーム、推論漏えいのトレース"
read_when:
  - 推論漏えいを調べるために生のモデル出力を確認する必要がある場合
  - 反復作業中に Gateway（ゲートウェイ）をウォッチモードで実行したい場合
  - 再現可能なデバッグワークフローが必要な場合
title: "デバッグ"
x-i18n:
  source_path: debugging.md
  source_hash: 504c824bff479000
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:14:02Z
---

# デバッグ

このページでは、ストリーミング出力のデバッグ用ヘルパーについて説明します。特に、プロバイダーが推論を通常テキストに混ぜてしまう場合に役立ちます。

## 実行時のデバッグ上書き

チャット内で `/debug` を使用すると、**実行時のみ**の設定上書き（ディスクではなくメモリ）を設定できます。
`/debug` はデフォルトで無効です。`commands.debug: true` で有効化します。
これは、`openclaw.json` を編集せずに、あまり使われない設定を切り替える必要がある場合に便利です。

例:

```
/debug show
/debug set messages.responsePrefix="[openclaw]"
/debug unset messages.responsePrefix
/debug reset
```

`/debug reset` はすべての上書きをクリアし、オンディスクの設定に戻します。

## Gateway（ゲートウェイ）のウォッチモード

高速に反復するために、ファイルウォッチャー配下で Gateway（ゲートウェイ）を実行します。

```bash
pnpm gateway:watch --force
```

これは次に対応します:

```bash
tsx watch src/entry.ts gateway --force
```

`gateway:watch` の後に任意の gateway CLI フラグを追加すると、再起動のたびにそれらが引き継がれます。

## Dev プロファイル + dev gateway (--dev)

dev プロファイルを使用して状態を分離し、デバッグのための安全で使い捨て可能なセットアップを起動します。`--dev` フラグは **2 つ**あります。

- **グローバル `--dev`（プロファイル）:** `~/.openclaw-dev` 配下で状態を分離し、gateway ポートのデフォルトを `19001` にします（派生ポートもそれに合わせてシフトします）。
- **`gateway --dev`: 設定 + ワークスペースが存在しない場合に、Gateway（ゲートウェイ）へデフォルト設定 + ワークスペースの自動作成を指示します（そして BOOTSTRAP.md をスキップします）。**

推奨フロー（dev プロファイル + dev ブートストラップ）:

```bash
pnpm gateway:dev
OPENCLAW_PROFILE=dev openclaw tui
```

まだグローバルインストールがない場合は、`pnpm openclaw ...` 経由で CLI を実行します。

これにより行われること:

1. **プロファイル分離**（グローバル `--dev`）
   - `OPENCLAW_PROFILE=dev`
   - `OPENCLAW_STATE_DIR=~/.openclaw-dev`
   - `OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json`
   - `OPENCLAW_GATEWAY_PORT=19001`（browser/canvas もそれに応じてシフトします）

2. **Dev ブートストラップ**（`gateway --dev`）
   - 存在しない場合は最小構成の設定を書き込みます（`gateway.mode=local`、bind loopback）。
   - `agent.workspace` を dev ワークスペースに設定します。
   - `agent.skipBootstrap=true` を設定します（BOOTSTRAP.md なし）。
   - 存在しない場合はワークスペースファイルをシードします:
     `AGENTS.md`、`SOUL.md`、`TOOLS.md`、`IDENTITY.md`、`USER.md`、`HEARTBEAT.md`。
   - デフォルトのアイデンティティ: **C3‑PO**（プロトコルドロイド）。
   - dev モードではチャンネルプロバイダーをスキップします（`OPENCLAW_SKIP_CHANNELS=1`）。

リセットフロー（クリーンスタート）:

```bash
pnpm gateway:dev:reset
```

注: `--dev` は **グローバル**プロファイルフラグであり、一部のランナーによって消費されます。
明示的に指定する必要がある場合は、環境変数形式を使用してください:

```bash
OPENCLAW_PROFILE=dev openclaw gateway --dev --reset
```

`--reset` は設定、認証情報、セッション、および dev ワークスペースを消去し（`rm` ではなく `trash` を使用）、その後デフォルトの dev セットアップを再作成します。

ヒント: 非 dev の Gateway（ゲートウェイ）がすでに（launchd/systemd で）稼働している場合は、先に停止してください:

```bash
openclaw gateway stop
```

## 生ストリームログ（OpenClaw）

OpenClaw は、フィルタリング/フォーマット前の **生の assistant ストリーム**をログに残せます。
これは、推論がプレーンテキストのデルタとして届いているのか（または別個の thinking ブロックとして届いているのか）を確認する最良の方法です。

CLI で有効化します:

```bash
pnpm gateway:watch --force --raw-stream
```

任意のパス上書き:

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

## 生チャンクログ（pi-mono）

ブロックへ解析される前の **生の OpenAI-compat チャンク**をキャプチャするために、pi-mono は別のロガーを公開しています:

```bash
PI_RAW_STREAM=1
```

任意のパス:

```bash
PI_RAW_STREAM_PATH=~/.pi-mono/logs/raw-openai-completions.jsonl
```

デフォルトのファイル:

`~/.pi-mono/logs/raw-openai-completions.jsonl`

> 注: これは pi-mono の
> `openai-completions` プロバイダーを使用しているプロセスからのみ出力されます。

## 安全上の注意

- 生ストリームログには、完全なプロンプト、ツール出力、ユーザーデータが含まれる場合があります。
- ログはローカルに保管し、デバッグ後に削除してください。
- ログを共有する場合は、先にシークレットと PII を必ずマスクしてください。
