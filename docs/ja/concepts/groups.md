---
summary: "各サーフェス（WhatsApp/Telegram/Discord/Slack/Signal/iMessage/Microsoft Teams）におけるグループチャットの挙動"
read_when:
  - グループチャットの挙動やメンションゲーティングを変更する場合
title: "グループ"
x-i18n:
  source_path: concepts/groups.md
  source_hash: b727a053edf51f6e
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:04:32Z
---

# グループ

OpenClaw は、WhatsApp、Telegram、Discord、Slack、Signal、iMessage、Microsoft Teams といった各サーフェスにわたって、グループチャットを一貫して扱います。

## 初心者向けイントロ（2 分）

OpenClaw は、あなた自身のメッセージングアカウント上で「動作」します。別の WhatsApp ボットユーザーが存在するわけではありません。  
**あなた**がグループに参加していれば、OpenClaw はそのグループを認識し、そこで応答できます。

デフォルトの挙動:

- グループは制限されます（`groupPolicy: "allowlist"`）。
- 明示的にメンションゲーティングを無効化しない限り、返信にはメンションが必要です。

翻訳すると: 許可リストに登録された送信者が OpenClaw にメンションすることで、OpenClaw を起動できます。

> TL;DR
>
> - **DM アクセス**は `*.allowFrom` によって制御されます。
> - **グループアクセス**は `*.groupPolicy` + 許可リスト（`*.groups`、`*.groupAllowFrom`）によって制御されます。
> - **返信トリガー**はメンションゲーティング（`requireMention`、`/activation`）によって制御されます。

クイックフロー（グループメッセージに何が起きるか）:

```
groupPolicy? disabled -> drop
groupPolicy? allowlist -> group allowed? no -> drop
requireMention? yes -> mentioned? no -> store for context only
otherwise -> reply
```

![グループメッセージフロー](/images/groups-flow.svg)

次のようにしたい場合...
| 目標 | 設定するもの |
|------|-------------|
| すべてのグループを許可しつつ、@メンション時のみ返信 | `groups: { "*": { requireMention: true } }` |
| すべてのグループ返信を無効化 | `groupPolicy: "disabled"` |
| 特定のグループのみ | `groups: { "<group-id>": { ... } }`（`"*"` キーなし） |
| グループでトリガーできるのは自分だけ | `groupPolicy: "allowlist"`、`groupAllowFrom: ["+1555..."]` |

## セッションキー

- グループセッションは `agent:<agentId>:<channel>:group:<id>` のセッションキーを使用します（ルーム/チャンネルは `agent:<agentId>:<channel>:channel:<id>` を使用します）。
- Telegram のフォーラムトピックは、グループ ID に `:topic:<threadId>` を追加し、各トピックが独自のセッションを持つようにします。
- ダイレクトチャットはメインセッション（または設定により送信者ごと）を使用します。
- ハートビートはグループセッションではスキップされます。

## パターン: 個人 DM + 公開グループ（単一エージェント）

はい — 「個人」トラフィックが **DM** で、「公開」トラフィックが **グループ** の場合、これはうまく機能します。

理由: 単一エージェントモードでは、DM は通常 **メイン** のセッションキー（`agent:main:main`）に入り、グループは常に **非メイン** のセッションキー（`agent:main:<channel>:group:<id>`）を使用します。`mode: "non-main"` でサンドボックス化を有効にすると、これらのグループセッションは Docker で実行される一方、メインの DM セッションはホスト上に残ります。

これにより、エージェントの「脳」（共有ワークスペース + メモリ）は 1 つのまま、実行姿勢を 2 つに分けられます:

- **DM**: フルツール（ホスト）
- **グループ**: サンドボックス + 制限ツール（Docker）

> 「個人」と「公開」でワークスペース/ペルソナを完全に分離する必要がある（決して混ざってはいけない）場合は、第 2 のエージェント + バインディングを使用してください。[Multi-Agent Routing](/concepts/multi-agent) を参照してください。

例（DM はホスト、グループはサンドボックス化 + メッセージング専用ツール）:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main", // groups/channels are non-main -> sandboxed
        scope: "session", // strongest isolation (one container per group/channel)
        workspaceAccess: "none",
      },
    },
  },
  tools: {
    sandbox: {
      tools: {
        // If allow is non-empty, everything else is blocked (deny still wins).
        allow: ["group:messaging", "group:sessions"],
        deny: ["group:runtime", "group:fs", "group:ui", "nodes", "cron", "gateway"],
      },
    },
  },
}
```

「ホストアクセスなし」ではなく「グループはフォルダー X だけを見えるようにしたい」場合は、`workspaceAccess: "none"` を維持し、許可リストに登録されたパスのみをサンドボックスにマウントしてください:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "session",
        workspaceAccess: "none",
        docker: {
          binds: [
            // hostPath:containerPath:mode
            "~/FriendsShared:/data:ro",
          ],
        },
      },
    },
  },
}
```

関連:

- 設定キーとデフォルト値: [Gateway configuration](/gateway/configuration#agentsdefaultssandbox)
- ツールがブロックされる理由のデバッグ: [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated)
- バインドマウントの詳細: [Sandboxing](/gateway/sandboxing#custom-bind-mounts)

## 表示ラベル

- UI ラベルは、利用可能な場合は `displayName` を使用し、`<channel>:<token>` として整形されます。
- `#room` はルーム/チャンネル用に予約されています。グループチャットは `g-<slug>`（小文字、スペースは `-` に置換、`#@+._-` は保持）を使用します。

## グループポリシー

チャンネルごとに、グループ/ルームメッセージの扱い方を制御します:

```json5
{
  channels: {
    whatsapp: {
      groupPolicy: "disabled", // "open" | "disabled" | "allowlist"
      groupAllowFrom: ["+15551234567"],
    },
    telegram: {
      groupPolicy: "disabled",
      groupAllowFrom: ["123456789", "@username"],
    },
    signal: {
      groupPolicy: "disabled",
      groupAllowFrom: ["+15551234567"],
    },
    imessage: {
      groupPolicy: "disabled",
      groupAllowFrom: ["chat_id:123"],
    },
    msteams: {
      groupPolicy: "disabled",
      groupAllowFrom: ["user@org.com"],
    },
    discord: {
      groupPolicy: "allowlist",
      guilds: {
        GUILD_ID: { channels: { help: { allow: true } } },
      },
    },
    slack: {
      groupPolicy: "allowlist",
      channels: { "#general": { allow: true } },
    },
    matrix: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["@owner:example.org"],
      groups: {
        "!roomId:example.org": { allow: true },
        "#alias:example.org": { allow: true },
      },
    },
  },
}
```

| ポリシー      | 挙動                                                                                 |
| ------------- | ------------------------------------------------------------------------------------ |
| `"open"`      | グループは許可リストをバイパスします。メンションゲーティングは引き続き適用されます。 |
| `"disabled"`  | すべてのグループメッセージを完全にブロックします。                                   |
| `"allowlist"` | 設定された許可リストに一致するグループ/ルームのみを許可します。                      |

注意:

- `groupPolicy` はメンションゲーティング（@メンションを要求）とは別です。
- WhatsApp/Telegram/Signal/iMessage/Microsoft Teams: `groupAllowFrom` を使用します（フォールバック: 明示的な `allowFrom`）。
- Discord: 許可リストは `channels.discord.guilds.<id>.channels` を使用します。
- Slack: 許可リストは `channels.slack.channels` を使用します。
- Matrix: 許可リストは `channels.matrix.groups`（ルーム ID、エイリアス、または名前）を使用します。送信者を制限するには `channels.matrix.groupAllowFrom` を使用します。ルームごとの `users` 許可リストもサポートされています。
- グループ DM は別途制御されます（`channels.discord.dm.*`、`channels.slack.dm.*`）。
- Telegram の許可リストは、ユーザー ID（`"123456789"`、`"telegram:123456789"`、`"tg:123456789"`）またはユーザー名（`"@alice"` または `"alice"`）に一致させられます。プレフィックスは大文字小文字を区別しません。
- デフォルトは `groupPolicy: "allowlist"` です。グループ許可リストが空の場合、グループメッセージはブロックされます。

クイックなメンタルモデル（グループメッセージの評価順）:

1. `groupPolicy`（open/disabled/allowlist）
2. グループ許可リスト（`*.groups`、`*.groupAllowFrom`、チャンネル固有の許可リスト）
3. メンションゲーティング（`requireMention`、`/activation`）

## メンションゲーティング（デフォルト）

グループメッセージは、グループごとに上書きしない限りメンションが必要です。デフォルト値は、`*.groups."*"` 配下のサブシステムごとに存在します。

ボットのメッセージへの返信は、（チャンネルが返信メタデータをサポートしている場合）暗黙のメンションとして扱われます。これは Telegram、WhatsApp、Slack、Discord、Microsoft Teams に適用されます。

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "*": { requireMention: true },
        "123@g.us": { requireMention: false },
      },
    },
    telegram: {
      groups: {
        "*": { requireMention: true },
        "123456789": { requireMention: false },
      },
    },
    imessage: {
      groups: {
        "*": { requireMention: true },
        "123": { requireMention: false },
      },
    },
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          mentionPatterns: ["@openclaw", "openclaw", "\\+15555550123"],
          historyLimit: 50,
        },
      },
    ],
  },
}
```

注意:

- `mentionPatterns` は大文字小文字を区別しない正規表現です。
- 明示的なメンションを提供するサーフェスは、そのまま通過します。パターンはフォールバックです。
- エージェントごとの上書き: `agents.list[].groupChat.mentionPatterns`（複数のエージェントが 1 つのグループを共有する場合に有用です）。
- メンションゲーティングは、メンション検出が可能な場合（ネイティブメンション、または `mentionPatterns` が設定されている場合）にのみ適用されます。
- Discord のデフォルトは `channels.discord.guilds."*"` に存在します（ギルド/チャンネルごとに上書き可能です）。
- グループ履歴コンテキストは、チャンネル間で一様にラップされ、**pending-only**（メンションゲーティングによりスキップされたメッセージ）です。グローバルデフォルトには `messages.groupChat.historyLimit` を、上書きには `channels.<channel>.historyLimit`（または `channels.<channel>.accounts.*.historyLimit`）を使用します。無効化するには `0` を設定してください。

## グループ/チャンネルのツール制限（任意）

一部のチャンネル設定では、**特定のグループ/ルーム/チャンネル内**で利用可能なツールを制限できます。

- `tools`: グループ全体に対してツールを許可/拒否します。
- `toolsBySender`: グループ内での送信者ごとの上書き（キーは、チャンネルに応じて送信者 ID/ユーザー名/メールアドレス/電話番号です）。ワイルドカードとして `"*"` を使用します。

解決順（より具体的なものが優先）:

1. グループ/チャンネルの `toolsBySender` 一致
2. グループ/チャンネルの `tools`
3. デフォルト（`"*"`）の `toolsBySender` 一致
4. デフォルト（`"*"`）の `tools`

例（Telegram）:

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { tools: { deny: ["exec"] } },
        "-1001234567890": {
          tools: { deny: ["exec", "read", "write"] },
          toolsBySender: {
            "123456789": { alsoAllow: ["exec"] },
          },
        },
      },
    },
  },
}
```

注意:

- グループ/チャンネルのツール制限は、グローバル/エージェントのツールポリシーに加えて適用されます（拒否が依然として優先されます）。
- 一部のチャンネルでは、ルーム/チャンネルのネストが異なります（例: Discord `guilds.*.channels.*`、Slack `channels.*`、MS Teams `teams.*.channels.*`）。

## グループ許可リスト

`channels.whatsapp.groups`、`channels.telegram.groups`、または `channels.imessage.groups` が設定されている場合、これらのキーはグループ許可リストとして機能します。すべてのグループを許可しつつ、デフォルトのメンション挙動を設定するには `"*"` を使用してください。

よくある意図（コピー/ペースト）:

1. すべてのグループ返信を無効化

```json5
{
  channels: { whatsapp: { groupPolicy: "disabled" } },
}
```

2. 特定のグループのみを許可（WhatsApp）

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "123@g.us": { requireMention: true },
        "456@g.us": { requireMention: false },
      },
    },
  },
}
```

3. すべてのグループを許可しつつ、メンションを必須にする（明示）

```json5
{
  channels: {
    whatsapp: {
      groups: { "*": { requireMention: true } },
    },
  },
}
```

4. グループでトリガーできるのはオーナーのみ（WhatsApp）

```json5
{
  channels: {
    whatsapp: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15551234567"],
      groups: { "*": { requireMention: true } },
    },
  },
}
```

## アクティベーション（オーナーのみ）

グループオーナーは、グループごとのアクティベーションを切り替えられます:

- `/activation mention`
- `/activation always`

オーナーは `channels.whatsapp.allowFrom` によって決定されます（未設定の場合は、ボット自身の E.164 ）。コマンドは単独のメッセージとして送信してください。その他のサーフェスは現在 `/activation` を無視します。

## コンテキストフィールド

グループの受信ペイロードは次を設定します:

- `ChatType=group`
- `GroupSubject`（既知の場合）
- `GroupMembers`（既知の場合）
- `WasMentioned`（メンションゲーティング結果）
- Telegram のフォーラムトピックには `MessageThreadId` と `IsForum` も含まれます。

エージェントの system prompt には、新しいグループセッションの最初のターンでグループ向けイントロが含まれます。そこでは、モデルに対して、人間のように応答すること、Markdown の表を避けること、そしてリテラルな `\n` シーケンスを入力しないことを促します。

## iMessage 固有事項

- ルーティングまたは許可リスト化では `chat_id:<id>` を優先してください。
- チャット一覧: `imsg chats --limit 20`。
- グループ返信は常に同じ `chat_id` に戻ります。

## WhatsApp 固有事項

WhatsApp のみの挙動（履歴の注入、メンション処理の詳細）については、[Group messages](/concepts/group-messages) を参照してください。
