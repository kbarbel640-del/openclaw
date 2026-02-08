---
summary: "エージェントループのライフサイクル、ストリーム、および待機セマンティクス"
read_when:
  - エージェントループまたはライフサイクルイベントの正確なウォークスルーが必要な場合
title: "エージェントループ"
x-i18n:
  source_path: concepts/agent-loop.md
  source_hash: 0775b96eb3451e13
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:02:35Z
---

# エージェントループ（OpenClaw）

エージェントループは、エージェントの完全な「実際の」実行です。取り込み → コンテキスト組み立て → モデル推論 →
ツール実行 → 返信ストリーミング → 永続化。これは、セッション状態の整合性を保ちながら、メッセージをアクションと最終返信へ変換する、権威ある経路です。

OpenClaw では、ループはセッションごとに単一の直列化された実行であり、モデルが思考し、ツールを呼び出し、出力をストリーミングする間にライフサイクルおよびストリームイベントを発行します。このドキュメントでは、その真正なループがエンドツーエンドでどのように配線されているかを説明します。

## エントリーポイント

- Gateway（ゲートウェイ） RPC: `agent` および `agent.wait`。
- CLI: `agent` コマンド。

## 仕組み（高レベル）

1. `agent` RPC はパラメータを検証し、セッション（sessionKey/sessionId）を解決し、セッションメタデータを永続化し、直ちに `{ runId, acceptedAt }` を返します。
2. `agentCommand` がエージェントを実行します:
   - モデル + thinking/verbose のデフォルトを解決
   - Skills スナップショットをロード
   - `runEmbeddedPiAgent`（pi-agent-core runtime）を呼び出し
   - 埋め込みループが **lifecycle end/error** を発行しない場合、**lifecycle end/error** を発行
3. `runEmbeddedPiAgent`:
   - セッションごと + グローバルのキューにより実行を直列化
   - モデル + auth プロファイルを解決し、pi セッションを構築
   - pi イベントを購読し、assistant/tool の差分をストリーミング
   - タイムアウトを強制 -> 超過時は実行を中止
   - ペイロード + 使用量メタデータを返却
4. `subscribeEmbeddedPiSession` は pi-agent-core イベントを OpenClaw の `agent` ストリームへブリッジします:
   - tool イベント => `stream: "tool"`
   - assistant の差分 => `stream: "assistant"`
   - lifecycle イベント => `stream: "lifecycle"`（`phase: "start" | "end" | "error"`）
5. `agent.wait` は `waitForAgentJob` を使用します:
   - `runId` のために **lifecycle end/error** を待機
   - `{ status: ok|error|timeout, startedAt, endedAt, error? }` を返却

## キューイング + 並行性

- 実行はセッションキーごと（セッションレーン）に直列化され、必要に応じてグローバルレーンも経由します。
- これによりツール/セッションの競合を防ぎ、セッション履歴の整合性を保ちます。
- メッセージングチャンネルは、このレーンシステムへ投入するキューモード（collect/steer/followup）を選択できます。
  [Command Queue](/concepts/queue) を参照してください。

## セッション + ワークスペース準備

- ワークスペースを解決して作成します。サンドボックス化された実行では、サンドボックスのワークスペースルートへリダイレクトする場合があります。
- Skills を読み込み（またはスナップショットから再利用し）、env とプロンプトへ注入します。
- ブートストラップ/コンテキストファイルを解決し、システムプロンプトレポートへ注入します。
- セッション書き込みロックを取得し、ストリーミング前に `SessionManager` を開いて準備します。

## プロンプト組み立て + システムプロンプト

- システムプロンプトは、OpenClaw のベースプロンプト、Skills プロンプト、ブートストラップコンテキスト、および実行ごとのオーバーライドから構築されます。
- モデル固有の制限と compaction 予約トークンが適用されます。
- モデルに何が見えるかは [System prompt](/concepts/system-prompt) を参照してください。

## フックポイント（介入できる場所）

OpenClaw には 2 つのフックシステムがあります:

- **内部フック**（Gateway（ゲートウェイ） フック）: コマンドおよびライフサイクルイベント向けのイベント駆動スクリプト。
- **プラグインフック**: エージェント/ツールのライフサイクルおよび gateway パイプライン内部の拡張ポイント。

### 内部フック（Gateway（ゲートウェイ） フック）

- **`agent:bootstrap`**: システムプロンプトが確定する前に、ブートストラップファイルを構築している間に実行されます。
  これを使用して、ブートストラップコンテキストファイルを追加/削除します。
- **コマンドフック**: `/new`、`/reset`、`/stop`、およびその他のコマンドイベント（Hooks ドキュメントを参照）。

セットアップと例については [Hooks](/hooks) を参照してください。

### プラグインフック（エージェント + gateway ライフサイクル）

これらはエージェントループまたは gateway パイプライン内部で実行されます:

- **`before_agent_start`**: 実行開始前に、コンテキストを注入するか、システムプロンプトをオーバーライドします。
- **`agent_end`**: 完了後に、最終メッセージリストと実行メタデータを検査します。
- **`before_compaction` / `after_compaction`**: compaction サイクルを観測または注釈付けします。
- **`before_tool_call` / `after_tool_call`**: ツールのパラメータ/結果をインターセプトします。
- **`tool_result_persist`**: ツール結果がセッショントランスクリプトへ書き込まれる前に、同期的に変換します。
- **`message_received` / `message_sending` / `message_sent`**: 受信 + 送信のメッセージフック。
- **`session_start` / `session_end`**: セッションライフサイクル境界。
- **`gateway_start` / `gateway_stop`**: gateway ライフサイクルイベント。

フック API と登録の詳細は [Plugins](/plugin#plugin-hooks) を参照してください。

## ストリーミング + 部分返信

- assistant の差分は pi-agent-core からストリーミングされ、`assistant` イベントとして発行されます。
- ブロックストリーミングは、`text_end` または `message_end` のいずれかで部分返信を発行できます。
- 推論のストリーミングは、別ストリームとして、またはブロック返信として発行できます。
- チャンク化とブロック返信の挙動については [Streaming](/concepts/streaming) を参照してください。

## ツール実行 + メッセージングツール

- ツールの start/update/end イベントは `tool` ストリームで発行されます。
- ツール結果は、ログ記録/発行の前に、サイズおよび画像ペイロードの観点でサニタイズされます。
- メッセージングツールの送信は追跡され、重複する assistant 確認を抑止します。

## 返信整形 + 抑止

- 最終ペイロードは次から組み立てられます:
  - assistant テキスト（および任意の推論）
  - インラインツール要約（verbose かつ許可されている場合）
  - モデルがエラーになった場合の assistant エラーテキスト
- `NO_REPLY` はサイレントトークンとして扱われ、送信ペイロードからフィルタリングされます。
- メッセージングツールの重複は、最終ペイロードリストから削除されます。
- レンダリング可能なペイロードが残らず、かつツールがエラーになった場合、フォールバックのツールエラー返信が発行されます
  （ただし、メッセージングツールがすでにユーザーに見える返信を送信している場合を除きます）。

## Compaction + リトライ

- 自動 compaction は `compaction` ストリームイベントを発行し、リトライをトリガーする場合があります。
- リトライ時は、重複出力を避けるために、インメモリバッファとツール要約がリセットされます。
- compaction パイプラインについては [Compaction](/concepts/compaction) を参照してください。

## イベントストリーム（現状）

- `lifecycle`: `subscribeEmbeddedPiSession` により発行（フォールバックとして `agentCommand` によっても発行）
- `assistant`: pi-agent-core からのストリーミング差分
- `tool`: pi-agent-core からのストリーミングツールイベント

## チャットチャンネル処理

- assistant の差分はチャットの `delta` メッセージへバッファされます。
- **lifecycle end/error** 時に、チャットの `final` が発行されます。

## タイムアウト

- `agent.wait` デフォルト: 30 秒（待機のみ）。`timeoutMs` パラメータでオーバーライドします。
- エージェントランタイム: `agents.defaults.timeoutSeconds` デフォルト 600 秒。`runEmbeddedPiAgent` 中止タイマーで強制されます。

## 早期終了し得る箇所

- エージェントタイムアウト（中止）
- AbortSignal（キャンセル）
- Gateway（ゲートウェイ） 切断または RPC タイムアウト
- `agent.wait` タイムアウト（待機のみで、エージェントは停止しません）
