---
summary: "チャンネル（WhatsApp、Telegram、Discord、Slack）ごとのルーティングルールと共有コンテキスト"
read_when:
  - チャンネルのルーティングや受信トレイの挙動を変更する場合
title: "チャンネル ルーティング"
x-i18n:
  source_path: channels/channel-routing.md
  source_hash: cfc2cade2984225d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:14:47Z
---

# チャンネル & ルーティング

OpenClaw は、**メッセージが送信されてきたチャンネルに返信を返します**。  
モデルがチャンネルを選択することはありません。ルーティングは決定的で、ホスト設定によって制御されます。

## 主要用語

- **Channel**: `whatsapp`、`telegram`、`discord`、`slack`、`signal`、`imessage`、`webchat`。
- **AccountId**: チャンネルごとのアカウントインスタンス（対応している場合）。
- **AgentId**: 分離されたワークスペース + セッションストア（「脳」）。
- **SessionKey**: コンテキストを保存し、並行性を制御するために使用されるバケットキー。

## セッションキーの形（例）

ダイレクトメッセージは、エージェントの **main** セッションに集約されます。

- `agent:<agentId>:<mainKey>`（デフォルト: `agent:main:main`）

グループおよびチャンネルは、チャンネルごとに分離されたままです。

- グループ: `agent:<agentId>:<channel>:group:<id>`
- チャンネル／ルーム: `agent:<agentId>:<channel>:channel:<id>`

スレッド:

- Slack／Discord のスレッドは、ベースキーに `:thread:<threadId>` を付加します。
- Telegram のフォーラムトピックは、グループキーに `:topic:<topicId>` を埋め込みます。

例:

- `agent:main:telegram:group:-1001234567890:topic:42`
- `agent:main:discord:channel:123456:thread:987654`

## ルーティングルール（エージェントの選択方法）

ルーティングは、受信メッセージごとに **1 つのエージェント** を選択します。

1. **完全一致のピア**（`bindings` が `peer.kind` + `peer.id` と一致）。
2. **Guild 一致**（Discord）— `guildId` 経由。
3. **Team 一致**（Slack）— `teamId` 経由。
4. **アカウント一致**（チャンネル上の `accountId`）。
5. **チャンネル一致**（そのチャンネル上の任意のアカウント）。
6. **デフォルトエージェント**（`agents.list[].default`、それ以外はリストの先頭、フォールバックは `main`）。

一致したエージェントが、使用されるワークスペースとセッションストアを決定します。

## ブロードキャストグループ（複数エージェントを実行）

ブロードキャストグループを使用すると、OpenClaw が通常返信する状況において、同一のピアに対して **複数のエージェント** を実行できます（例: WhatsApp のグループで、メンション／アクティベーションのゲーティング後）。

設定:

```json5
{
  broadcast: {
    strategy: "parallel",
    "120363403215116621@g.us": ["alfred", "baerbel"],
    "+15555550123": ["support", "logger"],
  },
}
```

参照: [Broadcast Groups](/channels/broadcast-groups)。

## 設定の概要

- `agents.list`: 名前付きエージェント定義（ワークスペース、モデルなど）。
- `bindings`: 受信チャンネル／アカウント／ピアをエージェントにマップします。

例:

```json5
{
  agents: {
    list: [{ id: "support", name: "Support", workspace: "~/.openclaw/workspace-support" }],
  },
  bindings: [
    { match: { channel: "slack", teamId: "T123" }, agentId: "support" },
    { match: { channel: "telegram", peer: { kind: "group", id: "-100123" } }, agentId: "support" },
  ],
}
```

## セッションストレージ

セッションストアは、state ディレクトリ配下に配置されます（デフォルトは `~/.openclaw`）。

- `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- JSONL のトランスクリプトは、ストアと同じ場所に保存されます。

`session.store` および `{agentId}` のテンプレート化により、ストアパスを上書きできます。

## WebChat の挙動

WebChat は **選択されたエージェント** にアタッチされ、デフォルトではエージェントの main セッションを使用します。  
このため、WebChat では、そのエージェントにおけるクロスチャンネルのコンテキストを 1 か所で確認できます。

## 返信コンテキスト

受信した返信には、以下が含まれます。

- 利用可能な場合、`ReplyToId`、`ReplyToBody`、および `ReplyToSender`。
- 引用されたコンテキストは、`Body` に `[Replying to ...]` ブロックとして追加されます。

これは、すべてのチャンネルで一貫しています。
