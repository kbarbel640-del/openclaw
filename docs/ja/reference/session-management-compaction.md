---
summary: "詳細解説: セッションストア + トランスクリプト、ライフサイクル、および（自動）コンパクションの内部"
read_when:
  - セッション id、トランスクリプト JSONL、または sessions.json のフィールドをデバッグする必要がある場合
  - 自動コンパクションの挙動を変更する、または「プレコンパクション」のハウスキーピングを追加する場合
  - メモリフラッシュやサイレントなシステムターンを実装したい場合
title: "セッション管理 詳細解説"
x-i18n:
  source_path: reference/session-management-compaction.md
  source_hash: bf3715770ba63436
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:15Z
---

# セッション管理 & コンパクション（詳細解説）

このドキュメントでは、OpenClaw がセッションをエンドツーエンドでどのように管理するかを説明します。

- **セッションルーティング**（受信メッセージがどのように `sessionKey` にマップされるか）
- **セッションストア**（`sessions.json`）と、その追跡内容
- **トランスクリプトの永続化**（`*.jsonl`）とその構造
- **トランスクリプトの衛生管理**（実行前のプロバイダー固有の修正）
- **コンテキスト制限**（コンテキストウィンドウ vs 追跡トークン）
- **コンパクション**（手動 + 自動コンパクション）およびプレコンパクション作業をフックする場所
- **サイレントなハウスキーピング**（例: ユーザーに表示される出力を生成すべきでないメモリ書き込み）

まずは上位レベルの概要を確認したい場合は、次から始めてください。

- [/concepts/session](/concepts/session)
- [/concepts/compaction](/concepts/compaction)
- [/concepts/session-pruning](/concepts/session-pruning)
- [/reference/transcript-hygiene](/reference/transcript-hygiene)

---

## 真実の源: Gateway（ゲートウェイ）

OpenClaw は、セッション状態を所有する単一の **Gateway プロセス** を中心に設計されています。

- UI（macOS アプリ、Web Control UI、TUI）は、セッション一覧やトークン数について Gateway に問い合わせる必要があります。
- リモートモードでは、セッションファイルはリモートホスト上にあります。「ローカルの Mac のファイルを確認」しても、Gateway が使用している内容は反映されません。

---

## 2 つの永続化レイヤー

OpenClaw は、セッションを 2 つのレイヤーで永続化します。

1. **セッションストア（`sessions.json`）**
   - キー/値マップ: `sessionKey -> SessionEntry`
   - 小さく可変で、編集（またはエントリの削除）が安全
   - セッションメタデータ（現在のセッション id、最終アクティビティ、トグル、トークンカウンターなど）を追跡

2. **トランスクリプト（`<sessionId>.jsonl`）**
   - ツリー構造を持つ追記専用のトランスクリプト（エントリは `id` + `parentId` を持つ）
   - 実際の会話 + ツール呼び出し + コンパクション要約を保存
   - 将来のターンでモデルコンテキストを再構築するために使用

---

## ディスク上の場所

Gateway ホスト上で、エージェントごとに以下に保存されます。

- ストア: `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- トランスクリプト: `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`
  - Telegram トピックのセッション: `.../<sessionId>-topic-<threadId>.jsonl`

OpenClaw はこれらを `src/config/sessions.ts` を介して解決します。

---

## セッションキー（`sessionKey`）

`sessionKey` は、「どの会話バケットにいるか」（ルーティング + 分離）を識別します。

一般的なパターン:

- メイン/ダイレクトチャット（エージェントごと）: `agent:<agentId>:<mainKey>`（デフォルト `main`）
- グループ: `agent:<agentId>:<channel>:group:<id>`
- ルーム/チャンネル（Discord/Slack）: `agent:<agentId>:<channel>:channel:<id>` または `...:room:<id>`
- Cron: `cron:<job.id>`
- Webhook: `hook:<uuid>`（上書きされない限り）

正規のルールは [/concepts/session](/concepts/session) に記載されています。

---

## セッション id（`sessionId`）

各 `sessionKey` は、現在の `sessionId`（会話を継続するトランスクリプトファイル）を指します。

目安となるルール:

- **リセット**（`/new`、`/reset`）は、その `sessionKey` に対して新しい `sessionId` を作成します。
- **日次リセット**（デフォルトは Gateway ホストのローカル時刻で午前 4:00）は、リセット境界後の次のメッセージで新しい `sessionId` を作成します。
- **アイドル期限切れ**（`session.reset.idleMinutes` または旧 `session.idleMinutes`）は、アイドルウィンドウ後にメッセージが到着すると新しい `sessionId` を作成します。日次 + アイドルの両方が設定されている場合、先に期限切れになった方が優先されます。

実装詳細: 判定は `src/auto-reply/reply/session.ts` 内の `initSessionState()` で行われます。

---

## セッションストアのスキーマ（`sessions.json`）

ストアの値型は、`src/config/sessions.ts` 内の `SessionEntry` です。

主なフィールド（網羅的ではありません）:

- `sessionId`: 現在のトランスクリプト id（`sessionFile` が設定されていない限り、ファイル名はこれから派生）
- `updatedAt`: 最終アクティビティのタイムスタンプ
- `sessionFile`: 任意の明示的なトランスクリプトパス上書き
- `chatType`: `direct | group | room`（UI と送信ポリシーの補助）
- `provider`、`subject`、`room`、`space`、`displayName`: グループ/チャンネルのラベリング用メタデータ
- トグル:
  - `thinkingLevel`、`verboseLevel`、`reasoningLevel`、`elevatedLevel`
  - `sendPolicy`（セッション単位の上書き）
- モデル選択:
  - `providerOverride`、`modelOverride`、`authProfileOverride`
- トークンカウンター（ベストエフォート / プロバイダー依存）:
  - `inputTokens`、`outputTokens`、`totalTokens`、`contextTokens`
- `compactionCount`: このセッションキーで自動コンパクションが完了した回数
- `memoryFlushAt`: 最後のプレコンパクションメモリフラッシュのタイムスタンプ
- `memoryFlushCompactionCount`: 最後のフラッシュ実行時のコンパクション回数

ストアは編集可能ですが、権限は Gateway にあります。セッション実行中にエントリを書き換えたり、再水和したりすることがあります。

---

## トランスクリプト構造（`*.jsonl`）

トランスクリプトは、`@mariozechner/pi-coding-agent` の `SessionManager` によって管理されます。

ファイルは JSONL 形式です。

- 1 行目: セッションヘッダー（`type: "session"`。`id`、`cwd`、`timestamp`、任意の `parentSession` を含む）
- 以降: `id` + `parentId`（ツリー）を持つセッションエントリ

主なエントリタイプ:

- `message`: user/assistant/toolResult メッセージ
- `custom_message`: 拡張により注入され、モデルコンテキストに **入る** メッセージ（UI から非表示にできる）
- `custom`: モデルコンテキストに **入らない** 拡張状態
- `compaction`: `firstKeptEntryId` と `tokensBefore` を持つ永続化されたコンパクション要約
- `branch_summary`: ツリーブランチ移動時の永続化された要約

OpenClaw は意図的にトランスクリプトを「修正」しません。Gateway は `SessionManager` を使用して読み書きします。

---

## コンテキストウィンドウ vs 追跡トークン

重要な概念は 2 つあります。

1. **モデルのコンテキストウィンドウ**: モデルごとのハード上限（モデルから見えるトークン）
2. **セッションストアのカウンター**: `sessions.json` に書き込まれるローリング統計（/status やダッシュボードで使用）

制限を調整する場合:

- コンテキストウィンドウはモデルカタログに由来し（設定で上書き可能）ます。
- ストア内の `contextTokens` は実行時の推定/報告値です。厳密な保証として扱わないでください。

詳細は [/token-use](/token-use) を参照してください。

---

## コンパクション: 何か

コンパクションは、古い会話をトランスクリプト内の永続化された `compaction` エントリに要約し、最近のメッセージはそのまま保持します。

コンパクション後、以降のターンでは次が参照されます。

- コンパクション要約
- `firstKeptEntryId` 以降のメッセージ

コンパクションは **永続的** です（セッションプルーニングとは異なります）。[/concepts/session-pruning](/concepts/session-pruning) を参照してください。

---

## 自動コンパクションが発生するタイミング（Pi ランタイム）

組み込み Pi エージェントでは、自動コンパクションは次の 2 つのケースでトリガーされます。

1. **オーバーフロー回復**: モデルがコンテキストオーバーフローエラーを返す → コンパクション → 再試行。
2. **しきい値の維持**: 成功したターンの後、次を満たす場合:

`contextTokens > contextWindow - reserveTokens`

ここで:

- `contextWindow` はモデルのコンテキストウィンドウ
- `reserveTokens` はプロンプト + 次のモデル出力のために予約されるヘッドルーム

これらは Pi ランタイムのセマンティクスです（OpenClaw はイベントを消費しますが、コンパクションの判断は Pi が行います）。

---

## コンパクション設定（`reserveTokens`、`keepRecentTokens`）

Pi のコンパクション設定は、Pi 設定にあります。

```json5
{
  compaction: {
    enabled: true,
    reserveTokens: 16384,
    keepRecentTokens: 20000,
  },
}
```

OpenClaw は、組み込み実行向けに安全下限も適用します。

- `compaction.reserveTokens < reserveTokensFloor` の場合、OpenClaw はそれを引き上げます。
- デフォルトの下限は `20000` トークンです。
- `agents.defaults.compaction.reserveTokensFloor: 0` を設定すると下限を無効化できます。
- すでに高い場合、OpenClaw は変更しません。

理由: コンパクションが不可避になる前に、マルチターンの「ハウスキーピング」（例: メモリ書き込み）に十分なヘッドルームを残すためです。

実装: `src/agents/pi-settings.ts` 内の `ensurePiCompactionReserveTokens()`
（`src/agents/pi-embedded-runner.ts` から呼び出されます）。

---

## ユーザーに見えるサーフェス

次を通じて、コンパクションとセッション状態を確認できます。

- `/status`（任意のチャットセッション内）
- `openclaw status`（CLI）
- `openclaw sessions` / `sessions --json`
- 詳細モード: `🧹 Auto-compaction complete` + コンパクション回数

---

## サイレントなハウスキーピング（`NO_REPLY`）

OpenClaw は、ユーザーが中間出力を見るべきでないバックグラウンドタスク向けに「サイレント」なターンをサポートします。

慣例:

- アシスタントは出力の先頭に `NO_REPLY` を付け、「ユーザーに返信を配信しない」ことを示します。
- OpenClaw は配信レイヤーでこれを削除/抑制します。

`2026.1.10` 以降、OpenClaw は、部分チャンクが `NO_REPLY` で始まる場合に **ドラフト/タイピングのストリーミング** も抑制します。これにより、サイレント操作がターン途中で部分出力を漏らしません。

---

## プレコンパクションの「メモリフラッシュ」（実装済み）

目的: 自動コンパクションが発生する前に、サイレントなエージェントターンを実行して永続的な状態をディスクに書き込み（例: エージェントワークスペース内の `memory/YYYY-MM-DD.md`）、コンパクションで重要なコンテキストが消えないようにします。

OpenClaw は **事前しきい値フラッシュ** アプローチを使用します。

1. セッションのコンテキスト使用量を監視します。
2. 「ソフトしきい値」（Pi のコンパクションしきい値より低い）を超えたら、エージェントにサイレントな
   「今すぐメモリを書き込む」指示を実行します。
3. `NO_REPLY` を使用して、ユーザーには何も表示されません。

設定（`agents.defaults.compaction.memoryFlush`）:

- `enabled`（デフォルト: `true`）
- `softThresholdTokens`（デフォルト: `4000`）
- `prompt`（フラッシュターン用のユーザーメッセージ）
- `systemPrompt`（フラッシュターン用に追加される追加の system プロンプト）

注意事項:

- デフォルトのプロンプト/system プロンプトには、配信を抑制するための `NO_REPLY` ヒントが含まれます。
- フラッシュはコンパクションサイクルごとに 1 回実行されます（`sessions.json` で追跡）。
- フラッシュは組み込み Pi セッションでのみ実行されます（CLI バックエンドではスキップ）。
- セッションワークスペースが読み取り専用の場合、フラッシュはスキップされます（`workspaceAccess: "ro"` または `"none"`）。
- ワークスペースのファイルレイアウトと書き込みパターンについては [Memory](/concepts/memory) を参照してください。

Pi は拡張 API に `session_before_compact` フックも公開していますが、OpenClaw の
フラッシュロジックは現在 Gateway 側にあります。

---

## トラブルシューティング チェックリスト

- セッションキーが間違っている場合: [/concepts/session](/concepts/session) から始め、`/status` 内の `sessionKey` を確認してください。
- ストアとトランスクリプトの不一致: Gateway ホストと、`openclaw status` から得られるストアパスを確認してください。
- コンパクションが頻発する場合: 次を確認してください。
  - モデルのコンテキストウィンドウ（小さすぎないか）
  - コンパクション設定（`reserveTokens` がモデルウィンドウに対して高すぎると、早期にコンパクションが発生する可能性があります）
  - tool-result の肥大化: セッションプルーニングを有効化/調整してください
- サイレントターンが漏れる場合: 返信が `NO_REPLY`（正確なトークン）で始まっていること、およびストリーミング抑制の修正を含むビルドであることを確認してください。
