---
summary: "サブエージェント: リクエスターのチャットへ結果を通知する、分離されたエージェント実行をスポーンします"
read_when:
  - エージェントによるバックグラウンド/並列作業が必要な場合
  - sessions_spawn またはサブエージェントのツールポリシーを変更する場合
title: "サブエージェント"
x-i18n:
  source_path: tools/subagents.md
  source_hash: 3c83eeed69a65dbb
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:13:13Z
---

# サブエージェント

サブエージェントは、既存のエージェント実行からスポーンされるバックグラウンドのエージェント実行です。サブエージェントは自身のセッション（`agent:<agentId>:subagent:<uuid>`）で実行され、完了すると、リクエスターのチャットチャンネルへ結果を **通知** します。

## スラッシュコマンド

**現在のセッション** のサブエージェント実行を確認または制御するには、`/subagents` を使用します。

- `/subagents list`
- `/subagents stop <id|#|all>`
- `/subagents log <id|#> [limit] [tools]`
- `/subagents info <id|#>`
- `/subagents send <id|#> <message>`

`/subagents info` は、実行メタデータ（ステータス、タイムスタンプ、セッション ID、トランスクリプトパス、クリーンアップ）を表示します。

主な目的:

- 「調査 / 長いタスク / 遅いツール」の作業を、メインの実行をブロックせずに並列化します。
- デフォルトでサブエージェントを分離して維持します（セッション分離 + オプションのサンドボックス化）。
- ツールの利用範囲を誤用しにくくします。サブエージェントはデフォルトでセッションツールを取得しません。
- ネストしたファンアウトを回避します。サブエージェントはサブエージェントをスポーンできません。

コストに関する注意: 各サブエージェントは **自身の** コンテキストとトークン使用量を持ちます。重いタスクや反復的なタスクでは、サブエージェントにより安価なモデルを設定し、メインのエージェントはより高品質なモデルのままにしてください。これは `agents.defaults.subagents.model`、またはエージェントごとのオーバーライドで設定できます。

## ツール

`sessions_spawn` を使用します:

- サブエージェント実行を開始します（`deliver: false`、グローバルレーン: `subagent`）
- 続いて通知ステップを実行し、通知返信をリクエスターのチャットチャンネルへ投稿します
- デフォルトのモデル: `agents.defaults.subagents.model`（またはエージェントごとの `agents.list[].subagents.model`）を設定しない限り、呼び出し元を継承します。明示的な `sessions_spawn.model` は引き続き優先されます。
- デフォルトの思考: `agents.defaults.subagents.thinking`（またはエージェントごとの `agents.list[].subagents.thinking`）を設定しない限り、呼び出し元を継承します。明示的な `sessions_spawn.thinking` は引き続き優先されます。

ツールパラメータ:

- `task`（必須）
- `label?`（任意）
- `agentId?`（任意。許可されている場合は別のエージェント ID の配下でスポーンします）
- `model?`（任意。サブエージェントのモデルを上書きします。不正な値はスキップされ、ツール結果に警告を出したうえでサブエージェントはデフォルトモデルで実行されます）
- `thinking?`（任意。サブエージェント実行の思考レベルを上書きします）
- `runTimeoutSeconds?`（デフォルト `0`。設定すると、N 秒後にサブエージェント実行が中断されます）
- `cleanup?`（`delete|keep`、デフォルト `keep`）

許可リスト:

- `agents.list[].subagents.allowAgents`: `agentId` でターゲット可能なエージェント ID のリスト（任意を許可する場合は `["*"]`）。デフォルト: リクエスターエージェントのみ。

デバイス検出:

- `sessions_spawn` に対して現在許可されているエージェント ID を確認するには、`agents_list` を使用します。

自動アーカイブ:

- サブエージェントセッションは、`agents.defaults.subagents.archiveAfterMinutes` 後に自動的にアーカイブされます（デフォルト: 60）。
- アーカイブは `sessions.delete` を使用し、トランスクリプトを `*.deleted.<timestamp>` にリネームします（同一フォルダ）。
- `cleanup: "delete"` は、通知後すぐにアーカイブします（リネームによりトランスクリプトは保持されます）。
- 自動アーカイブはベストエフォートです。Gateway（ゲートウェイ）が再起動すると、保留中のタイマーは失われます。
- `runTimeoutSeconds` は自動アーカイブしません。実行を停止するだけです。セッションは自動アーカイブまで残ります。

## 認証

サブエージェントの認証は、セッション種別ではなく **エージェント ID** によって解決されます。

- サブエージェントのセッションキーは `agent:<agentId>:subagent:<uuid>` です。
- 認証ストアは、そのエージェントの `agentDir` から読み込まれます。
- メインエージェントの認証プロファイルは **フォールバック** としてマージされます。競合時はエージェントのプロファイルがメインのプロファイルを上書きします。

注: マージは加算的であるため、メインのプロファイルは常にフォールバックとして利用可能です。エージェントごとに完全に分離された認証は、まだサポートされていません。

## 通知

サブエージェントは通知ステップを通じて報告します。

- 通知ステップはサブエージェントセッション内（リクエスターセッションではない）で実行されます。
- サブエージェントがちょうど `ANNOUNCE_SKIP` と返信した場合、何も投稿されません。
- それ以外の場合、通知返信はフォローアップの `agent` 呼び出し（`deliver=true`）により、リクエスターのチャットチャンネルへ投稿されます。
- 通知返信は、利用可能な場合にスレッド/トピックのルーティングを保持します（Slack スレッド、Telegram トピック、Matrix スレッド）。
- 通知メッセージは安定したテンプレートへ正規化されます:
  - 実行結果（`success`、`error`、`timeout`、または `unknown`）から導出された `Status:`。
  - 通知ステップから得た要約内容である `Result:`（欠落している場合は `(not available)`）。
  - エラー詳細やその他有用なコンテキストである `Notes:`。
- `Status` はモデル出力から推論されません。ランタイムの結果シグナルに由来します。

通知ペイロードには末尾に統計行が含まれます（ラップされている場合でも）。

- 実行時間（例: `runtime 5m12s`）
- トークン使用量（入力/出力/合計）
- モデル価格が設定されている場合の推定コスト（`models.providers.*.models[].cost`）
- `sessionKey`、`sessionId`、およびトランスクリプトパス（メインエージェントが `sessions_history` で履歴を取得する、またはディスク上のファイルを調査できるようにするため）

## ツールポリシー（サブエージェントツール）

デフォルトでは、サブエージェントは **セッションツール以外のすべてのツール** を取得します。

- `sessions_list`
- `sessions_history`
- `sessions_send`
- `sessions_spawn`

設定で上書きします:

```json5
{
  agents: {
    defaults: {
      subagents: {
        maxConcurrent: 1,
      },
    },
  },
  tools: {
    subagents: {
      tools: {
        // deny wins
        deny: ["gateway", "cron"],
        // if allow is set, it becomes allow-only (deny still wins)
        // allow: ["read", "exec", "process"]
      },
    },
  },
}
```

## 並行性

サブエージェントは、プロセス内の専用キューレーンを使用します。

- レーン名: `subagent`
- 並行性: `agents.defaults.subagents.maxConcurrent`（デフォルト `8`）

## 停止

- リクエスターのチャットで `/stop` を送信すると、リクエスターセッションが中断され、そこからスポーンされたアクティブなサブエージェント実行も停止します。

## 制限事項

- サブエージェントの通知は **ベストエフォート** です。Gateway（ゲートウェイ）が再起動すると、保留中の「通知して返す」作業は失われます。
- サブエージェントは同じ Gateway（ゲートウェイ）プロセスのリソースを共有します。`maxConcurrent` は安全弁として扱ってください。
- `sessions_spawn` は常にノンブロッキングです。`{ status: "accepted", runId, childSessionKey }` を直ちに返します。
- サブエージェントのコンテキストは `AGENTS.md` + `TOOLS.md` のみを注入します（`SOUL.md`、`IDENTITY.md`、`USER.md`、`HEARTBEAT.md`、または `BOOTSTRAP.md` は注入しません）。
