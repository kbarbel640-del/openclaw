---
summary: "`openclaw nodes` の CLI リファレンス（list/status/approve/invoke、camera/canvas/screen）"
read_when:
  - ペアリングされたノード（カメラ、画面、キャンバス）を管理しているとき
  - リクエストを承認したり、ノードコマンドを呼び出したりする必要があるとき
title: "nodes（ノード）"
x-i18n:
  source_path: cli/nodes.md
  source_hash: 23da6efdd659a82d
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:00:59Z
---

# `openclaw nodes`

ペアリングされたノード（デバイス）を管理し、ノードの機能を呼び出します。

関連:

- ノードの概要: [ノード](/nodes)
- カメラ: [カメラノード](/nodes/camera)
- 画像: [画像ノード](/nodes/images)

共通オプション:

- `--url`, `--token`, `--timeout`, `--json`

## 共通コマンド

```bash
openclaw nodes list
openclaw nodes list --connected
openclaw nodes list --last-connected 24h
openclaw nodes pending
openclaw nodes approve <requestId>
openclaw nodes status
openclaw nodes status --connected
openclaw nodes status --last-connected 24h
```

`nodes list` は pending/paired のテーブルを出力します。paired の行には、直近の接続からの経過時間（「Last Connect」）が含まれます。
`--connected` を使用すると、現在接続されているノードのみを表示します。`--last-connected <duration>` を使用すると、
指定した期間内に接続したノードに絞り込めます（例: `24h`, `7d`）。

## 呼び出し / 実行

```bash
openclaw nodes invoke --node <id|name|ip> --command <command> --params <json>
openclaw nodes run --node <id|name|ip> <command...>
openclaw nodes run --raw "git status"
openclaw nodes run --agent main --node <id|name|ip> --raw "git status"
```

呼び出しフラグ:

- `--params <json>`: JSON オブジェクト文字列（デフォルト `{}`）。
- `--invoke-timeout <ms>`: ノード呼び出しタイムアウト（デフォルト `15000`）。
- `--idempotency-key <key>`: 任意の冪等性キー。

### Exec 形式のデフォルト

`nodes run` は、モデルの exec の挙動（デフォルト + 承認）を反映します:

- `tools.exec.*`（および `agents.list[].tools.exec.*` の上書き）を読み取ります。
- `system.run` を呼び出す前に、exec の承認（`exec.approval.request`）を使用します。
- `tools.exec.node` が設定されている場合、`--node` は省略できます。
- `system.run` をアドバタイズするノードが必要です（macOS コンパニオンアプリ、またはヘッドレスなノードホスト）。

フラグ:

- `--cwd <path>`: 作業ディレクトリ。
- `--env <key=val>`: 環境変数の上書き（繰り返し指定可）。
- `--command-timeout <ms>`: コマンドタイムアウト。
- `--invoke-timeout <ms>`: ノード呼び出しタイムアウト（デフォルト `30000`）。
- `--needs-screen-recording`: 画面収録権限を必須にします。
- `--raw <command>`: シェル文字列を実行します（`/bin/sh -lc` または `cmd.exe /c`）。
- `--agent <id>`: エージェントスコープの承認/許可リスト（設定済みエージェントがデフォルト）。
- `--ask <off|on-miss|always>`, `--security <deny|allowlist|full>`: 上書き。
