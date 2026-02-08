---
summary: "バックグラウンド exec 実行とプロセス管理"
read_when:
  - バックグラウンド exec の挙動を追加または変更する場合
  - 長時間実行される exec タスクをデバッグする場合
title: "バックグラウンド Exec と Process ツール"
x-i18n:
  source_path: gateway/background-process.md
  source_hash: e11a7d74a75000d6
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:20:33Z
---

# バックグラウンド Exec + Process ツール

OpenClaw は `exec` ツールを通じてシェルコマンドを実行し、長時間実行されるタスクをメモリ上に保持します。`process` ツールは、それらのバックグラウンドセッションを管理します。

## exec ツール

主要パラメータ:

- `command`（必須）
- `yieldMs`（デフォルト 10000）: この遅延後に自動でバックグラウンド化します
- `background`（bool）: 即座にバックグラウンド化します
- `timeout`（秒、デフォルト 1800）: このタイムアウト後にプロセスを終了します
- `elevated`（bool）: 特権モードが有効/許可されている場合はホスト上で実行します
- 実際の TTY が必要ですか？`pty: true` を設定してください。
- `workdir`、`env`

挙動:

- フォアグラウンド実行は出力を直接返します。
- バックグラウンド化（明示的、またはタイムアウトによる）されると、ツールは `status: "running"` + `sessionId` と短い末尾出力を返します。
- 出力は、セッションがポーリングされるかクリアされるまでメモリ上に保持されます。
- `process` ツールが許可されていない場合、`exec` は同期実行され、`yieldMs`/`background` を無視します。

## 子プロセスのブリッジング

exec/process ツールの外で長時間実行される子プロセスを生成する場合（例: CLI の再生成や Gateway（ゲートウェイ）ヘルパー）、終了シグナルが転送され、終了/エラー時にリスナーがデタッチされるように、子プロセス・ブリッジのヘルパーをアタッチしてください。これにより systemd 上で孤児プロセスが発生するのを防ぎ、プラットフォーム間でシャットダウン挙動の一貫性を保てます。

環境変数による上書き:

- `PI_BASH_YIELD_MS`: デフォルト yield（ms）
- `PI_BASH_MAX_OUTPUT_CHARS`: メモリ内出力の上限（文字数）
- `OPENCLAW_BASH_PENDING_MAX_OUTPUT_CHARS`: ストリームごとの保留中 stdout/stderr の上限（文字数）
- `PI_BASH_JOB_TTL_MS`: 完了済みセッションの TTL（ms、1 分〜 3 時間に制限）

設定（推奨）:

- `tools.exec.backgroundMs`（デフォルト 10000）
- `tools.exec.timeoutSec`（デフォルト 1800）
- `tools.exec.cleanupMs`（デフォルト 1800000）
- `tools.exec.notifyOnExit`（デフォルト true）: バックグラウンド化された exec が終了した際に、システムイベントをキューに入れ + リクエストのハートビートを要求します。

## process ツール

アクション:

- `list`: 実行中 + 完了済みセッション
- `poll`: セッションの新規出力をドレインします（終了ステータスも報告します）
- `log`: 集約された出力を読み取ります（`offset` + `limit` をサポート）
- `write`: stdin を送信します（`data`、任意で `eof`）
- `kill`: バックグラウンドセッションを終了します
- `clear`: 完了済みセッションをメモリから削除します
- `remove`: 実行中なら kill、そうでなければ完了済みならクリアします

注記:

- 一覧表示/メモリ保持されるのはバックグラウンド化されたセッションのみです。
- セッションはプロセス再起動時に失われます（ディスク永続化はありません）。
- セッションログがチャット履歴に保存されるのは、`process poll/log` を実行し、そのツール結果が記録された場合のみです。
- `process` はエージェント単位のスコープであり、そのエージェントが開始したセッションのみを参照できます。
- `process list` には、簡易スキャン用に派生した `name`（コマンド動詞 + ターゲット）が含まれます。
- `process log` は行ベースの `offset`/`limit` を使用します（直近 N 行を取得するには `offset` を省略します）。

## 例

長いタスクを実行し、後でポーリングする:

```json
{ "tool": "exec", "command": "sleep 5 && echo done", "yieldMs": 1000 }
```

```json
{ "tool": "process", "action": "poll", "sessionId": "<id>" }
```

バックグラウンドで直ちに開始する:

```json
{ "tool": "exec", "command": "npm run build", "background": true }
```

stdin を送信する:

```json
{ "tool": "process", "action": "write", "sessionId": "<id>", "data": "y\n" }
```
