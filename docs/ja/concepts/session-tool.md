---
summary: "セッションの一覧表示、履歴の取得、セッション間メッセージ送信を行うためのエージェント用セッション ツール"
read_when:
  - セッション ツールを追加または変更するとき
title: "セッション ツール"
x-i18n:
  source_path: concepts/session-tool.md
  source_hash: cb6e0982ebf507bc
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:09:15Z
---

# セッション ツール

目標: エージェントがセッションを一覧表示し、履歴を取得し、別のセッションへ送信できる、小さく誤用しにくいツール セットです。

## ツール名

- `sessions_list`
- `sessions_history`
- `sessions_send`
- `sessions_spawn`

## キー モデル

- メインのダイレクトチャット バケットは、常にリテラル キー `"main"`（現在のエージェントのメイン キーに解決されます）です。
- グループチャットは `agent:<agentId>:<channel>:group:<id>` または `agent:<agentId>:<channel>:channel:<id>`（完全なキーを渡します）を使用します。
- Cron ジョブは `cron:<job.id>` を使用します。
- フックは明示的に設定されない限り `hook:<uuid>` を使用します。
- ノード セッションは明示的に設定されない限り `node-<nodeId>` を使用します。

`global` と `unknown` は予約値であり、一覧表示されることはありません。`session.scope = "global"` の場合、すべてのツールで `main` にエイリアスし、呼び出し元が `global` を見ることがないようにします。

## sessions_list

セッションを行の配列として一覧表示します。

パラメータ:

- `kinds?: string[]` フィルタ: `"main" | "group" | "cron" | "hook" | "node" | "other"` のいずれか
- `limit?: number` 最大行数（デフォルト: サーバーデフォルト。例: 200 などにクランプ）
- `activeMinutes?: number` N 分以内に更新されたセッションのみ
- `messageLimit?: number` 0 = メッセージなし（デフォルト 0）; >0 = 最後の N 件のメッセージを含める

挙動:

- `messageLimit > 0` はセッションごとに `chat.history` を取得し、最後の N 件のメッセージを含めます。
- ツール結果は一覧出力からフィルタリングされます。ツール メッセージには `sessions_history` を使用します。
- **サンドボックス化された** エージェント セッションで実行する場合、セッション ツールはデフォルトで **生成済みのみの可視性**（下記参照）になります。

行の形状（JSON）:

- `key`: セッション キー（string）
- `kind`: `main | group | cron | hook | node | other`
- `channel`: `whatsapp | telegram | discord | signal | imessage | webchat | internal | unknown`
- `displayName`（利用可能な場合のグループ表示ラベル）
- `updatedAt`（ms）
- `sessionId`
- `model`, `contextTokens`, `totalTokens`
- `thinkingLevel`, `verboseLevel`, `systemSent`, `abortedLastRun`
- `sendPolicy`（設定されている場合のセッション上書き）
- `lastChannel`, `lastTo`
- `deliveryContext`（利用可能な場合の正規化された `{ channel, to, accountId }`）
- `transcriptPath`（store dir + sessionId から導出されるベストエフォート パス）
- `messages?`（`messageLimit > 0` の場合のみ）

## sessions_history

1 つのセッションのトランスクリプトを取得します。

パラメータ:

- `sessionKey`（必須; セッション キーまたは `sessions_list` の `sessionId` を受け付けます）
- `limit?: number` 最大メッセージ数（サーバーでクランプ）
- `includeTools?: boolean`（デフォルト false）

挙動:

- `includeTools=false` は `role: "toolResult"` メッセージをフィルタリングします。
- メッセージ配列を生のトランスクリプト形式で返します。
- `sessionId` が与えられると、OpenClaw は対応するセッション キーに解決します（id が見つからない場合はエラー）。

## sessions_send

別のセッションへメッセージを送信します。

パラメータ:

- `sessionKey`（必須; セッション キーまたは `sessions_list` の `sessionId` を受け付けます）
- `message`（必須）
- `timeoutSeconds?: number`（デフォルト >0; 0 = fire-and-forget）

挙動:

- `timeoutSeconds = 0`: キューに入れて `{ runId, status: "accepted" }` を返します。
- `timeoutSeconds > 0`: 完了まで最大 N 秒待機し、その後 `{ runId, status: "ok", reply }` を返します。
- 待機がタイムアウトした場合: `{ runId, status: "timeout", error }`。実行は継続します。後で `sessions_history` を呼び出してください。
- 実行が失敗した場合: `{ runId, status: "error", error }`。
- 配送の実行は一次の実行が完了した後にアナウンスされ、ベストエフォートです。`status: "ok"` はアナウンスの配送を保証しません。
- 待機は gateway `agent.wait`（サーバー側）経由で行われるため、再接続で待機が失われません。
- エージェント間メッセージのコンテキストが一次の実行に注入されます。
- 一次の実行が完了した後、OpenClaw は **返信戻しループ**を実行します:
  - ラウンド 2+ は要求元エージェントと対象エージェントの間で交互になります。
  - ping‑pong を止めるには、正確に `REPLY_SKIP` と返信してください。
  - 最大ターン数は `session.agentToAgent.maxPingPongTurns`（0–5、デフォルト 5）です。
- ループが終了すると、OpenClaw は **エージェント間アナウンス ステップ**（対象エージェントのみ）を実行します:
  - 黙るには、正確に `ANNOUNCE_SKIP` と返信してください。
  - それ以外の返信は対象チャンネルに送信されます。
  - アナウンス ステップには、元のリクエスト + ラウンド 1 の返信 + 最新の ping‑pong 返信が含まれます。

## チャンネル フィールド

- グループの場合、`channel` はセッション エントリに記録されているチャンネルです。
- ダイレクトチャットの場合、`channel` は `lastChannel` からマップされます。
- cron/hook/node の場合、`channel` は `internal` です。
- 欠落している場合、`channel` は `unknown` です。

## セキュリティ / 送信ポリシー

チャンネル/チャット種別によるポリシーベースのブロック（セッション id ごとではありません）。

```json
{
  "session": {
    "sendPolicy": {
      "rules": [
        {
          "match": { "channel": "discord", "chatType": "group" },
          "action": "deny"
        }
      ],
      "default": "allow"
    }
  }
}
```

ランタイム上書き（セッション エントリごと）:

- `sendPolicy: "allow" | "deny"`（未設定 = 設定を継承）
- `sessions.patch` または所有者のみの `/send on|off|inherit`（スタンドアロン メッセージ）で設定可能です。

適用ポイント:

- `chat.send` / `agent`（gateway）
- 自動返信の配送ロジック

## sessions_spawn

隔離されたセッションでサブエージェントの実行を生成し、結果を要求元チャット チャンネルへアナウンスします。

パラメータ:

- `task`（必須）
- `label?`（任意; ログ/UI 用）
- `agentId?`（任意; 許可されている場合、別のエージェント id の配下で生成）
- `model?`（任意; サブエージェント model を上書きします。不正な値はエラー）
- `runTimeoutSeconds?`（デフォルト 0; 設定されると、N 秒後にサブエージェントの実行を中止します）
- `cleanup?`（`delete|keep`、デフォルト `keep`）

許可リスト:

- `agents.list[].subagents.allowAgents`: `agentId` 経由で許可されるエージェント id の一覧（任意を許可するには `["*"]`）。デフォルト: 要求元エージェントのみ。

デバイス検出:

- `sessions_spawn` に対してどのエージェント id が許可されているかを検出するには `agents_list` を使用します。

挙動:

- `deliver: false` で新しい `agent:<agentId>:subagent:<uuid>` セッションを開始します。
- サブエージェントはデフォルトで、完全なツール セットから **セッション ツールを除いたもの**になります（`tools.subagents.tools` で設定可能）。
- サブエージェントは `sessions_spawn` を呼び出すことは許可されません（サブエージェント → サブエージェントの生成は禁止）。
- 常にノンブロッキング: `{ status: "accepted", runId, childSessionKey }` を直ちに返します。
- 完了後、OpenClaw はサブエージェントの **アナウンス ステップ**を実行し、結果を要求元チャット チャンネルに投稿します。
- アナウンス ステップ中に黙るには、正確に `ANNOUNCE_SKIP` と返信してください。
- アナウンス返信は `Status`/`Result`/`Notes` に正規化されます。`Status` は（model のテキストではなく）ランタイムの結果に由来します。
- サブエージェント セッションは `agents.defaults.subagents.archiveAfterMinutes` 後に自動アーカイブされます（デフォルト: 60）。
- アナウンス返信には統計行（ランタイム、トークン、sessionKey/sessionId、トランスクリプト パス、任意のコスト）が含まれます。

## サンドボックス セッションの可視性

サンドボックス化されたセッションはセッション ツールを使用できますが、デフォルトでは `sessions_spawn` 経由で生成したセッションのみが見えます。

設定:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        // default: "spawned"
        sessionToolsVisibility: "spawned", // or "all"
      },
    },
  },
}
```
